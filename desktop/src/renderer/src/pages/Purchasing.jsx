import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { API_URL } from '../config'

// ── Constants ────────────────────────────────────────────────────────────────
const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'JPY', 'CNY', 'INR', 'CAD', 'AUD']
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const CATEGORIES = ['General', 'Raw Materials', 'Equipment', 'Services', 'IT & Software', 'Logistics', 'Spare Parts', 'Office Supplies', 'Other']
const SUPPLIER_CATEGORIES = ['General', 'Raw Materials', 'Equipment', 'Services', 'IT & Software', 'Logistics', 'Other']

const WORKFLOW_STAGES = [
  { key: 'Request',           label: 'Request',            icon: 'edit_note',          color: 'text-blue-500',   bg: 'bg-blue-500' },
  { key: 'Budget Review',     label: 'Budget Review',      icon: 'account_balance',    color: 'text-amber-500',  bg: 'bg-amber-500' },
  { key: 'Collecting Quotes', label: 'Collecting Quotes',  icon: 'request_quote',      color: 'text-purple-500', bg: 'bg-purple-500' },
  { key: 'Comparison',        label: 'Comparison',         icon: 'compare_arrows',     color: 'text-indigo-500', bg: 'bg-indigo-500' },
  { key: 'Pending Approval',  label: 'Pending Approval',   icon: 'approval',           color: 'text-orange-500', bg: 'bg-orange-500' },
  { key: 'PO Created',        label: 'PO Created',         icon: 'receipt_long',       color: 'text-cyan-600',   bg: 'bg-cyan-600' },
  { key: 'In Logistics',      label: 'In Logistics',       icon: 'local_shipping',     color: 'text-teal-500',   bg: 'bg-teal-500' },
  { key: 'Quality Check',     label: 'Quality Check',      icon: 'verified',           color: 'text-lime-600',   bg: 'bg-lime-600' },
  { key: 'Invoice Matching',  label: 'Invoice Matching',   icon: 'receipt',            color: 'text-pink-500',   bg: 'bg-pink-500' },
  { key: 'Payment',           label: 'Payment',            icon: 'payments',           color: 'text-emerald-500', bg: 'bg-emerald-500' },
  { key: 'Completed',         label: 'Completed',          icon: 'check_circle',       color: 'text-green-600',  bg: 'bg-green-600' },
]

const TERMINAL = ['Completed', 'Rejected', 'Cancelled']

const STATUS_BADGE = {
  'Request':           'bg-blue-500/10 text-blue-600',
  'Budget Review':     'bg-amber-500/10 text-amber-600',
  'Budget Rejected':   'bg-red-500/10 text-red-600',
  'Collecting Quotes': 'bg-purple-500/10 text-purple-600',
  'Comparison':        'bg-indigo-500/10 text-indigo-600',
  'Pending Approval':  'bg-orange-500/10 text-orange-600',
  'PO Created':        'bg-cyan-600/10 text-cyan-700',
  'In Logistics':      'bg-teal-500/10 text-teal-600',
  'Quality Check':     'bg-lime-600/10 text-lime-700',
  'QC Rejected':       'bg-red-500/10 text-red-600',
  'Invoice Matching':  'bg-pink-500/10 text-pink-600',
  'Payment':           'bg-emerald-500/10 text-emerald-600',
  'Completed':         'bg-green-600/10 text-green-700',
  'Rejected':          'bg-red-500/10 text-red-600',
  'Cancelled':         'bg-surface-container text-text-muted',
}

const PRIORITY_COLOR = {
  Low: 'bg-surface-container text-text-muted',
  Medium: 'bg-blue-500/10 text-blue-600',
  High: 'bg-amber-500/10 text-amber-600',
  Urgent: 'bg-red-500/10 text-red-600',
}

