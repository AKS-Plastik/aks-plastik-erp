import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import { useCurrencyRates } from '../hooks/useCurrencyRates'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { addLogoToPDF } from '../utils/pdfLogo'

const ITEMS_PER_PAGE = 15

const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'AED', 'SAR', 'JPY', 'CNY', 'INR', 'CAD', 'AUD']

const INCOME_CATEGORIES = [
  'Sales Revenue', 'Other',
]
const EXPENSE_CATEGORIES = [
  'Salaries & Wages', 'Rent & Lease', 'Utilities', 'Raw Materials',
  'Travel & Transport', 'Marketing', 'IT & Software', 'Maintenance',
  'Insurance', 'Taxes', 'Legal & Professional', 'Supplies', 'Other Expense',
]

const emptyForm = {
  type: 'income',
  category: 'Sales Revenue',
  amount: '',
  currency: 'USD',
  date: new Date().toISOString().split('T')[0],
  reference: '',
  description: '',
  orderId: '',
  paymentMethod: '',
  checkYil: '',
  checkBanka: '',
  checkBelgeNo: '',
  checkVade: '',
  checkBedel: '',
  checkCiranta: '',
  checkCirantaAdi: '',
  checkKendi: false,
  checkBorclu: '',
  checkBorcluVKN: '',
  checkCekNo: '',
  checkSubeAdi: '',
  checkCekHesabi: '',
  checkIBAN: '',
  checkYore: '',
  checkYoreAdi: '',
  checkAciklama: '',
}

function fmt(n) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}




