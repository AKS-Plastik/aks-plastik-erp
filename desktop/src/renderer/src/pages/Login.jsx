import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import aksLogoLight from '../assets/aks_logo.png'
import aksLogoDark from '../assets/aks_logo_dark.png'

export default function Login() {
  const { t } = useTranslation()
  const { login, loading } = useAuth()
  const { dark, toggleTheme } = useTheme()
  const [error, setError] = useState('')

  async function handleLogin() {
    setError('')
    try {
      await login()
    } catch (err) {
      setError(err.message || t('login.loginFailed'))
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-surface-container-lowest border border-theme-border text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors shadow-sm"
        title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        <span className="material-symbols-outlined text-lg md:text-xl">{dark ? 'light_mode' : 'dark_mode'}</span>
      </button>

      <div className="w-full max-w-sm px-5">
        <div className="flex flex-col items-center mb-6 md:mb-8">
          <img src={dark ? aksLogoDark : aksLogoLight} alt="AKS" className="w-48 md:w-64 object-contain" />
          <div className="text-[10px] md:text-xs text-text-muted uppercase tracking-widest font-bold mt-2">
            CRM & ERP System
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-theme-border p-5 md:p-8 space-y-4 md:space-y-5">
          <h2 className="text-base md:text-lg font-bold text-on-surface text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t('login.welcome')}
          </h2>

          {error && (
            <div className="bg-error-container text-on-error-container text-sm px-4 py-2.5 rounded-lg border border-error/20">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2 md:py-2.5 rounded-lg primary-gradient text-white text-xs md:text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-sm md:text-base animate-spin">progress_activity</span>
                {t('login.signingIn')}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm md:text-base">login</span>
                {t('login.signIn')}
              </>
            )}
          </button>

          <p className="text-[10px] md:text-xs text-text-muted text-center leading-relaxed px-2">
            {t('login.credentials')}
          </p>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">v1.0.0</p>
      </div>
    </div>
  )
}
