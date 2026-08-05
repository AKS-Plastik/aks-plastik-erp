import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import { API_URL } from '../config'
const MAINTENANCE_TYPES = ['Preventive', 'Corrective', 'Predictive', 'Emergency']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'AED', 'SAR', 'JPY', 'CNY', 'INR', 'CAD', 'AUD']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const statusColor = {
  'Active': 'bg-green-100 text-green-700',
  'Under Maintenance': 'bg-amber-100 text-amber-700',
  'Out of Service': 'bg-red-100 text-red-700',
}

// ─── Month Detail Popup ──────────────────────────────────────────────────────
function MonthDetailPopup({ machine, year, month, onClose }) {
  const { t } = useTranslation()
  const { addMonthlyTask, updateMonthlyTask, deleteMonthlyTask } = useData()
  const [newTask, setNewTask] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const inputRef = useRef(null)

  const tasks = (machine.monthlyMaintenance || []).filter((t) => t.year === year && t.month === month)
  const doneCount = tasks.filter((t) => t.completed).length

  async function handleAdd() {
    if (!newTask.trim()) return
    setAdding(true)
    try {
      await addMonthlyTask(machine.id, { year, month, description: newTask.trim() })
      setNewTask('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } finally { setAdding(false) }
  }

  async function toggleTask(task) {
    await updateMonthlyTask(machine.id, task.id, { completed: !task.completed })
  }

  async function saveDescription(task, value) {
    const trimmed = value.trim()
    if (!trimmed || trimmed === task.description) return
    await updateMonthlyTask(machine.id, task.id, { description: trimmed })
  }

  async function handleDelete(taskId) {
    await deleteMonthlyTask(machine.id, taskId)
    setDeletingId(null)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-theme-border shrink-0">
          <div>
            <h2 className="text-sm md:text-base font-bold text-on-surface">{MONTHS[month - 1]} {year}</h2>
            <p className="text-[10px] md:text-xs text-text-muted mt-0.5">{machine.name} — {doneCount}/{tasks.length} tasks completed</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-on-surface transition p-1">
            <span className="material-symbols-outlined text-[20px] md:text-[24px]">close</span>
          </button>
        </div>

        {/* Tasks list */}
        <div className="overflow-y-auto flex-1 px-4 py-3 md:px-6 md:py-4">
          {tasks.length === 0 ? (
            <p className="text-xs md:text-sm text-text-muted text-center py-6 md:py-8">No tasks yet. Add one below.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className={`flex items-center gap-2 md:gap-3 px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg md:rounded-xl border transition group/row ${t.completed ? 'border-green-200 bg-green-50/50' : 'border-theme-border bg-surface-container-lowest'}`}>
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => toggleTask(t)}
                    className="w-4 h-4 accent-primary cursor-pointer shrink-0"
                  />
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <input
                      type="text"
                      defaultValue={t.description}
                      key={t.id + '-' + t.description}
                      onBlur={(e) => saveDescription(t, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                      className={`flex-1 text-xs md:text-sm bg-transparent outline-none border-b border-transparent focus:border-primary transition-colors ${t.completed ? 'line-through text-text-muted' : 'text-on-surface'}`}
                    />
                    <span className="material-symbols-outlined text-[14px] md:text-sm text-text-muted opacity-0 group-hover/row:opacity-60 transition pointer-events-none shrink-0">edit</span>
                  </div>
                  {deletingId === t.id ? (
                    <span className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleDelete(t.id)} className="text-[10px] md:text-xs font-semibold text-white bg-error px-2 py-0.5 rounded transition">{t('common.yes')}</button>
                      <button onClick={() => setDeletingId(null)} className="text-[10px] md:text-xs text-text-muted px-1">{t('common.no')}</button>
                    </span>
                  ) : (
                    <button onClick={() => setDeletingId(t.id)} className="text-text-muted hover:text-error transition shrink-0 p-1">
                      <span className="material-symbols-outlined text-[16px] md:text-base">delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add task */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-t border-theme-border shrink-0">
          <div className="flex gap-1.5 md:gap-2">
            <input
              ref={inputRef}
              className="flex-1 bg-surface-container-lowest border border-theme-border rounded-lg md:rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary"
              placeholder="New task description…"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={!newTask.trim() || adding}
              className="flex items-center gap-1 md:gap-1.5 bg-primary text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[14px] md:text-base">add</span>
              {adding ? 'Adding…' : t('common.add')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Monthly Schedule Tab ────────────────────────────────────────────────────
function MonthlyScheduleTab({ machine }) {
  const { t } = useTranslation()
  const { addMonthlyTask, updateMonthlyTask, isAdmin } = useData()
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear())
  const [detailMonth, setDetailMonth] = useState(null)
  const [addingMonth, setAddingMonth] = useState(null)
  const [newTaskText, setNewTaskText] = useState('')
  const addInputRef = useRef(null)

  const yearData = (machine.monthlyMaintenance || []).filter((t) => t.year === monthlyYear)
  const totalTasks = yearData.length
  const doneTasks = yearData.filter((t) => t.completed).length

  function getMonthTasks(month) {
    return yearData.filter((t) => t.month === month)
  }

  async function handleQuickAdd(month) {
    if (!newTaskText.trim()) return
    await addMonthlyTask(machine.id, { year: monthlyYear, month, description: newTaskText.trim() })
    setNewTaskText('')
    setAddingMonth(null)
  }

  async function toggleTask(task) {
    await updateMonthlyTask(machine.id, task.id, { completed: !task.completed })
  }

  return (
    <div>
      {/* Year nav */}
      <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-5">
        <button onClick={() => setMonthlyYear((y) => y - 1)} className="p-1 md:p-1.5 rounded-lg border border-theme-border hover:bg-hover-bg transition">
          <span className="material-symbols-outlined text-[14px] md:text-base">chevron_left</span>
        </button>
        <span className="text-sm md:text-base font-bold text-on-surface w-12 md:w-16 text-center">{monthlyYear}</span>
        <button onClick={() => setMonthlyYear((y) => y + 1)} className="p-1 md:p-1.5 rounded-lg border border-theme-border hover:bg-hover-bg transition">
          <span className="material-symbols-outlined text-[14px] md:text-base">chevron_right</span>
        </button>
        <span className="text-[10px] md:text-xs text-text-muted ml-1 md:ml-2">
          {doneTasks}/{totalTasks} tasks completed
        </span>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-4">
        {MONTHS_SHORT.map((label, i) => {
          const month = i + 1
          const tasks = getMonthTasks(month)
          const done = tasks.filter((t) => t.completed).length
          const hasAny = tasks.length > 0
          const allDone = hasAny && done === tasks.length

          return (
            <div
              key={month}
              onClick={() => setDetailMonth(month)}
              className={`rounded-xl border p-3 transition cursor-pointer hover:border-primary/50 hover:shadow-sm ${allDone ? 'border-green-300 bg-green-50' : 'border-theme-border bg-surface-container-lowest'}`}
            >
              {/* Month header */}
              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                <div className="text-[13px] md:text-sm font-semibold text-on-surface flex items-center gap-1">
                  {label}
                  {hasAny && (
                    <span className={`text-[10px] md:text-xs font-normal ml-0.5 md:ml-1 ${allDone ? 'text-green-600' : 'text-text-muted'}`}>
                      {done}/{tasks.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 md:gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDetailMonth(month) }}
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-hover-bg text-text-muted hover:text-primary transition"
                    title="Open & edit"
                  >
                    <span className="material-symbols-outlined text-[14px] md:text-base">open_in_new</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddingMonth(addingMonth === month ? null : month); setNewTaskText(''); setTimeout(() => addInputRef.current?.focus(), 50) }}
                      className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-hover-bg text-text-muted hover:text-primary transition"
                      title="Add task"
                    >
                      <span className="material-symbols-outlined text-[14px] md:text-base">add</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Task previews */}
              <div className="space-y-1">
                {tasks.slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-center gap-1 md:gap-1.5 group/task">
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={(e) => { e.stopPropagation(); toggleTask(t) }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3 h-3 md:w-3.5 md:h-3.5 accent-primary cursor-pointer shrink-0"
                      disabled={!isAdmin}
                    />
                    <span className={`text-[10px] md:text-xs truncate flex-1 ${t.completed ? 'line-through text-text-muted' : 'text-on-surface'}`}>
                      {t.description}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDetailMonth(month) }}
                      className="shrink-0 opacity-0 group-hover/task:opacity-100 text-text-muted hover:text-primary transition"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-[11px] md:text-[13px]">edit</span>
                    </button>
                  </div>
                ))}
                {tasks.length > 4 && (
                  <button onClick={(e) => { e.stopPropagation(); setDetailMonth(month) }} className="text-[10px] md:text-xs text-primary hover:underline">
                    +{tasks.length - 4} more…
                  </button>
                )}
                {tasks.length === 0 && (
                  <p className="text-[10px] md:text-xs text-text-muted italic">No tasks — click to add</p>
                )}
              </div>

              {/* Inline add */}
              {addingMonth === month && (
                <div className="flex gap-1 mt-2 items-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={addInputRef}
                    className="flex-1 min-w-0 text-[10px] md:text-xs border border-theme-border rounded-md px-1.5 md:px-2 py-1 bg-surface-container-lowest outline-none focus:border-primary"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuickAdd(month)
                      if (e.key === 'Escape') setAddingMonth(null)
                    }}
                    placeholder="Task…"
                  />
                  <button onClick={() => handleQuickAdd(month)} disabled={!newTaskText.trim()} className="text-[10px] md:text-xs text-primary font-semibold px-1 disabled:opacity-40 shrink-0">{t('common.add')}</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detail popup */}
      {detailMonth && (
        <MonthDetailPopup
          machine={machine}
          year={monthlyYear}
          month={detailMonth}
          onClose={() => setDetailMonth(null)}
        />
      )}
    </div>
  )
}

// ─── Maintenance History Tab ─────────────────────────────────────────────────
function MaintenanceHistoryTab({ machine }) {
  const { t } = useTranslation()
  const { addMaintenanceRecord, deleteMaintenanceRecord, isAdmin } = useData()
  const [mForm, setMForm] = useState({ date: '', type: 'Preventive', description: '', technician: '', cost: '', currency: 'USD', nextDue: '' })
  const [mSaving, setMSaving] = useState(false)
  const [deletingMId, setDeletingMId] = useState(null)

  const records = machine?.maintenanceRecords || []

  const inp = (extra = '') =>
    `w-full bg-surface-container-lowest border border-theme-border rounded-lg md:rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition ${extra}`

  async function addRecord() {
    if (!mForm.date) return
    setMSaving(true)
    try {
      await addMaintenanceRecord(machine.id, mForm)
      setMForm({ date: '', type: 'Preventive', description: '', technician: '', cost: '', currency: 'USD', nextDue: '' })
    } finally { setMSaving(false) }
  }

  return (
    <div>
      {/* Add record form */}
      {isAdmin && (
        <div className="bg-surface-container-high rounded-xl p-4 lg:p-5 mb-5">
          <p className="text-xs font-semibold text-text-muted mb-3">{t('maintenance.newRecord')}</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
            <div>
              <label className="block text-[10px] lg:text-xs text-text-muted mb-0.5 lg:mb-1">{t('common.date')} <span className="text-error">*</span></label>
              <input type="date" className={inp()} value={mForm.date} onChange={(e) => setMForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs text-text-muted mb-0.5 md:mb-1">{t('maintenance.type')}</label>
              <select className={inp()} value={mForm.type} onChange={(e) => setMForm((f) => ({ ...f, type: e.target.value }))}>
                {MAINTENANCE_TYPES.map((typ) => <option key={typ} value={typ}>{typ}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] md:text-xs text-text-muted mb-0.5 md:mb-1">{t('maintenance.technician')}</label>
              <input className={inp()} value={mForm.technician} onChange={(e) => setMForm((f) => ({ ...f, technician: e.target.value }))} placeholder="Name or company" />
            </div>
            <div>
              <label className="block text-[10px] lg:text-xs text-text-muted mb-0.5 lg:mb-1">Cost</label>
              <div className="flex gap-1">
                <select className="bg-surface-container-lowest border border-theme-border rounded-lg lg:rounded-xl px-2 py-1.5 lg:py-2 text-xs lg:text-sm text-on-surface outline-none focus:border-primary" value={mForm.currency} onChange={(e) => setMForm((f) => ({ ...f, currency: e.target.value }))}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" className={`${inp()} flex-1`} value={mForm.cost} onChange={(e) => setMForm((f) => ({ ...f, cost: e.target.value }))} placeholder="0.00" min="0" />
              </div>
            </div>
            <div className="col-span-1 lg:col-span-2">
              <label className="block text-[10px] lg:text-xs text-text-muted mb-0.5 lg:mb-1">{t('common.description')}</label>
              <input className={inp()} value={mForm.description} onChange={(e) => setMForm((f) => ({ ...f, description: e.target.value }))} placeholder="What was done?" />
            </div>
            <div>
              <label className="block text-[10px] lg:text-xs text-text-muted mb-0.5 lg:mb-1">{t('maintenance.nextDue')}</label>
              <input type="date" className={inp()} value={mForm.nextDue} onChange={(e) => setMForm((f) => ({ ...f, nextDue: e.target.value }))} />
            </div>
            <div className="flex items-end mt-1 lg:mt-0">
              <button
                onClick={addRecord}
                disabled={!mForm.date || mSaving}
                className="flex items-center gap-1 lg:gap-1.5 bg-primary text-white px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg lg:rounded-xl text-xs lg:text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 w-full justify-center"
              >
                <span className="material-symbols-outlined text-[14px] lg:text-base">add</span>
                {mSaving ? 'Saving…' : t('maintenance.newRecord')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Records list */}
      {records.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No maintenance records yet.</p>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="bg-surface-container-lowest border border-theme-border rounded-xl p-3 md:p-4 transition hover:border-primary/30 hover:shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs md:text-sm font-semibold text-on-surface">{r.date}</span>
                  <span className="text-[10px] md:text-xs bg-surface-container-high px-2 py-0.5 rounded-full font-medium">{r.type}</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    {deletingMId === r.id ? (
                      <span className="flex items-center gap-1">
                        <button onClick={async () => { await deleteMaintenanceRecord(machine.id, r.id); setDeletingMId(null) }} className="text-[10px] md:text-xs font-semibold text-white bg-error px-2 py-0.5 rounded transition">{t('common.yes')}</button>
                        <button onClick={() => setDeletingMId(null)} className="text-[10px] md:text-xs text-text-muted px-1 transition">{t('common.no')}</button>
                      </span>
                    ) : (
                      <button onClick={() => setDeletingMId(r.id)} className="text-text-muted hover:text-error transition flex items-center justify-center w-7 h-7 rounded-lg hover:bg-surface-container-high">
                        <span className="material-symbols-outlined text-[16px] md:text-base">delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] md:text-xs">
                <div className="col-span-2 md:col-span-4">
                  <span className="block text-[9px] md:text-[10px] font-bold text-text-muted mb-0.5 uppercase tracking-wider">{t('common.description')}</span>
                  <span className="text-on-surface leading-relaxed">{r.description || '—'}</span>
                </div>
                <div>
                  <span className="block text-[9px] md:text-[10px] font-bold text-text-muted mb-0.5 uppercase tracking-wider">{t('maintenance.technician')}</span>
                  <span className="text-on-surface">{r.technician || '—'}</span>
                </div>
                <div>
                  <span className="block text-[9px] md:text-[10px] font-bold text-text-muted mb-0.5 uppercase tracking-wider">Cost</span>
                  <span className="text-on-surface">{r.cost > 0 ? `${r.cost.toFixed(2)} ${r.currency || 'USD'}` : '—'}</span>
                </div>
                <div className="col-span-2 md:col-span-2">
                  <span className="block text-[9px] md:text-[10px] font-bold text-text-muted mb-0.5 uppercase tracking-wider">{t('maintenance.nextDue')}</span>
                  <span className="text-on-surface">{r.nextDue || '—'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Maintenance() {
  const { t } = useTranslation()
  const { machines } = useData()
  const [selectedId, setSelectedId] = useState(null)
  const [tab, setTab] = useState('history')
  const [search, setSearch] = useState('')

  const allMachines = machines || []

  const filtered = allMachines.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase())
  )

  const selected = allMachines.find((m) => m.id === selectedId)

  const tabCls = (key) =>
    `flex items-center gap-1.5 px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${tab === key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-on-surface'
    }`

  return (
    <div className="p-3 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-on-surface">{t('maintenance.title')}</h1>
        <p className="text-xs md:text-sm text-text-muted mt-0.5">{t('maintenance.subtitle')}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Machine list sidebar */}
        <div className="w-full lg:w-[320px] shrink-0">
          <div className="relative mb-2 md:mb-3">
            <span className="material-symbols-outlined absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-text-muted text-[14px] md:text-lg">search</span>
            <input
              className="w-full bg-surface-container-lowest border border-theme-border rounded-lg md:rounded-xl pl-8 md:pl-9 pr-2.5 md:pr-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary"
              placeholder={t('maintenance.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="bg-surface-container-lowest rounded-2xl border border-theme-border overflow-hidden">
            {filtered.length === 0 ? (
              <p className="text-center py-10 text-sm text-text-muted">{t('settings.noMachines')}</p>
            ) : (
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {filtered.map((m) => {
                  const yearTasks = (m.monthlyMaintenance || []).filter((t) => t.year === new Date().getFullYear())
                  const done = yearTasks.filter((t) => t.completed).length
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full text-left px-3 py-2.5 md:px-4 md:py-3 border-b border-theme-border last:border-0 transition ${selectedId === m.id ? 'bg-primary/10' : 'hover:bg-hover-bg'
                        }`}
                    >
                      <div className="flex items-center gap-1.5 md:gap-2 mb-0.5">
                        <span className="material-symbols-outlined text-[14px] md:text-base text-primary">precision_manufacturing</span>
                        <span className="text-xs md:text-sm font-semibold text-on-surface truncate">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-5 md:ml-6">
                        <span className="font-mono text-[10px] md:text-xs text-text-muted">{m.code}</span>
                        <span className={`text-[10px] md:text-xs px-1.5 py-0 rounded-full font-medium ${statusColor[m.status] || 'bg-surface-container-high text-text-muted'}`}>{m.status}</span>
                      </div>
                      {yearTasks.length > 0 && (
                        <div className="flex items-center gap-1 ml-5 md:ml-6 mt-1">
                          <div className="flex-1 h-1 md:h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(done / yearTasks.length) * 100}%` }} />
                          </div>
                          <span className="text-[10px] md:text-xs text-text-muted">{done}/{yearTasks.length}</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="hidden lg:flex flex-col items-center justify-center h-full min-h-[400px] text-text-muted">
              <span className="material-symbols-outlined text-6xl mb-3 opacity-60 transition-all">build</span>
              <p className="text-lg font-semibold text-on-surface/80 transition-all">Select a machine</p>
              <p className="text-sm mt-1.5 max-w-[240px] text-center leading-relaxed transition-all">Choose a machine from the list to view its maintenance details.</p>
            </div>
          ) : (
            <div>
              {/* Machine header */}
              <div className="flex items-center gap-2.5 md:gap-3 mb-3 md:mb-4">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[18px] md:text-[24px]">precision_manufacturing</span>
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-bold text-on-surface">{selected.name}</h2>
                  <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-text-muted">
                    <span className="font-mono">{selected.code}</span>
                    {selected.location && <><span>·</span><span>{selected.location}</span></>}
                    {selected.nextMaintenanceDue && <><span className="hidden md:inline">·</span><span className="hidden md:inline">Next due: {selected.nextMaintenanceDue}</span></>}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-0 border-b border-theme-border mb-4 md:mb-5">
                <button className={tabCls('history')} onClick={() => setTab('history')}>
                  <span className="material-symbols-outlined text-[14px] md:text-base">build</span>
                  {t('maintenance.title')}
                </button>
                <button className={tabCls('monthly')} onClick={() => setTab('monthly')}>
                  <span className="material-symbols-outlined text-[14px] md:text-base">calendar_month</span>
                  Monthly Schedule
                </button>
              </div>

              {tab === 'history' && <MaintenanceHistoryTab machine={selected} />}
              {tab === 'monthly' && <MonthlyScheduleTab machine={selected} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
