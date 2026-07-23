const isDev = !window.electron || import.meta.env.DEV
export const API_URL = isDev
  ? 'http://172.18.0.1:3001/api'
  : (import.meta.env.VITE_API_URL || 'http://172.18.0.1:3001/api')
