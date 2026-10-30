const cron = require('node-cron')
const { PrismaClient } = require('@prisma/client')
const { sendNotification } = require('../lib/onesignal')

const prisma = new PrismaClient()
let reminderTask = null

/**
 * Checks all active tasks and sends reminders for due / overdue tasks.
 */
async function checkTaskReminders() {
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    // Find incomplete tasks with a due date on or before today
    const pendingTasks = await prisma.report.findMany({
      where: {
        column: { notIn: ['completed', 'cancelled'] },
        dueDate: { lte: endOfDay },
        employeeId: { not: null },
      },
      include: {
        employee: true,
      },
    })

    if (!pendingTasks.length) {
      return
    }

    console.log(`[TASK CRON] ${pendingTasks.length} adet vadesi gelen/geçen görev kontrol ediliyor...`)

    for (const task of pendingTasks) {
      if (!task.employeeId) continue

      // Find user account for this employee
      const assignedUser = await prisma.user.findFirst({
        where: { employeeId: task.employeeId },
        select: { id: true, employeeId: true, email: true, name: true },
      })

      if (!assignedUser) continue

      // Check if a reminder notification was already sent to this user for this task today
      const alreadySentToday = await prisma.notification.findFirst({
        where: {
          userId: assignedUser.id,
          page: 'reports',
          title: { contains: task.title },
          createdAt: { gte: startOfDay },
        },
      })

      if (alreadySentToday) {
        continue
      }

      const isOverdue = new Date(task.dueDate) < startOfDay
      const title = isOverdue
        ? `Geciken Görev: ${task.title}`
        : `Görev Hatırlatması: ${task.title}`

      const body = isOverdue
        ? `"${task.title}" görevinizin teslim tarihi geçti. Lütfen durumunu kontrol edin ve tamamlayın.`
        : `"${task.title}" görevinizin teslim tarihi bugün! Lütfen durumunu kontrol edin.`

      // 1. Create in-app notification
      await prisma.notification.create({
        data: {
          userId: assignedUser.id,
          title,
          body,
          type: 'task',
          page: 'reports',
          link: '/reports',
          isRead: false,
        },
      })

      // 2. Push via OneSignal
      const externalIds = [assignedUser.id, assignedUser.employeeId, assignedUser.email].filter(Boolean)
      await sendNotification(title, body, externalIds, '/reports')

      console.log(`[TASK CRON] Hatırlatma bildirimi gönderildi -> ${assignedUser.name} (${title})`)
    }
  } catch (err) {
    console.error('[TASK CRON] Görev hatırlatıcı hatası:', err.message)
  }
}

/**
 * Initializes the automated task reminder cron job.
 * Default: Every morning at 09:00 ('0 9 * * *').
 */
function initTaskReminderCron() {
  const schedule = process.env.TASK_REMINDER_CRON_SCHEDULE || '0 9 * * *'

  console.log(`[TASK CRON] Görev hatırlatıcı zamanlayıcısı kuruluyor... Plan: "${schedule}"`)

  // Check reminders once at startup after a brief delay
  setTimeout(() => {
    checkTaskReminders().catch((err) => console.error('[TASK CRON] Başlangıç kontrol hatası:', err.message))
  }, 10000)

  if (reminderTask) {
    reminderTask.stop()
  }

  reminderTask = cron.schedule(schedule, () => {
    checkTaskReminders()
  })
}

module.exports = {
  initTaskReminderCron,
  checkTaskReminders,
}

