import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'

const STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled']

const STATUS_STYLES = {
  'Scheduled':   { badge: 'status-scheduled-badge',   dot: 'status-scheduled-dot',              accent: 'status-scheduled-accent',  cardBg: 'bg-surface-container-lowest' },
  'In Progress': { badge: 'status-progress-badge',    dot: 'status-progress-dot animate-pulse', accent: 'status-progress-accent',   cardBg: 'status-progress-card' },
  'Completed':   { badge: 'status-completed-badge',   dot: 'status-completed-dot',              accent: 'status-completed-accent',  cardBg: 'bg-surface-container-lowest' },
  'Cancelled':   { badge: 'status-cancelled-badge',   dot: 'status-cancelled-dot',              accent: 'status-cancelled-accent',  cardBg: 'bg-surface-container-lowest' },
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtTime(t) {
  if (!t) return '—'
  return t
}

const inputCls = 'bg-transparent border-none outline-none text-xs md:text-sm text-on-surface w-full placeholder-slate-400'

function Field({ label, icon, children, span2 = false }) {
  return (
    <div className={span2 ? 'col-span-1 md:col-span-2' : ''}>
      <label className="block text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 md:mb-1.5">{label}</label>
      <div className="flex items-center gap-1.5 md:gap-2 bg-surface-container-high rounded-lg px-2.5 py-2 md:px-3 md:py-2.5 focus-within:ring-2 focus-within:ring-primary transition-all">
        <span className="material-symbols-outlined text-on-surface-variant text-[16px] md:text-[18px] flex-shrink-0">{icon}</span>
        {children}
      </div>
    </div>
  )
}

function FieldErr({ label, icon, error, children, span2 = false }) {
  return (
    <div className={span2 ? 'col-span-1 md:col-span-2' : ''}>
      <label className="block text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 md:mb-1.5">{label}</label>
      <div className={`flex items-center gap-1.5 md:gap-2 bg-surface-container-high rounded-lg px-2.5 py-2 md:px-3 md:py-2.5 transition-all ${error ? 'ring-2 ring-error' : 'focus-within:ring-2 focus-within:ring-primary'}`}>
        <span className="material-symbols-outlined text-on-surface-variant text-[16px] md:text-[18px] flex-shrink-0">{icon}</span>
        {children}
      </div>
      {error && <p className="text-[9px] md:text-[10px] text-error font-medium mt-1">{error}</p>}
    </div>
  )
}

function AddVisitModal({ customers, employees, onClose, onSave }) {
  const { t } = useTranslation()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ title: '', customerId: '', location: '', employeeId: '', date: today, time: '09:00', notes: '' })
  const [errors, setErrors] = useState({})
  const set = (f) => (e) => {
    const val = e.target.value
    if (f === 'customerId') {
      setForm((p) => ({ ...p, customerId: val, technicianId: '' }))
    } else {
      setForm((p) => ({ ...p, [f]: val }))
    }
  }

  function handleSave() {
    const e = {}
    if (!form.title.trim()) e.title = 'Required'
    if (!form.date)         e.date  = 'Required'
    if (Object.keys(e).length) { setErrors(e); return }
    const customerName = customers.find((c) => c.id === form.customerId)?.name   || ''
    const employeeName = employees.find((e) => e.id === form.employeeId)?.name   || ''
    const today = new Date().toISOString().split('T')[0]
    const status = form.date <= today ? 'In Progress' : 'Scheduled'
    onSave({ ...form, customerName, employeeName, status })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-3xl shadow-2xl shadow-inverse-surface/20 w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-5 pb-4 md:px-6 md:pt-6 md:pb-5 border-b border-surface-container-low">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 primary-gradient rounded-xl md:rounded-2xl flex items-center justify-center text-white">
              <span className="material-symbols-outlined fill-icon text-xl md:text-2xl">add_location_alt</span>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-on-surface">{t('workOrders.newVisit')}</h2>
              <p className="text-[10px] md:text-xs text-on-surface-variant">{t('workOrders.scheduleField')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 md:p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-xl md:text-2xl">close</span>
          </button>
        </div>

        <div className="px-4 md:px-6 py-4 md:py-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 overflow-y-auto max-h-[60vh]">
          <FieldErr label={t('workOrders.visitTitle')} icon="title" error={errors.title} span2>
            <input type="text" placeholder="e.g. HVAC Inspection" value={form.title} onChange={set('title')} className={inputCls} />
          </FieldErr>
          <Field label={t('common.customer')} icon="business" span2>
            <select value={form.customerId} onChange={set('customerId')} className={inputCls}>
              <option value="">{t('common.noCustomer')}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t('common.location')} icon="location_on" span2>
            <input type="text" placeholder="e.g. Building A" value={form.location} onChange={set('location')} className={inputCls} />
          </Field>
          <Field label={t('common.employee')} icon="badge" span2>
            <select value={form.employeeId} onChange={set('employeeId')} className={inputCls}>
              <option value="">{t('common.unassigned')}</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <FieldErr label={t('common.date')} icon="calendar_today" error={errors.date}>
            <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
          </FieldErr>
          <Field label={t('workOrders.time')} icon="schedule">
            <input type="time" value={form.time} onChange={set('time')} className={inputCls} />
          </Field>
          <div className="col-span-1 md:col-span-2">
            <label className="block text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 md:mb-1.5">{t('common.notes')}</label>
            <div className="flex items-start gap-1.5 md:gap-2 bg-surface-container-high rounded-lg px-2.5 py-2 md:px-3 md:py-2.5 focus-within:ring-2 focus-within:ring-primary transition-all">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px] md:text-[18px] flex-shrink-0 mt-0.5">notes</span>
              <textarea rows={3} placeholder="Optional notes…" value={form.notes} onChange={set('notes')} className={`${inputCls} resize-none`} />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 px-4 md:px-6 pb-4 md:pb-6 pt-2">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-1.5 md:px-5 md:py-2.5 rounded-lg md:rounded-xl text-on-surface-variant text-xs md:text-sm font-semibold hover:bg-surface-container-low transition-colors">{t('common.cancel')}</button>
          <button onClick={handleSave} className="w-full sm:w-auto px-4 py-1.5 md:px-6 md:py-2.5 rounded-lg md:rounded-xl primary-gradient text-white text-xs md:text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5 md:gap-2">
            <span className="material-symbols-outlined text-[14px] md:text-[18px]">save</span>
            {t('workOrders.scheduleVisit')}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 md:gap-4 py-3 md:py-4 border-b border-surface-container-low last:border-0">
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-surface-container-low flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-on-surface-variant text-[18px] md:text-[24px]">{icon}</span>
      </div>
      <div>
        <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
        <p className="text-xs md:text-sm font-semibold text-on-surface mt-0.5">{value || '—'}</p>
      </div>
    </div>
  )
}

