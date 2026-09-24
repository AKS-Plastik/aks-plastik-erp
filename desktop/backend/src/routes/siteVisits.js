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
      include: { customer: customerSelect, employee: employeeSelect, assignees: employeeSelect, orders: { select: { id: true, code: true, status: true, totalAmount: true } }, statusNotes: { include: { createdBy: employeeSelect }, orderBy: { createdAt: 'desc' } } },
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
      include: { customer: true, employee: employeeSelect, assignees: employeeSelect, orders: { select: { id: true, code: true, status: true, totalAmount: true } }, statusNotes: { include: { createdBy: employeeSelect }, orderBy: { createdAt: 'desc' } } },
    })
    if (!visit) return res.status(404).json({ error: 'Site visit not found' })
    res.json(visit)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { title, customerId, location, employeeId, assignees, date, time, notes, isVisit } = req.body

    if (req.user.role !== 'admin') {
      const today = new Date().toISOString().split('T')[0]
      if (date && date < today) {
        return res.status(403).json({ error: 'Sadece adminler geçmiş tarihe ziyaret ekleyebilir.' })
      }
    }

    let finalAssignees = []
    if (req.user.role === 'admin') {
      if (Array.isArray(assignees)) {
        finalAssignees = assignees
      } else if (employeeId) {
        finalAssignees = [employeeId]
      }
    } else {
      if (req.user.employeeId) {
        finalAssignees = [req.user.employeeId]
      }
    }

    const code = `SV-${String(Date.now()).slice(-4)}`
    const finalTitle = isVisit ? 'Müşteri Ziyareti' : (title?.trim() || 'Ziyaret')
    const visit = await prisma.siteVisit.create({
      data: {
        code,
        title: finalTitle,
        isVisit: isVisit ?? true,
        location: location?.trim() || '',
        date,
        time,
        notes: notes?.trim() || '',
        customerId: customerId || null,
        employeeId: employeeId || null,
        assignees: {
          connect: finalAssignees.map(id => ({ id }))
        }
      },
      include: { customer: customerSelect, employee: employeeSelect, assignees: employeeSelect, orders: { select: { id: true, code: true, status: true, totalAmount: true } }, statusNotes: { include: { createdBy: employeeSelect }, orderBy: { createdAt: 'desc' } } },
    })
    res.status(201).json(visit)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { title, customerId, location, employeeId, assignees, date, time, status, notes, isVisit } = req.body

    const existingVisit = await prisma.siteVisit.findUnique({ where: { id: req.params.id } })
    if (!existingVisit) return res.status(404).json({ error: 'Site visit not found' })

    if (req.user.role !== 'admin') {
      const today = new Date().toISOString().split('T')[0]
      if (date && date !== existingVisit.date && date < today) {
        return res.status(403).json({ error: 'Sadece adminler geçmiş tarihe ziyaret atayabilir.' })
      }
    }

    const updateData = {
      title: title?.trim() || 'Ziyaret',
      location: location?.trim() || '',
      date,
      time,
      status,
      notes: notes?.trim() || '',
      customerId: customerId || null,
      employeeId: employeeId || null,
    }

    if (status && status !== existingVisit.status && req.body.statusNote) {
      updateData.statusNotes = {
        create: {
          fromStatus: existingVisit.status,
          toStatus: status,
          note: req.body.statusNote,
          customerId: customerId || existingVisit.customerId,
          createdById: req.user.employeeId || null
        }
      }
    }

    if (assignees !== undefined || employeeId !== undefined) {
      let finalAssignees = []
      if (req.user.role === 'admin') {
        if (Array.isArray(assignees)) {
          finalAssignees = assignees
        } else if (employeeId) {
          finalAssignees = [employeeId]
        }
      } else {
        if (req.user.employeeId) {
          finalAssignees = [req.user.employeeId]
        }
      }
      updateData.assignees = { set: finalAssignees.map(id => ({ id })) }
    }

    const visit = await prisma.siteVisit.update({
      where: { id: req.params.id },
      data: updateData,
      include: { customer: customerSelect, employee: employeeSelect, assignees: employeeSelect, orders: { select: { id: true, code: true, status: true, totalAmount: true } }, statusNotes: { include: { createdBy: employeeSelect }, orderBy: { createdAt: 'desc' } } },
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
