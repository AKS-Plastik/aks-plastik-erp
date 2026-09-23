const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const router = Router()

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

// GET /api/permissions — returns { roleName: ['page1', 'page2', ...] }
router.get('/', async (req, res) => {
  try {
    const rows = await prisma.rolePermission.findMany()
    const map = {}
    rows.forEach(({ role, page }) => {
      if (!map[role]) map[role] = []
      map[role].push(page)
    })
    res.json(map)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/permissions/:role — replace all pages for a role
router.put('/:role', adminOnly, async (req, res) => {
  try {
    const { role } = req.params
    const { pages } = req.body // array of page strings
    await prisma.rolePermission.deleteMany({ where: { role } })
    if (pages?.length) {
      await prisma.rolePermission.createMany({
        data: pages.map((page) => ({ role, page })),
        skipDuplicates: true,
      })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/permissions/employee — returns { employeeId: ['page1', 'page2', ...] }
router.get('/employee', async (req, res) => {
  try {
    const rows = await prisma.employeePermission.findMany()
    const map = {}
    rows.forEach(({ employeeId, page }) => {
      if (!map[employeeId]) map[employeeId] = []
      map[employeeId].push(page)
    })
    res.json(map)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/permissions/employee/:employeeId — replace all pages for an employee
router.put('/employee/:employeeId', adminOnly, async (req, res) => {
  try {
    const { employeeId } = req.params
    const { pages } = req.body // array of page strings
    await prisma.employeePermission.deleteMany({ where: { employeeId } })
    if (pages?.length) {
      await prisma.employeePermission.createMany({
        data: pages.map((page) => ({ employeeId, page })),
        skipDuplicates: true,
      })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