const STATUS_CHANGE_STYLES = {
  'Scheduled':   'border-blue-400 text-blue-600 bg-blue-50 hover:bg-blue-100',
  'In Progress': 'border-amber-400 text-amber-600 bg-amber-50 hover:bg-amber-100',
  'Completed':   'border-emerald-400 text-emerald-600 bg-emerald-50 hover:bg-emerald-100',
  'Cancelled':   'border-red-400 text-red-600 bg-red-50 hover:bg-red-100',
}
const STATUS_CHANGE_ACTIVE = {
  'Scheduled':   'border-blue-500 bg-blue-500 text-white',
  'In Progress': 'border-amber-500 bg-amber-500 text-white',
  'Completed':   'border-emerald-500 bg-emerald-500 text-white',
  'Cancelled':   'border-red-500 bg-red-500 text-white',
}

export function VisitDetailModal({ visit, customers, employees, onClose, onSave, onDelete }) {
  const { t } = useTranslation()
  const { isAdmin } = useData()
  const { user } = useAuth()
  const canChangeStatus = isAdmin || user?.department === 'Sales'

  const [editing, setEditing]       = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [showStatusPanel, setShowStatusPanel] = useState(false)
  const [pendingStatus, setPendingStatus]     = useState(visit.status)
  const [cancelNote, setCancelNote]           = useState('')
  const [cancelNoteError, setCancelNoteError] = useState(false)

  const [form, setForm] = useState({
    title:      visit.title,
    customerId: visit.customerId || '',
    location:   visit.location   || '',
    employeeId: visit.employeeId || '',
    date:       visit.date,
    time:       visit.time,
    status:     visit.status,
    notes:      visit.notes      || '',
  })
  const [errors, setErrors] = useState({})
  const set = (f) => (e) => {
    const val = e.target.value
    if (f === 'date') {
      const today = new Date().toISOString().split('T')[0]
      const autoStatus = val <= today ? 'In Progress' : 'Scheduled'
      setForm((p) => ({ ...p, date: val, status: autoStatus }))
      return
    }
    if (f === 'status' && val === 'Completed') {
      setConfirmComplete(true)
      return
    }
    setForm((p) => ({ ...p, [f]: val }))
  }

  function handleSave() {
    const e = {}
    if (!form.title.trim()) e.title = 'Required'
    if (!form.date)         e.date  = 'Required'
    if (Object.keys(e).length) { setErrors(e); return }
    const customerName = customers.find((c) => c.id === form.customerId)?.name  || visit.customerName || ''
    const employeeName = employees.find((e) => e.id === form.employeeId)?.name  || visit.employeeName || ''
    onSave(visit.id, { ...form, customerName, employeeName })
  }

  function handleCancel() {
    setForm({ title: visit.title, customerId: visit.customerId || '', location: visit.location || '', employeeId: visit.employeeId || '', date: visit.date, time: visit.time, status: visit.status, notes: visit.notes || '' })
    setErrors({})
    setEditing(false)
  }

  function handleStatusChange() {
    if (pendingStatus === 'Cancelled' && !cancelNote.trim()) {
      setCancelNoteError(true)
      return
    }
    const customerName = customers.find((c) => c.id === visit.customerId)?.name || visit.customerName || ''
    const employeeName = employees.find((e) => e.id === visit.employeeId)?.name || visit.employeeName || ''
    onSave(visit.id, {
      title: visit.title, customerId: visit.customerId || '', location: visit.location || '',
      employeeId: visit.employeeId || '', date: visit.date, time: visit.time, notes: visit.notes || '',
      customerName, employeeName,
      status: pendingStatus,
      cancelledReason: pendingStatus === 'Cancelled' ? cancelNote.trim() : (visit.cancelledReason || ''),
    })
  }

  const st = STATUS_STYLES[visit.status] ?? STATUS_STYLES['Scheduled']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-3xl shadow-2xl shadow-inverse-surface/20 w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">

        {/* Banner */}
        <div className="primary-gradient px-4 pt-5 pb-4 md:px-6 md:pt-5 md:pb-4 flex-shrink-0 rounded-t-3xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-surface-container-lowest/20 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-white text-[18px] md:text-[24px]">location_on</span>
              </div>
              <div>
                <h2 className="text-base md:text-lg font-extrabold text-white leading-tight">
                  {editing ? t('workOrders.editVisit') : visit.title}
                </h2>
                <p className="text-blue-200 text-[10px] md:text-xs font-mono mt-0.5">#{visit.id}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 md:p-2 rounded-xl text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors flex-shrink-0">
              <span className="material-symbols-outlined text-xl md:text-2xl">close</span>
            </button>
          </div>
          {!editing && (
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-3 md:mt-4">
              <span className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[9px] md:text-[11px] font-bold inline-flex items-center gap-1 md:gap-1.5 bg-surface-container-lowest/20 text-white`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                {visit.status}
              </span>
              <span className="bg-surface-container-lowest/15 text-white text-[9px] md:text-[11px] font-semibold px-2 py-1 md:px-3 md:py-1.5 rounded-lg flex items-center gap-1 md:gap-1.5">
                <span className="material-symbols-outlined text-[12px] md:text-[14px]">calendar_today</span>
                {fmtDate(visit.date)}
              </span>
              {visit.time && (
                <span className="bg-surface-container-lowest/15 text-white text-[9px] md:text-[11px] font-semibold px-2 py-1 md:px-3 md:py-1.5 rounded-lg flex items-center gap-1 md:gap-1.5">
                  <span className="material-symbols-outlined text-[12px] md:text-[14px]">schedule</span>
                  {fmtTime(visit.time)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* View */}
        {!editing && (
          <div className="px-4 md:px-6 py-2 md:py-4 overflow-y-auto flex-1">
            <DetailRow icon="business"      label={t('common.customer')}    value={visit.customerName} />
            <DetailRow icon="location_on"   label={t('common.location')}    value={visit.location} />
            <DetailRow icon="badge"         label={t('common.employee')}    value={visit.employeeName} />
            {visit.notes && <DetailRow icon="notes" label={t('common.notes')} value={visit.notes} />}
            {visit.status === 'Cancelled' && visit.cancelledReason && (
              <DetailRow icon="cancel" label={t('workOrders.cancelReason')} value={visit.cancelledReason} />
            )}
          </div>
        )}

        {/* Edit */}
        {editing && (
          <div className="px-4 md:px-6 py-4 md:py-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 overflow-y-auto flex-1">
            <FieldErr label={t('workOrders.visitTitle')} icon="title" error={errors.title} span2>
              <input type="text" value={form.title} onChange={set('title')} className={inputCls} />
            </FieldErr>
            <Field label={t('common.customer')} icon="business" span2>
              <select value={form.customerId} onChange={set('customerId')} className={inputCls}>
                <option value="">{t('common.noCustomer')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label={t('common.location')} icon="location_on" span2>
              <input type="text" value={form.location} onChange={set('location')} className={inputCls} />
            </Field>
            <Field label={t('common.employee')} icon="badge">
              <select value={form.employeeId} onChange={set('employeeId')} className={inputCls}>
                <option value="">{t('common.unassigned')}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <Field label={t('common.status')} icon="flag">
              <select value={form.status} onChange={set('status')} className={inputCls}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <FieldErr label={t('common.date')} icon="calendar_today" error={errors.date}>
              <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
            </FieldErr>
            <Field label={t('workOrders.time')} icon="schedule">
              <input type="time" value={form.time} onChange={set('time')} className={inputCls} />
            </Field>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 md:mb-1.5">{t('common.notes')}</label>
              <div className="flex items-start gap-1.5 md:gap-2 bg-surface-container-high rounded-lg px-2.5 py-2 md:px-3 md:py-2.5 focus-within:ring-2 focus-within:ring-primary transition-all">
                <span className="material-symbols-outlined text-on-surface-variant text-[16px] md:text-[18px] flex-shrink-0 mt-0.5">notes</span>
                <textarea rows={3} value={form.notes} onChange={set('notes')} className={`${inputCls} resize-none`} />
              </div>
            </div>
          </div>
        )}

        {/* Status change panel */}
        {!editing && showStatusPanel && (
          <div className="mx-4 md:mx-6 mb-4 p-4 md:p-5 bg-surface-container-low rounded-2xl space-y-4 flex-shrink-0 border border-outline-variant/30">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('workOrders.changeStatus')}</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setPendingStatus(s); setCancelNoteError(false) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                    pendingStatus === s ? STATUS_CHANGE_ACTIVE[s] : STATUS_CHANGE_STYLES[s]
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {pendingStatus === 'Cancelled' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  {t('workOrders.cancelReason')} <span className="text-error">*</span>
                </label>
                <textarea
                  autoFocus
                  rows={3}
                  value={cancelNote}
                  onChange={(e) => { setCancelNote(e.target.value); setCancelNoteError(false) }}
                  placeholder="Explain why this visit is being cancelled…"
                  className={`w-full bg-surface-container-lowest border rounded-lg px-3 py-2 text-sm text-on-surface resize-none outline-none transition-all ${
                    cancelNoteError ? 'border-error ring-2 ring-error/20' : 'border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20'
                  }`}
                />
                {cancelNoteError && (
                  <p className="text-[11px] text-error font-medium mt-1">{t('workOrders.cancelRequired')}</p>
                )}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setShowStatusPanel(false); setPendingStatus(visit.status); setCancelNote(''); setCancelNoteError(false) }}
                className="px-4 py-2 rounded-lg text-on-surface-variant text-xs font-bold hover:bg-surface-container-high transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleStatusChange}
                disabled={pendingStatus === visit.status}
                className="px-4 py-2 rounded-lg primary-gradient text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">check</span>
                {t('common.apply')}
              </button>
            </div>
          </div>
        )}

        {/* Confirm complete */}
        {confirmComplete && (
          <div className="mx-4 md:mx-6 mb-4 px-4 py-3 md:px-5 md:py-4 bg-emerald-50 rounded-2xl flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4 flex-shrink-0 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <span className="material-symbols-outlined text-emerald-700">check_circle</span>
              <div>
                <p className="text-sm font-bold text-emerald-800">{t('workOrders.markCompleted')}</p>
                <p className="text-[10px] md:text-xs text-emerald-700/70 mt-0.5">{t('workOrders.confirmComplete')}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setConfirmComplete(false)} className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-emerald-800 text-[10px] md:text-xs font-bold hover:bg-emerald-100 transition-colors">{t('common.cancel')}</button>
              <button onClick={() => { setForm((p) => ({ ...p, status: 'Completed' })); setConfirmComplete(false) }} className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl bg-emerald-600 text-white text-[10px] md:text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">check</span>
                {t('workOrders.yesComplete')}
              </button>
            </div>
          </div>
        )}

        {/* Confirm delete */}
        {isAdmin && confirming && (
          <div className="mx-4 md:mx-6 mb-4 px-4 py-3 md:px-5 md:py-4 bg-error-container rounded-2xl flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4 flex-shrink-0 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <span className="material-symbols-outlined text-on-error-container">warning</span>
              <div>
                <p className="text-sm font-bold text-on-error-container">{t('workOrders.deleteVisit')}</p>
                <p className="text-[10px] md:text-xs text-on-error-container/70 mt-0.5">{t('common.cantUndo')}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setConfirming(false)} className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-on-error-container text-[10px] md:text-xs font-bold hover:bg-error-container/60 transition-colors">{t('common.cancel')}</button>
              <button onClick={() => onDelete(visit.id)} className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl bg-error text-white text-[10px] md:text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">delete</span>
                {t('common.yesDelete')}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 md:px-6 pb-4 pt-3 md:pb-6 md:pt-4 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0 border-t border-surface-container-low">
          {!editing ? (
            <>
              <div className="flex items-center gap-1.5 md:gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                <button onClick={() => setEditing(true)} className="whitespace-nowrap flex-shrink-0 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border-2 border-primary text-primary text-[11px] md:text-sm font-bold hover:bg-primary hover:text-white transition-all flex items-center gap-1 md:gap-1.5">
                  <span className="material-symbols-outlined text-[14px] md:text-[18px]">edit</span>{t('common.edit')}
                </button>
                {canChangeStatus && (
                  <button
                    onClick={() => { setShowStatusPanel((v) => !v); setPendingStatus(visit.status); setCancelNote(''); setCancelNoteError(false) }}
                    className={`whitespace-nowrap flex-shrink-0 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border-2 text-[11px] md:text-sm font-bold transition-all flex items-center gap-1 md:gap-1.5 ${showStatusPanel ? 'border-secondary bg-secondary text-white' : 'border-secondary text-secondary hover:bg-secondary hover:text-white'}`}
                  >
                    <span className="material-symbols-outlined text-[14px] md:text-[18px]">flag</span>{t('common.status')}
                  </button>
                )}
                {isAdmin && (
                <button
                  onClick={() => setConfirming((v) => !v)}
                  className={`whitespace-nowrap flex-shrink-0 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border-2 text-[11px] md:text-sm font-bold transition-all flex items-center gap-1 md:gap-1.5 ${confirming ? 'border-error bg-error text-white' : 'border-error text-error hover:bg-error hover:text-white'}`}
                >
                  <span className="material-symbols-outlined text-[14px] md:text-[18px]">delete</span>{t('common.delete')}
                </button>
                )}
              </div>
              <button onClick={onClose} className="w-full sm:w-auto px-4 py-1.5 md:px-6 md:py-2 rounded-lg md:rounded-xl primary-gradient text-white text-xs md:text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity">{t('common.close')}</button>
            </>
          ) : (
            <>
              <button onClick={handleCancel} className="w-full sm:w-auto px-4 py-1.5 md:px-5 md:py-2 rounded-lg md:rounded-xl text-on-surface-variant text-xs md:text-sm font-semibold hover:bg-surface-container-low transition-colors">{t('common.cancel')}</button>
              <button onClick={handleSave} className="w-full sm:w-auto px-4 py-1.5 md:px-6 md:py-2 rounded-lg md:rounded-xl primary-gradient text-white text-xs md:text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5 md:gap-2">
                <span className="material-symbols-outlined text-[14px] md:text-[18px]">save</span>{t('common.saveChanges')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function VisitCard({ visit, onClick }) {
  const { t } = useTranslation()
  const st = STATUS_STYLES[visit.status] ?? STATUS_STYLES['Scheduled']
  const isToday = visit.date === new Date().toISOString().split('T')[0]

  return (
    <div
      onClick={onClick}
      className={`${st.cardBg} rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg hover:shadow-inverse-surface/10 hover:-translate-y-0.5 transition-all border-l-4 ${st.accent}`}
    >
      {/* Card top — date bar */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
            {isToday ? t('workOrders.today') : fmtDate(visit.date)}
          </span>
          {visit.time && (
            <span className="text-xs font-bold text-on-surface mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-on-surface-variant">schedule</span>
              {fmtTime(visit.time)}
            </span>
          )}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1.5 ${st.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
          {visit.status}
        </span>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-surface-container-low" />

      {/* Card body */}
      <div className="px-5 py-4 space-y-3 min-w-0">
        <h3 className="font-bold text-on-surface text-base leading-snug break-words">{visit.title}</h3>

        {visit.customerName && (
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">business</span>
            <span className="font-medium truncate">{visit.customerName}</span>
          </div>
        )}

        {visit.location && (
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">location_on</span>
            <span className="truncate">{visit.location}</span>
          </div>
        )}
      </div>

      {/* Card footer — employee */}
      <div className="px-5 pb-5 flex items-center justify-between">
        {visit.employeeName ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full primary-gradient flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {visit.employeeName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </div>
            <span className="text-xs font-semibold text-on-surface-variant">{visit.employeeName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-on-surface-variant/50">
            <span className="material-symbols-outlined text-[16px]">person_off</span>
            <span className="text-xs font-medium italic">{t('common.unassigned')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SiteVisits() {
  const { t } = useTranslation()
  const { customers, employees, siteVisits, addSiteVisit, updateSiteVisit, deleteSiteVisit } = useData()
  const [showModal, setShowModal]     = useState(false)
  const [selected, setSelected]       = useState(null)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const today = new Date().toISOString().split('T')[0]

  function handleExport() {
    const rows = siteVisits.map((v) => ({
      Title: v.title || '',
      Status: v.status || '',
      Date: v.date || '',
      Time: v.time || '',
      Customer: v.customerName || '',
      Employee: v.employeeName || '',
      Location: v.location || '',
      Notes: v.notes || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Site Visits')
    XLSX.writeFile(wb, 'site_visits.xlsx')
  }

  const stats = [
    { label: t('workOrders.totalVisits'),  value: siteVisits.length,                                                icon: 'location_on',   color: 'bg-surface-tint'   },
    { label: t('workOrders.scheduled'),    value: siteVisits.filter((v) => v.status === 'Scheduled').length,        icon: 'calendar_today', color: 'bg-blue-400'       },
    { label: t('workOrders.inProgress'),   value: siteVisits.filter((v) => v.status === 'In Progress').length,      icon: 'pending',       color: 'bg-amber-400'      },
    { label: t('workOrders.completed'),    value: siteVisits.filter((v) => v.status === 'Completed').length,        icon: 'check_circle',  color: 'bg-emerald-400'    },
    { label: t('workOrders.cancelled'),    value: siteVisits.filter((v) => v.status === 'Cancelled').length,        icon: 'cancel',        color: 'bg-red-400'        },
  ]

  const q = search.toLowerCase()
  const filtered = siteVisits.filter((v) => {
    const matchSearch = !q ||
      v.title?.toLowerCase().includes(q) ||
      v.customerName?.toLowerCase().includes(q) ||
      v.location?.toLowerCase().includes(q) ||
      v.employeeName?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || v.status === statusFilter
    return matchSearch && matchStatus
  })

  const STATUS_ORDER = { 'In Progress': 0, 'Scheduled': 1, 'Completed': 2, 'Cancelled': 3 }
  const sorted = [...filtered].sort((a, b) => {
    const orderDiff = (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1)
    if (orderDiff !== 0) return orderDiff
    if (a.date < b.date) return -1
    if (a.date > b.date) return 1
    return (a.time || '').localeCompare(b.time || '')
  })

  return (
    <div className="p-4 md:p-6 lg:p-8 pb-24 min-h-screen bg-page-bg">
      {showModal && (
        <AddVisitModal
          customers={customers}
          employees={employees}
          onClose={() => setShowModal(false)}
          onSave={(form) => { addSiteVisit(form); setShowModal(false) }}
        />
      )}
      {selected && (
        <VisitDetailModal
          visit={selected}
          customers={customers}
          employees={employees}
          onClose={() => setSelected(null)}
          onSave={(id, form) => { updateSiteVisit(id, form); setSelected(null) }}
          onDelete={(id) => { deleteSiteVisit(id); setSelected(null) }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-on-surface mb-1 md:mb-2">{t('workOrders.title')}</h1>
          <p className="text-on-surface-variant text-xs md:text-sm lg:text-base">
            {t('workOrders.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="primary-gradient text-white px-4 lg:px-6 py-2 lg:py-2.5 rounded-lg lg:rounded-xl font-bold text-xs lg:text-sm shadow-xl shadow-primary/20 flex items-center gap-1.5 lg:gap-2 hover:opacity-90 hover:scale-[1.02] transition-all self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[18px] lg:text-[24px]">add_location_alt</span>
          {t('workOrders.scheduleVisit')}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4 mb-8">
        {stats.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-surface-container-lowest rounded-xl xl:rounded-2xl p-3 md:p-4 xl:p-5 flex items-center gap-2 md:gap-3 xl:gap-4 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
            <div className="w-8 h-8 md:w-9 md:h-9 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px] md:text-[18px] xl:text-[20px]">{icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg md:text-xl xl:text-2xl font-black text-on-surface leading-none truncate">{value}</p>
              <p className="text-[9px] xl:text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mt-0.5 xl:mt-1 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Section */}
      <div className="flex flex-col gap-3 lg:gap-4 mb-6 lg:mb-8">
        {/* Top Row: Search and Export */}
        <div className="flex items-center justify-between gap-2 lg:gap-3">
          {/* Search */}
          <div className="flex items-center gap-1.5 lg:gap-2 bg-surface-container-low px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg lg:rounded-xl flex-1 max-w-sm">
            <span className="material-symbols-outlined text-on-surface-variant text-base lg:text-lg">search</span>
            <input
              type="text"
              placeholder={t('workOrders.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-xs lg:text-sm w-full placeholder-slate-400"
            />
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="primary-gradient text-white px-4 lg:px-6 py-2 lg:py-2.5 rounded-lg lg:rounded-xl font-bold text-xs lg:text-sm shadow-xl shadow-primary/20 flex items-center gap-1.5 lg:gap-2 hover:opacity-90 hover:scale-[1.02] transition-all flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px] lg:text-[24px]">download</span>
            <span className="hidden sm:inline">{t('common.export')}</span>
          </button>
        </div>

        {/* Bottom Row: Status Filters */}
        <div className="flex items-center gap-1.5 lg:gap-2 overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full pb-1">
          {['', ...STATUSES].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap flex-shrink-0 px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-bold border-2 transition-all ${
                statusFilter === s
                  ? 'primary-gradient border-transparent text-white'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
              }`}
            >
              {s || t('common.all')}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 md:py-24 text-on-surface-variant/40 text-center px-4">
          <span className="material-symbols-outlined text-4xl md:text-5xl mb-3">location_off</span>
          <p className="text-base md:text-lg font-bold">{t('workOrders.noVisits')}</p>
          <p className="text-xs md:text-sm mt-1">{t('workOrders.scheduleFirst')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {sorted.map((visit) => (
            <VisitCard key={visit.id} visit={visit} onClick={() => setSelected(visit)} />
          ))}
        </div>
      )}
    </div>
  )
}
