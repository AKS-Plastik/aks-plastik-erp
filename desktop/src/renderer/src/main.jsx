import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initLogger } from './utils/logger'
import './i18n'
import './index.css'

initLogger()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
