const path = require('path')
const fs = require('fs')
const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')
const multer = require('multer')

const prisma = new PrismaClient()
const router = Router()

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

const uploadsDir = path.join(__dirname, '../../uploads/manuals')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `machine_${req.params.id}_${Date.now()}${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

const include = {
  maintenanceRecords: { orderBy: { date: 'desc' } },
  monthlyMaintenance: { orderBy: [{ year: 'desc' }, { month: 'asc' }] },
}

// ── List all machines ──────────────────────────────────────────────────────────

async function ensureSystemSettingTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public."SystemSetting" (
        "key" TEXT PRIMARY KEY,
        "value" JSONB NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `)
  } catch (e) {}
}

async function getTemplatesForMachine(machineId) {
  await ensureSystemSettingTable()
  let defaultTemplates = [
    "Mekanik aksam, yataklar ve yağlama seviyesi kontrolü",
    "Elektrik panosu, kablo bağlantıları ve fan temizliği",
    "Filtreler, hava hatları ve pnömatik basınç kontrolü",
    "Acil durdurma butonları, sviçler ve sensör testi"
  ]
  try {
    const s = await prisma.$queryRawUnsafe(`SELECT value FROM "SystemSetting" WHERE "key" = 'monthly_maintenance_template'`)
    if (s.length && Array.isArray(s[0].value) && s[0].value.length > 0) {
      defaultTemplates = s[0].value
    }
  } catch (e) {}

  if (machineId) {
    try {
      const mSetting = await prisma.$queryRawUnsafe(`SELECT value FROM "SystemSetting" WHERE "key" = $1`, `monthly_maintenance_template_machine_${machineId}`)
      if (mSetting.length && Array.isArray(mSetting[0].value)) {
        return { templates: mSetting[0].value, isCustom: true, defaultTemplates }
      }
    } catch (e) {}
  }

  return { templates: defaultTemplates, isCustom: false, defaultTemplates }
}

async function syncMonthlyTasksForMachine(machineId, year, templates) {
  const cleanTemplates = (templates || []).map(t => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id, month, description, completed, "isDefault"
     FROM "MachineMonthlyMaintenance"
     WHERE "machineId" = $1 AND "year" = $2`,
    machineId,
    year
  )

  const existingByMonth = new Map()
  for (const t of existing) {
    if (!existingByMonth.has(t.month)) existingByMonth.set(t.month, [])
    existingByMonth.get(t.month).push(t)
  }

  for (let m = 1; m <= 12; m++) {
    const monthTasks = existingByMonth.get(m) || []
    const defaultTasks = monthTasks.filter(t => t.isDefault)

    // Remove uncompleted default tasks that are no longer in templates
    for (const dt of defaultTasks) {
      if (!dt.completed && !cleanTemplates.includes(dt.description)) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "MachineMonthlyMaintenance" WHERE id = $1`,
          dt.id
        )
      }
    }

    // Add any template task not yet in this month
    const existingDescSet = new Set(defaultTasks.map(t => t.description))
    for (const desc of cleanTemplates) {
      if (!existingDescSet.has(desc)) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "MachineMonthlyMaintenance"
           ("machineId", "year", "month", "description", "completed", "isDefault", "history", "completedBy", "createdAt")
           VALUES ($1, $2, $3, $4, false, true, '[]'::jsonb, '', NOW())`,
          machineId,
          year,
          m,
          desc
        )
      }
    }
  }
}

async function ensureMonthlyTasksForMachine(machineId, year) {
  const { templates } = await getTemplatesForMachine(machineId)

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id, month, description, completed, "isDefault"
     FROM "MachineMonthlyMaintenance"
     WHERE "machineId" = $1 AND "year" = $2`,
    machineId,
    year
  )

  const existingByMonth = new Map()
  for (const t of existing) {
    if (!existingByMonth.has(t.month)) existingByMonth.set(t.month, [])
    existingByMonth.get(t.month).push(t)
  }

  for (let m = 1; m <= 12; m++) {
    const monthTasks = existingByMonth.get(m) || []
    const defaultTasks = monthTasks.filter(t => t.isDefault)

    if (defaultTasks.length === 0) {
      for (const desc of templates) {
        if (!desc.trim()) continue
        await prisma.$executeRawUnsafe(
          `INSERT INTO "MachineMonthlyMaintenance"
           ("machineId", "year", "month", "description", "completed", "isDefault", "history", "completedBy", "createdAt")
           VALUES ($1, $2, $3, $4, false, true, '[]'::jsonb, '', NOW())`,
          machineId,
          year,
          m,
          desc.trim()
        )
      }
    }
  }
}

