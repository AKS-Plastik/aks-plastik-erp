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
    const { orderItemId, extrusionMachineId, extrusionOperatorId, cuttingMachineId, cuttingOperatorId, quantity, date } = req.body
    
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
          quantity: parseInt(quantity),
          status: 'open',
          date: date || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
          machineId: extrusionMachineId ? parseInt(extrusionMachineId) : null,
          operatorId: extrusionOperatorId || null,
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
          status: 'In-Production',
          ...(extrusionMachineId && { extrusionMachineId: parseInt(extrusionMachineId) }),
          ...(extrusionOperatorId && { extrusionOperatorId }),
          ...(cuttingMachineId && { cuttingMachineId: parseInt(cuttingMachineId) }),
          ...(cuttingOperatorId && { cuttingOperatorId })
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
    const { status, machineId, operatorId } = req.body
    const task = await prisma.productionTask.findUnique({ 
      where: { id: req.params.id },
      include: { orderItem: { include: { order: true } } }
    })
    
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const updates = []
    
    const shouldClearAssignment = status !== task.status && status !== 'completed'

    const updatedData = { status }
    if (machineId !== undefined) updatedData.machineId = machineId ? parseInt(machineId) : null
    else if (shouldClearAssignment) updatedData.machineId = null

    if (operatorId !== undefined) updatedData.operatorId = operatorId || null
    else if (shouldClearAssignment) updatedData.operatorId = null

    // Update the task status
    updates.push(prisma.productionTask.update({
      where: { id: task.id },
      data: updatedData,
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

// Rollover or Split task
router.post('/rollover', async (req, res) => {
  try {
    const { taskId, action, targetDate, targetStatus, completedQuantity } = req.body
    const task = await prisma.productionTask.findUnique({ where: { id: taskId }, include: { orderItem: true } })
    if (!task) return res.status(404).json({ error: 'Task not found' })

    if (action === 'rollover') {
      const newStatus = targetStatus || task.status
      const shouldClear = newStatus !== task.status && newStatus !== 'completed'
      
      const updated = await prisma.productionTask.update({
        where: { id: taskId },
        data: { 
          date: targetDate, 
          status: newStatus,
          ...(shouldClear ? { machineId: null, operatorId: null } : {})
        },
        include: {
          orderItem: { include: { order: { select: { code: true, customer: true, salesRep: true, employee: true } }, product: true } },
          machine: true,
          operator: true,
        }
      })
      await prisma.productionLog.create({
        data: {
          orderItemId: task.orderItemId,
          productionTaskId: taskId,
          action: 'Rollover',
          details: `Rolled over from ${task.date} to ${targetDate}. Status changed from ${task.status} to ${targetStatus || task.status}. Quantity: ${task.quantity}.`
        }
      })
      res.json({ action: 'rollover', task: updated })
    } else if (action === 'split') {
      const compQty = parseInt(completedQuantity)
      if (compQty <= 0 || compQty >= task.quantity) return res.status(400).json({ error: 'Invalid split quantity' })
      
      const remainQty = task.quantity - compQty
      
      const updates = [
        prisma.productionLog.create({
          data: {
            orderItemId: task.orderItemId,
            productionTaskId: taskId,
            action: 'Split Rollover',
            details: `Split from ${task.date} to ${targetDate}. ${compQty} completed, ${remainQty} moved to ${targetStatus || task.status}.`
          }
        }),
        prisma.productionTask.update({
          where: { id: taskId },
          data: { quantity: compQty, status: 'completed' }
        }),
        prisma.orderItem.update({
          where: { id: task.orderItemId },
          data: {
            inProductionQuantity: { decrement: compQty },
            producedQuantity: { increment: compQty }
          }
        }),
        prisma.productionTask.create({
          data: {
            code: `PT-${String(Date.now()).slice(-5)}`,
            orderItemId: task.orderItemId,
            machineId: task.status === (targetStatus || task.status) ? task.machineId : null,
            operatorId: task.status === (targetStatus || task.status) ? task.operatorId : null,
            quantity: remainQty,
            status: targetStatus || task.status,
            date: targetDate
          },
          include: {
            orderItem: { include: { order: { select: { code: true, customer: true, salesRep: true, employee: true } }, product: true } },
            machine: true,
            operator: true,
          }
        })
      ]
      
      const results = await prisma.$transaction(updates)
      const newTask = results[3]
      
      const updatedItem = await prisma.orderItem.findUnique({ where: { id: task.orderItemId } })
      if (updatedItem.producedQuantity >= updatedItem.quantity) {
        await prisma.orderItem.update({ where: { id: updatedItem.id }, data: { status: 'Production Completed' } })
      }
      
      const allItems = await prisma.orderItem.findMany({ where: { orderId: task.orderItem.orderId } })
      const allCompleted = allItems.every(i => i.producedQuantity >= i.quantity)
      const order = await prisma.order.findUnique({ where: { id: task.orderItem.orderId } })
      
      if (allCompleted && order.status !== 'Production Completed') {
        await prisma.order.update({ where: { id: task.orderItem.orderId }, data: { status: 'Production Completed' } })
      }
      
      res.json({ action: 'split', originalTask: results[1], newTask })
    } else if (action === 'distribute') {
      const { completed, open, extrusion, cutting } = req.body.distributions
      const comp = parseInt(completed) || 0
      const opn = parseInt(open) || 0
      const ext = parseInt(extrusion) || 0
      const cut = parseInt(cutting) || 0
      
      const total = comp + opn + ext + cut
      if (total !== task.quantity) return res.status(400).json({ error: 'Distributions total must equal task quantity' })
      
      const updates = []
      
      updates.push(prisma.productionLog.create({
        data: {
          orderItemId: task.orderItemId,
          productionTaskId: comp > 0 ? task.id : null,
          action: 'Distributed Rollover',
          details: `Distributed from ${task.date} to ${targetDate}. Original qty: ${task.quantity}. Completed: ${comp}, Open: ${opn}, Extrusion: ${ext}, Cutting: ${cut}`
        }
      }))
      
      if (comp > 0) {
        updates.push(prisma.productionTask.update({
          where: { id: taskId },
          data: { quantity: comp, status: 'completed' }
        }))
        updates.push(prisma.orderItem.update({
          where: { id: task.orderItemId },
          data: {
            inProductionQuantity: { decrement: comp },
            producedQuantity: { increment: comp }
          }
        }))
      } else {
        updates.push(prisma.productionTask.delete({
          where: { id: taskId }
        }))
      }
      
      if (opn > 0) {
        updates.push(prisma.productionTask.create({
          data: {
            code: `PT-${String(Date.now() + 1).slice(-5)}`,
            orderItemId: task.orderItemId,
            machineId: null,
            operatorId: null,
            quantity: opn,
            status: 'open',
            date: targetDate
          }
        }))
      }
      if (ext > 0) {
        updates.push(prisma.productionTask.create({
          data: {
            code: `PT-${String(Date.now() + 2).slice(-5)}`,
            orderItemId: task.orderItemId,
            machineId: task.status === 'extrusion' ? task.machineId : null,
            operatorId: task.status === 'extrusion' ? task.operatorId : null,
            quantity: ext,
            status: 'extrusion',
            date: targetDate
          }
        }))
      }
      if (cut > 0) {
        updates.push(prisma.productionTask.create({
          data: {
            code: `PT-${String(Date.now() + 3).slice(-5)}`,
            orderItemId: task.orderItemId,
            machineId: task.status === 'cutting' ? task.machineId : null,
            operatorId: task.status === 'cutting' ? task.operatorId : null,
            quantity: cut,
            status: 'cutting',
            date: targetDate
          }
        }))
      }
      
      await prisma.$transaction(updates)
      
      if (comp > 0) {
        const updatedItem = await prisma.orderItem.findUnique({ where: { id: task.orderItemId } })
        if (updatedItem.producedQuantity >= updatedItem.quantity) {
          await prisma.orderItem.update({ where: { id: updatedItem.id }, data: { status: 'Production Completed' } })
        }
        const allItems = await prisma.orderItem.findMany({ where: { orderId: task.orderItem.orderId } })
        const allCompleted = allItems.every(i => i.producedQuantity >= i.quantity)
        const order = await prisma.order.findUnique({ where: { id: task.orderItem.orderId } })
        
        if (allCompleted && order.status !== 'Production Completed') {
          await prisma.order.update({ where: { id: task.orderItem.orderId }, data: { status: 'Production Completed' } })
        }
      }
      
      res.json({ action: 'distribute', success: true })
    } else {
      res.status(400).json({ error: 'Invalid action' })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
