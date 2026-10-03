const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Get all employee tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await prisma.employeeTask.findMany({
      include: {
        employee: true,
        machine: true,
        order: {
          select: {
            id: true,
            code: true,
            customer: true
          }
        },
        product: true,
        productionTask: {
          select: {
            id: true,
            code: true,
            orderItem: {
              select: {
                order: {
                  select: { code: true, customer: true }
                }
              }
            }
          }
        },
        taskNotes: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })
    res.json(tasks)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create task
router.post('/', async (req, res) => {
  try {
    const { title, date, status, employeeId, machineId, orderId, productionTaskId, note, productId, quantity } = req.body
    
    const data = {
      title,
      date,
      status: status || 'open',
      quantity: quantity ? parseInt(quantity) : 0,
      ...(employeeId && { employeeId }),
      ...(machineId && { machineId: parseInt(machineId) }),
      ...(orderId && { orderId }),
      ...(productionTaskId && { productionTaskId }),
      ...(productId && { productId }),
    }

    let task;
    if (note) {
      task = await prisma.employeeTask.create({
        data: {
          ...data,
          taskNotes: {
            create: {
              fromStatus: 'new',
              toStatus: status || 'open',
              note: note
            }
          }
        },
        include: { employee: true, machine: true, order: { select: { id: true, code: true, customer: true }}, productionTask: { select: { id: true, code: true, orderItem: { select: { order: { select: { code: true, customer: true } } } } } }, taskNotes: true }
      })
    } else {
      task = await prisma.employeeTask.create({
        data,
        include: { employee: true, machine: true, order: { select: { id: true, code: true, customer: true }}, productionTask: { select: { id: true, code: true, orderItem: { select: { order: { select: { code: true, customer: true } } } } } }, taskNotes: true }
      })
    }

    res.status(201).json(task)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update general details
router.put('/:id', async (req, res) => {
  try {
    const { title, date, employeeId, machineId, orderId, productionTaskId, productId, quantity } = req.body
    const task = await prisma.employeeTask.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(date && { date }),
        ...(quantity !== undefined && { quantity: parseInt(quantity) }),
        ...(employeeId !== undefined && { employeeId }),
        ...(machineId !== undefined && { machineId: machineId ? parseInt(machineId) : null }),
        ...(orderId !== undefined && { orderId }),
        ...(productionTaskId !== undefined && { productionTaskId }),
        ...(productId !== undefined && { productId }),
      },
      include: { employee: true, machine: true, product: true, order: { select: { id: true, code: true, customer: true }}, productionTask: { select: { id: true, code: true, orderItem: { select: { order: { select: { code: true, customer: true } } } } } }, taskNotes: true }
    })
    res.json(task)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Move/Update status (requires note if status changes)
router.patch('/:id/move', async (req, res) => {
  try {
    const { status, date, note } = req.body
    
    const existing = await prisma.employeeTask.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Task not found' })

    const updates = {
      ...(date && { date }),
      ...(status && { status })
    }

    let task;
    if (status && status !== existing.status) {
      if (!note) return res.status(400).json({ error: 'Statü değişikliği için not girmelisiniz.' })
      
      task = await prisma.employeeTask.update({
        where: { id: req.params.id },
        data: {
          ...updates,
          taskNotes: {
            create: {
              fromStatus: existing.status,
              toStatus: status,
              note: note
            }
          }
        },
        include: { employee: true, machine: true, order: { select: { id: true, code: true, customer: true }}, productionTask: { select: { id: true, code: true, orderItem: { select: { order: { select: { code: true, customer: true } } } } } }, taskNotes: { orderBy: { createdAt: 'desc' }} }
      })
    } else {
      task = await prisma.employeeTask.update({
        where: { id: req.params.id },
        data: updates,
        include: { employee: true, machine: true, order: { select: { id: true, code: true, customer: true }}, productionTask: true, taskNotes: { orderBy: { createdAt: 'desc' }} }
      })
    }

    res.json(task)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    await prisma.employeeTask.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Rollover tasks to next day (similar to production rollover)
router.post('/rollover', async (req, res) => {
  try {
    const { taskIds, targetDate } = req.body
    if (!taskIds || !taskIds.length || !targetDate) {
      return res.status(400).json({ error: 'Missing parameters' })
    }

    await prisma.employeeTask.updateMany({
      where: { id: { in: taskIds } },
      data: { date: targetDate }
    })
    
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
