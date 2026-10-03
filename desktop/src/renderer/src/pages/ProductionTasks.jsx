import { useState, useRef, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import CreateProductionTaskModal from '../components/CreateProductionTaskModal'
import * as XLSX from 'xlsx'

const COLUMNS = [
  { id: 'open',        labelKey: 'productionTasks.colOpen',       icon: 'radio_button_unchecked', headerClass: 'bg-surface-container-high text-on-surface-variant', dotClass: 'bg-on-surface-variant/40' },
  { id: 'extrusion',   labelKey: 'productionTasks.colExtrusion',  icon: 'precision_manufacturing', headerClass: 'status-progress-badge',  dotClass: 'status-progress-dot'  },
  { id: 'cutting',     labelKey: 'productionTasks.colCutting',    icon: 'content_cut',            headerClass: 'bg-purple-100 text-purple-700',  dotClass: 'bg-purple-500'  },
  { id: 'completed',   labelKey: 'productionTasks.colCompleted',  icon: 'check_circle',           headerClass: 'status-completed-badge', dotClass: 'status-completed-dot' },
]

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getLocalTodayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

function CardDetailModal({ task, machines, employees, onClose, onSave, onDelete, isAdmin, onCreateEmployeeTask }) {
  const { t } = useTranslation()
  const todayIso = getLocalTodayIso()
  const [editing, setEditing]       = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [form, setForm] = useState({
    machineId:  task.machineId || '',
    operatorId: task.operatorId || '',
    quantity:   task.quantity || 1,
    status:     task.status || 'open',
    date:       task.date || todayIso,
  })
  const [errors, setErrors] = useState({})
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  function handleSave() {
    if (!form.machineId) { setErrors({ machineId: 'Required' }); return }
    if (!form.operatorId) { setErrors({ operatorId: 'Required' }); return }
    if (!form.quantity || form.quantity < 1) { setErrors({ quantity: 'Invalid' }); return }
    if (!form.date) { setErrors({ date: 'Required' }); return }
    onSave(task.id, form)
  }

  function handleCancel() {
    setForm({
      machineId:  task.machineId || '',
      operatorId: task.operatorId || '',
      quantity:   task.quantity || 1,
      status:     task.status || 'open',
      date:       task.date || todayIso,
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
                  {editing ? t('productionTasks.editTask') : (task.orderItem ? `${task.orderItem.order?.code} — ${task.orderItem.productName}` : `Stok Üretimi — ${task.product?.name}`)}
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
            <DetailRow icon="calendar_today" label={t('common.date') || 'Tarih'} value={fmtDate(task.date)} />
            <DetailRow icon="inventory_2" label={t('orders.product')} value={`${task.orderItem ? task.orderItem.productName : task.product?.name} (${task.quantity} ${task.orderItem?.product?.unit || task.product?.unit || 'adet'})`} />
            <DetailRow icon="business" label={t('common.customer')} value={
              <span className="flex flex-col items-start gap-0.5">
                <span>{task.orderItem?.order?.customer?.name || t('common.noCustomer')}</span>
                {task.orderItem && (task.orderItem.order?.customer?.accountCode || task.orderItem.order?.customer?.code) && (
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                    {task.orderItem.order.customer.accountCode || task.orderItem.order.customer.code}
                  </span>
                )}
              </span>
            } />
            <DetailRow icon="schedule" label={t('common.created')} value={fmtDate(task.createdAt)} />
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
              <Field label={t('common.date') || 'Tarih'} icon="event" error={errors.date}>
                <input type="date" min={todayIso} value={form.date} onChange={set('date')} className={inputCls} />
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
                <button onClick={() => onCreateEmployeeTask && onCreateEmployeeTask(task)} className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border-2 border-secondary text-secondary text-xs md:text-sm font-bold hover:bg-secondary hover:text-white transition-all flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] md:text-[18px]">assignment_add</span>
                  <span className="hidden md:inline">Görev Oluştur</span>
                </button>
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

function EmployeeTaskCreateModal({ task, employees, machines, onClose, onCreate }) {
  const { products } = useData()
  
  // Try to find a matching product ID if not explicitly set
  const matchedProductId = useMemo(() => {
    if (task.productId) return task.productId;
    if (task.orderItem?.productId) return task.orderItem.productId;
    
    // Fallback: try to match by code or name
    if (products) {
      if (task.orderItem?.productCode) {
        const matchByCode = products.find(p => p.stockNo === task.orderItem.productCode || p.code === task.orderItem.productCode);
        if (matchByCode) return matchByCode.id;
      }
      const productName = task.product?.name || task.orderItem?.productName;
      if (productName) {
        const match = products.find(p => p.name.trim().toLowerCase() === productName.trim().toLowerCase());
        if (match) return match.id;
      }
    }
    return '';
  }, [task, products]);

  const [form, setForm] = useState({
    title: task.product?.name ? `${task.product.name} için Görev` : (task.orderItem?.productName ? `${task.orderItem.productName} için Görev` : 'Yeni Görev'),
    employeeId: '',
    productId: matchedProductId,
    quantity: task.quantity || '',
    machineId: task.machineId || '',
    date: new Date().toISOString().split('T')[0],
    productionTaskId: task.id,
    orderId: task.orderItem?.orderId || '',
    status: 'open'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onCreate(form)
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-theme-border">
        <div className="p-6 border-b border-theme-border flex justify-between items-center bg-surface-container-low/30">
          <h2 className="text-xl font-black text-on-surface">Personel Görevi Oluştur</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <p className="text-xs text-on-surface-variant font-medium mb-2">
            Bu görev, <span className="font-bold text-on-surface">{task.code}</span> numaralı üretim planına bağlanacaktır.
          </p>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Görev Başlığı / Açıklama</label>
            <input required type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface text-sm outline-none focus:border-primary transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Ürün / Malzeme</label>
              <select value={form.productId} onChange={e => setForm({...form, productId: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface text-sm outline-none focus:border-primary transition-colors">
                <option value="">Seçiniz... (Opsiyonel)</option>
                {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Miktar</label>
              <input required type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface text-sm outline-none focus:border-primary transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Tarih</label>
            <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface text-sm outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Personel</label>
            <select required value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface text-sm outline-none focus:border-primary transition-colors">
              <option value="">Seçiniz...</option>
              {employees.filter(e => e.status === 'Active').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Makine (Opsiyonel)</label>
            <select value={form.machineId} onChange={e => setForm({...form, machineId: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface text-sm outline-none focus:border-primary transition-colors">
              <option value="">Yok</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Başlangıç Statüsü</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface text-sm outline-none focus:border-primary transition-colors">
              <option value="open">Açık Görev</option>
              <option value="extrusion">Ekstrüzyonda</option>
              <option value="cutting">Kesimde</option>
              <option value="completed">Tamamlandı</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-primary text-on-primary font-bold py-3 rounded-xl mt-4 hover:opacity-90 transition-opacity">
            Görevi Kaydet
          </button>
        </form>
      </div>
    </div>
  )
}

const STATUS_STYLES = {
  open: { bg: 'bg-slate-500/5 dark:bg-slate-500/10', labelBg: 'bg-slate-500/10 dark:bg-slate-500/20', border: 'border-slate-300 dark:border-slate-700/60', text: 'text-slate-600 dark:text-slate-400' },
  extrusion: { bg: 'bg-orange-500/5 dark:bg-orange-500/10', labelBg: 'bg-orange-500/10 dark:bg-orange-500/20', border: 'border-orange-400/60 dark:border-orange-700/60', text: 'text-orange-600 dark:text-orange-400' },
  cutting: { bg: 'bg-purple-500/5 dark:bg-purple-500/10', labelBg: 'bg-purple-500/10 dark:bg-purple-500/20', border: 'border-purple-400/60 dark:border-purple-700/60', text: 'text-purple-600 dark:text-purple-400' },
  completed: { bg: 'bg-green-500/5 dark:bg-green-500/10', labelBg: 'bg-green-500/10 dark:bg-green-500/20', border: 'border-green-400/60 dark:border-green-700/60', text: 'text-green-600 dark:text-green-400' }
}

function KanbanCard({ task, onClick, locked }) {
  const { t } = useTranslation()
  const statusDef = STATUS_STYLES[task.status] || STATUS_STYLES.open
  const statusLabel = t(`productionTasks.col${task.status.charAt(0).toUpperCase() + task.status.slice(1)}`)

  return (
    <div
      draggable={!locked}
      onDragStart={(e) => {
        if (!locked) {
          e.dataTransfer.setData('text/plain', String(task.id))
        }
      }}
      onClick={onClick}
      className={`relative ${statusDef.bg} rounded-xl p-3 sm:p-4 shadow-sm border ${statusDef.border} cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all select-none w-full ${locked ? 'opacity-80 grayscale-[20%]' : 'active:scale-[0.98]'}`}
    >
      <div className={`absolute top-0 right-0 rounded-bl-xl rounded-tr-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusDef.labelBg} ${statusDef.text}`}>
        {statusLabel}
      </div>

      <div className="flex justify-between items-start mb-2 mt-2">
        <p className="text-sm font-bold text-on-surface leading-snug pr-12">{task.orderItem ? task.orderItem.productName : task.product?.name}</p>
        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">{task.quantity} {task.orderItem ? task.orderItem.product?.unit : task.product?.unit || 'pcs'}</span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant mb-2">
        <div className="flex items-center gap-1 min-w-0">
          {task.orderItem ? (
            <>
              <span className="material-symbols-outlined text-[13px] flex-shrink-0">business</span>
              <span className="truncate flex flex-col items-start gap-0.5 min-w-0">
                <span className="truncate w-full">{task.orderItem.order?.customer?.name || t('common.noCustomer')}</span>
                {(task.orderItem.order?.customer?.accountCode || task.orderItem.order?.customer?.code) && (
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider whitespace-nowrap">
                    {task.orderItem.order.customer.accountCode || task.orderItem.order.customer.code}
                  </span>
                )}
              </span>
            </>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined text-[14px] text-primary">inventory_2</span>
              <span className="text-[10px] font-black text-primary tracking-wider uppercase">Stok İçin Üretim</span>
            </div>
          )}
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
        <p className="text-[9px] text-on-surface-variant/50 font-medium">
          #{task.orderItem?.order?.code || 'STOK'}
        </p>
      </div>
    </div>
  )
}

function EodWizardModal({ tasks, onProcess, onClose }) {
  const { t } = useTranslation()
  const todayIso = getLocalTodayIso()
  
  const [initialTasks] = useState(tasks)
  const [currentIndex, setCurrentIndex] = useState(0)
  const task = initialTasks[currentIndex]
  
  const [action, setAction] = useState('rollover')
  const [targetStatus, setTargetStatus] = useState(task?.status || 'open')
  const [completedQty, setCompletedQty] = useState(0)
  
  const [distributions, setDistributions] = useState({ completed: 0, open: 0, extrusion: 0, cutting: 0 })

  if (!task) return null

  const isProd = task.status === 'extrusion' || task.status === 'cutting'

  const distTotal = (parseInt(distributions.completed) || 0) + 
                    (parseInt(distributions.open) || 0) + 
                    (parseInt(distributions.extrusion) || 0) + 
                    (parseInt(distributions.cutting) || 0)
  const isDistValid = distTotal === task.quantity

  async function handleNext() {
    if (action === 'split' && isProd) {
      await onProcess({
        taskId: task.id,
        action: 'distribute',
        targetDate: todayIso,
        distributions
      })
    } else {
      await onProcess({
         taskId: task.id,
         action,
         targetDate: todayIso,
         targetStatus,
         completedQuantity: completedQty
      })
    }
    
    if (currentIndex < initialTasks.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setAction('rollover')
      setTargetStatus(initialTasks[currentIndex + 1].status || 'open')
      setCompletedQty(0)
      setDistributions({ completed: 0, open: 0, extrusion: 0, cutting: 0 })
    }
  }

  const isNextDisabled = action === 'split' && (
    isProd ? !isDistValid : (completedQty < 1 || completedQty >= task.quantity)
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
       <div className="bg-surface-container-lowest rounded-2xl w-[95%] md:w-[500px] p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
          <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-error transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
          <div className="flex items-center gap-3 text-error mb-4">
            <span className="material-symbols-outlined text-3xl">warning</span>
            <h2 className="text-lg font-bold">Geçmişten Kalan Görevler ({currentIndex + 1}/{initialTasks.length})</h2>
          </div>
          <p className="text-sm text-on-surface-variant mb-6">
            Dünden veya daha eski tarihlerden kalan tamamlanmamış görevler var. Bugünün panosuna geçmeden önce bu görevlere ne olacağına karar vermelisiniz.
          </p>

          <div className="bg-surface-container-low p-4 rounded-xl mb-6">
             <p className="font-bold text-sm mb-1">{task.orderItem ? task.orderItem.productName : task.product?.name}</p>
             <p className="text-xs text-on-surface-variant">Toplam Miktar: {task.quantity} {task.orderItem ? task.orderItem.product?.unit : task.product?.unit || 'pcs'}</p>
             <p className="text-xs text-on-surface-variant mt-1">Eski Tarih: {task.date} | Eski Statü: {t(`productionTasks.col${task.status.charAt(0).toUpperCase() + task.status.slice(1)}`)}</p>
          </div>

          <div className="space-y-4">
             <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                <input type="radio" checked={action === 'rollover'} onChange={() => setAction('rollover')} className="w-4 h-4 text-primary" />
                Tamamını Bugüne Devret
             </label>
             <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                <input type="radio" checked={action === 'split'} onChange={() => setAction('split')} className="w-4 h-4 text-primary" />
                Bölerek Devret (Kısmi Tamamlama)
             </label>

             {action === 'split' && !isProd && (
               <div className="pl-6 flex flex-col gap-2">
                 <label className="text-xs font-bold text-on-surface-variant">Eski Tarihte Tamamlanan Miktar</label>
                 <input type="number" min="1" max={task.quantity - 1} value={completedQty} onChange={e => setCompletedQty(e.target.value)} className="bg-surface-container-high border-none outline-none p-2 rounded-md text-sm w-32 focus:ring-2 ring-primary" />
               </div>
             )}

             {action === 'split' && isProd && (
               <div className="pl-6 flex flex-col gap-3 mt-2">
                 <p className="text-xs font-medium text-on-surface-variant mb-1 border-b border-theme-border pb-2">
                   Lütfen bu <span className="font-bold text-on-surface">{task.quantity}</span> adetlik görevin nasıl sonuçlandığını dağıtın:
                 </p>
                 <div className="grid grid-cols-2 gap-3">
                   <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-bold text-on-surface-variant">Dün Biten (Completed)</label>
                     <input type="number" min="0" max={task.quantity} value={distributions.completed} onChange={e => setDistributions(d => ({ ...d, completed: e.target.value }))} className="bg-surface-container-high border-none outline-none p-2 rounded-md text-sm focus:ring-2 ring-primary" />
                   </div>
                   <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-bold text-on-surface-variant">Bugün Açık (Open)</label>
                     <input type="number" min="0" max={task.quantity} value={distributions.open} onChange={e => setDistributions(d => ({ ...d, open: e.target.value }))} className="bg-surface-container-high border-none outline-none p-2 rounded-md text-sm focus:ring-2 ring-primary" />
                   </div>
                   <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-bold text-on-surface-variant">Bugün Ekstrüzyonda</label>
                     <input type="number" min="0" max={task.quantity} value={distributions.extrusion} onChange={e => setDistributions(d => ({ ...d, extrusion: e.target.value }))} className="bg-surface-container-high border-none outline-none p-2 rounded-md text-sm focus:ring-2 ring-primary" />
                   </div>
                   <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-bold text-on-surface-variant">Bugün Kesimde</label>
                     <input type="number" min="0" max={task.quantity} value={distributions.cutting} onChange={e => setDistributions(d => ({ ...d, cutting: e.target.value }))} className="bg-surface-container-high border-none outline-none p-2 rounded-md text-sm focus:ring-2 ring-primary" />
                   </div>
                 </div>
                 <div className={`text-xs font-bold mt-2 ${isDistValid ? 'text-success' : 'text-error'}`}>
                   Dağıtılan Toplam: {distTotal} / {task.quantity} {isDistValid ? '✓' : '✗'}
                 </div>
               </div>
             )}

             {(action === 'rollover' || (action === 'split' && !isProd)) && (
               <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-theme-border">
                  <label className="text-xs font-bold text-on-surface-variant">Bugün Hangi Aşamadan Devam Edecek?</label>
                  <select value={targetStatus} onChange={e => setTargetStatus(e.target.value)} className="bg-surface-container-high border-none outline-none p-2.5 rounded-md text-sm w-full focus:ring-2 ring-primary font-semibold">
                     <option value="open">{t('productionTasks.colOpen')}</option>
                     <option value="extrusion">{t('productionTasks.colExtrusion')}</option>
                     <option value="cutting">{t('productionTasks.colCutting')}</option>
                  </select>
               </div>
             )}
          </div>

          <div className="flex justify-end mt-8">
             <button onClick={handleNext} disabled={isNextDisabled} className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all">
               Onayla ve Geç
             </button>
          </div>
       </div>
     </div>
  )
}

function PendingMoveModal({ moveData, machines, employees, onClose, onConfirm }) {
  const { t } = useTranslation()
  const { task, columnId } = moveData
  
  // Default values from orderItem (if planned)
  const isExtrusion = columnId === 'extrusion'
  const isCutting = columnId === 'cutting'

  const targetMachines = machines.filter(m => m.type === (isExtrusion ? 'Extrusion' : 'Cutting') || !m.type || m.type === 'General')
  
  const plannedMachineId = isExtrusion ? task.orderItem?.extrusionMachineId : (isCutting ? task.orderItem?.cuttingMachineId : '')
  const plannedOperatorId = isExtrusion ? task.orderItem?.extrusionOperatorId : (isCutting ? task.orderItem?.cuttingOperatorId : '')

  const [form, setForm] = useState({
    machineId: task.machineId || plannedMachineId || '',
    operatorId: task.operatorId || plannedOperatorId || ''
  })
  const [errors, setErrors] = useState({})
  const [isSplitting, setIsSplitting] = useState(false)
  const [splitQuantity, setSplitQuantity] = useState(task.quantity)

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  function handleConfirm() {
    const e = {}
    const needsAssignment = isExtrusion || isCutting
    if (needsAssignment && !form.machineId) e.machineId = 'Required'
    if (needsAssignment && !form.operatorId) e.operatorId = 'Required'
    if (isSplitting && (splitQuantity <= 0 || splitQuantity >= task.quantity)) e.splitQuantity = 'Invalid'
    
    if (Object.keys(e).length > 0) {
      setErrors(e)
      return
    }
    onConfirm({ ...form, splitQuantity: isSplitting ? Number(splitQuantity) : undefined })
  }

  const columnLabel = COLUMNS.find((c) => c.id === columnId)?.labelKey ? t(COLUMNS.find((c) => c.id === columnId).labelKey) : columnId
  const icon = COLUMNS.find((c) => c.id === columnId)?.icon || 'move_up'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3 md:p-6" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-[95%] md:w-[400px] max-w-none p-4 md:p-6 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined">{icon}</span> 
            Aşama Geçişi: {columnLabel}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-error">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mb-4 bg-surface-container-high rounded-xl p-3">
          <p className="text-xs font-bold text-on-surface mb-1">{task.orderItem ? task.orderItem.productName : task.product?.name}</p>
          <p className="text-[11px] text-text-muted">Bu görev {columnLabel} aşamasına geçiyor. Toplam miktar: {task.quantity}.</p>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer text-on-surface">
            <input type="checkbox" checked={isSplitting} onChange={(e) => setIsSplitting(e.target.checked)} className="w-4 h-4 text-primary" />
            Görevi Parçala (Bir kısmını önceki aşamada bırak)
          </label>
          
          {isSplitting && (
            <div className="pl-6">
              <label className="block text-xs font-semibold text-text-muted mb-1">Yeni Aşamaya Geçecek Miktar *</label>
              <input type="number" min="1" max={task.quantity - 1} value={splitQuantity} onChange={e => setSplitQuantity(e.target.value)} className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-sm text-on-surface outline-none focus:border-primary ${errors.splitQuantity ? 'border-error' : 'border-theme-border'}`} />
              <p className="text-[10px] text-text-muted mt-1">{task.quantity - splitQuantity} adet mevcut aşamasında kalacak.</p>
            </div>
          )}

          {(isExtrusion || isCutting) && (
            <>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">{t('productionTasks.machine')} *</label>
                <select className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-sm text-on-surface outline-none focus:border-primary ${errors.machineId ? 'border-error' : 'border-theme-border'}`} value={form.machineId} onChange={set('machineId')}>
                  <option value="">{t('common.select')}</option>
                  {targetMachines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.type || 'General'})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">{t('productionTasks.operator')} *</label>
                <select className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-sm text-on-surface outline-none focus:border-primary ${errors.operatorId ? 'border-error' : 'border-theme-border'}`} value={form.operatorId} onChange={set('operatorId')}>
                  <option value="">{t('common.select')}</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-theme-border rounded-lg py-2 text-sm text-text-muted hover:bg-hover-bg transition">
            {t('common.cancel')}
          </button>
          <button onClick={handleConfirm} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 transition">
            Onayla ve Taşı
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProductionTasks() {
  const { t } = useTranslation()
  const { 
    machines, 
    employees, 
    productionTasks, 
    updateProductionTask, 
    moveProductionTask, 
    deleteProductionTask, 
    rolloverProductionTask, 
    isAdmin,
    orders,
    products,
    permissions,
    employeePermissions,
    addProductionTask,
    createEmployeeTask
  } = useData()
  const { user: currentUser } = useAuth()
  const location = useLocation()
  
  const empId = currentUser?.employeeId
  const activeEmployee = employees?.find(e => e.id === empId)
  const activeDept = activeEmployee?.department || currentUser?.department
  const empPerms = employeePermissions?.[empId] || []
  const deptPerms = permissions[activeDept] || []
  const isActDenied = empPerms.includes('-production-start')
  const hasEmpAct = empPerms.includes('production-start')
  const hasDeptAct = deptPerms.includes('production-start')
  const canAct = isAdmin || (!isActDenied && (hasDeptAct || hasEmpAct))

  const [detailTask, setDetailTask] = useState(null)
  const [employeeTaskModal, setEmployeeTaskModal] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewMode, setViewMode] = useState('agenda')
  const [pendingMove, setPendingMove] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)
  const [search, setSearch] = useState('')
  const dateInputRef = useRef(null)

  const todayIso = getLocalTodayIso()
  const [currentDate, setCurrentDate] = useState(todayIso)
  const [isWizardDismissed, setIsWizardDismissed] = useState(false)

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(currentDate)
      d.setDate(d.getDate() + i)
      const dateString = d.toISOString().split('T')[0]
      const isToday = todayIso === dateString
      const shortName = d.toLocaleDateString('tr-TR', { weekday: 'long' })
      const dateNumber = d.getDate()
      const monthName = d.toLocaleDateString('tr-TR', { month: 'short' })
      return { date: d, dateString, isToday, shortName, dateNumber, monthName }
    })
  }, [currentDate, todayIso])

  useEffect(() => {
    if (location.state?.openTaskId && productionTasks) {
      const taskToOpen = productionTasks.find(t => t.id === location.state.openTaskId)
      if (taskToOpen) {
        setDetailTask(taskToOpen)
        // Clear the state so it doesn't reopen on subsequent renders if closed
        window.history.replaceState({}, document.title)
      }
    }
  }, [location.state, productionTasks])

  const visibleTasks = useMemo(() => {
    if (isAdmin || canAct) return productionTasks || []
    return (productionTasks || []).filter(t => t.operatorId === empId)
  }, [productionTasks, isAdmin, empId, canAct])

  // Find tasks that belong to past days and are not completed
  const pendingPastTasks = visibleTasks.filter(t => t.date && t.date < todayIso && t.status !== 'completed')
  const showEodWizard = pendingPastTasks.length > 0

  // activeTasks corresponds to tasks in the 7 days window (agenda) or just currentDate (kanban)
  const endDateString = daysOfWeek[6].dateString
  const activeTasks = visibleTasks.filter(t => {
    const taskDate = t.date || todayIso
    if (viewMode === 'kanban') {
      return taskDate === currentDate
    }
    return taskDate >= currentDate && taskDate <= endDateString
  })

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
    if (showEodWizard) return;
    e.preventDefault()
  }

  function handleDropToStatus(e, targetStatusId) {
    if (showEodWizard || currentDate < todayIso) return;
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (id) {
      const task = productionTasks.find(t => String(t.id) === String(id))
      if (task && task.status !== targetStatusId) {
        setPendingMove({ task, columnId: targetStatusId })
      }
    }
    setDragOverColumn(null)
  }

  function handleDropToDay(e, targetDateString) {
    if (showEodWizard || targetDateString < todayIso) {
      alert("Geçmiş güne veya sihirbaz açıkken taşıyamazsınız.");
      return;
    }
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (!id) {
      alert("Görev ID'si alınamadı (drag-drop engellendi).");
      return;
    }
    const task = productionTasks.find(t => String(t.id) === String(id))
    if (!task) {
      alert("Görev bulunamadı.");
      return;
    }
    if ((task.date || todayIso) === targetDateString) {
      return;
    }
    
    const extraData = {
      machineId: task.machineId || null,
      operatorId: task.operatorId || null,
      date: targetDateString,
    }
    
    // updateProductionTask sessizce tarihi ignore ediyorsa, 'move' endpoint'ini deneyelim.
    moveProductionTask(task.id, task.status, extraData).then(() => {
      // success, DataContext will refresh tasks
    }).catch(err => {
      console.error('Drag drop error:', err)
      alert('Tarih güncellenirken hata oluştu: ' + err.message)
    })
    
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
          onSave={(id, form) => { 
            if (form.status !== detailTask.status) {
              setPendingMove({
                task: { ...detailTask, ...form, id },
                columnId: form.status,
                oldStatus: detailTask.status,
                originalForm: form
              })
              setDetailTask(null)
            } else {
              updateProductionTask(id, form); 
              setDetailTask(null) 
            }
          }}
          onDelete={(id) => { deleteProductionTask(id); setDetailTask(null) }}
          onCreateEmployeeTask={(task) => {
             setDetailTask(null)
             setEmployeeTaskModal(task)
          }}
        />
      )}

      {employeeTaskModal && (
        <EmployeeTaskCreateModal
          task={employeeTaskModal}
          employees={employees}
          machines={machines}
          onClose={() => setEmployeeTaskModal(null)}
          onCreate={async (formData) => {
             try {
                await createEmployeeTask(formData)
                setEmployeeTaskModal(null)
             } catch(e) {
                alert(e.message)
             }
          }}
        />
      )}

      {pendingMove && (
        <PendingMoveModal
          moveData={pendingMove}
          machines={machines}
          employees={employees}
          onClose={() => setPendingMove(null)}
          onConfirm={async (extraData) => {
            if (pendingMove.originalForm) {
              const { status, ...restForm } = pendingMove.originalForm
              try {
                await updateProductionTask(pendingMove.task.id, { ...restForm, status: pendingMove.oldStatus })
              } catch (err) {
                console.error("Failed to apply pre-move updates:", err)
              }
            }
            moveProductionTask(pendingMove.task.id, pendingMove.columnId, extraData)
            setPendingMove(null)
          }}
        />
      )}
      
      {showEodWizard && !isWizardDismissed && (
        <EodWizardModal 
          tasks={pendingPastTasks} 
          onClose={() => setIsWizardDismissed(true)}
          onProcess={async (data) => {
            try {
              await rolloverProductionTask(data)
            } catch (err) {
              alert(err.message)
            }
          }} 
        />
      )}

      {showCreateModal && (
        <CreateProductionTaskModal
          onClose={() => setShowCreateModal(false)}
          onSave={async (form) => {
            try {
              await addProductionTask(form)
              setShowCreateModal(false)
            } catch (err) {
              alert(err.message)
            }
          }}
          machines={machines}
          employees={employees}
          orders={orders}
          products={products}
        />
      )}

      {showEodWizard && isWizardDismissed && (
        <div className="bg-error/10 border border-error/40 text-error rounded-2xl p-4 md:p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm cursor-pointer hover:bg-error/20 transition-all select-none" onClick={() => setIsWizardDismissed(false)}>
          <div className="flex items-center gap-3 md:gap-4">
             <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center flex-shrink-0">
               <span className="material-symbols-outlined text-error text-2xl">warning</span>
             </div>
             <div>
                <h2 className="text-sm md:text-base font-extrabold">Geçmişten Kalan Görevler Bekliyor</h2>
                <p className="text-xs md:text-sm opacity-90 mt-0.5">Bugünün panosunda işlem yapabilmek için önce geçmişteki <span className="font-bold">{pendingPastTasks.length}</span> görevi çözüme kavuşturmalısınız.</p>
             </div>
          </div>
          <button className="w-full sm:w-auto bg-error text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:opacity-90 shadow-md whitespace-nowrap active:scale-95 transition-all">
            Çözüme Kavuştur
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-6 md:mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1 md:mb-2">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-on-surface">{t('productionTasks.title')}</h1>
          </div>
          <p className="text-on-surface-variant text-xs md:text-sm lg:text-base">
            {t('productionTasks.subtitle')}
          </p>
        </div>
        <div className="flex items-stretch gap-3 md:gap-4 self-start md:self-auto">
          {/* Date Navigation */}
          <div className="bg-surface-container-lowest border border-theme-border rounded-xl lg:rounded-2xl flex items-center p-1">
            <button 
              onClick={() => {
                const d = new Date(currentDate)
                d.setDate(d.getDate() - (viewMode === 'agenda' ? 7 : 1))
                setCurrentDate(d.toISOString().split('T')[0])
              }}
              className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors text-on-surface-variant flex items-center justify-center"
              title={viewMode === 'agenda' ? 'Önceki Hafta' : 'Önceki Gün'}
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            
            <div 
              onClick={() => dateInputRef.current?.showPicker()}
              className="px-2 lg:px-3 py-1.5 lg:py-2 flex items-center gap-2 cursor-pointer hover:bg-surface-container-low transition-colors select-none rounded-lg"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">calendar_month</span>
              <input 
                ref={dateInputRef}
                type="date" 
                value={currentDate} 
                onChange={e => setCurrentDate(e.target.value)}
                className="bg-transparent border-none outline-none text-xs md:text-sm font-bold text-on-surface uppercase tracking-wider cursor-pointer w-[100px] md:w-[110px] pointer-events-none [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </div>

            <button 
              onClick={() => {
                const d = new Date(currentDate)
                d.setDate(d.getDate() + (viewMode === 'agenda' ? 7 : 1))
                setCurrentDate(d.toISOString().split('T')[0])
              }}
              className="p-1.5 hover:bg-surface-container-high rounded-lg transition-colors text-on-surface-variant flex items-center justify-center"
              title={viewMode === 'agenda' ? 'Sonraki Hafta' : 'Sonraki Gün'}
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>

          {currentDate !== todayIso && (
            <button 
              onClick={() => setCurrentDate(todayIso)}
              className="hidden lg:flex px-4 py-2 bg-surface-container-lowest border border-theme-border hover:bg-surface-container-low rounded-xl items-center justify-center transition-colors text-xs font-bold text-on-surface select-none"
            >
              Bugün
            </button>
          )}

          {/* View Toggle */}
          <div className="hidden md:flex bg-surface-container-lowest border border-theme-border rounded-xl lg:rounded-2xl p-1 items-center">
            <button 
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-xs font-bold ${viewMode === 'agenda' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container'}`}
            >
              <span className="material-symbols-outlined text-[16px]">view_agenda</span>
              Haftalık
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-xs font-bold ${viewMode === 'kanban' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container'}`}
            >
              <span className="material-symbols-outlined text-[16px]">view_kanban</span>
              Günlük
            </button>
          </div>

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
        <div className="flex items-center gap-3">
          {canAct && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="primary-gradient text-white px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-1.5 md:gap-2 flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[18px] md:text-[20px]">add</span>
              <span className="hidden md:inline">Yeni Görev Oluştur</span>
            </button>
          )}
          <button
            onClick={handleExport}
            className="primary-gradient text-white px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-1.5 md:gap-2 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">download</span>
            <span className="hidden md:inline">{t('common.export')}</span>
          </button>
        </div>
      </div>

      {viewMode === 'agenda' ? (
        <div className="flex flex-col gap-4 md:gap-5">
          {/* 7-Day Agenda Board */}
          {daysOfWeek.map(day => {
            const dayTasks = filtered.filter(t => (t.date || todayIso) === day.dateString)
            const isPast = day.dateString < todayIso

            return (
              <div 
                key={day.dateString}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropToDay(e, day.dateString)}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setDragOverColumn(day.dateString)
                }}
                onDragLeave={handleDragLeave}
                className={`bg-surface-container-lowest border border-theme-border rounded-2xl flex flex-col transition-all overflow-hidden shadow-sm ${
                  dragOverColumn === day.dateString ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
              >
                {/* Row Header */}
                <div className={`px-4 py-3 flex items-center justify-between border-b border-theme-border ${day.isToday ? 'bg-primary/5' : 'bg-surface-container-high/30'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl font-black ${day.isToday ? 'text-primary' : 'text-on-surface'}`}>{day.dateNumber}</span>
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold uppercase tracking-widest ${day.isToday ? 'text-primary' : 'text-on-surface-variant'}`}>{day.shortName}</span>
                      <span className="text-[10px] text-on-surface-variant font-semibold">{day.monthName}</span>
                    </div>
                    {day.isToday && (
                      <span className="ml-2 bg-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">BUGÜN</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-surface-container text-on-surface-variant text-xs font-black px-2 py-1 rounded-lg">{dayTasks.length} {t('productionTasks.totalTasks')}</span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="p-4 flex flex-wrap gap-4 min-h-[100px] items-start">
                  {dayTasks.map(task => (
                    <div key={task.id} className="w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.33%-11px)] xl:w-[calc(25%-12px)]">
                      <KanbanCard
                        task={task}
                        locked={isPast || showEodWizard}
                        onClick={() => {
                          if (!showEodWizard) setDetailTask(task)
                        }}
                      />
                    </div>
                  ))}
                  {dayTasks.length === 0 && (
                    <div className="w-full py-6 flex flex-col items-center justify-center text-on-surface-variant/40">
                      <span className="material-symbols-outlined text-3xl mb-1">free_cancellation</span>
                      <p className="text-[10px] font-bold uppercase tracking-wider">Görev Yok</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 items-start">
          {/* Kanban board */}
          {COLUMNS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.id)
            const isPastBoard = currentDate < todayIso
            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropToStatus(e, col.id)}
                onDragEnter={(e) => {
                e.preventDefault()
                setDragOverColumn(col.id)
              }}
                onDragLeave={handleDragLeave}
                className={`bg-surface-container-lowest rounded-2xl flex flex-col transition-all ${
                  dragOverColumn === col.id ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
              >
                {/* Column header */}
                <div className={`${col.headerClass} rounded-t-2xl px-3 md:px-4 py-2 flex items-center justify-between border-b border-theme-border`}>
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
                      locked={isPastBoard || showEodWizard}
                      onClick={() => {
                        if (!showEodWizard) setDetailTask(task)
                      }}
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
      )}
    </div>
  )
}
