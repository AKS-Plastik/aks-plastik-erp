const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080'
const REALM = process.env.KEYCLOAK_REALM || 'AKS'
const ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || 'admin'
const ADMIN_PASS = process.env.KEYCLOAK_ADMIN_PASS || 'admin'

const ADMIN_BASE = `${KEYCLOAK_URL}/admin/realms/${REALM}`

async function getAdminToken() {
  const res = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: ADMIN_USER,
      password: ADMIN_PASS,
    }).toString(),
  })
  if (!res.ok) throw new Error('Cannot connect to Keycloak admin — check KEYCLOAK_ADMIN_USER/PASS in .env')
  const data = await res.json()
  return data.access_token
}

async function findUserByEmail(email, token) {
  const res = await fetch(
    `${ADMIN_BASE}/users?email=${encodeURIComponent(email)}&exact=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.ok) {
    const users = await res.json()
    if (users && users[0]) return users[0]
  }

  const userRes = await fetch(
    `${ADMIN_BASE}/users?username=${encodeURIComponent(email)}&exact=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (userRes.ok) {
    const users = await userRes.json()
    if (users && users[0]) return users[0]
  }

  return null
}

async function createUser(email, name, password) {
  const token = await getAdminToken()
  const [firstName, ...rest] = (name || email || '').trim().split(' ')
  const lastName = rest.join(' ')

  const body = {
    username: email,
    email,
    firstName,
    lastName: lastName || '',
    enabled: true,
    emailVerified: true,
    credentials: password
      ? [{ type: 'password', value: password, temporary: false }]
      : [],
  }

  const res = await fetch(`${ADMIN_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })

  if (res.status === 409) throw new Error('A Keycloak account with this email already exists')
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Keycloak error: ${text}`)
  }
}

async function updateUser(oldEmail, { email, name }) {
  const token = await getAdminToken()
  const kcUser = await findUserByEmail(oldEmail, token)
  if (!kcUser) return

  const [firstName, ...rest] = (name || '').trim().split(' ')
  const lastName = rest.join(' ')

  await fetch(`${ADMIN_BASE}/users/${kcUser.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, username: email, firstName, lastName: lastName || '' }),
  })
}

async function deleteUser(email) {
  const token = await getAdminToken()
  const kcUser = await findUserByEmail(email, token)
  if (!kcUser) return

  await fetch(`${ADMIN_BASE}/users/${kcUser.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function sendPasswordResetEmail(email) {
  const token = await getAdminToken()
  const kcUser = await findUserByEmail(email, token)
  if (!kcUser) throw new Error('User not found in Keycloak')

  const res = await fetch(`${ADMIN_BASE}/users/${kcUser.id}/execute-actions-email`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(['UPDATE_PASSWORD']),
  })
  if (!res.ok) throw new Error('Failed to send password reset email')
}

// Verifies current password via Keycloak direct grant (requires Direct Access Grants enabled on aks-erp client)
async function verifyPassword(email, password) {
  const res = await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'aks-erp',
      username: email,
      password,
    }).toString(),
  })
  if (res.ok) return true
  const body = await res.json().catch(() => ({}))
  // If Direct Access Grants is disabled on the client, Keycloak returns unauthorized_client.
  // Throw so the caller can surface a useful error instead of "wrong password".
  if (body.error === 'unauthorized_client') {
    throw new Error('Direct Access Grants is not enabled on the aks-erp Keycloak client')
  }
  return false
}

async function changePassword(email, newPassword, name) {
  const token = await getAdminToken()
  let kcUser = await findUserByEmail(email, token)
  if (!kcUser) {
    await createUser(email, name || email, newPassword)
    return
  }

  const res = await fetch(`${ADMIN_BASE}/users/${kcUser.id}/reset-password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type: 'password', value: newPassword, temporary: false }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to update password: ${text}`)
  }
}

module.exports = { createUser, updateUser, deleteUser, sendPasswordResetEmail, verifyPassword, changePassword }
