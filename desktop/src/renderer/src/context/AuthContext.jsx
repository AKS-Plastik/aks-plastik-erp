import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { API_URL } from '../config'

const AuthContext = createContext(null)

function parseJWT(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

function isExpired(token) {
  const payload = parseJWT(token)
  if (!payload?.exp) return true
  return Date.now() >= payload.exp * 1000 - 30_000 // 30s buffer
}

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(false)
  const refreshTokenRef = useRef(!window.electron ? localStorage.getItem('aks_refresh_token') : null)

  // Web-only: Restore session on mount if we have a refresh token saved
  useEffect(() => {
    if (window.electron || !refreshTokenRef.current) return

    async function restoreWebSession() {
      setLoading(true)
      try {
        const rt = refreshTokenRef.current
        const res = await fetch(`${API_URL}/auth/web-refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt })
        })
        const result = await res.json()
        if (!result.ok) throw new Error('Session expired')

        const newRt = result.tokens.refresh_token
        const newAt = result.tokens.access_token

        refreshTokenRef.current = newRt
        localStorage.setItem('aks_refresh_token', newRt)

        const profileRes = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${newAt}` },
        })
        if (!profileRes.ok) throw new Error('Failed to fetch profile')
        
        setToken(newAt)
        setUser(await profileRes.json())
      } catch (err) {
        logout()
      } finally {
        setLoading(false)
      }
    }
    restoreWebSession()
  }, [])

  // Auto-refresh: when access token nears expiry, get a new one
  useEffect(() => {
    if (!token) return
    const payload = parseJWT(token)
    if (!payload?.exp) return

    const msUntilRefresh = payload.exp * 1000 - Date.now() - 60_000 // refresh 60s early
    if (msUntilRefresh <= 0) return

    const timer = setTimeout(async () => {
      if (!refreshTokenRef.current) return
      
      let result;
      if (window.electron) {
        result = await window.api.authRefresh(refreshTokenRef.current)
      } else {
        const res = await fetch(`${API_URL}/auth/web-refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshTokenRef.current })
        })
        result = await res.json()
      }

      if (result.ok) {
        refreshTokenRef.current = result.tokens.refresh_token
        setToken(result.tokens.access_token)
      } else {
        logout()
      }
    }, msUntilRefresh)

    return () => clearTimeout(timer)
  }, [token])

  async function login(email, password) {
    setLoading(true)
    try {
      let result;
      if (window.electron) {
        result = await window.api.authLogin()
      } else {
        if (!email || !password) throw new Error('Kullanıcı adı ve şifre zorunludur')
        const res = await fetch(`${API_URL}/auth/web-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        result = await res.json()
      }

      if (!result.ok) throw new Error(result.error || 'Login failed')

      const { access_token, refresh_token } = result.tokens
      refreshTokenRef.current = refresh_token
      if (!window.electron) {
        localStorage.setItem('aks_refresh_token', refresh_token)
      }

      // Fetch full user profile from our backend (includes role, department, etc.)
      const profileRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      if (!profileRes.ok) throw new Error('User not registered in system')
      const profile = await profileRes.json()

      setToken(access_token)
      setUser(profile)
    } catch (err) {
      throw err
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    const rt = refreshTokenRef.current
    refreshTokenRef.current = null
    setToken(null)
    setUser(null)
    if (!window.electron) {
      localStorage.removeItem('aks_refresh_token')
    }
    if (rt) {
      if (window.electron) {
        window.api.authLogout(rt).catch(() => {})
      } else {
        fetch(`${API_URL}/auth/web-logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt })
        }).catch(() => {})
      }
    }
  }

  // Expose a helper so other contexts can get a fresh token
  async function getToken() {
    if (!token) return null
    if (!isExpired(token)) return token

    if (!refreshTokenRef.current) { logout(); return null }
    
    let result;
    if (window.electron) {
      result = await window.api.authRefresh(refreshTokenRef.current)
    } else {
      const res = await fetch(`${API_URL}/auth/web-refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshTokenRef.current })
      })
      result = await res.json()
    }

    if (!result.ok) { logout(); return null }

    const newRt = result.tokens.refresh_token
    const newAt = result.tokens.access_token

    refreshTokenRef.current = newRt
    if (!window.electron) {
      localStorage.setItem('aks_refresh_token', newRt)
    }
    
    setToken(newAt)
    return newAt
  }

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, token, login, logout, getToken, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
