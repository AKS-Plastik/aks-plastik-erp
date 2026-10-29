function isSalesManager(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const dept = String(user.department || '').toLowerCase();
  return dept.includes('sales manager') || dept.includes('satış müdür') || dept.includes('satis mudur');
}

const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')
const { pushOrderToVio } = require('../lib/orderVioSync')
const { dispatchNotification } = require('../lib/notificationDispatcher')
const { pullProductsFromVio } = require('../lib/productVioSync')

const prisma = new PrismaClient()
const router = Router()


async function canAddOrderNote(user) {
  if (isSalesManager(user)) return true
  if (user.employeeId) {
    const emp = await prisma.employee.findUnique({ where: { id: user.employeeId } })
    if (emp?.isManager) return true
    const empPerms = await prisma.employeePermission.findMany({ where: { employeeId: user.employeeId } })
    const pages = empPerms.map((p) => p.page)
    if (pages.includes('-orders-note-create')) return false
    if (
      pages.includes('orders-note-create') ||
      pages.includes('production') ||
      pages.includes('production-tasks') ||
      pages.includes('production-planning') ||
      pages.includes('production-planning-edit')
    ) return true
  }
  if (user.department) {
    const rolePerm = await prisma.rolePermission.findFirst({
      where: {
        role: user.department,
        page: {
          in: [
            'orders-note-create',
            'production',
            'production-tasks',
            'production-planning',
            'production-planning-edit',
          ],
        },
      },
    })
    if (rolePerm) return true
  }
  return false
}

async function canDeleteOrderNote(user) {
  if (isSalesManager(user)) return true
  if (user.employeeId) {
    const emp = await prisma.employee.findUnique({ where: { id: user.employeeId } })
    if (emp?.isManager) return true
    const empPerms = await prisma.employeePermission.findMany({ where: { employeeId: user.employeeId } })
    const pages = empPerms.map((p) => p.page)
    if (pages.includes('-orders-note-delete')) return false
    if (
      pages.includes('orders-note-delete') ||
      pages.includes('production') ||
      pages.includes('production-tasks') ||
      pages.includes('production-planning') ||
      pages.includes('production-planning-edit')
    ) return true
  }
  if (user.department) {
    const rolePerm = await prisma.rolePermission.findFirst({
      where: {
        role: user.department,
        page: {
          in: [
            'orders-note-delete',
            'production',
            'production-tasks',
            'production-planning',
            'production-planning-edit',
          ],
        },
      },
    })
    if (rolePerm) return true
  }
  return false
}

