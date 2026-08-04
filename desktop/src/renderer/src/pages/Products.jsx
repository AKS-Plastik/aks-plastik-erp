import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { useData } from '../context/DataContext'
import Pagination from '../components/Pagination'

const ITEMS_PER_PAGE = 10

const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'AED', 'SAR', 'JPY', 'CNY', 'INR', 'CAD', 'AUD']
const UNITS = ['ADET', 'KG', 'GR', 'METRE', 'LT', 'KUTU', 'PAKET', 'TAKIM', 'CUVAL', 'RULO']

const CATEGORIES = [
  { id: '', name: 'Kategorisiz' },
  { id: '001', name: 'ET ÜRÜNLERİ' },
  { id: '002', name: 'SÜT ÜRÜNLERİ' },
  { id: '003', name: 'TEMİZLİK ÜRÜNLERİ' },
  { id: '004', name: 'İŞLENMİŞ ET ÜRÜNLERİ' },
  { id: '005', name: 'HAZIR GIDA ÜRÜNLERİ' },
  { id: '006', name: 'İÇECEK ÜRÜNLERİ' },
  { id: '007', name: 'DİĞER GIDA ÜRÜNLERİ' },
  { id: '008', name: 'TEMEL GIDA ÜRÜNLERİ' },
  { id: '009', name: 'DİĞER ÜRÜNLER' },
  { id: '03', name: 'SARAY (SÜT ÜRÜNLERİ)' },
  { id: '10', name: 'BELPINAR ÜRÜNLERİ' },
  { id: "BEE'O", name: 'SBS BİL.' }
]

const emptyForm = {
  stockNo: '',
  name: '',
  category: '',
  unit: 'ADET',
  currency: 'USD',
  price: '',
  stock: '',
  minStock: '',
}

