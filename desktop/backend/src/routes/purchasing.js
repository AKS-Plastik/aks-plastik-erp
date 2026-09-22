const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const router = Router()

// ── Suppliers ────────────────────────────────────────────────────────────────

router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(suppliers)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/suppliers', async (req, res) => {
  try {
    const { name, category, contactName, contactPhone, contactEmail, address, country, currency, status, notes } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required' })
    const code = `SUP-${String(Date.now()).slice(-6)}`
    const supplier = await prisma.supplier.create({
      data: { code, name, category: category || 'General', contactName: contactName || '', contactPhone: contactPhone || '', contactEmail: contactEmail || '', address: address || '', country: country || '', currency: currency || 'USD', status: status || 'Active', notes: notes || '' },
    })
    res.status(201).json(supplier)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/suppliers/:id', async (req, res) => {
  try {
    const { name, category, contactName, contactPhone, contactEmail, address, country, currency, status, notes } = req.body
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: { name, category, contactName, contactPhone, contactEmail, address, country, currency, status, notes },
    })
    res.json(supplier)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/suppliers/:id', async (req, res) => {
  try {
    await prisma.supplier.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Purchase Requests (Workflow) ─────────────────────────────────────────────

router.get('/requests', async (req, res) => {
  try {
    const requests = await prisma.purchaseRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        quotations: { include: { supplier: { select: { id: true, name: true } } } },
        purchaseOrder: { select: { id: true, code: true, status: true, totalAmount: true } },
      },
    })
    res.json(requests)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/requests', async (req, res) => {
  try {
    const { title, description, department, requestedBy, createdBy, priority, category, estimatedAmount, currency, budgetCode, supplierId, supplierName, notes } = req.body
    if (!title) return res.status(400).json({ error: 'Title is required' })
    const code = `PR-${String(Date.now()).slice(-6)}`
    const request = await prisma.purchaseRequest.create({
      data: {
        code, title,
        description: description || '',
        department: department || '',
        requestedBy: requestedBy || '',
        createdBy: createdBy || '',
        supplierId: supplierId || '',
        supplierName: supplierName || '',
        priority: priority || 'Medium',
        category: category || 'General',
        estimatedAmount: parseFloat(estimatedAmount) || 0,
        currency: currency || 'TRY',
        budgetCode: budgetCode || '',
        status: 'Request',
        notes: notes || '',
      },
      include: { quotations: true, purchaseOrder: true },
    })
    res.status(201).json(request)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/requests/:id', async (req, res) => {
  try {
    const data = {}
    const fields = ['title', 'description', 'department', 'requestedBy', 'createdBy', 'supplierId', 'supplierName', 'priority', 'category', 'currency', 'budgetCode', 'notes',
      'budgetApproved', 'budgetNotes', 'approvedBy', 'approvedAt', 'rejectionReason',
      'receivedDate', 'receivedBy', 'qcResult', 'qcNotes', 'qcDate',
      'invoiceNo', 'invoiceDate', 'invoiceMatched', 'paymentDueDate', 'paymentStatus', 'paymentDate', 'status']
    fields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f] })
    if (req.body.estimatedAmount !== undefined) data.estimatedAmount = parseFloat(req.body.estimatedAmount) || 0
    if (req.body.invoiceAmount !== undefined) data.invoiceAmount = parseFloat(req.body.invoiceAmount) || 0

    const request = await prisma.purchaseRequest.update({
      where: { id: req.params.id },
      data,
      include: {
        quotations: { include: { supplier: { select: { id: true, name: true } } } },
        purchaseOrder: { select: { id: true, code: true, status: true, totalAmount: true } },
      },
    })
    res.json(request)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/requests/:id', async (req, res) => {
  try {
    await prisma.purchaseRequest.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Quotations ───────────────────────────────────────────────────────────────

router.post('/requests/:id/quotations', async (req, res) => {
  try {
    const { supplierId, supplierName, quotationNo, quotationDate, amount, currency, vat, deliveryDays, paymentTerms, warranty, notes } = req.body
    const quotation = await prisma.purchaseQuotation.create({
      data: {
        requestId: req.params.id,
        supplierId: supplierId || null,
        supplierName: supplierName || '',
        quotationNo: quotationNo || '',
        quotationDate: quotationDate || '',
        amount: parseFloat(amount) || 0,
        currency: currency || 'TRY',
        vat: parseFloat(vat) || 0,
        deliveryDays: parseInt(deliveryDays) || 0,
        paymentTerms: paymentTerms || '',
        warranty: warranty || '',
        notes: notes || '',
      },
      include: { supplier: { select: { id: true, name: true } } },
    })
    res.status(201).json(quotation)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/quotations/:id', async (req, res) => {
  try {
    const { supplierId, supplierName, quotationNo, quotationDate, amount, currency, vat, deliveryDays, paymentTerms, warranty, notes } = req.body
    const quotation = await prisma.purchaseQuotation.update({
      where: { id: req.params.id },
      data: {
        supplierId: supplierId || null,
        supplierName: supplierName || '',
        quotationNo: quotationNo || '',
        quotationDate: quotationDate || '',
        amount: parseFloat(amount) || 0,
        currency: currency || 'TRY',
        vat: parseFloat(vat) || 0,
        deliveryDays: parseInt(deliveryDays) || 0,
        paymentTerms: paymentTerms || '',
        warranty: warranty || '',
        notes: notes || '',
      },
      include: { supplier: { select: { id: true, name: true } } },
    })
    res.json(quotation)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/quotations/:id/select', async (req, res) => {
  try {
    const quot = await prisma.purchaseQuotation.findUnique({ where: { id: req.params.id } })
    if (!quot) return res.status(404).json({ error: 'Quotation not found' })
    // Deselect all others in this request, select this one
    await prisma.purchaseQuotation.updateMany({ where: { requestId: quot.requestId }, data: { selected: false } })
    await prisma.purchaseQuotation.update({ where: { id: req.params.id }, data: { selected: true } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/quotations/:id', async (req, res) => {
  try {
    await prisma.purchaseQuotation.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Purchase Orders ──────────────────────────────────────────────────────────

router.get('/orders', async (req, res) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        items: true,
        request: { select: { id: true, code: true, title: true } },
      },
    })
    res.json(orders)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/orders', async (req, res) => {
  try {
    const { supplierId, requestId, status, currency, vat, notes, expectedDate, receivedDate, items } = req.body
    const code = `PO-${String(Date.now()).slice(-6)}`
    const subtotal = (items || []).reduce(
      (sum, i) => sum + (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 1), 0
    )
    const vatRate = parseFloat(vat) || 0
    const totalAmount = subtotal * (1 + vatRate / 100)

    const order = await prisma.purchaseOrder.create({
      data: {
        code,
        status: status || 'Draft',
        currency: currency || 'USD',
        vat: vatRate, totalAmount,
        notes: notes || '',
        expectedDate: expectedDate || '',
        receivedDate: receivedDate || '',
        ...(supplierId ? { supplier: { connect: { id: supplierId } } } : {}),
        ...(requestId ? { request: { connect: { id: requestId } } } : {}),
        items: {
          create: (items || []).map((i) => ({
            productName: i.productName,
            quantity: parseInt(i.quantity) || 1,
            unitPrice: parseFloat(i.unitPrice) || 0,
            currency: i.currency || currency || 'USD',
            receivedQty: parseInt(i.receivedQty) || 0,
            ...(i.productId ? { product: { connect: { id: i.productId } } } : {}),
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        items: true,
        request: { select: { id: true, code: true, title: true } },
      },
    })

    // If linked to a request, advance status
    if (requestId) {
      await prisma.purchaseRequest.update({ where: { id: requestId }, data: { status: 'PO Created' } })
    }

    res.status(201).json(order)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/orders/:id', async (req, res) => {
  try {
    const { supplierId, status, currency, vat, notes, expectedDate, receivedDate, items } = req.body
    const subtotal = (items || []).reduce(
      (sum, i) => sum + (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 1), 0
    )
    const vatRate = parseFloat(vat) || 0
    const totalAmount = subtotal * (1 + vatRate / 100)

    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: req.params.id } })

    const order = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: {
        status: status || 'Draft',
        currency: currency || 'USD',
        vat: vatRate, totalAmount,
        notes: notes || '',
        expectedDate: expectedDate || '',
        receivedDate: receivedDate || '',
        supplier: supplierId ? { connect: { id: supplierId } } : { disconnect: true },
        items: {
          create: (items || []).map((i) => ({
            productName: i.productName,
            quantity: parseInt(i.quantity) || 1,
            unitPrice: parseFloat(i.unitPrice) || 0,
            currency: i.currency || currency || 'USD',
            receivedQty: parseInt(i.receivedQty) || 0,
            ...(i.productId ? { product: { connect: { id: i.productId } } } : {}),
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        items: true,
        request: { select: { id: true, code: true, title: true } },
      },
    })
    res.json(order)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/orders/:id', async (req, res) => {
  try {
    await prisma.purchaseOrder.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
