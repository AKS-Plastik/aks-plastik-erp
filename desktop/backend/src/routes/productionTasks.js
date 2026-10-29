const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { adminOnly } = require('../middleware/auth')

const prisma = new PrismaClient()
const router = Router()
const { dispatchNotification } = require('../lib/notificationDispatcher')

// Ensure deliveries upload folder exists
const deliveriesDir = path.join(__dirname, '..', '..', 'uploads', 'deliveries')
if (!fs.existsSync(deliveriesDir)) {
  fs.mkdirSync(deliveriesDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, deliveriesDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `delivery-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
})

// Helper to check if a task is in completed production or post-production logistics
const LOGISTIC_STATUS_SET = new Set([
  'completed', 'Production Completed',
  'In Delivery', 'in_delivery', 'Teslimatta',
  'Invoiced', 'invoiced', 'E-Invoice', 'Fatura kesildi',
  'Delivered', 'delivered', 'Teslim Edildi'
])
const isFinishedProduction = (st) => Boolean(st && LOGISTIC_STATUS_SET.has(st))

// Get all production tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await prisma.productionTask.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        orderItem: {
          include: {
            order: { select: { id: true, code: true, customer: true, salesRep: true, employee: true } },
            product: true,
            notes: { orderBy: { createdAt: 'asc' } }
          }
        },
        product: true,
        machine: true,
        operator: true,
        deliveryRecords: { orderBy: { createdAt: 'desc' } },
        logisticsLogs: { orderBy: { createdAt: 'desc' } }
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
    const { source, productId, orderItemId, extrusionMachineId, extrusionOperatorId, cuttingMachineId, cuttingOperatorId, quantity, date } = req.body
    
    const code = `PT-${String(Date.now()).slice(-5)}`

    if (source === 'stock') {
      const task = await prisma.productionTask.create({
        data: {
          code,
          productId,
          quantity: Math.round(parseFloat(String(quantity).replace(",", "."))) || 0,
          status: 'open',
          date: date || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
          machineId: extrusionMachineId ? parseInt(extrusionMachineId) : null,
          operatorId: extrusionOperatorId || null,
        },
        include: {
          product: true,
          machine: true,
          operator: true,
        }
      })
      return res.status(201).json(task)
    }

    // Check orderItem limits
    const orderItem = await prisma.orderItem.findUnique({ where: { id: orderItemId } })
    if (!orderItem) return res.status(404).json({ error: 'Order item not found' })

    const totalAssigned = orderItem.producedQuantity + orderItem.inProductionQuantity + parseFloat(String(quantity).replace(",", "."))
    if (totalAssigned > orderItem.quantity) {
      return res.status(400).json({ error: 'Cannot assign more quantity to production than ordered' })
    }

    // Transaction to create task and update order item status/quantities
    const [task] = await prisma.$transaction([
      prisma.productionTask.create({
        data: {
          code,
          orderItemId,
          quantity: Math.round(parseFloat(String(quantity).replace(",", "."))) || 0,
          status: 'open',
          date: date || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
          machineId: extrusionMachineId ? parseInt(extrusionMachineId) : null,
          operatorId: extrusionOperatorId || null,
        },
        include: {
          orderItem: { include: { order: { select: { code: true, customer: true, salesRep: true, employee: true } }, product: true, notes: { orderBy: { createdAt: 'asc' } } } },
          product: true,
          machine: true,
          operator: true,
        }
      }),
      prisma.orderItem.update({
        where: { id: orderItemId },
        data: { 
          inProductionQuantity: { increment: parseFloat(String(quantity).replace(",", ".")) },
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

    dispatchNotification({
      title: `Yeni Üretim Görevi: #${task.code}`,
      body: `${task.product?.name || task.orderItem?.productName || 'Ürün'} (${task.quantity} adet) planlandı.`,
      type: 'production',
      page: 'production',
      link: `/production-tasks?taskId=${task.id}`,
      excludeUserId: req.user?.id,
    }).catch((err) => console.error('Failed to dispatch production task notification:', err))

    res.status(201).json(task)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update production task status (e.g. from Kanban)