function Modal({ title, form, setForm, onClose, onSave, errors, isEdit }) {
  const { t } = useTranslation()
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const inputCls = (field) =>
    `w-full bg-surface-container-lowest border rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 text-[13px] sm:text-sm text-on-surface outline-none focus:border-primary transition ${
      errors[field] ? 'border-error' : 'border-theme-border'
    }`

  const handleSave = () => onSave();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg p-4 sm:p-8 max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-on-surface">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-error">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-text-muted mb-1">{t('products.stockNo')} *</label>
              <input disabled={isEdit} className={`${inputCls('stockNo')} ${isEdit ? 'opacity-50 cursor-not-allowed bg-surface-container-high' : ''}`} value={form.stockNo} onChange={set('stockNo')} placeholder={t('products.stockNoPh')} />
              {errors.stockNo && <p className="text-xs text-error mt-1">{errors.stockNo}</p>}
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-text-muted mb-1">{t('common.name')} *</label>
              <input className={inputCls('name')} value={form.name} onChange={set('name')} />
              {errors.name && <p className="text-xs text-error mt-1">{errors.name}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-text-muted mb-1">{t('common.category')}</label>
              <select className={inputCls('category')} value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-text-muted mb-1">{t('common.unit')}</label>
              <select className={inputCls('unit')} value={form.unit} onChange={set('unit')}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-text-muted mb-1">{t('common.currency')}</label>
              <select className={inputCls('currency')} value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-text-muted mb-1">{t('common.price')} *</label>
              <input type="number" min="0" step="0.01" className={inputCls('price')} value={form.price} onChange={set('price')} />
              {errors.price && <p className="text-xs text-error mt-1">{errors.price}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-text-muted mb-1">{t('products.inStock')}</label>
              <input type="number" min="0" className={inputCls('stock')} value={form.stock} onChange={set('stock')} />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-text-muted mb-1">{t('products.criticalStock')}</label>
              <input type="number" min="0" className={inputCls('minStock')} value={form.minStock} onChange={set('minStock')} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">{t('common.description')}</label>
            <textarea rows={2} className={inputCls('description')} value={form.description} onChange={set('description')} />
          </div>
        </div>
          <div className="flex items-center gap-2 mt-4 sm:mt-6">
            <button onClick={onClose} className="flex-1 bg-surface-container border border-theme-border text-on-surface px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-hover-bg transition">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} className="flex-1 primary-gradient text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition">
              {t('common.save')}
            </button>
          </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ product, onClose, onConfirm }) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')
  const match = typed === product.name

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-5 bg-error/10 border-b border-error/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-error/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-error text-2xl">delete_forever</span>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-on-surface">{t('products.deleteProduct')}</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">{t('common.cantUndo')}</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-on-surface-variant">
            {t('products.deleteConfirm', { name: product.name })}
          </p>
          <input
            autoFocus
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={product.name}
            className="w-full px-3.5 py-2.5 rounded-lg border border-input-border bg-input-bg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-error/20 focus:border-error"
          />
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant text-sm font-semibold hover:bg-surface-container-low transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={!match}
              className="flex-1 px-4 py-2.5 rounded-lg bg-error text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">delete</span>
              {t('common.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductDetailModal({ product, onClose, onEdit, onDelete, isAdmin }) {
  const { t } = useTranslation()
  const stockBadge = (p) => {
    if (p.stock === 0) return { label: t('products.outOfStock'), cls: 'bg-error/10 text-error' }
    if (p.stock <= p.minStock) return { label: t('products.lowStock'), cls: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' }
    return { label: t('products.inStock'), cls: 'bg-primary-fixed text-on-primary-fixed-variant' }
  }
  const badge = stockBadge(product)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="primary-gradient px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-11 sm:h-11 bg-surface-container-lowest/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-white text-[18px] sm:text-[24px]">inventory_2</span>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-white leading-tight">{product.name}</h2>
                {product.stockNo && (
                  <p className="text-blue-200 text-[10px] sm:text-xs font-mono mt-0.5">{product.stockNo}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="p-4 md:p-6 space-y-2 md:space-y-3">
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div className="bg-surface-container-low rounded-xl p-3 md:p-4">
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5 md:mb-1">{t('common.category')}</p>
              <p className="text-xs md:text-sm font-semibold text-on-surface">
                {CATEGORIES.find((c) => c.id === product.category)?.name || product.category || '—'}
              </p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-3 md:p-4">
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5 md:mb-1">{t('common.unit')}</p>
              <p className="text-xs md:text-sm font-semibold text-on-surface">{product.unit || 'pcs'}</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-3 md:p-4">
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5 md:mb-1">{t('common.price')}</p>
              <p className="text-xs md:text-sm font-semibold text-on-surface">
                <span className="text-[10px] md:text-xs text-on-surface-variant mr-1">{product.currency || 'USD'}</span>
                {parseFloat(product.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-3 md:p-4">
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5 md:mb-1">{t('common.status')}</p>
              <span className={`inline-flex px-2 md:px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <div className="bg-surface-container-low rounded-xl p-3 md:p-4">
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5 md:mb-1">{t('products.inStock')}</p>
              <p className="text-xs md:text-sm font-semibold text-on-surface">
                {product.stock} <span className="text-[10px] md:text-xs text-on-surface-variant">{product.unit || 'pcs'}</span>
              </p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-3 md:p-4">
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5 md:mb-1">{t('products.minStock')}</p>
              <p className="text-xs md:text-sm font-semibold text-on-surface">
                {product.minStock} <span className="text-[10px] md:text-xs text-on-surface-variant">{product.unit || 'pcs'}</span>
              </p>
            </div>
          </div>

          {product.description && (
            <div className="bg-surface-container-low rounded-xl p-3 md:p-4">
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5 md:mb-1">{t('common.description')}</p>
              <p className="text-xs md:text-sm text-on-surface">{product.description}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 md:p-6 flex gap-2 md:gap-3">
          {isAdmin && (
            <>
              <button
                onClick={onDelete}
                className="px-3 md:px-4 py-2 md:py-2.5 rounded-xl border-2 border-error/40 text-error text-[11px] md:text-sm font-bold hover:bg-error hover:text-white transition-all flex items-center gap-1.5 md:gap-2"
              >
                <span className="material-symbols-outlined text-[14px] md:text-base">delete</span>
                {t('common.delete')}
              </button>
              <button
                onClick={onEdit}
                className="flex-1 py-2 md:py-2.5 rounded-xl border-2 border-primary text-primary text-[11px] md:text-sm font-bold hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-1.5 md:gap-2"
              >
                <span className="material-symbols-outlined text-[14px] md:text-base">edit</span>
                {t('common.edit')}
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="flex-1 bg-primary text-white text-[11px] md:text-sm font-bold py-2 md:py-2.5 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

const PRODUCT_COLUMNS = ['Stock No', 'Name', 'Category', 'Unit', 'Currency', 'Price', 'Stock', 'Min Stock', 'Description']

export default function Products() {
  const { t } = useTranslation()
  const { products, addProduct, updateProduct, deleteProduct, syncAndRefreshProducts, isAdmin, permissions, orders } = useData()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [viewProduct, setViewProduct] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [importing, setImporting] = useState(false)
  const importRef = useRef(null)

  function validate(f) {
    const e = {}
    if (!f.stockNo.trim()) e.stockNo = t('common.required')
    if (!f.name.trim()) e.name = t('common.required')
    if (!f.price.toString().trim() || isNaN(parseFloat(f.price))) e.price = t('products.invalidPrice')
    return e
  }

  function openAdd() {
    setForm(emptyForm)
    setErrors({})
    setShowAdd(true)
  }

  function openEdit(item) {
    setForm({
      stockNo: item.stockNo || '',
      name: item.name,
      description: item.description || '',
      category: item.category || '',
      unit: item.unit || 'pcs',
      currency: item.currency || 'USD',
      price: item.price,
      stock: item.stock,
      minStock: item.minStock,
    })
    setErrors({})
    setEditItem(item)
  }

  async function handleAdd() {
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }
    await addProduct(form)
    setShowAdd(false)
  }

  async function handleEdit() {
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }
    await updateProduct(editItem.id, form)
    setEditItem(null)
  }

  async function handleDelete() {
    try {
      await deleteProduct(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      alert(err.message)
      setDeleteTarget(null)
    }
  }

  function handleExport() {
    const rows = products.map((p) => ({
      'Stock No': p.stockNo || '',
      'Name': p.name,
      'Category': p.category || '',
      'Unit': p.unit || '',
      'Currency': p.currency || 'USD',
      'Price': p.price,
      'Stock': p.stock,
      'Min Stock': p.minStock,
      'Description': p.description || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = PRODUCT_COLUMNS.map((_, i) => ({ wch: i === 1 ? 30 : 14 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Products')
    XLSX.writeFile(wb, 'products.xlsx')
  }

  function handleTemplate() {
    const ws = XLSX.utils.json_to_sheet([{}], { header: PRODUCT_COLUMNS })
    ws['!cols'] = PRODUCT_COLUMNS.map((_, i) => ({ wch: i === 1 ? 30 : 14 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Products')
    XLSX.writeFile(wb, 'products_template.xlsx')
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      for (const row of rows) {
        const name = String(row['Name'] || '').trim()
        if (!name) continue
        await addProduct({
          stockNo: String(row['Stock No'] || ''),
          name,
          category: String(row['Category'] || ''),
          unit: String(row['Unit'] || 'pcs'),
          currency: String(row['Currency'] || 'USD'),
          price: parseFloat(row['Price']) || 0,
          stock: parseInt(row['Stock']) || 0,
          minStock: parseInt(row['Min Stock']) || 0,
          description: String(row['Description'] || ''),
        })
      }
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.stockNo || '').toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const stockBadge = (product) => {
    if (product.stock === 0) return { label: t('products.outOfStock'), cls: 'bg-error/10 text-error' }
    if (product.stock <= product.minStock) return { label: t('products.lowStock'), cls: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' }
    return { label: t('products.inStock'), cls: 'bg-primary-fixed text-on-primary-fixed-variant' }
  }

  return (
    <div className="p-2 sm:p-4 lg:p-8 max-w-7xl mx-auto">
      <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-6 lg:mb-12">
        <div className="max-w-2xl">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-on-surface mb-2">
            {t('products.title')}
          </h1>
          <p className="text-on-surface-variant text-xs sm:text-sm lg:text-base leading-relaxed">
            {t('products.totalProducts', { count: products.length })}
          </p>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0 overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full md:w-auto max-w-full pb-2 md:pb-0">
          <button onClick={handleTemplate} className="flex items-center justify-center gap-1.5 border border-theme-border px-2.5 py-2 lg:px-3 lg:py-2 rounded-xl text-[11px] lg:text-sm text-text-muted hover:bg-hover-bg transition whitespace-nowrap flex-shrink-0">
            <span className="material-symbols-outlined text-[14px] lg:text-base">download</span>
            <span className="hidden lg:inline">{t('common.template')}</span>
          </button>
          <button onClick={() => importRef.current.click()} disabled={importing} className="flex items-center justify-center gap-1.5 border border-theme-border px-2.5 py-2 lg:px-3 lg:py-2 rounded-xl text-[11px] lg:text-sm text-text-muted hover:bg-hover-bg transition disabled:opacity-40 whitespace-nowrap flex-shrink-0">
            <span className="material-symbols-outlined text-[14px] lg:text-base">upload</span>
            <span className="hidden lg:inline">{importing ? t('products.importing') : t('common.import')}</span>
          </button>
          <button onClick={handleExport} className="flex items-center justify-center gap-1.5 border border-theme-border px-2.5 py-2 lg:px-3 lg:py-2 rounded-xl text-[11px] lg:text-sm text-text-muted hover:bg-hover-bg transition whitespace-nowrap flex-shrink-0">
            <span className="material-symbols-outlined text-[14px] lg:text-base">table_view</span>
            <span className="hidden lg:inline">{t('common.export')}</span>
          </button>
          <button onClick={syncAndRefreshProducts} className="flex items-center justify-center gap-1.5 border border-theme-border px-2.5 py-2 lg:px-3 lg:py-2 rounded-xl text-[11px] lg:text-sm text-text-muted hover:bg-hover-bg transition whitespace-nowrap flex-shrink-0">
            <span className="material-symbols-outlined text-[14px] lg:text-base">sync</span>
            <span className="hidden lg:inline">{t('common.refresh', 'Yenile/Senkronize Et')}</span>
          </button>
          <button onClick={openAdd} className="flex items-center justify-center gap-1.5 primary-gradient text-white px-3 py-2 lg:px-4 lg:py-2.5 rounded-xl text-[11px] lg:text-sm font-bold shadow-xl shadow-primary/10 hover:opacity-90 transition-opacity whitespace-nowrap flex-shrink-0">
            <span className="material-symbols-outlined text-[14px] lg:text-base">add</span>
            {t('products.addProduct')}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-text-muted text-[16px] md:text-lg">search</span>
          <input
            className="w-full bg-surface-container-lowest border border-theme-border rounded-xl pl-8 md:pl-9 pr-2 md:pr-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary"
            placeholder={t('products.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-theme-border overflow-hidden">
        <table className="w-full text-sm block xl:table">
          <thead className="hidden xl:table-header-group">
            <tr className="border-b border-theme-border text-text-muted text-xs uppercase tracking-wider">
              <th className="text-left px-6 py-4 font-semibold">{t('products.stockNo')}</th>
              <th className="text-left px-6 py-4 font-semibold">{t('common.name')}</th>
              <th className="text-left px-6 py-4 font-semibold">{t('common.category')}</th>
              <th className="text-right px-6 py-4 font-semibold">{t('common.price')}</th>
              <th className="text-right px-6 py-4 font-semibold">{t('products.inStock')}</th>
              <th className="text-left px-6 py-4 font-semibold">{t('common.status')}</th>
            </tr>
          </thead>
          <tbody className="block xl:table-row-group">
            {paginated.length === 0 ? (
              <tr className="block xl:table-row">
                <td colSpan={6} className="block xl:table-cell text-center py-16 text-text-muted">
                  {t('products.noProducts')}
                </td>
              </tr>
            ) : (
              paginated.map((p) => {
                const badge = stockBadge(p)
                return (
                  <tr key={p.id} onClick={() => setViewProduct(p)} className="block xl:table-row border-b border-surface-container-low xl:border-theme-border hover:bg-hover-bg transition-colors cursor-pointer p-3 xl:p-0">
                    <td className="block xl:table-cell xl:px-6 xl:py-4 mb-1.5 xl:mb-0">
                      <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-0.5">{t('products.stockNo')}</span>
                      <span className="font-mono text-xs font-semibold text-on-surface">{p.stockNo || '—'}</span>
                    </td>
                    <td className="block xl:table-cell xl:px-6 xl:py-4 mb-1.5 xl:mb-0">
                      <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-0.5">{t('common.name')}</span>
                      <span className="font-semibold text-on-surface">{p.name}</span>
                    </td>
                    <td className="block xl:table-cell xl:px-6 xl:py-4 mb-1.5 xl:mb-0 text-left xl:text-left">
                      <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-0.5">{t('common.category')}</span>
                      <span className="text-text-muted text-xs xl:text-sm">{CATEGORIES.find((c) => c.id === p.category)?.name || p.category || '—'}</span>
                    </td>
                    <td className="block xl:table-cell xl:px-6 xl:py-4 mb-1.5 xl:mb-0 text-left xl:text-right">
                      <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-0.5">{t('common.price')}</span>
                      <div className="font-medium text-on-surface text-sm">
                        <span className="text-xs text-text-muted mr-1">{p.currency || 'USD'}</span>
                        {parseFloat(p.price).toFixed(2)}
                        <span className="text-[10px] xl:text-xs text-text-muted"> /{p.unit}</span>
                      </div>
                    </td>
                    <td className="block xl:table-cell xl:px-6 xl:py-4 mb-2 xl:mb-0 text-left xl:text-right">
                      <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-0.5">{t('products.inStock')}</span>
                      <span className="text-on-surface text-sm font-semibold">{p.stock}</span><span className="text-[10px] xl:text-xs text-text-muted ml-1">{p.unit || 'pcs'}</span>
                    </td>
                    <td className="block xl:table-cell xl:px-6 xl:py-4">
                      <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-0.5">{t('common.status')}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] xl:text-xs font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        itemsPerPage={ITEMS_PER_PAGE}
        label="products.showingOf"
      />

      {showAdd && (
        <Modal title={t('products.addProduct')} form={form} setForm={setForm} errors={errors} onClose={() => setShowAdd(false)} onSave={handleAdd} />
      )}
      {editItem && (
        <Modal title={t('products.editProduct')} form={form} setForm={setForm} errors={errors} onClose={() => setEditItem(null)} onSave={handleEdit} isEdit={true} />
      )}
      {viewProduct && (
        <ProductDetailModal
          product={viewProduct}
          isAdmin={isAdmin}
          onClose={() => setViewProduct(null)}
          onEdit={() => { setViewProduct(null); openEdit(viewProduct) }}
          onDelete={() => { setDeleteTarget(viewProduct); setViewProduct(null) }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
