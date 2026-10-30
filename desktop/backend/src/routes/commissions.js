const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { syncExistingOrders } = require('../lib/commissionService');

// Helper to check if user is sales or admin
function isSalesUser(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const depts = [
    user.department,
    user.employee?.department,
    user.employee?.position,
  ].filter(Boolean).map(s => String(s).toLowerCase());

  return depts.some(d =>
    d.includes('satış') ||
    d.includes('satis') ||
    d.includes('sale') ||
    d.includes('pazarlama')
  );
}

function requireSalesOrAdmin(req, res, next) {
  if (!isSalesUser(req.user)) {
    return res.status(403).json({ error: 'Bu bölüme sadece yöneticiler ve satış personelleri erişebilir.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlemi sadece yöneticiler gerçekleştirebilir.' });
  }
  next();
}

router.use(requireSalesOrAdmin);

/**
 * GET /api/commissions/rates/list
 * Get sales personnel with their defined commissionRate
 */
router.get('/rates/list', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const users = await prisma.$queryRawUnsafe(`
        SELECT u."id", u."name", u."email", u."role", u."department",
               COALESCE(u."commissionRate", 3.0) as "commissionRate",
               e."position"
        FROM "User" u
        LEFT JOIN "Employee" e ON u."employeeId" = e."id"
        WHERE u."id" = $1
      `, req.user.id);
      return res.json(users);
    }

    const users = await prisma.$queryRawUnsafe(`
      SELECT u."id", u."name", u."email", u."role", u."department",
             COALESCE(u."commissionRate", 3.0) as "commissionRate",
             e."position"
      FROM "User" u
      LEFT JOIN "Employee" e ON u."employeeId" = e."id"
      ORDER BY u."name" ASC
    `);

    const isSales = (str) => {
      if (!str) return false;
      const s = String(str).toLowerCase();
      return s.includes('sale') || s.includes('satış') || s.includes('satis') || s.includes('pazarlama') || s.includes('yönetici') || s.includes('admin');
    };

    const salesUsers = users.filter(u => isSales(u.department) || u.role === 'admin' || isSales(u.position));

    res.json(salesUsers.length > 0 ? salesUsers : users);
  } catch (err) {
    console.error('[Commissions] Error fetching user rates:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/commissions/rates/:userId
 * Update commission rate for a specific sales user
 */
router.put('/rates/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { commissionRate } = req.body;

    const rate = parseFloat(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ error: 'Geçersiz prim oranı. (0 ile 100 arasında olmalıdır)' });
    }

    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "commissionRate" = $1,
          "updatedAt" = NOW()
      WHERE "id" = $2
    `, rate, userId);

    res.json({ success: true, userId, commissionRate: rate });
  } catch (err) {
    console.error('[Commissions] Error updating user rate:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/commissions
 * Retrieve commissions with comprehensive filtering, order status integration, and summary statistics.
 * Automatically backfills any missing commission cards before querying.
 */
router.get('/', async (req, res) => {
  try {
    // Automatically ensure active orders with a sales rep have commission cards
    await syncExistingOrders().catch(err => console.error('[Commissions] Auto-sync error:', err));

    const {
      userId,
      status, // 'pending' | 'paid' | 'closed' | 'all'
      dateBasis = 'created', // 'created' | 'paid'
      year,
      month,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    let conditions = ['1=1'];
    let params = [];
    let pIdx = 1;

    // Filter by sales rep (Sales personnel can ONLY see their own commissions!)
    if (req.user.role !== 'admin') {
      conditions.push(`"userId" = ${pIdx++}`);
      params.push(req.user.id);
    } else if (userId && userId !== 'all') {
      conditions.push(`"userId" = ${pIdx++}`);
      params.push(userId);
    }

    // Filter by status
    if (status && status !== 'all') {
      conditions.push(`"status" = $${pIdx++}`);
      params.push(status);
    }

    // Search query
    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER("orderCode") LIKE $${pIdx} OR 
        LOWER("customerName") LIKE $${pIdx} OR 
        LOWER("userName") LIKE $${pIdx}
      )`);
      params.push(q);
      pIdx++;
    }

    // Date filtering
    const dateField = dateBasis === 'paid' ? '"paidAt"' : '"orderCreatedAt"';

    if (dateBasis === 'paid' && status !== 'paid') {
      conditions.push(`"paidAt" IS NOT NULL`);
    }

    if (year && !dateFrom && !dateTo) {
      if (month && month !== 'all') {
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);
        const startOfMonth = new Date(Date.UTC(y, m - 1, 1));
        const endOfMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

        if (dateBasis === 'paid') {
          conditions.push(`"paidAt" >= $${pIdx++} AND "paidAt" <= $${pIdx++}`);
          params.push(startOfMonth, endOfMonth);
        } else {
          if (status === 'paid' || status === 'closed') {
            conditions.push(`"orderCreatedAt" >= $${pIdx++} AND "orderCreatedAt" <= $${pIdx++}`);
            params.push(startOfMonth, endOfMonth);
          } else {
            // For 'all' or 'pending': include orders created in this month,
            // OR pending commissions from previous months (carried over) so they can be viewed & paid
            conditions.push(`(
              ("orderCreatedAt" >= $${pIdx} AND "orderCreatedAt" <= $${pIdx + 1})
              OR
              ("status" = 'pending' AND "orderCreatedAt" < $${pIdx})
            )`);
            params.push(startOfMonth, endOfMonth);
            pIdx += 2;
          }
        }
      } else {
        conditions.push(`EXTRACT(YEAR FROM ${dateField}) = $${pIdx++}`);
        params.push(parseInt(year, 10));
      }
    }

    if (dateFrom) {
      conditions.push(`${dateField} >= $${pIdx++}`);
      params.push(new Date(dateFrom));
    }

    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(`${dateField} <= $${pIdx++}`);
      params.push(end);
    }

    const whereClause = conditions.join(' AND ');

    // Fetch matching commissions
    const commissions = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Commission"
      WHERE ${whereClause}
      ORDER BY "orderCreatedAt" DESC, "createdAt" DESC
    `, ...params);

    // Fetch matching orders with full item details to attach order status and enable modal inspection
    const orderIds = [...new Set(commissions.map(c => c.orderId))];
    let orderMap = {};
    if (orderIds.length > 0) {
      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        include: {
          customer: { select: { id: true, name: true, code: true } },
          salesRep: { select: { id: true, name: true } },
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              currency: true,
              vat: true,
            },
          },
        },
      });
      orders.forEach(o => { orderMap[o.id] = o; });
    }

    // Attach order information to each commission
    const enrichedCommissions = commissions.map(c => {
      const ord = orderMap[c.orderId];
      return {
        ...c,
        orderStatus: ord?.status || 'Processing',
        orderItemsCount: ord?.items?.length || 0,
        order: ord || null,
      };
    });

    // Compute overall summary stats for the active filter set
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const targetMonthStart = (year && month && month !== 'all')
      ? new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1))
      : new Date(Date.UTC(currentYear, currentMonth - 1, 1));

    let totalAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let carriedOverPendingAmount = 0; // Pending items from previous months
    let closedCount = 0;
    let closedAmount = 0;

    for (const c of enrichedCommissions) {
      const amt = Number(c.amount) || 0;
      if (c.status === 'closed') {
        closedCount++;
        closedAmount += amt;
        continue;
      }

      totalAmount += amt;
      if (c.status === 'paid' || c.isPaid) {
        paidAmount += amt;
      } else {
        pendingAmount += amt;
        const ordDate = new Date(c.orderCreatedAt || c.createdAt);
        if (ordDate < targetMonthStart) {
          carriedOverPendingAmount += amt;
        }
      }
    }

    res.json({
      commissions: enrichedCommissions,
      summary: {
        totalCount: enrichedCommissions.length,
        activeCount: enrichedCommissions.filter(c => c.status !== 'closed').length,
        totalAmount: Number(totalAmount.toFixed(2)),
        paidAmount: Number(paidAmount.toFixed(2)),
        pendingAmount: Number(pendingAmount.toFixed(2)),
        carriedOverPendingAmount: Number(carriedOverPendingAmount.toFixed(2)),
        closedCount,
        closedAmount: Number(closedAmount.toFixed(2)),
      },
    });
  } catch (err) {
    console.error('[Commissions] Error fetching commissions:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/commissions/:id/toggle-paid
 * Mark commission as paid or revert to pending
 */
router.put('/:id/toggle-paid', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isPaid, paidAt } = req.body;

    const existing = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Commission" WHERE "id" = $1 LIMIT 1
    `, id);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Prim kaydı bulunamadı.' });
    }

    const comm = existing[0];
    if (comm.status === 'closed') {
      return res.status(400).json({ error: 'Kapatılmış (pasif) bir prim kaydında ödeme işlemi yapılamaz.' });
    }

    const newStatus = isPaid ? 'paid' : 'pending';
    const finalPaidAt = isPaid ? (paidAt ? new Date(paidAt) : new Date()) : null;
    const paidById = isPaid ? req.user.id : null;
    const paidByName = isPaid ? req.user.name : null;

    await prisma.$executeRawUnsafe(`
      UPDATE "Commission"
      SET "status" = $1,
          "isPaid" = $2,
          "paidAt" = $3,
          "paidById" = $4,
          "paidByName" = $5,
          "updatedAt" = NOW()
      WHERE "id" = $6
    `, newStatus, isPaid, finalPaidAt, paidById, paidByName, id);

    const updated = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Commission" WHERE "id" = $1 LIMIT 1
    `, id);

    res.json({ success: true, commission: updated[0] });
  } catch (err) {
    console.error('[Commissions] Error toggling paid status:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/commissions/batch-pay
 * Mark multiple commissions as paid at once
 */
router.put('/batch/batch-pay', requireAdmin, async (req, res) => {
  try {
    const { ids, paidAt } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Geçerli prim kimlikleri gönderilmedi.' });
    }

    const finalPaidAt = paidAt ? new Date(paidAt) : new Date();

    for (const id of ids) {
      await prisma.$executeRawUnsafe(`
        UPDATE "Commission"
        SET "status" = 'paid',
            "isPaid" = true,
            "paidAt" = $1,
            "paidById" = $2,
            "paidByName" = $3,
            "updatedAt" = NOW()
        WHERE "id" = $4 AND "status" != 'closed'
      `, finalPaidAt, req.user.id, req.user.name, id);
    }

    res.json({ success: true, count: ids.length });
  } catch (err) {
    console.error('[Commissions] Error in batch-pay:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/commissions/:id
 * Edit commission details (rate, amount, notes)
 * Sets isManualOverride = true so that future changes to the order total
 * will not overwrite the custom price assigned by the admin.
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rate, amount, notes } = req.body;

    const existing = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Commission" WHERE "id" = $1 LIMIT 1
    `, id);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Prim kaydı bulunamadı.' });
    }

    const numRate = parseFloat(rate);
    const numAmount = parseFloat(amount);

    await prisma.$executeRawUnsafe(`
      UPDATE "Commission"
      SET "rate" = $1,
          "amount" = $2,
          "notes" = $3,
          "isManualOverride" = true,
          "updatedAt" = NOW()
      WHERE "id" = $4
    `,
      isNaN(numRate) ? existing[0].rate : numRate,
      isNaN(numAmount) ? existing[0].amount : numAmount,
      typeof notes === 'string' ? notes : existing[0].notes,
      id
    );

    const updated = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Commission" WHERE "id" = $1 LIMIT 1
    `, id);

    res.json({ success: true, commission: updated[0] });
  } catch (err) {
    console.error('[Commissions] Error updating commission:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/commissions/sync
 * Manually trigger sync of commissions from existing orders
 */
router.post('/sync', requireAdmin, async (req, res) => {
  try {
    await syncExistingOrders();
    res.json({ success: true, message: 'Prim kartları siparişlerle senkronize edildi.' });
  } catch (err) {
    console.error('[Commissions] Error syncing commissions:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
