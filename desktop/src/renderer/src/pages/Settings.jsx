import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import Users from './Users'
import { loadRatesConfig, saveRatesConfig, DEFAULT_RATES_URL, DEFAULT_RATES_PATH, DEFAULT_BASE } from '../hooks/useCurrencyRates'

import { API_URL } from '../config'

const MACHINE_STATUSES = ['Active', 'Under Maintenance', 'Out of Service']

const statusColor = {
  'Active':            'bg-green-100 text-green-700',
  'Under Maintenance': 'bg-amber-100 text-amber-700',
  'Out of Service':    'bg-red-100 text-red-700',
}

function emptyForm() {
  return {
    code: '', name: '', manufacturer: '', manufacturerCountry: '', manufacturerContact: '',
    productionYear: '', warrantyExpiry: '', status: 'Active', location: '', nextMaintenanceDue: '', notes: '',
  }
}

// ─── Machine View Modal ──────────────────────────────────────────────────────
function MachineViewModal({ machine, onClose, onEdit }) {
  const { t } = useTranslation()
  const { downloadMachineManual } = useData()
  const yearTasks = (machine.monthlyMaintenance || []).filter((t) => t.year === new Date().getFullYear())
  const doneTasks = yearTasks.filter((t) => t.completed).length

  const field = (label, value, icon) => (
    value ? (
      <div className="flex items-start gap-2">
        {icon && <span className="material-symbols-outlined text-[13px] text-text-muted mt-0.5">{icon}</span>}
        <div>
          <p className="text-[10px] text-text-muted">{label}</p>
          <p className="text-xs text-on-surface font-semibold">{value}</p>
        </div>
      </div>
    ) : null
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-theme-border shrink-0 primary-gradient">
          <div className="flex items-center gap-2.5 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[15px] md:text-xl">precision_manufacturing</span>
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-white">{machine.name}</h2>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="font-mono text-[10px] md:text-xs text-white/80">{machine.code}</span>
                <span className={`text-[9px] md:text-[10px] uppercase tracking-widest px-1.5 md:px-2 py-0.5 rounded-full font-extrabold ${statusColor[machine.status] || 'bg-surface-container-high text-text-muted'}`}>{machine.status}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <button onClick={onEdit} className="flex items-center gap-1 md:gap-1.5 border border-white/20 px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[11px] md:text-sm font-semibold text-white hover:bg-white/10 transition">
              <span className="material-symbols-outlined text-[13px] md:text-base">edit</span>
              {t('common.edit', 'Düzenle')}
            </button>
            <button onClick={onClose} className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition">
              <span className="material-symbols-outlined text-sm md:text-base">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 py-4 md:px-6 md:py-5 space-y-4 md:space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-widest md:tracking-wider mb-2 md:mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {field('Machine Code', machine.code, 'tag')}
              {field('Machine Name', machine.name, 'precision_manufacturing')}
              {field('Status', machine.status, 'toggle_on')}
              {field('Location / Department', machine.location, 'location_on')}
              {field('Production Year', machine.productionYear, 'calendar_today')}
              {field('Warranty Expiry', machine.warrantyExpiry, 'verified_user')}
              {field('Next Maintenance Due', machine.nextMaintenanceDue, 'event')}
            </div>
            {machine.notes && (
              <div className="mt-2.5 md:mt-3 bg-surface-container-high rounded-lg md:rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm text-text-muted leading-relaxed">
                <span className="font-semibold text-on-surface mr-1.5">Notes:</span>{machine.notes}
              </div>
            )}
          </div>

          {/* Manufacturer */}
          {(machine.manufacturer || machine.manufacturerCountry || machine.manufacturerContact) && (
            <div>
              <h3 className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-widest md:tracking-wider mb-2 md:mb-3">Manufacturer Details</h3>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {field('Manufacturer', machine.manufacturer, 'factory')}
                {field('Country', machine.manufacturerCountry, 'public')}
                {field('Contact', machine.manufacturerContact, 'contact_phone')}
              </div>
            </div>
          )}

          {/* Maintenance Summary */}
          <div>
            <h3 className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-widest md:tracking-wider mb-2 md:mb-3">Maintenance Overview</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-container-high rounded-lg md:rounded-xl p-2.5 md:p-3 text-center">
                <p className="text-base md:text-lg font-bold text-on-surface leading-none mb-1">{(machine.maintenanceRecords || []).length}</p>
                <p className="text-[9px] md:text-[10px] text-text-muted">Total Records</p>
              </div>
              <div className="bg-surface-container-high rounded-lg md:rounded-xl p-2.5 md:p-3 text-center">
                <p className="text-base md:text-lg font-bold text-on-surface leading-none mb-1">{doneTasks}/{yearTasks.length}</p>
                <p className="text-[9px] md:text-[10px] text-text-muted">Tasks This Year</p>
              </div>
              <div className="bg-surface-container-high rounded-lg md:rounded-xl p-2.5 md:p-3 text-center">
                <p className="text-base md:text-lg font-bold text-on-surface leading-none mb-1">{machine.manualName ? 'Yes' : 'No'}</p>
                <p className="text-[9px] md:text-[10px] text-text-muted">Manual Uploaded</p>
              </div>
            </div>
          </div>

          {/* Recent Maintenance Records */}
          {(machine.maintenanceRecords || []).length > 0 && (
            <div>
              <h3 className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-widest md:tracking-wider mb-2 md:mb-3">
                Recent Maintenance Records
              </h3>
              <div className="rounded-lg md:rounded-xl border border-theme-border overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-high text-text-muted text-[10px] md:text-xs uppercase tracking-wider border-b border-theme-border">
                      <th className="px-2.5 md:px-3 py-2 md:py-2.5 font-semibold">Date</th>
                      <th className="px-2.5 md:px-3 py-2 md:py-2.5 font-semibold">Type</th>
                      <th className="px-2.5 md:px-3 py-2 md:py-2.5 font-semibold">Description</th>
                      <th className="px-2.5 md:px-3 py-2 md:py-2.5 font-semibold text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(machine.maintenanceRecords || []).slice(0, 5).map((r) => (
                      <tr key={r.id} className="border-b border-theme-border last:border-0">
                        <td className="px-2.5 md:px-3 py-2 md:py-2.5 text-[11px] md:text-xs text-text-muted whitespace-nowrap">{r.date}</td>
                        <td className="px-2.5 md:px-3 py-2 md:py-2.5">
                          <span className="text-[10px] md:text-xs bg-surface-container-high px-1.5 md:px-2 py-0.5 rounded-full font-medium">{r.type}</span>
                        </td>
                        <td className="px-2.5 md:px-3 py-2 md:py-2.5 text-[11px] md:text-xs max-w-[150px] md:max-w-[200px] truncate" title={r.description}>{r.description || '—'}</td>
                        <td className="px-2.5 md:px-3 py-2 md:py-2.5 text-[11px] md:text-xs text-right font-medium">
                          {r.cost > 0 ? `${r.currency || 'USD'} ${r.cost.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(machine.maintenanceRecords || []).length > 5 && (
                  <p className="text-[10px] md:text-xs text-text-muted text-center py-1.5 md:py-2 border-t border-theme-border bg-surface-container-lowest">
                    +{(machine.maintenanceRecords || []).length - 5} more records
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Manual */}
          {machine.manualName && (
            <div>
              <h3 className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-widest md:tracking-wider mb-2 md:mb-3">User Manual</h3>
              <div className="flex items-center gap-2 md:gap-3 bg-surface-container-high rounded-lg md:rounded-xl px-3 py-2 md:px-4 md:py-3">
                <span className="material-symbols-outlined text-lg md:text-2xl text-primary">picture_as_pdf</span>
                <span className="text-xs md:text-sm font-semibold text-on-surface flex-1 truncate">{machine.manualName}</span>
                <button
                  onClick={() => downloadMachineManual(machine.id, machine.manualName)}
                  className="flex items-center gap-1 md:gap-1.5 bg-primary text-white px-2 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-xl text-[10px] md:text-xs font-bold hover:opacity-90 transition"
                >
                  <span className="material-symbols-outlined text-[12px] md:text-sm">download</span>
                  Download
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-t border-theme-border flex justify-end shrink-0">
          <button onClick={onClose} className="border border-theme-border rounded-lg md:rounded-xl px-4 py-1.5 md:px-6 md:py-2 text-xs md:text-sm font-semibold text-text-muted hover:bg-hover-bg transition">
            {t('common.close', 'Kapat')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Machine Modal ────────────────────────────────────────────────────────────
function MachineModal({ machine, onClose, onSave }) {
  const { t } = useTranslation()
  const { uploadMachineManual, downloadMachineManual, deleteMachineManual } = useData()
  const [tab, setTab] = useState('basic')
  const [form, setForm] = useState(machine ? {
    code: machine.code || '',
    name: machine.name || '',
    manufacturer: machine.manufacturer || '',
    manufacturerCountry: machine.manufacturerCountry || '',
    manufacturerContact: machine.manufacturerContact || '',
    productionYear: machine.productionYear || '',
    warrantyExpiry: machine.warrantyExpiry || '',
    status: machine.status || 'Active',
    location: machine.location || '',
    nextMaintenanceDue: machine.nextMaintenanceDue || '',
    notes: machine.notes || '',
  } : emptyForm())
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Manual
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [deletingManual, setDeletingManual] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const inp = (extra = '') =>
    `w-full bg-surface-container-lowest border border-theme-border rounded-lg md:rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm text-on-surface outline-none focus:border-primary transition ${extra}`
  const errInp = (field, extra = '') =>
    `w-full bg-surface-container-lowest border rounded-lg md:rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm text-on-surface outline-none focus:border-primary transition ${errors[field] ? 'border-error' : 'border-theme-border'} ${extra}`

  function validate() {
    const e = {}
    if (!form.code.trim()) e.code = true
    if (!form.name.trim()) e.name = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !machine) return
    setUploading(true)
    try { await uploadMachineManual(machine.id, file) } finally { setUploading(false) }
    e.target.value = ''
  }

  async function handleDeleteManual() {
    if (!machine) return
    setDeletingManual(true)
    try { await deleteMachineManual(machine.id) } finally { setDeletingManual(false) }
  }

  const tabCls = (key) =>
    `flex items-center gap-1 md:gap-1.5 px-2 py-1.5 md:px-3 md:py-2 text-[11px] md:text-xs font-medium border-b-2 -mb-px transition whitespace-nowrap ${
      tab === key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-on-surface'
    }`

  const isNew = !machine

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-theme-border shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="material-symbols-outlined text-primary text-[18px] md:text-2xl">precision_manufacturing</span>
            <div>
              <h2 className="text-sm md:text-base font-bold text-on-surface leading-snug">{isNew ? t('settings.addMachine') : machine.name}</h2>
              {!isNew && <p className="text-[10px] md:text-xs text-text-muted mt-0.5">{machine.code}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-text-muted hover:text-on-surface hover:bg-hover-bg transition">
            <span className="material-symbols-outlined text-sm md:text-base">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 md:gap-0 border-b border-theme-border shrink-0 px-4 md:px-6 overflow-x-auto no-scrollbar">
          <button className={tabCls('basic')} onClick={() => setTab('basic')}>
            <span className="material-symbols-outlined text-[13px] md:text-sm">info</span> Basic Info
          </button>
          <button className={tabCls('manufacturer')} onClick={() => setTab('manufacturer')}>
            <span className="material-symbols-outlined text-[13px] md:text-sm">factory</span> Manufacturer
          </button>
          {!isNew && (
            <button className={tabCls('manual')} onClick={() => setTab('manual')}>
              <span className="material-symbols-outlined text-[13px] md:text-sm">menu_book</span> Manual
            </button>
          )}
        </div>

        {/* Body */}
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 py-4 md:px-6 md:py-5">

          {/* ── Basic Info ── */}
          {tab === 'basic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">Machine Code <span className="text-error">*</span></label>
                <input className={errInp('code')} value={form.code} onChange={set('code')} placeholder="e.g. MCH-001" />
                {errors.code && <p className="text-[10px] md:text-xs text-error mt-0.5">{t('common.required')}</p>}
              </div>
              <div>
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">Machine Name <span className="text-error">*</span></label>
                <input className={errInp('name')} value={form.name} onChange={set('name')} placeholder="e.g. CNC Lathe" />
                {errors.name && <p className="text-[10px] md:text-xs text-error mt-0.5">{t('common.required')}</p>}
              </div>
              <div>
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">{t('common.status')}</label>
                <select className={inp()} value={form.status} onChange={set('status')}>
                  {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">Location / Department</label>
                <input className={inp()} value={form.location} onChange={set('location')} placeholder="e.g. Hall A" />
              </div>
              <div>
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">{t('settings.productionYear')}</label>
                <input type="number" className={inp()} value={form.productionYear} onChange={set('productionYear')} placeholder="e.g. 2019" min="1900" max="2099" />
              </div>
              <div>
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">{t('settings.warrantyExpiry')}</label>
                <input type="date" className={inp()} value={form.warrantyExpiry} onChange={set('warrantyExpiry')} />
              </div>
              <div>
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">{t('settings.nextMaintenance')}</label>
                <input type="date" className={inp()} value={form.nextMaintenanceDue} onChange={set('nextMaintenanceDue')} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">{t('common.notes')}</label>
                <textarea rows={3} className={inp()} value={form.notes} onChange={set('notes')} placeholder="Any additional notes…" />
              </div>
            </div>
          )}

          {/* ── Manufacturer ── */}
          {tab === 'manufacturer' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">{t('settings.manufacturer')}</label>
                <input className={inp()} value={form.manufacturer} onChange={set('manufacturer')} placeholder="e.g. Mazak Corporation" />
              </div>
              <div>
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">{t('common.country')}</label>
                <input className={inp()} value={form.manufacturerCountry} onChange={set('manufacturerCountry')} placeholder="e.g. Japan" />
              </div>
              <div>
                <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">Manufacturer Contact</label>
                <input className={inp()} value={form.manufacturerContact} onChange={set('manufacturerContact')} placeholder="Email, phone, or website" />
              </div>
            </div>
          )}



          {/* ── Manual ── */}
          {tab === 'manual' && (
            <div className="flex flex-col items-center gap-6 py-4">
              {machine?.manualPath ? (
                <div className="w-full max-w-md bg-surface-container-high rounded-2xl border border-theme-border p-4 md:p-6 flex flex-col items-center gap-3 md:gap-4">
                  <span className="material-symbols-outlined text-4xl md:text-5xl text-primary">picture_as_pdf</span>
                  <p className="text-[11px] md:text-sm font-medium text-on-surface text-center">{machine.manualName || 'Manual'}</p>
                  <div className="flex gap-2 md:gap-3 w-full">
                    <button
                      onClick={() => downloadMachineManual(machine.id, machine.manualName)}
                      className="flex-1 flex items-center justify-center gap-1.5 md:gap-2 bg-primary text-white px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-[11px] md:text-sm font-semibold hover:opacity-90 transition"
                    >
                      <span className="material-symbols-outlined text-[14px] md:text-base">download</span>
                      Download
                    </button>
                    <button
                      onClick={handleDeleteManual}
                      disabled={deletingManual}
                      className="flex items-center gap-1.5 md:gap-2 border border-theme-border px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-[11px] md:text-sm text-error hover:bg-hover-bg transition disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[14px] md:text-base">delete</span>
                      {deletingManual ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="text-[10px] md:text-xs text-text-muted hover:text-on-surface transition"
                  >
                    {uploading ? 'Uploading…' : 'Replace file'}
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-full max-w-md border-2 border-dashed border-theme-border rounded-2xl p-6 md:p-10 flex flex-col items-center gap-2 md:gap-3 cursor-pointer hover:border-primary hover:bg-hover-bg transition"
                >
                  <span className="material-symbols-outlined text-3xl md:text-4xl text-text-muted">upload_file</span>
                  <p className="text-[11px] md:text-sm font-medium text-on-surface">Click to upload machine manual</p>
                  <p className="text-[10px] md:text-xs text-text-muted">PDF, DOC, DOCX — max 50 MB</p>
                  {uploading && <p className="text-[10px] md:text-xs text-primary">Uploading…</p>}
                </div>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleUpload} />
            </div>
          )}
        </div>

        {/* Footer */}
        {(tab === 'basic' || tab === 'manufacturer') && (
          <div className="px-4 py-3 md:px-6 md:py-4 border-t border-theme-border flex gap-2 md:gap-3 shrink-0">
            <button onClick={onClose} className="flex-1 border border-theme-border rounded-lg md:rounded-xl py-1.5 md:py-2 text-[11px] md:text-sm text-text-muted hover:bg-hover-bg transition">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-white rounded-lg md:rounded-xl py-1.5 md:py-2 text-[11px] md:text-sm font-semibold hover:opacity-90 transition disabled:opacity-40">
              {saving ? 'Saving…' : isNew ? t('settings.addMachine') : t('common.saveChanges')}
            </button>
          </div>
        )}
        {tab === 'manual' && (
          <div className="px-4 py-3 md:px-6 md:py-4 border-t border-theme-border flex justify-end shrink-0">
            <button onClick={onClose} className="border border-theme-border rounded-lg md:rounded-xl px-4 py-1.5 md:px-6 md:py-2 text-[11px] md:text-sm text-text-muted hover:bg-hover-bg transition">
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const PAGES = [
  { key: 'customers',   label: 'Customers',   icon: 'groups' },
  { key: 'products',    label: 'Products',    icon: 'inventory_2' },
  { key: 'orders',      label: 'Orders',      icon: 'shopping_cart' },
  { key: 'work-orders', label: 'Site Visits', icon: 'location_on' },
  { key: 'reports',     label: 'Tasks',       icon: 'analytics' },
  { key: 'employees',   label: 'Employees',   icon: 'badge' },
  { key: 'finance',     label: 'Finance',     icon: 'account_balance_wallet' },
  { key: 'production',  label: 'Production',  icon: 'precision_manufacturing' },
  { key: 'maintenance', label: 'Maintenance', icon: 'build' },
  { key: 'logistics',   label: 'Logistics',   icon: 'local_shipping' },
  { key: 'purchasing',  label: 'Purchasing',  icon: 'shopping_bag' },
  { key: 'attendance',  label: 'Attendance',  icon: 'schedule' },
]

// ─── Employee Assign Modal ────────────────────────────────────────────────────
function EmployeeAssignModal({ employee, allEmployees, onClose, onSave }) {
  const { roles } = useData()
  const [form, setForm] = useState({
    department: employee.department || '',
    supervisorId: employee.supervisorId || '',
  })
  const [saving, setSaving] = useState(false)

  const possibleSupervisors = allEmployees.filter((e) => e.id !== employee.id)

  async function handleSave() {
    setSaving(true)
    await onSave(employee.id, {
      ...employee,
      department: form.department,
      supervisorId: form.supervisorId || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-sm p-4 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div>
            <h3 className="text-sm md:text-base font-bold text-on-surface leading-tight">{employee.name}</h3>
            <p className="text-[10px] md:text-xs text-text-muted mt-0.5">{employee.position || '—'}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-text-muted hover:text-on-surface hover:bg-hover-bg transition">
            <span className="material-symbols-outlined text-sm md:text-base">close</span>
          </button>
        </div>
        <div className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">Department</label>
            <select
              className="w-full bg-surface-container border border-theme-border rounded-lg px-2.5 py-1.5 md:px-3 md:py-2 text-[11px] md:text-sm text-on-surface outline-none focus:border-primary"
              value={form.department}
              onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
            >
              <option value="">— Select Department —</option>
              {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] md:text-xs font-semibold text-text-muted mb-1">Manager (Supervisor)</label>
            <select
              className="w-full bg-surface-container border border-theme-border rounded-lg px-2.5 py-1.5 md:px-3 md:py-2 text-[11px] md:text-sm text-on-surface outline-none focus:border-primary"
              value={form.supervisorId}
              onChange={(e) => setForm((p) => ({ ...p, supervisorId: e.target.value }))}
            >
              <option value="">— None (is a Manager) —</option>
              {possibleSupervisors.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.department})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 md:gap-3 mt-4 md:mt-5">
          <button onClick={onClose} className="flex-1 border border-theme-border rounded-lg md:rounded-xl py-1.5 md:py-2 text-[11px] md:text-sm text-text-muted hover:bg-hover-bg transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-white rounded-lg md:rounded-xl py-1.5 md:py-2 text-[11px] md:text-sm font-semibold hover:opacity-90 transition disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Departments Tab ──────────────────────────────────────────────────────────
function UserRolesTab() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { roles, addRole, renameRole, deleteRole } = useData()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [newDept, setNewDept] = useState('')
  const [addError, setAddError] = useState('')
  const [viewDept, setViewDept] = useState(null)           // dept name string
  const [deletingRole, setDeletingRole] = useState(null)   // { id, name }
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [renamingRole, setRenamingRole] = useState(null)   // { id, name }
  const [renameText, setRenameText] = useState('')
  const [renameError, setRenameError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/employees`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setEmployees(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  async function handleAddDept() {
    const name = newDept.trim()
    if (!name) {
      setAddError('Lütfen bir departman adı yazın.')
      return
    }
    try {
      setAddError('')
      await addRole(name)
      setNewDept('')
    } catch (e) {
      setAddError(e.message)
    }
  }

  async function handleDeleteDept() {
    await deleteRole(deletingRole.id)
    setDeletingRole(null)
    setDeleteConfirmText('')
    load()
  }

  async function handleRenameDept() {
    const name = renameText.trim()
    if (!name || name === renamingRole.name) return
    try {
      setRenameError('')
      await renameRole(renamingRole.id, name)
      setRenamingRole(null)
      setRenameText('')
      load()
    } catch (e) {
      setRenameError(e.message)
    }
  }

  const roleDeptNames = roles.map((r) => r.name)
  const empDeptNames = employees.map((e) => e.department || 'Unassigned')
  const departments = [...new Set([...roleDeptNames, ...empDeptNames])].sort()

  if (loading) return (
    <div className="flex items-center gap-2 text-text-muted text-sm py-8">
      <span className="material-symbols-outlined animate-spin">refresh</span> Loading…
    </div>
  )

  const viewEmps = viewDept ? employees.filter((e) => (e.department || 'Unassigned') === viewDept) : []
  const viewManagers = viewEmps.filter((e) => e.isManager)
  const viewMembers = viewEmps.filter((e) => !e.isManager)

  return (
    <div className="space-y-4">
      {/* Add Department */}
      <div className="flex gap-2">
        <input
          className="flex-1 bg-surface-container-lowest border border-theme-border rounded-lg px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
          placeholder="New department name…"
          value={newDept}
          onChange={(e) => setNewDept(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddDept()}
        />
        <button
          onClick={handleAddDept}
          className="flex items-center gap-1.5 primary-gradient text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm shadow-primary/10 hover:opacity-90 transition-opacity shrink-0"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          {t('common.add')}
        </button>
      </div>
      {addError && <p className="text-xs text-error -mt-2">{addError}</p>}

      {departments.length === 0 && (
        <p className="text-sm text-text-muted py-4">No departments yet. Add one above.</p>
      )}

      {/* Compact department grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {departments.map((dept) => {
          const count = employees.filter((e) => (e.department || 'Unassigned') === dept).length
          const role = roles.find((r) => r.name === dept)
          return (
            <div
              key={dept}
              onClick={() => setViewDept(dept)}
              className="group flex items-center gap-3 bg-surface-container-lowest border border-theme-border rounded-xl px-4 py-3 cursor-pointer hover:border-primary/40 hover:bg-hover-bg transition"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-base text-primary">corporate_fare</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{dept}</p>
                <p className="text-xs text-text-muted">{count} {count === 1 ? 'person' : 'people'}</p>
              </div>
              {role && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => { setRenamingRole({ id: role.id, name: role.name }); setRenameText(role.name); setRenameError('') }}
                    className="p-1 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition"
                    title="Rename"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    onClick={() => { setDeletingRole({ id: role.id, name: role.name }); setDeleteConfirmText('') }}
                    className="p-1 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Department detail popup */}
      {viewDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 md:py-4 primary-gradient">
              <span className="material-symbols-outlined text-white text-[13px] md:text-base">corporate_fare</span>
              <h3 className="text-sm md:text-base font-bold text-white flex-1">{viewDept}</h3>
              <span className="text-[10px] md:text-xs font-medium text-white/90 bg-white/20 px-1.5 py-0.5 rounded-full">{viewEmps.length} {viewEmps.length === 1 ? 'person' : 'people'}</span>
              <button onClick={() => setViewDept(null)} className="ml-1 p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-sm md:text-base">close</span>
              </button>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto space-y-1">
              {viewEmps.length === 0 && (
                <p className="text-[11px] md:text-sm text-text-muted text-center py-6">No employees in this department.</p>
              )}
              {viewManagers.map((emp) => (
                <div key={emp.id} className="flex items-center gap-2.5 px-3 py-2 md:py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[12px] md:text-sm text-amber-600">manage_accounts</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] md:text-sm font-semibold text-on-surface truncate leading-tight">{emp.name}</p>
                    <p className="text-[9px] md:text-[11px] text-text-muted mt-0.5">{emp.position || '—'}</p>
                  </div>
                  <span className="text-[9px] md:text-[10px] font-bold bg-amber-500/15 text-amber-600 px-1.5 md:px-2 py-0.5 rounded-full whitespace-nowrap">MANAGER</span>
                </div>
              ))}
              {viewMembers.map((emp) => (
                <div key={emp.id} className="flex items-center gap-2.5 px-3 py-2 md:py-2.5 rounded-xl hover:bg-hover-bg transition">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[12px] md:text-sm text-text-muted">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] md:text-sm font-medium text-on-surface truncate leading-tight">{emp.name}</p>
                    <p className="text-[9px] md:text-[11px] text-text-muted mt-0.5">{emp.position || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renamingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-sm p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[18px] md:text-2xl">edit</span>
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-on-surface">Rename Department</h3>
                <p className="text-[10px] md:text-xs text-text-muted">Current: <span className="font-semibold text-on-surface">{renamingRole.name}</span></p>
              </div>
            </div>
            <input
              className="w-full bg-surface-container border border-theme-border rounded-lg px-2.5 py-1.5 md:px-3 md:py-2 text-[11px] md:text-sm text-on-surface outline-none focus:border-primary mb-1"
              placeholder="New department name…"
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameDept()}
              autoFocus
            />
            {renameError && <p className="text-[10px] md:text-xs text-error mb-2">{renameError}</p>}
            <div className="flex gap-2 md:gap-3 mt-3 md:mt-4">
              <button onClick={() => { setRenamingRole(null); setRenameText(''); setRenameError('') }} className="flex-1 border border-theme-border rounded-lg md:rounded-xl py-1.5 md:py-2 text-[11px] md:text-sm text-text-muted hover:bg-hover-bg transition">{t('common.cancel')}</button>
              <button
                onClick={handleRenameDept}
                disabled={!renameText.trim() || renameText.trim() === renamingRole.name}
                className="flex-1 bg-primary text-white rounded-lg md:rounded-xl py-1.5 md:py-2 text-[11px] md:text-sm font-semibold hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {t('common.edit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-sm p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-error text-[18px] md:text-2xl">delete</span>
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-on-surface">Delete Department</h3>
                <p className="text-[10px] md:text-xs text-text-muted">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-[11px] md:text-sm text-text-muted mb-2 md:mb-3">
              Type <span className="font-semibold text-on-surface">{deletingRole.name}</span> to confirm.
            </p>
            <input
              className="w-full bg-surface-container border border-theme-border rounded-lg px-2.5 py-1.5 md:px-3 md:py-2 text-[11px] md:text-sm text-on-surface outline-none focus:border-error mb-3 md:mb-4"
              placeholder={deletingRole.name}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && deleteConfirmText === deletingRole.name && handleDeleteDept()}
              autoFocus
            />
            <div className="flex gap-2 md:gap-3">
              <button onClick={() => { setDeletingRole(null); setDeleteConfirmText('') }} className="flex-1 border border-theme-border rounded-lg md:rounded-xl py-1.5 md:py-2 text-[11px] md:text-sm text-text-muted hover:bg-hover-bg transition">{t('common.cancel')}</button>
              <button
                onClick={handleDeleteDept}
                disabled={deleteConfirmText !== deletingRole.name}
                className="flex-1 bg-error text-white rounded-lg md:rounded-xl py-1.5 md:py-2 text-[11px] md:text-sm font-semibold hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ORDER_STATUSES = [
  { key: 'Processing',           label: 'Processing',           icon: 'hourglass_top' },
  { key: 'Confirmed',            label: 'Confirmed',            icon: 'check_circle' },
  { key: 'In-Production',        label: 'In-Production',        icon: 'precision_manufacturing' },
  { key: 'Production Completed', label: 'Production Completed', icon: 'done_all' },
  { key: 'E-WayBill',            label: 'E-WayBill',            icon: 'receipt_long' },
  { key: 'In Delivery',          label: 'In Delivery',          icon: 'local_shipping' },
  { key: 'E-Invoice',            label: 'E-Invoice',            icon: 'request_quote' },
  { key: 'Delivered',            label: 'Delivered',            icon: 'inventory' },
]

function PermissionGrid({ columns, getValue, onToggle, saving, emptyMessage, subPermissions = {} }) {
  const { roles } = useData()
  if (roles.length === 0) return <p className="text-sm text-text-muted">{emptyMessage}</p>
  return (
    <div className="rounded-2xl border border-theme-border overflow-auto max-h-[420px]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-theme-border bg-surface-container-high text-text-muted text-xs uppercase tracking-wider sticky top-0 z-10">
            <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-surface-container-high">Role</th>
            {columns.map((c) => (
              <th key={c.key} className="text-center px-3 py-3 font-semibold whitespace-nowrap bg-surface-container-high">
                <div className="flex flex-col items-center gap-1">
                  {c.icon && <span className="material-symbols-outlined text-base">{c.icon}</span>}
                  {c.label}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-surface-container-lowest">
          {roles.map((r) => (
            <tr key={r.id} className="border-b border-theme-border last:border-0">
              <td className="px-4 py-3 font-medium text-on-surface sticky left-0 bg-surface-container-lowest">
                <div className="flex items-center gap-2">
                  {saving[r.name] && <span className="material-symbols-outlined text-base text-text-muted animate-spin">progress_activity</span>}
                  {r.name}
                </div>
              </td>
              {columns.map((c) => {
                const subs = subPermissions[c.key] || []
                const pageEnabled = getValue(r.name, c.key)
                return (
                  <td key={c.key} className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={pageEnabled}
                        onChange={() => onToggle(r.name, c.key)}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                      {pageEnabled && subs.map((sub) => (
                        <label key={sub.key} className="flex items-center gap-1 text-[11px] text-text-muted whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            checked={getValue(r.name, sub.key)}
                            onChange={() => onToggle(r.name, sub.key)}
                            className="w-3 h-3 accent-primary cursor-pointer"
                          />
                          {sub.label}
                        </label>
                      ))}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
          </tbody>
        </table>
    </div>
  )
}

const PAGE_SUB_PERMISSIONS = {
  purchasing: [{ key: 'purchasing:create', label: 'Can Create & edit' }],
}

function PageAccessTab() {
  const { permissions, updateRolePermissions } = useData()
  const [saving, setSaving] = useState({})

  async function toggle(roleName, pageKey) {
    const current = permissions[roleName] || []
    let next
    if (current.includes(pageKey)) {
      // Unchecking a page — also strip any of its sub-permissions
      const subs = (PAGE_SUB_PERMISSIONS[pageKey] || []).map((s) => s.key)
      next = current.filter((p) => p !== pageKey && !subs.includes(p))
    } else {
      next = [...current, pageKey]
    }
    setSaving((s) => ({ ...s, [roleName]: true }))
    try { await updateRolePermissions(roleName, next) }
    finally { setSaving((s) => ({ ...s, [roleName]: false })) }
  }

  return (
    <div>
      <p className="text-sm text-text-muted mb-4">Choose which pages each role can access.</p>
      <PermissionGrid
        columns={PAGES}
        getValue={(role, key) => (permissions[role] || []).includes(key)}
        onToggle={toggle}
        saving={saving}
        emptyMessage="Add roles first before configuring page permissions."
        subPermissions={PAGE_SUB_PERMISSIONS}
      />
    </div>
  )
}

function StatusChangesTab() {
  const { statusPermissions, updateRoleStatusPermissions } = useData()
  const [saving, setSaving] = useState({})

  async function toggle(roleName, statusKey) {
    const current = statusPermissions[roleName] || []
    const next = current.includes(statusKey) ? current.filter((s) => s !== statusKey) : [...current, statusKey]
    setSaving((s) => ({ ...s, [roleName]: true }))
    try { await updateRoleStatusPermissions(roleName, next) }
    finally { setSaving((s) => ({ ...s, [roleName]: false })) }
  }

  return (
    <div>
      <p className="text-sm text-text-muted mb-4">Choose which order statuses each role can change to.</p>
      <PermissionGrid
        columns={ORDER_STATUSES}
        getValue={(role, key) => (statusPermissions[role] || []).includes(key)}
        onToggle={toggle}
        saving={saving}
        emptyMessage="Add roles first before configuring status permissions."
      />
    </div>
  )
}

// ─── Permissions Tab ──────────────────────────────────────────────────────────
function PermissionsTab() {
  const [subTab, setSubTab] = useState('pages')

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-theme-border">
        <button
          onClick={() => setSubTab('pages')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${subTab === 'pages' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined text-base">web</span>
          Page Access
        </button>
        <button
          onClick={() => setSubTab('statuses')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${subTab === 'statuses' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined text-base">swap_horiz</span>
          Status Changes
        </button>
      </div>
      {subTab === 'pages'    && <PageAccessTab />}
      {subTab === 'statuses' && <StatusChangesTab />}
    </div>
  )
}

// ─── Machines Tab ─────────────────────────────────────────────────────────────
function MachinesTab() {
  const { t } = useTranslation()
  const { machines: realMachines, addMachine, updateMachine, deleteMachine } = useData()
  const [modal, setModal] = useState(null) // null | 'new' | machine object
  const [viewMachine, setViewMachine] = useState(null)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [search, setSearch] = useState('')

  const machines = realMachines || []

  const filtered = machines.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase()) ||
    (m.location || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleSave(form) {
    try {
      setError('')
      if (modal === 'new') {
        await addMachine(form)
        setModal(null)
      } else {
        await updateMachine(modal.id, form)
        setModal(null)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const isWarrantyExpiring = (date) => {
    if (!date) return false
    const d = new Date(date)
    const in60 = new Date()
    in60.setDate(in60.getDate() + 60)
    return d <= in60 && d >= new Date()
  }

  const isMaintenanceDue = (date) => {
    if (!date) return false
    const d = new Date(date)
    const in14 = new Date()
    in14.setDate(in14.getDate() + 14)
    return d <= in14
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-text-muted">Manage factory machines and maintenance records.</p>
        <button
          onClick={() => { setError(''); setModal('new') }}
          className="flex items-center gap-1.5 primary-gradient text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm shadow-primary/10 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          {t('settings.addMachine', 'Makine Ekle')}
        </button>
      </div>

      {error && <p className="text-xs text-error mb-3">{error}</p>}

      <div className="relative mb-4 max-w-sm">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">search</span>
        <input
          className="w-full bg-surface-container-lowest border border-theme-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
          placeholder="Search machines…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-16 text-sm text-text-muted">
          {machines.length === 0 ? t('settings.noMachines') : t('common.noResults')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((m) => {
            const yearTasks = (m.monthlyMaintenance || []).filter((t) => t.year === new Date().getFullYear())
            const completedThisYear = yearTasks.filter((t) => t.completed).length
            const totalThisYear = yearTasks.length
            return (
              <div
                key={m.id}
                onClick={() => setViewMachine(m)}
                className="bg-surface-container-lowest rounded-2xl border border-theme-border p-4 flex items-start gap-4 hover:shadow-sm transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">precision_manufacturing</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-on-surface text-sm">{m.name}</span>
                    <span className="font-mono text-xs text-text-muted">{m.code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[m.status] || 'bg-surface-container-high text-text-muted'}`}>{m.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-muted">
                    {m.location && <span><span className="material-symbols-outlined text-xs align-middle mr-0.5">location_on</span>{m.location}</span>}
                    {m.manufacturer && <span><span className="material-symbols-outlined text-xs align-middle mr-0.5">factory</span>{m.manufacturer}</span>}
                    {m.productionYear && <span>Year: {m.productionYear}</span>}
                    {m.warrantyExpiry && (
                      <span className={isWarrantyExpiring(m.warrantyExpiry) ? 'text-amber-600 font-medium' : ''}>
                        Warranty: {m.warrantyExpiry}{isWarrantyExpiring(m.warrantyExpiry) ? ' ⚠' : ''}
                      </span>
                    )}
                    {m.nextMaintenanceDue && (
                      <span className={isMaintenanceDue(m.nextMaintenanceDue) ? 'text-red-600 font-medium' : ''}>
                        Next maint: {m.nextMaintenanceDue}{isMaintenanceDue(m.nextMaintenanceDue) ? ' !' : ''}
                      </span>
                    )}
                    {totalThisYear > 0 && <span>{completedThisYear}/{totalThisYear} tasks done this year</span>}
                    {m.manualName && <span className="text-primary"><span className="material-symbols-outlined text-xs align-middle mr-0.5">menu_book</span>Manual uploaded</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => { setError(''); setModal(m) }}
                    className="p-1.5 rounded-lg hover:bg-hover-bg text-text-muted hover:text-primary transition"
                    title="Edit"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  {deletingId === m.id ? (
                    <span className="flex flex-col md:flex-row items-center gap-1 md:gap-1.5 bg-surface-container-high md:bg-transparent p-1 md:p-0 rounded-lg">
                      <button onClick={async () => { await deleteMachine(m.id); setDeletingId(null) }} className="text-[10px] md:text-xs font-bold text-white bg-error px-2 py-0.5 md:py-1 rounded-md transition whitespace-nowrap">{t('common.yes')}</button>
                      <button onClick={() => setDeletingId(null)} className="text-[10px] md:text-xs font-semibold text-text-muted hover:text-on-surface px-1.5 py-0.5 md:py-1 transition whitespace-nowrap">{t('common.no')}</button>
                    </span>
                  ) : (
                    <button onClick={() => setDeletingId(m.id)} className="p-1.5 rounded-lg hover:bg-hover-bg text-text-muted hover:text-error transition">
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewMachine && (
        <MachineViewModal
          machine={viewMachine}
          onClose={() => setViewMachine(null)}
          onEdit={() => { setViewMachine(null); setError(''); setModal(viewMachine) }}
        />
      )}

      {modal && (
        <MachineModal
          machine={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

const STATUS_KEYS = ['Processing', 'Confirmed', 'In-Production', 'Production Completed', 'E-WayBill', 'In Delivery', 'E-Invoice', 'Delivered']

const orderStatusColor = {
  Processing:             'bg-amber-100 text-amber-700',
  Confirmed:              'bg-primary-fixed text-on-primary-fixed-variant',
  'In-Production':        'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  'Production Completed': 'bg-green-300 text-green-700',
  'E-WayBill':            'bg-orange-100 text-orange-700',
  'In Delivery':          'bg-blue-100 text-blue-700',
  'E-Invoice':            'bg-teal-100 text-teal-700',
  Delivered:              'bg-green-400 text-green-900',
}

function OrderStatusTab() {
  const { token } = useAuth()
  const { userStatusPermissions, updateUserStatusPermissions } = useData()
  const [users, setUsers] = useState([])
  const [saving, setSaving] = useState({})
  const [openDropdown, setOpenDropdown] = useState(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    fetch(`${API_URL}/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpenDropdown(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function getAssignedUserIds(status) {
    return Object.entries(userStatusPermissions)
      .filter(([, statuses]) => statuses.includes(status))
      .map(([userId]) => userId)
  }

  async function toggleUserForStatus(status, userId) {
    const isAssigned = (userStatusPermissions[userId] || []).includes(status)
    setSaving((s) => ({ ...s, [status]: true }))
    try {
      if (isAssigned) {
        const next = (userStatusPermissions[userId] || []).filter((s) => s !== status)
        await updateUserStatusPermissions(userId, next)
      } else {
        const next = [...new Set([...(userStatusPermissions[userId] || []), status])]
        await updateUserStatusPermissions(userId, next)
      }
    } finally {
      setSaving((s) => ({ ...s, [status]: false }))
    }
  }

  return (
    <div>
      <p className="text-sm text-text-muted mb-6">
        Configure which employees can advance orders from each status to the next.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" ref={dropdownRef}>
        {STATUS_KEYS.map((status) => {
          const assignedIds = getAssignedUserIds(status)
          const assignedUsers = users.filter((u) => assignedIds.includes(u.id))
          const isOpen = openDropdown === status
          return (
            <div key={status} className="bg-surface-container-lowest rounded-xl border border-theme-border overflow-visible">
              <div className="px-3 py-2 md:px-4 md:py-3 border-b border-theme-border flex items-center gap-2 min-h-[40px] md:min-h-[48px]">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-extrabold uppercase tracking-widest ${orderStatusColor[status] || 'bg-surface-container-high text-text-muted'}`}>
                  {status}
                </span>
                {saving[status] && (
                  <span className="material-symbols-outlined text-[13px] md:text-base text-text-muted animate-spin ml-auto">progress_activity</span>
                )}
              </div>
              <div className="px-3 py-2.5 md:px-4 md:py-3 space-y-2">
                {/* Assigned user chips */}
                {assignedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 md:gap-2">
                    {assignedUsers.map((u) => (
                      <span
                        key={u.id}
                        className="flex items-center gap-1 bg-primary/10 text-primary text-[10px] md:text-xs font-semibold px-2 py-0.5 md:px-2.5 md:py-1 rounded-full"
                      >
                        {u.name}
                        <button
                          onClick={() => toggleUserForStatus(status, u.id)}
                          disabled={!!saving[status]}
                          className="hover:text-error transition disabled:opacity-40 flex items-center"
                        >
                          <span className="material-symbols-outlined text-[11px] md:text-sm leading-none">close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add employee dropdown */}
                <div className="relative mt-0.5 md:mt-1">
                  <button
                    onClick={() => setOpenDropdown(isOpen ? null : status)}
                    disabled={!!saving[status]}
                    className="flex items-center gap-1.5 text-[10px] md:text-xs font-semibold text-text-muted hover:text-primary border border-dashed border-theme-border rounded-lg px-2 py-1.5 md:px-3 md:py-2 w-full justify-center hover:border-primary transition disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[12px] md:text-[14px]">person_add</span>
                    Add employee
                  </button>
                  {isOpen && (
                    <div className="absolute left-0 top-full mt-1 z-30 bg-surface-container-lowest border border-theme-border rounded-xl shadow-xl w-full min-w-[200px] max-h-52 overflow-y-auto">
                      {users.length === 0 && (
                        <p className="text-xs text-text-muted px-3 py-2">No users found</p>
                      )}
                      {users.map((u) => {
                        const checked = assignedIds.includes(u.id)
                        return (
                          <label
                            key={u.id}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-hover-bg cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUserForStatus(status, u.id)}
                              className="w-3.5 h-3.5 accent-primary"
                            />
                            <span className="text-sm text-on-surface flex-1">{u.name}</span>
                            <span className="text-xs text-text-muted">
                              {u.role === 'admin' ? 'Admin' : u.department || ''}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PURCHASING_STATUS_KEYS = [
  'Request', 'Budget Review', 'Collecting Quotes', 'Comparison',
  'Pending Approval', 'PO Created', 'In Logistics', 'Quality Check',
  'Invoice Matching', 'Payment',
]

const purchasingStatusColor = {
  'Request':           'bg-blue-500/10 text-blue-600',
  'Budget Review':     'bg-amber-500/10 text-amber-600',
  'Collecting Quotes': 'bg-purple-500/10 text-purple-600',
  'Comparison':        'bg-indigo-500/10 text-indigo-600',
  'Pending Approval':  'bg-orange-500/10 text-orange-600',
  'PO Created':        'bg-cyan-600/10 text-cyan-700',
  'In Logistics':      'bg-teal-500/10 text-teal-600',
  'Quality Check':     'bg-lime-600/10 text-lime-700',
  'Invoice Matching':  'bg-pink-500/10 text-pink-600',
  'Payment':           'bg-emerald-500/10 text-emerald-600',
}

function PurchasingStatusTab() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const { userPurchasingStatusPermissions, updateUserPurchasingStatusPermissions } = useData()
  const [users, setUsers] = useState([])
  const [saving, setSaving] = useState({})
  const [pending, setPending] = useState(null) // { status, newUserId }

  useEffect(() => {
    fetch(`${API_URL}/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [token])

  function getAssignedUserId(status) {
    for (const [userId, statuses] of Object.entries(userPurchasingStatusPermissions)) {
      if (statuses.includes(status)) return userId
    }
    return ''
  }

  async function confirmAssign() {
    const { status, newUserId } = pending
    setPending(null)
    setSaving((s) => ({ ...s, [status]: true }))
    try {
      const prevUserId = getAssignedUserId(status)
      if (prevUserId && prevUserId !== newUserId) {
        const prevStatuses = (userPurchasingStatusPermissions[prevUserId] || []).filter((s) => s !== status)
        await updateUserPurchasingStatusPermissions(prevUserId, prevStatuses)
      }
      if (newUserId) {
        const nextStatuses = [...new Set([...(userPurchasingStatusPermissions[newUserId] || []), status])]
        await updateUserPurchasingStatusPermissions(newUserId, nextStatuses)
      }
    } finally {
      setSaving((s) => ({ ...s, [status]: false }))
    }
  }

  const pendingUser = pending ? users.find((u) => u.id === pending.newUserId) : null

  return (
    <div>
      <p className="text-sm text-text-muted mb-6">
        Configure which user can advance purchasing requests from each stage to the next.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {PURCHASING_STATUS_KEYS.map((status) => {
          const assignedUserId = getAssignedUserId(status)
          return (
            <div key={status} className="bg-surface-container-lowest rounded-xl border border-theme-border overflow-hidden">
              <div className="px-3 py-2 md:px-4 md:py-3 border-b border-theme-border flex items-center gap-2 min-h-[40px] md:min-h-[48px]">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-extrabold uppercase tracking-widest ${purchasingStatusColor[status] || 'bg-surface-container-high text-text-muted'}`}>
                  {status}
                </span>
              </div>
              <div className="px-3 py-2.5 md:px-4 md:py-3 flex items-center gap-2">
                <select
                  value={assignedUserId}
                  onChange={(e) => setPending({ status, newUserId: e.target.value })}
                  disabled={!!saving[status]}
                  className="flex-1 text-[11px] md:text-xs font-medium bg-surface-container border border-theme-border rounded-lg px-2.5 py-1.5 md:px-3 md:py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Unassigned —</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}{user.role === 'admin' ? ' (Admin)' : user.department ? ` (${user.department})` : ''}
                    </option>
                  ))}
                </select>
                {saving[status] && (
                  <span className="material-symbols-outlined text-[13px] md:text-base text-text-muted animate-spin">progress_activity</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirmation modal */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-container-low rounded-xl shadow-xl w-full max-w-sm p-4 md:p-6">
            <h3 className="text-sm md:text-base font-bold text-on-surface mb-1.5 md:mb-2">Confirm Assignment</h3>
            <p className="text-xs md:text-sm text-text-muted mb-1 md:mb-2 leading-snug">
              Assign <span className="font-semibold text-on-surface">{pendingUser ? pendingUser.name : 'Unassigned'}</span> to the{' '}
              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-extrabold uppercase tracking-widest ${purchasingStatusColor[pending.status] || 'bg-surface-container-high text-text-muted'}`}>
                {pending.status}
              </span>{' '}
              stage?
            </p>
            <div className="flex gap-2 mt-4 md:mt-5">
              <button
                onClick={() => setPending(null)}
                className="flex-1 border border-theme-border rounded-lg py-1.5 md:py-2 text-[11px] md:text-sm font-semibold text-text-muted hover:bg-hover-bg transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmAssign}
                className="flex-1 bg-primary text-on-primary rounded-lg py-1.5 md:py-2 text-[11px] md:text-sm font-bold hover:opacity-90 transition"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('roles')

  const TABS = [
    { key: 'users',               label: t('settings.users'),    icon: 'manage_accounts' },
    { key: 'roles',               label: t('settings.departments', 'Departments'), icon: 'corporate_fare' },
    { key: 'order-status',        label: t('settings.orderStatus', 'Order Status'), icon: 'swap_horiz' },
    { key: 'purchasing-status',   label: t('settings.purchasingStatus', 'Purchasing Status'), icon: 'shopping_cart' },
    { key: 'machines',            label: t('settings.machines'), icon: 'precision_manufacturing' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-4 md:mb-5">
        <h1 className="text-lg md:text-xl font-extrabold text-on-surface">{t('settings.title')}</h1>
        <p className="text-[10px] md:text-xs text-text-muted mt-0.5">System configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 md:gap-1.5 mb-5 md:mb-6 border-b border-theme-border overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 md:gap-1.5 px-3 md:px-3.5 py-1.5 md:py-2 text-[10px] md:text-xs font-bold border-b-2 -mb-[3px] transition rounded-t-lg whitespace-nowrap shrink-0 ${
              tab === t.key
                ? 'primary-gradient text-white border-primary shadow-sm shadow-primary/10'
                : 'border-transparent text-text-muted hover:text-on-surface hover:bg-surface-container-high/50'
            }`}
          >
            <span className="material-symbols-outlined text-sm md:text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users'             && <Users />}
      {tab === 'roles'             && <UserRolesTab />}
      {tab === 'order-status'      && <OrderStatusTab />}
      {tab === 'purchasing-status' && <PurchasingStatusTab />}
      {tab === 'machines'          && <MachinesTab />}
    </div>
  )
}
