const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const router = Router()

// Helper to parse dates
const getDateRange = (filter, reqStartDate, reqEndDate) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  let startDate = reqStartDate
  let endDate = reqEndDate
  
  if (filter === 'today') {
    startDate = today.toISOString().split('T')[0]
    endDate = startDate
  } else if (filter === 'week') {
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1)
    startDate = startOfWeek.toISOString().split('T')[0]
  } else if (filter === 'month') {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    startDate = startOfMonth.toISOString().split('T')[0]
  } else if (filter === 'year') {
    const startOfYear = new Date(today.getFullYear(), 0, 1)
    startDate = startOfYear.toISOString().split('T')[0]
  }

  return { startDate, endDate }
}

// GET /api/analytics/production
router.get('/production', async (req, res) => {
  try {
    const { filter, startDate: reqStart, endDate: reqEnd } = req.query
    const { startDate, endDate } = getDateRange(filter, reqStart, reqEnd)
    const where = {}
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate }
    } else if (startDate) {
      where.date = { gte: startDate }
    } else if (endDate) {
      where.date = { lte: endDate }
    }

    const completedTasks = await prisma.productionTask.findMany({
      where,
      include: {
        orderItem: { include: { product: true } },
        product: true,
        machine: true,
        operator: true
      },
      orderBy: { date: 'asc' }
    })

    const byStatus = {
      open: { tasks: 0, quantities: {} },
      extrusion: { tasks: 0, quantities: {} },
      cutting: { tasks: 0, quantities: {} },
      completed: { tasks: 0, quantities: {} }
    }
    const byOperator = {}
    const byProduct = {}
    const byDate = {}

    for (const t of completedTasks) {
      const productName = t.orderItem?.productName || t.product?.name || 'Bilinmiyor'
      const unit = t.orderItem?.product?.unit || t.product?.unit || 'Adet'
      
      const date = t.date
      if (!byDate[date]) byDate[date] = { date, totalQuantity: 0, totalCompletedTasks: 0 }
      byDate[date].totalQuantity += t.quantity // this remains simple for trend line
      byDate[date].totalCompletedTasks += 1
      
      // Determine effective status category
      let statusKey = 'completed'
      if (t.status === 'extrusion') statusKey = 'extrusion'
      if (t.status === 'cutting') statusKey = 'cutting'
      if (t.status === 'open') statusKey = 'open'

      // Overall Status
      byStatus[statusKey].tasks += 1
      if (!byStatus[statusKey].quantities[unit]) {
        byStatus[statusKey].quantities[unit] = 0
      }
      byStatus[statusKey].quantities[unit] += t.quantity

      // Product details
      if (!byProduct[productName]) {
        byProduct[productName] = { unit, open: 0, extrusion: 0, cutting: 0, completed: 0 }
      }
      byProduct[productName][statusKey] += t.quantity

      // Operator Details
      if (t.operatorId) {
        const opName = t.operator?.name || 'Bilinmiyor'
        if (!byOperator[opName]) {
          byOperator[opName] = {
            tasksCompleted: 0,
            tasksExtrusion: 0,
            tasksCutting: 0,
            tasksOpen: 0,
            productDetails: {}
          }
        }
        
        if (statusKey === 'completed') byOperator[opName].tasksCompleted += 1
        else if (statusKey === 'extrusion') byOperator[opName].tasksExtrusion += 1
        else if (statusKey === 'cutting') byOperator[opName].tasksCutting += 1
        else if (statusKey === 'open') byOperator[opName].tasksOpen += 1

        if (!byOperator[opName].productDetails[productName]) {
          byOperator[opName].productDetails[productName] = { unit, open: 0, extrusion: 0, cutting: 0, completed: 0 }
        }
        byOperator[opName].productDetails[productName][statusKey] += t.quantity
      }
    }
    
    const trend = Object.values(byDate)

    res.json({
      totalTasks: completedTasks.length,
      trend,
      metrics: {
        byStatus,
        byOperator,
        byProduct
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/analytics/production/status
router.get('/production/status', async (req, res) => {
  try {
    const { date } = req.query
    if (!date) return res.status(400).json({ error: 'Date is required' })

    const snapshot = await prisma.dailyProductionSnapshot.findUnique({
      where: { date }
    })

    res.json({ isLocked: snapshot?.isLocked || false })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/analytics/production/close
router.post('/production/close', async (req, res) => {
  try {
    const { date } = req.body
    if (!date) return res.status(400).json({ error: 'Date is required' })

    const { takeDailyProductionSnapshot } = require('../jobs/snapshot')
    await takeDailyProductionSnapshot(date)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/analytics/production/unlock
router.post('/production/unlock', async (req, res) => {
  try {
    const { date } = req.body
    if (!date) return res.status(400).json({ error: 'Date is required' })

    await prisma.dailyProductionSnapshot.update({
      where: { date },
      data: { isLocked: false }
    })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/analytics/sales
router.get('/sales', async (req, res) => {
  try {
    const { filter, startDate: reqStart, endDate: reqEnd } = req.query
    const { startDate, endDate } = getDateRange(filter, reqStart, reqEnd)
    
    const where = { status: { not: 'Draft' } } // Include all non-draft orders as sales
    
    if (startDate && endDate) {
      where.createdAt = { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59.999Z') }
    } else if (startDate) {
      where.createdAt = { gte: new Date(startDate) }
    } else if (endDate) {
      where.createdAt = { lte: new Date(endDate + 'T23:59:59.999Z') }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        employee: true,
        salesRep: true,
        items: true
      },
      orderBy: { createdAt: 'asc' }
    })

    let totalRevenue = 0
    const bySalesRep = {}
    const byProduct = {}

    for (const order of orders) {
      totalRevenue += order.totalAmount || 0
      
      const repName = order.salesRep?.name || order.employee?.name || 'Bilinmiyor'
      if (!bySalesRep[repName]) bySalesRep[repName] = { totalOrders: 0, totalRevenue: 0 }
      bySalesRep[repName].totalOrders++
      bySalesRep[repName].totalRevenue += order.totalAmount || 0
      
      for (const item of order.items) {
        const prodName = item.productName || 'Bilinmiyor'
        if (!byProduct[prodName]) byProduct[prodName] = { totalQuantity: 0, totalRevenue: 0 }
        byProduct[prodName].totalQuantity += item.quantity || 0
        byProduct[prodName].totalRevenue += item.totalPrice || (item.unitPrice * item.quantity) || 0
      }
    }

    res.json({
      totalOrders: orders.length,
      totalRevenue,
      orders, // required for chart on frontend
      metrics: {
        bySalesRep,
        byProduct
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/analytics/site-visits
router.get('/site-visits', async (req, res) => {
  try {
    const { filter, startDate: reqStart, endDate: reqEnd } = req.query
    const { startDate, endDate } = getDateRange(filter, reqStart, reqEnd)
    
    const where = {}
    
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate }
    } else if (startDate) {
      where.date = { gte: startDate }
    } else if (endDate) {
      where.date = { lte: endDate }
    }

    const visits = await prisma.siteVisit.findMany({
      where,
      include: {
        employee: true,
        assignees: true,
        customer: true
      },
      orderBy: { date: 'asc' }
    })

    const byStatus = {}
    const byEmployee = {}

    for (const v of visits) {
      const status = v.status || 'Bilinmiyor'
      if (!byStatus[status]) byStatus[status] = 0
      byStatus[status]++

      const emps = v.assignees && v.assignees.length > 0 ? v.assignees : (v.employee ? [v.employee] : [{name: 'Atanmamış'}])
      
      for (const emp of emps) {
        const empName = emp.name || 'Bilinmiyor'
        if (!byEmployee[empName]) {
          byEmployee[empName] = { total: 0, statuses: {} }
        }
        byEmployee[empName].total++
        if (!byEmployee[empName].statuses[status]) byEmployee[empName].statuses[status] = 0
        byEmployee[empName].statuses[status]++
      }
    }

    res.json({
      totalVisits: visits.length,
      metrics: {
        byStatus,
        byEmployee
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
