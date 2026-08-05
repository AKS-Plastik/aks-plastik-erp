import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import * as XLSX from 'xlsx'

const COLUMNS = [
  { id: 'open',        labelKey: 'reports.colOpen',       icon: 'radio_button_unchecked', headerClass: 'bg-surface-container-high text-on-surface-variant', dotClass: 'bg-on-surface-variant/40' },
  { id: 'review',      labelKey: 'reports.colReview',     icon: 'rate_review',            headerClass: 'status-scheduled-badge', dotClass: 'status-scheduled-dot' },
  { id: 'in-progress', labelKey: 'reports.colInProgress', icon: 'pending',                headerClass: 'status-progress-badge',  dotClass: 'status-progress-dot'  },
  { id: 'completed',   labelKey: 'reports.colCompleted',  icon: 'check_circle',           headerClass: 'status-completed-badge', dotClass: 'status-completed-dot' },
  { id: 'cancelled',   labelKey: 'reports.colCancelled',  icon: 'cancel',                 headerClass: 'bg-error text-white',     dotClass: 'bg-white/40' },
]

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

const PRIORITY_STYLES = {
  Low:      'priority-low',
  Medium:   'priority-medium',
  High:     'priority-high',
  Critical: 'priority-critical',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Field({ label, icon, error, align = 'center', children }) {
  return (
    <div>
      <label className="block text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
        {label}
      </label>
      <div className={`flex ${align === 'start' ? 'items-start' : 'items-center'} gap-1.5 bg-surface-container-high rounded-lg px-2.5 py-1.5 transition-all ${
        error ? 'ring-2 ring-error' : 'focus-within:ring-2 focus-within:ring-primary'
      }`}>
        <span className={`material-symbols-outlined text-on-surface-variant text-[16px] flex-shrink-0 ${align === 'start' ? 'mt-0.5' : ''}`}>{icon}</span>
        {children}
      </div>
      {error && <p className="text-[9px] text-error font-medium mt-0.5">{error}</p>}
    </div>
  )
}

const inputCls = 'bg-transparent border-none outline-none text-xs text-on-surface w-full placeholder-slate-400'

function AddCardModal({ defaultColumn, customers, employees, onClose, onSave }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    title: '', description: '', priority: 'Low',
    column: 'open', customerId: '', employeeId: '', dueDate: '',
  })
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
    if (!form.title.trim()) { setErrors({ title: 'Required' }); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-3xl shadow-2xl shadow-inverse-surface/20 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 md:px-5 md:pt-5 md:pb-4 border-b border-surface-container-low">
          <div className="flex items-center gap-2.5 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 primary-gradient rounded-lg md:rounded-xl flex items-center justify-center text-white flex-shrink-0">
              <span className="material-symbols-outlined fill-icon text-lg md:text-xl">add_card</span>
            </div>
            <div>
              <h2 className="text-sm md:text-base font-extrabold text-on-surface">{t('reports.newReport')}</h2>
              <p className="text-[9px] md:text-[10px] text-on-surface-variant">{t('reports.addCardBoard')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 md:p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-lg md:text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-4 md:px-5 py-3 md:py-4 grid grid-cols-2 gap-3 md:gap-4 max-h-[60vh] overflow-y-auto">
          <div className="col-span-2">
            <Field label={t('common.title')} icon="title" error={errors.title}>
              <input type="text" placeholder={t('reports.reportTitle')} value={form.title} onChange={set('title')} className={inputCls} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label={t('common.description')} icon="description" align="start">
              <textarea rows={3} placeholder="Optional description…" value={form.description} onChange={set('description')} className={`${inputCls} resize-none`} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label={t('common.priority')} icon="flag">
              <select value={form.priority} onChange={set('priority')} className={inputCls}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t('common.customer')} icon="business">
            <select value={form.customerId} onChange={set('customerId')} className={inputCls}>
              <option value="">{t('common.noCustomer')}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t('common.employee')} icon="badge">
            <select value={form.employeeId} onChange={set('employeeId')} className={inputCls}>
              <option value="">{t('common.unassigned')}</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label={t('common.dueDate')} icon="event">
              <input type="date" value={form.dueDate} onChange={set('dueDate')} className={inputCls} />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 md:gap-3 px-4 pb-4 md:px-5 md:pb-5">
          <button onClick={onClose} className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-on-surface-variant text-xs md:text-sm font-semibold hover:bg-surface-container-low transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} className="px-4 py-1.5 md:px-5 md:py-2 rounded-lg primary-gradient text-white text-xs md:text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] md:text-base">save</span>
            {t('reports.addCard')}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 md:py-3 border-b border-surface-container-low last:border-0">
      <div className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="material-symbols-outlined text-on-surface-variant text-[16px]">{icon}</span>
      </div>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
        <p className="text-xs md:text-sm font-semibold text-on-surface mt-0.5">{value || '—'}</p>
      </div>
    </div>
  )
}

