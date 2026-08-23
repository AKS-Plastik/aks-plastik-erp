const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const { authenticate, adminOnly } = require('../middleware/auth')
const kc = require('../lib/keycloakAdmin')

const prisma = new PrismaClient()
const router = Router()

// GET current user — called by AuthContext after Keycloak login
router.get('/me', authenticate, (req, res) => {
  res.json(req.user)
})

// GET sales team users
router.get('/salesteam', authenticate, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { department: { contains: 'sales', mode: 'insensitive' } },
      select: { id: true, name: true, department: true },
      orderBy: { name: 'asc' },
    })
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET all users (admin only)
router.get('/users', authenticate, adminOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, phone: true, role: true, department: true, employeeId: true, createdAt: true },
    })
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST create user — also creates the user in Keycloak
router.post('/users', authenticate, adminOnly, async (req, res) => {
  try {
    const { email, password, name, phone, role, department, employeeId } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email already exists' })

    if (employeeId) {
      const taken = await prisma.user.findUnique({ where: { employeeId } })
      if (taken) return res.status(400).json({ error: 'This employee already has a user account' })
    }

    // Create in Keycloak first — fail early if Keycloak rejects it
    await kc.createUser(email, name, password)

    const placeholderHash = await bcrypt.hash(Math.random().toString(36), 10)
    const user = await prisma.user.create({
      data: {
        email,
        password: placeholderHash,
        name,
        phone: phone || null,
        role: role || 'user',
        department: role === 'user' ? (department || null) : null,
        employeeId: employeeId || null,
      },
      select: { id: true, email: true, name: true, phone: true, role: true, department: true, employeeId: true, createdAt: true },
    })

    res.status(201).json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT update user — also syncs email/name to Keycloak
router.put('/users/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, email, phone, role, department } = req.body

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'User not found' })

    // Sync to Keycloak if email or name changed
    if (email !== existing.email || name !== existing.name) {
      await kc.updateUser(existing.email, { email, name })
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        name,
        email,
        phone: phone || null,
        role,
        department: role === 'user' ? (department || null) : null,
      },
      select: { id: true, email: true, name: true, phone: true, role: true, department: true, employeeId: true, createdAt: true },
    })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE user — also deletes from Keycloak
router.delete('/users/:id', authenticate, adminOnly, async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    await kc.deleteUser(user.email)
    await prisma.user.delete({ where: { id: req.params.id } })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH change password — authenticated user changes their own password
router.patch('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' })
    }

    const valid = await kc.verifyPassword(req.user.email, currentPassword)
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })

    await kc.changePassword(req.user.email, newPassword)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST send password reset email via Keycloak
router.post('/users/:id/reset-password', authenticate, adminOnly, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    await kc.sendPasswordResetEmail(user.email)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Web Login Endpoints ---
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080'
const REALM = process.env.KEYCLOAK_REALM || 'AKS'
const CLIENT_ID = 'aks-erp-app'

router.post('/web-login', async (req, res) => {
  const { email, password } = req.body
  try {
    const kcRes = await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: CLIENT_ID,
        username: email,
        password,
      }).toString()
    })
    if (!kcRes.ok) {
      return res.status(401).json({ error: 'Giriş başarısız. Bilgilerinizi kontrol edin.' })
    }
    const data = await kcRes.json()
    res.json({ ok: true, tokens: data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/web-refresh', async (req, res) => {
  const { refresh_token } = req.body
  try {
    const kcRes = await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token,
      }).toString()
    })
    if (!kcRes.ok) {
      return res.status(401).json({ error: 'Token refresh failed' })
    }
    const data = await kcRes.json()
    res.json({ ok: true, tokens: data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/web-logout', async (req, res) => {
  const { refresh_token } = req.body
  try {
    await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        token: refresh_token,
        token_type_hint: 'refresh_token',
      }).toString()
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
