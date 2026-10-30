const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function initEmployeeTaskGhostTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EmployeeTaskGhost" (
        "id" TEXT PRIMARY KEY,
        "originalTaskId" TEXT,
        "title" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'open',
        "quantity" INTEGER NOT NULL DEFAULT 0,
        "employeeId" TEXT REFERENCES "Employee"("id") ON DELETE SET NULL,
        "machineId" INTEGER REFERENCES "Machine"("id") ON DELETE SET NULL,
        "orderId" TEXT REFERENCES "Order"("id") ON DELETE SET NULL,
        "productionTaskId" TEXT REFERENCES "ProductionTask"("id") ON DELETE SET NULL,
        "productId" TEXT REFERENCES "Product"("id") ON DELETE SET NULL,
        "targetDate" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "EmployeeTaskGhost_date_idx" ON "EmployeeTaskGhost"("date")')
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "EmployeeTaskGhost_employeeId_idx" ON "EmployeeTaskGhost"("employeeId")')
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "EmployeeTaskGhost_originalTaskId_idx" ON "EmployeeTaskGhost"("originalTaskId")')
    console.log('[EmployeeTaskGhostService] EmployeeTaskGhost table and schema ready')
  } catch (err) {
    console.error('[EmployeeTaskGhostService] Error initializing EmployeeTaskGhost table:', err)
  }
}

module.exports = {
  initEmployeeTaskGhostTable
}

