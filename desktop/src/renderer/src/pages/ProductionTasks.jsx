import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import * as XLSX from 'xlsx'

const COLUMNS = [
  { id: 'open',        labelKey: 'productionTasks.colOpen',       icon: 'radio_button_unchecked', headerClass: 'bg-surface-container-high text-on-surface-variant', dotClass: 'bg-on-surface-variant/40' },
  { id: 'in-progress', labelKey: 'productionTasks.colInProgress', icon: 'pending',                headerClass: 'status-progress-badge',  dotClass: 'status-progress-dot'  },
  { id: 'completed',   labelKey: 'productionTasks.colCompleted',  icon: 'check_circle',           headerClass: 'status-completed-badge', dotClass: 'status-completed-dot' },
]

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

function CardDetailModal({ task, machines, employees, onClose, onSave, onDelete, isAdmin }) {
  const { t } = useTranslation()
  const [editing, setEditing]       = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [form, setForm] = useState({
    machineId:  task.machineId || '',
    operatorId: task.operatorId || '',
    quantity:   task.quantity || 1,
    status:     task.status || 'open',
  })
  const [errors, setErrors] = useState({})
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  function handleSave() {
    if (!form.machineId) { setErrors({ machineId: 'Required' }); return }
    if (!form.operatorId) { setErrors({ operatorId: 'Required' }); return }
    if (!form.quantity || form.quantity < 1) { setErrors({ quantity: 'Invalid' }); return }
    onSave(task.id, form)
  }

  function handleCancel() {
    setForm({
      machineId:  task.machineId || '',
      operatorId: task.operatorId || '',
      quantity:   task.quantity || 1,
      status:     task.status || 'open',
    })
    setErrors({})
    setEditing(false)
  }

  const col = COLUMNS.find((c) => c.id === task.status) ?? COLUMNS[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-3xl shadow-2xl shadow-inverse-surface/20 w-[95%] md:w-[90%] lg:w-[85%] max-w-none mx-4 flex flex-col max-h-[90vh]">

        {/* Header banner */}
        <div className="primary-gradient px-4 pt-4 pb-3 md:px-5 md:pt-5 md:pb-3 flex-shrink-0 rounded-t-3xl">
          <div className="flex items-start justify-between gap-3 md:gap-4">
            <div className="flex items-center gap-2.5 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-surface-container-lowest/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-white text-[16px] md:text-[20px]">precision_manufacturing</span>
              </div>
              <div>
                <h2 className="text-sm md:text-base font-extrabold text-white leading-tight">
                  {editing ? t('productionTasks.editTask') : `${task.orderItem?.order?.code} — ${task.orderItem?.productName}`}
                </h2>
                <p className="text-blue-200 text-[9px] md:text-[10px] font-mono mt-0.5">{task.code}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 md:p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors flex-shrink-0">
              <span className="material-symbols-outlined text-lg md:text-xl">close</span>
            </button>
          </div>

          {!editing && (
            <div className="flex items-center gap-1.5 md:gap-2 mt-2.5 md:mt-3">
              <span className="bg-surface-container-lowest/15 text-white text-[9px] md:text-[10px] font-semibold px-2 py-0.5 md:px-2.5 md:py-1 rounded-md flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] md:text-[14px]">{col.icon}</span>
                {t(col.labelKey)}
              </span>
              <span className="bg-surface-container-lowest/15 text-white text-[9px] md:text-[10px] font-semibold px-2 py-0.5 md:px-2.5 md:py-1 rounded-md">
                {t('orders.qty')}: {task.quantity}
              </span>
            </div>
          )}
        </div>

        {/* View mode */}
        {!editing && (
          <div className="px-4 md:px-6 py-4 overflow-y-auto flex-1">
            <DetailRow icon="conveyor_belt" label={t('productionTasks.machine')} value={task.machine?.name} />
            <DetailRow icon="badge" label={t('productionTasks.operator')} value={task.operator?.name} />
            <DetailRow icon="inventory_2" label={t('orders.product')} value={`${task.orderItem?.productName} (${task.quantity} ${task.orderItem?.product?.unit || 'pcs'})`} />
            <DetailRow icon="business" label={t('common.customer')} value={
              <span className="flex flex-col items-start gap-0.5">
                <span>{task.orderItem?.order?.customer?.name}</span>
                {(task.orderItem?.order?.customer?.accountCode || task.orderItem?.order?.customer?.code) && (
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                    {task.orderItem.order.customer.accountCode || task.orderItem.order.customer.code}
                  </span>
                )}
              </span>
            } />
            <DetailRow icon="calendar_today" label={t('common.created')} value={fmtDate(task.createdAt)} />
          </div>
        )}

        {/* Edit mode */}
        {editing && (
          <div className="px-4 md:px-5 py-3 md:py-4 grid grid-cols-2 gap-3 md:gap-4 overflow-y-auto flex-1">
            <Field label={t('productionTasks.machine')} icon="conveyor_belt" error={errors.machineId}>
              <select value={form.machineId} onChange={set('machineId')} className={inputCls}>
                <option value="">{t('common.select')}</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label={t('productionTasks.operator')} icon="badge" error={errors.operatorId}>
              <select value={form.operatorId} onChange={set('operatorId')} className={inputCls}>
                <option value="">{t('common.unassigned')}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label={t('orders.qty')} icon="production_quantity_limits" error={errors.quantity}>
                <input type="number" min="1" max={task.orderItem?.quantity} value={form.quantity} onChange={set('quantity')} className={inputCls} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label={t('productionTasks.status')} icon="view_kanban">
                <select value={form.status} onChange={set('status')} className={inputCls}>
                  {COLUMNS.map((c) => <option key={c.id} value={c.id}>{t(c.labelKey)}</option>)}
                </select>
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
                <p className="text-sm font-bold text-on-error-container">{t('productionTasks.deleteTask')}</p>
                <p className="text-xs text-on-error-container/70 mt-0.5">{t('common.cantUndo')}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setConfirming(false)} className="px-4 py-2 rounded-xl text-on-error-container text-xs font-bold hover:bg-error-container/60 transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={() => onDelete(task.id)} className="px-4 py-2 rounded-xl bg-error text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5">
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

function KanbanCard({ task, onClick }) {
  const { t } = useTranslation()
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
      onClick={onClick}
      className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-primary/20 active:scale-[0.98] transition-all select-none"
    >
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-bold text-on-surface leading-snug">{task.orderItem?.productName}</p>
        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">{task.quantity} {task.orderItem?.product?.unit || 'pcs'}</span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant mb-2">
        <div className="flex items-center gap-1 min-w-0">
          <span className="material-symbols-outlined text-[13px] flex-shrink-0">business</span>
          <span className="truncate flex flex-col items-start gap-0.5 min-w-0">
            <span className="truncate w-full">{task.orderItem?.order?.customer?.name || t('common.noCustomer')}</span>
            {(task.orderItem?.order?.customer?.accountCode || task.orderItem?.order?.customer?.code) && (
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider whitespace-nowrap">
                {task.orderItem.order.customer.accountCode || task.orderItem.order.customer.code}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-on-surface-variant bg-surface-container-lowest/50 p-1.5 rounded-lg border border-theme-border">
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="material-symbols-outlined text-[12px]">conveyor_belt</span>
          <span className="font-semibold">{task.machine?.name || '—'}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="material-symbols-outlined text-[12px]">badge</span>
          <span className="font-semibold">{task.operator?.name || '—'}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mt-2">
        <p className="text-[9px] text-on-surface-variant/50 font-medium">{t('reports.createdAt')} {fmtDate(task.createdAt)}</p>
        <p className="text-[9px] text-on-surface-variant/50 font-medium">#{task.orderItem?.order?.code}</p>
      </div>
    </div>
  )
}

export default function ProductionTasks() {
  const { t } = useTranslation()
  const { machines, employees, productionTasks, updateProductionTask, moveProductionTask, deleteProductionTask, isAdmin } = useData()
  const [detailTask, setDetailTask] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)
  const [search, setSearch] = useState('')

  const activeTasks = productionTasks || []

  function handleExport() {
    const rows = activeTasks.map((t) => ({
      Code: t.code,
      Order: t.orderItem?.order?.code || '',
      Customer: t.orderItem?.order?.customer?.name || '',
      Product: t.orderItem?.productName || '',
      Quantity: t.quantity,
      Machine: t.machine?.name || '',
      Operator: t.operator?.name || '',
      Status: t.status,
      'Created At': t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ProductionTasks')
    XLSX.writeFile(wb, 'production_tasks.xlsx')
  }

  const filtered = activeTasks.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (t.orderItem?.productName || '').toLowerCase().includes(q) ||
      (t.orderItem?.order?.customer?.name || '').toLowerCase().includes(q) ||
      (t.operator?.name || '').toLowerCase().includes(q) ||
      (t.machine?.name || '').toLowerCase().includes(q)
    )
  })

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDrop(e, columnId) {
    e.preventDefault()
    const id = e.dataTransfer.getData('taskId')
    if (id) moveProductionTask(id, columnId)
    setDragOverColumn(null)
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverColumn(null)
  }

  return (
    <div className="p-3 pb-24 md:p-6 md:pb-24 lg:p-8 lg:pb-24 min-h-screen bg-page-bg">
      {detailTask && (
        <CardDetailModal
          task={detailTask}
          machines={machines}
          employees={employees}
          isAdmin={isAdmin}
          onClose={() => setDetailTask(null)}
          onSave={(id, form) => { updateProductionTask(id, form); setDetailTask(null) }}
          onDelete={(id) => { deleteProductionTask(id); setDetailTask(null) }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-on-surface mb-1 md:mb-2">{t('productionTasks.title')}</h1>
          <p className="text-on-surface-variant text-xs md:text-sm lg:text-base">
            {t('productionTasks.subtitle')}
          </p>
        </div>
        <div className="flex items-stretch gap-3 md:gap-4 self-start md:self-auto">
          <div className="bg-surface-container-lowest rounded-xl lg:rounded-2xl px-4 py-2 lg:px-5 lg:py-3 flex items-center gap-3 lg:gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-surface-tint" />
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px] lg:text-[20px]">analytics</span>
            </div>
            <div className="flex items-center gap-1.5 lg:gap-2">
              <p className="text-xl lg:text-2xl font-black text-on-surface leading-none">{activeTasks.length}</p>
              <p className="text-[9px] lg:text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('productionTasks.totalTasks')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-row items-center justify-between gap-3 mb-6 md:mb-8">
        <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl w-full sm:max-w-xs md:max-w-sm">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] md:text-[20px]">search</span>
          <input
            type="text"
            placeholder={t('productionTasks.searchPlaceholder')}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 items-start">
        {COLUMNS.map((col) => {
          const colTasks = filtered.filter((t) => t.status === col.id)
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
                    {colTasks.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="p-3 flex flex-col gap-3 min-h-[140px]">
                {colTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onClick={() => setDetailTask(task)}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant/30">
                    <span className="material-symbols-outlined text-3xl">inbox</span>
                    <p className="text-xs font-medium mt-2">{t('productionTasks.noTasks')}</p>
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
