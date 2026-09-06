const isElectron = !!window.api
const isDev = !isElectron || import.meta.env.DEV

let baseUrl = import.meta.env.VITE_API_URL || 'http://172.18.0.1:3001/api'

// Web ortamında (tarayıcıdan) giriliyorsa, backend'in IP'sini otomatik olarak tarayıcının bağlandığı IP (veya domain) üzerinden al:
if (!isElectron && typeof window !== 'undefined' && window.location.hostname) {
  baseUrl = `${window.location.protocol}//${window.location.hostname}:3001/api`
}

export const API_URL = baseUrl
