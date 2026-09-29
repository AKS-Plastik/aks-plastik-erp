import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'

const PRODUCTION_STATUSES = ['Confirmed', 'In-Production', 'Production Completed']

const statusStyle = {
  Processing: 'bg-amber-100 text-amber-700',
  Confirmed: 'bg-primary-fixed text-on-primary-fixed-variant',
  'In-Production': 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  'Production Completed': 'bg-green-100 text-green-700',
}

const statusNext = {
  Confirmed: 'In-Production',
  'In-Production': 'Production Completed',
}

const statusIcon = {
  Confirmed: 'check_circle',
  'In-Production': 'precision_manufacturing',
  'Production Completed': 'done_all',
}

const statusColor = {
  Confirmed: 'text-primary',
  'In-Production': 'text-tertiary',
  'Production Completed': 'text-green-600',
}

// ─── Send To Production Modal ───────────────────────────────────────────────────
function SendToProductionModal({ item, onClose, onSave, machines, employees }) {
  const { t } = useTranslation()
  const remaining = item.quantity - (item.producedQuantity || 0) - (item.inProductionQuantity || 0)
  const extrusionMachines = machines.filter(m => m.type === 'Extrusion' || !m.type || m.type === 'General')
  const cuttingMachines = machines.filter(m => m.type === 'Cutting' || !m.type || m.type === 'General')

  const [form, setForm] = useState({
    extrusionMachineId: '',
    extrusionOperatorId: '',
    cuttingMachineId: '',
    cuttingOperatorId: '',
    quantity: remaining,
  })
  const [errors, setErrors] = useState({})

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  function handleSave() {
    const e = {}
    if (!form.quantity || form.quantity < 1 || form.quantity > remaining) e.quantity = 'Invalid'

    if (Object.keys(e).length > 0) {
      setErrors(e)
      return
    }

    onSave({ ...form, orderItemId: item.id })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3 md:p-6" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-[95%] md:w-[400px] max-w-none p-4 md:p-6 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-on-surface">{t('orders.sendToProduction')}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-error">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mb-4 bg-surface-container-high rounded-xl p-3">
          <p className="text-xs font-bold text-on-surface mb-1">{item.productName}</p>
          <div className="flex justify-between text-[11px] text-text-muted">
            <span>{t('orders.total')}: {item.quantity}</span>
            <span>{t('orders.remaining')}: {remaining}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Extrusion Section */}
            <div className="space-y-3 bg-surface-container-high/50 p-3 rounded-xl border border-theme-border">
              <h3 className="text-xs font-bold text-on-surface flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">precision_manufacturing</span> {t('production.extrusionPlan')}</h3>
              <div>
                <label className="block text-[10px] font-semibold text-text-muted mb-1">{t('productionTasks.machine')}</label>
                <select className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-[11px] text-on-surface outline-none focus:border-primary border-theme-border`} value={form.extrusionMachineId} onChange={set('extrusionMachineId')}>
                  <option value="">{t('common.select')}</option>
                  {extrusionMachines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.type || 'General'})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-text-muted mb-1">{t('productionTasks.operator')}</label>
                <select className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-[11px] text-on-surface outline-none focus:border-primary border-theme-border`} value={form.extrusionOperatorId} onChange={set('extrusionOperatorId')}>
                  <option value="">{t('common.select')}</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            </div>

            {/* Cutting Section */}
            <div className="space-y-3 bg-surface-container-high/50 p-3 rounded-xl border border-theme-border">
              <h3 className="text-xs font-bold text-on-surface flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">content_cut</span> {t('production.cuttingPlan')}</h3>
              <div>
                <label className="block text-[10px] font-semibold text-text-muted mb-1">{t('productionTasks.machine')}</label>
                <select className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-[11px] text-on-surface outline-none focus:border-primary border-theme-border`} value={form.cuttingMachineId} onChange={set('cuttingMachineId')}>
                  <option value="">{t('common.select')}</option>
                  {cuttingMachines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.type || 'General'})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-text-muted mb-1">{t('productionTasks.operator')}</label>
                <select className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-[11px] text-on-surface outline-none focus:border-primary border-theme-border`} value={form.cuttingOperatorId} onChange={set('cuttingOperatorId')}>
                  <option value="">{t('common.select')}</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">{t('orders.qty')} *</label>
            <input type="number" min="1" max={remaining} className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-sm text-on-surface outline-none focus:border-primary ${errors.quantity ? 'border-error' : 'border-theme-border'}`} value={form.quantity} onChange={set('quantity')} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-theme-border rounded-lg py-2 text-sm text-text-muted hover:bg-hover-bg transition">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 transition">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────
function OrderDetailModal({ order, onClose, onAdvance, canAct, canChangeTo, machines, employees, addProductionTask }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [productionItem, setProductionItem] = useState(null)
  const subtotal = (order.items || []).reduce(
    (s, it) => s + (parseFloat(it.unitPrice) || 0) * (parseInt(it.quantity) || 0), 0
  )
  const vatAmount = subtotal * ((order.vat || 0) / 100)
  const currency = order.items?.[0]?.currency || 'TRY'
  const next = statusNext[order.status]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-[95%] md:w-[90%] max-w-none p-5 md:p-8 max-h-[90vh] overflow-y-auto mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] md:text-xs font-mono text-text-muted mb-1">{order.code}</p>
            <h2 className="text-lg md:text-xl font-bold text-on-surface flex flex-col items-start gap-1">
              <span>{order.customer?.name || '—'}</span>
              {(order.customer?.accountCode || order.customer?.code) && (
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest">
                  {order.customer.accountCode || order.customer.code}
                </span>
              )}
            </h2>
            <p className="text-xs md:text-sm text-text-muted mt-0.5">{t('orders.salesRep')}: {order.salesRep?.name || order.employee?.name || '—'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${statusStyle[order.status] || 'bg-surface-container-high text-text-muted'}`}>
              {order.status}
            </span>
            <button onClick={onClose} className="text-text-muted hover:text-error">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Line Items */}
        <div className="rounded-xl border border-theme-border mb-4 overflow-hidden">
          <table className="w-full text-xs md:text-sm block md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-surface-container-high text-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-3 md:px-4 py-2 md:py-2.5 font-semibold">{t('products.stockNo')}</th>
                <th className="text-left px-3 md:px-4 py-2 md:py-2.5 font-semibold">{t('orders.product')}</th>
                <th className="text-right px-3 md:px-4 py-2 md:py-2.5 font-semibold">{t('orders.qty')}</th>
                <th className="text-right px-3 md:px-4 py-2 md:py-2.5 font-semibold">{t('orders.unitPrice')}</th>
                <th className="text-right px-3 md:px-4 py-2 md:py-2.5 font-semibold">{t('orders.lineTotal')}</th>
                <th className="text-center px-3 md:px-4 py-2 md:py-2.5 font-semibold">{t('productionTasks.title')}</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {(order.items || []).map((it, i) => {
                const produced = it.producedQuantity || 0
                const inProd = it.inProductionQuantity || 0
                const remaining = it.quantity - produced - inProd
                const canProduce = remaining > 0
                const activeTasks = (it.productionTasks || []).filter(task => task.status !== 'completed')

                return (
                <tr key={i} className="block md:table-row border-t border-theme-border py-2 md:py-0 bg-surface-container-lowest md:bg-transparent">
                  <td className="block md:table-cell w-full md:w-auto relative px-3 md:px-4 py-1 md:py-3 font-mono text-xs text-text-muted">
                    <div className="flex items-center justify-between md:justify-start">
                      <span className="md:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('products.stockNo')}</span>
                      <span>{it.product?.stockNo || '—'}</span>
                    </div>
                  </td>
                  <td className="block md:table-cell w-full md:w-auto relative px-3 md:px-4 py-1 md:py-3 text-on-surface font-medium">
                    <div className="flex items-start md:items-center justify-between md:justify-start gap-4">
                      <span className="md:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted pt-0.5">{t('orders.product')}</span>
                      <span className="text-right md:text-left flex-1">{it.productName}</span>
                    </div>
                  </td>
                  <td className="block md:table-cell w-full md:w-auto relative px-3 md:px-4 py-1 md:py-3 text-right text-text-muted">
                    <div className="flex items-center justify-between md:justify-end">
                      <span className="md:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.qty')}</span>
                      <span>{it.quantity}</span>
                    </div>
                  </td>
                  <td className="block md:table-cell w-full md:w-auto relative px-3 md:px-4 py-1 md:py-3 text-right text-on-surface">
                    <div className="flex items-center justify-between md:justify-end">
                      <span className="md:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.unitPrice')}</span>
                      <span>
                        <span className="text-[10px] md:text-xs text-text-muted mr-1">{it.currency || 'TRY'}</span>
                        {parseFloat(it.unitPrice).toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="block md:table-cell w-full md:w-auto relative px-3 md:px-4 py-1 md:py-3 text-right font-semibold text-on-surface">
                    <div className="flex items-center justify-between md:justify-end">
                      <span className="md:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.lineTotal')}</span>
                      <span>
                        <span className="text-[10px] md:text-xs text-text-muted mr-1">{it.currency || 'TRY'}</span>
                        {(parseFloat(it.unitPrice) * parseInt(it.quantity)).toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="block md:table-cell w-full md:w-auto relative px-3 md:px-4 py-1 md:py-3 text-center border-t md:border-t-0 border-theme-border mt-2 md:mt-0">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-2">
                      <div className="flex gap-1.5 text-[9px] md:text-[10px] font-bold items-center">
                        <span className="text-text-muted bg-surface-container-high px-1 py-0.5 rounded" title={t('orders.remaining')}>{remaining}</span>
                        <span className="text-white bg-orange-500 px-1 py-0.5 rounded shadow-sm" title={t('production.inProduction')}>{inProd}</span>
                        <span className="text-green-700 bg-green-100 px-1 py-0.5 rounded" title={t('production.produced')}>{produced}</span>
                        <span className="text-text-muted mx-0.5">=</span>
                        <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded font-extrabold" title={t('orders.total')}>{it.quantity}</span>
                      </div>
                      {canProduce && canAct && (
                        <button onClick={() => setProductionItem(it)} className="bg-primary/10 text-primary hover:bg-primary hover:text-white rounded px-2 py-1 text-[10px] font-bold transition-colors whitespace-nowrap">
                          {t('orders.send')}
                        </button>
                      )}
                    </div>
                    {activeTasks.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1 items-center">
                        {activeTasks.map(task => {
                          const statusKey = `productionTasks.col${task.status.charAt(0).toUpperCase() + task.status.slice(1)}`
                          return (
                            <span key={task.id} className="text-[9px] font-semibold text-text-muted bg-surface-container-high px-2 py-0.5 rounded-md flex items-center gap-1 w-max shadow-sm border border-theme-border/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              {task.quantity} {it.product?.unit || ''} - {t(statusKey)}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        {productionItem && (
          <SendToProductionModal
            item={productionItem}
            machines={machines}
            employees={employees}
            onClose={() => setProductionItem(null)}
            onSave={async (form) => {
              try {
                await addProductionTask(form)
                setProductionItem(null)
              } catch (err) {
                alert(err.message)
              }
            }}
          />
        )}

        {/* Totals */}
        <div className="flex flex-col items-end gap-1 text-xs md:text-sm mb-4">
          <span className="text-text-muted">{t('orders.subtotal')}: <span className="text-on-surface font-medium">{currency} {subtotal.toFixed(2)}</span></span>
          {order.vat > 0 && (
            <span className="text-text-muted">{t('orders.vatName')} ({order.vat}%): <span className="text-on-surface font-medium">+{currency} {vatAmount.toFixed(2)}</span></span>
          )}
          <span className="font-bold text-on-surface text-sm md:text-base border-t border-theme-border pt-1 mt-0.5">
            {t('orders.total')}: {currency} {parseFloat(order.totalAmount).toFixed(2)}
          </span>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="bg-surface-container-high rounded-xl px-3 py-2.5 md:px-4 md:py-3 text-xs md:text-sm text-text-muted mb-4">
            <span className="font-semibold text-on-surface mr-1.5 md:mr-2">{t('common.notes')}:</span>{order.notes}
          </div>
        )}

        {/* Advance status — production staff only */}
        {canAct && next && canChangeTo(next) && !confirming && (
          <div className="flex justify-end">
            <button
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1.5 md:gap-2 bg-primary text-white px-4 py-2 md:px-5 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold hover:opacity-90 transition"
            >
              <span className="material-symbols-outlined text-[14px] md:text-base">arrow_forward</span>
              {t('orders.markAs', { status: next })}
            </button>
          </div>
        )}
        {canAct && next && canChangeTo(next) && confirming && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-amber-500 text-base">warning</span>
            <p className="text-xs text-amber-700 flex-1">
              {t('orders.changeStatusTo', { status: next })}
            </p>
            <button onClick={() => setConfirming(false)} className="text-xs text-text-muted hover:text-on-surface px-2 py-1 rounded transition">
              {t('common.cancel')}
            </button>
            <button onClick={() => onAdvance(order.id, next)} className="text-xs font-semibold text-white bg-primary hover:opacity-90 px-3 py-1 rounded-lg transition">
              {t('common.confirm')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Production() {
  const { t } = useTranslation()
  const { orders, updateOrder, refreshOrders, statusPermissions, userStatusPermissions, permissions, machines, employees, addProductionTask, employeePermissions } = useData()
  const { isAdmin, user: currentUser } = useAuth()
  
  const empId = currentUser?.employeeId
  const activeEmployee = employees?.find(e => e.id === empId)
  const activeDept = activeEmployee?.department || currentUser?.department

  const empPerms = employeePermissions?.[empId] || []
  const deptPerms = permissions[activeDept] || []
  const isActDenied = empPerms.includes('-production-start')
  const hasEmpAct = empPerms.includes('production-start')
  const hasDeptAct = deptPerms.includes('production-start')
  const canAct = isAdmin || (!isActDenied && (hasDeptAct || hasEmpAct))

  const canChangeTo = (status) => {
    if (isAdmin) return true
    const roleHas = (statusPermissions[activeDept] || []).includes(status)
    const empHas = (userStatusPermissions?.[currentUser?.id] || []).includes(status)
    return roleHas || empHas
  }


  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [detailOrder, setDetailOrder] = useState(null)

  useEffect(() => {
    if (detailOrder) {
      const updated = orders.find(o => o.id === detailOrder.id)
      if (updated) {
        setDetailOrder(updated)
      }
    }
  }, [orders, detailOrder])

  const productionOrders = orders.filter((o) => PRODUCTION_STATUSES.includes(o.status))

  const filtered = productionOrders.filter((o) => {
    if (filterStatus && o.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      const inCode = o.code.toLowerCase().includes(q)
      const inCustomer = (o.customer?.name || '').toLowerCase().includes(q)
      const inProduct = (o.items || []).some((it) => it.productName.toLowerCase().includes(q))
      if (!inCode && !inCustomer && !inProduct) return false
    }
    return true
  })

  // Summary counts
  const counts = PRODUCTION_STATUSES.reduce((acc, s) => {
    acc[s] = productionOrders.filter((o) => o.status === s).length
    return acc
  }, {})

  async function handleAdvance(id, nextStatus) {
    const order = orders.find((o) => o.id === id)
    if (!order) return
    try {
      await updateOrder(id, {
        customerId: order.customerId,
        employeeId: order.employeeId,
        salesRepId: order.salesRepId,
        status: nextStatus,
        vat: order.vat,
        notes: order.notes,
        items: (order.items || []).map((it) => ({
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          currency: it.currency || 'TRY',
          productId: it.productId || null,
        })),
      })
      setDetailOrder((prev) => prev?.id === id ? { ...prev, status: nextStatus } : prev)
    } catch (err) {
      alert(t('common.error') + ': ' + (err.message || 'Bir hata oluştu. Önce tüm kalemleri üretin.'))
    }
  }

  return (
    <div className="p-4 pb-24 md:p-8 md:pb-24 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-3 md:gap-4 mb-5 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface">{t('production.title')}</h1>
          <p className="text-xs md:text-sm text-text-muted mt-0.5">{t('production.activeOrders', { count: productionOrders.length })}</p>
        </div>
        <button
          onClick={refreshOrders}
          className="flex items-center justify-center gap-1.5 border border-theme-border px-3 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm text-text-muted hover:bg-hover-bg transition"
        >
          <span className="material-symbols-outlined text-sm md:text-base">refresh</span>
          {t('common.refresh')}
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-5 md:mb-6">
        {PRODUCTION_STATUSES.map((s) => (
          <div
            key={s}
            className="rounded-xl border border-theme-border bg-surface-container-lowest p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`material-symbols-outlined text-[18px] md:text-[20px] ${statusColor[s]}`}>{statusIcon[s]}</span>
              <span className="text-lg md:text-xl font-black text-on-surface">{counts[s] || 0}</span>
            </div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{s}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-base">search</span>
          <input
            className="w-full bg-surface-container-lowest border border-theme-border rounded-lg md:rounded-xl pl-8 pr-8 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary"
            placeholder={t('production.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(search || filterStatus) && (
            <button
              onClick={() => { setSearch(''); setFilterStatus('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 text-text-muted hover:text-error transition bg-surface-container-lowest"
              title={t('common.clear')}
            >
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">close</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="flex-1 sm:flex-none bg-surface-container-lowest border border-theme-border rounded-lg md:rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">{t('orders.allStatuses')}</option>
            {PRODUCTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Responsive Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-theme-border overflow-hidden">
        <table className="w-full text-sm block xl:table">
          <thead className="hidden xl:table-header-group">
            <tr className="border-b border-theme-border text-text-muted text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-4 font-semibold">{t('orders.order')}</th>
              <th className="text-left px-4 py-4 font-semibold">{t('common.customer')}</th>
              <th className="text-left px-4 py-4 font-semibold">{t('nav.products')}</th>
              <th className="text-right px-4 py-4 font-semibold">{t('orders.qty')}</th>
              <th className="text-right px-4 py-4 font-semibold">{t('orders.total')}</th>
              <th className="text-left px-4 py-4 font-semibold">{t('common.status')}</th>
              <th className="text-left px-4 py-4 font-semibold">{t('common.date')}</th>
            </tr>
          </thead>
          <tbody className="block xl:table-row-group">
            {filtered.length === 0 ? (
              <tr className="block xl:table-row w-full">
                <td colSpan={7} className="block xl:table-cell w-full text-center py-16 text-text-muted">{t('production.noData')}</td>
              </tr>
            ) : (
              filtered.map((o) => {
                const currency = o.items?.[0]?.currency || 'TRY'
                const productSummary = (o.items || []).map((it) => `${it.quantity}× ${it.productName}`).join(', ')
                const totalQty = (o.items || []).reduce((s, it) => s + (parseInt(it.quantity) || 0), 0)
                const createdAt = o.createdAt ? new Date(o.createdAt) : null
                const dateStr = createdAt ? createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
                
                return (
                  <tr
                    key={o.id}
                    className="block xl:table-row border-b border-theme-border hover:bg-hover-bg transition-colors cursor-pointer py-3 xl:py-0"
                    onClick={() => setDetailOrder(o)}
                  >
                    <td className="block xl:table-cell w-full xl:w-auto relative mb-2 xl:mb-0 px-2 xl:px-4 py-1 xl:py-4">
                      <div className="flex items-center justify-between xl:justify-start">
                        <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.order')}</span>
                        <span className="font-mono text-xs text-text-muted font-semibold">{o.code}</span>
                      </div>
                    </td>
                    <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 px-3 xl:px-4 py-1 xl:py-4">
                      <div className="flex items-center justify-between xl:justify-start">
                        <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('common.customer')}</span>
                        <span className="font-medium text-xs lg:text-sm text-on-surface flex flex-col items-start gap-0.5">
                          <span className="line-clamp-2">{o.customer?.name || '—'}</span>
                          {(o.customer?.accountCode || o.customer?.code) && (
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                              {o.customer.accountCode || o.customer.code}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 px-3 xl:px-4 py-1 xl:py-4">
                      <div className="flex flex-col xl:flex-row xl:items-center justify-between xl:justify-start gap-1">
                        <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('nav.products')}</span>
                        <span className="text-xs xl:text-sm text-on-surface xl:max-w-[220px] xl:truncate" title={productSummary}>{productSummary || '—'}</span>
                      </div>
                    </td>
                    <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 px-3 xl:px-4 py-1 xl:py-4">
                      <div className="flex items-center justify-between xl:justify-end">
                        <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.qty')}</span>
                        <span className="text-xs xl:text-sm text-text-muted text-right">{totalQty}</span>
                      </div>
                    </td>
                    <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 px-3 xl:px-4 py-1 xl:py-4">
                      <div className="flex items-center justify-between xl:justify-end">
                        <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.total')}</span>
                        <span className="font-semibold text-xs lg:text-sm text-on-surface text-right">
                          <span className="text-xs text-text-muted mr-1">{currency}</span>
                          {parseFloat(o.totalAmount).toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 px-3 xl:px-4 py-1 xl:py-4">
                      <div className="flex items-center justify-between xl:justify-start">
                        <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('common.status')}</span>
                        <span className={`inline-flex items-center justify-center px-2 lg:px-2.5 py-0.5 rounded-full text-[10px] lg:text-xs font-semibold whitespace-nowrap ${statusStyle[o.status] || statusStyle.Draft}`}>
                          {o.status}
                        </span>
                      </div>
                    </td>
                    <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 px-3 xl:px-4 py-1 xl:py-4">
                      <div className="flex items-center justify-between xl:justify-start">
                        <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('common.date')}</span>
                        <span className="text-xs text-text-muted whitespace-nowrap">{dateStr}</span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onAdvance={async (id, next) => { await handleAdvance(id, next); setDetailOrder(null) }}
          canAct={canAct}
          canChangeTo={canChangeTo}
          machines={machines}
          employees={employees}
          addProductionTask={addProductionTask}
        />
      )}
    </div>
  )
}
