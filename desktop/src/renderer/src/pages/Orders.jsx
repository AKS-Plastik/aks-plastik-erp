import { useState, useRef, useEffect, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import aksLogoUrl from '../assets/aks_logo.png'
import robotoFontUrl from '../assets/Roboto-Regular.ttf'
import { API_URL } from '../config'

import SearchableSelect from "../components/SearchableSelect"

const ITEMS_PER_PAGE = 10
const ORDER_STATUSES = ['Processing', 'Confirmed', 'In-Production', 'Production Completed', 'E-WayBill', 'In Delivery', 'E-Invoice', 'Delivered']
const ORDER_EDIT_STATUSES = ['Processing', 'Confirmed', 'In-Production', 'Production Completed']
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

const emptyItem = { productName: '', quantity: 1, unitPrice: '', currency: 'TRY', vat: '0', unit: '', notes: [] }

function emptyForm() {
  return { customerId: '', salesRepId: '', status: 'Processing', notes: '', shipmentType: '', paymentMethod: '', items: [{ ...emptyItem, notes: [] }] }
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────
const detailStatusStyle = {
  Processing: 'bg-amber-100 text-amber-700',
  Confirmed: 'bg-primary-fixed text-on-primary-fixed-variant',
  'In-Production': 'bg-orange-500 text-white shadow-sm',
  'Production Completed': 'bg-green-100 text-green-700',
  'E-WayBill': 'bg-orange-100 text-orange-700',
  'In Delivery': 'bg-blue-100 text-blue-700',
  'E-Invoice': 'bg-teal-100 text-teal-700',
  Delivered: 'bg-green-400 text-green-900',
}

function OrderDetailModal({
  order,
  onClose,
  currentUser,
  onStatusChange,
  canAddNote,
  canDeleteNote,
  addOrderItemNote,
  deleteOrderItemNote,
}) {
  const { t } = useTranslation()
  const { userStatusPermissions, statusPermissions } = useData()
  const [localStatus, setLocalStatus] = useState(order.status)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [expandedNotes, setExpandedNotes] = useState({})
  const [newNoteInputs, setNewNoteInputs] = useState({})
  const [savingNoteId, setSavingNoteId] = useState(null)
  const [deletingNoteId, setDeletingNoteId] = useState(null)
  const isAdmin = currentUser?.role === 'admin'
  const nextStatus = ORDER_EDIT_STATUSES[ORDER_EDIT_STATUSES.indexOf(localStatus) + 1]

  const userDept = currentUser?.department
  const roleHasStatus = userDept ? (statusPermissions[userDept] || []).includes(localStatus) : false
  const userHasStatus = (userStatusPermissions[currentUser?.id] || []).includes(localStatus)
  const canAdvanceFromCurrent = isAdmin || roleHasStatus || userHasStatus
  const canChangeStatus = isAdmin || canAdvanceFromCurrent

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  async function confirmStatusChange() {
    if (isUpdatingStatus) return
    setIsUpdatingStatus(true)
    try {
      setLocalStatus(pendingStatus)
      await onStatusChange(order.id, pendingStatus)
      setPendingStatus(null)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  function toggleItemNotes(key) {
    setExpandedNotes((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleAddDetailNote(itemId, key) {
    const text = (newNoteInputs[key] || '').trim()
    if (!text || !itemId || !addOrderItemNote) return
    setSavingNoteId(key)
    try {
      await addOrderItemNote(itemId, text)
      setNewNoteInputs((prev) => ({ ...prev, [key]: '' }))
    } catch (err) {
      alert(err.message)
    } finally {
      setSavingNoteId(null)
    }
  }

  async function handleDeleteDetailNote(itemId, noteId) {
    if (!confirm(t('orders.deleteNoteConfirm', 'Bu notu silmek istediğinize emin misiniz?'))) return
    if (!deleteOrderItemNote) return
    setDeletingNoteId(noteId)
    try {
      await deleteOrderItemNote(itemId, noteId)
    } catch (err) {
      alert(err.message)
    } finally {
      setDeletingNoteId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 md:p-6" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-[95%] md:w-[90%] max-w-none p-4 md:p-8 max-h-[90dvh] overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between mb-4 md:mb-6 gap-3 md:gap-4">
          <div>
            <p className="text-[10px] md:text-xs font-mono text-text-muted mb-0.5 md:mb-1">{order.code}</p>
            <h2 className="text-base md:text-xl font-bold text-on-surface leading-tight flex flex-col items-start gap-1">
              <span>{order.customer?.name || '—'}</span>
              {(order.customer?.accountCode || order.customer?.code) && (
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest">
                  {order.customer.accountCode || order.customer.code}
                </span>
              )}
            </h2>
            <p className="text-xs md:text-sm text-text-muted mt-1 md:mt-0.5">Sales Rep: {order.salesRep?.name || order.employee?.name || '—'}</p>
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
        <div className="rounded-xl border border-theme-border overflow-y-auto max-h-[320px] md:max-h-none mb-4 bg-surface-container-lowest">
          <table className="w-full text-sm block md:table">
            <thead className="hidden md:table-header-group sticky top-0 bg-surface-container-high z-10 shadow-sm">
              <tr className="text-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-semibold">{t('orders.product')}</th>
                <th className="text-right px-4 py-2.5 font-semibold">{t('orders.qty')}</th>
                <th className="text-center px-4 py-2.5 font-semibold">{t('common.unit')}</th>
                <th className="text-right px-4 py-2.5 font-semibold">{t('orders.unitPrice')}</th>
                <th className="text-right px-4 py-2.5 font-semibold">{t('orders.vat')}</th>
                <th className="text-right px-4 py-2.5 font-semibold">{t('orders.lineTotal')}</th>
                <th className="text-center px-4 py-2.5 font-semibold">{t('productionTasks.title')}</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {(order.items || []).map((it, i) => {
                const lineTotal = (parseFloat(it.unitPrice) || 0) * (parseFloat(it.quantity) || 0) * (1 + (it.vat || 0) / 100)
                const produced = it.producedQuantity || 0
                const inProd = it.inProductionQuantity || 0
                const remaining = it.quantity - produced - inProd
                const itemStatus = it.status || 'Processing'
                const activeTasks = (it.productionTasks || []).filter(task => task.status !== 'completed')
                const itemKey = it.id || i
                const notesCount = it.notes?.length || 0

                return (
                  <Fragment key={itemKey}>
                    <tr className="block md:table-row border-b border-theme-border last:border-0 p-2 md:p-0">
                      <td className="block md:table-cell px-2 md:px-4 py-1.5 md:py-3 text-on-surface font-semibold md:font-medium text-[11px] md:text-sm">
                        <span className="md:hidden text-[9px] font-bold uppercase text-text-muted block mb-0.5">{t('orders.product')}</span>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{it.productName}</span>
                            {notesCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => toggleItemNotes(itemKey)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 hover:bg-red-100 transition shadow-xs cursor-pointer"
                                title={t('orders.itemNotes', 'Kalem Notları')}
                              >
                                <span className="material-symbols-outlined text-[15px] text-red-600 dark:text-red-400">sticky_note_2</span>
                                <span className="text-red-600 dark:text-red-400 font-extrabold">{notesCount}</span>
                                <span className={`material-symbols-outlined text-[14px] text-red-500 transition-transform duration-200 ${expandedNotes[itemKey] ? 'rotate-180' : ''}`}>
                                  expand_more
                                </span>
                              </button>
                            ) : canAddNote ? (
                              <button
                                type="button"
                                onClick={() => toggleItemNotes(itemKey)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-text-muted hover:text-primary bg-surface-container-high/60 hover:bg-primary/10 border border-dashed border-theme-border hover:border-primary/40 transition cursor-pointer"
                                title={t('orders.addNote', 'Not Ekle')}
                              >
                                <span className="material-symbols-outlined text-[13px]">add_comment</span>
                                <span>{t('orders.addNote', 'Not Ekle')}</span>
                              </button>
                            ) : null}
                          </div>
                          {itemStatus !== 'Processing' && (
                            <span className={`inline-block mt-0.5 w-max px-1.5 py-0.5 rounded text-[9px] font-bold ${detailStatusStyle[itemStatus] || 'bg-surface-container-high'}`}>
                              {itemStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="flex md:table-cell justify-between items-center px-2 md:px-4 py-1 md:py-3 text-right text-text-muted text-[11px] md:text-sm">
                        <span className="md:hidden text-[9px] font-bold uppercase text-text-muted">{t('orders.qty')}</span>
                        <span className="font-medium text-on-surface md:text-text-muted">{it.quantity}</span>
                      </td>
                      <td className="flex md:table-cell justify-between items-center px-2 md:px-4 py-1 md:py-3 text-center text-text-muted text-[11px] md:text-sm">
                        <span className="md:hidden text-[9px] font-bold uppercase text-text-muted">{t('common.unit')}</span>
                        <span className="font-medium text-on-surface md:text-text-muted">{it.product?.unit || '—'}</span>
                      </td>
                      <td className="flex md:table-cell justify-between items-center px-2 md:px-4 py-1 md:py-3 text-right text-on-surface text-[11px] md:text-sm">
                        <span className="md:hidden text-[9px] font-bold uppercase text-text-muted">{t('orders.unitPrice')}</span>
                        <div className="font-medium">
                          <span className="text-[9px] md:text-xs text-text-muted mr-1">{it.currency || 'TRY'}</span>
                          {parseFloat(it.unitPrice).toFixed(2)}
                        </div>
                      </td>
                      <td className="flex md:table-cell justify-between items-center px-2 md:px-4 py-1 md:py-3 text-right text-text-muted text-[11px] md:text-sm">
                        <span className="md:hidden text-[9px] font-bold uppercase text-text-muted">{t('orders.vat')}</span>
                        <span className="font-medium text-on-surface md:text-text-muted">{it.vat > 0 ? `${it.vat}%` : '—'}</span>
                      </td>
                      <td className="flex md:table-cell justify-between items-center px-2 md:px-4 py-1 md:py-3 text-right font-bold md:font-semibold text-on-surface mt-1 md:mt-0 pt-1 md:pt-0 border-t border-surface-container md:border-0 text-[11px] md:text-sm">
                        <span className="md:hidden text-[9px] font-bold uppercase text-text-muted">{t('orders.lineTotal')}</span>
                        <div>
                          <span className="text-[9px] md:text-xs text-text-muted mr-1">{it.currency || 'TRY'}</span>
                          {lineTotal.toFixed(2)}
                        </div>
                      </td>
                      <td className="block md:table-cell px-2 md:px-4 py-2 md:py-3 text-center border-t border-surface-container md:border-0 mt-2 md:mt-0">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-2">
                          <div className="flex gap-1.5 text-[9px] md:text-[10px] font-bold items-center">
                            <span className="text-text-muted bg-surface-container-high px-1 py-0.5 rounded" title={t('orders.remaining')}>{remaining}</span>
                            <span className="text-white bg-orange-500 px-1 py-0.5 rounded shadow-sm" title={t('production.inProduction')}>{inProd}</span>
                            <span className="text-green-700 bg-green-100 px-1 py-0.5 rounded" title={t('production.produced')}>{produced}</span>
                            <span className="text-text-muted mx-0.5">=</span>
                            <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded font-extrabold" title={t('orders.total')}>{it.quantity}</span>
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
                        </div>
                      </td>
                    </tr>

                    {/* Accordion panel across full width of the table */}
                    {expandedNotes[itemKey] && (
                      <tr
                        key={`${itemKey}-notes`}
                        className="block md:table-row bg-surface-container-high/20 border-b border-theme-border"
                      >
                        <td
                          colSpan={7}
                          className="block md:table-cell p-2.5 md:px-5 md:py-3"
                        >
                          <div className="w-full bg-surface-container-lowest border border-theme-border rounded-xl shadow-xs p-3 md:p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500 text-base">sticky_note_2</span>
                                <span className="font-bold text-xs text-on-surface">
                                  {it.productName} — {t('orders.itemNotes', 'Kalem Notları')}
                                </span>
                                <span className="text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/50">
                                  {notesCount}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleItemNotes(itemKey)}
                                className="text-text-muted hover:text-on-surface p-1 rounded hover:bg-hover-bg transition cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">close</span>
                              </button>
                            </div>

                            {/* List of notes */}
                            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                              {notesCount === 0 ? (
                                <p className="text-xs text-text-muted italic py-1 font-normal">
                                  {t('orders.noItemNotes', 'Bu kaleme ait not bulunmamaktadır.')}
                                </p>
                              ) : (
                                (it.notes || []).map((n, nIdx) => (
                                  <div
                                    key={n.id || nIdx}
                                    className="flex items-start justify-between gap-2 p-2 rounded-lg bg-surface-container-high/30 border border-theme-border/50 text-xs font-normal"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-bold text-[11px] text-on-surface flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[13px] text-text-muted">person</span>
                                          {n.authorName || 'Kullanıcı'}
                                        </span>
                                        {n.createdAt && (
                                          <span className="text-[10px] text-text-muted font-mono">
                                            {new Date(n.createdAt).toLocaleString('tr-TR', {
                                              day: '2-digit', month: '2-digit', year: 'numeric',
                                              hour: '2-digit', minute: '2-digit',
                                            })}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-on-surface whitespace-pre-wrap leading-relaxed">{n.note}</p>
                                    </div>
                                    {canDeleteNote && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDetailNote(it.id, n.id)}
                                        disabled={deletingNoteId === n.id}
                                        className="text-text-muted hover:text-error p-1 rounded hover:bg-error/10 transition shrink-0 cursor-pointer"
                                        title={t('common.delete', 'Sil')}
                                      >
                                        <span className="material-symbols-outlined text-[15px]">delete</span>
                                      </button>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Add Note Input if canAddNote */}
                            {canAddNote && (
                              <div className="flex items-center gap-2 pt-1.5 border-t border-theme-border/50 font-normal">
                                <input
                                  type="text"
                                  value={newNoteInputs[itemKey] || ''}
                                  onChange={(e) => setNewNoteInputs((prev) => ({ ...prev, [itemKey]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      handleAddDetailNote(it.id, itemKey)
                                    }
                                  }}
                                  placeholder={t('orders.notePlaceholder', 'Kalem ile ilgili bir not yazın...')}
                                  className="flex-1 bg-surface-container-high/40 border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-primary transition"
                                  disabled={savingNoteId === itemKey}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddDetailNote(it.id, itemKey)}
                                  disabled={savingNoteId === itemKey || !(newNoteInputs[itemKey] || '').trim()}
                                  className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer"
                                >
                                  {savingNoteId === itemKey ? (
                                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                  ) : (
                                    <>
                                      <span className="material-symbols-outlined text-[14px]">send</span>
                                      <span>{t('orders.addNote', 'Not Ekle')}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>


        {/* Totals */}
        <div className="flex flex-col items-end gap-1 mb-4">
          <span className="font-bold text-on-surface text-[14px] md:text-base border-t border-theme-border pt-1 mt-0.5">
            {t('orders.total')}:
            {(() => {
              const tg = getOrderTotals(order.items);
              const tk = Object.keys(tg);
              if (!tk.length) return " 0.00";
              return " " + tk.map(k => `${k} ${tg[k].toFixed(2)}`).join(" / ");
            })()}
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
            <span className="font-semibold text-on-surface mr-2">{t('common.notes')}:</span>{order.notes}
          </div>
        )}

        {/* Status change */}
        {canChangeStatus && (
          <div className="pt-3 border-t border-theme-border space-y-2">
            {isAdmin ? (
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                <div className="flex items-center gap-1.5 md:gap-3">
                  <span className="material-symbols-outlined text-text-muted text-sm md:text-base">swap_horiz</span>
                  <label className="text-[11px] md:text-xs font-semibold text-text-muted whitespace-nowrap">{t('orders.changeStatus')}</label>
                </div>
                <select
                  value={pendingStatus ?? localStatus}
                  onChange={(e) => setPendingStatus(e.target.value === localStatus ? null : e.target.value)}
                  className="w-full md:flex-1 bg-surface-container-lowest border border-theme-border rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm text-on-surface outline-none focus:border-primary"
                >
                  {(isAdmin ? ORDER_STATUSES : ORDER_EDIT_STATUSES).map((s) => (
                    <option key={s} value={s}>
                      {t('status.' + s.replace(/[\s-]/g, ''), s)}
                    </option>
                  ))}
                  {!isAdmin && !ORDER_EDIT_STATUSES.includes(localStatus) && (
                    <option value={localStatus} disabled>
                      {t('status.' + localStatus.replace(/[\s-]/g, ''), localStatus)}
                    </option>
                  )}
                </select>
              </div>
            ) : (
              !pendingStatus && canAdvanceFromCurrent && nextStatus && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] md:text-xs text-text-muted">{t('orders.current')} {localStatus}</span>
                  <button
                    onClick={() => setPendingStatus(nextStatus)}
                    className="flex items-center gap-1 md:gap-2 bg-primary text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-[11px] md:text-sm font-semibold hover:opacity-90 transition"
                  >
                    <span className="material-symbols-outlined text-[14px] md:text-base">arrow_forward</span>
                    {t('orders.markAs', { status: nextStatus })}
                  </button>
                </div>
              )
            )}
            {pendingStatus && (
              <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 md:gap-2 bg-amber-50 border border-amber-200 rounded-xl px-2.5 md:px-4 py-1.5 md:py-3">
                <span className="material-symbols-outlined text-amber-500 text-[14px] md:text-base">warning</span>
                <p className="text-[10px] md:text-xs text-amber-700 flex-1 min-w-[150px] md:min-w-0">
                  {t('orders.changeFrom', { from: localStatus, to: pendingStatus })}
                </p>
                <button
                  onClick={() => { if (!isUpdatingStatus) setPendingStatus(null) }}
                  disabled={isUpdatingStatus}
                  className="text-[10px] md:text-xs text-text-muted hover:text-on-surface px-1.5 py-1 rounded transition disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmStatusChange}
                  disabled={isUpdatingStatus}
                  className="text-[10px] md:text-xs font-semibold text-white bg-primary hover:opacity-90 px-2 py-1 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUpdatingStatus && (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  )}
                  <span>{isUpdatingStatus ? t('common.updating', 'Güncelleniyor...') : t('common.confirm')}</span>
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
const isSalesManager = (user) => {
  if (!user) return false
  if (user.role === 'admin') return true
  const dept = String(user.department || '').toLowerCase()
  return dept.includes('sales manager') || dept.includes('satış müdür') || dept.includes('satis mudur')
}

const isSalesDept = (user) => {
  if (!user) return false
  if (user.role === 'admin') return true
  const dept = String(user.department || '').toLowerCase()
  return (
    dept.includes('sale') ||
    dept.includes('satış') ||
    dept.includes('satis') ||
    dept.includes('pazarlama')
  )
}

const SALES_DEPTS = ['Sales Manager', 'Sales Representative', 'Satış Müdürü', 'Satış Temsilcisi', 'Satış']

function OrderModal({
  title, form, setForm, onClose, onSave, errors, saveError, isSaving = false,
  customers, employees, products, currentUser, salesTeam, isAdmin,
  canAddNote, canDeleteNote, addOrderItemNote, deleteOrderItemNote,
}) {
  const { t } = useTranslation()
  const [expandedNotes, setExpandedNotes] = useState({})
  const [newNoteInputs, setNewNoteInputs] = useState({})
  const [savingNoteIdx, setSavingNoteIdx] = useState(null)
  const [deletingNoteId, setDeletingNoteId] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const inputCls = (err) =>
    `w-full bg-surface-container-lowest border rounded px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition ${err ? 'border-error' : 'border-theme-border'}`

  function setItem(idx, field, value) {
    let sanitizedValue = value
    if (field === 'quantity') {
      // Standart olarak nokta (.) seçildi.
      // Kullanıcı virgül (,) yazsa veya yapıştırsa bile anında noktaya dönüştürülür.
      sanitizedValue = String(value).replace(/,/g, '.')
      sanitizedValue = sanitizedValue.replace(/[^0-9.]/g, '')
      const parts = sanitizedValue.split('.')
      if (parts.length > 2) {
        sanitizedValue = parts[0] + '.' + parts.slice(1).join('')
      }
    }
    setForm((f) => {
      const items = f.items.map((it, i) => i === idx ? { ...it, [field]: sanitizedValue } : it)
      return { ...f, items }
    })
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { ...emptyItem, notes: [] }] }))
  }

  function removeItem(idx) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  function fillFromProduct(idx, productId) {
    const prod = products.find((p) => p.id === productId)
    if (prod) {
      setForm((f) => {
        const items = f.items.map((it, i) =>
          i === idx ? { ...it, productName: prod.name, unitPrice: prod.price, productId: prod.id, currency: prod.currency || 'TRY', unit: prod.unit || '' } : it
        )
        return { ...f, items }
      })
    }
  }

  async function handleAddModalNote(idx) {
    const text = (newNoteInputs[idx] || '').trim()
    if (!text) return
    const currentItem = form.items[idx]
    if (currentItem?.id && addOrderItemNote) {
      setSavingNoteIdx(idx)
      try {
        const created = await addOrderItemNote(currentItem.id, text)
        setForm((f) => {
          const items = f.items.map((it, i) => {
            if (i !== idx) return it
            return {
              ...it,
              notes: [...(it.notes || []), created],
            }
          })
          return { ...f, items }
        })
        setNewNoteInputs((prev) => ({ ...prev, [idx]: '' }))
      } catch (err) {
        alert(err.message)
      } finally {
        setSavingNoteIdx(null)
      }
    } else {
      const tempNote = {
        id: 'temp_' + Date.now() + Math.random().toString(36).substring(2, 5),
        note: text,
        authorName: currentUser?.name || 'Kullanıcı',
        createdAt: new Date().toISOString(),
      }
      setForm((f) => {
        const items = f.items.map((it, i) => {
          if (i !== idx) return it
          return {
            ...it,
            notes: [...(it.notes || []), tempNote],
          }
        })
        return { ...f, items }
      })
      setNewNoteInputs((prev) => ({ ...prev, [idx]: '' }))
    }
  }

  async function handleDeleteModalNote(idx, note) {
    if (!confirm(t('orders.deleteNoteConfirm', 'Bu notu silmek istediğinize emin misiniz?'))) return
    const currentItem = form.items[idx]
    if (currentItem?.id && note?.id && !String(note.id).startsWith('temp_') && deleteOrderItemNote) {
      setDeletingNoteId(note.id)
      try {
        await deleteOrderItemNote(currentItem.id, note.id)
        setForm((f) => {
          const items = f.items.map((it, i) => {
            if (i !== idx) return it
            return {
              ...it,
              notes: (it.notes || []).filter((n) => n.id !== note.id),
            }
          })
          return { ...f, items }
        })
      } catch (err) {
        alert(err.message)
      } finally {
        setDeletingNoteId(null)
      }
    } else {
      setForm((f) => {
        const items = f.items.map((it, i) => {
          if (i !== idx) return it
          return {
            ...it,
            notes: (it.notes || []).filter((n) => n.id !== note.id),
          }
        })
        return { ...f, items }
      })
    }
  }

  const orderTotals = getOrderTotals(form.items);
  const totalsKeys = Object.keys(orderTotals);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 md:p-6">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-[95%] md:w-[90%] max-w-none p-4 md:p-8 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="text-lg font-bold text-on-surface">{title}</h2>
          <button
            onClick={() => { if (!isSaving) onClose() }}
            disabled={isSaving}
            className="text-text-muted hover:text-error disabled:opacity-50"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-text-muted mb-1.5">{t('orders.customer')} *</label>
              <SearchableSelect
                options={customers.filter(c => {
                  const code = c.code || '';
                  const acc = c.accountCode || '';
                  return code.startsWith('120') || acc.startsWith('120') || code.startsWith('CX-');
                }).map(c => {
                  const displayCode = c.accountCode && c.code && c.code !== c.accountCode
                    ? `${c.code} (${c.accountCode})`
                    : (c.accountCode || c.code || '');
                  return { value: c.id, label: `${displayCode} - ${c.name}` };
                })}
                value={form.customerId}
                onChange={(val) => setForm((f) => ({ ...f, customerId: val }))}
                placeholder={t('orders.selectCustomer')}
                error={errors.customerId}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">{t('orders.salesRep')} *</label>
              {(() => {
                const isAdminOrManager = isAdmin || isSalesManager(currentUser)
                if (!isAdminOrManager) {
                  return (
                    <input
                      readOnly
                      className={`${inputCls()} bg-surface-container-high cursor-not-allowed`}
                      value={currentUser?.name || ''}
                    />
                  )
                }
                // Admin / Manager: salesTeam (Sales dept members) + themselves if not already included
                const inList = salesTeam.some((u) => u.id === currentUser?.id)
                let options = inList ? [...salesTeam] : [...salesTeam, { id: currentUser?.id, name: currentUser?.name, department: currentUser?.department || 'Yönetici' }]
                if (form.salesRepId && !options.some((u) => u.id === form.salesRepId)) {
                  options = [...options, { id: form.salesRepId, name: 'Seçili Temsilci', department: '' }]
                }
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
            <div className="hidden md:flex items-center gap-2 mb-1.5 px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex-1 min-w-0">{t('orders.product')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-16 text-center shrink-0">{t('orders.qty')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-14 text-center shrink-0">{t('common.unit')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-44 text-center shrink-0">{t('orders.unitPrice')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-24 text-center shrink-0">{t('orders.vat')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-32 text-right shrink-0">{t('orders.total')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted w-24 text-center shrink-0">{t('orders.notes', 'Not')}</span>
              <span className="w-8 shrink-0" />
            </div>
            <div className="space-y-3 md:space-y-2">
              {form.items.map((item, idx) => {
                const itemErr = errors.items && item.productName && (!item.unitPrice || parseFloat(item.quantity) <= 0)
                const itemTotal = (parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 0) * (1 + (parseFloat(item.vat) || 0) / 100)
                const notesCount = item.notes?.length || 0

                return (
                  <div key={idx} className="flex flex-col border border-theme-border rounded-xl p-3 bg-surface-container-high/30">
                    {/* Desktop layout: exact column widths matching header */}
                    <div className="hidden md:flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <SearchableSelect
                          options={products.map(p => ({
                            value: p.id,
                            label: p.stockNo ? `${p.stockNo} — ${p.name}` : p.name
                          }))}
                          value={item.productId || ''}
                          onChange={(val) => fillFromProduct(idx, val)}
                          placeholder={t('orders.selectProduct')}
                          error={errors.items && !item.productName}
                        />
                      </div>

                      <div className="w-16 shrink-0">
                        <input
                          type="text"
                          inputMode="decimal"
                          className={`w-full border rounded px-2 py-1.5 text-xs md:text-sm bg-surface-container-lowest text-on-surface outline-none focus:border-primary text-center ${itemErr && parseFloat(item.quantity) <= 0 ? 'border-error' : 'border-theme-border'}`}
                          placeholder="1"
                          value={item.quantity}
                          onChange={(e) => setItem(idx, 'quantity', e.target.value)}
                        />
                      </div>

                      <div className="w-14 shrink-0 flex items-center justify-center">
                        {item.unit ? (
                          <span className="text-[11px] font-semibold text-text-muted bg-surface-container-high border border-theme-border rounded px-1.5 py-1 leading-none w-full text-center truncate">{item.unit}</span>
                        ) : (
                          <span className="text-[11px] text-text-muted/40 w-full text-center">—</span>
                        )}
                      </div>

                      <div className="w-44 shrink-0">
                        <div className={`flex items-center border rounded overflow-hidden bg-surface-container-lowest ${itemErr && !item.unitPrice ? 'border-error' : 'border-theme-border'}`}>
                          <select
                            className="px-1.5 py-1.5 text-[11px] text-text-muted border-r border-theme-border bg-surface-container-high outline-none cursor-pointer shrink-0"
                            value={item.currency || 'TRY'}
                            onChange={(e) => setItem(idx, 'currency', e.target.value)}
                          >
                            <option value="TRY">TRY</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                          </select>
                          <input
                            type="number" min="0" step="0.01"
                            className="w-full px-2 py-1.5 text-xs md:text-sm text-on-surface outline-none bg-transparent"
                            placeholder="0.00"
                            value={item.unitPrice}
                            onChange={(e) => setItem(idx, 'unitPrice', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="w-24 shrink-0">
                        <div className="flex items-center border border-theme-border rounded overflow-hidden bg-surface-container-lowest">
                          <input
                            type="number" min="0" max="100" step="0.1"
                            className="w-full px-2 py-1.5 text-xs md:text-sm text-on-surface outline-none bg-transparent text-center"
                            placeholder="0"
                            value={item.vat}
                            onChange={(e) => setItem(idx, 'vat', e.target.value)}
                          />
                          <span className="px-2 text-xs text-text-muted border-l border-theme-border bg-surface-container-high font-semibold shrink-0">%</span>
                        </div>
                      </div>

                      <div className="w-32 shrink-0 text-right">
                        <span className="text-xs md:text-sm font-bold text-on-surface truncate block" title={`${item.currency || 'TRY'} ${itemTotal.toFixed(2)}`}>
                          {item.currency || 'TRY'} {itemTotal.toFixed(2)}
                        </span>
                      </div>

                      <div className="w-24 shrink-0 flex items-center justify-center">
                        {notesCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => setExpandedNotes((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                            className="inline-flex items-center justify-center gap-1 w-full px-2 py-1 rounded-full text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 hover:bg-red-100 transition shadow-xs cursor-pointer"
                            title={t('orders.itemNotes', 'Kalem Notları')}
                          >
                            <span className="material-symbols-outlined text-[15px] text-red-600 dark:text-red-400">sticky_note_2</span>
                            <span className="text-red-600 dark:text-red-400 font-extrabold">{notesCount}</span>
                            <span className={`material-symbols-outlined text-[14px] text-red-500 transition-transform duration-200 ${expandedNotes[idx] ? 'rotate-180' : ''}`}>
                              expand_more
                            </span>
                          </button>
                        ) : canAddNote ? (
                          <button
                            type="button"
                            onClick={() => setExpandedNotes((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                            className="inline-flex items-center justify-center gap-1 w-full px-2 py-1 rounded-full text-[11px] text-text-muted hover:text-primary bg-surface-container-high/60 hover:bg-primary/10 border border-dashed border-theme-border hover:border-primary/40 transition cursor-pointer"
                            title={t('orders.addNote', 'Not Ekle')}
                          >
                            <span className="material-symbols-outlined text-[14px]">add_comment</span>
                            <span>{t('orders.addNote', 'Not Ekle')}</span>
                          </button>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </div>

                      <div className="w-8 shrink-0 flex items-center justify-center">
                        {form.items.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-text-muted hover:text-error flex items-center justify-center p-1.5 rounded-lg hover:bg-error/10 transition cursor-pointer"
                            title={t('common.delete', 'Sil')}
                          >
                            <span className="material-symbols-outlined text-base">remove_circle</span>
                          </button>
                        ) : (
                          <span className="w-6" />
                        )}
                      </div>
                    </div>

                    {/* Mobile layout */}
                    <div className="flex flex-col gap-2.5 md:hidden">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1 block">{t('orders.product')}</span>
                        <SearchableSelect
                          options={products.map(p => ({
                            value: p.id,
                            label: p.stockNo ? `${p.stockNo} — ${p.name}` : p.name
                          }))}
                          value={item.productId || ''}
                          onChange={(val) => fillFromProduct(idx, val)}
                          placeholder={t('orders.selectProduct')}
                          error={errors.items && !item.productName}
                        />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1 block">{t('orders.qty')}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={`w-full border rounded px-2 py-1.5 text-xs bg-surface-container-lowest text-on-surface outline-none focus:border-primary text-center ${itemErr && parseFloat(item.quantity) <= 0 ? 'border-error' : 'border-theme-border'}`}
                            placeholder="1"
                            value={item.quantity}
                            onChange={(e) => setItem(idx, 'quantity', e.target.value)}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1 block">{t('common.unit')}</span>
                          <div className="h-[34px] flex items-center justify-center">
                            {item.unit ? (
                              <span className="text-[11px] font-semibold text-text-muted bg-surface-container-high border border-theme-border rounded px-1.5 py-1 leading-none w-full text-center truncate">{item.unit}</span>
                            ) : (
                              <span className="text-[11px] text-text-muted/40 w-full text-center">—</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1 block">{t('orders.unitPrice')}</span>
                          <div className={`flex items-center border rounded overflow-hidden bg-surface-container-lowest ${itemErr && !item.unitPrice ? 'border-error' : 'border-theme-border'}`}>
                            <select
                              className="px-1.5 py-1.5 text-[10px] text-text-muted border-r border-theme-border bg-surface-container-high outline-none cursor-pointer"
                              value={item.currency || 'TRY'}
                              onChange={(e) => setItem(idx, 'currency', e.target.value)}
                            >
                              <option value="TRY">TRY</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                              <option value="GBP">GBP</option>
                            </select>
                            <input
                              type="number" min="0" step="0.01"
                              className="w-full px-2 py-1.5 text-xs text-on-surface outline-none bg-transparent"
                              placeholder="0.00"
                              value={item.unitPrice}
                              onChange={(e) => setItem(idx, 'unitPrice', e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1 block">{t('orders.vat')}</span>
                          <div className="flex items-center border border-theme-border rounded overflow-hidden bg-surface-container-lowest">
                            <input
                              type="number" min="0" max="100" step="0.1"
                              className="w-full px-2 py-1.5 text-xs text-on-surface outline-none bg-transparent text-center"
                              placeholder="0"
                              value={item.vat}
                              onChange={(e) => setItem(idx, 'vat', e.target.value)}
                            />
                            <span className="px-2 text-[10px] text-text-muted border-l border-theme-border bg-surface-container-high font-semibold">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-theme-border gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5 block">{t('orders.total')}</span>
                          <span className="text-xs font-bold text-on-surface">
                            {item.currency || 'TRY'} {itemTotal.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {notesCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => setExpandedNotes((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 hover:bg-red-100 transition shadow-xs cursor-pointer shrink-0"
                              title={t('orders.itemNotes', 'Kalem Notları')}
                            >
                              <span className="material-symbols-outlined text-[15px] text-red-600 dark:text-red-400">sticky_note_2</span>
                              <span className="text-red-600 dark:text-red-400 font-extrabold">{notesCount}</span>
                              <span className={`material-symbols-outlined text-[14px] text-red-500 transition-transform duration-200 ${expandedNotes[idx] ? 'rotate-180' : ''}`}>
                                expand_more
                              </span>
                            </button>
                          ) : canAddNote ? (
                            <button
                              type="button"
                              onClick={() => setExpandedNotes((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] text-text-muted hover:text-primary bg-surface-container-high/60 hover:bg-primary/10 border border-dashed border-theme-border hover:border-primary/40 transition cursor-pointer shrink-0"
                              title={t('orders.addNote', 'Not Ekle')}
                            >
                              <span className="material-symbols-outlined text-[14px]">add_comment</span>
                              <span>{t('orders.addNote', 'Not Ekle')}</span>
                            </button>
                          ) : null}

                          {form.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-text-muted hover:text-error flex items-center justify-center p-1.5 rounded-lg hover:bg-error/10 transition shrink-0"
                              title={t('common.delete', 'Sil')}
                            >
                              <span className="material-symbols-outlined text-base">remove_circle</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Accordion panel */}
                    {expandedNotes[idx] && (
                      <div className="mt-2.5 pt-2.5 border-t border-theme-border/60 bg-surface-container-lowest/90 border border-theme-border rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-theme-border/60 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-500 text-base">sticky_note_2</span>
                            <span className="font-bold text-xs text-on-surface">
                              {item.productName || t('orders.lineItems', 'Kalem')} — {t('orders.itemNotes', 'Kalem Notları')}
                            </span>
                            <span className="text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/50">
                              {notesCount}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedNotes((prev) => ({ ...prev, [idx]: false }))}
                            className="text-text-muted hover:text-on-surface p-1 rounded hover:bg-hover-bg transition"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>

                        {/* Notes list */}
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {notesCount === 0 ? (
                            <p className="text-xs text-text-muted italic py-1 font-normal">
                              {t('orders.noItemNotes', 'Bu kaleme ait not bulunmamaktadır.')}
                            </p>
                          ) : (
                            (item.notes || []).map((n, nIdx) => (
                              <div
                                key={n.id || nIdx}
                                className="flex items-start justify-between gap-2 p-2 rounded-lg bg-surface-container-high/30 border border-theme-border/50 text-xs font-normal"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-bold text-[11px] text-on-surface flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px] text-text-muted">person</span>
                                      {n.authorName || currentUser?.name || 'Kullanıcı'}
                                    </span>
                                    {n.createdAt && (
                                      <span className="text-[10px] text-text-muted font-mono">
                                        {new Date(n.createdAt).toLocaleString('tr-TR', {
                                          day: '2-digit', month: '2-digit', year: 'numeric',
                                          hour: '2-digit', minute: '2-digit',
                                        })}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-on-surface whitespace-pre-wrap leading-relaxed">{n.note}</p>
                                </div>
                                {canDeleteNote && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteModalNote(idx, n)}
                                    disabled={deletingNoteId === n.id}
                                    className="text-text-muted hover:text-error p-1 rounded hover:bg-error/10 transition shrink-0"
                                    title={t('common.delete', 'Sil')}
                                  >
                                    <span className="material-symbols-outlined text-[15px]">delete</span>
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Add note input */}
                        {canAddNote && (
                          <div className="flex items-center gap-2 pt-1 border-t border-theme-border/50 font-normal">
                            <input
                              type="text"
                              value={newNoteInputs[idx] || ''}
                              onChange={(e) => setNewNoteInputs((prev) => ({ ...prev, [idx]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  handleAddModalNote(idx)
                                }
                              }}
                              placeholder={t('orders.notePlaceholder', 'Kalem ile ilgili bir not yazın...')}
                              className="flex-1 bg-surface-container-lowest border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-primary transition"
                              disabled={savingNoteIdx === idx}
                            />
                            <button
                              type="button"
                              onClick={() => handleAddModalNote(idx)}
                              disabled={savingNoteIdx === idx || !(newNoteInputs[idx] || '').trim()}
                              className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              {savingNoteIdx === idx ? (
                                <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-[14px]">send</span>
                                  <span>{t('orders.addNote', 'Not Ekle')}</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex justify-end">
              <div className="flex flex-col items-end border-t border-theme-border pt-1">
                <span className="text-[10px] uppercase font-bold text-text-muted mb-0.5">{t('orders.total')}:</span>
                {totalsKeys.length === 0 ? (
                  <span className="font-bold text-on-surface">0.00</span>
                ) : (
                  totalsKeys.map(k => (
                    <span key={k} className="font-bold text-on-surface">
                      {k} {orderTotals[k].toFixed(2)}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
        <div className="flex gap-2 md:gap-3 mt-4 md:mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 border border-theme-border rounded-lg py-1.5 md:py-2 text-xs md:text-sm text-text-muted hover:bg-hover-bg transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 bg-primary text-white rounded-lg py-1.5 md:py-2 text-xs md:text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            <span>{isSaving ? t('common.saving', 'Kaydediliyor...') : t('common.save')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const statusStyle = {
  Processing: 'bg-amber-200 text-amber-700',
  Confirmed: 'bg-primary-fixed text-on-primary-fixed-variant',
  'In-Production': 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  'Production Completed': 'bg-green-100 text-green-700',
  'E-WayBill': 'bg-orange-100 text-orange-700',
  'In Delivery': 'bg-blue-100 text-blue-700',
  'E-Invoice': 'bg-teal-100 text-teal-700',
  Delivered: 'bg-green-400 text-green-900',
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

function getOrderTotals(items) {
  const totals = {};
  if (!items || !items.length) return totals;
  items.forEach(it => {
    const cur = it.currency || 'TRY';
    const itemTotal = (parseFloat(it.unitPrice) || 0) * (parseFloat(it.quantity) || 0) * (1 + (parseFloat(it.vat) || 0) / 100);
    totals[cur] = (totals[cur] || 0) + itemTotal;
  });
  return totals;
}

export default function Orders() {
  const { t } = useTranslation()
  const {
    orders,
    addOrder,
    updateOrder,
    deleteOrder,
    syncAndRefreshOrders,
    customers,
    employees,
    products,
    isAdmin,
    permissions,
    employeePermissions,
    addOrderItemNote,
    deleteOrderItemNote,
  } = useData()
  const { user: currentUser, token } = useAuth()
  const [salesTeam, setSalesTeam] = useState([])
  const canDelete = isAdmin || isSalesManager(currentUser)
  const canCreate = isAdmin
    || isSalesDept(currentUser)
    || (permissions[currentUser?.department] || []).includes('orders-create')
  const canEditProcessing = isAdmin || canCreate

  const empId = currentUser?.employeeId || currentUser?.id
  const empPerms = employeePermissions?.[empId] || []
  const dept = currentUser?.department

  const checkPerm = (permKey) => {
    if (isAdmin || isSalesManager(currentUser)) return true
    if (empPerms.includes(`-${permKey}`)) return false
    if (empPerms.includes(permKey)) return true
    return (permissions?.[dept] || []).includes(permKey)
  }

  const canAddNote = checkPerm('orders-note-create')
  const canDeleteNote = checkPerm('orders-note-delete')

  const location = useLocation()
  useEffect(() => {
    if (location.state?.newOrderForCustomer) {
      const base = emptyForm()
      const isAdminOrManager = isAdmin || isSalesManager(currentUser)
      if (!isAdminOrManager) {
        base.salesRepId = currentUser?.id
      }
      base.customerId = location.state.newOrderForCustomer
      if (location.state.visitId) base.visitId = location.state.visitId
      setForm(base)
      setErrors({})
      setShowAdd(true)
      window.history.replaceState({}, document.title)
    }

    if (location.state?.openOrderId || location.state?.openOrderCode) {
      const targetOrder = location.state.openOrderId ? orders.find(o => o.id === location.state.openOrderId) : orders.find(o => o.code === location.state.openOrderCode)
      if (targetOrder) {
        setDetailOrder(targetOrder)
        window.history.replaceState({}, document.title)
      }
    }

  }, [location, isAdmin, currentUser, orders])


  useEffect(() => {
    if (!token) return
    fetch(`${API_URL}/auth/salesteam`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setSalesTeam(data))
      .catch(() => { })
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
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [exportOpen, setExportOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [expandedListNotes, setExpandedListNotes] = useState({})
  const exportRef = useRef(null)

  useEffect(() => {
    if (detailOrder) {
      const updated = orders.find(o => o.id === detailOrder.id)
      if (updated) {
        setDetailOrder(updated)
      }
    }
  }, [orders])

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
          'Item Notes': (it.notes || []).map((n) => n.note).join('; '),
          'Product Name': it.productName || '',
          'Quantity': it.quantity ?? '',
          'Unit': it.product?.unit || '',
          'Unit Price': it.unitPrice ?? '',
          'VAT %': it.vat ?? '',
          'Currency': it.currency || 'TRY',
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
    } catch (_) { }

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
          Object.entries(getOrderTotals(o.items)).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('\n') || '0.00',
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
          `${it.currency || cur} ${(parseFloat(it.unitPrice) * parseFloat(it.quantity)).toFixed(2)}`,
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
        foot: (() => {
          const tg = getOrderTotals(o.items);
          const tk = Object.keys(tg);
          if (!tk.length) {
            return [[
              { content: 'Order Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, font: tf } },
              { content: `0.00`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, font: tf } },
            ]];
          }
          return tk.map((k, index) => [
            { content: index === 0 ? 'Order Total' : '', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, font: tf } },
            { content: `${k} ${tg[k].toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, font: tf } }
          ]);
        })(),
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 30, 30] },
      })

      y = doc.lastAutoTable.finalY + 6
    }

    doc.save('orders.pdf')
  }

  function validate(f) {
    const e = {}
    if (!f.customerId) e.customerId = t('orders.errCustomer')
    const isAdminOrManager = isAdmin || isSalesManager(currentUser)
    if (!f.salesRepId && isAdminOrManager) e.salesRepId = t('orders.errSalesRep')
    if (!f.shipmentType) e.shipmentType = t('orders.errShipment')
    if (!f.paymentMethod) e.paymentMethod = t('orders.errPayment')
    const validItems = f.items.filter((it) => it.productName.trim())
    if (!validItems.length) {
      e.items = t('orders.errNoProduct')
    } else {
      const missingPrice = validItems.some((it) => it.unitPrice === '' || it.unitPrice === undefined)
      if (missingPrice) e.items = t('orders.errUnitPrice')
      const missingQty = validItems.some((it) => !parseFloat(it.quantity) || parseFloat(it.quantity) <= 0)
      if (missingQty) e.items = t('orders.errQty')
    }
    return e
  }

  function openAdd() {
    const base = emptyForm()
    const isAdminOrManager = isAdmin || isSalesManager(currentUser)
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
          id: it.id,
          productName: it.productName,
          quantity: it.quantity != null ? String(it.quantity).replace(',', '.') : '',
          unitPrice: it.unitPrice,
          currency: it.currency || 'TRY',
          vat: it.vat ?? '0',
          productId: it.productId || '',
          notes: Array.isArray(it.notes) ? [...it.notes] : [],
        }))
        : [{ ...emptyItem, notes: [] }],
    })
    setErrors({})
    setEditItem(item)
  }

  async function handleAdd() {
    if (isSaving) return
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }
    setIsSaving(true)
    try {
      setSaveError('')
      const cleanedItems = form.items.filter((it) => it.productName.trim()).map((it) => ({
        ...it,
        quantity: parseFloat(String(it.quantity).replace(',', '.')) || 0,
      }))
      await addOrder({ ...form, items: cleanedItems })
      setShowAdd(false)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleEdit() {
    if (isSaving) return
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }
    setIsSaving(true)
    try {
      setSaveError('')
      const cleanedItems = form.items.filter((it) => it.productName.trim()).map((it) => ({
        ...it,
        quantity: parseFloat(String(it.quantity).replace(',', '.')) || 0,
      }))
      await updateOrder(editItem.id, { ...form, items: cleanedItems })
      setEditItem(null)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      await deleteOrder(confirmDeleteId)
      setConfirmDeleteId(null)
    } catch (err) {
      alert(err.message)
    } finally {
      setIsDeleting(false)
    }
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
        id: it.id,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        currency: it.currency || 'TRY',
        vat: it.vat,
        productId: it.productId || null,
        notes: it.notes || [],
      })),
    })
  }

  const filtered = orders.filter((o) => {
    if (search) {
      const q = search.toLowerCase()
      const inCode = o.code.toLowerCase().includes(q)
      const inCustomer = (o.customer?.name || '').toLowerCase().includes(q) || (o.customer?.accountCode || o.customer?.code || '').toLowerCase().includes(q)
      const inRep = (o.salesRep?.name || o.employee?.name || '').toLowerCase().includes(q)
      const inProduct = (o.items || []).some((it) => it.productName.toLowerCase().includes(q))
      const inOrderNotes = (o.notes || '').toLowerCase().includes(q)
      const inItemNotes = (o.items || []).some((it) => (it.notes || []).some((n) => (n.note || '').toLowerCase().includes(q)))
      if (!inCode && !inCustomer && !inRep && !inProduct && !inOrderNotes && !inItemNotes) return false
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
    <div className="p-2 sm:p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl primary-gradient flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-[16px] sm:text-[24px]">shopping_bag</span>
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-on-surface leading-tight">{t('orders.title')}</h1>
            <p className="text-[10px] sm:text-sm text-text-muted sm:mt-0.5">{t('orders.totalOrders', { count: orders.length })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0 overflow-x-auto overflow-y-hidden w-full md:w-auto max-w-full pb-2 md:pb-0">
          <button onClick={syncAndRefreshOrders} className="flex items-center justify-center gap-1.5 border border-theme-border px-2.5 py-2 lg:px-3 lg:py-2 rounded-xl text-[11px] lg:text-sm text-text-muted hover:bg-hover-bg transition whitespace-nowrap flex-shrink-0">
            <span className="material-symbols-outlined text-[14px] lg:text-base">refresh</span>
            <span className="hidden lg:inline">{t('common.refresh')}</span>
          </button>
          <div className="relative flex-shrink-0" ref={exportRef}>
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={selected.size === 0}
              className="flex items-center justify-center gap-1.5 border border-theme-border px-2.5 py-2 lg:px-3 lg:py-2 rounded-xl text-[11px] lg:text-sm text-text-muted hover:bg-hover-bg transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[14px] lg:text-base">download</span>
              <span className="hidden lg:inline">{t('common.export', 'Dışa Aktar')}</span>{selected.size > 0 ? ` (${selected.size})` : ''}
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
            <button onClick={openAdd} className="flex items-center justify-center gap-1.5 primary-gradient text-white px-3 py-2 lg:px-4 lg:py-2.5 rounded-xl text-[11px] lg:text-sm font-bold shadow-xl shadow-primary/10 hover:opacity-90 transition-opacity whitespace-nowrap flex-shrink-0">
              <span className="material-symbols-outlined text-[14px] lg:text-base">add</span>
              {t('orders.newOrder')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-end gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <span className="material-symbols-outlined absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-text-muted text-[16px] md:text-lg">search</span>
          <input
            className="w-full bg-surface-container-lowest border border-theme-border rounded-xl pl-8 md:pl-9 pr-8 md:pr-10 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          {(search || filterStatus || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterDateFrom(''); setFilterDateTo(''); setPage(1) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 text-text-muted hover:text-error transition bg-surface-container-lowest"
              title={t('common.clear')}
            >
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">close</span>
            </button>
          )}
        </div>
        <select
          className="w-full md:w-auto bg-surface-container-lowest border border-theme-border rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary"
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
        >
          <option value="">{t('orders.allStatuses')}</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{t('status.' + s.replace(/-/g, ''), s)}</option>)}
        </select>
        <div className="grid grid-cols-2 sm:flex sm:flex-row items-stretch sm:items-end gap-2 w-full md:w-auto">
          <div className="flex flex-col items-start gap-1 flex-1 md:flex-none">
            <span className="text-[10px] md:text-xs text-text-muted whitespace-nowrap ml-1">{t('common.from')}</span>
            <input
              type="date"
              className="w-full md:w-auto bg-surface-container-lowest border border-theme-border rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary"
              value={filterDateFrom}
              onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1) }}
            />
          </div>
          <div className="flex flex-col items-start gap-1 flex-1 md:flex-none">
            <span className="text-[10px] md:text-xs text-text-muted whitespace-nowrap ml-1">{t('common.to')}</span>
            <input
              type="date"
              className="w-full md:w-auto bg-surface-container-lowest border border-theme-border rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary"
              value={filterDateTo}
              onChange={(e) => { setFilterDateTo(e.target.value); setPage(1) }}
            />
          </div>
        </div>
      </div>

      <div className="bg-transparent xl:bg-surface-container-lowest rounded-2xl xl:border border-theme-border overflow-hidden">
        <table className="w-full text-sm block xl:table">
          <thead className="hidden xl:table-header-group">
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
          <tbody className="block xl:table-row-group">
            {paginated.length === 0 ? (
              <tr className="block xl:table-row w-full">
                <td colSpan={(canDelete || canEditProcessing) ? 9 : 8} className="block xl:table-cell w-full text-center py-12 text-text-muted">
                  <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">inbox</span>
                  {t('orders.noOrders')}
                </td>
              </tr>
            ) : (
              paginated.map((o) => {
                const currency = o.items?.[0]?.currency || 'TRY'
                const createdAt = o.createdAt ? new Date(o.createdAt) : null
                const dateStr = createdAt ? createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
                const timeStr = createdAt ? createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'
                const itemNotesCount = (o.items || []).reduce((acc, it) => acc + (it.notes?.length || 0), 0)
                const hasOrderNote = Boolean(o.notes && o.notes.trim())
                const totalNotesCount = itemNotesCount + (hasOrderNote ? 1 : 0)
                const isNotesExpanded = !!expandedListNotes[o.id]

                const notesTooltip = [
                  ...(hasOrderNote ? [`[Sipariş Notu] ${o.notes}`] : []),
                  ...(o.items || []).flatMap((it) =>
                    (it.notes || []).map((n) => `[${it.productName}] ${n.authorName ? n.authorName + ': ' : ''}${n.note}`)
                  )
                ].join('\n')

                return (
                  <Fragment key={o.id}>
                    <tr
                      className={`block xl:table-row bg-surface-container-lowest xl:bg-transparent rounded-2xl xl:rounded-none mb-3 xl:mb-0 p-3 xl:p-0 shadow-sm xl:shadow-none border border-surface-container-low xl:border-0 xl:border-b border-theme-border hover:bg-hover-bg transition-colors cursor-pointer ${selected.has(o.id) ? 'bg-primary/5 xl:bg-primary/5 ring-2 ring-primary xl:ring-0' : ''}`}
                      onClick={() => setDetailOrder(o)}
                    >
                      <td className="block xl:table-cell w-full xl:w-auto relative mb-2 xl:mb-0 xl:px-4 py-1 xl:py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between xl:justify-start">
                          <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">Seç</span>
                          <input
                            type="checkbox"
                            checked={selected.has(o.id)}
                            onChange={() => toggleRow(o.id)}
                            className="w-4 h-4 rounded accent-primary cursor-pointer"
                          />
                        </div>
                      </td>
                      <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 xl:px-4 py-1 xl:py-2">
                        <div className="flex items-center justify-between xl:justify-start gap-2">
                          <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.order')}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs text-text-muted font-semibold">{o.code || '—'}</span>
                            {totalNotesCount > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpandedListNotes((prev) => ({ ...prev, [o.id]: !prev[o.id] }))
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 hover:bg-red-100 dark:hover:bg-red-900/60 transition shadow-xs cursor-pointer"
                                title={notesTooltip}
                              >
                                <span className="material-symbols-outlined text-[13px] text-red-600 dark:text-red-400">sticky_note_2</span>
                                <span>{totalNotesCount}</span>
                                <span className={`material-symbols-outlined text-[12px] text-red-500 transition-transform duration-200 ${isNotesExpanded ? 'rotate-180' : ''}`}>
                                  expand_more
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 xl:px-4 py-1 xl:py-2">
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
                      <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 xl:px-4 py-1 xl:py-2">
                        <div className="flex items-center justify-between xl:justify-start">
                          <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.salesRep')}</span>
                          <span className="text-text-muted text-xs lg:text-sm">{o.salesRep?.name || o.employee?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 xl:px-4 py-1 xl:py-2">
                        <div className="flex items-center justify-between xl:justify-end">
                          <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('orders.total')}</span>
                          <div className="flex flex-col items-end">
                            {(() => {
                              const tg = getOrderTotals(o.items);
                              const tk = Object.keys(tg);
                              if (!tk.length) return <span className="font-semibold text-xs lg:text-sm text-on-surface">0.00</span>;
                              return tk.map(k => (
                                <span key={k} className="font-semibold text-xs lg:text-sm text-on-surface">
                                  <span className="text-xs text-text-muted mr-1">{k}</span>
                                  {tg[k].toFixed(2)}
                                </span>
                              ));
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 xl:px-4 py-1 xl:py-2">
                        <div className="flex items-center justify-between xl:justify-start">
                          <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('common.status')}</span>
                          <span className={`inline-flex px-2 lg:px-2.5 py-0.5 rounded-full text-[10px] lg:text-xs font-semibold ${statusStyle[o.status] || statusStyle.Draft}`}>
                            {o.status}
                          </span>
                        </div>
                      </td>
                      <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 xl:px-4 py-1 xl:py-2">
                        <div className="flex items-center justify-between xl:justify-start">
                          <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('common.date')}</span>
                          <span className="text-xs text-text-muted">{dateStr}</span>
                        </div>
                      </td>
                      <td className="block xl:table-cell w-full xl:w-auto relative mb-1.5 xl:mb-0 xl:px-4 py-1 xl:py-2">
                        <div className="flex items-center justify-between xl:justify-start">
                          <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('workOrders.time')}</span>
                          <span className="text-xs text-text-muted">{timeStr}</span>
                        </div>
                      </td>
                      {(canDelete || (canEditProcessing && (isAdmin || o.status === 'Processing'))) && (
                        <td className="block xl:table-cell w-full xl:w-auto relative mt-3 xl:mt-0 pt-3 xl:pt-0 border-t border-surface-container-low xl:border-0 xl:px-4 py-1 xl:py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {(canDelete || (canEditProcessing && (isAdmin || o.status === 'Processing'))) && (
                              <button onClick={() => openEdit(o)} className="flex-1 xl:flex-none flex justify-center p-1.5 lg:p-1.5 rounded-lg border xl:border-0 border-theme-border hover:bg-hover-bg text-text-muted hover:text-primary transition">
                                <span className="material-symbols-outlined text-[16px] lg:text-base">edit</span>
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => setConfirmDeleteId(o.id)} className="flex-1 xl:flex-none flex justify-center p-1.5 lg:p-1.5 rounded-lg border xl:border-0 border-theme-border hover:bg-hover-bg text-text-muted hover:text-error transition">
                                <span className="material-symbols-outlined text-[16px] lg:text-base">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Accordion Row in List */}
                    {isNotesExpanded && (
                      <tr
                        className="block xl:table-row bg-red-50/20 dark:bg-red-950/15 border-b border-theme-border"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <td
                          colSpan={(canDelete || (canEditProcessing && (isAdmin || o.status === 'Processing'))) ? 9 : 8}
                          className="block xl:table-cell p-2.5 xl:px-6 xl:py-3"
                        >
                          <div className="bg-surface-container-lowest border border-red-200/80 dark:border-red-900/50 rounded-xl p-3 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500 text-base">sticky_note_2</span>
                                <span className="font-bold text-xs text-on-surface">
                                  {o.code} — {t('orders.orderNotes', 'Sipariş & Kalem Notları')}
                                </span>
                                <span className="text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/50">
                                  {totalNotesCount}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setDetailOrder(o)}
                                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{t('orders.viewDetail', 'Sipariş Detayına Git')}</span>
                                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedListNotes((prev) => ({ ...prev, [o.id]: false }))}
                                  className="text-text-muted hover:text-on-surface p-1 rounded hover:bg-hover-bg transition cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                              </div>
                            </div>

                            {/* General Order Note */}
                            {hasOrderNote && (
                              <div className="p-2 rounded-lg bg-surface-container-high/30 border border-theme-border/50 text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-[11px] text-text-muted mb-1">
                                  <span className="material-symbols-outlined text-[13px]">description</span>
                                  <span>{t('orders.generalNote', 'Genel Sipariş Notu')}</span>
                                </div>
                                <p className="text-xs text-on-surface whitespace-pre-wrap leading-relaxed pl-5 font-normal">
                                  {o.notes}
                                </p>
                              </div>
                            )}

                            {/* Line Items Notes */}
                            {itemNotesCount > 0 && (
                              <div className="space-y-2">
                                {(o.items || [])
                                  .filter((it) => it.notes && it.notes.length > 0)
                                  .map((it, itemIdx) => (
                                    <div
                                      key={it.id || itemIdx}
                                      className="rounded-lg bg-surface-container-high/20 border border-theme-border/40 p-2.5 space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-xs text-on-surface flex items-center gap-1.5">
                                          <span className="material-symbols-outlined text-[14px] text-primary">inventory_2</span>
                                          {it.productName}
                                          <span className="text-[11px] text-text-muted font-normal">
                                            ({it.quantity} {it.product?.unit || 'Adet'})
                                          </span>
                                        </span>
                                        <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded-full border border-red-200 dark:border-red-900/50">
                                          {it.notes.length} not
                                        </span>
                                      </div>

                                      <div className="space-y-1 pl-4">
                                        {it.notes.map((n, nIdx) => (
                                          <div
                                            key={n.id || nIdx}
                                            className="flex items-start justify-between gap-2 p-1.5 rounded bg-surface-container-lowest border border-theme-border/40 text-xs font-normal"
                                          >
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-bold text-[11px] text-on-surface flex items-center gap-1">
                                                  <span className="material-symbols-outlined text-[12px] text-text-muted">person</span>
                                                  {n.authorName || 'Kullanıcı'}
                                                </span>
                                                {n.createdAt && (
                                                  <span className="text-[10px] text-text-muted font-mono">
                                                    {new Date(n.createdAt).toLocaleString('tr-TR', {
                                                      day: '2-digit',
                                                      month: '2-digit',
                                                      year: 'numeric',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                    })}
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-xs text-on-surface whitespace-pre-wrap leading-relaxed">
                                                {n.note}
                                              </p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-text-muted">
        <span>{t('orders.totalOrders', { count: filtered.length })}</span>
        <div className="flex gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-theme-border disabled:opacity-40 hover:bg-hover-bg transition">{t('common.prev')}</button>
          <span className="px-3 py-1.5">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-theme-border disabled:opacity-40 hover:bg-hover-bg transition">{t('common.next')}</button>
        </div>
      </div>

      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          currentUser={currentUser}
          onStatusChange={handleStatusChange}
          canAddNote={canAddNote}
          canDeleteNote={canDeleteNote}
          addOrderItemNote={addOrderItemNote}
          deleteOrderItemNote={deleteOrderItemNote}
        />
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-sm p-5 md:p-8">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <span className="material-symbols-outlined text-error text-2xl md:text-3xl">delete_forever</span>
              <h2 className="text-base md:text-lg font-bold text-on-surface">{t('orders.deleteOrder')}</h2>
            </div>
            <p className="text-xs md:text-sm text-text-muted mb-4 md:mb-6">{t('orders.deleteConfirm')}</p>
            <div className="flex gap-2 md:gap-3">
              <button
                onClick={() => { if (!isDeleting) setConfirmDeleteId(null) }}
                disabled={isDeleting}
                className="flex-1 border border-theme-border rounded-lg py-1.5 md:py-2 text-xs md:text-sm text-text-muted hover:bg-hover-bg transition disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-error text-white rounded-lg py-1.5 md:py-2 text-xs md:text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                <span>{isDeleting ? t('common.deleting', 'Siliniyor...') : t('common.delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <OrderModal
          title={t('orders.newOrder')}
          form={form}
          setForm={setForm}
          errors={errors}
          saveError={saveError}
          isSaving={isSaving}
          onClose={() => { if (!isSaving) { setShowAdd(false); setSaveError('') } }}
          onSave={handleAdd}
          customers={customers}
          employees={employees}
          products={products}
          currentUser={currentUser}
          salesTeam={salesTeam}
          isAdmin={isAdmin}
          canAddNote={canAddNote}
          canDeleteNote={canDeleteNote}
          addOrderItemNote={addOrderItemNote}
          deleteOrderItemNote={deleteOrderItemNote}
        />
      )}
      {editItem && (
        <OrderModal
          title={t('orders.editOrder')}
          form={form}
          setForm={setForm}
          errors={errors}
          saveError={saveError}
          isSaving={isSaving}
          onClose={() => { if (!isSaving) { setEditItem(null); setSaveError('') } }}
          onSave={handleEdit}
          customers={customers}
          employees={employees}
          products={products}
          currentUser={currentUser}
          salesTeam={salesTeam}
          isAdmin={isAdmin}
          canAddNote={canAddNote}
          canDeleteNote={canDeleteNote}
          addOrderItemNote={addOrderItemNote}
          deleteOrderItemNote={deleteOrderItemNote}
        />
      )}
    </div>
  )
}
