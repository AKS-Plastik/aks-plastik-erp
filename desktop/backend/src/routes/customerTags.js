const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET /api/customer-tags
router.get('/', async (req, res) => {
  try {
    const tags = await prisma.customerTag.findMany({
      orderBy: { name: 'asc' }
    })
    res.json(tags)
  } catch (error) {
    console.error('Failed to fetch tags:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/customer-tags
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required' })

    const existing = await prisma.customerTag.findUnique({ where: { name } })
    if (existing) return res.status(400).json({ error: 'Tag already exists' })

    const tag = await prisma.customerTag.create({
      data: { name, color: color || '#e2e8f0' }
    })
    res.status(201).json(tag)
  } catch (error) {
    console.error('Failed to create tag:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/customer-tags/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, color } = req.body

    const tag = await prisma.customerTag.update({
      where: { id },
      data: { name, color }
    })
    res.json(tag)
  } catch (error) {
    console.error('Failed to update tag:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/customer-tags/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    // First, disconnect this tag from all customers to satisfy explicit unlinking requirement
    await prisma.customerTag.update({
      where: { id },
      data: { customers: { set: [] } }
    })
    
    // Then delete the tag
    await prisma.customerTag.delete({
      where: { id }
    })
    res.json({ success: true })
  } catch (error) {
    console.error('Failed to delete tag:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
