const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const router = Router()

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

// GET /api/status-permissions — returns { roleName: ['status1', ...] }
router.get('/', async (req, res) => {
  try {
    const rows = await prisma.statusPermission.findMany()
    const map = {}
    rows.forEach(({ role, status }) => {
      if (!map[role]) map[role] = []
      map[role].push(status)
    })
    res.json(map)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/status-permissions/:role — replace all statuses for a role
router.put('/:role', adminOnly, async (req, res) => {
  try {
    const { role } = req.params
    const { statuses } = req.body
    await prisma.statusPermission.deleteMany({ where: { role } })
    if (statuses?.length) {
      await prisma.statusPermission.createMany({
        data: statuses.map((status) => ({ role, status })),
        skipDuplicates: true,
      })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
