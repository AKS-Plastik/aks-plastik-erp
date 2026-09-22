const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const router = Router()

const employeeSelect = { select: { id: true, name: true, code: true } }
const customerSelect = { select: { id: true, name: true, code: true, accountCode: true } }

router.get('/', async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
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
    const { title, description, priority, column, customerId, employeeId, dueDate } = req.body
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
    res.status(201).json(report)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { title, description, priority, column, customerId, employeeId, dueDate } = req.body
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