// ── Monthly Templates Settings (Global & Per-Machine) ────────────────────────
router.get('/settings/monthly-templates', async (req, res) => {
  try {
    const machineId = req.query.machineId ? parseInt(req.query.machineId) : null
    const result = await getTemplatesForMachine(machineId)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/settings/monthly-templates', adminOnly, async (req, res) => {
  try {
    await ensureSystemSettingTable()
    const { templates, machineId, syncYear, resetToGlobal } = req.body
    const targetMachineId = machineId ? parseInt(machineId) : null
    const yearToSync = syncYear ? parseInt(syncYear) : new Date().getFullYear()

    if (targetMachineId) {
      const settingKey = `monthly_maintenance_template_machine_${targetMachineId}`
      if (resetToGlobal) {
        await prisma.$executeRawUnsafe(`DELETE FROM "SystemSetting" WHERE "key" = $1`, settingKey)
        const { templates: globalTpls } = await getTemplatesForMachine(null)
        if (syncYear) {
          await syncMonthlyTasksForMachine(targetMachineId, yearToSync, globalTpls)
        }
        return res.json({ success: true, templates: globalTpls, isCustom: false, machineId: targetMachineId })
      }

      const filtered = Array.isArray(templates)
        ? templates.map(t => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)
        : []

      const jsonVal = JSON.stringify(filtered)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT ("key") DO UPDATE SET "value" = $2::jsonb, "updatedAt" = NOW()`,
        settingKey,
        jsonVal
      )

      if (syncYear) {
        await syncMonthlyTasksForMachine(targetMachineId, yearToSync, filtered)
      }

      return res.json({ success: true, templates: filtered, isCustom: true, machineId: targetMachineId })
    }

    // Global template update
    const filtered = Array.isArray(templates)
      ? templates.map(t => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)
      : []

    const jsonVal = JSON.stringify(filtered)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
       VALUES ('monthly_maintenance_template', $1::jsonb, NOW())
       ON CONFLICT ("key") DO UPDATE SET "value" = $1::jsonb, "updatedAt" = NOW()`,
      jsonVal
    )

    if (syncYear) {
      const allMachines = await prisma.machine.findMany({ select: { id: true } })
      for (const m of allMachines) {
        const mSetting = await prisma.$queryRawUnsafe(
          `SELECT value FROM "SystemSetting" WHERE "key" = $1`,
          `monthly_maintenance_template_machine_${m.id}`
        )
        if (!mSetting.length || !Array.isArray(mSetting[0].value)) {
          await syncMonthlyTasksForMachine(m.id, yearToSync, filtered)
        }
      }
    }

    res.json({ success: true, templates: filtered, isCustom: false })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const machines = await prisma.machine.findMany({ orderBy: { createdAt: 'desc' }, include })
    try {
      const records = await prisma.$queryRawUnsafe('SELECT id, expenses FROM "MachineMaintenanceRecord"')
      const expMap = new Map(records.map(r => [r.id, r.expenses]))
      for (const m of machines) {
        if (Array.isArray(m.maintenanceRecords)) {
          for (const rec of m.maintenanceRecords) {
            rec.expenses = expMap.get(rec.id) || []
          }
        }
      }
    } catch (rawErr) {
      console.warn('Could not fetch maintenance expenses:', rawErr.message)
    }
    res.json(machines)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Create machine ─────────────────────────────────────────────────────────────
router.post('/', adminOnly, async (req, res) => {
  try {
    const { code, name, type, manufacturer, manufacturerCountry, manufacturerContact,
            productionYear, warrantyExpiry, status, location, nextMaintenanceDue, notes } = req.body
    if (!code?.trim()) return res.status(400).json({ error: 'Machine code is required' })
    if (!name?.trim()) return res.status(400).json({ error: 'Machine name is required' })
    const machine = await prisma.machine.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        type: type?.trim() || '',
        manufacturer: manufacturer?.trim() || '',
        manufacturerCountry: manufacturerCountry?.trim() || '',
        manufacturerContact: manufacturerContact?.trim() || '',
        productionYear: productionYear ? parseInt(productionYear) : null,
        warrantyExpiry: warrantyExpiry || '',
        status: status || 'Active',
        location: location?.trim() || '',
        nextMaintenanceDue: nextMaintenanceDue || '',
        notes: notes?.trim() || '',
      },
      include,
    })
    try {
      await ensureMonthlyTasksForMachine(machine.id, new Date().getFullYear())
    } catch (e) {}
    res.status(201).json(machine)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Machine code already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ── Update machine ─────────────────────────────────────────────────────────────
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { code, name, type, manufacturer, manufacturerCountry, manufacturerContact,
            productionYear, warrantyExpiry, status, location, nextMaintenanceDue, notes } = req.body
    const machine = await prisma.machine.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(code !== undefined && { code: code.trim() }),
        ...(name !== undefined && { name: name.trim() }),
        type: type?.trim() || '',
        manufacturer: manufacturer?.trim() || '',
        manufacturerCountry: manufacturerCountry?.trim() || '',
        manufacturerContact: manufacturerContact?.trim() || '',
        productionYear: productionYear ? parseInt(productionYear) : null,
        warrantyExpiry: warrantyExpiry || '',
        status: status || 'Active',
        location: location?.trim() || '',
        nextMaintenanceDue: nextMaintenanceDue || '',
        notes: notes?.trim() || '',
      },
      include,
    })
    res.json(machine)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Machine code already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ── Delete machine ─────────────────────────────────────────────────────────────
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const machine = await prisma.machine.findUnique({ where: { id: parseInt(req.params.id) } })
    if (machine?.manualPath && fs.existsSync(machine.manualPath)) fs.unlinkSync(machine.manualPath)
    await prisma.machine.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Upload manual ──────────────────────────────────────────────────────────────
router.post('/:id/manual', adminOnly, upload.single('manual'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.machine.findUnique({ where: { id } })
    if (existing?.manualPath && fs.existsSync(existing.manualPath)) fs.unlinkSync(existing.manualPath)
    const machine = await prisma.machine.update({
      where: { id },
      data: { manualPath: req.file.path, manualName: req.file.originalname },
      include,
    })
    res.json(machine)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Download manual ────────────────────────────────────────────────────────────
router.get('/:id/manual', async (req, res) => {
  try {
    const machine = await prisma.machine.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!machine?.manualPath || !fs.existsSync(machine.manualPath))
      return res.status(404).json({ error: 'Manual not found' })
    res.download(machine.manualPath, machine.manualName || 'manual.pdf')
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Delete manual ──────────────────────────────────────────────────────────────
router.delete('/:id/manual', adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const machine = await prisma.machine.findUnique({ where: { id } })
    if (machine?.manualPath && fs.existsSync(machine.manualPath)) fs.unlinkSync(machine.manualPath)
    const updated = await prisma.machine.update({
      where: { id },
      data: { manualPath: '', manualName: '' },
      include,
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Add maintenance record ─────────────────────────────────────────────────────
router.post('/:id/maintenance', adminOnly, async (req, res) => {
  try {
    const machineId = parseInt(req.params.id)
    const { date, type, description, technician, cost, currency, nextDue, expenses } = req.body
    if (!date) return res.status(400).json({ error: 'Date is required' })

    const parsedExpenses = Array.isArray(expenses)
      ? expenses
          .filter(e => e && (e.title?.trim() || parseFloat(e.cost) > 0))
          .map(e => ({
            id: e.id || `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            title: (e.title || '').trim(),
            cost: parseFloat(e.cost) || 0,
            currency: e.currency || currency || 'TRY',
          }))
      : []

    const computedCost = parsedExpenses.length > 0
      ? parsedExpenses.reduce((sum, e) => sum + e.cost, 0)
      : (cost ? parseFloat(cost) : 0)

    const record = await prisma.machineMaintenanceRecord.create({
      data: {
        machineId,
        date,
        type: type || 'Preventive',
        description: description?.trim() || '',
        technician: technician?.trim() || '',
        cost: computedCost,
        currency: currency || 'TRY',
        nextDue: nextDue || '',
      },
    })

    if (parsedExpenses.length > 0) {
      try {
        await prisma.$executeRawUnsafe(
          'UPDATE "MachineMaintenanceRecord" SET "expenses" = $1::jsonb WHERE "id" = $2',
          JSON.stringify(parsedExpenses),
          record.id
        )
      } catch (expErr) {
        console.warn('Could not update expenses on maintenance record:', expErr.message)
      }
    }
    record.expenses = parsedExpenses

    if (nextDue) {
      await prisma.machine.update({ where: { id: machineId }, data: { nextMaintenanceDue: nextDue } })
    }
    res.status(201).json(record)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Delete maintenance record ──────────────────────────────────────────────────
router.delete('/:id/maintenance/:recordId', adminOnly, async (req, res) => {
  try {
    await prisma.machineMaintenanceRecord.delete({ where: { id: parseInt(req.params.recordId) } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Add monthly task ──────────────────────────────────────────────────────────
router.post('/:id/monthly', adminOnly, async (req, res) => {
  try {
    const machineId = parseInt(req.params.id)
    const { year, month, description } = req.body
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' })
    const task = await prisma.machineMonthlyMaintenance.create({
      data: { machineId, year: parseInt(year), month: parseInt(month), description: description.trim() },
    })
    res.status(201).json(task)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Update monthly task (toggle / edit) ──────────────────────────────────────
router.put('/:id/monthly/:taskId', adminOnly, async (req, res) => {
  try {
    const { description, completed } = req.body
    const data = {}
    if (description !== undefined) data.description = description.trim()
    if (completed !== undefined) data.completed = completed
    const task = await prisma.machineMonthlyMaintenance.update({
      where: { id: parseInt(req.params.taskId) },
      data,
    })
    res.json(task)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Delete monthly task ──────────────────────────────────────────────────────
router.delete('/:id/monthly/:taskId', adminOnly, async (req, res) => {
  try {
    await prisma.machineMonthlyMaintenance.delete({ where: { id: parseInt(req.params.taskId) } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
