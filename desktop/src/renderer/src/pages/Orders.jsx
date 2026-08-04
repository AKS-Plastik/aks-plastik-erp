import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import aksLogoUrl from '../assets/aks_logo.png'
import robotoFontUrl from '../assets/Roboto-Regular.ttf'
import { API_URL } from '../config'

const ITEMS_PER_PAGE = 10
const ORDER_STATUSES = ['Processing', 'Confirmed', 'In-Production', 'Production Completed', 'E-WayBill', 'In Delivery', 'E-Invoice', 'Delivered']
const ORDER_COLUMNS = ['Order Code', 'Customer', 'Sales Rep', 'Status', 'Notes', 'Product Name', 'Quantity', 'Unit', 'Unit Price', 'VAT %', 'Currency']

const SHIPMENT_TYPES = [
  '',
  'Air Freight',
  'Sea Freight (FCL)',
  'Sea Freight (LCL)',
  'Road Freight (FTL)',
  'Road Freight (LTL)',
  'Rail Freight',
  'Multimodal',
  'Express Courier (DHL / FedEx / UPS)',
  'Door-to-Door Delivery',
  'Ex-Works (EXW)',
  'FOB (Free On Board)',
  'CIF (Cost, Insurance & Freight)',
  'DAP (Delivered At Place)',
  'DDP (Delivered Duty Paid)',
]

const PAYMENT_METHODS = [
  '',
  'Bank Transfer (Wire)',
  'Letter of Credit (L/C)',
  'Cash in Advance',
  'Open Account (Net 30)',
  'Open Account (Net 60)',
  'Open Account (Net 90)',
  'Documentary Collection (D/P)',
  'Documentary Collection (D/A)',
  'Credit Card',
  'Cheque',
  'Cash on Delivery (COD)',
  'Escrow',
  'PayPal / Online Payment',
]

const emptyItem = { productName: '', quantity: 1, unitPrice: '', currency: 'TRY', vat: '0', unit: '' }

