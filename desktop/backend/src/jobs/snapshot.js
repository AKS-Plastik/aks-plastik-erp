const { PrismaClient } = require('@prisma/client')
const cron = require('node-cron')

const prisma = new PrismaClient()

/**
 * Calculates and stores the Daily Production Snapshot for a given date.
 */
async function takeDailyProductionSnapshot(targetDateStr) {
  try {
    // Check if snapshot already exists and is locked
    const existing = await prisma.dailyProductionSnapshot.findUnique({ where: { date: targetDateStr } })
    if (existing && existing.isLocked) {
      console.log(`[Snapshot] Snapshot for ${targetDateStr} already exists and is locked. Skipping.`)
      return
    }

    console.log(`[Snapshot] Taking production snapshot for ${targetDateStr}...`)

    const completedTasks = await prisma.productionTask.findMany({
      where: { date: targetDateStr },
      include: {
        orderItem: { include: { product: true } },
        product: true,
        machine: true,
        operator: true
      }
    })

    let totalQuantity = 0
    let totalCompletedTasks = completedTasks.length
    
    const byOperator = {}
    const byMachine = {}
    const byProduct = {}
    const byUnit = {}

    for (const t of completedTasks) {
      totalQuantity += t.quantity
      
      const productName = t.orderItem?.productName || t.product?.name || 'Bilinmiyor'
      const unit = t.orderItem?.product?.unit || t.product?.unit || 'Adet'
      const mType = t.machine?.type || 'General'

      // Product Metric
      if (!byProduct[productName]) byProduct[productName] = { quantity: 0, tasks: 0 }
      byProduct[productName].quantity += t.quantity
      byProduct[productName].tasks += 1

      // Unit Metric
      if (!byUnit[unit]) byUnit[unit] = 0
      byUnit[unit] += t.quantity

      // Machine Metric
      if (t.machineId) {
        const mName = t.machine.name
        if (!byMachine[mName]) byMachine[mName] = { type: mType, quantity: 0, tasks: 0 }
        byMachine[mName].quantity += t.quantity
        byMachine[mName].tasks += 1
      }

      // Operator Metric
      if (t.operatorId) {
        const opName = t.operator?.name || 'Bilinmiyor'
        if (!byOperator[opName]) byOperator[opName] = { extrusion: 0, cutting: 0, totalTasks: 0, productTypes: new Set() }
        
        byOperator[opName].totalTasks += 1
        byOperator[opName].productTypes.add(productName)

        if (mType.toLowerCase() === 'extrusion') byOperator[opName].extrusion += t.quantity
        else if (mType.toLowerCase() === 'cutting') byOperator[opName].cutting += t.quantity
        else byOperator[opName].cutting += t.quantity // Fallback
      }
    }

    // Convert Set to count for JSON serialization
    for (const opName in byOperator) {
      byOperator[opName].productTypesCount = byOperator[opName].productTypes.size
      byOperator[opName].productTypesList = Array.from(byOperator[opName].productTypes)
      delete byOperator[opName].productTypes
    }

    const metrics = {
      byOperator,
      byMachine,
      byProduct,
      byUnit
    }

    await prisma.dailyProductionSnapshot.upsert({
      where: { date: targetDateStr },
      update: {
        totalCompletedTasks,
        totalQuantity,
        metrics,
        isLocked: true
      },
      create: {
        date: targetDateStr,
        totalCompletedTasks,
        totalQuantity,
        metrics,
        isLocked: true
      }
    })

    console.log(`[Snapshot] Successfully saved snapshot for ${targetDateStr}. Total Quantity: ${totalQuantity}`)

  } catch (err) {
    console.error(`[Snapshot] Error taking snapshot for ${targetDateStr}:`, err)
  }
}

/**
 * Initializes the cron jobs and validates missing days.
 */
function initSnapshotJobs() {
  // 1. Cron Job: Runs every night at 23:59
  cron.schedule('59 23 * * *', async () => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    console.log(`[Cron] Triggering End of Day snapshot for ${todayStr}`)
    await takeDailyProductionSnapshot(todayStr)
  })

  // 2. Fallback Validation: Run on startup to check if yesterday's snapshot is missing
  validateFallbackSnapshot()
}

/**
 * Checks if yesterday's snapshot was taken. If not, it forces a snapshot creation.
 */
async function validateFallbackSnapshot() {
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const existing = await prisma.dailyProductionSnapshot.findUnique({ where: { date: yesterdayStr } })
    if (!existing || !existing.isLocked) {
      console.log(`[Snapshot Fallback] Missing snapshot for yesterday (${yesterdayStr}). Taking it now...`)
      await takeDailyProductionSnapshot(yesterdayStr)
    } else {
      console.log(`[Snapshot Fallback] Yesterday's snapshot (${yesterdayStr}) is already secured.`)
    }
  } catch (err) {
    console.error('[Snapshot Fallback] Error validating fallback:', err)
  }
}

module.exports = {
  initSnapshotJobs,
  takeDailyProductionSnapshot
}
