const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_COMMISSION_RATE = 3.0; // 3%

/**
 * Ensures Commission table, indexes, and custom rate columns exist in PostgreSQL.
 */
async function initCommissionTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Commission" (
        "id" TEXT PRIMARY KEY,
        "orderId" TEXT NOT NULL,
        "orderCode" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "userName" TEXT NOT NULL,
        "customerId" TEXT,
        "customerName" TEXT,
        "orderTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "orderCurrency" TEXT NOT NULL DEFAULT 'TRY',
        "rate" DOUBLE PRECISION NOT NULL DEFAULT 3,
        "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "currency" TEXT NOT NULL DEFAULT 'TRY',
        "status" TEXT NOT NULL DEFAULT 'pending',
        "isPaid" BOOLEAN NOT NULL DEFAULT false,
        "paidAt" TIMESTAMP(3),
        "paidById" TEXT,
        "paidByName" TEXT,
        "orderCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "notes" TEXT DEFAULT '',
        "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION DEFAULT 3.0');
    await prisma.$executeRawUnsafe('ALTER TABLE "Commission" ADD COLUMN IF NOT EXISTS "isManualOverride" BOOLEAN NOT NULL DEFAULT false');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Commission_orderId_idx" ON "Commission"("orderId")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Commission_userId_idx" ON "Commission"("userId")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Commission_status_idx" ON "Commission"("status")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Commission_createdAt_idx" ON "Commission"("createdAt")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Commission_orderCreatedAt_idx" ON "Commission"("orderCreatedAt")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Commission_paidAt_idx" ON "Commission"("paidAt")');
    console.log('[CommissionService] Commission table and schema ready');
  } catch (err) {
    console.error('[CommissionService] Error initializing Commission table:', err);
  }
}

/**
 * Generates cuid-like random id
 */
function generateId() {
  return 'comm_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Get user defined commission rate or default
 */
async function getUserCommissionRate(userId) {
  try {
    const res = await prisma.$queryRawUnsafe(`
      SELECT "commissionRate" FROM "User" WHERE "id" = $1 LIMIT 1
    `, userId);
    if (res.length > 0 && res[0].commissionRate !== null && res[0].commissionRate !== undefined) {
      const parsed = parseFloat(res[0].commissionRate);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch (err) {
    console.error('[CommissionService] Error fetching user rate:', err);
  }
  return DEFAULT_COMMISSION_RATE;
}

/**
 * Handle new order creation
 */
async function handleOrderCreated(order) {
  if (!order || !order.salesRepId) return null;

  try {
    // Get salesRep user name and rate
    const users = await prisma.$queryRawUnsafe(`
      SELECT "id", "name", "commissionRate" FROM "User" WHERE "id" = $1 LIMIT 1
    `, order.salesRepId);

    if (!users || users.length === 0) return null;
    const user = users[0];

    const userRate = (user.commissionRate !== null && user.commissionRate !== undefined && !isNaN(Number(user.commissionRate)))
      ? Number(user.commissionRate)
      : DEFAULT_COMMISSION_RATE;

    // Get customer name if any
    let customerName = '';
    if (order.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: order.customerId },
        select: { name: true },
      });
      customerName = customer?.name || '';
    }

    const orderTotal = Number(order.totalAmount) || 0;
    const rate = userRate;
    const amount = Number(((orderTotal * rate) / 100).toFixed(2));
    const currency = 'TRY';
    const id = generateId();
    const orderCreatedAt = order.createdAt ? new Date(order.createdAt) : new Date();

    await prisma.$executeRawUnsafe(`
      INSERT INTO "Commission" (
        "id", "orderId", "orderCode", "userId", "userName",
        "customerId", "customerName", "orderTotal", "orderCurrency",
        "rate", "amount", "currency", "status", "isPaid",
        "orderCreatedAt", "notes", "isManualOverride", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, false, NOW(), NOW()
      )
    `,
      id,
      order.id,
      order.code || '',
      user.id,
      user.name,
      order.customerId || null,
      customerName,
      orderTotal,
      currency,
      rate,
      amount,
      currency,
      'pending',
      false,
      orderCreatedAt,
      'Sipariş oluşturulurken otomatik tanımlandı'
    );

    console.log(`[CommissionService] Created commission ${id} for order ${order.code} (User: ${user.name}, Rate: %${rate})`);
  } catch (err) {
    console.error('[CommissionService] Error in handleOrderCreated:', err);
  }
}

/**
 * Handle order update (salesRep changed or order total updated)
 */