router.patch('/:id/move', async (req, res) => {
  try {
    const { status, machineId, operatorId, splitQuantity, date } = req.body
    const task = await prisma.productionTask.findUnique({ 
      where: { id: req.params.id },
      include: { orderItem: { include: { order: true } } }
    })
    
    if (!task) return res.status(404).json({ error: 'Task not found' })

    if (status === 'In Delivery') {
      const hasDelivery = await prisma.deliveryRecord.findFirst({
        where: { productionTaskId: task.id }
      })
      if (!hasDelivery) {
        return res.status(400).json({ error: 'Teslimatta aşamasına geçmeden önce sevkiyat ve fotoğraf kaydı yapılmalıdır.' })
      }
    }

    const updates = []
    
    const shouldClearAssignment = status !== task.status && !isFinishedProduction(status)

    let returnedTask = null;

    if (splitQuantity && splitQuantity > 0 && splitQuantity < task.quantity) {
      const remainQty = task.quantity - splitQuantity
      
      const updatedData = { status, quantity: splitQuantity }
      if (date !== undefined) updatedData.date = date
      if (machineId !== undefined) updatedData.machineId = machineId ? parseInt(machineId) : null
      else if (shouldClearAssignment) updatedData.machineId = null

      if (operatorId !== undefined) updatedData.operatorId = operatorId || null
      else if (shouldClearAssignment) updatedData.operatorId = null

      updates.push(prisma.productionTask.create({
        data: {
          code: `PT-${String(Date.now()).slice(-5)}`,
          orderItemId: task.orderItemId || null,
          productId: task.productId || null,
          machineId: updatedData.machineId,
          operatorId: updatedData.operatorId,
          quantity: splitQuantity,
          status: status,
          date: date || task.date
        }
      }))
      
      updates.push(prisma.productionTask.update({
        where: { id: task.id },
        data: { quantity: remainQty }
      }))

      if (task.orderItemId) {
        const willBeFinished = isFinishedProduction(status)
        const wasFinished = isFinishedProduction(task.status)

        if (willBeFinished && !wasFinished) {
          updates.push(prisma.orderItem.update({
            where: { id: task.orderItemId },
            data: {
              inProductionQuantity: { decrement: splitQuantity },
              producedQuantity: { increment: splitQuantity }
            }
          }))
        } else if (!willBeFinished && wasFinished) {
          updates.push(prisma.orderItem.update({
            where: { id: task.orderItemId },
            data: {
              inProductionQuantity: { increment: splitQuantity },
              producedQuantity: { decrement: splitQuantity }
            }
          }))
        }
      }
      
      const results = await prisma.$transaction(updates)
      returnedTask = results[1]
    } else {
      const updatedData = { status }
      if (date !== undefined) updatedData.date = date
      if (machineId !== undefined) updatedData.machineId = machineId ? parseInt(machineId) : null
      else if (shouldClearAssignment) updatedData.machineId = null

      if (operatorId !== undefined) updatedData.operatorId = operatorId || null
      else if (shouldClearAssignment) updatedData.operatorId = null

      // Update the task status
      updates.push(prisma.productionTask.update({
        where: { id: task.id },
        data: updatedData,
        include: {
          orderItem: { include: { order: { select: { id: true, code: true, customer: true, salesRep: true, employee: true } }, product: true, notes: { orderBy: { createdAt: 'asc' } } } },
          product: true,
          machine: true,
          operator: true,
          deliveryRecords: { orderBy: { createdAt: 'desc' } },
          logisticsLogs: { orderBy: { createdAt: 'desc' } }
        }
      }))

      if (task.orderItemId) {
        const willBeFinished = isFinishedProduction(status)
        const wasFinished = isFinishedProduction(task.status)

        if (willBeFinished && !wasFinished) {
          updates.push(prisma.orderItem.update({
            where: { id: task.orderItemId },
            data: {
              inProductionQuantity: { decrement: task.quantity },
              producedQuantity: { increment: task.quantity }
            }
          }))
        } else if (!willBeFinished && wasFinished) {
          updates.push(prisma.orderItem.update({
            where: { id: task.orderItemId },
            data: {
              inProductionQuantity: { increment: task.quantity },
              producedQuantity: { decrement: task.quantity }
            }
          }))
        }
      }

      const results = await prisma.$transaction(updates)
      returnedTask = results[0]

      // Log logistics stage change
      if (status && status !== task.status) {
        const isRollback = (
          (task.status === 'Delivered' && (status === 'In Delivery' || status === 'completed')) ||
          (task.status === 'In Delivery' && status === 'completed') ||
          (task.status === 'Invoiced' && (status === 'In Delivery' || status === 'completed'))
        )
        let desc = ''
        if (status === 'Delivered') {
          desc = task.isInvoiced
            ? "Aşama 'Teslim Edildi (Faturalı)' olarak güncellendi."
            : "Aşama 'Teslim Edildi (Faturasız)' olarak güncellendi."
        } else if (isRollback) {
          desc = `Aşama geri alındı: '${task.status}' -> '${status}'`
        } else {
          desc = `Aşama güncellendi: '${task.status}' -> '${status}'`
        }

        try {
          await prisma.logisticsLog.create({
            data: {
              productionTaskId: task.id,
              action: isRollback ? 'ROLLBACK' : 'STATUS_CHANGE',
              fromStatus: task.status,
              toStatus: status,
              isInvoiced: task.isInvoiced,
              description: desc,
              userId: req.user?.id || null,
              userName: req.user?.name || req.user?.email || 'Kullanıcı'
            }
          })
        } catch (logErr) {
          console.error('Failed to create logistics log in move:', logErr)
        }
      }
    }

    if (task.orderItemId) {
      // Check if the whole orderItem is completed
      const updatedItem = await prisma.orderItem.findUnique({ where: { id: task.orderItemId } })
      if (updatedItem.producedQuantity >= updatedItem.quantity) {
        if (updatedItem.status === 'Pending' || updatedItem.status === 'In-Production') {
          await prisma.orderItem.update({ where: { id: updatedItem.id }, data: { status: 'Production Completed' } })
        }
      } else if (updatedItem.inProductionQuantity > 0 || updatedItem.producedQuantity > 0) {
        await prisma.orderItem.update({ where: { id: updatedItem.id }, data: { status: 'In-Production' } })
      }

      // Check if the entire order is completed
      const allItems = await prisma.orderItem.findMany({ where: { orderId: task.orderItem.orderId } })
      const allCompleted = allItems.every(i => i.producedQuantity >= i.quantity)
      const order = await prisma.order.findUnique({ where: { id: task.orderItem.orderId } })
      
      if (allCompleted && (order.status === 'Draft' || order.status === 'Processing' || order.status === 'Confirmed' || order.status === 'In-Production')) {
        await prisma.order.update({ where: { id: task.orderItem.orderId }, data: { status: 'Production Completed' } })
      } else if (!allCompleted && order.status === 'Production Completed') {
        await prisma.order.update({ where: { id: task.orderItem.orderId }, data: { status: 'In-Production' } })
      }
    }

    res.json(returnedTask)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update production task details (e.g. quantity, operator, machine)
router.put('/:id', async (req, res) => {
  try {
    const { machineId, operatorId, quantity, status, date } = req.body
    const task = await prisma.productionTask.findUnique({ where: { id: req.params.id } })
    if (!task) return res.status(404).json({ error: 'Task not found' })

    if (task.orderItemId && status && status !== task.status) {
      const willBeFinished = isFinishedProduction(status)
      const wasFinished = isFinishedProduction(task.status)
      if (willBeFinished && !wasFinished) {
        await prisma.orderItem.update({
          where: { id: task.orderItemId },
          data: {
            inProductionQuantity: { decrement: task.quantity },
            producedQuantity: { increment: task.quantity }
          }
        })
      } else if (!willBeFinished && wasFinished) {
        await prisma.orderItem.update({
          where: { id: task.orderItemId },
          data: {
            inProductionQuantity: { increment: task.quantity },
            producedQuantity: { decrement: task.quantity }
          }
        })
      }
    }

    const updatedTask = await prisma.productionTask.update({
      where: { id: req.params.id },
      data: {
        ...(machineId !== undefined && { machineId: machineId ? parseInt(machineId) : null }),
        ...(operatorId !== undefined && { operatorId: operatorId || null }),
        ...(quantity && { quantity: parseFloat(String(quantity).replace(",", ".")) }),
        ...(status && { status }),
        ...(date !== undefined && { date }),
      },
      include: {
        orderItem: { include: { order: { select: { id: true, code: true, customer: true, salesRep: true, employee: true } }, product: true, notes: { orderBy: { createdAt: 'asc' } } } },
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
      if (task.orderItemId) {
        if (isFinishedProduction(task.status)) {
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
          orderItem: { include: { order: { select: { code: true, customer: true, salesRep: true, employee: true } }, product: true, notes: { orderBy: { createdAt: 'asc' } } } },
          product: true,
          machine: true,
          operator: true,
        }
      })
      if (task.orderItemId) {
        await prisma.productionLog.create({
          data: {
            orderItemId: task.orderItemId,
            productionTaskId: taskId,
            action: 'Rollover',
            details: `Rolled over from ${task.date} to ${targetDate}. Status changed from ${task.status} to ${targetStatus || task.status}. Quantity: ${task.quantity}.`
          }
        })
      }
      res.json({ action: 'rollover', task: updated })
    } else if (action === 'split') {
      const compQty = parseFloat(String(completedQuantity).replace(",", "."))
      if (compQty <= 0 || compQty >= task.quantity) return res.status(400).json({ error: 'Invalid split quantity' })
      
      const remainQty = task.quantity - compQty
      
      const updates = []
      
      if (task.orderItemId) {
        updates.push(prisma.productionLog.create({
          data: {
            orderItemId: task.orderItemId,
            productionTaskId: taskId,
            action: 'Split Rollover',
            details: `Split from ${task.date} to ${targetDate}. ${compQty} completed, ${remainQty} moved to ${targetStatus || task.status}.`
          }
        }))
      }
      
      updates.push(prisma.productionTask.update({
        where: { id: taskId },
        data: { quantity: compQty, status: 'completed' }
      }))
      
      if (task.orderItemId) {
        updates.push(prisma.orderItem.update({
          where: { id: task.orderItemId },
          data: {
            inProductionQuantity: { decrement: compQty },
            producedQuantity: { increment: compQty }
          }
        }))
      }
      
      updates.push(prisma.productionTask.create({
        data: {
          code: `PT-${String(Date.now()).slice(-5)}`,
          orderItemId: task.orderItemId,
          productId: task.productId,
          machineId: task.status === (targetStatus || task.status) ? task.machineId : null,
          operatorId: task.status === (targetStatus || task.status) ? task.operatorId : null,
          quantity: remainQty,
          status: targetStatus || task.status,
          date: targetDate
        },
        include: {
          orderItem: { include: { order: { select: { code: true, customer: true, salesRep: true, employee: true } }, product: true, notes: { orderBy: { createdAt: 'asc' } } } },
          product: true,
          machine: true,
          operator: true,
        }
      }))
      
      const results = await prisma.$transaction(updates)
      const newTask = results[results.length - 1]
      
      if (task.orderItemId) {
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
      
      res.json({ action: 'split', newTask })
    } else if (action === 'distribute') {
      const { completed, open, extrusion, cutting } = req.body.distributions
      const comp = parseInt(completed) || 0
      const opn = parseInt(open) || 0
      const ext = parseInt(extrusion) || 0
      const cut = parseInt(cutting) || 0
      
      const total = comp + opn + ext + cut
      if (total !== task.quantity) return res.status(400).json({ error: 'Distributions total must equal task quantity' })
      
      const updates = []
      
      if (task.orderItemId) {
        updates.push(prisma.productionLog.create({
          data: {
            orderItemId: task.orderItemId,
            productionTaskId: comp > 0 ? task.id : null,
            action: 'Distributed Rollover',
            details: `Distributed from ${task.date} to ${targetDate}. Original qty: ${task.quantity}. Completed: ${comp}, Open: ${opn}, Extrusion: ${ext}, Cutting: ${cut}`
          }
        }))
      }
      
      if (comp > 0) {
        updates.push(prisma.productionTask.update({
          where: { id: taskId },
          data: { quantity: comp, status: 'completed' }
        }))
        if (task.orderItemId) {
          updates.push(prisma.orderItem.update({
            where: { id: task.orderItemId },
            data: {
              inProductionQuantity: { decrement: comp },
              producedQuantity: { increment: comp }
            }
          }))
        }
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
            productId: task.productId,
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
            productId: task.productId,
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
            productId: task.productId,
            machineId: task.status === 'cutting' ? task.machineId : null,
            operatorId: task.status === 'cutting' ? task.operatorId : null,
            quantity: cut,
            status: 'cutting',
            date: targetDate
          }
        }))
      }
      
      await prisma.$transaction(updates)
      
      if (comp > 0 && task.orderItemId) {
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

// ── Create delivery record & transition to In Delivery ───────────────────────
router.post('/:id/deliveries', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params
    const {
      isOutsource,
      carrierEmployeeId,
      carrierName: reqCarrierName,
      vehicleId,
      vehicleInfo: reqVehicleInfo,
      notes,
      photoBase64,
      targetStatus
    } = req.body

    const task = await prisma.productionTask.findUnique({
      where: { id },
      include: { orderItem: true }
    })

    if (!task) {
      return res.status(404).json({ error: 'Görev bulunamadı' })
    }

    const outsource = Boolean(isOutsource === true || isOutsource === 'true')

    let carrierName = (reqCarrierName || '').trim()
    let carrierEmpId = carrierEmployeeId || null

    if (!outsource) {
      if (!carrierEmpId) {
        return res.status(400).json({ error: 'Sevkiyatı yapacak personel seçilmelidir.' })
      }
      if (!carrierName) {
        const emp = await prisma.employee.findUnique({ where: { id: carrierEmpId } })
        carrierName = emp ? emp.name : 'Şirket Personeli'
      }
    } else {
      if (!carrierName) {
        return res.status(400).json({ error: 'Outsource sevkiyat sorumlusu / firma adı girilmelidir.' })
      }
      carrierEmpId = null
    }

    let vehicleInfo = (reqVehicleInfo || '').trim()
    let vehId = vehicleId || null

    if (!outsource) {
      if (!vehId) {
        return res.status(400).json({ error: 'Sevkiyat aracı seçilmelidir.' })
      }
      if (!vehicleInfo) {
        const v = await prisma.vehicle.findUnique({ where: { id: vehId } })
        vehicleInfo = v ? `${v.name} (${v.brand} ${v.model})` : 'Şirket Aracı'
      }
    } else {
      if (!vehicleInfo) {
        return res.status(400).json({ error: 'Outsource araç / plaka bilgisi girilmelidir.' })
      }
      vehId = null
    }

    let photoUrl = null
    if (req.file) {
      photoUrl = `/uploads/deliveries/${req.file.filename}`
    } else if (photoBase64 && typeof photoBase64 === 'string') {
      const matches = photoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
      if (matches && matches.length === 3) {
        const ext = matches[1].includes('png') ? '.png' : matches[1].includes('webp') ? '.webp' : '.jpg'
        const fileName = `delivery-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
        const filePath = path.join(deliveriesDir, fileName)
        fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'))
        photoUrl = `/uploads/deliveries/${fileName}`
      }
    }

    if (!photoUrl) {
      return res.status(400).json({ error: 'Araca yükleme / sevkiyat fotoğrafı zorunludur. Lütfen fotoğraf ekleyiniz.' })
    }

    // Create the delivery record
    const deliveryRecord = await prisma.deliveryRecord.create({
      data: {
        productionTaskId: task.id,
        orderItemId: task.orderItemId || null,
        isOutsource: outsource,
        carrierEmployeeId: carrierEmpId,
        carrierName,
        vehicleId: vehId,
        vehicleInfo,
        photoUrl,
        notes: notes ? String(notes).trim() : '',
        createdById: req.user?.id || null,
        createdByName: req.user?.name || req.user?.email || 'Kullanıcı',
      }
    })

    // Advance task status to 'In Delivery'
    const nextStatus = targetStatus || 'In Delivery'
    const updatedTask = await prisma.productionTask.update({
      where: { id: task.id },
      data: { status: nextStatus },
      include: {
        orderItem: {
          include: {
            order: { select: { id: true, code: true, customer: true, salesRep: true, employee: true } },
            product: true,
            notes: { orderBy: { createdAt: 'asc' } }
          }
        },
        product: true,
        machine: true,
        operator: true,
        deliveryRecords: { orderBy: { createdAt: 'desc' } },
        logisticsLogs: { orderBy: { createdAt: 'desc' } }
      }
    })

    // Log delivery dispatch
    try {
      await prisma.logisticsLog.create({
        data: {
          productionTaskId: task.id,
          action: 'DELIVERY_DISPATCH',
          fromStatus: task.status,
          toStatus: nextStatus,
          isInvoiced: task.isInvoiced,
          description: `Sevkiyat çıkışı yapıldı. Taşıyıcı: ${carrierName}, Araç: ${vehicleInfo}${outsource ? ' (Outsource)' : ''}.`,
          userId: req.user?.id || null,
          userName: req.user?.name || req.user?.email || 'Kullanıcı'
        }
      })
    } catch (e) {
      console.error('Failed to log delivery dispatch:', e)
    }

    res.status(201).json({
      success: true,
      delivery: deliveryRecord,
      task: updatedTask
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Get delivery records for a task ──────────────────────────────────────────
router.get('/:id/deliveries', async (req, res) => {
  try {
    const deliveries = await prisma.deliveryRecord.findMany({
      where: { productionTaskId: req.params.id },
      orderBy: { createdAt: 'desc' }
    })
    res.json(deliveries)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Delete delivery record (Admin Only) ──────────────────────────────────────
router.delete('/:taskId/deliveries/:deliveryId', adminOnly, async (req, res) => {
  try {
    const { taskId, deliveryId } = req.params
    const delivery = await prisma.deliveryRecord.findUnique({
      where: { id: deliveryId }
    })
    if (!delivery) {
      return res.status(404).json({ error: 'Teslimat kaydı bulunamadı' })
    }

    if (delivery.photoUrl) {
      const filePath = path.join(__dirname, '..', '..', delivery.photoUrl.replace(/^\//, ''))
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath) } catch (e) { /* ignore */ }
      }
    }

    await prisma.deliveryRecord.delete({
      where: { id: deliveryId }
    })

    // Log delivery deletion
    try {
      await prisma.logisticsLog.create({
        data: {
          productionTaskId: taskId,
          action: 'DELIVERY_DELETE',
          description: 'Sevkiyat kaydı silindi (Yönetici işlemi).',
          userId: req.user?.id || null,
          userName: req.user?.name || req.user?.email || 'Yönetici'
        }
      })
    } catch (e) {
      console.error('Failed to log delivery deletion:', e)
    }

    res.json({ success: true, message: 'Teslimat kaydı silindi' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Toggle / Update Invoice Status ──────────────────────────────────────────
router.patch('/:id/invoice', async (req, res) => {
  try {
    const { isInvoiced, notes } = req.body
    const task = await prisma.productionTask.findUnique({
      where: { id: req.params.id }
    })
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const newInvoiced = Boolean(isInvoiced)
    const userName = req.user?.name || req.user?.email || 'Kullanıcı'

    const updatedTask = await prisma.productionTask.update({
      where: { id: task.id },
      data: {
        isInvoiced: newInvoiced,
        invoicedAt: newInvoiced ? new Date() : null,
        invoicedById: newInvoiced ? req.user?.id : null,
        invoicedByName: newInvoiced ? userName : null
      },
      include: {
        orderItem: {
          include: {
            order: { select: { id: true, code: true, customer: true, salesRep: true, employee: true } },
            product: true,
            notes: { orderBy: { createdAt: 'asc' } }
          }
        },
        product: true,
        machine: true,
        operator: true,
        deliveryRecords: { orderBy: { createdAt: 'desc' } },
        logisticsLogs: { orderBy: { createdAt: 'desc' } }
      }
    })

    // Create log for invoice change
    try {
      await prisma.logisticsLog.create({
        data: {
          productionTaskId: task.id,
          action: 'INVOICE_TOGGLE',
          fromStatus: task.status,
          toStatus: task.status,
          isInvoiced: newInvoiced,
          description: newInvoiced
            ? `Fatura kesildi olarak işaretlendi.${notes ? ' Not: ' + String(notes).trim() : ''}`
            : `Fatura kesildi işareti geri alındı (Faturasız yapıldı).${notes ? ' Not: ' + String(notes).trim() : ''}`,
          userId: req.user?.id || null,
          userName
        }
      })
    } catch (e) {
      console.error('Failed to log invoice toggle:', e)
    }

    // Refetch task with updated logs
    const taskWithLogs = await prisma.productionTask.findUnique({
      where: { id: task.id },
      include: {
        orderItem: {
          include: {
            order: { select: { id: true, code: true, customer: true, salesRep: true, employee: true } },
            product: true,
            notes: { orderBy: { createdAt: 'asc' } }
          }
        },
        product: true,
        machine: true,
        operator: true,
        deliveryRecords: { orderBy: { createdAt: 'desc' } },
        logisticsLogs: { orderBy: { createdAt: 'desc' } }
      }
    })

    res.json(taskWithLogs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Get Logistics Logs for a task ───────────────────────────────────────────
router.get('/:id/logistics-logs', async (req, res) => {
  try {
    const logs = await prisma.logisticsLog.findMany({
      where: { productionTaskId: req.params.id },
      orderBy: { createdAt: 'desc' }
    })
    res.json(logs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

