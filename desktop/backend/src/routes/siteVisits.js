const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const router = Router()

const employeeSelect = { select: { id: true, name: true, code: true } }
const customerSelect = { select: { id: true, name: true, code: true, accountCode: true } }

router.get('/', async (req, res) => {
  try {
    const visits = await prisma.siteVisit.findMany({
      orderBy: { createdAt: 'desc' },
      include: { customer: customerSelect, employee: employeeSelect },
    })
    res.json(visits)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const visit = await prisma.siteVisit.findUnique({
      where: { id: req.params.id },
      include: { customer: true, employee: employeeSelect },
    })
    if (!visit) return res.status(404).json({ error: 'Site visit not found' })
    res.json(visit)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { title, customerId, location, employeeId, date, time, notes } = req.body
    const code = `SV-${String(Date.now()).slice(-4)}`
    const visit = await prisma.siteVisit.create({
      data: {
        code,
        title: title.trim(),
        location: location?.trim() || '',
        date,
        time,
        notes: notes?.trim() || '',
        customerId: customerId || null,
        employeeId: employeeId || null,
      },
      include: { customer: customerSelect, employee: employeeSelect },
    })
    res.status(201).json(visit)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { title, customerId, location, employeeId, date, time, status, notes } = req.body
    const visit = await prisma.siteVisit.update({
      where: { id: req.params.id },
      data: {
        title: title.trim(),
        location: location?.trim() || '',
        date,
        time,
        status,
        notes: notes?.trim() || '',
        customerId: customerId || null,
        employeeId: employeeId || null,
      },
      include: { customer: customerSelect, employee: employeeSelect },
    })
    res.json(visit)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}, async (req, res) => {
  try {
    await prisma.siteVisit.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
