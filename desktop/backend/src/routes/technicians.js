const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const router = Router()

// GET all technicians
router.get('/', async (req, res) => {
  try {
    const technicians = await prisma.technician.findMany({
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, name: true, code: true, accountCode: true } } },
    })
    res.json(technicians)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET single technician
router.get('/:id', async (req, res) => {
  try {
    const technician = await prisma.technician.findUnique({
      where: { id: req.params.id },
      include: { customer: true, reports: true, siteVisits: true },
    })
    if (!technician) return res.status(404).json({ error: 'Technician not found' })
    res.json(technician)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST create technician
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, phone, email, customerId, specialization } = req.body
    const name = `${firstName.trim()} ${lastName.trim()}`
    const initials = [firstName[0], lastName[0]].filter(Boolean).map((c) => c.toUpperCase()).join('')
    const code = `TECH-${String(Date.now()).slice(-4)}`

    const technician = await prisma.technician.create({
      data: {
        code,
        name,
        initials,
        phone,
        email,
        customerId: customerId || null,
        specialization: specialization?.trim() || '—',
      },
      include: { customer: { select: { id: true, name: true, code: true, accountCode: true } } },
    })
    res.status(201).json(technician)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT update technician
router.put('/:id', async (req, res) => {
  try {
    const { firstName, lastName, phone, email, customerId, status, specialization, certification } = req.body
    const name = `${firstName.trim()} ${lastName.trim()}`
    const initials = [firstName[0], lastName[0]].filter(Boolean).map((c) => c.toUpperCase()).join('')

    const technician = await prisma.technician.update({
      where: { id: req.params.id },
      data: {
        name,
        initials,
        phone,
        email,
        customerId: customerId || null,
        status,
        specialization: specialization?.trim() || '—',
        certification: certification?.trim() || '—',
      },
      include: { customer: { select: { id: true, name: true, code: true, accountCode: true } } },
    })
    res.json(technician)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE technician (admin only)
router.delete('/:id', (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}, async (req, res) => {
  try {
    await prisma.technician.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
