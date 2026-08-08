import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { API_URL } from '../config'

const LEAVE_TYPES = ['Annual', 'Sick', 'Personal', 'Unpaid']

// ── helpers ──────────────────────────────────────────────────────────────────
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null
  const [h1, m1] = checkIn.split(':').map(Number)
  const [h2, m2] = checkOut.split(':').map(Number)
  const diff = h2 * 60 + m2 - (h1 * 60 + m1)
  if (diff <= 0) return null
  const hrs = Math.floor(diff / 60)
  const mins = diff % 60
  return `${hrs}h ${mins > 0 ? `${mins}m` : ''}`.trim()
}

function countWeekdays(start, end) {
  let count = 0
  const d = new Date(start)
  const last = new Date(end)
  while (d <= last) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

const statusBadge = {
  Pending: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  Approved: 'bg-primary-fixed text-on-primary-fixed-variant',
  Rejected: 'bg-error/10 text-error',
}

// ── My Attendance Tab ────────────────────────────────────────────────────────
function MyAttendanceTab({ employeeId, token }) {
  const { t } = useTranslation()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [records, setRecords] = useState([])
  const [editDate, setEditDate] = useState(null)
  const [editForm, setEditForm] = useState({ checkIn: '', checkOut: '', notes: '' })

  const monthStr = `${year}-${pad(month + 1)}`
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const load = useCallback(() => {
    if (!employeeId) {
      setRecords([])
      return
    }
    fetch(`${API_URL}/attendance?employeeId=${employeeId}&month=${monthStr}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setRecords(Array.isArray(data) ? data : [])
      })
      .catch(() => { })
  }, [employeeId, monthStr, token])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  const days = []
  const total = daysInMonth(year, month)
  for (let d = 1; d <= total; d++) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`
    const dayOfWeek = new Date(year, month, d).getDay()
    const rec = records.find((r) => r.date === dateStr)
    days.push({ date: dateStr, day: d, dayOfWeek, rec })
  }

  const DAYS_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  function startEdit(dateStr, rec) {
    setEditDate(dateStr)
    setEditForm({ checkIn: rec?.checkIn || '', checkOut: rec?.checkOut || '', notes: rec?.notes || '' })
  }

  async function saveEdit() {
    await fetch(`${API_URL}/attendance`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ employeeId, date: editDate, ...editForm }),
    })
    setEditDate(null)
    load()
  }

  // Stats
  const workedDays = records.filter((r) => r.checkIn && r.checkOut).length
  const totalMinutes = records.reduce((sum, r) => {
    if (!r.checkIn || !r.checkOut) return sum
    const [h1, m1] = r.checkIn.split(':').map(Number)
    const [h2, m2] = r.checkOut.split(':').map(Number)
    return sum + (h2 * 60 + m2 - (h1 * 60 + m1))
  }, 0)
  const totalHrs = Math.floor(totalMinutes / 60)
  const totalMins = totalMinutes % 60

  return (
    <div>
      {/* Month nav + stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-0 mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={prevMonth} className="p-1 md:p-1.5 rounded-lg border border-theme-border hover:bg-hover-bg transition">
            <span className="material-symbols-outlined text-sm md:text-base">chevron_left</span>
          </button>
          <h2 className="text-base md:text-lg font-bold text-on-surface min-w-[130px] md:min-w-[180px] text-center">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-1 md:p-1.5 rounded-lg border border-theme-border hover:bg-hover-bg transition">
            <span className="material-symbols-outlined text-sm md:text-base">chevron_right</span>
          </button>
        </div>
        <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm">
          <div className="text-text-muted">
            <span className="font-semibold text-on-surface">{workedDays}</span> days worked
          </div>
          <div className="text-text-muted">
            <span className="font-semibold text-on-surface">{totalHrs}h {totalMins > 0 ? `${totalMins}m` : ''}</span> total
          </div>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="xl:hidden flex flex-col divide-y divide-neutral-500/20 bg-surface-container-lowest border border-neutral-500/20 rounded-2xl overflow-hidden mb-6">
        {days.map(({ date, day, dayOfWeek, rec }) => {
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
          const today = new Date().toISOString().split('T')[0]
          const isToday = date === today
          
          return (
            <div key={date} className={`p-4 transition-colors ${isToday ? 'bg-primary/5' : 'hover:bg-hover-bg'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm ${isToday ? 'font-bold text-primary' : 'text-on-surface'}`}>{date}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${isWeekend ? 'bg-error/10 text-error' : 'bg-surface-container text-text-muted'}`}>
                    {DAYS_LABEL[dayOfWeek]}
                  </span>
                </div>
                {!isWeekend && (
                  <button onClick={() => startEdit(date, rec)} className="p-1.5 rounded-lg border border-theme-border hover:bg-hover-bg text-text-muted hover:text-primary transition">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-text-muted mb-0.5 font-medium">{t('attendance.checkIn')}</p>
                  <p className="font-semibold text-on-surface">{rec?.checkIn || '—'}</p>
                </div>
                <div>
                  <p className="text-text-muted mb-0.5 font-medium">{t('attendance.checkOut')}</p>
                  <p className="font-semibold text-on-surface">{rec?.checkOut || '—'}</p>
                </div>
                <div>
                  <p className="text-text-muted mb-0.5 font-medium">{t('attendance.hours')}</p>
                  <p className="font-semibold text-on-surface">{calcHours(rec?.checkIn, rec?.checkOut) || '—'}</p>
                </div>
              </div>
              {rec?.notes && (
                <div className="mt-3 pt-2.5 border-t border-neutral-500/20 text-xs text-text-muted">
                  <span className="font-medium">Note:</span> {rec.notes}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden xl:block bg-surface-container-lowest rounded-2xl border border-theme-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-theme-border text-text-muted text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-semibold">{t('common.date')}</th>
              <th className="text-left px-5 py-3 font-semibold">Day</th>
              <th className="text-left px-5 py-3 font-semibold">{t('attendance.checkIn')}</th>
              <th className="text-left px-5 py-3 font-semibold">{t('attendance.checkOut')}</th>
              <th className="text-left px-5 py-3 font-semibold">{t('attendance.hours')}</th>
              <th className="text-left px-5 py-3 font-semibold">{t('common.notes')}</th>
              <th className="text-right px-5 py-3 font-semibold w-16"></th>
            </tr>
          </thead>
          <tbody>
            {days.map(({ date, day, dayOfWeek, rec }) => {
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
              const today = new Date().toISOString().split('T')[0]
              const isToday = date === today
              return (
                <tr
                  key={date}
                  className={`border-b border-theme-border transition-colors ${isWeekend ? 'bg-surface-container-high/40' : 'hover:bg-hover-bg'} ${isToday ? 'ring-1 ring-inset ring-primary/30' : ''}`}
                >
                  <td className="px-5 py-2.5">
                    <span className={`font-mono text-xs ${isToday ? 'font-bold text-primary' : 'text-on-surface'}`}>{date}</span>
                  </td>
                  <td className={`px-5 py-2.5 text-xs font-medium ${isWeekend ? 'text-error' : 'text-text-muted'}`}>
                    {DAYS_LABEL[dayOfWeek]}
                  </td>
                  <td className="px-5 py-2.5 text-on-surface">{rec?.checkIn || <span className="text-text-muted">—</span>}</td>
                  <td className="px-5 py-2.5 text-on-surface">{rec?.checkOut || <span className="text-text-muted">—</span>}</td>
                  <td className="px-5 py-2.5 font-medium text-on-surface">{calcHours(rec?.checkIn, rec?.checkOut) || <span className="text-text-muted">—</span>}</td>
                  <td className="px-5 py-2.5 text-text-muted text-xs max-w-[200px] truncate">{rec?.notes || ''}</td>
                  <td className="px-5 py-2.5 text-right">
                    {!isWeekend && (
                      <button onClick={() => startEdit(date, rec)} className="p-1 rounded-lg hover:bg-hover-bg text-text-muted hover:text-primary transition">
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-container-lowest rounded-xl md:rounded-2xl shadow-xl w-full max-w-[320px] md:max-w-sm p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="text-sm md:text-base font-bold text-on-surface">Edit — {editDate}</h3>
              <button onClick={() => setEditDate(null)} className="text-text-muted hover:text-error">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">close</span>
              </button>
            </div>
            <div className="space-y-2.5 md:space-y-3">
              <div>
                <label className="block text-[11px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('attendance.checkIn')}</label>
                <input type="time" className="w-full bg-surface-container-lowest border border-theme-border rounded px-2.5 py-1.5 md:px-3 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary" value={editForm.checkIn} onChange={(e) => setEditForm((f) => ({ ...f, checkIn: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('attendance.checkOut')}</label>
                <input type="time" className="w-full bg-surface-container-lowest border border-theme-border rounded px-2.5 py-1.5 md:px-3 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary" value={editForm.checkOut} onChange={(e) => setEditForm((f) => ({ ...f, checkOut: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.notes')}</label>
                <input className="w-full bg-surface-container-lowest border border-theme-border rounded px-2.5 py-1.5 md:px-3 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary" value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2.5 md:gap-3 mt-4 md:mt-5">
              <button onClick={() => setEditDate(null)} className="flex-1 border border-theme-border rounded-lg py-1.5 md:py-2 text-xs md:text-sm text-text-muted hover:bg-hover-bg transition">{t('common.cancel')}</button>
              <button onClick={saveEdit} className="flex-1 bg-primary text-white rounded-lg py-1.5 md:py-2 text-xs md:text-sm font-semibold hover:opacity-90 transition">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── My Leave Requests Tab ────────────────────────────────────────────────────
function MyLeaveTab({ employeeId, token, isManager, autoOpen }) {
  const { t } = useTranslation()
  const [requests, setRequests] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ type: 'Annual', startDate: '', endDate: '', reason: '' })
  const [errors, setErrors] = useState({})

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const load = useCallback(() => {
    if (!employeeId) {
      setRequests([])
      return
    }
    fetch(`${API_URL}/leave-requests?employeeId=${employeeId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setRequests(Array.isArray(data) ? data : [])
      })
      .catch(() => { })
  }, [employeeId, token])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (autoOpen) openAdd() }, [autoOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  function validate(f) {
    const e = {}
    if (!f.startDate) e.startDate = 'Required'
    if (!f.endDate) e.endDate = 'Required'
    if (f.startDate && f.endDate && f.startDate > f.endDate) e.endDate = 'Must be after start'
    return e
  }

  function openAdd() {
    setForm({ type: 'Annual', startDate: '', endDate: '', reason: '' })
    setErrors({})
    setShowForm(true)
  }

  function openEdit(item) {
    setForm({ type: item.type, startDate: item.startDate, endDate: item.endDate, reason: item.reason })
    setErrors({})
    setEditItem(item)
  }

  async function handleSave() {
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }
    const days = countWeekdays(form.startDate, form.endDate)
    if (editItem) {
      const res = await fetch(`${API_URL}/leave-requests/${editItem.id}`, {
        method: 'PUT', headers, body: JSON.stringify({ ...form, days }),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error); return }
    } else {
      await fetch(`${API_URL}/leave-requests`, {
        method: 'POST', headers, body: JSON.stringify({ ...form, employeeId, days }),
      })
    }
    setShowForm(false)
    setEditItem(null)
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this leave request?')) return
    const res = await fetch(`${API_URL}/leave-requests/${id}`, { method: 'DELETE', headers })
    if (!res.ok) { const d = await res.json(); alert(d.error); return }
    load()
  }

  const inputCls = (field) =>
    `w-full bg-surface-container-lowest border rounded px-2.5 py-1.5 md:px-3 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition ${errors[field] ? 'border-error' : 'border-theme-border'}`

  const usedDays = requests.filter((r) => r.status !== 'Rejected').reduce((sum, r) => sum + r.days, 0)

  return (
    <div>
      {/* Approval routing info banner */}
      {isManager && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-xl px-4 py-3 mb-5 text-sm">
          <span className="material-symbols-outlined text-base shrink-0">admin_panel_settings</span>
          <span>As a manager, your leave requests require <strong>admin approval</strong>.</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-0 mb-4 md:mb-6">
        <div className="flex items-center gap-4 md:gap-6 text-[11px] md:text-sm">
          <div className="text-text-muted">
            <span className="font-semibold text-on-surface">{usedDays}</span> days used / requested
          </div>
          <div className="text-text-muted">
            <span className="font-semibold text-on-surface">{requests.length}</span> total requests
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center justify-center gap-1.5 md:gap-2 primary-gradient text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[11px] md:text-xs font-semibold shadow-lg shadow-primary/10 hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-[13px] md:text-[15px]">add</span>
          {t('attendance.requestLeave')}
        </button>
      </div>

      {/* Mobile Card Layout */}
      <div className="xl:hidden flex flex-col divide-y divide-neutral-500/20 bg-surface-container-lowest border border-neutral-500/20 rounded-2xl overflow-hidden mb-6">
        {requests.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">No leave requests yet</div>
        ) : requests.map((r) => (
          <div key={r.id} className="p-4 transition-colors hover:bg-hover-bg">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-sm text-on-surface">{r.type}</span>
              {r.status === 'Pending' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary-fixed text-on-tertiary-fixed-variant">
                  <span className="material-symbols-outlined text-[10px]">schedule</span>
                  {isManager ? 'Awaiting Admin' : 'Awaiting Mgr'}
                </span>
              ) : (
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge[r.status] || ''}`}>
                  {r.status}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-y-2 text-xs mb-3">
              <div>
                <p className="text-text-muted mb-0.5">{t('attendance.startDate')}</p>
                <p className="font-mono font-medium text-on-surface">{r.startDate}</p>
              </div>
              <div>
                <p className="text-text-muted mb-0.5">{t('attendance.endDate')}</p>
                <p className="font-mono font-medium text-on-surface">{r.endDate}</p>
              </div>
              <div>
                <p className="text-text-muted mb-0.5">{t('attendance.days')}</p>
                <p className="font-semibold text-on-surface">{r.days} Days</p>
              </div>
              <div>
                <p className="text-text-muted mb-0.5">Reviewed By</p>
                <p className="font-medium text-on-surface">{r.reviewedBy || '—'}</p>
              </div>
            </div>
            
            {r.reason && (
              <div className="mb-3 text-xs text-text-muted bg-surface-container/50 p-2 rounded">
                <span className="font-medium">Reason:</span> {r.reason}
              </div>
            )}
            
            {r.status === 'Pending' && (
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-500/20">
                <button onClick={() => openEdit(r)} className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:opacity-80">
                  <span className="material-symbols-outlined text-sm">edit</span> Edit
                </button>
                <button onClick={() => handleDelete(r.id)} className="flex items-center gap-1 text-[11px] font-semibold text-error hover:opacity-80 ml-2">
                  <span className="material-symbols-outlined text-sm">delete</span> Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden xl:block bg-surface-container-lowest rounded-2xl border border-theme-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-theme-border text-text-muted text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-semibold">{t('attendance.leaveType')}</th>
              <th className="text-left px-5 py-3 font-semibold">{t('attendance.startDate')}</th>
              <th className="text-left px-5 py-3 font-semibold">{t('attendance.endDate')}</th>
              <th className="text-center px-5 py-3 font-semibold">{t('attendance.days')}</th>
              <th className="text-left px-5 py-3 font-semibold">Reason</th>
              <th className="text-left px-5 py-3 font-semibold">{t('common.status')}</th>
              <th className="text-left px-5 py-3 font-semibold">Reviewed By</th>
              <th className="text-right px-5 py-3 font-semibold w-20"></th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-text-muted">No leave requests yet</td></tr>
            ) : requests.map((r) => (
              <tr key={r.id} className="border-b border-theme-border hover:bg-hover-bg transition-colors">
                <td className="px-5 py-3 font-medium text-on-surface">{r.type}</td>
                <td className="px-5 py-3 font-mono text-xs text-on-surface">{r.startDate}</td>
                <td className="px-5 py-3 font-mono text-xs text-on-surface">{r.endDate}</td>
                <td className="px-5 py-3 text-center font-semibold text-on-surface">{r.days}</td>
                <td className="px-5 py-3 text-text-muted text-xs max-w-[160px] truncate">{r.reason || '—'}</td>
                <td className="px-5 py-3">
                  {r.status === 'Pending' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-tertiary-fixed text-on-tertiary-fixed-variant">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      {isManager ? 'Awaiting Admin' : 'Awaiting Manager'}
                    </span>
                  ) : (
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge[r.status] || ''}`}>
                      {r.status}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-text-muted text-xs">{r.reviewedBy || '—'}</td>
                <td className="px-5 py-3 text-right">
                  {r.status === 'Pending' && (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(r)} className="p-1 rounded-lg hover:bg-hover-bg text-text-muted hover:text-primary transition">
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="p-1 rounded-lg hover:bg-hover-bg text-text-muted hover:text-error transition">
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal */}
      {(showForm || editItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-container-lowest rounded-xl md:rounded-2xl shadow-xl w-full max-w-[320px] md:max-w-md p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="text-sm md:text-base font-bold text-on-surface">{editItem ? 'Edit' : 'New'} Leave Request</h3>
              <button onClick={() => { setShowForm(false); setEditItem(null) }} className="text-text-muted hover:text-error">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">close</span>
              </button>
            </div>
            <div className="space-y-2.5 md:space-y-3">
              <div>
                <label className="block text-[11px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('attendance.leaveType')}</label>
                <select className={inputCls('type')} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  {LEAVE_TYPES.map((lt) => <option key={lt}>{lt}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                <div>
                  <label className="block text-[11px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('attendance.startDate')} *</label>
                  <input type="date" className={inputCls('startDate')} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                  {errors.startDate && <p className="text-[10px] md:text-xs text-error mt-0.5 md:mt-1">{errors.startDate}</p>}
                </div>
                <div>
                  <label className="block text-[11px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('attendance.endDate')} *</label>
                  <input type="date" className={inputCls('endDate')} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                  {errors.endDate && <p className="text-[10px] md:text-xs text-error mt-0.5 md:mt-1">{errors.endDate}</p>}
                </div>
              </div>
              {form.startDate && form.endDate && form.startDate <= form.endDate && (
                <p className="text-[11px] md:text-xs text-text-muted">
                  <span className="font-semibold text-on-surface">{countWeekdays(form.startDate, form.endDate)}</span> working days
                </p>
              )}
              <div>
                <label className="block text-[11px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">Reason</label>
                <textarea rows={2} className={inputCls('reason')} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2.5 md:gap-3 mt-4 md:mt-5">
              <button onClick={() => { setShowForm(false); setEditItem(null) }} className="flex-1 border border-theme-border rounded-lg py-1.5 md:py-2 text-xs md:text-sm text-text-muted hover:bg-hover-bg transition">{t('common.cancel')}</button>
              <button onClick={handleSave} className="flex-1 bg-primary text-white rounded-lg py-1.5 md:py-2 text-xs md:text-sm font-semibold hover:opacity-90 transition">{t('attendance.submitLeave')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Team Requests Tab (Supervisor / Admin) ───────────────────────────────────
function TeamRequestsTab({ employeeId, token, isAdmin }) {
  const { t } = useTranslation()
  const [requests, setRequests] = useState([])

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const load = useCallback(() => {
    if (!employeeId && !isAdmin) {
      setRequests([])
      return
    }
    // Admin sees all; supervisor sees non-manager subordinates only
    const query = isAdmin ? '' : `?supervisorId=${employeeId}`
    fetch(`${API_URL}/leave-requests${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setRequests(Array.isArray(data) && data.length > 0 ? data : mockData)
      })
      .catch(() => { })
  }, [employeeId, token, isAdmin])

  useEffect(() => { load() }, [load])

  async function handleReview(id, status) {
    const res = await fetch(`${API_URL}/leave-requests/${id}/review`, {
      method: 'PATCH', headers, body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error)
      return
    }
    load()
  }

  const pending = requests.filter((r) => r.status === 'Pending')
  const reviewed = requests.filter((r) => r.status !== 'Pending')

  // For admin view, split pending into manager requests vs employee requests
  const pendingManagerRequests = isAdmin ? pending.filter((r) => r.employee?.isManager) : []
  const pendingEmployeeRequests = isAdmin ? pending.filter((r) => !r.employee?.isManager) : pending

  function PendingCard({ r }) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-theme-border p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start lg:items-center gap-3 flex-1 min-w-0">
          {/* Initials avatar */}
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 lg:mt-0">
            {r.employee?.initials || r.employee?.name?.slice(0, 2).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-on-surface text-sm">{r.employee?.name}</span>
              <span className="text-[10px] md:text-xs text-text-muted bg-surface-container px-1.5 py-0.5 rounded">{r.employee?.department}</span>
              {r.employee?.isManager && (
                <span className="text-[10px] md:text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Manager</span>
              )}
            </div>
            <div className="flex items-center gap-x-3 gap-y-1 text-[11px] md:text-xs text-text-muted flex-wrap">
              <span className="font-medium text-on-surface">{r.type}</span>
              <span className="font-mono">{r.startDate} — {r.endDate}</span>
              <span className="font-semibold text-on-surface">{r.days} day{r.days !== 1 ? 's' : ''}</span>
              {r.reason && <span className="truncate max-w-full lg:max-w-[200px] italic">{r.reason}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto shrink-0 pt-3 lg:pt-0 border-t border-neutral-500/20 lg:border-t-0">
          <button
            onClick={() => handleReview(r.id, 'Approved')}
            className="flex-1 lg:flex-none flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-white text-[11px] md:text-xs font-semibold hover:opacity-90 transition"
          >
            <span className="material-symbols-outlined text-[13px] md:text-[14px]">check</span>
            {t('attendance.approve')}
          </button>
          <button
            onClick={() => handleReview(r.id, 'Rejected')}
            className="flex-1 lg:flex-none flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-error text-error text-[11px] md:text-xs font-semibold hover:bg-error/10 transition"
          >
            <span className="material-symbols-outlined text-[13px] md:text-[14px]">close</span>
            {t('attendance.reject')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Manager requests section — admin only */}
      {isAdmin && pendingManagerRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-amber-500">admin_panel_settings</span>
            Manager Requests — Admin Approval Required ({pendingManagerRequests.length})
          </h3>
          <div className="space-y-3">
            {pendingManagerRequests.map((r) => <PendingCard key={r.id} r={r} />)}
          </div>
        </div>
      )}

      {/* Employee pending requests */}
      {pendingEmployeeRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-tertiary">pending_actions</span>
            {isAdmin ? 'Employee Requests — Pending Approval' : 'Pending Approval'} ({pendingEmployeeRequests.length})
          </h3>
          <div className="space-y-3">
            {pendingEmployeeRequests.map((r) => <PendingCard key={r.id} r={r} />)}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-text-muted mb-6">
          <span className="material-symbols-outlined text-4xl mb-2 opacity-40">task_alt</span>
          <p className="text-sm">No pending requests</p>
        </div>
      )}

      {/* All requests history table */}
      <h3 className="text-sm font-bold text-on-surface mb-3">All Requests</h3>
      {/* Mobile Card Layout */}
      <div className="xl:hidden flex flex-col divide-y divide-neutral-500/20 bg-surface-container-lowest border border-neutral-500/20 rounded-2xl overflow-hidden mb-6">
        {requests.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">No requests found</div>
        ) : requests.map((r) => (
          <div key={r.id} className="p-4 transition-colors hover:bg-hover-bg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-on-surface">{r.employee?.name}</span>
                {r.employee?.isManager && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Mgr</span>
                )}
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge[r.status] || ''}`}>
                {r.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-y-2 text-xs mb-3">
              <div>
                <p className="text-text-muted mb-0.5">{t('attendance.leaveType')}</p>
                <p className="font-medium text-on-surface">{r.type}</p>
              </div>
              <div>
                <p className="text-text-muted mb-0.5">Period</p>
                <p className="font-mono font-medium text-on-surface">{r.startDate} — {r.endDate}</p>
              </div>
              <div>
                <p className="text-text-muted mb-0.5">{t('attendance.days')}</p>
                <p className="font-semibold text-on-surface">{r.days} Days</p>
              </div>
              <div>
                <p className="text-text-muted mb-0.5">Reviewed By</p>
                <p className="font-medium text-on-surface">{r.reviewedBy || '—'}</p>
              </div>
            </div>
            
            {r.reason && (
              <div className="text-xs text-text-muted bg-surface-container/50 p-2 rounded">
                <span className="font-medium">Reason:</span> {r.reason}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden xl:block bg-surface-container-lowest rounded-2xl border border-theme-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-theme-border text-text-muted text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-semibold">{t('common.employee')}</th>
              <th className="text-left px-5 py-3 font-semibold">{t('attendance.leaveType')}</th>
              <th className="text-left px-5 py-3 font-semibold">Period</th>
              <th className="text-center px-5 py-3 font-semibold">{t('attendance.days')}</th>
              <th className="text-left px-5 py-3 font-semibold">Reason</th>
              <th className="text-left px-5 py-3 font-semibold">{t('common.status')}</th>
              <th className="text-left px-5 py-3 font-semibold">Reviewed By</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-text-muted">No requests found</td></tr>
            ) : requests.map((r) => (
              <tr key={r.id} className="border-b border-theme-border hover:bg-hover-bg transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-on-surface">{r.employee?.name}</span>
                    {r.employee?.isManager && (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Mgr</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-text-muted">{r.type}</td>
                <td className="px-5 py-3 font-mono text-xs text-on-surface">{r.startDate} — {r.endDate}</td>
                <td className="px-5 py-3 text-center font-semibold text-on-surface">{r.days}</td>
                <td className="px-5 py-3 text-text-muted text-xs max-w-[160px] truncate">{r.reason || '—'}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge[r.status] || ''}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-text-muted text-xs">{r.reviewedBy || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Attendance() {
  const { t } = useTranslation()
  const { user, token, isAdmin } = useAuth()
  const { employees } = useData()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(() => {
    if (searchParams.get('tab') === 'team') return 'team'
    if (searchParams.get('newRequest') === 'true') return 'leaves'
    return 'attendance'
  })

  // Match logged-in user to their linked employee record
  const myEmployee = user?.employeeId
    ? employees.find((e) => e.id === user.employeeId)
    : employees.find((e) => e.email && user?.email && e.email.toLowerCase() === user.email.toLowerCase())

  // Show Team Requests tab if admin, if employee is marked as manager, or if they have subordinates
  const hasSubordinates = myEmployee && (
    myEmployee.isManager ||
    employees.some((e) => e.supervisorId === myEmployee.id)
  )
  const showTeam = isAdmin || hasSubordinates

  const TABS = [
    { key: 'attendance', label: t('attendance.myTab'), icon: 'schedule' },
    { key: 'leaves', label: t('attendance.leaveTab'), icon: 'event_available' },
  ]

  const allTabs = showTeam
    ? [...TABS, { key: 'team', label: t('attendance.teamTab'), icon: 'group' }]
    : TABS

  return (
    <div className="p-3 md:p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-on-surface">{t('attendance.title')}</h1>
        <p className="text-[11px] md:text-sm text-text-muted mt-0.5">
          {myEmployee ? myEmployee.name : 'Personnel attendance & leave management'}
        </p>
      </div>

      {!myEmployee && (
        <div className="bg-tertiary-fixed/20 text-on-tertiary-fixed-variant rounded-xl px-4 py-3 md:px-5 md:py-4 mb-4 md:mb-6 text-[11px] md:text-sm flex items-start md:items-center gap-2 md:gap-3">
          <span className="material-symbols-outlined text-base shrink-0 mt-0.5 md:mt-0">info</span>
          <p>Your account email doesn't match any employee record. Ask an admin to link your email.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto overflow-y-hidden no-scrollbar gap-1 md:gap-2 mb-6 md:mb-8 border-b border-theme-border">
        {allTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 text-[11px] md:text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${tab === t.key
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-on-surface'
              }`}
          >
            <span className="material-symbols-outlined text-sm md:text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'attendance' && <MyAttendanceTab employeeId={myEmployee?.id} token={token} />}
      {tab === 'leaves' && <MyLeaveTab employeeId={myEmployee?.id} token={token} isManager={myEmployee?.isManager ?? false} autoOpen={searchParams.get('newRequest') === 'true'} />}
      {tab === 'team' && showTeam && <TeamRequestsTab employeeId={myEmployee?.id} token={token} isAdmin={isAdmin} />}
    </div>
  )
}