// ─── Modal ───────────────────────────────────────────────────────────────────
function Modal({ title, form, setForm, onClose, onSave, errors, orders, rates, ratesBase }) {
  const { t } = useTranslation()
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const inp = (field) =>
    `w-full bg-surface-container-lowest border rounded-lg px-2.5 py-1.5 text-[11px] md:text-xs text-on-surface outline-none focus:border-primary transition ${errors[field] ? 'border-error' : 'border-theme-border'}`
  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 md:p-0" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 md:p-5 pb-3 shrink-0">
          <h2 className="text-sm md:text-base font-bold text-on-surface">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-error transition">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 md:px-5 pb-2 custom-scrollbar">

          {/* Type toggle */}
          <div className="flex gap-2 mb-3">
            {['income', 'expense'].map(type => (
              <button
                key={type}
                onClick={() => setForm(f => ({ ...f, type, category: type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] }))}
                className={`flex-1 py-1.5 rounded-lg text-[11px] md:text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${form.type === type
                    ? type === 'income' ? 'bg-primary text-white border-primary' : 'bg-error text-white border-error'
                    : 'border-theme-border text-text-muted hover:bg-hover-bg'
                  }`}
              >
                <span className="material-symbols-outlined text-[14px] md:text-[16px]">{type === 'income' ? 'trending_up' : 'trending_down'}</span>
                {type === 'income' ? t('finance.income') : t('finance.expense')}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] md:text-[11px] font-semibold text-text-muted mb-0.5">{t('common.date')} *</label>
                <input type="date" className={inp('date')} value={form.date} onChange={set('date')} />
                {errors.date && <p className="text-[10px] text-error mt-0.5">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-[10px] md:text-[11px] font-semibold text-text-muted mb-0.5">{t('common.amount')} *</label>
                <div className="flex gap-1.5">
                  <select
                    className="bg-surface-container-lowest border border-theme-border rounded-lg px-1.5 md:px-2 py-1.5 text-[11px] md:text-xs text-on-surface outline-none focus:border-primary shrink-0"
                    value={form.currency}
                    onChange={set('currency')}
                  >
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" className={`${inp('amount')} flex-1`}
                    value={form.amount} onChange={set('amount')} placeholder="0.00" />
                </div>
                {errors.amount && <p className="text-[10px] text-error mt-0.5">{errors.amount}</p>}
                {rates && form.currency && form.currency !== ratesBase && rates[form.currency] && (
                  <p className="text-[9px] text-text-muted mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px]">currency_exchange</span>
                    1 {ratesBase} = {rates[form.currency].toFixed(4)} {form.currency}
                    {form.amount > 0 && (
                      <span className="ml-1 font-semibold text-primary">
                        ≈ {(parseFloat(form.amount) / rates[form.currency]).toFixed(2)} {ratesBase}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] md:text-[11px] font-semibold text-text-muted mb-0.5">{t('common.category')}</label>
                <select className={inp('category')} value={form.category} onChange={set('category')}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] md:text-[11px] font-semibold text-text-muted mb-0.5">{t('finance.paymentMethod')}</label>
                <select className={inp('paymentMethod')} value={form.paymentMethod} onChange={set('paymentMethod')}>
                  <option value="">— Select —</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                </select>
              </div>
            </div>
            {/* Check fields */}
            {form.paymentMethod === 'Check' && (
              <div className="border border-theme-border rounded-lg p-3 space-y-2.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[12px]">receipt</span>
                  Çek Bilgileri
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Yıl</label>
                    <input className={inp('checkYil')} value={form.checkYil} onChange={set('checkYil')} placeholder="2025" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Banka</label>
                    <input className={inp('checkBanka')} value={form.checkBanka} onChange={set('checkBanka')} placeholder="Banka adı" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Belge No</label>
                    <input className={inp('checkBelgeNo')} value={form.checkBelgeNo} onChange={set('checkBelgeNo')} placeholder="Belge numarası" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Çek No.</label>
                    <input className={inp('checkCekNo')} value={form.checkCekNo} onChange={set('checkCekNo')} placeholder="Çek numarası" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Vade</label>
                    <input type="date" className={inp('checkVade')} value={form.checkVade} onChange={set('checkVade')} />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Bedel</label>
                    <input type="number" min="0" step="0.01" className={inp('checkBedel')} value={form.checkBedel} onChange={set('checkBedel')} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Şube Adı</label>
                    <input className={inp('checkSubeAdi')} value={form.checkSubeAdi} onChange={set('checkSubeAdi')} placeholder="Şube adı" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Çek Hesabı</label>
                    <input className={inp('checkCekHesabi')} value={form.checkCekHesabi} onChange={set('checkCekHesabi')} placeholder="Hesap no" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">IBAN</label>
                    <input className={inp('checkIBAN')} value={form.checkIBAN} onChange={set('checkIBAN')} placeholder="TR00 0000 0000 0000 0000 0000 00" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Borçlu</label>
                    <input className={inp('checkBorclu')} value={form.checkBorclu} onChange={set('checkBorclu')} placeholder="Borçlu adı" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Borçlu VKN</label>
                    <input className={inp('checkBorcluVKN')} value={form.checkBorcluVKN} onChange={set('checkBorcluVKN')} placeholder="Vergi kimlik no" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Ciranta</label>
                    <input className={inp('checkCiranta')} value={form.checkCiranta} onChange={set('checkCiranta')} placeholder="Ciranta" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Ciranta Adı</label>
                    <input className={inp('checkCirantaAdi')} value={form.checkCirantaAdi} onChange={set('checkCirantaAdi')} placeholder="Ciranta adı" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Yöre</label>
                    <input className={inp('checkYore')} value={form.checkYore} onChange={set('checkYore')} placeholder="Yöre" />
                  </div>
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Yöre Adı</label>
                    <input className={inp('checkYoreAdi')} value={form.checkYoreAdi} onChange={set('checkYoreAdi')} placeholder="Yöre adı" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] md:text-[10px] font-semibold text-text-muted mb-0.5">Açıklama</label>
                    <input className={inp('checkAciklama')} value={form.checkAciklama} onChange={set('checkAciklama')} placeholder="Açıklama" />
                  </div>
                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, checkKendi: !f.checkKendi }))}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all w-full ${form.checkKendi ? 'bg-primary/10 ring-1 ring-primary' : 'bg-surface-container-high'
                        }`}
                    >
                      <span className={`material-symbols-outlined text-[16px] ${form.checkKendi ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {form.checkKendi ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className={`text-[11px] md:text-xs font-semibold ${form.checkKendi ? 'text-primary' : 'text-on-surface-variant'}`}>
                        Kendi
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] md:text-[11px] font-semibold text-text-muted mb-0.5">{t('common.reference')}</label>
              <input className={inp('reference')} value={form.reference} onChange={set('reference')} placeholder="INV-0001" />
            </div>
            <div>
              <label className="block text-[10px] md:text-[11px] font-semibold text-text-muted mb-0.5">Linked Order</label>
              <select className={inp('orderId')} value={form.orderId} onChange={set('orderId')}>
                <option value="">— None —</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>{o.code}{o.customer?.name ? ` — ${o.customer.name}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] md:text-[11px] font-semibold text-text-muted mb-0.5">{t('common.description')}</label>
              <textarea rows={2} className={inp('description')} value={form.description}
                onChange={set('description')} placeholder="Additional details…" />
            </div>
          </div>

        </div>{/* end scrollable area */}

        <div className="flex gap-2.5 p-4 md:p-5 pt-3 border-t border-theme-border shrink-0">
          <button onClick={onClose} className="flex-1 flex items-center justify-center gap-1.5 border border-theme-border rounded-lg py-1.5 text-[11px] md:text-xs font-semibold text-text-muted hover:bg-hover-bg transition">
            <span className="material-symbols-outlined text-[14px] md:text-[16px]">close</span>
            {t('common.cancel')}
          </button>
          <button onClick={onSave}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] md:text-xs font-bold text-white transition hover:opacity-90 ${form.type === 'income' ? 'bg-primary' : 'bg-error'}`}>
            <span className="material-symbols-outlined text-[14px] md:text-[16px]">check</span>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Record Detail Modal ─────────────────────────────────────────────────────
function DetailRow({ icon, label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-start gap-1.5">
      <span className="material-symbols-outlined text-[14px] text-text-muted mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
        <p className="text-xs text-on-surface break-words">{value}</p>
      </div>
    </div>
  )
}

function RecordDetailModal({ record, onClose, orders, customers }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('details')

  const linkedOrder = record.orderId ? orders.find(o => o.id === record.orderId) : null
  const linkedCustomer = linkedOrder?.customer?.id
    ? customers.find(c => c.id === linkedOrder.customer.id)
    : null

  const tabs = [
    { id: 'details', label: 'Transaction', icon: 'receipt_long' },
    ...(linkedOrder ? [{ id: 'order', label: 'Linked Order', icon: 'shopping_cart' }] : []),
    ...(linkedCustomer ? [{ id: 'customer', label: t('common.customer'), icon: 'business' }] : []),
  ]

  const orderStatusColor = {
    Draft: 'bg-surface-container-high text-on-surface-variant',
    Pending: 'bg-yellow-100 text-yellow-700',
    Active: 'bg-primary/10 text-primary',
    Completed: 'bg-green-100 text-green-700',
    Cancelled: 'bg-error/10 text-error',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 md:p-0" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88dvh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-5 pt-4 pb-3 border-b border-theme-border shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${record.type === 'income' ? 'bg-primary/10' : 'bg-error/10'}`}>
              <span className={`material-symbols-outlined text-base ${record.type === 'income' ? 'text-primary' : 'text-error'}`}>
                {record.type === 'income' ? 'trending_up' : 'trending_down'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="font-mono text-xs font-bold text-on-surface">{record.code}</p>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${record.type === 'income' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                  <span className="material-symbols-outlined text-[12px]">{record.type === 'income' ? 'arrow_circle_down' : 'arrow_circle_up'}</span>
                  {record.type === 'income' ? t('finance.income') : t('finance.expense')}
                </span>
              </div>
              <p className={`text-lg md:text-xl font-bold tabular-nums leading-none ${record.type === 'income' ? 'text-primary' : 'text-error'}`}>
                {record.type === 'income' ? '+' : '-'}{fmt(record.amount)}
                <span className="text-[11px] font-normal text-text-muted ml-1">{record.currency || 'USD'}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-error transition p-1">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex px-4 md:px-5 shrink-0 border-b border-theme-border">
            {tabs.map(tabItem => (
              <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold border-b-2 transition -mb-px ${tab === tabItem.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-on-surface'
                  }`}>
                <span className="material-symbols-outlined text-[14px]">{tabItem.icon}</span>
                {tabItem.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 md:px-5 py-3 md:py-4">

          {/* ── Transaction Tab ── */}
          {tab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-surface-container-high rounded-lg p-3 md:p-4 space-y-2.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Transaction Info</p>
                <DetailRow icon="calendar_today" label="Date" value={record.date} />
                <DetailRow icon="category" label="Category" value={record.category} />
                <DetailRow icon="currency_exchange" label="Currency" value={record.currency || 'USD'} />
                <DetailRow icon="tag" label="Reference" value={record.reference} />
              </div>
              <div className="bg-surface-container-high rounded-lg p-3 md:p-4 space-y-2.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Links & Notes</p>
                <DetailRow
                  icon="shopping_cart"
                  label="Linked Order"
                  value={linkedOrder
                    ? `${linkedOrder.code}${linkedOrder.customer?.name ? ` — ${linkedOrder.customer.name}` : ''}`
                    : 'No linked order'}
                />
                <DetailRow icon="edit_note" label="Description" value={record.description} />
                <DetailRow icon="schedule" label="Created" value={record.createdAt ? new Date(record.createdAt).toLocaleString() : null} />
              </div>
            </div>
          )}

          {/* ── Linked Order Tab ── */}
          {tab === 'order' && linkedOrder && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-surface-container-high rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant">shopping_cart</span>
                </div>
                <div>
                  <p className="font-mono text-base font-bold text-on-surface">{linkedOrder.code}</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${orderStatusColor[linkedOrder.status] || 'bg-surface-container-high text-on-surface-variant'}`}>
                    {linkedOrder.status}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-surface-container-high rounded-lg p-3 md:p-4 space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Order Details</p>
                  <DetailRow icon="business" label="Customer" value={linkedOrder.customer?.name} />
                  <DetailRow icon="attach_money" label="Total Amount" value={linkedOrder.totalAmount != null ? fmt(linkedOrder.totalAmount) : null} />
                  <DetailRow icon="percent" label="VAT" value={linkedOrder.vat != null ? `${linkedOrder.vat}%` : null} />
                  <DetailRow icon="schedule" label="Created" value={linkedOrder.createdAt ? new Date(linkedOrder.createdAt).toLocaleDateString() : null} />
                </div>
                <div className="bg-surface-container-high rounded-lg p-3 md:p-4 space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Notes</p>
                  <p className="text-sm text-on-surface">{linkedOrder.notes || 'No notes'}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Customer Tab ── */}
          {tab === 'customer' && linkedCustomer && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-sm">{linkedCustomer.initials || '?'}</span>
                </div>
                <div>
                  <p className="text-base font-bold text-on-surface">{linkedCustomer.name}</p>
                  <p className="text-xs text-text-muted">{linkedCustomer.customerType} · {linkedCustomer.code}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Contact & Address */}
                <div className="bg-surface-container-high rounded-lg p-3 md:p-4 space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Contact & Address</p>
                  <DetailRow icon="phone" label="Phone" value={linkedCustomer.phone} />
                  <DetailRow icon="mail" label="Email" value={linkedCustomer.email} />
                  <DetailRow icon="home" label="Address" value={linkedCustomer.address} />
                  <DetailRow icon="location_city" label="City / District" value={[linkedCustomer.city, linkedCustomer.district].filter(Boolean).join(', ') || null} />
                  <DetailRow icon="public" label="Country" value={linkedCustomer.country} />
                  <DetailRow icon="markunread_mailbox" label="Postal Code" value={linkedCustomer.postalCode} />
                </div>

                {/* Tax & Financial */}
                <div className="bg-surface-container-high rounded-lg p-3 md:p-4 space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Tax & Financial</p>
                  <DetailRow icon="fingerprint" label="Tax ID (TIN)" value={linkedCustomer.taxId} />
                  <DetailRow icon="account_balance" label="Tax Office" value={linkedCustomer.taxOffice} />
                  <DetailRow icon="tag" label="Account Code" value={linkedCustomer.accountCode} />
                  <DetailRow icon="currency_exchange" label="Currency" value={linkedCustomer.currency} />
                  <DetailRow icon="credit_score" label="Credit Limit" value={linkedCustomer.creditLimit != null ? fmt(linkedCustomer.creditLimit) : null} />
                  <DetailRow icon="schedule" label="Payment Term" value={linkedCustomer.paymentTerm} />
                </div>

                {/* e-Document Status */}
                <div className="bg-surface-container-high rounded-lg p-3 md:p-4 space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">e-Document Status</p>
                  {[
                    { key: 'eInvoiceStatus', label: 'e-Invoice' },
                    { key: 'eArchiveStatus', label: 'e-Archive' },
                    { key: 'eDispatchStatus', label: 'e-Dispatch' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${linkedCustomer[key] ? 'bg-green-500' : 'bg-surface-container-highest'}`} />
                      <span className="text-sm text-on-surface">
                        {label}:{' '}
                        <span className={`font-semibold ${linkedCustomer[key] ? 'text-green-600' : 'text-text-muted'}`}>
                          {linkedCustomer[key] ? 'Active' : 'Inactive'}
                        </span>
                      </span>
                    </div>
                  ))}
                  <DetailRow icon="description" label="Invoice Scenario" value={linkedCustomer.invoiceScenario} />
                  <DetailRow icon="description" label="Invoice Type" value={linkedCustomer.invoiceType} />
                  <DetailRow icon="payments" label="Payment Method" value={linkedCustomer.paymentMethod} />
                  <DetailRow icon="schedule_send" label="Payment Terms" value={linkedCustomer.paymentTerms} />
                </div>

                {/* Contact Person */}
                <div className="bg-surface-container-high rounded-lg p-3 md:p-4 space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Contact Person</p>
                  <DetailRow icon="person" label="Name" value={linkedCustomer.contactName} />
                  <DetailRow icon="phone_in_talk" label="Phone" value={linkedCustomer.contactPhone} />
                  <DetailRow icon="forward_to_inbox" label="Email" value={linkedCustomer.contactEmail} />
                  <DetailRow icon="work" label="Position" value={linkedCustomer.contactPosition} />
                </div>

                {/* Bank */}
                {(linkedCustomer.bankName || linkedCustomer.iban) && (
                  <div className="bg-surface-container-high rounded-lg p-3 md:p-4 space-y-2.5 col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Bank Information</p>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailRow icon="account_balance" label="Bank Name" value={linkedCustomer.bankName} />
                      <DetailRow icon="credit_card" label="IBAN" value={linkedCustomer.iban} />
                      <DetailRow icon="store" label="Branch Code" value={linkedCustomer.branchCode} />
                      <DetailRow icon="person" label="Account Holder" value={linkedCustomer.accountHolder} />
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                {(linkedCustomer.industry || linkedCustomer.customerCategory || linkedCustomer.salesRepName || linkedCustomer.notes) && (
                  <div className="bg-surface-container-high rounded-lg p-3 md:p-4 space-y-2.5 col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Additional Info</p>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailRow icon="factory" label="Industry" value={linkedCustomer.industry} />
                      <DetailRow icon="grade" label="Category" value={linkedCustomer.customerCategory} />
                      <DetailRow icon="badge" label="Sales Rep" value={linkedCustomer.salesRepName} />
                      <DetailRow icon="verified_user" label="GDPR Consent" value={linkedCustomer.gdprConsent ? 'Yes / Active' : 'No / Not given'} />
                    </div>
                    {linkedCustomer.notes && (
                      <DetailRow icon="edit_note" label="Notes" value={linkedCustomer.notes} />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Finance() {
  const { t } = useTranslation()
  const { financeRecords, addFinanceRecord, updateFinanceRecord, deleteFinanceRecord, refreshFinanceRecords, orders, customers, isAdmin } = useData()
  const { rates, base: ratesBase } = useCurrencyRates()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [errors, setErrors] = useState({})
  const [deletingId, setDeletingId] = useState(null)
  const [detailRecord, setDetailRecord] = useState(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const now = new Date()
  const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`
  const thisYearPrefix = `${now.getFullYear()}`

  const allFinanceRecords = financeRecords || []

  const summary = useMemo(() => {
    const income = allFinanceRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
    const expense = allFinanceRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
    const tmIncome = allFinanceRecords.filter(r => r.type === 'income' && r.date?.startsWith(thisMonthPrefix)).reduce((s, r) => s + r.amount, 0)
    const tmExpense = allFinanceRecords.filter(r => r.type === 'expense' && r.date?.startsWith(thisMonthPrefix)).reduce((s, r) => s + r.amount, 0)
    const lmIncome = allFinanceRecords.filter(r => r.type === 'income' && r.date?.startsWith(lastMonthPrefix)).reduce((s, r) => s + r.amount, 0)
    const lmExpense = allFinanceRecords.filter(r => r.type === 'expense' && r.date?.startsWith(lastMonthPrefix)).reduce((s, r) => s + r.amount, 0)
    return {
      income, expense, balance: income - expense,
      incomeCount: allFinanceRecords.filter(r => r.type === 'income').length,
      expenseCount: allFinanceRecords.filter(r => r.type === 'expense').length,
      tmIncome, tmExpense, tmNet: tmIncome - tmExpense,
      lmIncome, lmExpense,
    }
  }, [allFinanceRecords, thisMonthPrefix, lastMonthPrefix])

  function pctChange(curr, prev) {
    if (prev === 0 && curr === 0) return null
    if (prev === 0) return null
    return ((curr - prev) / prev) * 100
  }

  function validate(f) {
    const e = {}
    if (!f.amount || isNaN(parseFloat(f.amount)) || parseFloat(f.amount) <= 0) e.amount = 'Valid amount required'
    if (!f.date) e.date = 'Required'
    return e
  }

  function openAdd() { setForm({ ...emptyForm }); setErrors({}); setShowAdd(true) }
  function openEdit(item) {
    setForm({
      type: item.type, category: item.category || 'General', amount: item.amount,
      currency: item.currency || 'USD', date: item.date, reference: item.reference || '',
      description: item.description || '', orderId: item.orderId || '',
      paymentMethod: item.paymentMethod || '',
      checkYil: item.checkYil || '', checkBanka: item.checkBanka || '',
      checkBelgeNo: item.checkBelgeNo || '', checkVade: item.checkVade || '',
      checkBedel: item.checkBedel || '', checkCiranta: item.checkCiranta || '',
      checkCirantaAdi: item.checkCirantaAdi || '', checkKendi: item.checkKendi || false,
      checkBorclu: item.checkBorclu || '', checkBorcluVKN: item.checkBorcluVKN || '',
      checkCekNo: item.checkCekNo || '', checkSubeAdi: item.checkSubeAdi || '',
      checkCekHesabi: item.checkCekHesabi || '', checkIBAN: item.checkIBAN || '',
      checkYore: item.checkYore || '', checkYoreAdi: item.checkYoreAdi || '',
      checkAciklama: item.checkAciklama || '',
    })
    setErrors({})
    setEditItem(item)
  }

  async function handleAdd() {
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }
    await addFinanceRecord(form)
    setShowAdd(false)
  }

  async function handleEdit() {
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }
    await updateFinanceRecord(editItem.id, form)
    setEditItem(null)
  }

  async function handleDelete(id) {
    await deleteFinanceRecord(id)
    setDeletingId(null)
  }

  function exportCSV() {
    const header = ['Code', 'Type', 'Category', 'Date', 'Reference', 'Amount', 'Currency', 'Description', 'Linked Order']
    const rows = filtered.map(r => [
      r.code, r.type, r.category, r.date,
      r.reference || '', r.amount.toFixed(2), r.currency || 'USD',
      r.description || '', r.order?.code || '',
    ])
    const csv = [header, ...rows]
      .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape' })
    await addLogoToPDF(doc)

    const dateStr = new Date().toLocaleString()
    const incomeTotal = filtered.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
    const expenseTotal = filtered.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Finance Records', 14, 16)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(`Generated: ${dateStr}`, 14, 23)
    doc.text(
      `Income: ${fmt(incomeTotal)}  |  Expense: ${fmt(expenseTotal)}  |  Net: ${fmt(incomeTotal - expenseTotal)}`,
      14, 29
    )
    doc.setTextColor(0)

    autoTable(doc, {
      startY: 34,
      head: [['Code', 'Type', 'Category', 'Date', 'Reference', 'Amount', 'Curr.', 'Description', 'Order']],
      body: filtered.map(r => [
        r.code,
        r.type === 'income' ? 'Income' : 'Expense',
        r.category,
        r.date,
        r.reference || '',
        (r.type === 'income' ? '+' : '-') + fmt(r.amount),
        r.currency || 'USD',
        r.description || '',
        r.order?.code || '',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 20 },
        5: { halign: 'right', cellWidth: 26 },
        6: { cellWidth: 14 },
        8: { cellWidth: 24 },
      },
    })

    doc.save(`finance_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  function exportExcel() {
    const incomeTotal = filtered.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
    const expenseTotal = filtered.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)

    const summaryRows = [
      ['Finance Records Export'],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Income', incomeTotal, 'Expense', expenseTotal, 'Net', incomeTotal - expenseTotal],
      [],
    ]

    const header = ['Code', 'Type', 'Category', 'Date', 'Reference', 'Amount', 'Currency', 'Description', 'Linked Order']
    const dataRows = filtered.map(r => [
      r.code,
      r.type === 'income' ? 'Income' : 'Expense',
      r.category,
      r.date,
      r.reference || '',
      r.amount,
      r.currency || 'USD',
      r.description || '',
      r.order?.code || '',
    ])

    const ws = XLSX.utils.aoa_to_sheet([...summaryRows, header, ...dataRows])

    // Column widths
    ws['!cols'] = [
      { wch: 16 }, { wch: 10 }, { wch: 20 }, { wch: 12 },
      { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 30 }, { wch: 14 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Finance Records')
    XLSX.writeFile(wb, `finance_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const allCategories = useMemo(() =>
    [...new Set(allFinanceRecords.map(r => r.category))].sort(),
    [allFinanceRecords]
  )

  const filtered = useMemo(() => {
    return allFinanceRecords.filter(r => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      if (dateFilter === 'this_month' && !r.date?.startsWith(thisMonthPrefix)) return false
      if (dateFilter === 'last_month' && !r.date?.startsWith(lastMonthPrefix)) return false
      if (dateFilter === 'this_year' && !r.date?.startsWith(thisYearPrefix)) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          r.code.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.reference || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allFinanceRecords, typeFilter, categoryFilter, dateFilter, search, thisMonthPrefix, lastMonthPrefix, thisYearPrefix])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const incomeChg = pctChange(summary.tmIncome, summary.lmIncome)
  const expenseChg = pctChange(summary.tmExpense, summary.lmExpense)
  const hasFilters = search || typeFilter !== 'all' || categoryFilter !== 'all' || dateFilter !== 'all'

  return (
    <div className="h-full flex flex-col xl:overflow-hidden overflow-y-auto px-2.5 sm:px-4 md:px-5 pt-2.5 sm:pt-4 pb-2 md:pb-3">

      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-on-surface">{t('finance.title')}</h1>
          <p className="text-xs text-text-muted mt-0.5">Track income, expenses and cash flow</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refreshFinanceRecords}
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-theme-border text-xs text-text-muted hover:bg-hover-bg transition">
            <span className="material-symbols-outlined text-[18px] sm:text-sm">refresh</span>
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(v => !v)}
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-theme-border text-xs text-text-muted hover:bg-hover-bg transition"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-sm">download</span>
              <span className="hidden sm:inline">{t('common.export')}</span>
              <span className="hidden sm:inline material-symbols-outlined text-sm">expand_more</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-1 z-20 bg-surface-container-lowest border border-theme-border rounded-xl shadow-lg py-1 min-w-[140px]">
                  <button onClick={() => { exportCSV(); setShowExportMenu(false) }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-on-surface hover:bg-hover-bg transition">
                    <span className="material-symbols-outlined text-sm text-text-muted">table_view</span>
                    CSV
                  </button>
                  <button onClick={() => { exportExcel(); setShowExportMenu(false) }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-on-surface hover:bg-hover-bg transition">
                    <span className="material-symbols-outlined text-sm text-text-muted">grid_on</span>
                    Excel
                  </button>
                  <button onClick={() => { exportPDF(); setShowExportMenu(false) }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-on-surface hover:bg-hover-bg transition">
                    <span className="material-symbols-outlined text-sm text-text-muted">picture_as_pdf</span>
                    PDF
                  </button>
                </div>
              </>
            )}
          </div>
          {isAdmin && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 primary-gradient text-white p-2 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-bold shadow-xl shadow-primary/10 hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-[18px] sm:text-sm">add</span>
              <span className="hidden sm:inline">{t('finance.addRecord')}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3 shrink-0">
        <div className="bg-surface-container-lowest border border-theme-border rounded-xl p-3 flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-base">trending_up</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide truncate">{t('finance.totalIncome')}</p>
            <p className="text-sm 2xl:text-base font-bold text-primary tabular-nums truncate" title={fmt(summary.income)}>{fmt(summary.income)}</p>
            <p className="text-[10px] text-text-muted truncate">{summary.incomeCount} tx</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-theme-border rounded-xl p-3 flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-error text-base">trending_down</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide truncate">{t('finance.totalExpense')}</p>
            <p className="text-sm 2xl:text-base font-bold text-error tabular-nums truncate" title={fmt(summary.expense)}>{fmt(summary.expense)}</p>
            <p className="text-[10px] text-text-muted truncate">{summary.expenseCount} tx</p>
          </div>
        </div>

        <div className={`border rounded-xl p-3 flex items-center gap-3 min-w-0 ${summary.balance >= 0 ? 'bg-green-50 dark:bg-green-900/10 border-green-200' : 'bg-red-50 dark:bg-red-900/10 border-red-200'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${summary.balance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className={`material-symbols-outlined text-base ${summary.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>account_balance</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide truncate">{t('finance.netBalance')}</p>
            <p className={`text-sm 2xl:text-base font-bold tabular-nums truncate ${summary.balance >= 0 ? 'text-green-700' : 'text-red-600'}`} title={`${summary.balance >= 0 ? '+' : '-'}${fmt(Math.abs(summary.balance))}`}>
              {summary.balance >= 0 ? '+' : '-'}{fmt(Math.abs(summary.balance))}
            </p>
            <p className="text-[10px] text-text-muted truncate">All time</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-theme-border rounded-xl p-3 flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant text-base">calendar_month</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide truncate">This Month</p>
            <p className={`text-sm 2xl:text-base font-bold tabular-nums truncate ${summary.tmNet >= 0 ? 'text-primary' : 'text-error'}`} title={`${summary.tmNet >= 0 ? '+' : '-'}${fmt(Math.abs(summary.tmNet))}`}>
              {summary.tmNet >= 0 ? '+' : '-'}{fmt(Math.abs(summary.tmNet))}
            </p>
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5">
              <span className="text-[9px] text-primary whitespace-nowrap">↑{fmt(summary.tmIncome)}</span>
              <span className="text-[9px] text-error whitespace-nowrap">↓{fmt(summary.tmExpense)}</span>
              {incomeChg !== null && (
                <span className={`text-[9px] font-bold whitespace-nowrap ${incomeChg >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {incomeChg >= 0 ? '▲' : '▼'}{Math.abs(incomeChg).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 mb-2 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-44">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[14px]">search</span>
          <input
            className="w-full bg-surface-container-lowest border border-theme-border rounded-lg pl-8 pr-7 py-1 text-[11px] text-on-surface outline-none focus:border-primary"
            placeholder={t('finance.searchPlaceholder')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setTypeFilter('all'); setCategoryFilter('all'); setDateFilter('all'); setPage(1) }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center p-0.5 text-text-muted hover:text-error transition bg-surface-container-lowest"
              title={t('common.clear')}
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
        <div className="flex gap-0.5 bg-surface-container-lowest border border-theme-border rounded-lg p-0.5">
          {[
            { value: 'all', label: t('common.all') },
            { value: 'income', label: t('finance.income') },
            { value: 'expense', label: t('finance.expense') },
          ].map(({ value, label }) => (
            <button key={value} onClick={() => { setTypeFilter(value); setPage(1) }}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition capitalize ${typeFilter === value ? 'bg-primary text-white' : 'text-text-muted hover:bg-hover-bg'}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1) }}
          className="bg-surface-container-lowest border border-theme-border rounded-lg px-2 py-1 text-[11px] text-on-surface outline-none focus:border-primary">
          <option value="all">All Time</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="this_year">This Year</option>
        </select>
        {allCategories.length > 0 && (
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
            className="bg-surface-container-lowest border border-theme-border rounded-lg px-2 py-1 text-[11px] text-on-surface outline-none focus:border-primary">
            <option value="all">All Categories</option>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Table — fills remaining space */}
      <div className="flex-1 xl:min-h-0 bg-surface-container-lowest rounded-xl border border-theme-border flex flex-col overflow-visible xl:overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-theme-border shrink-0">
          <span className="text-xs text-text-muted">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          {filtered.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-primary font-semibold tabular-nums">
                ↑ {fmt(filtered.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0))}
                <span className="text-text-muted font-normal ml-0.5">mixed</span>
              </span>
              <span className="text-error font-semibold tabular-nums">
                ↓ {fmt(filtered.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0))}
                <span className="text-text-muted font-normal ml-0.5">mixed</span>
              </span>
            </div>
          )}
        </div>

        <div className="hidden xl:block overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-container-lowest z-10">
              <tr className="border-b border-theme-border text-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-semibold">{t('finance.records')}</th>
                <th className="text-left px-4 py-2.5 font-semibold">{t('finance.type')}</th>
                <th className="text-left px-4 py-2.5 font-semibold">{t('finance.category')}</th>
                <th className="text-left px-4 py-2.5 font-semibold">{t('common.date')}</th>
                <th className="text-left px-4 py-2.5 font-semibold">{t('finance.reference')}</th>
                <th className="text-left px-4 py-2.5 font-semibold">{t('common.description')}</th>
                <th className="text-right px-4 py-2.5 font-semibold">{t('finance.amount')}</th>
                {isAdmin && <th className="px-4 py-2.5 w-20" />}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-xl opacity-40">receipt_long</span>
                      <span className="text-sm font-medium">{t('finance.noRecords')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map(r => (
                  <tr key={r.id} onClick={() => setDetailRecord(r)} className="border-b border-theme-border last:border-0 hover:bg-hover-bg transition-colors cursor-pointer">
                    <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{r.code}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${r.type === 'income' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                        <span className="material-symbols-outlined text-xs">{r.type === 'income' ? 'arrow_circle_down' : 'arrow_circle_up'}</span>
                        {r.type === 'income' ? t('finance.income') : t('finance.expense')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-muted">{r.category}</td>
                    <td className="px-4 py-2.5 text-xs text-text-muted whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-2.5 text-xs text-text-muted">{r.reference || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-text-muted max-w-[160px] truncate" title={r.description || ''}>{r.description || '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${r.type === 'income' ? 'text-primary' : 'text-error'}`}>
                      {r.type === 'income' ? '+' : '-'}{fmt(r.amount)}
                      <span className="text-[10px] font-normal text-text-muted ml-1">{r.currency || 'USD'}</span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        {deletingId === r.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => handleDelete(r.id)} className="text-xs font-semibold text-white bg-error px-2 py-1 rounded-lg transition">{t('common.yes')}</button>
                            <button onClick={() => setDeletingId(null)} className="text-xs text-text-muted px-1 transition">{t('common.no')}</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-hover-bg text-text-muted hover:text-primary transition">
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button onClick={() => setDeletingId(r.id)} className="p-1.5 rounded-lg hover:bg-hover-bg text-text-muted hover:text-error transition">
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="xl:hidden flex flex-col divide-y divide-theme-border flex-none">
          {paginated.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
              <span className="material-symbols-outlined text-xl opacity-40">receipt_long</span>
              <span className="text-sm font-medium">{t('finance.noRecords')}</span>
            </div>
          ) : (
            paginated.map(r => (
              <div key={r.id} onClick={() => setDetailRecord(r)} className="p-3 hover:bg-hover-bg transition-colors cursor-pointer flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-text-muted text-[10px]">{r.code}</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${r.type === 'income' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                    <span className="material-symbols-outlined text-[12px]">{r.type === 'income' ? 'arrow_circle_down' : 'arrow_circle_up'}</span>
                    {r.type === 'income' ? t('finance.income') : t('finance.expense')}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] font-semibold text-on-surface truncate pr-2">{r.category}</span>
                  <span className={`text-xs font-bold tabular-nums shrink-0 ${r.type === 'income' ? 'text-primary' : 'text-error'}`}>
                    {r.type === 'income' ? '+' : '-'}{fmt(r.amount)} <span className="text-[9px] font-normal opacity-70 ml-0.5">{r.currency || 'USD'}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted mt-0.5">
                  <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">calendar_today</span> {r.date}</div>
                  {r.reference && <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">tag</span> {r.reference}</div>}
                </div>
                {r.description && <div className="text-[10px] text-text-muted mt-1 truncate">{r.description}</div>}

                {isAdmin && (
                  <div className="flex justify-end pt-2 mt-1.5 border-t border-theme-border/50" onClick={e => e.stopPropagation()}>
                    {deletingId === r.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleDelete(r.id)} className="text-[10px] font-semibold text-white bg-error px-2 py-1 rounded-md transition">{t('common.yes')}</button>
                        <button onClick={() => setDeletingId(null)} className="text-[10px] text-text-muted px-1.5 py-1 transition">{t('common.no')}</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(r)} className="p-1 rounded-md hover:bg-hover-bg text-text-muted hover:text-primary transition flex items-center justify-center">
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                        <button onClick={() => setDeletingId(r.id)} className="p-1 rounded-md hover:bg-hover-bg text-text-muted hover:text-error transition flex items-center justify-center">
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-theme-border shrink-0 text-xs text-text-muted">
            <span>Page {page} of {totalPages} · {filtered.length} records</span>
            <div className="flex gap-1.5">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-lg border border-theme-border disabled:opacity-40 hover:bg-hover-bg transition">{t('common.prev')}</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg border border-theme-border disabled:opacity-40 hover:bg-hover-bg transition">{t('common.next')}</button>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title={t('finance.addRecord')} form={form} setForm={setForm} errors={errors}
          onClose={() => setShowAdd(false)} onSave={handleAdd} orders={orders}
          rates={rates} ratesBase={ratesBase} />
      )}
      {editItem && (
        <Modal title={t('finance.editRecord')} form={form} setForm={setForm} errors={errors}
          onClose={() => setEditItem(null)} onSave={handleEdit} orders={orders}
          rates={rates} ratesBase={ratesBase} />
      )}
      {detailRecord && (
        <RecordDetailModal
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
          orders={orders}
          customers={customers}
        />
      )}
    </div>
  )
}
