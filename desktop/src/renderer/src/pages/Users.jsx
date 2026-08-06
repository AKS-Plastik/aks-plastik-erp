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
      .then(setUsers)
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-on-surface" style={{ fontFamily: 'Manrope, sans-serif' }}>
            User Management
          </h1>
          <p className="text-sm text-text-muted mt-1">{users.length} users</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg primary-gradient text-white text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Add User
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={() => { setShowForm(false); setError('') }} />
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl shadow-inverse-surface/20 w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="primary-gradient px-6 pt-6 pb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-surface-container-lowest/20 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-white">person_add</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-white">Add User</h2>
                    <p className="text-blue-200 text-xs mt-0.5">Create a new system account</p>
                  </div>
                </div>
                <button onClick={() => { setShowForm(false); setError('') }} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <form onSubmit={handleCreate} className="p-6 space-y-4">
          {error && (
            <div className="bg-error-container text-on-error-container text-sm px-4 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          {/* Employee picker */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Link to Employee <span className="text-text-subtle">(required)</span>
            </label>
            <select
              value={form.employeeId}
              onChange={(e) => handleEmployeePick(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-input-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">— Select an employee —</option>
              {availableEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} {e.department ? `(${e.department})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-input-bg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-input-bg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="user@fieldhub.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-input-bg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Phone <span className="text-text-subtle">(optional)</span></label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-input-bg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="+1 234 567 8900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-input-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.department && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Department</label>
                <div className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-surface-container-high text-on-surface-variant text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-text-muted">apartment</span>
                  {form.department}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setShowForm(false); setError('') }} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-lg primary-gradient text-white text-sm font-bold hover:opacity-90 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">person_add</span>
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
            <div className="primary-gradient px-6 pt-6 pb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-surface-container-lowest/20 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-white">edit</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-white">Edit User</h2>
                    <p className="text-blue-200 text-xs mt-0.5">{users.find((u) => u.id === editingUser)?.name}</p>
                  </div>
                </div>
                <button onClick={closeEdit} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {editError && (
                <div className="bg-error-container text-on-error-container text-sm px-4 py-2.5 rounded-lg">
                  {editError}
                </div>
              )}
              {!confirmEdit ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-input-bg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-input-bg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Phone <span className="text-text-subtle">(optional)</span></label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-input-bg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Role</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-input-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {users.find((u) => u.id === editingUser)?.department && (
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1.5">Department</label>
                      <div className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-surface-container-high text-on-surface-variant text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-text-muted">apartment</span>
                        {users.find((u) => u.id === editingUser)?.department}
                        <span className="ml-auto text-xs text-text-muted">Change in Employee Detail</span>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 justify-end pt-2">
                    <button onClick={closeEdit} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
                      {t('common.cancel')}
                    </button>
                    <button onClick={() => setConfirmEdit(true)} className="px-5 py-2.5 rounded-lg primary-gradient text-white text-sm font-bold hover:opacity-90 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">save</span>
                      {t('common.saveChanges')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-2">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <span className="material-symbols-outlined text-2xl md:text-3xl text-on-surface-variant">help</span>
                  </div>
                  <p className="text-sm md:text-base font-bold text-on-surface mb-1">{t('common.areYouSure')}</p>
                  <p className="text-xs md:text-sm text-on-surface-variant mb-4 md:mb-6">This will update the user's information.</p>
                  <div className="flex gap-2 md:gap-3 justify-center">
                    <button onClick={() => setConfirmEdit(false)} className="flex-1 py-1.5 md:py-2 rounded-lg border border-theme-border text-text-muted text-xs md:text-sm font-semibold hover:bg-hover-bg transition-colors">
                      {t('common.goBack')}
                    </button>
                    <button onClick={handleUpdate} className="flex-1 py-1.5 md:py-2 rounded-lg primary-gradient text-white text-xs md:text-sm font-bold hover:opacity-90 flex items-center justify-center gap-1.5 md:gap-2">
                      <span className="material-symbols-outlined text-sm md:text-base">check</span>
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
            <div className="primary-gradient px-6 pt-6 pb-8">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold text-white/60 uppercase tracking-widest">User Details</span>
                <button onClick={() => setViewUser(null)} className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-surface-container-lowest/20 flex items-center justify-center text-white text-xl font-black flex-shrink-0">
                  {viewUser.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white leading-tight">{viewUser.name}</h2>
                  <span className={`inline-flex mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    viewUser.role === 'admin' ? 'bg-surface-container-lowest/30 text-white' : 'bg-surface-container-lowest/20 text-white/80'
                  }`}>
                    {viewUser.role === 'manager' ? 'Dept. Manager' : viewUser.role.charAt(0).toUpperCase() + viewUser.role.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">mail</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t('common.email')}</p>
                  <p className="text-sm font-medium text-on-surface">{viewUser.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">phone</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t('common.phone')}</p>
                  <p className="text-sm font-medium text-on-surface">{viewUser.phone || '—'}</p>
                </div>
              </div>
              {viewUser.department && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">apartment</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{t('common.department')}</p>
                    <p className="text-sm font-medium text-on-surface">{viewUser.department}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">calendar_today</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Member Since</p>
                  <p className="text-sm font-medium text-on-surface">{new Date(viewUser.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 space-y-3">
              {/* Reset email feedback */}
              {resetEmailStatus === 'sent' && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  <span className="material-symbols-outlined text-base">mark_email_read</span>
                  Password reset email sent to {viewUser.email}
                </div>
              )}
              {resetEmailStatus === 'error' && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                  <span className="material-symbols-outlined text-base">error</span>
                  Failed to send email. Check SMTP settings.
                </div>
              )}

              <button
                onClick={() => sendResetEmail(viewUser.id)}
                disabled={resetEmailStatus === 'sending' || resetEmailStatus === 'sent'}
                className="w-full py-2.5 rounded-xl border-2 border-outline-variant text-on-surface-variant text-sm font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">
                  {resetEmailStatus === 'sending' ? 'hourglass_top' : resetEmailStatus === 'sent' ? 'check' : 'lock_reset'}
                </span>
                {resetEmailStatus === 'sending' ? 'Sending...' : resetEmailStatus === 'sent' ? 'Email Sent' : 'Send Password Reset Email'}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => { setViewUser(null); setResetEmailStatus(null); startEdit(viewUser) }}
                  className="flex-1 py-2.5 rounded-xl border-2 border-primary text-primary text-sm font-bold hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">edit</span>{t('common.edit')}
                </button>
                <button
                  onClick={() => { setViewUser(null); setResetEmailStatus(null) }}
                  className="flex-1 py-2.5 rounded-xl primary-gradient text-white text-sm font-bold hover:opacity-90 transition-opacity"
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
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-[320px] md:max-w-sm mx-auto p-5 md:p-6 text-center">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-error-container flex items-center justify-center mx-auto mb-3 md:mb-4">
              <span className="material-symbols-outlined text-2xl md:text-3xl text-error">delete_forever</span>
            </div>
            <p className="text-sm md:text-base font-bold text-on-surface mb-1">Delete this user?</p>
            <p className="text-xs md:text-sm text-text-muted mb-4 md:mb-6">{t('common.cantUndo')}</p>
            <div className="flex gap-2 md:gap-3 justify-center">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-1.5 md:py-2 rounded-lg border border-theme-border text-text-muted text-xs md:text-sm font-semibold hover:bg-hover-bg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 py-1.5 md:py-2 rounded-lg bg-error text-white text-xs md:text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 md:gap-2"
              >
                <span className="material-symbols-outlined text-sm md:text-base">delete</span>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-xl border border-theme-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-theme-border-light">
              <th className="text-left px-6 py-3.5 text-xs font-medium text-text-muted uppercase tracking-wider">{t('common.name')}</th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-text-muted uppercase tracking-wider">{t('common.email')}</th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-text-muted uppercase tracking-wider">{t('common.phone')}</th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-text-muted uppercase tracking-wider">Role</th>
              <th className="text-left px-6 py-3.5 text-xs font-medium text-text-muted uppercase tracking-wider">{t('common.created')}</th>
              <th className="px-6 py-3.5"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} onClick={() => setViewUser(u)} className="border-b border-theme-border-light hover:bg-hover-bg transition-colors cursor-pointer">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full primary-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {u.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-on-surface">{u.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-on-surface-variant">{u.email}</td>
                <td className="px-6 py-4 text-sm text-on-surface-variant">{u.phone || '—'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                    u.role === 'admin'
                      ? 'status-scheduled-badge'
                      : u.role === 'manager'
                      ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    {u.role === 'manager' ? 'Dept. Manager' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                  </span>
                  {u.department && (
                    <p className="text-xs text-text-muted mt-1">{u.department}</p>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-text-muted">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => startEdit(u)}
                      className="p-1.5 text-text-subtle hover:text-primary transition-colors rounded-lg hover:bg-surface-container-high"
                      title="Edit user"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(u.id)}
                      className="p-1.5 text-text-subtle hover:text-error transition-colors rounded-lg hover:bg-error-container"
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
    </div>
  )
}
