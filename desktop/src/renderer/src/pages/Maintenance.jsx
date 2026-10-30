import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'

const MAINTENANCE_TYPES = ['Preventive', 'Corrective', 'Predictive', 'Emergency']
const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP']

const statusColor = {
  Active: 'bg-green-100 text-green-700',
  'Under Maintenance': 'bg-amber-100 text-amber-700',
  'Out of Service': 'bg-red-100 text-red-700',
}

const isProduction = (str) => {
  if (!str) return false
  const s = String(str).toLowerCase()
  return (
    s.includes('production') ||
    s.includes('üretim') ||
    s.includes('uretim') ||
    s.includes('imalat')
  )
}

function fmtDateTime(iso, lang = 'tr') {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const dateStr = d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
  const hours = d.getHours()
  const minutes = d.getMinutes()
  if (hours !== 0 || minutes !== 0 || String(iso).includes('T') || String(iso).includes(':')) {
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    return `${dateStr} ${timeStr}`
  }
  return dateStr
}

// ─── Task History Modal ──────────────────────────────────────────────────────
function TaskHistoryModal({ task, onClose }) {
  const { t, i18n } = useTranslation()
  const history = Array.isArray(task.history) ? [...task.history].reverse() : []

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-xs" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-[90%] max-w-md overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-theme-border primary-gradient">
          <div className="flex items-center gap-2 text-white">
            <span className="material-symbols-outlined text-lg">history</span>
            <h3 className="text-sm font-bold">{t('maintenance.taskHistory')}</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition p-1">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-4 border-b border-theme-border/60 bg-surface-container-high/30">
          <p className="text-xs font-semibold text-on-surface leading-snug">{task.description}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {task.isDefault ? (
              <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wider">
                {t('maintenance.standard')}
              </span>
            ) : (
              <span className="text-[9px] font-bold text-text-muted bg-surface-container-high px-2 py-0.5 rounded uppercase tracking-wider">
                {t('maintenance.custom')}
              </span>
            )}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${task.completed ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'}`}>
              {task.completed ? t('common.completed', 'Tamamlandı') : t('common.pending', 'Bekliyor')}
            </span>
          </div>
        </div>

        <div className="p-4 max-h-[350px] overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-center py-6 text-text-muted text-xs">
              <span className="material-symbols-outlined text-3xl opacity-40 mb-1">hourglass_empty</span>
              <p>{t('maintenance.noHistory')}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((h, i) => {
                const isComp = h.action === 'completed'
                return (
                  <div key={h.id || i} className="flex items-start gap-2.5 text-xs p-2 rounded-xl bg-surface-container-high/40 border border-theme-border/50">
                    <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${isComp ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {isComp ? 'check_circle' : 'undo'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-on-surface truncate">{h.userName || 'Personel'}</span>
                        <span className="text-[10px] text-text-muted shrink-0 font-mono">
                          {fmtDateTime(h.timestamp, i18n.language)}
                        </span>
                      </div>
                      <p className={`text-[11px] font-medium mt-0.5 ${isComp ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {isComp ? t('maintenance.actionCompleted') : t('maintenance.actionUncompleted')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-theme-border flex justify-end bg-surface-container-high/20">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Default Templates Modal (Admin) ─────────────────────────────────────────
function DefaultTasksModal({ onClose }) {
  const { t } = useTranslation()
  const { getMonthlyTemplates, updateMonthlyTemplates } = useData()
  const [templates, setTemplates] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        if (typeof getMonthlyTemplates === 'function') {
          const tpls = await getMonthlyTemplates()
          if (Array.isArray(tpls)) {
            const arr = [...tpls]
            while (arr.length < 4) arr.push('')
            setTemplates(arr.slice(0, 4))
          }
        }
      } catch (err) {
        console.warn('Failed to load templates:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      if (typeof updateMonthlyTemplates === 'function') {
        await updateMonthlyTemplates(templates)
        setSavedMsg(true)
        setTimeout(() => setSavedMsg(false), 2500)
      }
    } catch (err) {
      alert(err.message || 'Error saving templates')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-xs" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-[95%] max-w-lg overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-theme-border primary-gradient">
          <div className="flex items-center gap-2 text-white">
            <span className="material-symbols-outlined text-lg">checklist</span>
            <h3 className="text-sm font-bold">{t('maintenance.defaultTasksModalTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition p-1">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <p className="text-xs text-text-muted mb-4 leading-relaxed">
            {t('maintenance.defaultTasksModalDesc')}
          </p>

          {loading ? (
            <div className="py-8 text-center text-text-muted text-xs">
              <span className="material-symbols-outlined animate-spin text-2xl mb-1">progress_activity</span>
              <p>{t('common.loading', 'Yükleniyor…')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((tpl, i) => (
                <div key={i} className="space-y-1">
                  <label className="block text-[11px] font-bold text-on-surface uppercase tracking-wider">
                    {t('maintenance.defaultTaskLabel', { num: i + 1 })}
                  </label>
                  <input
                    type="text"
                    value={tpl}
                    onChange={(e) => {
                      const next = [...templates]
                      next[i] = e.target.value
                      setTemplates(next)
                    }}
                    placeholder={`Görev ${i + 1}...`}
                    className="w-full bg-surface-container-lowest border border-theme-border rounded-xl px-3 py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition"
                  />
                </div>
              ))}
            </div>
          )}

          {savedMsg && (
            <div className="mt-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              {t('maintenance.templatesSaved')}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-theme-border flex items-center justify-end gap-2 bg-surface-container-high/20">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-on-surface hover:bg-surface-container-high transition">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 primary-gradient text-white px-5 py-2 rounded-xl text-xs font-semibold hover:opacity-95 transition disabled:opacity-40 shadow-sm shadow-primary/20"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            {saving ? t('common.saving') : t('maintenance.saveTemplates')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Month Detail Popup ──────────────────────────────────────────────────────
function MonthDetailPopup({ machine, year, month, onClose }) {
  const { t } = useTranslation()
  const { addMonthlyTask, updateMonthlyTask, deleteMonthlyTask, isAdmin } = useData()
  const [newTask, setNewTask] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [historyTask, setHistoryTask] = useState(null)
  const inputRef = useRef(null)

  const monthNames = t('maintenance.months', { returnObjects: true }) || []
  const monthName = Array.isArray(monthNames) && monthNames[month - 1] ? monthNames[month - 1] : `Ay ${month}`

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

  async function handleDelete(task) {
    if (task.isDefault) {
      alert(t('maintenance.cannotDeleteDefault'))
      setDeletingId(null)
      return
    }
    await deleteMonthlyTask(machine.id, task.id)
    setDeletingId(null)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-[95%] md:w-[90%] lg:w-[85%] max-w-none max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-theme-border shrink-0">
            <div>
              <h2 className="text-sm md:text-base font-bold text-on-surface">{monthName} {year}</h2>
              <p className="text-[10px] md:text-xs text-text-muted mt-0.5">
                {machine.name} — {t('maintenance.tasksCompleted', { done: doneCount, total: tasks.length })}
              </p>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-on-surface transition p-1">
              <span className="material-symbols-outlined text-[20px] md:text-[24px]">close</span>
            </button>
          </div>

          {/* Tasks list */}
          <div className="overflow-y-auto flex-1 px-4 py-3 md:px-6 md:py-4">
            {tasks.length === 0 ? (
              <p className="text-xs md:text-sm text-text-muted text-center py-6 md:py-8">{t('maintenance.noTasksAddBelow')}</p>
            ) : (
              <div className="space-y-2.5">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2.5 md:gap-3 px-3 py-2 md:px-3.5 md:py-2.5 rounded-xl border transition group/row ${
                      task.completed ? 'border-green-200 bg-green-50/60' : 'border-theme-border bg-surface-container-lowest'
                    }`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task)}
                      className="w-4 h-4 accent-primary cursor-pointer shrink-0"
                    />

                    {/* Description or Text */}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      {task.isDefault ? (
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs md:text-sm font-medium ${task.completed ? 'line-through text-text-muted' : 'text-on-surface'}`}>
                            {task.description}
                          </span>
                          {task.completed && task.completedBy && (
                            <span className="block text-[10px] text-emerald-600 font-medium">
                              {t('maintenance.completedByText', { user: task.completedBy })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                          <input
                            type="text"
                            defaultValue={task.description}
                            key={task.id + '-' + task.description}
                            onBlur={(e) => saveDescription(task, e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                            className={`flex-1 text-xs md:text-sm bg-transparent outline-none border-b border-transparent focus:border-primary transition-colors ${
                              task.completed ? 'line-through text-text-muted' : 'text-on-surface'
                            }`}
                          />
                          <span className="material-symbols-outlined text-[14px] text-text-muted opacity-0 group-hover/row:opacity-60 transition pointer-events-none shrink-0">edit</span>
                        </div>
                      )}
                    </div>

                    {/* Standard Tag */}
                    {task.isDefault && (
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded tracking-wide shrink-0">
                        {t('maintenance.standard')}
                      </span>
                    )}

                    {/* History button */}
                    <button
                      onClick={() => setHistoryTask(task)}
                      className="flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-primary px-2 py-1 rounded-lg hover:bg-surface-container-high transition shrink-0"
                      title={t('maintenance.taskHistory')}
                    >
                      <span className="material-symbols-outlined text-[14px]">history</span>
                      <span className="hidden sm:inline">{task.history?.length || 0}</span>
                    </button>

                    {/* Delete button (Non-default tasks only) */}
                    {!task.isDefault && (
                      deletingId === task.id ? (
                        <span className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleDelete(task)} className="text-[10px] md:text-xs font-semibold text-white bg-error px-2 py-0.5 rounded transition">{t('common.yes')}</button>
                          <button onClick={() => setDeletingId(null)} className="text-[10px] md:text-xs text-text-muted px-1">{t('common.no')}</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeletingId(task.id)} className="text-text-muted hover:text-error transition shrink-0 p-1">
                          <span className="material-symbols-outlined text-[16px] md:text-base">delete</span>
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add task (custom task) */}
          <div className="px-4 py-3 md:px-6 md:py-4 border-t border-theme-border shrink-0">
            <div className="flex gap-1.5 md:gap-2">
              <input
                ref={inputRef}
                className="flex-1 bg-surface-container-lowest border border-theme-border rounded-lg md:rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary"
                placeholder={t('maintenance.newTaskPlaceholder')}
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
                {adding ? t('common.adding') : t('common.add')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {historyTask && <TaskHistoryModal task={historyTask} onClose={() => setHistoryTask(null)} />}
    </>
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
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [historyTask, setHistoryTask] = useState(null)
  const addInputRef = useRef(null)

  const monthsShort = t('maintenance.monthsShort', { returnObjects: true }) || []

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
      {/* Year nav & Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mb-5">
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={() => setMonthlyYear((y) => y - 1)} className="p-1 md:p-1.5 rounded-lg border border-theme-border hover:bg-hover-bg transition">
            <span className="material-symbols-outlined text-[14px] md:text-base">chevron_left</span>
          </button>
          <span className="text-sm md:text-base font-bold text-on-surface w-12 md:w-16 text-center">{monthlyYear}</span>
          <button onClick={() => setMonthlyYear((y) => y + 1)} className="p-1 md:p-1.5 rounded-lg border border-theme-border hover:bg-hover-bg transition">
            <span className="material-symbols-outlined text-[14px] md:text-base">chevron_right</span>
          </button>
          <span className="text-[10px] md:text-xs text-text-muted ml-1 md:ml-2">
            {t('maintenance.tasksCompleted', { done: doneTasks, total: totalTasks })}
          </span>
          {monthlyYear === new Date().getFullYear() && (
            <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold border border-primary/20">
              {t('maintenance.activeMonth', 'Aktif Ay')}: {getMonthTasks(new Date().getMonth() + 1).filter((t) => t.completed).length}/{getMonthTasks(new Date().getMonth() + 1).length}
            </span>
          )}
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl transition"
          >
            <span className="material-symbols-outlined text-sm">settings_suggest</span>
            {t('maintenance.configureDefaultTasks')}
          </button>
        )}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-4">
        {Array.from({ length: 12 }).map((_, i) => {
          const month = i + 1
          const label = Array.isArray(monthsShort) && monthsShort[i] ? monthsShort[i] : `Ay ${month}`
          const tasks = getMonthTasks(month)
          const done = tasks.filter((t) => t.completed).length
          const hasAny = tasks.length > 0
          const allDone = hasAny && done === tasks.length
          const isCurrentMonth = monthlyYear === new Date().getFullYear() && month === (new Date().getMonth() + 1)

          return (
            <div
              key={month}
              onClick={() => setDetailMonth(month)}
              className={`rounded-xl border p-3 transition cursor-pointer hover:border-primary/50 hover:shadow-sm relative ${
                isCurrentMonth
                  ? allDone
                    ? 'border-green-500 ring-2 ring-primary/40 bg-green-50/70 shadow-sm'
                    : 'border-primary ring-2 ring-primary/30 bg-primary/[0.04] shadow-sm'
                  : allDone
                    ? 'border-green-300 bg-green-50'
                    : 'border-theme-border bg-surface-container-lowest'
              }`}
            >
              {/* Month header */}
              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                <div className="text-[13px] md:text-sm font-semibold text-on-surface flex items-center gap-1.5 flex-wrap">
                  <span>{label}</span>
                  {isCurrentMonth && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold bg-primary text-white tracking-wide uppercase shadow-xs">
                      {t('maintenance.activeMonth', 'Aktif Ay')}
                    </span>
                  )}
                  {hasAny && (
                    <span className={`text-[10px] md:text-xs font-normal ml-0.5 md:ml-1 ${allDone ? 'text-green-600 font-semibold' : 'text-text-muted'}`}>
                      {done}/{tasks.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 md:gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDetailMonth(month) }}
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-hover-bg text-text-muted hover:text-primary transition"
                    title={t('common.edit')}
                  >
                    <span className="material-symbols-outlined text-[14px] md:text-base">open_in_new</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddingMonth(addingMonth === month ? null : month); setNewTaskText(''); setTimeout(() => addInputRef.current?.focus(), 50) }}
                      className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-hover-bg text-text-muted hover:text-primary transition"
                      title={t('maintenance.addTask', 'Görev Ekle')}
                    >
                      <span className="material-symbols-outlined text-[14px] md:text-base">add</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Task previews */}
              <div className="space-y-1">
                {tasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="flex items-center gap-1 md:gap-1.5 group/task">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={(e) => { e.stopPropagation(); toggleTask(task) }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3 h-3 md:w-3.5 md:h-3.5 accent-primary cursor-pointer shrink-0"
                    />
                    <span className={`text-[10px] md:text-xs truncate flex-1 ${task.completed ? 'line-through text-text-muted' : 'text-on-surface'}`}>
                      {task.description}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setHistoryTask(task) }}
                      className="shrink-0 opacity-0 group-hover/task:opacity-100 text-text-muted hover:text-primary transition p-0.5"
                      title={t('maintenance.taskHistory')}
                    >
                      <span className="material-symbols-outlined text-[12px]">history</span>
                    </button>
                  </div>
                ))}
                {tasks.length > 4 && (
                  <button onClick={(e) => { e.stopPropagation(); setDetailMonth(month) }} className="text-[10px] md:text-xs text-primary hover:underline">
                    +{tasks.length - 4} {t('common.more', 'daha…')}
                  </button>
                )}
                {tasks.length === 0 && (
                  <p className="text-[10px] md:text-xs text-text-muted italic">{t('maintenance.noTasksClick')}</p>
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
                    placeholder={t('maintenance.taskPlaceholder')}
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

      {/* Default templates configuration modal */}
      {showTemplatesModal && (
        <DefaultTasksModal onClose={() => setShowTemplatesModal(false)} />
      )}

      {/* Task history modal */}
      {historyTask && (
        <TaskHistoryModal task={historyTask} onClose={() => setHistoryTask(null)} />
      )}
    </div>
  )
}

// ─── Maintenance History Tab ─────────────────────────────────────────────────
function MaintenanceHistoryTab({ machine }) {
  const { t, i18n } = useTranslation()
  const { addMaintenanceRecord, deleteMaintenanceRecord, isAdmin, employees } = useData()
  const [mForm, setMForm] = useState({
    date: '',
    type: 'Preventive',
    description: '',
    technician: '',
    currency: 'TRY',
    expenses: []
  })
  const [mSaving, setMSaving] = useState(false)
  const [deletingMId, setDeletingMId] = useState(null)

  // Filter only production department employees for technician selection
  const productionEmployees = (employees || []).filter(
    (e) => isProduction(e.department) || isProduction(e.position)
  )

  const records = machine?.maintenanceRecords || []

  const inp = (extra = '') =>
    `w-full bg-surface-container-lowest border border-theme-border rounded-lg md:rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition ${extra}`

  // Expense helpers
  function addExpenseItem() {
    setMForm((f) => ({
      ...f,
      expenses: [
        ...f.expenses,
        {
          id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          title: '',
          cost: '',
          currency: f.currency || 'TRY',
        },
      ],
    }))
  }

  function updateExpenseItem(id, field, value) {
    setMForm((f) => ({
      ...f,
      expenses: f.expenses.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }))
  }

  function removeExpenseItem(id) {
    setMForm((f) => ({
      ...f,
      expenses: f.expenses.filter((item) => item.id !== id),
    }))
  }

  const totalExpenses = mForm.expenses.reduce(
    (sum, item) => sum + (parseFloat(item.cost) || 0),
    0
  )

  async function addRecord() {
    if (!mForm.date) return
    setMSaving(true)
    try {
      await addMaintenanceRecord(machine.id, {
        date: mForm.date,
        type: mForm.type,
        description: mForm.description,
        technician: mForm.technician,
        currency: mForm.currency || 'TRY',
        expenses: mForm.expenses,
        cost: totalExpenses,
      })
      setMForm({
        date: '',
        type: 'Preventive',
        description: '',
        technician: '',
        currency: 'TRY',
        expenses: []
      })
    } finally {
      setMSaving(false)
    }
  }

  return (
    <div>
      {/* Add record form */}
      {isAdmin && (
        <div className="bg-surface-container-high rounded-xl p-4 lg:p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-on-surface uppercase tracking-wider">{t('maintenance.newRecord')}</p>
            {totalExpenses > 0 && (
              <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                {t('maintenance.total')}: {totalExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {mForm.currency || 'TRY'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
            {/* Tarih & Saat (datetime-local) */}
            <div>
              <label className="block text-[10px] lg:text-xs font-semibold text-text-muted mb-0.5 lg:mb-1">
                {t('common.date')} & {t('common.time', 'Saat')} <span className="text-error">*</span>
              </label>
              <input
                type="datetime-local"
                className={inp()}
                value={mForm.date}
                onChange={(e) => setMForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>

            {/* Bakım Türü */}
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">
                {t('maintenance.type')}
              </label>
              <select
                className={inp()}
                value={mForm.type}
                onChange={(e) => setMForm((f) => ({ ...f, type: e.target.value }))}
              >
                {MAINTENANCE_TYPES.map((typ) => (
                  <option key={typ} value={typ}>
                    {t(`maintenance.types.${typ}`, typ)}
                  </option>
                ))}
              </select>
            </div>

            {/* Teknisyen (Selectbox with Production Department Employees) */}
            <div className="col-span-1 lg:col-span-2">
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">
                {t('maintenance.technician')}
              </label>
              <select
                className={inp()}
                value={mForm.technician}
                onChange={(e) => setMForm((f) => ({ ...f, technician: e.target.value }))}
              >
                <option value="">{t('maintenance.selectTechnician')}</option>
                {productionEmployees.length > 0 ? (
                  productionEmployees.map((e) => (
                    <option key={e.id} value={e.name}>
                      {e.name} {e.position ? `(${e.position})` : (e.department ? `(${e.department})` : '')}
                    </option>
                  ))
                ) : (
                  (employees || []).map((e) => (
                    <option key={e.id} value={e.name}>
                      {e.name} ({e.department || 'Personel'})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Çok Satırlı Açıklama */}
            <div className="col-span-1 lg:col-span-2">
              <label className="block text-[10px] lg:text-xs font-semibold text-text-muted mb-0.5 lg:mb-1">
                {t('common.description')}
              </label>
              <textarea
                className={`${inp()} min-h-[75px] resize-y`}
                rows={3}
                value={mForm.description}
                onChange={(e) => setMForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('maintenance.descriptionPlaceholder')}
              />
            </div>

            {/* Harcamalar (Expenses) Dinamik Kart Listesi */}
            <div className="col-span-1 lg:col-span-2 pt-2 border-t border-theme-border/60">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">receipt_long</span>
                  <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    {t('maintenance.expenses')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addExpenseItem}
                  className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  {t('maintenance.addExpense')}
                </button>
              </div>

              {mForm.expenses.length === 0 ? (
                <div className="text-center py-3 px-4 border border-dashed border-theme-border rounded-xl text-text-muted text-[11px]">
                  {t('maintenance.noExpensesYet')}
                </div>
              ) : (
                <div className="space-y-2">
                  {mForm.expenses.map((exp, idx) => (
                    <div
                      key={exp.id}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-surface-container-lowest p-2.5 rounded-xl border border-theme-border shadow-sm"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-[10px] font-mono text-text-muted shrink-0 w-5 text-center">#{idx + 1}</span>
                        <input
                          type="text"
                          className={inp('flex-1')}
                          placeholder={t('maintenance.expenseTitlePlaceholder')}
                          value={exp.title}
                          onChange={(e) => updateExpenseItem(exp.id, 'title', e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 sm:w-64">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className={inp('flex-1 text-right font-medium')}
                          placeholder="0.00"
                          value={exp.cost}
                          onChange={(e) => updateExpenseItem(exp.id, 'cost', e.target.value)}
                        />
                        <select
                          className="bg-surface-container-lowest border border-theme-border rounded-lg md:rounded-xl px-2 py-1.5 md:py-2 text-xs text-on-surface outline-none focus:border-primary shrink-0"
                          value={exp.currency || mForm.currency || 'TRY'}
                          onChange={(e) => updateExpenseItem(exp.id, 'currency', e.target.value)}
                        >
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeExpenseItem(exp.id)}
                          className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition shrink-0"
                          title={t('common.delete')}
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Kaydet Butonu */}
            <div className="col-span-1 lg:col-span-2 flex items-center justify-end mt-1">
              <button
                onClick={addRecord}
                disabled={!mForm.date || mSaving}
                className="flex items-center gap-1.5 primary-gradient text-white px-5 py-2.5 rounded-xl text-xs md:text-sm font-semibold hover:opacity-95 transition disabled:opacity-40 shadow-lg shadow-primary/20"
              >
                <span className="material-symbols-outlined text-[16px] md:text-lg">check_circle</span>
                {mSaving ? t('common.saving') : t('maintenance.newRecord')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Records list */}
      {records.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">{t('maintenance.noRecords')}</p>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <div key={record.id} className="bg-surface-container-lowest border border-theme-border rounded-xl p-3 md:p-4 transition hover:border-primary/30 hover:shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs md:text-sm font-bold text-on-surface">
                    {fmtDateTime(record.date, i18n.language)}
                  </span>
                  <span className="text-[10px] md:text-xs bg-surface-container-high px-2.5 py-0.5 rounded-full font-medium text-on-surface-variant">
                    {t(`maintenance.types.${record.type}`, record.type)}
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    {deletingMId === record.id ? (
                      <span className="flex items-center gap-1">
                        <button onClick={async () => { await deleteMaintenanceRecord(machine.id, record.id); setDeletingMId(null) }} className="text-[10px] md:text-xs font-semibold text-white bg-error px-2 py-0.5 rounded transition">{t('common.yes')}</button>
                        <button onClick={() => setDeletingMId(null)} className="text-[10px] md:text-xs text-text-muted px-1 transition">{t('common.no')}</button>
                      </span>
                    ) : (
                      <button onClick={() => setDeletingMId(record.id)} className="text-text-muted hover:text-error transition flex items-center justify-center w-7 h-7 rounded-lg hover:bg-surface-container-high">
                        <span className="material-symbols-outlined text-[16px] md:text-base">delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] md:text-xs">
                {/* Description */}
                <div className="col-span-2 md:col-span-3">
                  <span className="block text-[9px] md:text-[10px] font-bold text-text-muted mb-0.5 uppercase tracking-wider">{t('common.description')}</span>
                  <span className="text-on-surface leading-relaxed whitespace-pre-line">{record.description || '—'}</span>
                </div>

                {/* Technician */}
                <div>
                  <span className="block text-[9px] md:text-[10px] font-bold text-text-muted mb-0.5 uppercase tracking-wider">{t('maintenance.technician')}</span>
                  <span className="text-on-surface font-medium">{record.technician || '—'}</span>
                </div>

                {/* Cost (legacy / summary) */}
                {(!record.expenses || record.expenses.length === 0) && record.cost > 0 && (
                  <div className="col-span-2">
                    <span className="block text-[9px] md:text-[10px] font-bold text-text-muted mb-0.5 uppercase tracking-wider">{t('maintenance.cost')}</span>
                    <span className="text-on-surface font-semibold">
                      {record.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {record.currency || 'TRY'}
                    </span>
                  </div>
                )}

                {/* Expenses breakdown */}
                {Array.isArray(record.expenses) && record.expenses.length > 0 && (
                  <div className="col-span-2 md:col-span-4 mt-2 pt-2 border-t border-theme-border/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] md:text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                        {t('maintenance.expenses')} ({record.expenses.length})
                      </span>
                      <span className="text-[10px] font-bold text-primary">
                        {t('maintenance.total')}: {record.cost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {record.currency || 'TRY'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                      {record.expenses.map((exp, eIdx) => (
                        <div key={exp.id || eIdx} className="bg-surface-container-high/60 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px]">
                          <span className="truncate text-on-surface font-medium mr-2">{exp.title || t('maintenance.unnamedExpense')}</span>
                          <span className="font-mono font-semibold text-on-surface shrink-0">
                            {(parseFloat(exp.cost) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {exp.currency || record.currency || 'TRY'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
    (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.code || '').toLowerCase().includes(search.toLowerCase())
  )

  const selected = allMachines.find((m) => m.id === selectedId)

  const tabCls = (key) =>
    `flex items-center gap-1.5 px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
      tab === key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-on-surface'
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
              <p className="text-center py-10 text-sm text-text-muted">{t('settings.noMachines', 'Kayıtlı makine bulunamadı')}</p>
            ) : (
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {filtered.map((m) => {
                  const now = new Date()
                  const currentYear = now.getFullYear()
                  const currentMonth = now.getMonth() + 1
                  const activeMonthTasks = (m.monthlyMaintenance || []).filter(
                    (t) => t.year === currentYear && t.month === currentMonth
                  )
                  const done = activeMonthTasks.filter((t) => t.completed).length
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full text-left px-3 py-2.5 md:px-4 md:py-3 border-b border-theme-border last:border-0 transition ${
                        selectedId === m.id ? 'bg-primary/10' : 'hover:bg-hover-bg'
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
                      {activeMonthTasks.length > 0 && (
                        <div
                          className="flex items-center gap-1.5 ml-5 md:ml-6 mt-1.5"
                          title={`${t('maintenance.activeMonthProgress', 'Aktif Ay İlerlemesi')}: ${done}/${activeMonthTasks.length}`}
                        >
                          <div className="flex-1 h-1 md:h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all duration-300"
                              style={{ width: `${(done / activeMonthTasks.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] md:text-xs text-text-muted font-medium">{done}/{activeMonthTasks.length}</span>
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
              <p className="text-lg font-semibold text-on-surface/80 transition-all">{t('maintenance.selectMachine')}</p>
              <p className="text-sm mt-1.5 max-w-[280px] text-center leading-relaxed transition-all">
                {t('maintenance.chooseMachineDesc')}
              </p>
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
                  {t('maintenance.monthlySchedule')}
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