function CardDetailModal({ report, customers, employees, onClose, onSave, onDelete }) {
  const { t } = useTranslation()
  const { isAdmin } = useData()
  const [editing, setEditing]       = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [form, setForm] = useState({
    title:       report.title,
    description: report.description || '',
    priority:    report.priority,
    column:      report.column,
    customerId:  report.customerId  || '',
    employeeId:  report.employeeId  || '',
    dueDate:     report.dueDate ? report.dueDate.slice(0, 10) : '',
  })
  const [errors, setErrors] = useState({})
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  function handleSave() {
    if (!form.title.trim()) { setErrors({ title: 'Required' }); return }
    onSave(report.id, form)
  }

  function handleCancel() {
    setForm({
      title:       report.title,
      description: report.description || '',
      priority:    report.priority,
      column:      report.column,
      customerId:  report.customerId  || '',
      employeeId:  report.employeeId  || '',
      dueDate:     report.dueDate ? report.dueDate.slice(0, 10) : '',
    })
    setErrors({})
    setEditing(false)
  }

  const col = COLUMNS.find((c) => c.id === report.column) ?? COLUMNS[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-3xl shadow-2xl shadow-inverse-surface/20 w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">

        {/* Header banner */}
        <div className="primary-gradient px-4 pt-4 pb-3 md:px-5 md:pt-5 md:pb-3 flex-shrink-0 rounded-t-3xl">
          <div className="flex items-start justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-surface-container-lowest/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-white text-[16px] md:text-[20px]">description</span>
              </div>
              <div>
                <h2 className="text-sm md:text-base font-extrabold text-white leading-tight">
                  {editing ? t('reports.editReport') : report.title}
                </h2>
                <p className="text-blue-200 text-[9px] md:text-[10px] font-mono mt-0.5">#{report.id}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 md:p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors flex-shrink-0">
              <span className="material-symbols-outlined text-lg md:text-xl">close</span>
            </button>
          </div>

          {!editing && (
            <div className="flex items-center gap-1.5 md:gap-2 mt-2.5 md:mt-3">
              <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-md text-[9px] md:text-[10px] font-black uppercase ${PRIORITY_STYLES[report.priority]} bg-opacity-80`}>
                {report.priority}
              </span>
              <span className="bg-surface-container-lowest/15 text-white text-[9px] md:text-[10px] font-semibold px-2 py-0.5 md:px-2.5 md:py-1 rounded-md flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] md:text-[14px]">{col.icon}</span>
                {t(col.labelKey)}
              </span>
            </div>
          )}
        </div>

        {/* View mode */}
        {!editing && (
          <div className="px-4 md:px-6 py-4 overflow-y-auto flex-1">
            {report.description && (
              <DetailRow icon="description" label={t('common.description')} value={report.description} />
            )}
            <DetailRow icon="business"     label={t('common.customer')}    value={report.customer?.name} />
            <DetailRow icon="badge"        label={t('common.employee')}    value={report.employee?.name} />
            <DetailRow icon="event"        label={t('common.dueDate')}     value={report.dueDate ? fmtDate(report.dueDate) : '—'} />
            <DetailRow icon="calendar_today" label={t('common.created')}   value={fmtDate(report.createdAt)} />
          </div>
        )}

        {/* Edit mode */}
        {editing && (
          <div className="px-4 md:px-5 py-3 md:py-4 grid grid-cols-2 gap-3 md:gap-4 overflow-y-auto flex-1">
            <div className="col-span-2">
              <Field label={t('common.title')} icon="title" error={errors.title}>
                <input type="text" value={form.title} onChange={set('title')} className={inputCls} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label={t('common.description')} icon="description" align="start">
                <textarea rows={3} value={form.description} onChange={set('description')} className={`${inputCls} resize-none`} />
              </Field>
            </div>
            <Field label={t('common.priority')} icon="flag">
              <select value={form.priority} onChange={set('priority')} className={inputCls}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label={t('reports.column')} icon="view_kanban">
              <select value={form.column} onChange={set('column')} className={inputCls}>
                {COLUMNS.map((c) => <option key={c.id} value={c.id}>{t(c.labelKey)}</option>)}
              </select>
            </Field>
            <Field label={t('common.customer')} icon="business">
              <select value={form.customerId} onChange={set('customerId')} className={inputCls}>
                <option value="">{t('common.noCustomer')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label={t('common.employee')} icon="badge">
              <select value={form.employeeId} onChange={set('employeeId')} className={inputCls}>
                <option value="">{t('common.unassigned')}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label={t('common.dueDate')} icon="event">
                <input type="date" value={form.dueDate} onChange={set('dueDate')} className={inputCls} />
              </Field>
            </div>
          </div>
        )}

        {/* Delete confirmation bar */}
        {isAdmin && confirming && (
          <div className="mx-8 mb-4 px-5 py-4 bg-error-container rounded-2xl flex items-center justify-between gap-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-error-container">warning</span>
              <div>
                <p className="text-sm font-bold text-on-error-container">{t('reports.deleteReport')}</p>
                <p className="text-xs text-on-error-container/70 mt-0.5">{t('common.cantUndo')}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setConfirming(false)} className="px-4 py-2 rounded-xl text-on-error-container text-xs font-bold hover:bg-error-container/60 transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={() => onDelete(report.id)} className="px-4 py-2 rounded-xl bg-error text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">delete</span>
                {t('common.yesDelete')}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 md:px-6 pb-4 pt-3 md:pb-6 md:pt-4 flex items-center justify-between flex-shrink-0 border-t border-surface-container-low">
          {!editing ? (
            <>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(true)} className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border-2 border-primary text-primary text-xs md:text-sm font-bold hover:bg-primary hover:text-white transition-all flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] md:text-[18px]">edit</span>
                  <span className="hidden md:inline">{t('common.edit')}</span>
                </button>
                {isAdmin && (
                <button
                  onClick={() => setConfirming((v) => !v)}
                  className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border-2 text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 ${
                    confirming ? 'border-error bg-error text-white' : 'border-error text-error hover:bg-error hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px] md:text-[18px]">delete</span>
                  <span className="hidden md:inline">{t('common.delete')}</span>
                </button>
                )}
              </div>
              <button onClick={onClose} className="px-4 py-1.5 md:px-6 md:py-2 rounded-lg md:rounded-xl primary-gradient text-white text-xs md:text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity">
                {t('common.close')}
              </button>
            </>
          ) : (
            <>
              <button onClick={handleCancel} className="px-3 py-1.5 md:px-5 md:py-2 rounded-lg md:rounded-xl text-on-surface-variant text-xs md:text-sm font-semibold hover:bg-surface-container-low transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleSave} className="px-4 py-1.5 md:px-6 md:py-2 rounded-lg md:rounded-xl primary-gradient text-white text-xs md:text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 md:gap-2">
                <span className="material-symbols-outlined text-[14px] md:text-[18px]">save</span>
                {t('common.saveChanges')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function KanbanCard({ report, onClick }) {
  const { t } = useTranslation()
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('reportId', report.id)}
      onClick={onClick}
      className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-primary/20 active:scale-[0.98] transition-all select-none"
    >
      <p className="text-sm font-bold text-on-surface leading-snug mb-2">{report.title}</p>

      <div className="mb-3">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${PRIORITY_STYLES[report.priority]}`}>
          {report.priority}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant">
        <div className="flex items-center gap-1 min-w-0">
          <span className="material-symbols-outlined text-[13px] flex-shrink-0">business</span>
          <span className="truncate">{report.customer?.name || t('common.noCustomer')}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="material-symbols-outlined text-[13px]">badge</span>
          <span>{report.employee?.name || t('common.unassigned')}</span>
        </div>
      </div>

      <p className="text-[10px] text-on-surface-variant/50 mt-1 font-medium">{t('reports.createdAt')} {fmtDate(report.createdAt)}</p>
      {report.dueDate && report.column !== 'cancelled' && (() => {
        const overdue = new Date(report.dueDate) < new Date(new Date().toDateString())
        return (
          <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${overdue ? 'text-error' : 'text-on-surface-variant'}`}>
            <span className="material-symbols-outlined text-[12px]">{overdue ? 'warning' : 'event'}</span>
            <span>{overdue ? t('reports.overdue') : t('reports.due')} {fmtDate(report.dueDate)}</span>
          </div>
        )
      })()}
    </div>
  )
}

export default function Reports() {
  const { t } = useTranslation()
  const { customers, employees, reports, addReport, updateReport, deleteReport, moveReport } = useData()
  const [addModal, setAddModal]         = useState(null)
  const [detailReport, setDetailReport] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)
  const [search, setSearch] = useState('')

  const activeReports = reports || []

  function handleExport() {
    const rows = activeReports.map((r) => ({
      Title: r.title || '',
      Status: r.column || '',
      Priority: r.priority || '',
      Customer: r.customer?.name || '',
      Technician: r.employee?.name || '',
      'Due Date': r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '',
      'Created At': r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
      Description: r.description || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks')
    XLSX.writeFile(wb, 'tasks.xlsx')
  }

  const filtered = activeReports.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.title.toLowerCase().includes(q) ||
      (r.customer?.name || '').toLowerCase().includes(q) ||
      (r.employee?.name || '').toLowerCase().includes(q) ||
      (r.priority || '').toLowerCase().includes(q)
    )
  })

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDrop(e, columnId) {
    e.preventDefault()
    const id = e.dataTransfer.getData('reportId')
    if (id) moveReport(id, columnId)
    setDragOverColumn(null)
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverColumn(null)
  }

  return (
    <div className="p-3 pb-24 md:p-6 md:pb-24 lg:p-8 lg:pb-24 min-h-screen bg-page-bg">
      {addModal !== null && (
        <AddCardModal
          defaultColumn={addModal}
          customers={customers}
          employees={employees}
          onClose={() => setAddModal(null)}
          onSave={(form) => { addReport(form); setAddModal(null) }}
        />
      )}
      {detailReport && (
        <CardDetailModal
          report={detailReport}
          customers={customers}
          employees={employees}
          onClose={() => setDetailReport(null)}
          onSave={(id, form) => { updateReport(id, form); setDetailReport(null) }}
          onDelete={(id) => { deleteReport(id); setDetailReport(null) }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-on-surface mb-1 md:mb-2">{t('reports.title')}</h1>
          <p className="text-on-surface-variant text-xs md:text-sm lg:text-base">
            {t('reports.subtitle')}
          </p>
        </div>
        <div className="flex items-stretch gap-3 md:gap-4 self-start md:self-auto">
          <div className="bg-surface-container-lowest rounded-xl lg:rounded-2xl px-4 py-2 lg:px-5 lg:py-3 flex items-center gap-3 lg:gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-surface-tint" />
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px] lg:text-[20px]">analytics</span>
            </div>
            <div className="flex items-center gap-1.5 lg:gap-2">
              <p className="text-xl lg:text-2xl font-black text-on-surface leading-none">{activeReports.length}</p>
              <p className="text-[9px] lg:text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('reports.totalTasks')}</p>
            </div>
          </div>
          <button
            onClick={() => setAddModal('open')}
            className="primary-gradient text-white px-4 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl font-bold text-xs lg:text-sm shadow-xl shadow-primary/20 flex items-center justify-center gap-1.5 lg:gap-2 hover:opacity-90 hover:scale-[1.02] transition-all"
          >
            <span className="material-symbols-outlined text-[16px] lg:text-[20px]">add_task</span>
            {t('reports.newTask')}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-row items-center justify-between gap-3 mb-6 md:mb-8">
        <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl w-full sm:max-w-xs md:max-w-sm">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] md:text-[20px]">search</span>
          <input
            type="text"
            placeholder={t('reports.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-xs md:text-sm w-full placeholder-slate-400"
          />
        </div>
        <button
          onClick={handleExport}
          className="primary-gradient text-white px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-1.5 md:gap-2 flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[18px] md:text-[20px]">download</span>
          <span className="hidden md:inline">{t('common.export')}</span>
        </button>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 md:gap-5 items-start">
        {COLUMNS.map((col) => {
          const colReports = filtered.filter((r) => r.column === col.id)
          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              onDragEnter={() => setDragOverColumn(col.id)}
              onDragLeave={handleDragLeave}
              className={`bg-surface-container-lowest rounded-2xl flex flex-col transition-all ${
                dragOverColumn === col.id ? 'ring-2 ring-primary ring-offset-2' : ''
              }`}
            >
              {/* Column header */}
              <div className={`${col.headerClass} rounded-t-2xl px-3 md:px-4 py-2 flex items-center justify-between`}>
                <div className="flex items-center gap-1.5 md:gap-2">
                  <span className="material-symbols-outlined text-[16px] md:text-[18px]">{col.icon}</span>
                  <span className="text-xs md:text-sm font-bold">{t(col.labelKey)}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-surface-container-lowest/60 text-[10px] md:text-xs font-black">
                    {colReports.length}
                  </span>
                </div>
                {col.id === 'open' && (
                  <button
                    onClick={() => setAddModal('open')}
                    className="p-1 rounded-md hover:bg-surface-container-lowest/60 transition-colors flex items-center justify-center"
                    title="Add to Open"
                  >
                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">add</span>
                  </button>
                )}
              </div>

              {/* Cards */}
              <div className="p-3 flex flex-col gap-3 min-h-[140px]">
                {colReports.map((report) => (
                  <KanbanCard
                    key={report.id}
                    report={report}
                    onClick={() => setDetailReport(report)}
                  />
                ))}
                {colReports.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant/30">
                    <span className="material-symbols-outlined text-3xl">inbox</span>
                    <p className="text-xs font-medium mt-2">{t('reports.noReports')}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
