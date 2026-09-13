const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')
const { syncProductToVio, deleteProductFromVio, fetchSingleVioProduct, mapVioStokToErpData } = require('../lib/productVioSync')

const prisma = new PrismaClient()
const router = Router()

router.get('/', async (req, res) => {
  try {
    const rawProducts = await prisma.product.findMany()
    
    const regex = /^[A-Za-z0-9]{2}-[A-Za-z0-9]{2}-[A-Za-z0-9]{4}$/
    let products = rawProducts.filter(p => p.stockNo && regex.test(p.stockNo.trim()))
    
    products.sort((a, b) => {
      const aVal = a.stockNo.replace(/-/g, '').trim()
      const bVal = b.stockNo.replace(/-/g, '').trim()
      return aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
    })

    res.json(products)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, stockNo, description, category, unit, currency, price, stock, minStock } = req.body
    const code = `PRD-${String(Date.now()).slice(-5)}`
    const product = await prisma.product.create({
      data: {
        code,
        stockNo: stockNo || '',
        name,
        description: description || '',
        category: category || '',
        unit: unit || 'pcs',
        currency: currency || 'USD',
        price: parseFloat(price) || 0,
        stock: parseFloat(stock) || 0,
        minStock: parseFloat(minStock) || 0,
      },
    })
    
    // Sync the new product to Vio
    await syncProductToVio(product)
    
    res.status(201).json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { name, stockNo, description, category, unit, currency, price, stock, minStock, isActive } = req.body
    
    // Değişen alanları bulmak için eski kaydı çek
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Product not found' })

    let dataToSave = {
      stockNo: existing.stockNo, // Kullanıcı arayüzde değiştiremez, mevcut olanı al
      name,
      description: description || '',
      category: category || '',
      unit: unit || 'pcs',
      currency: currency || 'USD',
      price: parseFloat(price) || 0,
      stock: parseInt(stock) || 0,
      minStock: parseInt(minStock) || 0,
      ...(isActive !== undefined && { isActive })
    }

    // 1. Kullanıcının arayüzde gerçekten hangi alanları değiştirdiğini tespit et (Merge işleminden ÖNCE)
    const userChangedFields = []
    if (existing.name !== dataToSave.name) userChangedFields.push('name')
    if (existing.description !== dataToSave.description) userChangedFields.push('description')
    if (existing.category !== dataToSave.category) userChangedFields.push('category')
    if (existing.unit !== dataToSave.unit) userChangedFields.push('unit')
    if (existing.currency !== dataToSave.currency) userChangedFields.push('currency')
    if (existing.price !== dataToSave.price) userChangedFields.push('price')
    if (existing.isActive !== dataToSave.isActive && isActive !== undefined) userChangedFields.push('isActive')

    // 2. Vio'dan güncel durumu çek ve harmanla (merge)
    const vioProductRaw = await fetchSingleVioProduct(existing.stockNo)
    if (vioProductRaw) {
      const vioProduct = mapVioStokToErpData(vioProductRaw)
      const fieldsToMerge = ['name', 'description', 'category', 'unit', 'currency', 'price', 'isActive']
      
      for (const key of fieldsToMerge) {
        if (vioProduct[key] === undefined) continue

        // Eğer kullanıcı bu alanı arayüzde DEĞİŞTİRMEDİYSE, Vio'daki değeri doğru kabul et ve ERP'yi güncelle
        if (!userChangedFields.includes(key)) {
          dataToSave[key] = vioProduct[key]
        }
      }
    }

    // 3. Harmanlanmış (Vio'dan gelenler + Kullanıcının değiştirdikleri) veriyi DB'ye kaydet
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: dataToSave,
    })
    
    // 4. Vio'ya SADECE kullanıcının arayüzde değiştirdiği alanları yolla! (Partial Update)
    // Böylece Vio'nun içindeki diğer alanlar (muhkod, kdv vb.) ASLA ezilmez.
    await syncProductToVio(product, userChangedFields)
    
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (product) {
      // First delete from Vio (if possible)
      await deleteProductFromVio(product.code)
      // Then delete from ERP
      await prisma.product.delete({ where: { id: req.params.id } })
    }
    res.json({ success: true })
  } catch (err) {
    if (err.message && (err.message.includes('REFERENCE constraint') || err.message.includes('SqlException'))) {
      return res.status(400).json({ error: 'Bu ürün Vio üzerinde geçmiş siparişlerde kullanıldığı için silinemez. Lütfen silmek yerine Vio üzerinden ürünü "Pasif" duruma alınız.' })
    }
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
