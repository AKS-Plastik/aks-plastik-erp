const isElectron = !!window.api
const isDev = !isElectron || import.meta.env.DEV

let baseUrl = import.meta.env.VITE_API_URL || 'http://172.18.0.1:3001/api'// 'https://crm.aksplastikambalaj.com:3001/api'

// Web ortamında (tarayıcıdan) giriliyorsa, backend'in IP'sini otomatik olarak tarayıcının bağlandığı IP (veya domain) üzerinden al:
if (!isElectron && typeof window !== 'undefined' && window.location.hostname) {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    baseUrl = `http://${window.location.hostname}:3001/api`
  } else {
    baseUrl = `https://api.aksplastikambalaj.com/api`
  }
}

export const API_URL = baseUrl