function fmt(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = 'text-primary' }) {
  return (
    <div className="bg-surface-container-lowest border border-theme-border rounded-xl xl:rounded-2xl p-3 xl:p-4 flex items-center gap-2 xl:gap-4">
      <div className={`w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl flex items-center justify-center bg-surface-container ${color} flex-shrink-0`}>
        <span className="material-symbols-outlined text-sm xl:text-lg">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] xl:text-[11px] text-text-muted font-semibold uppercase tracking-wide truncate" title={label}>{label}</p>
        <p className="text-sm xl:text-lg font-bold text-on-surface leading-tight break-words">{value}</p>
        {sub && <p className="text-[9px] xl:text-[11px] text-text-muted truncate" title={sub}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Request Modal ────────────────────────────────────────────────────────────
function RequestModal({ initial, onClose, onSave }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    title: '', description: '', department: '', requestedBy: '',
    priority: 'Medium', category: 'General', estimatedAmount: '',
    currency: 'TRY', budgetCode: '', notes: '',
    ...(initial || {}),
  })
  const [errors, setErrors] = useState({})
  const descRef = useRef(null)

  useEffect(() => {
    const el = descRef.current
    if (!el) return
    const adjust = () => {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
    adjust()
    const t = setTimeout(adjust, 50)
    return () => clearTimeout(t)
  }, [form.description])

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))
  const inp = (f) => `w-full bg-surface-container-lowest border rounded-lg px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition ${errors[f] ? 'border-error' : 'border-theme-border'}`

  function handleSave() {
    const e = {}
    if (!form.title.trim()) e.title = t('common.required')
    if (Object.keys(e).length) { setErrors(e); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 md:p-0">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 md:p-6 pb-2 shrink-0">
          <h2 className="text-sm md:text-base font-bold text-on-surface">{initial?.id ? t('purchasing.editRequest') : t('purchasing.newPurchaseRequest')}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-error"><span className="material-symbols-outlined text-lg md:text-xl">close</span></button>
        </div>
        <div className="space-y-2 md:space-y-3 overflow-y-auto p-4 md:p-6 py-3 custom-scrollbar">
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.title')} *</label>
            <input className={inp('title')} value={form.title} onChange={set('title')} placeholder={t('purchasing.titlePh')} />
            {errors.title && <p className="text-xs text-error mt-1">{errors.title}</p>}
          </div>
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.description')}</label>
            <textarea 
              ref={descRef}
              rows={2} 
              className={`${inp('description')} resize-none overflow-hidden`} 
              style={{ minHeight: '3rem', fieldSizing: 'content' }}
              value={form.description} 
              onChange={set('description')}
              onFocus={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.department')}</label>
              <input className={inp('department')} value={form.department} onChange={set('department')} />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.requestedBy')}</label>
              <input className={inp('requestedBy')} value={form.requestedBy} onChange={set('requestedBy')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.priority')}</label>
              <select className={inp('priority')} value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.category')}</label>
              <select className={inp('category')} value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.budgetCode')}</label>
              <input className={inp('budgetCode')} value={form.budgetCode} onChange={set('budgetCode')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.estimatedAmount')}</label>
              <input type="number" min="0" step="0.01" className={inp('estimatedAmount')} value={form.estimatedAmount} onChange={set('estimatedAmount')} />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.currency')}</label>
              <select className={inp('currency')} value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.notes')}</label>
            <textarea rows={2} className={inp('notes')} value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <div className="flex gap-2 md:gap-3 p-4 md:p-6 pt-2 shrink-0">
          <button onClick={onClose} className="flex-1 border border-theme-border rounded-lg py-1.5 md:py-2 text-xs md:text-sm text-text-muted hover:bg-hover-bg transition">{t('common.cancel')}</button>
          <button onClick={handleSave} className="flex-1 bg-primary text-white rounded-lg py-1.5 md:py-2 text-xs md:text-sm font-semibold hover:opacity-90 transition">{t('common.save')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Quotation Modal ──────────────────────────────────────────────────────────
function QuotationModal({ suppliers, initial, onClose, onSave }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(initial || {
    supplierId: '', supplierName: '', quotationNo: '', quotationDate: new Date().toISOString().split('T')[0],
    amount: '', currency: 'TRY', vat: '20', deliveryDays: '', paymentTerms: '', warranty: '', notes: '',
  })
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))
  const inp = (f) => `w-full bg-surface-container-lowest border border-theme-border rounded-lg px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition`

  function handleSave() {
    if (!form.amount) return
    if (form.supplierId) {
      const sup = suppliers.find((s) => s.id === form.supplierId)
      if (sup) form.supplierName = sup.name
    }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 md:p-0">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 md:p-6 pb-2 shrink-0">
          <h2 className="text-sm md:text-base font-bold text-on-surface">{initial ? t('purchasing.editQuotation') : t('purchasing.addQuotation')}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-error"><span className="material-symbols-outlined text-lg md:text-xl">close</span></button>
        </div>
        <div className="space-y-2 md:space-y-3 overflow-y-auto p-4 md:p-6 py-3 custom-scrollbar">
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.supplier')}</label>
            <select className={inp('supplierId')} value={form.supplierId} onChange={set('supplierId')}>
              <option value="">{t('purchasing.manualEntry')}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {!form.supplierId && (
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.supplierName')}</label>
              <input className={inp('supplierName')} value={form.supplierName} onChange={set('supplierName')} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.quoteNo')}</label>
              <input className={inp('quotationNo')} value={form.quotationNo} onChange={set('quotationNo')} />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.quoteDate')}</label>
              <input type="date" className={inp('quotationDate')} value={form.quotationDate} onChange={set('quotationDate')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.amount')} *</label>
              <input type="number" min="0" step="0.01" className={inp('amount')} value={form.amount} onChange={set('amount')} />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.vat')}</label>
              <input type="number" min="0" max="100" className={inp('vat')} value={form.vat} onChange={set('vat')} />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.currency')}</label>
              <select className={inp('currency')} value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.deliveryDays')}</label>
              <input type="number" min="0" className={inp('deliveryDays')} value={form.deliveryDays} onChange={set('deliveryDays')} />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.warranty')}</label>
              <input className={inp('warranty')} value={form.warranty} onChange={set('warranty')} placeholder={t('purchasing.warrantyPh')} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.paymentTerms')}</label>
            <input className={inp('paymentTerms')} value={form.paymentTerms} onChange={set('paymentTerms')} placeholder={t('purchasing.paymentTermsPh')} />
          </div>
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.notes')}</label>
            <textarea rows={2} className={inp('notes')} value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <div className="flex gap-2 md:gap-3 p-4 md:p-6 pt-2 shrink-0">
          <button onClick={onClose} className="flex-1 border border-theme-border rounded-lg py-1.5 md:py-2 text-xs md:text-sm text-text-muted hover:bg-hover-bg transition">{t('common.cancel')}</button>
          <button onClick={handleSave} className="flex-1 bg-primary text-white rounded-lg py-1.5 md:py-2 text-xs md:text-sm font-semibold hover:opacity-90 transition">{t('common.save')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Supplier Modal ───────────────────────────────────────────────────────────
function SupplierModal({ initial, onClose, onSave }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(initial || {
    name: '', category: 'General', contactName: '', contactPhone: '',
    contactEmail: '', address: '', country: '', currency: 'TRY', status: 'Active', notes: '',
  })
  const [errors, setErrors] = useState({})
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))
  const inp = (f) => `w-full bg-surface-container-lowest border rounded-lg px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition ${errors[f] ? 'border-error' : 'border-theme-border'}`

  function handleSave() {
    const e = {}
    if (!form.name.trim()) e.name = t('common.required')
    if (Object.keys(e).length) { setErrors(e); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 md:p-0">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 md:p-6 pb-2 shrink-0">
          <h2 className="text-sm md:text-base font-bold text-on-surface">{initial ? t('purchasing.editSupplier') : t('purchasing.newSupplier')}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-error"><span className="material-symbols-outlined text-lg md:text-xl">close</span></button>
        </div>
        <div className="space-y-2 md:space-y-3 overflow-y-auto p-4 md:p-6 py-3 custom-scrollbar">
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.companyName')} *</label>
            <input className={inp('name')} value={form.name} onChange={set('name')} />
            {errors.name && <p className="text-xs text-error mt-1">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.category')}</label>
              <select className={inp('category')} value={form.category} onChange={set('category')}>
                {SUPPLIER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.status')}</label>
              <select className={inp('status')} value={form.status} onChange={set('status')}>
                <option value="Active">{t('purchasing.statusActive')}</option>
                <option value="Inactive">{t('purchasing.statusInactive')}</option>
                <option value="Blacklisted">{t('purchasing.statusBlacklisted')}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('purchasing.contactPerson')}</label>
              <input className={inp('contactName')} value={form.contactName} onChange={set('contactName')} />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.phone')}</label>
              <input className={inp('contactPhone')} value={form.contactPhone} onChange={set('contactPhone')} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.email')}</label>
            <input className={inp('contactEmail')} value={form.contactEmail} onChange={set('contactEmail')} />
          </div>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.country')}</label>
              <input className={inp('country')} value={form.country} onChange={set('country')} />
            </div>
            <div>
              <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.currency')}</label>
              <select className={inp('currency')} value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.address')}</label>
            <input className={inp('address')} value={form.address} onChange={set('address')} />
          </div>
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-0.5 md:mb-1">{t('common.notes')}</label>
            <textarea rows={2} className={inp('notes')} value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <div className="flex gap-2 md:gap-3 p-4 md:p-6 pt-2 shrink-0">
          <button onClick={onClose} className="flex-1 border border-theme-border rounded-lg py-1.5 md:py-2 text-xs md:text-sm text-text-muted hover:bg-hover-bg transition">{t('common.cancel')}</button>
          <button onClick={handleSave} className="flex-1 bg-primary text-white rounded-lg py-1.5 md:py-2 text-xs md:text-sm font-semibold hover:opacity-90 transition">{t('common.save')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Detail Drawer ────────────────────────────────────────────────────────────
function DetailDrawer({ request, suppliers, onClose, onEdit, onDelete, onUpdate, onAddQuotation, onSelectQuotation, onDeleteQuotation, canCreateEdit }) {
  const { t } = useTranslation()
  const r = request
  const { user } = useAuth()
  const { userPurchasingStatusPermissions } = useData()
  const stageIdx = WORKFLOW_STAGES.findIndex((s) => s.key === r.status)
  const quotations = r.quotations || []
  const selectedQuote = quotations.find((q) => q.selected)
  const isTerminal = TERMINAL.includes(r.status)
  const isAdmin = user?.role === 'admin'
  const canEditDelete = isAdmin || (canCreateEdit && r.status === 'Request')
  const canAdvanceFromCurrent = isAdmin || (userPurchasingStatusPermissions[user?.id] || []).includes(r.status)

  function nextStatus() {
    const map = {
      'Request': 'Budget Review',
      'Budget Review': 'Collecting Quotes',
      'Collecting Quotes': 'Comparison',
      'Comparison': 'Pending Approval',
      'Pending Approval': 'PO Created',
      'PO Created': 'In Logistics',
      'In Logistics': 'Quality Check',
      'Quality Check': 'Invoice Matching',
      'Invoice Matching': 'Payment',
      'Payment': 'Completed',
    }
    return map[r.status]
  }

  function canAdvance() {
    if (isTerminal) return false
    if (!canAdvanceFromCurrent) return false
    if (r.status === 'Collecting Quotes' && quotations.length < 3) return false
    if (r.status === 'Comparison' && !selectedQuote) return false
    return true
  }

  function advanceLabel() {
    const labels = {
      'Request': t('purchasing.advReqToBudget'),
      'Budget Review': t('purchasing.advBudgetToQuotes'),
      'Collecting Quotes': t('purchasing.advQuotesToComp'),
      'Comparison': t('purchasing.advCompToApproval'),
      'Pending Approval': t('purchasing.advApprovalToPO'),
      'PO Created': t('purchasing.advPOToLogistics'),
      'In Logistics': t('purchasing.advLogisticsToQC'),
      'Quality Check': t('purchasing.advQCToInvoice'),
      'Invoice Matching': t('purchasing.advInvoiceToPayment'),
      'Payment': t('purchasing.advComplete'),
    }
    return labels[r.status] || t('purchasing.advance')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 md:p-0">
      <div className="bg-surface-container-lowest w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl rounded-2xl">
        {/* Header */}
        <div className="p-3 md:p-4 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-text-muted">{r.code}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${STATUS_BADGE[r.status] || 'bg-surface-container text-text-muted'}`}>
                {r.status}
              </span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${PRIORITY_COLOR[r.priority]}`}>
                {r.priority}
              </span>
            </div>
            <div className="flex items-center gap-3">

              <div className="flex items-center gap-1">
                {canEditDelete && <button onClick={onEdit} className="text-text-muted hover:text-primary transition p-1 rounded-lg hover:bg-hover-bg" title="Edit"><span className="material-symbols-outlined text-sm">edit</span></button>}
                {canEditDelete && <button onClick={onDelete} className="text-text-muted hover:text-error transition p-1 rounded-lg hover:bg-hover-bg" title="Delete"><span className="material-symbols-outlined text-sm">delete</span></button>}
                <button onClick={onClose} className="text-text-muted hover:text-error p-1 rounded-lg hover:bg-hover-bg"><span className="material-symbols-outlined text-lg md:text-xl">close</span></button>
              </div>
            </div>
          </div>
          <h2 className="text-[11px] md:text-xs font-bold text-on-surface">{r.title}</h2>
          {r.description && <p className="text-[9px] md:text-[10px] text-text-muted mt-0.5">{r.description}</p>}
        </div>

        <div className="p-3 md:p-4 py-2 overflow-y-auto custom-scrollbar space-y-3">
          {/* Progress bar */}
          <div>
            <p className="text-xs font-semibold text-text-muted mb-2">{t('purchasing.processStatus')}</p>
            <div className="flex items-center gap-0.5">
              {WORKFLOW_STAGES.map((stage, i) => (
                <div key={stage.key} className="flex items-center flex-1">
                  <div className={`h-1.5 w-full rounded-full ${i <= stageIdx ? stage.bg : 'bg-theme-border'}`} />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-text-muted">{t('purchasing.stageFirst')}</span>
              <span className="text-[10px] text-text-muted">{t('purchasing.stageLast')}</span>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              [t('common.department'), r.department],
              [t('purchasing.requestedBy'), r.requestedBy],
              [t('common.category'), r.category],
              [t('purchasing.estimatedAmount'), `${r.currency} ${fmt(r.estimatedAmount)}`],
              [t('purchasing.budgetCode'), r.budgetCode],
              [t('common.date'), new Date(r.createdAt).toLocaleDateString('en-US')],
            ].map(([label, val]) => (
              <div key={label} className="bg-surface-container rounded-lg p-2.5">
                <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">{label}</p>
                <p className="text-xs md:text-sm font-medium text-on-surface mt-0.5">{val || '—'}</p>
              </div>
            ))}
          </div>

          {/* Stage-specific: Budget Review */}
          {r.status === 'Budget Review' && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs font-bold text-amber-600 mb-1.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs">account_balance</span> {t('purchasing.budgetReviewTitle')}
              </p>
              <p className="text-[10px] text-text-muted mb-2">{t('purchasing.budgetEstimated')} <strong>{r.currency} {fmt(r.estimatedAmount)}</strong></p>
              <textarea
                className="w-full bg-surface-container-lowest border border-theme-border rounded-lg px-2 py-1.5 text-xs text-on-surface outline-none mb-2"
                rows={2}
                placeholder={t('purchasing.budgetNotePh')}
                value={r.budgetNotes || ''}
                onChange={(e) => onUpdate({ budgetNotes: e.target.value })}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdate({ status: 'Rejected', rejectionReason: 'Budget not approved', budgetApproved: false })}
                  className="px-3 py-1 rounded-lg bg-error/10 text-error text-[10px] md:text-xs font-semibold hover:bg-error/20 transition"
                >
                  {t('purchasing.rejectBudget')}
                </button>
              </div>
            </div>
          )}

          {/* Stage-specific: Quotations */}
          {['Collecting Quotes', 'Comparison', 'Pending Approval'].includes(r.status) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs md:text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs md:text-sm text-purple-500">request_quote</span>
                  {t('purchasing.quotationsHeader', { count: quotations.length })}
                </p>
                {r.status === 'Collecting Quotes' && (
                  <button onClick={onAddQuotation} className="flex items-center gap-0.5 text-[10px] md:text-xs text-primary hover:opacity-80 font-semibold">
                    <span className="material-symbols-outlined text-xs md:text-sm">add</span> {t('purchasing.addQuote')}
                  </button>
                )}
              </div>
              {quotations.length === 0 ? (
                <div className="border border-dashed border-theme-border rounded-lg p-4 text-center text-[10px] md:text-xs text-text-muted">
                  {t('purchasing.noQuotations')}
                </div>
              ) : (
                <div className="space-y-2">
                  {quotations.map((q) => {
                    const total = (q.amount || 0) * (1 + (q.vat || 0) / 100)
                    const isBest = quotations.length >= 3 && total === Math.min(...quotations.map((x) => (x.amount || 0) * (1 + (x.vat || 0) / 100)))
                    return (
                      <div key={q.id} className={`p-3 rounded-lg border ${q.selected ? 'bg-green-500/5 border-green-500/20' : 'bg-surface-container border-theme-border'}`}>
                        <div className="flex justify-between items-start mb-2.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              {q.selected && <span className="material-symbols-outlined text-green-600 text-[14px]">check_circle</span>}
                              <p className="font-bold text-xs text-on-surface">{q.supplier?.name || q.supplierName || '—'}</p>
                            </div>
                            {q.quotationNo && <p className="text-[9px] text-text-muted mt-0.5">#{q.quotationNo}</p>}
                          </div>
                          <div className="text-right">
                            <p className={`font-mono font-bold text-xs ${isBest || q.selected ? 'text-green-600' : 'text-on-surface'}`}>{q.currency} {fmt(total)}</p>
                            {isBest ? <p className="text-[8px] text-green-600 font-bold uppercase mt-0.5">{t('purchasing.lowest')}</p> : <p className="text-[8px] text-text-muted mt-0.5">{t('orders.total')}</p>}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9px] md:text-[10px]">
                          <div className="flex justify-between border-b border-theme-border/50 pb-1">
                            <span className="text-text-muted">{t('purchasing.amount')}:</span>
                            <span className="font-mono font-medium text-on-surface">{q.currency} {fmt(q.amount)} (+%{q.vat})</span>
                          </div>
                          <div className="flex justify-between border-b border-theme-border/50 pb-1">
                            <span className="text-text-muted">{t('purchasing.deliveryDays')}:</span>
                            <span className="font-medium text-on-surface">{q.deliveryDays ? t('purchasing.deliveryDaysSuffix', { n: q.deliveryDays }) : '—'}</span>
                          </div>
                          <div className="flex justify-between border-b border-theme-border/50 pb-1">
                            <span className="text-text-muted">{t('purchasing.warranty')}:</span>
                            <span className="font-medium text-on-surface">{q.warranty || '—'}</span>
                          </div>
                          <div className="flex justify-between border-b border-theme-border/50 pb-1">
                            <span className="text-text-muted">{t('purchasing.paymentTerms')}:</span>
                            <span className="font-medium text-on-surface">{q.paymentTerms || '—'}</span>
                          </div>
                        </div>

                        {(r.status === 'Comparison' && !q.selected) || (r.status === 'Collecting Quotes') ? (
                          <div className="mt-2.5 flex justify-end">
                            {r.status === 'Comparison' && !q.selected && (
                              <button onClick={() => onSelectQuotation(q.id)} className="flex items-center gap-1 text-[9px] font-bold text-primary hover:opacity-80 px-2 py-1 bg-primary/10 rounded">
                                <span className="material-symbols-outlined text-[12px]">task_alt</span> {t('purchasing.selectQuote', 'Seç')}
                              </button>
                            )}
                            {r.status === 'Collecting Quotes' && (
                              <button onClick={() => onDeleteQuotation(q.id)} className="flex items-center gap-1 text-[9px] font-bold text-error hover:opacity-80 px-2 py-1 bg-error/10 rounded">
                                <span className="material-symbols-outlined text-[12px]">delete</span> {t('common.delete')}
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
              {r.status === 'Collecting Quotes' && quotations.length > 0 && quotations.length < 3 && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  {t('purchasing.minQuotesWarning', { count: quotations.length })}
                </p>
              )}
            </div>
          )}

          {/* Stage-specific: Quality Check */}
          {r.status === 'Quality Check' && (
            <div className="bg-lime-500/5 border border-lime-500/20 rounded-lg p-2 md:p-2.5">
              <p className="text-[10px] md:text-[11px] font-bold text-lime-700 mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">verified</span> Quality Check
              </p>
              <textarea
                className="w-full bg-surface-container-lowest border border-theme-border rounded-lg px-2 py-1 text-[10px] md:text-[11px] text-on-surface outline-none mb-1.5 custom-scrollbar"
                rows={2}
                placeholder="Quality check notes..."
                value={r.qcNotes || ''}
                onChange={(e) => onUpdate({ qcNotes: e.target.value })}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => onUpdate({ status: 'QC Rejected', qcResult: 'Rejected', qcDate: new Date().toISOString().split('T')[0] })}
                  className="px-2.5 py-0.5 rounded-lg bg-error/10 text-error text-[9px] font-bold hover:bg-error/20 transition"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Stage-specific: Invoice Matching */}
          {r.status === 'Invoice Matching' && (
            <div className="bg-pink-500/5 border border-pink-500/20 rounded-lg p-2 md:p-2.5 space-y-1.5">
              <p className="text-[10px] md:text-[11px] font-bold text-pink-600 mb-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">receipt</span> Invoice Matching
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[8px] md:text-[9px] font-semibold text-text-muted mb-0.5">Invoice No</label>
                  <input
                    className="w-full bg-surface-container-lowest border border-theme-border rounded-lg px-2 py-0.5 text-[10px] md:text-[11px] text-on-surface outline-none"
                    value={r.invoiceNo || ''}
                    onChange={(e) => onUpdate({ invoiceNo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[8px] md:text-[9px] font-semibold text-text-muted mb-0.5">Invoice Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-theme-border rounded-lg px-2 py-0.5 text-[10px] md:text-[11px] text-on-surface outline-none"
                    value={r.invoiceDate || ''}
                    onChange={(e) => onUpdate({ invoiceDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[8px] md:text-[9px] font-semibold text-text-muted mb-0.5">Invoice Amount</label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full bg-surface-container-lowest border border-theme-border rounded-lg px-2 py-0.5 text-[10px] md:text-[11px] text-on-surface outline-none"
                  value={r.invoiceAmount || ''}
                  onChange={(e) => onUpdate({ invoiceAmount: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Stage-specific: Payment */}
          {r.status === 'Payment' && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2 md:p-2.5 space-y-1.5">
              <p className="text-[10px] md:text-[11px] font-bold text-emerald-600 mb-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">payments</span> Payment Schedule
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[8px] md:text-[9px] font-semibold text-text-muted mb-0.5">Payment Due Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-theme-border rounded-lg px-2 py-0.5 text-[10px] md:text-[11px] text-on-surface outline-none"
                    value={r.paymentDueDate || ''}
                    onChange={(e) => onUpdate({ paymentDueDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[8px] md:text-[9px] font-semibold text-text-muted mb-0.5">Payment Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest border border-theme-border rounded-lg px-2 py-0.5 text-[10px] md:text-[11px] text-on-surface outline-none"
                    value={r.paymentDate || ''}
                    onChange={(e) => onUpdate({ paymentDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {r.notes && (
            <div className="bg-surface-container rounded-lg p-2 md:p-2.5">
              <p className="text-[8px] md:text-[9px] font-semibold text-text-muted uppercase mb-0.5">Notes</p>
              <p className="text-[10px] md:text-[11px] text-on-surface whitespace-pre-wrap">{r.notes}</p>
            </div>
          )}

          {/* Rejection reason */}
          {['Rejected', 'Budget Rejected', 'QC Rejected'].includes(r.status) && r.rejectionReason && (
            <div className="bg-error/5 border border-error/20 rounded-lg p-2 md:p-2.5">
              <p className="text-[9px] md:text-[10px] font-bold text-error mb-0.5">Rejection Reason</p>
              <p className="text-[10px] md:text-[11px] text-on-surface">{r.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 pt-2 shrink-0">
          {!isTerminal && (
            <>
              {canCreateEdit && (
                <button
                  onClick={() => onUpdate({ status: 'Cancelled' })}
                  className="px-3 py-1.5 rounded-lg border border-error/30 text-error text-[10px] md:text-xs font-semibold hover:bg-error/5 transition"
                >
                  Cancel Request
                </button>
              )}
              <div className="flex-1" />
              <button
                disabled={!canAdvance()}
                onClick={() => {
                  const updates = { status: nextStatus() }
                  if (r.status === 'Budget Review') updates.budgetApproved = true
                  if (r.status === 'Quality Check') {
                    updates.qcResult = 'Accepted'
                    updates.qcDate = new Date().toISOString().split('T')[0]
                  }
                  if (r.status === 'Invoice Matching') updates.invoiceMatched = true
                  onUpdate(updates)
                }}
                className={`px-3 py-1.5 md:px-4 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold transition flex items-center gap-1.5 ${
                  canAdvance()
                    ? 'bg-primary text-white hover:opacity-90'
                    : 'bg-surface-container text-text-muted cursor-not-allowed'
                }`}
              >
                {advanceLabel()}
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </>
          )}
          {isTerminal && (
            <div className="w-full text-center">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
                r.status === 'Completed' ? 'bg-green-500/10 text-green-700' : 'bg-error/10 text-error'
              }`}>
                <span className="material-symbols-outlined text-sm">{r.status === 'Completed' ? 'check_circle' : 'cancel'}</span>
                {r.status === 'Completed' ? 'Process Completed' : `Process Ended (${r.status})`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Purchasing() {
  const { t } = useTranslation()
  const { token, user } = useAuth()
  const { permissions } = useData()
  const isAdmin = user?.role === 'admin'
  const canCreateEdit = isAdmin || (permissions[user?.department] || []).includes('purchasing:create')
  const BASE = `${API_URL}/purchasing`
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const authH = { Authorization: `Bearer ${token}` }

  const [tab, setTab] = useState('requests')
  const [requests, setRequests] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [requestModal, setRequestModal] = useState(null)
  const [supplierModal, setSupplierModal] = useState(null)
  const [quotationModal, setQuotationModal] = useState(null)
  const [detailDrawer, setDetailDrawer] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reqRes, supRes] = await Promise.all([
        fetch(`${BASE}/requests`, { headers: authH }),
        fetch(`${BASE}/suppliers`, { headers: authH }),
      ])
      const [reqData, supData] = await Promise.all([reqRes.json(), supRes.json()])

      setRequests(Array.isArray(reqData) ? reqData : [])
      setSuppliers(Array.isArray(supData) ? supData : [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  // Stats
  const activeReqs = requests.filter((r) => !TERMINAL.includes(r.status))
  const totalEst = requests.filter((r) => !['Cancelled', 'Rejected'].includes(r.status)).reduce((s, r) => s + (r.estimatedAmount || 0), 0)

  // Filtered
  const filteredRequests = requests.filter((r) => {
    const q = search.toLowerCase()
    return !q || r.code?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q) || r.department?.toLowerCase().includes(q) || r.requestedBy?.toLowerCase().includes(q)
  })

  const filteredSuppliers = suppliers.filter((s) => {
    const q = search.toLowerCase()
    return !q || s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q) || s.country?.toLowerCase().includes(q)
  })

  // CRUD
  async function saveRequest(form) {
    const isEdit = requestModal && !requestModal._isNew && requestModal !== 'new'
    const url = isEdit ? `${BASE}/requests/${requestModal.id}` : `${BASE}/requests`
    await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(form) })
    setRequestModal(null)
    load()
  }

  async function saveSupplier(form) {
    const isEdit = supplierModal && supplierModal !== 'new'
    const url = isEdit ? `${BASE}/suppliers/${supplierModal.id}` : `${BASE}/suppliers`
    await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(form) })
    setSupplierModal(null)
    load()
  }

  async function updateRequest(id, updates) {
    const res = await fetch(`${BASE}/requests/${id}`, {
      method: 'PUT', headers, body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Update failed')
    const updated = await res.json()
    setRequests((prev) => prev.map((r) => r.id === id ? updated : r))
    if (detailDrawer?.id === id) setDetailDrawer(updated)
  }

  async function addQuotation(form) {
    await fetch(`${BASE}/requests/${detailDrawer.id}/quotations`, {
      method: 'POST', headers, body: JSON.stringify(form),
    })
    setQuotationModal(null)
    load().then(() => {
      fetch(`${BASE}/requests`, { headers: authH })
        .then((r) => r.json())
        .then((data) => {
          const updated = data.find((r) => r.id === detailDrawer.id)
          if (updated) setDetailDrawer(updated)
        })
    })
  }

  async function selectQuotation(qId) {
    await fetch(`${BASE}/quotations/${qId}/select`, { method: 'PUT', headers })
    load().then(() => {
      fetch(`${BASE}/requests`, { headers: authH })
        .then((r) => r.json())
        .then((data) => {
          const updated = data.find((r) => r.id === detailDrawer.id)
          if (updated) setDetailDrawer(updated)
        })
    })
  }

  async function deleteQuotation(qId) {
    await fetch(`${BASE}/quotations/${qId}`, { method: 'DELETE', headers: authH })
    load().then(() => {
      fetch(`${BASE}/requests`, { headers: authH })
        .then((r) => r.json())
        .then((data) => {
          const updated = data.find((r) => r.id === detailDrawer.id)
          if (updated) setDetailDrawer(updated)
        })
    })
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    const { type, id } = deleteConfirm
    await fetch(`${BASE}/${type}/${id}`, { method: 'DELETE', headers: authH })
    setDeleteConfirm(null)
    if (detailDrawer?.id === id) setDetailDrawer(null)
    load()
  }

  return (
    <div className="p-2.5 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-on-surface">{t('purchasing.title')}</h1>
          <p className="text-[10px] md:text-sm text-text-muted mt-0.5">{t('purchasing.subtitle')}</p>
        </div>
        {(tab === 'suppliers' ? isAdmin : canCreateEdit) && (
          <button
            onClick={() => tab === 'suppliers' ? setSupplierModal('new') : setRequestModal({ _isNew: true, requestedBy: user?.name || '' })}
            className="flex items-center gap-1 md:gap-1.5 primary-gradient text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold shadow-xl shadow-primary/10 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-xs md:text-sm">add</span>
            {tab === 'suppliers' ? t('purchasing.newSupplier') : t('purchasing.newRequest')}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard icon="assignment" label={t('purchasing.totalRequests')} value={requests.length} sub={t('purchasing.activeCount', { n: activeReqs.length })} />
        <StatCard icon="pending_actions" label={t('purchasing.inProgress')} value={activeReqs.length} color="text-amber-500" />
        <StatCard icon="check_circle" label={t('purchasing.completed')} value={requests.filter((r) => r.status === 'Completed').length} color="text-green-500" />
        <StatCard icon="storefront" label={t('purchasing.suppliers')} value={suppliers.filter((s) => s.status === 'Active').length} sub={t('purchasing.totalCount', { n: suppliers.length })} color="text-purple-500" />
        <StatCard icon="payments" label="TOPLAM" value={totalEst % 1000 === 0 && totalEst > 0 ? (totalEst / 1000).toLocaleString('en-US') + 'K' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 3 }).format(totalEst)} sub="TRY" color="text-blue-500" />
      </div>


      {/* Tabs + Table */}
      <div className="bg-surface-container-lowest border border-theme-border rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 md:px-5 pt-3 border-b border-theme-border">
          <div className="flex items-center gap-3 md:gap-4 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {[
              { key: 'requests', label: 'Purchase Requests' },
              { key: 'suppliers', label: 'Suppliers' },
            ].map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => { setTab(tabItem.key); setSearch('') }}
                className={`pb-2 text-xs md:text-sm font-semibold border-b-2 transition whitespace-nowrap ${tab === tabItem.key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-on-surface'}`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-auto flex items-center pb-2 md:pb-3">
            <div className="relative w-full sm:w-auto">
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[12px] md:text-sm text-text-muted">search</span>
              <input
                className="bg-surface-container border border-theme-border rounded-lg pl-7 pr-2.5 py-1 text-xs md:text-sm text-on-surface outline-none focus:border-primary w-full sm:w-48"
                placeholder={t('purchasing.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-sm gap-2">
            <span className="material-symbols-outlined animate-spin">refresh</span> Loading...
          </div>
        ) : tab === 'requests' ? (
          <RequestTable
            requests={filteredRequests}
            onOpen={(r) => setDetailDrawer(r)}
          />
        ) : (
          <SupplierTable
            suppliers={filteredSuppliers}
            onEdit={(s) => setSupplierModal(s)}
            onDelete={(id) => setDeleteConfirm({ type: 'suppliers', id })}
          />
        )}
      </div>

      {/* Modals */}
      {requestModal && <RequestModal initial={requestModal === 'new' || requestModal._isNew ? { requestedBy: requestModal?.requestedBy || '' } : requestModal} onClose={() => setRequestModal(null)} onSave={saveRequest} />}
      {supplierModal && <SupplierModal initial={supplierModal === 'new' ? null : supplierModal} onClose={() => setSupplierModal(null)} onSave={saveSupplier} />}
      {quotationModal && <QuotationModal suppliers={suppliers} initial={null} onClose={() => setQuotationModal(null)} onSave={addQuotation} />}
      {detailDrawer && (
        <DetailDrawer
          request={detailDrawer}
          suppliers={suppliers}
          canCreateEdit={canCreateEdit}
          onClose={() => setDetailDrawer(null)}
          onEdit={() => { setRequestModal(detailDrawer); setDetailDrawer(null) }}
          onDelete={() => setDeleteConfirm({ type: 'requests', id: detailDrawer.id })}
          onUpdate={(updates) => updateRequest(detailDrawer.id, updates)}
          onAddQuotation={() => setQuotationModal('new')}
          onSelectQuotation={selectQuotation}
          onDeleteQuotation={deleteQuotation}
        />
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 md:p-0">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl p-5 md:p-6 max-w-[320px] md:max-w-sm w-full text-center">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-error-container flex items-center justify-center mx-auto mb-3 md:mb-4">
              <span className="material-symbols-outlined text-2xl md:text-3xl text-error">delete_forever</span>
            </div>
            <h2 className="text-sm md:text-base font-bold text-on-surface mb-1">{t('common.areYouSure')}</h2>
            <p className="text-xs md:text-sm text-text-muted mb-4 md:mb-6">{t('common.cantUndo')}</p>
            <div className="flex gap-2 md:gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 border border-theme-border rounded-lg py-1.5 md:py-2 text-xs md:text-sm text-text-muted hover:bg-hover-bg transition">{t('common.cancel')}</button>
              <button onClick={handleDelete} className="flex-1 bg-error text-white rounded-lg py-1.5 md:py-2 text-xs md:text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-1.5 md:gap-2">
                <span className="material-symbols-outlined text-sm md:text-base">delete</span>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Request Table ─────────────────────────────────────────────────────────────
function RequestTable({ requests, onOpen }) {
  const { t } = useTranslation()
  if (requests.length === 0) return (
    <div className="flex flex-col items-center justify-center h-24 md:h-32 text-text-muted gap-1.5">
      <span className="material-symbols-outlined text-xl md:text-2xl">assignment</span>
      <p className="text-xs">{t('purchasing.noData')}</p>
    </div>
  )

  return (
    <>
      <div className="hidden 2xl:block overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-left text-xs text-text-muted border-b border-theme-border">
              <th className="px-6 py-3 font-semibold">{t('common.code')}</th>
              <th className="px-4 py-3 font-semibold">{t('common.title')}</th>
              <th className="px-4 py-3 font-semibold">{t('common.department')}</th>
              <th className="px-4 py-3 font-semibold">{t('common.priority')}</th>
              <th className="px-4 py-3 font-semibold">{t('common.status')}</th>
              <th className="px-4 py-3 font-semibold">{t('purchasing.totalAmount')}</th>
              <th className="px-4 py-3 font-semibold">Quotes</th>
              <th className="px-4 py-3 font-semibold">{t('common.date')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {requests.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r)} className="hover:bg-hover-bg transition-colors cursor-pointer">
                <td className="px-6 py-3 font-mono font-semibold text-primary text-xs">{r.code}</td>
                <td className="px-4 py-3 text-on-surface font-medium max-w-[300px] truncate">{r.title}</td>
                <td className="px-4 py-3 text-text-muted">{r.department || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${PRIORITY_COLOR[r.priority]}`}>{r.priority}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATUS_BADGE[r.status] || 'bg-surface-container text-text-muted'}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.currency} {fmt(r.estimatedAmount)}</td>
                <td className="px-4 py-3">
                  <span className="text-text-muted">{(r.quotations || []).length}</span>
                  {(r.quotations || []).some((q) => q.selected) && (
                    <span className="material-symbols-outlined text-green-500 text-xs ml-1">check_circle</span>
                  )}
                </td>
                <td className="px-4 py-3 text-text-muted text-xs">{new Date(r.createdAt).toLocaleDateString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="2xl:hidden flex flex-col divide-y divide-theme-border">
        {requests.map((r) => (
          <div key={r.id} onClick={() => onOpen(r)} className="p-3 hover:bg-hover-bg transition-colors cursor-pointer flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-primary text-[9px]">{r.code}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${STATUS_BADGE[r.status] || 'bg-surface-container text-text-muted'}`}>{r.status}</span>
            </div>
            <div className="text-xs font-bold text-on-surface line-clamp-2">{r.title}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted mt-0.5">
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">domain</span> {r.department || '—'}</div>
              <div className="flex items-center gap-1">
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${PRIORITY_COLOR[r.priority]}`}>{r.priority}</span>
              </div>
              <div className="flex items-center gap-1 font-mono font-semibold text-on-surface-variant">{r.currency} {fmt(r.estimatedAmount)}</div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-text-muted mt-1.5 pt-1.5 border-t border-theme-border/50">
              <div className="flex items-center gap-1">
                Quotes: {(r.quotations || []).length}
                {(r.quotations || []).some((q) => q.selected) && <span className="material-symbols-outlined text-green-500 text-[12px]">check_circle</span>}
              </div>
              <div>{new Date(r.createdAt).toLocaleDateString('en-US')}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Supplier Table ────────────────────────────────────────────────────────────
function SupplierTable({ suppliers, onEdit, onDelete }) {
  const { t } = useTranslation()
  if (suppliers.length === 0) return (
    <div className="flex flex-col items-center justify-center h-24 md:h-32 text-text-muted gap-1.5">
      <span className="material-symbols-outlined text-xl md:text-2xl">storefront</span>
      <p className="text-xs">{t('common.noData')}</p>
    </div>
  )

  return (
    <>
      <div className="hidden 2xl:block overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-left text-xs text-text-muted border-b border-theme-border">
              <th className="px-6 py-3 font-semibold">{t('common.code')}</th>
              <th className="px-4 py-3 font-semibold">{t('common.name')}</th>
              <th className="px-4 py-3 font-semibold">{t('common.category')}</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">{t('common.country')}</th>
              <th className="px-4 py-3 font-semibold">{t('common.currency')}</th>
              <th className="px-4 py-3 font-semibold">{t('common.status')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-hover-bg transition-colors">
                <td className="px-6 py-3 font-mono text-xs text-text-muted">{s.code}</td>
                <td className="px-4 py-3 font-semibold text-on-surface">{s.name}</td>
                <td className="px-4 py-3 text-text-muted">{s.category}</td>
                <td className="px-4 py-3">
                  <div className="text-on-surface">{s.contactName || '—'}</div>
                  {s.contactEmail && <div className="text-xs text-text-muted">{s.contactEmail}</div>}
                </td>
                <td className="px-4 py-3 text-text-muted">{s.country || '—'}</td>
                <td className="px-4 py-3 text-text-muted">{s.currency}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    s.status === 'Active' ? 'bg-green-500/10 text-green-600' :
                    s.status === 'Blacklisted' ? 'bg-error/10 text-error' :
                    'bg-surface-container text-text-muted'
                  }`}>{s.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(s)} className="text-text-muted hover:text-primary transition">
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onClick={() => onDelete(s.id)} className="text-text-muted hover:text-error transition">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="2xl:hidden flex flex-col divide-y divide-theme-border">
        {suppliers.map((s) => (
          <div key={s.id} className="p-3 hover:bg-hover-bg transition-colors flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-text-muted text-[9px]">{s.code}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
                s.status === 'Active' ? 'bg-green-500/10 text-green-600' :
                s.status === 'Blacklisted' ? 'bg-error/10 text-error' :
                'bg-surface-container text-text-muted'
              }`}>{s.status}</span>
            </div>
            <div className="text-xs font-bold text-on-surface">{s.name}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted mt-0.5">
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">category</span> {s.category || '—'}</div>
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">public</span> {s.country || '—'}</div>
              <div className="flex items-center gap-1 font-mono">{s.currency}</div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-text-muted mt-1.5 pt-1.5 border-t border-theme-border/50">
              <div>
                <span className="text-on-surface-variant font-medium">{s.contactName || '—'}</span>
                {s.contactEmail && <span className="text-text-muted"> · {s.contactEmail}</span>}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => onEdit(s)} className="text-text-muted hover:text-primary transition">
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
                <button onClick={() => onDelete(s.id)} className="text-text-muted hover:text-error transition">
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
