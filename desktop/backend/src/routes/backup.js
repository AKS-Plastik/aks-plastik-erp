const express = require('express')
const path = require('path')
const fs = require('fs')
const { adminOnly } = require('../middleware/auth')
const {
  createBackup,
  listBackups,
  deleteBackup,
  getBackupDir,
} = require('../lib/backupService')

const router = express.Router()

// All backup operations are restricted strictly to admin users
router.use(adminOnly)

/**
 * GET /api/backup
 * Lists existing backups and active configuration
 */
router.get('/', async (req, res) => {
  try {
    const backups = listBackups()
    const backupDir = getBackupDir()
    const schedule = process.env.BACKUP_CRON_SCHEDULE || '0 0,6,12,18 * * *'
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10)

    res.json({
      backups,
      config: {
        backupDir,
        schedule,
        retentionDays,
        scheduleDescription: 'Günde 4 kez (00:00, 06:00, 12:00, 18:00)',
      },
    })
  } catch (err) {
    console.error('[BACKUP ROUTE] List error:', err)
    res.status(500).json({ error: 'Yedekler listelenirken hata oluştu: ' + err.message })
  }
})

/**
 * POST /api/backup
 * Triggers a manual one-click backup
 */
router.post('/', async (req, res) => {
  try {
    console.log(`[BACKUP ROUTE] Manuel yedek başlatıldı. İsteyen kullanıcı: ${req.user.name} (${req.user.email})`)
    const result = await createBackup({ isAutomatic: false })
    res.json({
      success: true,
      message: 'Yedekleme başarıyla tamamlandı.',
      backup: result,
    })
  } catch (err) {
    console.error('[BACKUP ROUTE] Create error:', err)
    res.status(500).json({ error: 'Yedekleme oluşturulamadı: ' + err.message })
  }
})

/**
 * GET /api/backup/download/:fileName
 * Downloads a specific backup archive
 */
router.get('/download/:fileName', (req, res) => {
  try {
    const rawFileName = req.params.fileName
    const safeFileName = path.basename(rawFileName)
    const backupDir = getBackupDir()
    const filePath = path.join(backupDir, safeFileName)

    if (!fs.existsSync(filePath) || !safeFileName.endsWith('.zip')) {
      return res.status(404).json({ error: 'İstenen yedek dosyası bulunamadı.' })
    }

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`)

    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
  } catch (err) {
    console.error('[BACKUP ROUTE] Download error:', err)
    res.status(500).json({ error: 'Yedek indirilemedi: ' + err.message })
  }
})

/**
 * DELETE /api/backup/:fileName
 * Deletes a specific backup archive
 */
router.delete('/:fileName', (req, res) => {
  try {
    const rawFileName = req.params.fileName
    const result = deleteBackup(rawFileName)
    res.json({
      success: true,
      message: `${result.fileName} başarıyla silindi.`,
    })
  } catch (err) {
    console.error('[BACKUP ROUTE] Delete error:', err)
    res.status(400).json({ error: err.message })
  }
})

module.exports = router