function emptyForm() {
  return { customerId: '', salesRepId: '', status: 'Processing', notes: '', shipmentType: '', paymentMethod: '', items: [{ ...emptyItem }] }
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────
const detailStatusStyle = {
  Processing:    'bg-amber-100 text-amber-700',
  Confirmed:     'bg-primary-fixed text-on-primary-fixed-variant',
  'In-Production': 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  'Production Completed': 'bg-green-100 text-green-700',
  'E-WayBill':   'bg-orange-100 text-orange-700',
  'In Delivery': 'bg-blue-100 text-blue-700',
  'E-Invoice':   'bg-teal-100 text-teal-700',
  Delivered:     'bg-green-400 text-green-900',
}

function OrderDetailModal({ order, onClose, currentUser, onStatusChange }) {
  const { t } = useTranslation()
  const { userStatusPermissions } = useData()
  const [localStatus, setLocalStatus] = useState(order.status)
  const [pendingStatus, setPendingStatus] = useState(null)
  const isAdmin = currentUser?.role === 'admin'
  const nextStatus = ORDER_STATUSES[ORDER_STATUSES.indexOf(localStatus) + 1]
  const canAdvanceFromCurrent = isAdmin || (userStatusPermissions[currentUser?.id] || []).includes(localStatus)
  const canChangeStatus = isAdmin || canAdvanceFromCurrent

  const currency = order.items?.[0]?.currency || 'TRY'

  function confirmStatusChange() {
    setLocalStatus(pendingStatus)
    onStatusChange(order.id, pendingStatus)
    setPendingStatus(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-3xl p-4 sm:p-8 max-h-[90dvh] overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
          <div>
            <p className="text-xs font-mono text-text-muted mb-1">{order.code}</p>
            <h2 className="text-xl font-bold text-on-surface">{order.customer?.name || '—'}</h2>
            <p className="text-sm text-text-muted mt-0.5">Sales Rep: {order.salesRep?.name || order.employee?.name || '—'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${detailStatusStyle[localStatus] || 'bg-surface-container-high text-text-muted'}`}>
              {localStatus}
            </span>
            <button onClick={onClose} className="text-text-muted hover:text-error">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Line Items */}
        <div className="rounded-xl border border-theme-border overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container-high text-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-semibold">{t('orders.product')}</th>
                <th className="text-right px-4 py-2.5 font-semibold">{t('orders.qty')}</th>
                <th className="text-center px-4 py-2.5 font-semibold">{t('common.unit')}</th>
                <th className="text-right px-4 py-2.5 font-semibold">{t('orders.unitPrice')}</th>
                <th className="text-right px-4 py-2.5 font-semibold">{t('orders.vat')}</th>
                <th className="text-right px-4 py-2.5 font-semibold">{t('orders.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((it, i) => {
                const lineTotal = (parseFloat(it.unitPrice) || 0) * (parseInt(it.quantity) || 0) * (1 + (it.vat || 0) / 100)
                return (
                  <tr key={i} className="border-t border-theme-border">
                    <td className="px-4 py-3 text-on-surface font-medium">{it.productName}</td>
                    <td className="px-4 py-3 text-right text-text-muted">{it.quantity}</td>
                    <td className="px-4 py-3 text-center text-text-muted">{it.product?.unit || '—'}</td>
                    <td className="px-4 py-3 text-right text-on-surface">
                      <span className="text-xs text-text-muted mr-1">{it.currency || 'USD'}</span>
                      {parseFloat(it.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-muted">{it.vat > 0 ? `${it.vat}%` : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-on-surface">
                      <span className="text-xs text-text-muted mr-1">{it.currency || 'USD'}</span>
                      {lineTotal.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex flex-col items-end gap-1 text-sm mb-4">
          <span className="font-bold text-on-surface text-base border-t border-theme-border pt-1 mt-0.5">
            {t('orders.total')}: {currency} {parseFloat(order.totalAmount).toFixed(2)}
          </span>
        </div>

        {/* Shipment & Payment */}
        {(order.shipmentType || order.paymentMethod) && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {order.shipmentType && (
              <div className="bg-surface-container-high rounded-xl px-4 py-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-text-muted">local_shipping</span>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wide font-semibold">{t('orders.shipment')}</p>
                  <p className="text-sm text-on-surface font-medium">{order.shipmentType}</p>
                </div>
              </div>
            )}
            {order.paymentMethod && (
              <div className="bg-surface-container-high rounded-xl px-4 py-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-text-muted">payments</span>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wide font-semibold">{t('orders.payment')}</p>
                  <p className="text-sm text-on-surface font-medium">{order.paymentMethod}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-text-muted mb-4">
            <span className="font-semibold text-on-surface mr-2">Notes:</span>{order.notes}
          </div>
        )}

        {/* Status change */}
        {canChangeStatus && (
          <div className="pt-4 border-t border-theme-border space-y-3">
            {isAdmin ? (
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-text-muted text-base">swap_horiz</span>
                <label className="text-xs font-semibold text-text-muted whitespace-nowrap">{t('orders.changeStatus')}</label>
                <select
                  value={pendingStatus ?? localStatus}
                  onChange={(e) => setPendingStatus(e.target.value === localStatus ? null : e.target.value)}
                  className="flex-1 bg-surface-container-lowest border border-theme-border rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                >
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ) : (
              !pendingStatus && canAdvanceFromCurrent && nextStatus && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">{t('orders.current')} {localStatus}</span>
                  <button
                    onClick={() => setPendingStatus(nextStatus)}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition"
                  >
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                    {t('orders.markAs', { status: nextStatus })}
                  </button>
                </div>
              )
            )}
            {pendingStatus && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-amber-500 text-base">warning</span>
                <p className="text-xs text-amber-700 flex-1">
                  {t('orders.changeFrom', { from: localStatus, to: pendingStatus })}
                </p>
                <button onClick={() => setPendingStatus(null)} className="text-xs text-text-muted hover:text-on-surface px-2 py-1 rounded transition">
                  {t('common.cancel')}
                </button>
                <button onClick={confirmStatusChange} className="text-xs font-semibold text-white bg-primary hover:opacity-90 px-3 py-1 rounded-lg transition">
                  {t('common.confirm')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
const SALES_DEPTS = ['Sales Manager', 'Sales Representative']

function OrderModal({ title, form, setForm, onClose, onSave, errors, saveError, customers, employees, products, currentUser, salesTeam, isAdmin }) {
  const { t } = useTranslation()
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const inputCls = (err) =>
    `w-full bg-surface-container-lowest border rounded px-3 py-2 text-sm text-on-surface outline-none focus:border-primary transition ${err ? 'border-error' : 'border-theme-border'}`

  function setItem(idx, field, value) {
    setForm((f) => {
      const items = f.items.map((it, i) => i === idx ? { ...it, [field]: value } : it)
      return { ...f, items }
    })
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { ...emptyItem }] }))
  }

  function removeItem(idx) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  function fillFromProduct(idx, productId) {
    const prod = products.find((p) => p.id === productId)
    if (prod) {
      setForm((f) => {
        const items = f.items.map((it, i) =>
          i === idx ? { ...it, productName: prod.name, unitPrice: prod.price, productId: prod.id, currency: prod.currency || 'USD', unit: prod.unit || '' } : it
        )
        return { ...f, items }
      })
    }
  }

  const total = form.items.reduce((s, it) => {
    const qty = parseInt(it.quantity) || 0
    const price = parseFloat(it.unitPrice) || 0
    const vatRate = parseFloat(it.vat) || 0
    return s + qty * price * (1 + vatRate / 100)
  }, 0)
  const displayCurrency = form.items.find((it) => it.currency)?.currency || 'TRY'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-2xl p-8 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-on-surface">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-error">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">{t('common.customer')} *</label>
              <select className={inputCls(errors.customerId)} value={form.customerId} onChange={set('customerId')}>
                <option value="">{t('orders.selectCustomer')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.customerId && <p className="text-xs text-error mt-1">{errors.customerId}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">{t('orders.salesRep')} *</label>
              {(() => {
                const isAdminOrManager = isAdmin || currentUser?.department === 'Sales Manager'
                if (!isAdminOrManager) {
                  return (
                    <input
                      readOnly
                      className={`${inputCls()} bg-surface-container-high cursor-not-allowed`}
                      value={currentUser?.name || ''}
                    />
                  )
                }
                // Admin / Manager: salesTeam (Sales dept only) + themselves if not already included
                const inList = salesTeam.some((u) => u.id === currentUser?.id)
                const options = inList ? salesTeam : [...salesTeam, { id: currentUser?.id, name: currentUser?.name, department: currentUser?.department }]
                return (
                  <>
                    <select className={inputCls(errors.salesRepId)} value={form.salesRepId || ''} onChange={(e) => setForm((f) => ({ ...f, salesRepId: e.target.value }))}>
                      <option value="">{t('orders.selectSalesRep')}</option>
                      {options.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} — {u.department}</option>
                      ))}
                    </select>
                    {errors.salesRepId && <p className="text-xs text-error mt-1">{errors.salesRepId}</p>}
                  </>
                )
              })()}
            </div>
          </div>
          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-muted">{t('orders.lineItems')} *</label>
              <button onClick={addItem} className="text-xs text-primary flex items-center gap-1 hover:underline">
                <span className="material-symbols-outlined text-sm">add</span> {t('orders.addLine')}
              </button>
            </div>
            {errors.items && <p className="text-xs text-error mb-2">{errors.items}</p>}
            <div className="flex items-center gap-2 mb-1 px-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex-1">{t('orders.product')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-14 text-center">{t('orders.qty')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-12 text-center">{t('common.unit')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-28 text-center">{t('orders.unitPrice')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-16 text-center">{t('orders.vat')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-24 text-right">{t('orders.total')}</span>
              <span className="w-5" />
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => {
                const itemErr = errors.items && item.productName && (!item.unitPrice || parseInt(item.quantity) < 1)
                const itemTotal = (parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 0) * (1 + (parseFloat(item.vat) || 0) / 100)
                return (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    className={`flex-1 border rounded px-2 py-1.5 text-xs bg-surface-container-lowest text-on-surface outline-none focus:border-primary ${errors.items && !item.productName ? 'border-error' : 'border-theme-border'}`}
                    value={item.productId || ''}
                    onChange={(e) => fillFromProduct(idx, e.target.value)}
                  >
                    <option value="">{t('orders.selectProduct')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.stockNo ? `${p.stockNo} — ${p.name}` : p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number" min="1"
                    className={`w-14 border rounded px-2 py-1.5 text-xs bg-surface-container-lowest text-on-surface outline-none focus:border-primary text-center ${itemErr && parseInt(item.quantity) < 1 ? 'border-error' : 'border-theme-border'}`}
                    placeholder="1"
                    value={item.quantity}
                    onChange={(e) => setItem(idx, 'quantity', e.target.value)}
                  />
                  <div className="w-12 flex items-center justify-center">
                    {item.unit ? (
                      <span className="text-[11px] font-semibold text-text-muted bg-surface-container-high border border-theme-border rounded px-1.5 py-1 leading-none">{item.unit}</span>
                    ) : (
                      <span className="text-[11px] text-text-muted/40">—</span>
                    )}
                  </div>
                  <div className={`w-28 flex items-center border rounded overflow-hidden bg-surface-container-lowest ${itemErr && !item.unitPrice ? 'border-error' : 'border-theme-border'}`}>
                    <span className="px-1.5 text-[10px] text-text-muted border-r border-theme-border bg-surface-container-high">{item.currency || 'USD'}</span>
                    <input
                      type="number" min="0" step="0.01"
                      className="flex-1 px-2 py-1.5 text-xs text-on-surface outline-none bg-transparent"
                      placeholder="0.00"
                      value={item.unitPrice}
                      onChange={(e) => setItem(idx, 'unitPrice', e.target.value)}
                    />
                  </div>
                  <div className="w-16 flex items-center border border-theme-border rounded overflow-hidden bg-surface-container-lowest">
                    <input
                      type="number" min="0" max="100" step="0.1"
                      className="flex-1 px-2 py-1.5 text-xs text-on-surface outline-none bg-transparent text-center"
                      placeholder="0"
                      value={item.vat}
                      onChange={(e) => setItem(idx, 'vat', e.target.value)}
                    />
                    <span className="px-1.5 text-[10px] text-text-muted border-l border-theme-border bg-surface-container-high">%</span>
                  </div>
                  <span className="text-xs font-semibold text-on-surface w-24 text-right">
                    {item.currency || 'USD'} {itemTotal.toFixed(2)}
                  </span>
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-text-muted hover:text-error">
                      <span className="material-symbols-outlined text-base">remove_circle</span>
                    </button>
                  )}
                </div>
              )})}
            </div>
            <div className="mt-3 flex justify-end">
              <span className="font-bold text-on-surface border-t border-theme-border pt-1">
                {t('orders.total')}: {displayCurrency} {total.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">{t('orders.shipmentType')} *</label>
              <select className={inputCls(errors.shipmentType)} value={form.shipmentType} onChange={set('shipmentType')}>
                {SHIPMENT_TYPES.map((s) => <option key={s} value={s}>{s || t('orders.selectShipment')}</option>)}
              </select>
              {errors.shipmentType && <p className="text-xs text-error mt-1">{errors.shipmentType}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">{t('orders.paymentMethod')} *</label>
              <select className={inputCls(errors.paymentMethod)} value={form.paymentMethod} onChange={set('paymentMethod')}>
                {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p || t('orders.selectPayment')}</option>)}
              </select>
              {errors.paymentMethod && <p className="text-xs text-error mt-1">{errors.paymentMethod}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">{t('common.notes')}</label>
            <textarea rows={2} className={inputCls()} value={form.notes} onChange={set('notes')} />
          </div>
        </div>

        {saveError && (
          <div className="mt-4 px-3 py-2 rounded-lg bg-error/10 border border-error/30 text-xs text-error">
            {saveError}
          </div>
        )}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 border border-theme-border rounded-lg py-2 text-sm text-text-muted hover:bg-hover-bg transition">
            {t('common.cancel')}
          </button>
          <button onClick={onSave} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 transition">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

const statusStyle = {
  Processing:      'bg-amber-200 text-amber-700',
  Confirmed:       'bg-primary-fixed text-on-primary-fixed-variant',
  'In-Production': 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  'Production Completed': 'bg-green-100 text-green-700',
  'E-WayBill':     'bg-orange-100 text-orange-700',
  'In Delivery':   'bg-blue-100 text-blue-700',
  'E-Invoice':     'bg-teal-100 text-teal-700',
  Delivered:       'bg-green-400 text-green-900',
}

// Load bundled Roboto font as base64 for jsPDF (cached after first load)
let robotoBase64Cache = null
async function loadRobotoBase64() {
  if (robotoBase64Cache) return robotoBase64Cache
  const res = await fetch(robotoFontUrl)
  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const chunks = []
  for (let i = 0; i < bytes.length; i += 0x8000) {
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)))
  }
  robotoBase64Cache = btoa(chunks.join(''))
  return robotoBase64Cache
}

function loadImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = url
  })
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Orders() {
  const { t } = useTranslation()
  const { orders, addOrder, updateOrder, deleteOrder, syncAndRefreshOrders, customers, employees, products, isAdmin, permissions } = useData()
  const { user: currentUser, token } = useAuth()
  const [salesTeam, setSalesTeam] = useState([])
  const canDelete = isAdmin || currentUser?.department === 'Sales Manager'
  const canCreate = isAdmin
    || currentUser?.department === 'Sales Manager'
    || currentUser?.department === 'Sales Representative'
    || (permissions[currentUser?.department] || []).includes('orders-create')
  const canEditProcessing = isAdmin || canCreate

  useEffect(() => {
    if (!token) return
    fetch(`${API_URL}/auth/salesteam`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setSalesTeam(data))
      .catch(() => {})
  }, [token])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [exportOpen, setExportOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const exportRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleExportExcel() {
    setExportOpen(false)
    const toExport = orders.filter((o) => selected.has(o.id))
    const rows = []
    toExport.forEach((o) => {
      const items = o.items?.length ? o.items : [{}]
      items.forEach((it, idx) => {
        rows.push({
          'Order Code': idx === 0 ? o.code : '',
          'Customer': idx === 0 ? (o.customer?.name || '') : '',
          'Sales Rep': idx === 0 ? (o.salesRep?.name || o.employee?.name || '') : '',
          'Status': idx === 0 ? o.status : '',
          'Notes': idx === 0 ? (o.notes || '') : '',
          'Product Name': it.productName || '',
          'Quantity': it.quantity ?? '',
          'Unit': it.product?.unit || '',
          'Unit Price': it.unitPrice ?? '',
          'VAT %': it.vat ?? '',
          'Currency': it.currency || 'USD',
        })
      })
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = ORDER_COLUMNS.map((_, i) => ({ wch: i <= 4 ? 20 : 16 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Orders')
    XLSX.writeFile(wb, 'orders.xlsx')
  }

  async function handleExport() {
    setExportOpen(false)
    const toExport = orders.filter((o) => selected.has(o.id))
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 14

    // Register bundled Roboto for Turkish character support
    try {
      const base64 = await loadRobotoBase64()
      doc.addFileToVFS('Roboto-Regular.ttf', base64)
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
      doc.setFont('Roboto', 'normal')
    } catch (_) { /* fall back to helvetica */ }

    const tf = doc.getFont().fontName === 'Roboto' ? 'Roboto' : 'helvetica'

    // Logo
    try {
      const logoBase64 = await loadImageAsBase64(aksLogoUrl)
      doc.addImage(logoBase64, 'PNG', pageW - margin - 36, 10, 36, 12)
    } catch (_) {}

    // Title
    doc.setFont(tf, 'bold')
    doc.setFontSize(18)
    doc.setTextColor(30, 30, 30)
    doc.text('Orders Report', margin, 18)
    doc.setFont(tf, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, margin, 24)
    doc.text(`Total orders: ${toExport.length}`, margin, 29)

    // Summary table
    autoTable(doc, {
      startY: 36,
      margin: { left: margin, right: margin },
      head: [['Order Code', 'Customer', 'Sales Rep', 'Items', 'Total', 'Status']],
      body: toExport.map((o) => {
        const cur = o.items?.[0]?.currency || 'TRY'
        return [
          o.code,
          o.customer?.name || '—',
          o.salesRep?.name || o.employee?.name || '—',
          o.items?.length ?? 0,
          `${cur} ${parseFloat(o.totalAmount).toFixed(2)}`,
          o.status,
        ]
      }),
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9, font: tf },
      bodyStyles: { fontSize: 8.5, textColor: [40, 40, 40], font: tf },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold' },
        3: { halign: 'right', cellWidth: 14 },
        4: { halign: 'right', cellWidth: 28 },
        5: { cellWidth: 24 },
      },
      didDrawPage: (data) => {
        doc.setFont(tf, 'normal')
        doc.setFontSize(8)
        doc.setTextColor(160, 160, 160)
        doc.text(`Page ${data.pageNumber}`, pageW / 2, pageH - 8, { align: 'center' })
      },
    })

    // Detail section — one sub-table per order
    let y = doc.lastAutoTable.finalY + 10

    for (const o of toExport) {
      if (!o.items?.length) continue
      if (y > pageH - 50) { doc.addPage(); y = 16 }

      const cur = o.items?.[0]?.currency || 'TRY'

      doc.setFont(tf, 'bold')
      doc.setFontSize(9)
      doc.setTextColor(30, 30, 30)
      doc.text(`${o.code}  —  ${o.customer?.name || '—'}`, margin, y)
      doc.setFont(tf, 'normal')
      doc.setTextColor(120, 120, 120)
      doc.text(o.status, pageW - margin, y, { align: 'right' })

      autoTable(doc, {
        startY: y + 3,
        margin: { left: margin + 4, right: margin },
        head: [['Stock No', 'Product', 'Qty', 'Unit', 'Unit Price', 'VAT %', 'Line Total']],
        body: o.items.map((it) => [
          it.product?.stockNo || '—',
          it.productName,
          it.quantity,
          it.product?.unit || '—',
          `${it.currency || cur} ${parseFloat(it.unitPrice).toFixed(2)}`,
          it.vat > 0 ? `${it.vat}%` : '—',
          `${it.currency || cur} ${(parseFloat(it.unitPrice) * parseInt(it.quantity)).toFixed(2)}`,
        ]),
        headStyles: { fillColor: [100, 116, 139], textColor: 255, fontSize: 8, fontStyle: 'bold', font: tf },
        bodyStyles: { fontSize: 8, textColor: [60, 60, 60], font: tf },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 22 },
          2: { halign: 'right', cellWidth: 12 },
          3: { halign: 'center', cellWidth: 14 },
          4: { halign: 'right', cellWidth: 26 },
          5: { halign: 'right', cellWidth: 14 },
          6: { halign: 'right', cellWidth: 26 },
        },
        foot: [
          ...(o.vat > 0 ? [[
            { content: `VAT (${o.vat}%)`, colSpan: 4, styles: { halign: 'right', fontSize: 8, font: tf } },
            { content: `+${cur} ${(parseFloat(o.totalAmount) - parseFloat(o.totalAmount) / (1 + o.vat / 100)).toFixed(2)}`, styles: { halign: 'right', fontSize: 8, font: tf } },
          ]] : []),
          [
            { content: 'Order Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, font: tf } },
            { content: `${cur} ${parseFloat(o.totalAmount).toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, font: tf } },
          ],
        ],
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 30, 30] },
      })

      y = doc.lastAutoTable.finalY + 6
    }

    doc.save('orders.pdf')
  }

  function validate(f) {
    const e = {}
    if (!f.customerId) e.customerId = t('orders.errCustomer')
    const isAdminOrManager = isAdmin || currentUser?.department === 'Sales Manager'
    if (!f.salesRepId && isAdminOrManager) e.salesRepId = t('orders.errSalesRep')
    if (!f.shipmentType) e.shipmentType = t('orders.errShipment')
    if (!f.paymentMethod) e.paymentMethod = t('orders.errPayment')
    const validItems = f.items.filter((it) => it.productName.trim())
    if (!validItems.length) {
      e.items = t('orders.errNoProduct')
    } else {
      const missingPrice = validItems.some((it) => it.unitPrice === '' || it.unitPrice === undefined)
      if (missingPrice) e.items = t('orders.errUnitPrice')
      const missingQty = validItems.some((it) => !parseInt(it.quantity) || parseInt(it.quantity) < 1)
      if (missingQty) e.items = t('orders.errQty')
    }
    return e
  }

  function openAdd() {
    const base = emptyForm()
    const isAdminOrManager = isAdmin || currentUser?.department === 'Sales Manager'
    if (!isAdminOrManager) {
      base.salesRepId = currentUser?.id
    }
    setForm(base)
    setErrors({})
    setShowAdd(true)
  }

  function openEdit(item) {
    setForm({
      customerId: item.customerId || '',
      salesRepId: item.salesRepId || '',
      status: item.status || 'Draft',
      notes: item.notes || '',
      shipmentType: item.shipmentType || '',
      paymentMethod: item.paymentMethod || '',
      items: item.items?.length
        ? item.items.map((it) => ({
            productName: it.productName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            currency: it.currency || 'USD',
            vat: it.vat ?? '0',
            productId: it.productId || '',
          }))
        : [{ ...emptyItem }],
    })
    setErrors({})
    setEditItem(item)
  }

  async function handleAdd() {
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }
    try {
      setSaveError('')
      await addOrder({ ...form, items: form.items.filter((it) => it.productName.trim()) })
      setShowAdd(false)
    } catch (err) {
      setSaveError(err.message)
    }
  }

  async function handleEdit() {
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }
    try {
      setSaveError('')
      await updateOrder(editItem.id, { ...form, items: form.items.filter((it) => it.productName.trim()) })
      setEditItem(null)
    } catch (err) {
      setSaveError(err.message)
    }
  }

  async function handleDelete() {
    await deleteOrder(confirmDeleteId)
    setConfirmDeleteId(null)
  }

  async function handleStatusChange(id, newStatus) {
    const order = orders.find((o) => o.id === id)
    if (!order) return
    await updateOrder(id, {
      customerId: order.customerId,
      employeeId: order.employeeId,
      salesRepId: order.salesRepId,
      status: newStatus,
      vat: order.vat,
      notes: order.notes,
      shipmentType: order.shipmentType || '',
      paymentMethod: order.paymentMethod || '',
      items: (order.items || []).map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        currency: it.currency || 'USD',
        productId: it.productId || null,
      })),
    })
  }

  const filtered = orders.filter((o) => {
    if (search) {
      const q = search.toLowerCase()
      const inCode = o.code.toLowerCase().includes(q)
      const inCustomer = (o.customer?.name || '').toLowerCase().includes(q)
      const inRep = (o.salesRep?.name || o.employee?.name || '').toLowerCase().includes(q)
      const inProduct = (o.items || []).some((it) => it.productName.toLowerCase().includes(q))
      if (!inCode && !inCustomer && !inRep && !inProduct) return false
    }
    if (filterStatus && o.status !== filterStatus) return false
    if (filterDateFrom && new Date(o.createdAt) < new Date(filterDateFrom)) return false
    if (filterDateTo && new Date(o.createdAt) > new Date(filterDateTo + 'T23:59:59')) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const allPageSelected = paginated.length > 0 && paginated.every((o) => selected.has(o.id))
  const somePageSelected = paginated.some((o) => selected.has(o.id))

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allPageSelected) {
      setSelected((prev) => { const n = new Set(prev); paginated.forEach((o) => n.delete(o.id)); return n })
    } else {
      setSelected((prev) => { const n = new Set(prev); paginated.forEach((o) => n.add(o.id)); return n })
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl primary-gradient flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-[20px] sm:text-[24px]">shopping_bag</span>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface leading-tight">{t('orders.title')}</h1>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5">{t('orders.totalOrders', { count: orders.length })}</p>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-3 flex-shrink-0">
          <button onClick={syncAndRefreshOrders} className="flex items-center justify-center gap-1.5 border border-theme-border px-3 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm text-text-muted hover:bg-hover-bg transition whitespace-nowrap">
            <span className="material-symbols-outlined text-[14px] lg:text-base">refresh</span>
            {t('common.refresh')}
          </button>
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={selected.size === 0}
              className="flex items-center justify-center gap-1.5 border border-theme-border w-full lg:w-auto px-3 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm text-text-muted hover:bg-hover-bg transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[14px] lg:text-base">download</span>
              Export{selected.size > 0 ? ` (${selected.size})` : ''}
              <span className="material-symbols-outlined text-[14px] lg:text-base">arrow_drop_down</span>
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-full lg:w-44 bg-surface-container-lowest border border-theme-border rounded-xl shadow-lg z-20 overflow-hidden">
                <button onClick={handleExportExcel} className="flex items-center gap-2 w-full px-4 py-2 lg:py-2.5 text-xs lg:text-sm text-on-surface hover:bg-hover-bg transition text-left">
                  <span className="material-symbols-outlined text-[14px] lg:text-base text-green-600">table_view</span>
                  {t('common.exportExcel')}
                </button>
                <button onClick={handleExport} className="flex items-center gap-2 w-full px-4 py-2 lg:py-2.5 text-xs lg:text-sm text-on-surface hover:bg-hover-bg transition text-left">
                  <span className="material-symbols-outlined text-[14px] lg:text-base text-red-500">picture_as_pdf</span>
                  {t('common.exportPDF')}
                </button>
              </div>
            )}
          </div>
          {canCreate && (
            <button onClick={openAdd} className="flex items-center justify-center gap-1.5 lg:gap-2 primary-gradient text-white px-4 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold shadow-xl shadow-primary/10 hover:opacity-90 transition-opacity whitespace-nowrap">
              <span className="material-symbols-outlined text-[14px] lg:text-base">add</span>
              {t('orders.newOrder')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">search</span>
          <input
            className="w-full bg-surface-container-lowest border border-theme-border rounded-xl pl-9 pr-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select
          className="bg-surface-container-lowest border border-theme-border rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
        >
          <option value="">{t('orders.allStatuses')}</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted whitespace-nowrap">{t('common.from')}</span>
          <input
            type="date"
            className="bg-surface-container-lowest border border-theme-border rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted whitespace-nowrap">{t('common.to')}</span>
          <input
            type="date"
            className="bg-surface-container-lowest border border-theme-border rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1) }}
          />
        </div>
        {(search || filterStatus || filterDateFrom || filterDateTo) && (
          <button
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterDateFrom(''); setFilterDateTo(''); setPage(1) }}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-error transition"
          >
            <span className="material-symbols-outlined text-base">close</span>
            {t('common.clear')}
          </button>
        )}
      </div>

      <div className="bg-transparent sm:bg-surface-container-lowest rounded-2xl sm:border border-theme-border overflow-hidden">
        <table className="w-full text-sm block sm:table">
          <thead className="hidden sm:table-header-group">
            <tr className="border-b border-theme-border text-text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                />
              </th>
              <th className="text-left px-4 py-2 font-semibold">{t('orders.order')}</th>
              <th className="text-left px-4 py-2 font-semibold">{t('common.customer')}</th>
              <th className="text-left px-4 py-2 font-semibold">{t('orders.salesRep')}</th>
              <th className="text-right px-4 py-2 font-semibold">{t('orders.total')}</th>
              <th className="text-left px-4 py-2 font-semibold">{t('common.status')}</th>
              <th className="text-left px-4 py-2 font-semibold">{t('common.date')}</th>
              <th className="text-left px-4 py-2 font-semibold">{t('workOrders.time')}</th>
              {(canDelete || canEditProcessing) && <th className="text-right px-4 py-2 font-semibold">{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody className="block sm:table-row-group">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={(canDelete || canEditProcessing) ? 9 : 8} className="text-center py-16 text-text-muted">{t('orders.noOrders')}</td>
              </tr>
            ) : (
              paginated.map((o) => {
                const currency = o.items?.[0]?.currency || 'TRY'
                const createdAt = o.createdAt ? new Date(o.createdAt) : null
                const dateStr = createdAt ? createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
                const timeStr = createdAt ? createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'
                return (
                  <tr
                    key={o.id}
                    className={`block sm:table-row bg-surface-container-lowest sm:bg-transparent rounded-2xl sm:rounded-none mb-4 sm:mb-0 p-4 sm:p-0 shadow-sm sm:shadow-none border border-surface-container-low sm:border-0 sm:border-b border-theme-border hover:bg-hover-bg transition-colors cursor-pointer ${selected.has(o.id) ? 'bg-primary/5 sm:bg-primary/5 ring-2 ring-primary sm:ring-0' : ''}`}
                    onClick={() => setDetailOrder(o)}
                  >
                    <td className="block sm:table-cell w-full sm:w-auto relative mb-2 sm:mb-0 sm:px-4 py-1 sm:py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between sm:justify-start">
                        <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">Seç</span>
                        <input
                          type="checkbox"
                          checked={selected.has(o.id)}
                          onChange={() => toggleRow(o.id)}
                          className="w-5 h-5 sm:w-4 sm:h-4 rounded accent-primary cursor-pointer"
                        />
                      </div>
                    </td>
                    <td className="block sm:table-cell w-full sm:w-auto relative mb-1.5 sm:mb-0 sm:px-4 py-1 sm:py-2">
                      <div className="flex items-center justify-between sm:justify-start">
                        <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.order')}</span>
                        <span className="font-mono text-xs text-text-muted font-semibold">{o.code || '—'}</span>
                      </div>
                    </td>
                    <td className="block sm:table-cell w-full sm:w-auto relative mb-1.5 sm:mb-0 sm:px-4 py-1 sm:py-2">
                      <div className="flex items-center justify-between sm:justify-start">
                        <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('common.customer')}</span>
                        <span className="font-medium text-on-surface">{o.customer?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="block sm:table-cell w-full sm:w-auto relative mb-1.5 sm:mb-0 sm:px-4 py-1 sm:py-2">
                      <div className="flex items-center justify-between sm:justify-start">
                        <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.salesRep')}</span>
                        <span className="text-text-muted text-sm">{o.salesRep?.name || o.employee?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="block sm:table-cell w-full sm:w-auto relative mb-1.5 sm:mb-0 sm:px-4 py-1 sm:py-2">
                      <div className="flex items-center justify-between sm:justify-end">
                        <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.total')}</span>
                        <span className="font-semibold text-on-surface">
                          <span className="text-xs text-text-muted mr-1">{currency}</span>
                          {(parseFloat(o.totalAmount) || 0).toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="block sm:table-cell w-full sm:w-auto relative mb-1.5 sm:mb-0 sm:px-4 py-1 sm:py-2">
                      <div className="flex items-center justify-between sm:justify-start">
                        <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('common.status')}</span>
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold ${statusStyle[o.status] || statusStyle.Draft}`}>
                          {o.status}
                        </span>
                      </div>
                    </td>
                    <td className="block sm:table-cell w-full sm:w-auto relative mb-1.5 sm:mb-0 sm:px-4 py-1 sm:py-2">
                      <div className="flex items-center justify-between sm:justify-start">
                        <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('common.date')}</span>
                        <span className="text-xs text-text-muted">{dateStr}</span>
                      </div>
                    </td>
                    <td className="block sm:table-cell w-full sm:w-auto relative mb-1.5 sm:mb-0 sm:px-4 py-1 sm:py-2">
                      <div className="flex items-center justify-between sm:justify-start">
                        <span className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('workOrders.time')}</span>
                        <span className="text-xs text-text-muted">{timeStr}</span>
                      </div>
                    </td>
                    {(canDelete || (canEditProcessing && o.status === 'Processing')) && (
                      <td className="block sm:table-cell w-full sm:w-auto relative mt-3 sm:mt-0 pt-3 sm:pt-0 border-t border-surface-container-low sm:border-0 sm:px-4 py-1 sm:py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {(canDelete || (canEditProcessing && o.status === 'Processing')) && (
                            <button onClick={() => openEdit(o)} className="flex-1 sm:flex-none flex justify-center p-2 sm:p-1.5 rounded-lg border sm:border-0 border-theme-border hover:bg-hover-bg text-text-muted hover:text-primary transition">
                              <span className="material-symbols-outlined text-[18px] sm:text-base">edit</span>
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => setConfirmDeleteId(o.id)} className="flex-1 sm:flex-none flex justify-center p-2 sm:p-1.5 rounded-lg border sm:border-0 border-theme-border hover:bg-hover-bg text-text-muted hover:text-error transition">
                              <span className="material-symbols-outlined text-[18px] sm:text-base">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-text-muted">
        <span>{filtered.length} orders</span>
        <div className="flex gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-theme-border disabled:opacity-40 hover:bg-hover-bg transition">{t('common.prev')}</button>
          <span className="px-3 py-1.5">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-theme-border disabled:opacity-40 hover:bg-hover-bg transition">{t('common.next')}</button>
        </div>
      </div>

      {detailOrder && <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} currentUser={currentUser} onStatusChange={handleStatusChange} />}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-error text-3xl">delete_forever</span>
              <h2 className="text-lg font-bold text-on-surface">{t('orders.deleteOrder')}</h2>
            </div>
            <p className="text-sm text-text-muted mb-6">{t('orders.deleteConfirm')}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 border border-theme-border rounded-lg py-2 text-sm text-text-muted hover:bg-hover-bg transition">
                {t('common.cancel')}
              </button>
              <button onClick={handleDelete} className="flex-1 bg-error text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 transition">
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <OrderModal title={t('orders.newOrder')} form={form} setForm={setForm} errors={errors} saveError={saveError}
          onClose={() => { setShowAdd(false); setSaveError('') }} onSave={handleAdd}
          customers={customers} employees={employees} products={products} currentUser={currentUser} salesTeam={salesTeam} isAdmin={isAdmin} />
      )}
      {editItem && (
        <OrderModal title={t('orders.editOrder')} form={form} setForm={setForm} errors={errors} saveError={saveError}
          onClose={() => { setEditItem(null); setSaveError('') }} onSave={handleEdit}
          customers={customers} employees={employees} products={products} currentUser={currentUser} salesTeam={salesTeam} isAdmin={isAdmin} />
      )}
    </div>
  )
}
