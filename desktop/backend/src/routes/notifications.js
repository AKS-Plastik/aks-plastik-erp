const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { dispatchNotification } = require('../lib/notificationDispatcher');

const router = Router();

// GET notifications for current user
router.get('/', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET unread count
router.get('/unread-count', async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });
    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark single notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      data: { isRead: true },
    });
    res.json({ ok: true, updated: notification.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all as read
router.put('/read-all', async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false,
      },
      data: { isRead: true },
    });
    res.json({ ok: true, updated: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST test notification (Admins only)
router.post('/test', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can trigger test notifications' });
  }
  try {
    const { title, body, page, type } = req.body;
    await dispatchNotification({
      title: title || 'AKS ERP Test Bildirimi',
      body: body || 'Yetkili yöneticiler için bildirim sistemi aktif!',
      page: page || 'orders',
      type: type || 'order',
      link: page ? `/${page}` : '/orders',
    });
    res.json({ ok: true, message: 'Test notification dispatched' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

