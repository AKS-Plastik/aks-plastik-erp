const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')
const { adminOnly } = require('../middleware/auth')

const prisma = new PrismaClient()
const router = Router()

// ── List all vehicles (All authenticated users for dispatch selection) ──────
router.get('/', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { createdAt: 'desc' },
    })
    res.json(vehicles)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Create vehicle (Admin Only) ──────────────────────────────────────────────
router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, brand, model } = req.body

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Araç adı zorunludur' })
    }
    if (!brand?.trim()) {
      return res.status(400).json({ error: 'Marka zorunludur' })
    }
    if (!model?.trim()) {
      return res.status(400).json({ error: 'Model zorunludur' })
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        name: name.trim(),
        brand: brand.trim(),
        model: model.trim(),
      },
    })

    res.status(201).json(vehicle)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Delete vehicle (Admin Only) ──────────────────────────────────────────────
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    await prisma.vehicle.delete({
      where: { id },
    })
    res.json({ success: true, message: 'Araç başarıyla silindi' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
