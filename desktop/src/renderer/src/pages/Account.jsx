import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { API_URL } from '../config'

function ChangePasswordModal({ token, onClose }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (form.newPassword !== form.confirmPassword) return setError(t('account.passwordMismatch'))
    if (form.newPassword.length < 6) return setError(t('account.passwordTooShort'))
    setConfirming(true)
  }

  async function handleConfirm() {
    setConfirming(false)
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(t('account.passwordChanged'))
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setConfirming(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl shadow-inverse-surface/20 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="primary-gradient px-6 pt-6 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-surface-container-lowest/20 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-white">lock</span>
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-white">{t('account.changePassword')}</h2>
                <p className="text-blue-200 text-xs mt-0.5">{t('account.updateSubtitle')}</p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        {confirming ? (
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant">help</span>
            </div>
            <p className="text-base font-bold text-on-surface mb-1">{t('account.areYouSure')}</p>
            <p className="text-sm text-on-surface-variant mb-6">{t('account.willBeUpdated')}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirming(false)} className="px-5 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant text-sm font-semibold hover:bg-surface-container-low transition-colors">
                {t('account.goBack')}
              </button>
              <button onClick={handleConfirm} className="px-5 py-2.5 rounded-lg primary-gradient text-white text-sm font-bold hover:opacity-90 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">check</span>
                {t('common.confirm')}
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-error-container text-on-error-container text-sm px-4 py-2.5 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="status-completed-badge text-sm px-4 py-2.5 rounded-lg">
              {success}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">{t('account.currentPassword')}</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-input-bg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">{t('account.newPassword')}</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              required
              minLength={6}
              placeholder={t('account.minChars')}
              className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-input-bg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">{t('account.confirmNewPassword')}</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-input-bg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={handleClose} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg primary-gradient text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">lock_reset</span>
              {loading ? t('account.updating') : t('account.updatePassword')}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}

export default function Account() {
  const { t } = useTranslation()
  const { user, token, logout } = useAuth()
  const { employees } = useData()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '??'

  const matchedEmployee = user?.employeeId
    ? (employees || []).find((e) => e.id === user.employeeId)
    : user?.email
    ? (employees || []).find((e) => e.email && e.email.toLowerCase() === user.email.toLowerCase())
    : null

  const photoUrl = matchedEmployee?.photo ? `${API_URL.replace('/api', '')}${matchedEmployee.photo}` : null

  return (
    <div className="p-4 md:p-6 max-w-lg">
      {showModal && <ChangePasswordModal token={token} onClose={() => setShowModal(false)} />}

      <h1 className="text-lg md:text-xl font-bold text-on-surface mb-4 md:mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {t('account.title')}
      </h1>

      {/* Profile info */}
      <div className="bg-surface-container-lowest rounded-xl border border-theme-border p-4 md:p-6">
        <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-5">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden flex-shrink-0">
            {photoUrl
              ? <img src={photoUrl} alt={user?.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full primary-gradient flex items-center justify-center text-white text-lg md:text-xl font-bold">{initials}</div>
            }
          </div>
          <div>
            <p className="text-base md:text-lg font-bold text-on-surface leading-tight">{user?.name || '—'}</p>
            <p className="text-[10px] md:text-xs text-text-muted mt-0.5 md:mt-1">{user?.email}</p>
            <span className={`inline-flex mt-1 md:mt-1.5 px-2 md:px-2.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold ${
              user?.role === 'admin' ? 'status-scheduled-badge' : 'bg-surface-container-high text-on-surface-variant'
            }`}>
              {user?.role === 'admin' ? t('topbar.admin') : t('topbar.user')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 pt-3 md:pt-4 border-t border-theme-border">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-lg border border-outline-variant text-on-surface-variant text-xs md:text-sm font-semibold hover:bg-surface-container-high hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-sm md:text-base">lock</span>
            {t('account.changePassword')}
          </button>

          {confirmLogout ? (
            <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 md:gap-2 ml-auto">
              <span className="text-[10px] md:text-xs text-text-muted">{t('account.logOutConfirm')}</span>
              <button
                onClick={handleLogout}
                className="px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg bg-error text-white text-[10px] md:text-xs font-bold hover:opacity-90 transition-opacity"
              >
                {t('account.yesLogOut')}
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                className="px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg border border-outline-variant text-on-surface-variant text-[10px] md:text-xs font-semibold hover:bg-surface-container-high transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmLogout(true)}
              className="ml-auto flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-lg border border-error/40 text-error text-xs md:text-sm font-semibold hover:bg-error/10 transition-colors"
            >
              <span className="material-symbols-outlined text-sm md:text-base">logout</span>
              {t('account.logOut')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
