const cron = require('node-cron')
const { createBackup, cleanupOldBackups, getBackupDir } = require('../lib/backupService')

let backupCronTask = null

/**
 * Initializes the automated backup cron job.
 * Runs 4 times a day by default (00:00, 06:00, 12:00, 18:00).
 * Cleans up backups older than 7 days.
 */
function initBackupCron() {
  const schedule = process.env.BACKUP_CRON_SCHEDULE || '0 0,6,12,18 * * *'
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10)
  const backupDir = getBackupDir()

  console.log(`[BACKUP CRON] Otomatik yedekleme zamanlayıcısı kuruluyor...`)
  console.log(`[BACKUP CRON] Plan: "${schedule}" (Günde 4 kez: 00:00, 06:00, 12:00, 18:00)`)
  console.log(`[BACKUP CRON] Saklama süresi: ${retentionDays} gün. Hedef dizin: ${backupDir}`)

  // Initial startup cleanup of expired backups
  try {
    const { deletedCount } = cleanupOldBackups(retentionDays)
    if (deletedCount > 0) {
      console.log(`[BACKUP CRON] Başlangıçta süresi dolmuş ${deletedCount} eski yedek temizlendi.`)
    }
  } catch (err) {
    console.error('[BACKUP CRON] Başlangıç temizleme hatası:', err.message)
  }

  // Schedule task
  if (backupCronTask) {
    backupCronTask.stop()
  }

  backupCronTask = cron.schedule(schedule, async () => {
    console.log(`[BACKUP CRON] Otomatik yedekleme işlemi başlatıldı (${new Date().toLocaleString('tr-TR')})...`)
    try {
      const result = await createBackup({ isAutomatic: true })
      console.log(`[BACKUP CRON] Otomatik yedek başarıyla oluşturuldu: ${result.fileName} (${result.sizeFormatted})`)

      // Clean up backups older than retention limit
      const { deletedCount, deletedFiles } = cleanupOldBackups(retentionDays)
      if (deletedCount > 0) {
        console.log(`[BACKUP CRON] Süresi dolan (${retentionDays} günden eski) ${deletedCount} yedek silindi:`, deletedFiles)
      }
    } catch (err) {
      console.error('[BACKUP CRON] Otomatik yedekleme hatası:', err)
    }
  })

  console.log('[BACKUP CRON] Zamanlayıcı başarıyla devreye alındı.')
}

module.exports = {
  initBackupCron,
}
