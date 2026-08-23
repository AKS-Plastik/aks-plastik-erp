import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { API_URL } from '../config'

export default function Users() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { roles } = useData()
  const [users, setUsers] = useState([])
  const [employees, setEmployees] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'user', department: '', employeeId: '' })
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'user' })
  const [resetEmailStatus, setResetEmailStatus] = useState(null) // null | 'sending' | 'sent' | 'error'
  const [error, setError] = useState('')
  const [editError, setEditError] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/auth/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : [])
      })
      .catch(() => {})

    fetch(`${API_URL}/employees`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setEmployees)
      .catch(() => {})
  }, [token])

  // Employees without a linked user account
  const availableEmployees = employees.filter((e) => !users.some((u) => u.employeeId === e.id))

  function handleEmployeePick(employeeId) {
    if (!employeeId) {
      setForm((f) => ({ ...f, employeeId: '', name: '', email: '', phone: '', department: '' }))
      return
    }
    const emp = employees.find((e) => e.id === employeeId)
    if (!emp) return
    setForm((f) => ({
      ...f,
      employeeId: emp.id,
      name: emp.name || f.name,
      email: emp.email || f.email,
      phone: emp.phone || f.phone,
      department: emp.department || f.department,
    }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch(`${API_URL}/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUsers((prev) => [data, ...prev])
      setForm({ name: '', email: '', password: '', phone: '', role: 'user', department: '', employeeId: '' })
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`${API_URL}/auth/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to delete user')
        setConfirmDeleteId(null)
        return
      }
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch {
      alert('Network error. Please try again.')
    }
    setConfirmDeleteId(null)
  }

  const [viewUser, setViewUser] = useState(null)
  const [confirmEdit, setConfirmEdit] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  function startEdit(u) {
    setEditingUser(u.id)
    setEditForm({ name: u.name, email: u.email, phone: u.phone || '', role: u.role })
    setEditError('')
    setConfirmEdit(false)
  }

  async function sendResetEmail(userId) {
    setResetEmailStatus('sending')
    try {
      const res = await fetch(`${API_URL}/auth/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setResetEmailStatus('sent')
    } catch {
      setResetEmailStatus('error')
    }
  }

  function closeEdit() {
    setEditingUser(null)
    setConfirmEdit(false)
    setEditError('')
  }

  async function handleUpdate() {
    setEditError('')
    try {
      const res = await fetch(`${API_URL}/auth/users/${editingUser}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editForm.name, email: editForm.email, phone: editForm.phone, role: editForm.role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUsers((prev) => prev.map((u) => (u.id === editingUser ? data : u)))
      closeEdit()
    } catch (err) {
      setEditError(err.message)
      setConfirmEdit(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-row items-center justify-between gap-3 md:gap-4 mb-4 md:mb-5">
        <div>
          <h1 className="text-base md:text-lg font-extrabold text-on-surface">
            {t('settings.users')}
          </h1>
          <p className="text-[10px] md:text-xs text-text-muted mt-0.5">{users.length} {t('settings.users').toLowerCase()}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg primary-gradient text-white text-[10px] md:text-xs font-bold shadow-sm shadow-primary/20 hover:opacity-90 transition-opacity shrink-0"
        >
          <span className="material-symbols-outlined text-sm md:text-base">person_add</span>
          {t('common.add')}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={() => { setShowForm(false); setError('') }} />
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl shadow-inverse-surface/20 w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="primary-gradient px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-surface-container-lowest/20 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-[13px]">person_add</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-white">Add User</h2>
                    <p className="text-blue-200 text-[9px] mt-0.5">Create a new system account</p>
                  </div>
                </div>
                <button onClick={() => { setShowForm(false); setError('') }} className="p-1 rounded-md text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <form onSubmit={handleCreate} className="p-4 space-y-3">
          {error && (
            <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Employee picker */}
          <div>
            <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">
              Link to Employee <span className="text-text-subtle">(required)</span>
            </label>
            <select
              value={form.employeeId}
              onChange={(e) => handleEmployeePick(e.target.value)}
              required
              className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border text-[11px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">— Select an employee —</option>
              {availableEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} {e.department ? `(${e.department})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border bg-input-bg text-on-surface text-[11px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border bg-input-bg text-on-surface text-[11px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="user@fieldhub.com"
              />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border bg-input-bg text-on-surface text-[11px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">Phone <span className="text-text-subtle">(optional)</span></label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border bg-input-bg text-on-surface text-[11px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="+1 234 567 8900"
              />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border text-[11px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.department && (
              <div>
                <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">Department</label>
                <div className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border bg-surface-container-high text-on-surface-variant text-[11px] md:text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm md:text-base text-text-muted">apartment</span>
                  {form.department}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => { setShowForm(false); setError('') }} className="px-3 py-1.5 text-xs md:text-sm text-on-surface-variant hover:text-on-surface transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" className="px-4 py-1.5 md:py-2 rounded-lg primary-gradient text-white text-xs md:text-sm font-bold hover:opacity-90 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm md:text-base">person_add</span>
              Create User
            </button>
          </div>
        </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={closeEdit} />
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl shadow-inverse-surface/20 w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="primary-gradient px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-surface-container-lowest/20 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-[13px]">edit</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-white">Edit User</h2>
                    <p className="text-blue-200 text-[9px] mt-0.5">{users.find((u) => u.id === editingUser)?.name}</p>
                  </div>
                </div>
                <button onClick={closeEdit} className="p-1 rounded-md text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {editError && (
                <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-lg">
                  {editError}
                </div>
              )}
              {!confirmEdit ? (
                <>
                  <div>
                    <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border bg-input-bg text-on-surface text-[11px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border bg-input-bg text-on-surface text-[11px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">Phone <span className="text-text-subtle">(optional)</span></label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border bg-input-bg text-on-surface text-[11px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">Role</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border text-[11px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {users.find((u) => u.id === editingUser)?.department && (
                    <div>
                      <label className="block text-[10px] md:text-xs font-medium text-text-muted mb-1">Department</label>
                      <div className="w-full px-3 py-1.5 md:py-2 rounded-lg border border-input-border bg-surface-container-high text-on-surface-variant text-[11px] md:text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm md:text-base text-text-muted">apartment</span>
                        {users.find((u) => u.id === editingUser)?.department}
                        <span className="ml-auto text-[10px] md:text-xs text-text-muted">Change in Employee Detail</span>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 justify-end pt-2">
                    <button onClick={closeEdit} className="px-3 py-1.5 text-xs md:text-sm text-on-surface-variant hover:text-on-surface transition-colors">
                      {t('common.cancel')}
                    </button>
                    <button onClick={() => setConfirmEdit(true)} className="px-4 py-1.5 md:py-2 rounded-lg primary-gradient text-white text-xs md:text-sm font-bold hover:opacity-90 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm md:text-base">save</span>
                      {t('common.saveChanges')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-2">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-2 md:mb-3">
                    <span className="material-symbols-outlined text-xl md:text-2xl text-on-surface-variant">help</span>
                  </div>
                  <p className="text-xs md:text-sm font-bold text-on-surface mb-1">{t('common.areYouSure')}</p>
                  <p className="text-[10px] md:text-xs text-on-surface-variant mb-4 md:mb-5">This will update the user's information.</p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => setConfirmEdit(false)} className="flex-1 py-1.5 rounded-lg border border-theme-border text-text-muted text-[11px] md:text-xs font-semibold hover:bg-hover-bg transition-colors">
                      {t('common.goBack')}
                    </button>
                    <button onClick={handleUpdate} className="flex-1 py-1.5 rounded-lg primary-gradient text-white text-[11px] md:text-xs font-bold hover:opacity-90 flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">check</span>
                      {t('common.confirm')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {viewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={() => { setViewUser(null); setResetEmailStatus(null) }} />
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl shadow-inverse-surface/20 w-full max-w-sm mx-4 overflow-hidden">
            {/* Banner */}
            <div className="primary-gradient px-4 py-3 md:py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] md:text-[10px] font-bold text-white/60 uppercase tracking-widest">User Details</span>
                <button onClick={() => setViewUser(null)} className="p-1 rounded-md text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors">
                  <span className="material-symbols-outlined text-base md:text-lg">close</span>
                </button>
              </div>
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-surface-container-lowest/20 flex items-center justify-center text-white text-base md:text-xl font-black flex-shrink-0">
                  {viewUser.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base md:text-xl font-extrabold text-white leading-tight">{viewUser.name}</h2>
                  <span className={`inline-flex mt-0.5 md:mt-1 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[9px] md:text-xs font-bold ${
                    viewUser.role === 'admin' ? 'bg-surface-container-lowest/30 text-white' : 'bg-surface-container-lowest/20 text-white/80'
                  }`}>
                    {viewUser.role === 'manager' ? 'Dept. Manager' : viewUser.role.charAt(0).toUpperCase() + viewUser.role.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="px-4 py-4 md:py-5 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2.5 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant text-base md:text-lg">mail</span>
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-text-muted">{t('common.email')}</p>
                  <p className="text-xs md:text-sm font-medium text-on-surface">{viewUser.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant text-base md:text-lg">phone</span>
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-text-muted">{t('common.phone')}</p>
                  <p className="text-xs md:text-sm font-medium text-on-surface">{viewUser.phone || '—'}</p>
                </div>
              </div>
              {viewUser.department && (
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant text-base md:text-lg">apartment</span>
                  </div>
                  <div>
                    <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-text-muted">{t('common.department')}</p>
                    <p className="text-xs md:text-sm font-medium text-on-surface">{viewUser.department}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2.5 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant text-base md:text-lg">calendar_today</span>
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-text-muted">Member Since</p>
                  <p className="text-xs md:text-sm font-medium text-on-surface">{new Date(viewUser.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
            </div>

            <div className="px-4 pb-4 md:pb-5 space-y-2.5 md:space-y-3">
              {/* Reset email feedback */}
              {resetEmailStatus === 'sent' && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] md:text-xs font-medium">
                  <span className="material-symbols-outlined text-sm md:text-base">mark_email_read</span>
                  Password reset email sent to {viewUser.email}
                </div>
              )}
              {resetEmailStatus === 'error' && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-error-container text-on-error-container text-[11px] md:text-xs font-medium">
                  <span className="material-symbols-outlined text-sm md:text-base">error</span>
                  Failed to send email. Check SMTP settings.
                </div>
              )}

              <button
                onClick={() => sendResetEmail(viewUser.id)}
                disabled={resetEmailStatus === 'sending' || resetEmailStatus === 'sent'}
                className="w-full py-2 rounded-lg border-2 border-outline-variant text-on-surface-variant text-[11px] md:text-xs font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm md:text-base">
                  {resetEmailStatus === 'sending' ? 'hourglass_top' : resetEmailStatus === 'sent' ? 'check' : 'lock_reset'}
                </span>
                {resetEmailStatus === 'sending' ? 'Sending...' : resetEmailStatus === 'sent' ? 'Email Sent' : 'Send Password Reset Email'}
              </button>

              <div className="flex gap-2.5">
                <button
                  onClick={() => { setViewUser(null); setResetEmailStatus(null); startEdit(viewUser) }}
                  className="flex-1 py-2 rounded-lg border-2 border-primary text-primary text-[11px] md:text-xs font-bold hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm md:text-base">edit</span>{t('common.edit')}
                </button>
                <button
                  onClick={() => { setViewUser(null); setResetEmailStatus(null) }}
                  className="flex-1 py-2 rounded-lg primary-gradient text-white text-[11px] md:text-xs font-bold hover:opacity-90 transition-opacity"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0">
          <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm mx-auto p-4 text-center">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-error-container flex items-center justify-center mx-auto mb-2 md:mb-3">
              <span className="material-symbols-outlined text-xl md:text-2xl text-error">delete_forever</span>
            </div>
            <p className="text-sm md:text-base font-bold text-on-surface mb-1">Delete this user?</p>
            <p className="text-[11px] md:text-xs text-text-muted mb-4 md:mb-5">{t('common.cantUndo')}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-1.5 md:py-2 rounded-lg border border-theme-border text-text-muted text-[11px] md:text-sm font-semibold hover:bg-hover-bg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 py-1.5 md:py-2 rounded-lg bg-error text-white text-[11px] md:text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm md:text-base">delete</span>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Table (xl and up) */}
      <div className="hidden xl:block bg-surface-container-lowest rounded-2xl shadow-sm border border-theme-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-theme-border bg-surface-container-high/30">
              <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">{t('common.name')}</th>
              <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">{t('common.email')}</th>
              <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">{t('common.phone')}</th>
              <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Role</th>
              <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">{t('common.created')}</th>
              <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={`desktop-${u.id}`} onClick={() => setViewUser(u)} className="border-b border-theme-border hover:bg-hover-bg transition-colors cursor-pointer group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl primary-gradient flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                      {u.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-bold text-on-surface">{u.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-text-muted">{u.email}</td>
                <td className="px-6 py-4 text-sm text-text-muted">{u.phone || '—'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
                    u.role === 'admin'
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : u.role === 'manager'
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      : 'bg-surface-container border border-theme-border text-text-muted'
                  }`}>
                    {u.role === 'manager' ? 'Dept. Manager' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                  </span>
                  {u.department && (
                    <p className="text-[10px] text-text-subtle font-medium mt-1">{u.department}</p>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-text-muted">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => startEdit(u)}
                      className="p-2 text-text-subtle hover:text-primary transition-colors rounded-xl hover:bg-primary/10"
                      title="Edit user"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(u.id)}
                      className="p-2 text-text-subtle hover:text-error transition-colors rounded-xl hover:bg-error/10"
                      title="Delete user"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile & Tablet Cards (up to xl) */}
      <div className="xl:hidden grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {users.map((u) => (
          <div key={`mobile-${u.id}`} onClick={() => setViewUser(u)} className="bg-surface-container-lowest rounded-2xl p-3 md:p-4 border border-theme-border shadow-sm flex flex-col gap-3 cursor-pointer hover:bg-hover-bg transition-colors">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-2.5 md:gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl primary-gradient flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                  {u.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[11px] md:text-sm font-bold text-on-surface truncate">{u.name}</h3>
                  <p className="text-[10px] md:text-xs text-text-muted truncate">{u.email}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0 max-w-[45%]">
                <span className={`inline-flex px-2 py-0.5 md:px-2.5 md:py-1 rounded-md text-[9px] md:text-[10px] font-bold truncate max-w-full ${
                  u.role === 'admin'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : u.role === 'manager'
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    : 'bg-surface-container border border-theme-border text-text-muted'
                }`}>
                  {u.role === 'manager' ? 'Dept. Manager' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                </span>
                {u.department && (
                  <span className="text-[9px] md:text-[10px] text-text-subtle font-medium truncate max-w-full">{u.department}</span>
                )}
              </div>
            </div>

            <div className="h-px w-full bg-theme-border-light my-0.5" />

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1.5 md:gap-2">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <span className="material-symbols-outlined text-[14px]">phone</span>
                  <span className="text-[10px] md:text-xs font-medium">{u.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-text-muted">
                  <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                  <span className="text-[10px] md:text-xs font-medium">{new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 md:gap-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => startEdit(u)} className="p-2 md:p-2.5 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors">
                  <span className="material-symbols-outlined text-base md:text-lg">edit</span>
                </button>
                <button onClick={() => setConfirmDeleteId(u.id)} className="p-2 md:p-2.5 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors">
                  <span className="material-symbols-outlined text-base md:text-lg">delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
