import crypto from 'crypto'

const KEYCLOAK_URL = 'http://172.18.0.1:8080'
const REALM = 'AKS'
const CLIENT_ID = 'aks-erp-app'
export const REDIRECT_URI = 'aks-erp-app://auth/callback'

const BASE = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect`

export const JWKS_URI = `${BASE}/certs`

export function buildAuthRequest() {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const state = crypto.randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  })

  return { verifier, state, authUrl: `${BASE}/auth?${params}` }
}

export async function exchangeCode(code, verifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier: verifier,
  })

  const res = await fetch(`${BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${text}`)
  }

  return res.json()
}

export async function revokeToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    token: refreshToken,
    token_type_hint: 'refresh_token',
  })

  await fetch(`${BASE}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }).catch(() => { })
}

export async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  })

  const res = await fetch(`${BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) throw new Error('Token refresh failed')
  return res.json()
}
