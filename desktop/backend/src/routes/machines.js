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
router.get('/', async (req, res) => {
  try {
    const machines = await prisma.machine.findMany({ orderBy: { createdAt: 'desc' }, include })
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
    const { date, type, description, technician, cost, currency, nextDue } = req.body
    if (!date) return res.status(400).json({ error: 'Date is required' })
    const record = await prisma.machineMaintenanceRecord.create({
      data: {
        machineId,
        date,
        type: type || 'Preventive',
        description: description?.trim() || '',
        technician: technician?.trim() || '',
        cost: cost ? parseFloat(cost) : 0,
        currency: currency || 'USD',
        nextDue: nextDue || '',
      },
    })
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
