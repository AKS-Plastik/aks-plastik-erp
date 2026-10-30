const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function initProductionTaskGhostTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProductionTaskGhost" (
        "id" TEXT PRIMARY KEY,
        "originalTaskId" TEXT,
        "code" TEXT NOT NULL,
        "quantity" INTEGER NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'open',
        "date" TEXT NOT NULL,
        "orderItemId" TEXT REFERENCES "OrderItem"("id") ON DELETE SET NULL,
        "productId" TEXT REFERENCES "Product"("id") ON DELETE SET NULL,
        "machineId" INTEGER REFERENCES "Machine"("id") ON DELETE SET NULL,
        "operatorId" TEXT REFERENCES "Employee"("id") ON DELETE SET NULL,
        "targetDate" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProductionTaskGhost_date_idx" ON "ProductionTaskGhost"("date")')
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProductionTaskGhost_operatorId_idx" ON "ProductionTaskGhost"("operatorId")')
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProductionTaskGhost_originalTaskId_idx" ON "ProductionTaskGhost"("originalTaskId")')
    console.log('[ProductionTaskGhostService] ProductionTaskGhost table and schema ready')
  } catch (err) {
    console.error('[ProductionTaskGhostService] Error initializing ProductionTaskGhost table:', err)
  }
}

module.exports = {
  initProductionTaskGhostTable
}

