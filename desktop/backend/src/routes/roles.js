const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const router = Router()

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

router.get('/', async (req, res) => {
  try {
    const roles = await prisma.userRole.findMany({ orderBy: { name: 'asc' } })
    res.json(roles)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', adminOnly, async (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
    const role = await prisma.userRole.create({ data: { name: name.trim() } })
    res.status(201).json(role)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Role already exists' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
    const old = await prisma.userRole.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!old) return res.status(404).json({ error: 'Role not found' })
    // Rename in rolePermission and employee records too
    await prisma.$transaction([
      prisma.rolePermission.updateMany({ where: { role: old.name }, data: { role: name.trim() } }),
      prisma.statusPermission.updateMany({ where: { role: old.name }, data: { role: name.trim() } }),
      prisma.employee.updateMany({ where: { department: old.name }, data: { department: name.trim() } }),
      prisma.userRole.update({ where: { id: parseInt(req.params.id) }, data: { name: name.trim() } }),
    ])
    const updated = await prisma.userRole.findUnique({ where: { id: parseInt(req.params.id) } })
    res.json(updated)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Role name already exists' })
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const role = await prisma.userRole.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!role) return res.status(404).json({ error: 'Role not found' })
    await prisma.rolePermission.deleteMany({ where: { role: role.name } })
    await prisma.userRole.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
