require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const cron = require('node-cron')
const { authenticate } = require('./middleware/auth')
const { pullProductsFromVio } = require('./lib/productVioSync')
const { pullCustomersFromVio } = require('./lib/customerVioSync')
const { pullOrdersFromVio } = require('./lib/orderVioSync')

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const authRoutes = require('./routes/auth')
const customerRoutes = require('./routes/customers')
const reportRoutes = require('./routes/reports')
const siteVisitRoutes = require('./routes/siteVisits')
const productRoutes = require('./routes/products')
const employeeRoutes = require('./routes/employees')
const orderRoutes = require('./routes/orders')
const financeRoutes = require('./routes/finance')
const roleRoutes = require('./routes/roles')
const permissionRoutes = require('./routes/permissions')
const machineRoutes = require('./routes/machines')
const statusPermissionRoutes = require('./routes/statusPermissions')
const attendanceRoutes = require('./routes/attendance')
const leaveRequestRoutes = require('./routes/leaveRequests')
const proxyRoutes = require('./routes/proxy')
const purchasingRoutes = require('./routes/purchasing')
const userStatusPermissionRoutes = require('./routes/userStatusPermissions')
const userPurchasingStatusPermissionRoutes = require('./routes/userPurchasingStatusPermissions')
const syncRoutes = require('./routes/sync')
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: function (origin, callback) {
    callback(null, true);
  },
  credentials: true,
}))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// Public routes
// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() })
})

// Routes
app.use('/api/auth', authRoutes)

// Protected routes
app.use('/api/customers', authenticate, customerRoutes)
app.use('/api/reports', authenticate, reportRoutes)
app.use('/api/site-visits', authenticate, siteVisitRoutes)
app.use('/api/products', authenticate, productRoutes)
app.use('/api/employees', authenticate, employeeRoutes)
app.use('/api/orders', authenticate, orderRoutes)
app.use('/api/finance', authenticate, financeRoutes)
app.use('/api/roles', authenticate, roleRoutes)
app.use('/api/permissions', authenticate, permissionRoutes)
app.use('/api/machines', authenticate, machineRoutes)
app.use('/api/status-permissions', authenticate, statusPermissionRoutes)
app.use('/api/attendance', authenticate, attendanceRoutes)
app.use('/api/leave-requests', authenticate, leaveRequestRoutes)
app.use('/api/proxy', authenticate, proxyRoutes)
app.use('/api/purchasing', authenticate, purchasingRoutes)
app.use('/api/user-status-permissions', authenticate, userStatusPermissionRoutes)
app.use('/api/user-purchasing-status-permissions', authenticate, userPurchasingStatusPermissionRoutes)
app.use('/api/sync', authenticate, syncRoutes)

app.listen(PORT, () => {
  console.log(`AKS ERP API running on http://localhost:${PORT}`)

  // 30 minute cron for Vio Sync using node-cron
  console.log('Starting 30-minute Vio sync cron job (*/30 * * * *)...')

  const runSync = async (isCron = false) => {
    console.log(`[CRON/STARTUP] Vio Senkronizasyonları başlatılıyor... (isCron: ${isCron})`)
    try {
      // 1. Önce ürünleri senkronize et (siparişler vs için foreign key)
      await pullProductsFromVio()

      // 2. Sonra müşterileri senkronize et
      await pullCustomersFromVio()

      // 3. Siparişleri senkronize et
      if (isCron) {
        await pullOrdersFromVio(1)
      } else {
        await pullOrdersFromVio()
      }

      console.log('[CRON/STARTUP] Vio Senkronizasyonları başarıyla tamamlandı.')
    } catch (err) {
      console.error('[CRON/STARTUP] Vio Sync Hatası:', err)
    }
  }

  // İlk açılışta hemen bir kez çalıştır
  runSync(false);

  // Sonrasında her 30 dakikada bir çalıştır
  cron.schedule('*/30 * * * *', () => runSync(true))
})
