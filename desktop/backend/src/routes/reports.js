const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')
const { sendNotification } = require('../lib/onesignal')

const prisma = new PrismaClient()
const router = Router()

const employeeSelect = { select: { id: true, name: true, code: true, department: true } }
const customerSelect = { select: { id: true, name: true, code: true, accountCode: true } }

// Helper: Determine user scope (Admin, Department Manager, or Regular Staff)
async function getUserScope(user) {
  if (!user) return { isAdmin: false, isDeptManager: false, department: null, deptEmpIds: [] }

  if (user.role === 'admin') {
    return { isAdmin: true, isDeptManager: true, department: null, deptEmpIds: [] }
  }

  const isManagerRole = (str) => {
    if (!str) return false
    const s = String(str).toLowerCase()
    return (
      s.includes('manager') ||
      s.includes('müdür') ||
      s.includes('mudur') ||
      s.includes('yönetici') ||
      s.includes('yonetici')
    )
  }

  const dept = user.department || user.employee?.department || null
  const isDeptManager = Boolean(
    user.employee?.isManager ||
    isManagerRole(user.department) ||
    isManagerRole(user.employee?.department) ||
    isManagerRole(user.employee?.position)
  )

  let deptEmpIds = []
  if (isDeptManager && dept) {
    const deptEmployees = await prisma.employee.findMany({
      where: {
        department: { equals: dept, mode: 'insensitive' },
      },
      select: { id: true },
    })
    deptEmpIds = deptEmployees.map((e) => e.id)
    if (user.employeeId && !deptEmpIds.includes(user.employeeId)) {
      deptEmpIds.push(user.employeeId)
    }
  }

  return {
    isAdmin: false,
    isDeptManager,
    department: dept,
    deptEmpIds,
  }
}

// Helper: Notify assigned employee about a task
async function notifyAssignee({ employeeId, creatorUser, report, actionType = 'assigned' }) {
  try {
    if (!employeeId) return

    const assignedUser = await prisma.user.findFirst({
      where: { employeeId },
      select: { id: true, employeeId: true, email: true, name: true },
    })

    // If no registered user found or assignee is the creator themselves, do not send notification
    if (!assignedUser || assignedUser.id === creatorUser?.id) return

    const creatorName = creatorUser?.name || 'Yönetici'
    const dueFormatted = report.dueDate
      ? ` (Teslim: ${new Date(report.dueDate).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })})`
      : ''

    const title = actionType === 'reassigned'
      ? `Görev Size Aktarıldı: ${report.title}`
      : `Yeni Görev: ${report.title}`

    const body = `${creatorName} tarafından size yeni bir görev atandı${dueFormatted}.`

    // 1. Save in database for in-app notification center (bell)
    await prisma.notification.create({
      data: {
        userId: assignedUser.id,
        title,
        body,
        type: 'task',
        page: 'reports',
        link: '/reports',
        isRead: false,
      },
    })

    // 2. Send Push via OneSignal
    const externalIds = [assignedUser.id, assignedUser.employeeId, assignedUser.email].filter(Boolean)
    await sendNotification(title, body, externalIds, '/reports')
  } catch (err) {
    console.error('[Report] notifyAssignee error:', err.message)
  }
}

// GET /api/reports - Listed according to user authority
router.get('/', async (req, res) => {
  try {
    const scope = await getUserScope(req.user)
    const { isAdmin, isDeptManager, deptEmpIds } = scope
    const where = {}

    if (isAdmin) {
      // Admin sees everyone by default, can filter by any employeeId
      if (req.query.employeeId) {
        where.employeeId = req.query.employeeId
      }
    } else if (isDeptManager) {
      // Dept Manager sees everyone in their department by default
      if (req.query.employeeId) {
        if (deptEmpIds.includes(req.query.employeeId)) {
          where.employeeId = req.query.employeeId
        } else {
          where.employeeId = 'forbidden'
        }
      } else {
        where.employeeId = { in: deptEmpIds }
      }
    } else {
      // Regular staff only see their own tasks
      const empId = req.user.employeeId
      if (empId) {
        where.employeeId = empId
      } else {
        where.employeeId = 'none'
      }
    }

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { customer: customerSelect, employee: employeeSelect },
    })
    res.json(reports)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      include: { customer: true, employee: employeeSelect },
    })
    if (!report) return res.status(404).json({ error: 'Report not found' })
    res.json(report)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    let { title, description, priority, column, customerId, employeeId, dueDate } = req.body
    const scope = await getUserScope(req.user)
    const { isAdmin, isDeptManager, deptEmpIds } = scope

    if (isAdmin) {
      // Admin can assign to any employee
    } else if (isDeptManager) {
      // Dept manager can assign to members of their department, or themselves
      if (!employeeId || !deptEmpIds.includes(employeeId)) {
        employeeId = req.user.employeeId || deptEmpIds[0] || null
      }
    } else {
      // Regular staff can only assign tasks to themselves
      employeeId = req.user.employeeId || null
    }

    const code = `RPT-${String(Date.now()).slice(-4)}`
    const report = await prisma.report.create({
      data: {
        code,
        title: title.trim(),
        description: description?.trim() || '',
        priority: priority || 'Low',
        column: column || 'open',
        customerId: customerId || null,
        employeeId: employeeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { customer: customerSelect, employee: employeeSelect },
    })

    // Send task assignment notification
    if (employeeId) {
      notifyAssignee({
        employeeId,
        creatorUser: req.user,
        report,
        actionType: 'assigned',
      }).catch((err) => console.error('[Report] Task creation notify error:', err.message))
    }

    res.status(201).json(report)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    let { title, description, priority, column, customerId, employeeId, dueDate } = req.body
    const scope = await getUserScope(req.user)
    const { isAdmin, isDeptManager, deptEmpIds } = scope

    const existing = await prisma.report.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Report not found' })

    // Check authority to update
    if (!isAdmin) {
      if (isDeptManager) {
        if (existing.employeeId && !deptEmpIds.includes(existing.employeeId)) {
          return res.status(403).json({ error: 'Bu görevi düzenleme yetkiniz yok.' })
        }
        if (employeeId && !deptEmpIds.includes(employeeId)) {
          employeeId = existing.employeeId
        }
      } else {
        if (existing.employeeId !== req.user.employeeId) {
          return res.status(403).json({ error: 'Sadece kendi görevinizi düzenleyebilirsiniz.' })
        }
        employeeId = existing.employeeId
      }
    }

    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: {
        title: title.trim(),
        description: description?.trim() || '',
        priority,
        column,
        customerId: customerId || null,
        employeeId: employeeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { customer: customerSelect, employee: employeeSelect },
    })

    // Notify if assigned to a new person
    if (employeeId && employeeId !== existing.employeeId) {
      notifyAssignee({
        employeeId,
        creatorUser: req.user,
        report,
        actionType: 'reassigned',
      }).catch((err) => console.error('[Report] Task update notify error:', err.message))
    }

    res.json(report)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id/move', async (req, res) => {
  try {
    const { column } = req.body
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { column },
      include: { customer: customerSelect, employee: employeeSelect },
    })
    res.json(report)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}, async (req, res) => {
  try {
    await prisma.report.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