router.get('/', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, code: true, accountCode: true } },
        employee: { select: { id: true, name: true } },
        salesRep: { select: { id: true, name: true } },
        items: { 
          include: { 
            product: { select: { stockNo: true, currency: true, unit: true } },
            productionTasks: { include: { machine: true, operator: true } },
            notes: { orderBy: { createdAt: 'asc' } }
          } 
        },
      },
    })
    // Patch in raw fields the stale client doesn't select automatically
    const raw = await prisma.$queryRaw`SELECT id, "shipmentType", "paymentMethod" FROM "Order"`
    const rawMap = {}
    raw.forEach(r => { rawMap[r.id] = r })
    orders.forEach(o => {
      if (rawMap[o.id]) {
        o.shipmentType = rawMap[o.id].shipmentType || ''
        o.paymentMethod = rawMap[o.id].paymentMethod || ''
      }
    })
    res.json(orders)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { 
        customer: true, 
        employee: true, 
        salesRep: { select: { id: true, name: true } },
        items: { 
          include: { 
            product: true,
            productionTasks: { include: { machine: true, operator: true } },
            notes: { orderBy: { createdAt: 'asc' } }
          } 
        } 
      },
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    res.json(order)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { customerId, employeeId, salesRepId, status, notes, items, shipmentType, paymentMethod, visitId } = req.body
    const code = `WEB-TEMP-${String(Date.now()).slice(-5)}` // Geçici kod artık WEB-TEMP- ile başlıyor

    const totalAmount = (items || []).reduce((sum, item) => {
      const qty = parseFloat(String(item.quantity).replace(",", ".")) || 1
      const price = parseFloat(item.unitPrice) || 0
      const vatRate = parseFloat(item.vat) || 0
      return sum + qty * price * (1 + vatRate / 100)
    }, 0)

    const order = await prisma.order.create({
      data: {
        code,
        ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
        ...(employeeId ? { employee: { connect: { id: employeeId } } } : {}),
        ...(salesRepId ? { salesRep: { connect: { id: salesRepId } } } : {}),
        status: status || 'Processing',
        vat: 0,
        totalAmount,
        notes: notes || '',
        items: {
          create: (items || []).map((item) => ({
            productName: item.productName,
            quantity: parseFloat(String(item.quantity).replace(",", ".")) || 1,
            unitPrice: parseFloat(item.unitPrice) || 0,
            currency: item.currency || 'USD',
            vat: parseFloat(item.vat) || 0,
            ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
            ...(item.notes && item.notes.length ? {
              notes: {
                create: item.notes.filter(n => (typeof n === 'string' ? n.trim() : n.note?.trim())).map((n) => ({
                  note: typeof n === 'string' ? n.trim() : n.note.trim(),
                  authorId: req.user?.id || null,
                  authorName: req.user?.name || 'Kullanıcı',
                })),
              },
            } : {}),
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true, code: true, accountCode: true } },
        employee: { select: { id: true, name: true } },
        salesRep: { select: { id: true, name: true } },
        items: { 
          include: { 
            product: { select: { stockNo: true, currency: true, unit: true } },
            productionTasks: { include: { machine: true, operator: true } },
            notes: { orderBy: { createdAt: 'asc' } }
          } 
        },
      },
    })
    // Set new fields via raw SQL until Prisma client is regenerated
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET "shipmentType" = $1, "paymentMethod" = $2, "visitId" = $3 WHERE id = $4`,
      shipmentType || '', paymentMethod || '', visitId || null, order.id
    )
    order.shipmentType = shipmentType || ''
    order.paymentMethod = paymentMethod || ''

    if (customerId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { isCustomer: true }
      }).catch(err => console.error('Failed to update customer isCustomer flag:', err))
    }
    if (visitId) {
      try {
                await prisma.$executeRawUnsafe(
          `INSERT INTO "SiteVisitNote" (id, "visitId", "customerId", "fromStatus", "toStatus", note, "createdById", "createdAt") 
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
           'cuid_' + Date.now() + Math.random().toString(36).substring(2,6), visitId, customerId || null, 'Auto', 'Sipariş', `Sipariş oluşturuldu: #${order.code}`, req.user.id
        )
      } catch (err) {
        console.error('Failed to create site visit auto note:', err)
      }
    }


    // Sipariş oluşur oluşmaz Vio'ya yolla ve stok tutarlılığı için ürünleri tekrar çek
    pushOrderToVio(order.id).then(success => {
      if (success) {
        console.log('[ERP] Sipariş Vio\'ya iletildi. Stok tutarlılığı için ürünler senkronize ediliyor...')
        pullProductsFromVio().catch(err => console.error('Failed to sync products after order push:', err))
      }
    }).catch(err => console.error('Failed to sync new order to Vio:', err))

    dispatchNotification({
      title: `Yeni Sipariş: #${order.code}`,
      body: `${order.customer?.name || 'Müşteri'} için ${order.items?.length || 0} kalem sipariş oluşturuldu.`,
      type: 'order',
      page: 'orders',
      link: `/orders?orderId=${order.id}`,
      excludeUserId: req.user?.id,
    }).catch((err) => console.error('Failed to dispatch order notification:', err))

    res.status(201).json(order)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { customerId, employeeId, salesRepId, status, notes, items, shipmentType, paymentMethod, visitId } = req.body

    const current = await prisma.order.findUnique({ where: { id: req.params.id }, select: { status: true } })

    const isAdmin = req.user.role === 'admin'
    if (current?.status === 'Delivered' && status && status !== 'Delivered' && !isAdmin) {
      return res.status(403).json({ error: 'Delivered durumundaki siparişi sadece yöneticiler geriye çekebilir.' })
    }

    // Sales Managers can only set status to 'Confirmed'
    if (isSalesManager(req.user) && status) {
      if (status !== 'Confirmed' && status !== current?.status) {
        return res.status(403).json({ error: 'Sales Managers can only change status to Confirmed' })
      }
    }

    if (status === 'Production Completed' && current?.status !== 'Production Completed') {
      const orderItems = await prisma.orderItem.findMany({ where: { orderId: req.params.id } })
      const incomplete = orderItems.some(item => item.producedQuantity < item.quantity)
      if (incomplete) {
        return res.status(400).json({ error: 'Cannot mark order as Production Completed. Not all items are fully produced.' })
      }
    }

    const totalAmount = (items || []).reduce((sum, item) => {
      const qty = parseFloat(String(item.quantity).replace(",", ".")) || 1
      const price = parseFloat(item.unitPrice) || 0
      const vatRate = parseFloat(item.vat) || 0
      return sum + qty * price * (1 + vatRate / 100)
    }, 0)

    const itemsWithId = (items || []).filter(i => i.id)
    const itemsWithoutId = (items || []).filter(i => !i.id)

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        customer: customerId ? { connect: { id: customerId } } : { disconnect: true },
        employee: employeeId ? { connect: { id: employeeId } } : { disconnect: true },
        salesRep: salesRepId ? { connect: { id: salesRepId } } : { disconnect: true },
        status: status || 'Processing',
        vat: 0,
        totalAmount,
        notes: notes || '',
        items: {
          deleteMany: {
            id: { notIn: itemsWithId.map(i => i.id) }
          },
          update: itemsWithId.map((item) => ({
            where: { id: item.id },
            data: {
              productName: item.productName,
              quantity: parseFloat(String(item.quantity).replace(",", ".")) || 1,
              unitPrice: parseFloat(item.unitPrice) || 0,
              currency: item.currency || 'USD',
              vat: parseFloat(item.vat) || 0,
              productId: item.productId || null,
            }
          })),
          create: itemsWithoutId.map((item) => ({
            productName: item.productName,
            quantity: parseFloat(String(item.quantity).replace(",", ".")) || 1,
            unitPrice: parseFloat(item.unitPrice) || 0,
            currency: item.currency || 'USD',
            vat: parseFloat(item.vat) || 0,
            ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
            ...(item.notes && item.notes.length ? {
              notes: {
                create: item.notes.filter(n => (typeof n === 'string' ? n.trim() : n.note?.trim())).map((n) => ({
                  note: typeof n === 'string' ? n.trim() : n.note.trim(),
                  authorId: req.user?.id || null,
                  authorName: req.user?.name || 'Kullanıcı',
                })),
              },
            } : {}),
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true, code: true, accountCode: true } },
        employee: { select: { id: true, name: true } },
        salesRep: { select: { id: true, name: true } },
        items: { 
          include: { 
            product: { select: { stockNo: true, currency: true, unit: true } },
            productionTasks: { include: { machine: true, operator: true } },
            notes: { orderBy: { createdAt: 'asc' } }
          } 
        },
      },
    })
    // Insert new notes for existing items if any
    for (const item of itemsWithId) {
      if (item.notes && item.notes.length) {
        const newNotes = item.notes.filter(n => (!n.id || String(n.id).startsWith('temp_')) && (typeof n === 'string' ? n.trim() : n.note?.trim()))
        if (newNotes.length) {
          await prisma.orderItemNote.createMany({
            data: newNotes.map(n => ({
              orderItemId: item.id,
              note: typeof n === 'string' ? n.trim() : n.note.trim(),
              authorId: req.user?.id || null,
              authorName: req.user?.name || 'Kullanıcı',
            }))
          })
        }
      }
    }

    // Set new fields via raw SQL until Prisma client is regenerated
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET "shipmentType" = $1, "paymentMethod" = $2, "visitId" = $3 WHERE id = $4`,
      shipmentType || '', paymentMethod || '', visitId || null, order.id
    )
    order.shipmentType = shipmentType || ''
    order.paymentMethod = paymentMethod || ''

    // Vio'ya artık sadece sipariş ilk oluştuğunda (POST) gönderiyoruz. 
    // PUT işleminde tekrar gönderirsek Vio'da mükerrer (çift) kayıt oluşur.
    
    // Refresh order to ensure created notes are present in response
    const freshOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        customer: { select: { id: true, name: true, code: true, accountCode: true } },
        employee: { select: { id: true, name: true } },
        salesRep: { select: { id: true, name: true } },
        items: { 
          include: { 
            product: { select: { stockNo: true, currency: true, unit: true } },
            productionTasks: { include: { machine: true, operator: true } },
            notes: { orderBy: { createdAt: 'asc' } }
          } 
        },
      },
    })

    if (status && current && status !== current.status) {
      dispatchNotification({
        title: `Sipariş Durumu: #${order.code}`,
        body: `Sipariş durumu "${current.status}" -> "${status}" olarak güncellendi.`,
        type: 'order',
        page: 'orders',
        link: `/orders?orderId=${order.id}`,
        excludeUserId: req.user?.id,
      }).catch((err) => console.error('Failed to dispatch order status notification:', err))
    }

    res.json(freshOrder || order)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/orders/items/:itemId/notes - add note to order item
router.post('/items/:itemId/notes', async (req, res) => {
  try {
    const allowed = await canAddOrderNote(req.user)
    if (!allowed) {
      return res.status(403).json({ error: 'Kalem notu ekleme yetkiniz bulunmamaktadır.' })
    }
    const { note } = req.body
    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Not içeriği boş olamaz.' })
    }
    const createdNote = await prisma.orderItemNote.create({
      data: {
        orderItemId: req.params.itemId,
        note: note.trim(),
        authorId: req.user.id || null,
        authorName: req.user.name || 'Kullanıcı',
      },
    })
    res.status(201).json(createdNote)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/orders/items/notes/:noteId - delete order item note
router.delete('/items/notes/:noteId', async (req, res) => {
  try {
    const allowed = await canDeleteOrderNote(req.user)
    if (!allowed) {
      return res.status(403).json({ error: 'Kalem notu silme yetkiniz bulunmamaktadır.' })
    }
    await prisma.orderItemNote.delete({
      where: { id: req.params.noteId },
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res, next) => {
  const allowed = req.user.role === 'admin' || isSalesManager(req.user)
  if (!allowed) return res.status(403).json({ error: 'Access required' })
  next()
}, async (req, res) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
