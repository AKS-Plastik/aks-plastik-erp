const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const router = Router()

// Get all production tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await prisma.productionTask.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        orderItem: {
          include: {
            order: { select: { code: true, customer: true, salesRep: true, employee: true } },
            product: true
          }
        },
        machine: true,
        operator: true,
      }
    })
    res.json(tasks)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create a new production task
router.post('/', async (req, res) => {
  try {
    const { orderItemId, machineId, operatorId, quantity } = req.body
    
    // Check orderItem limits
    const orderItem = await prisma.orderItem.findUnique({ where: { id: orderItemId } })
    if (!orderItem) return res.status(404).json({ error: 'Order item not found' })

    const totalAssigned = orderItem.producedQuantity + orderItem.inProductionQuantity + parseInt(quantity)
    if (totalAssigned > orderItem.quantity) {
      return res.status(400).json({ error: 'Cannot assign more quantity to production than ordered' })
    }

    const code = `PT-${String(Date.now()).slice(-5)}`

    // Transaction to create task and update order item status/quantities
    const [task] = await prisma.$transaction([
      prisma.productionTask.create({
        data: {
          code,
          orderItemId,
          machineId: parseInt(machineId),
          operatorId,
          quantity: parseInt(quantity),
          status: 'open',
        },
        include: {
          orderItem: { include: { order: { select: { code: true, customer: true, salesRep: true, employee: true } }, product: true } },
          machine: true,
          operator: true,
        }
      }),
      prisma.orderItem.update({
        where: { id: orderItemId },
        data: {
          inProductionQuantity: { increment: parseInt(quantity) },
          status: 'In-Production'
        }
      })
    ])

    // Update global order status if this is the first item in production
    const order = await prisma.order.findUnique({ where: { id: orderItem.orderId } })
    const updatableStatuses = ['Draft', 'Processing', 'Confirmed'];
    if (updatableStatuses.includes(order.status)) {
      await prisma.order.update({
        where: { id: orderItem.orderId },
        data: { status: 'In-Production' }
      })
    }

    res.status(201).json(task)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update production task status (e.g. from Kanban)
router.patch('/:id/move', async (req, res) => {
  try {
    const { status } = req.body
    const task = await prisma.productionTask.findUnique({ 
      where: { id: req.params.id },
      include: { orderItem: { include: { order: true } } }
    })
    
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const updates = []
    
    // Update the task status
    updates.push(prisma.productionTask.update({
      where: { id: task.id },
      data: { status },
      include: {
        orderItem: { include: { order: { select: { code: true, customer: true, salesRep: true, employee: true } }, product: true } },
        machine: true,
        operator: true,
      }
    }))

    // If task is completed, shift quantity from inProduction to produced
    if (status === 'completed' && task.status !== 'completed') {
      updates.push(prisma.orderItem.update({
        where: { id: task.orderItemId },
        data: {
          inProductionQuantity: { decrement: task.quantity },
          producedQuantity: { increment: task.quantity }
        }
      }))
    } else if (task.status === 'completed' && status !== 'completed') {
      // Revert if moved out of completed
      updates.push(prisma.orderItem.update({
        where: { id: task.orderItemId },
        data: {
          inProductionQuantity: { increment: task.quantity },
          producedQuantity: { decrement: task.quantity }
        }
      }))
    }

    const results = await prisma.$transaction(updates)
    const updatedTask = results[0]

    // Check if the whole orderItem is completed
    const updatedItem = await prisma.orderItem.findUnique({ where: { id: task.orderItemId } })
    if (updatedItem.producedQuantity >= updatedItem.quantity) {
      await prisma.orderItem.update({ where: { id: updatedItem.id }, data: { status: 'Production Completed' } })
    } else if (updatedItem.inProductionQuantity > 0 || updatedItem.producedQuantity > 0) {
      await prisma.orderItem.update({ where: { id: updatedItem.id }, data: { status: 'In-Production' } })
    }

    // Check if the entire order is completed
    const allItems = await prisma.orderItem.findMany({ where: { orderId: task.orderItem.orderId } })
    const allCompleted = allItems.every(i => i.producedQuantity >= i.quantity)
    const order = await prisma.order.findUnique({ where: { id: task.orderItem.orderId } })
    
    if (allCompleted && order.status !== 'Production Completed') {
      await prisma.order.update({ where: { id: task.orderItem.orderId }, data: { status: 'Production Completed' } })
    } else if (!allCompleted && order.status === 'Production Completed') {
      await prisma.order.update({ where: { id: task.orderItem.orderId }, data: { status: 'In-Production' } })
    }

    res.json(updatedTask)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update production task details (e.g. quantity, operator, machine)
router.put('/:id', async (req, res) => {
  try {
    const { machineId, operatorId, quantity, status } = req.body
    const updatedTask = await prisma.productionTask.update({
      where: { id: req.params.id },
      data: {
        ...(machineId && { machineId: parseInt(machineId) }),
        ...(operatorId && { operatorId }),
        ...(quantity && { quantity: parseInt(quantity) }),
        ...(status && { status }),
      },
      include: {
        orderItem: { include: { order: { select: { code: true, customer: true, salesRep: true, employee: true } }, product: true } },
        machine: true,
        operator: true,
      }
    })
    res.json(updatedTask)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete production task
router.delete('/:id', async (req, res) => {
  try {
    const task = await prisma.productionTask.findUnique({ where: { id: req.params.id } })
    if (task) {
      if (task.status === 'completed') {
        await prisma.orderItem.update({
          where: { id: task.orderItemId },
          data: { producedQuantity: { decrement: task.quantity } }
        })
      } else {
        await prisma.orderItem.update({
          where: { id: task.orderItemId },
          data: { inProductionQuantity: { decrement: task.quantity } }
        })
      }
      await prisma.productionTask.delete({ where: { id: req.params.id } })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