async function handleOrderUpdated(prevOrder, updatedOrder) {
  if (!updatedOrder) return;

  try {
    const prevRepId = prevOrder?.salesRepId || null;
    const newRepId = updatedOrder.salesRepId || null;
    const orderId = updatedOrder.id;

    // 1. Sales rep changed or removed
    if (prevRepId !== newRepId) {
      // Deactivate/close all existing active commissions for this order
      if (prevRepId) {
        await prisma.$executeRawUnsafe(`
          UPDATE "Commission"
          SET "status" = 'closed',
              "notes" = CONCAT(COALESCE("notes", ''), ' [Sipariş temsilcisi değiştirildi - Kart kapatıldı]'),
              "updatedAt" = NOW()
          WHERE "orderId" = $1 AND "status" != 'closed'
        `, orderId);
        console.log(`[CommissionService] Closed previous commissions for order ${orderId}`);
      }

      // If a new sales rep is assigned, create a new active commission card with the new rep's current rate
      if (newRepId) {
        await handleOrderCreated(updatedOrder);
      }
      return;
    }

    // 2. Sales rep is the same, but order total amount or customer changed
    if (newRepId) {
      const orderTotal = Number(updatedOrder.totalAmount) || 0;

      // Fetch pending commissions for this order
      const pendingComms = await prisma.$queryRawUnsafe(`
        SELECT "id", "rate", "isManualOverride", "amount" FROM "Commission"
        WHERE "orderId" = $1 AND "userId" = $2 AND "status" = 'pending'
      `, orderId, newRepId);

      for (const comm of pendingComms) {
        // If admin manually adjusted the price on this card, preserve that price ("artık o fiyat kalsın o kart özelinde")
        if (comm.isManualOverride) {
          await prisma.$executeRawUnsafe(`
            UPDATE "Commission"
            SET "orderTotal" = $1,
                "orderCode" = $2,
                "updatedAt" = NOW()
            WHERE "id" = $3
          `, orderTotal, updatedOrder.code || '', comm.id);
        } else {
          // Keep the existing rate of this card (past cards maintain their own rate)
          const rate = Number(comm.rate) || DEFAULT_COMMISSION_RATE;
          const newAmount = Number(((orderTotal * rate) / 100).toFixed(2));
          await prisma.$executeRawUnsafe(`
            UPDATE "Commission"
            SET "orderTotal" = $1,
                "amount" = $2,
                "orderCode" = $3,
                "updatedAt" = NOW()
            WHERE "id" = $4
          `, orderTotal, newAmount, updatedOrder.code || '', comm.id);
        }
      }
    }
  } catch (err) {
    console.error('[CommissionService] Error in handleOrderUpdated:', err);
  }
}

/**
 * Handle order deletion
 */
async function handleOrderDeleted(orderId) {
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "Commission"
      SET "status" = 'closed',
          "notes" = CONCAT(COALESCE("notes", ''), ' [Sipariş silindi - Kart kapatıldı]'),
          "updatedAt" = NOW()
      WHERE "orderId" = $1 AND "status" != 'closed'
    `, orderId);
  } catch (err) {
    console.error('[CommissionService] Error in handleOrderDeleted:', err);
  }
}

/**
 * Backfill commissions for existing orders that have a salesRep
 */
async function syncExistingOrders() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        salesRep: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
    });

    let createdCount = 0;
    for (const order of orders) {
      let salesUser = order.salesRep;

      // If no salesRep directly on order, check if employee has a user account
      if (!salesUser && order.employeeId) {
        const linkedUser = await prisma.user.findFirst({
          where: { employeeId: order.employeeId },
          select: { id: true, name: true }
        });
        if (linkedUser) {
          salesUser = linkedUser;
          await prisma.$executeRawUnsafe(`UPDATE "Order" SET "salesRepId" = $1 WHERE id = $2`, linkedUser.id, order.id).catch(() => {});
        }
      }

      if (!salesUser) continue;

      // Check if active commission exists
      const existing = await prisma.$queryRawUnsafe(`
        SELECT "id" FROM "Commission"
        WHERE "orderId" = $1 AND "userId" = $2 AND "status" != 'closed'
        LIMIT 1
      `, order.id, salesUser.id);

      if (existing.length === 0) {
        const userRate = await getUserCommissionRate(salesUser.id);
        const orderTotal = Number(order.totalAmount) || 0;
        const rate = userRate;
        const amount = Number(((orderTotal * rate) / 100).toFixed(2));
        const id = generateId();
        const orderCreatedAt = order.createdAt ? new Date(order.createdAt) : new Date();

        await prisma.$executeRawUnsafe(`
          INSERT INTO "Commission" (
            "id", "orderId", "orderCode", "userId", "userName",
            "customerId", "customerName", "orderTotal", "orderCurrency",
            "rate", "amount", "currency", "status", "isPaid",
            "orderCreatedAt", "notes", "isManualOverride", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13, $14,
            $15, $16, false, NOW(), NOW()
          )
        `,
          id,
          order.id,
          order.code || '',
          salesUser.id,
          salesUser.name,
          order.customerId || null,
          order.customer?.name || '',
          orderTotal,
          'TRY',
          rate,
          amount,
          'TRY',
          'pending',
          false,
          orderCreatedAt,
          'Mevcut siparişlerden otomatik aktarıldı'
        );
        createdCount++;
      }
    }
    if (createdCount > 0) {
      console.log(`[CommissionService] Backfilled ${createdCount} commissions for existing orders.`);
    }
  } catch (err) {
    console.error('[CommissionService] Error in syncExistingOrders:', err);
  }
}

module.exports = {
  initCommissionTable,
  getUserCommissionRate,
  handleOrderCreated,
  handleOrderUpdated,
  handleOrderDeleted,
  syncExistingOrders,
  DEFAULT_COMMISSION_RATE,
};
