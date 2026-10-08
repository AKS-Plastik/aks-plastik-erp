import { useState, useRef, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function ProductionPlanning() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { employeeTasks: allTasks, employees, machines, products, isAdmin, moveEmployeeTask, createEmployeeTask, updateEmployeeTask, deleteEmployeeTask, rolloverEmployeeTasks, permissions, employeePermissions } = useData()
  const { user: currentUser } = useAuth()
  
  const empId = currentUser?.employeeId
  const dept = currentUser?.department
  
  // Sadece Admin veya yetkili kişiler herkesi görebilir (Görünüm)
  const canViewAll = isAdmin
  
  // Düzenleme yetkisi
  const canEdit = isAdmin || (!((employeePermissions?.[empId] || []).includes('-production-planning-edit')) && ((permissions?.[dept] || []).includes('production-planning-edit') || (employeePermissions?.[empId] || []).includes('production-planning-edit')))

  const myTasks = useMemo(() => {
    if (canViewAll) return allTasks || []
    return (allTasks || []).filter(t => t.employeeId === empId)
  }, [allTasks, canViewAll, empId])

  const [filterEmployeeId, setFilterEmployeeId] = useState('')

  const filteredTasks = useMemo(() => {
    if (!filterEmployeeId) return myTasks;
    return myTasks.filter(t => t.employeeId === filterEmployeeId);
  }, [myTasks, filterEmployeeId])

  const [currentDate, setCurrentDate] = useState(new Date())
  const dateInputRef = useRef(null)
  const scrollRef = useRef(null)

  // Rollover logic (EOD Wizard)
  const [showRollover, setShowRollover] = useState(false)
  const [rolloverTasks, setRolloverTasks] = useState([])

  useEffect(() => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const pastIncomplete = myTasks.filter(t => {
      return t.date < todayStr && t.status !== 'completed' && t.status !== 'cancelled'
    })

    if (pastIncomplete.length > 0) {
      setRolloverTasks(pastIncomplete)
      setShowRollover(true)
    } else {
      setShowRollover(false)
    }
  }, [myTasks])

  const handleRolloverConfirm = async () => {
    try {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      await rolloverEmployeeTasks(rolloverTasks.map(t => t.id), todayStr)
      setShowRollover(false)
    } catch (error) {
      alert('Hata: ' + error.message)
    }
  }

  // Drag to scroll logic
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)

  const handleMouseDown = (e) => {
    if (e.target.closest('.task-card')) return // Don't scroll when dragging a card
    setIsDragging(true)
    setHasDragged(false)
    setStartX(e.pageX - scrollRef.current.offsetLeft)
    setScrollLeft(scrollRef.current.scrollLeft)
  }
  const handleMouseLeave = () => setIsDragging(false)
  const handleMouseUp = () => setIsDragging(false)
  const handleMouseMove = (e) => {
    if (!isDragging) return
    e.preventDefault()
    const x = e.pageX - scrollRef.current.offsetLeft
    const walk = (x - startX) * 2
    if (Math.abs(walk) > 5) setHasDragged(true)
    scrollRef.current.scrollLeft = scrollLeft - walk
  }

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 3 }).map((_, i) => {
      const date = new Date(currentDate)
      date.setDate(currentDate.getDate() + i)
      const dateString = date.toISOString().split('T')[0]
      const isToday = new Date().toISOString().split('T')[0] === dateString
      const shortName = date.toLocaleDateString(undefined, { weekday: 'short' })
      const dateNumber = date.getDate()
      return { date, dateString, isToday, shortName, dateNumber }
    })
  }, [currentDate])

  const dailySummary = useMemo(() => {
    const firstDayTasks = filteredTasks.filter(t => t.date === daysOfWeek[0].dateString)

    const productSummary = {}
    const employeeSummary = {}

    firstDayTasks.forEach(task => {
      // Product
      const pName = task.product ? task.product.name : (task.productionTask?.orderItem?.productName || 'Özel Üretim')
      const unit = task.product?.unit || 'adet'
      const qty = task.quantity || 0
      if (!productSummary[pName]) productSummary[pName] = { unit, open: 0, extrusion: 0, cutting: 0, completed: 0, total: 0 }
      if (productSummary[pName][task.status] !== undefined) productSummary[pName][task.status] += qty
      productSummary[pName].total += qty

      // Employee
      const empName = task.employee?.name || 'Atanmamış'
      if (!employeeSummary[empName]) employeeSummary[empName] = { open: 0, extrusion: 0, cutting: 0, completed: 0, totalTasks: 0 }
      if (employeeSummary[empName][task.status] !== undefined) employeeSummary[empName][task.status] += 1
      employeeSummary[empName].totalTasks += 1
    })

    return { productSummary, employeeSummary, dateStr: daysOfWeek[0].dateString }
  }, [filteredTasks, daysOfWeek])

  // Drag and Drop Tasks
  const [dragOverCell, setDragOverCell] = useState(null)
  
  // Note Modal for status change
  const [noteModal, setNoteModal] = useState(null) // { taskId, newStatus, newDate }
  const [noteText, setNoteText] = useState('')

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('text/plain', task.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, employeeId, dateStr) => {
    e.preventDefault()
    setDragOverCell(`${employeeId}_${dateStr}`)
  }

  const handleDragLeave = () => {
    setDragOverCell(null)
  }

  const handleDrop = async (e, targetStatus, targetDateStr) => {
    e.preventDefault()
    setDragOverCell(null)
    const taskId = e.dataTransfer.getData('text/plain')
    if (!taskId) return

    const task = myTasks.find(t => t.id === taskId)
    if (!task) return

    const todayStr = new Date().toISOString().split('T')[0]
    
    // Constraints: Employee cannot move to past.
    if (!canViewAll && targetDateStr < todayStr) {
      alert('Geçmiş tarihe görev taşıyamazsınız!')
      return
    }

    if (task.date === targetDateStr && task.status === targetStatus) return // no change
    
    if (task.status !== targetStatus) {
      // It's a status change, open note modal
      setNoteModal({ task, newStatus: targetStatus, newDate: targetDateStr })
      setNoteText('')
    } else {
      // Just date change
      try {
        await moveEmployeeTask(task.id, task.status, targetDateStr, null)
      } catch (err) {
        alert(err.message)
      }
    }
  }

  const promptStatusChange = (task, newStatus) => {
    if (task.status === newStatus) return
    setNoteModal({ task, newStatus, newDate: task.date })
    setNoteText('')
  }

  const submitNote = async () => {
    if (!noteText.trim()) {
      alert('Not girmek zorunludur!')
      return
    }
    try {
      await moveEmployeeTask(noteModal.task.id, noteModal.newStatus, noteModal.newDate, noteModal.noteText || noteText)
      setNoteModal(null)
    } catch (err) {
      alert(err.message)
    }
  }

  // Row Data: Statuses
  const rows = [
    { id: 'open', label: 'Açık Görevler', icon: 'pending_actions', color: 'text-slate-500' },
    { id: 'extrusion', label: 'Ekstrüzyonda', icon: 'precision_manufacturing', color: 'text-orange-500' },
    { id: 'cutting', label: 'Kesimde', icon: 'content_cut', color: 'text-purple-500' },
    { id: 'completed', label: 'Tamamlandı', icon: 'check_circle', color: 'text-green-500' }
  ]

  // New Task Modal
  const [newTaskModal, setNewTaskModal] = useState(false)
  const defaultForm = { title: '', employeeId: empId || '', machineId: '', productId: '', quantity: '', date: new Date().toISOString().split('T')[0], status: 'open' }
  const [newTaskForm, setNewTaskForm] = useState(defaultForm)

  // Detail Modal
  const [detailTask, setDetailTask] = useState(null)

  const handleCreateTask = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...newTaskForm,
        quantity: newTaskForm.quantity ? parseInt(newTaskForm.quantity) : 0
      }
      if (newTaskForm.id) {
        await updateEmployeeTask(newTaskForm.id, payload)
      } else {
        await createEmployeeTask(payload)
      }
      setNewTaskModal(false)
      setNewTaskForm(defaultForm)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDeleteTask = async (id) => {
    if (window.confirm('Bu görevi silmek istediğinize emin misiniz?')) {
      try {
        await deleteEmployeeTask(id)
        setDetailTask(null)
      } catch (err) {
        alert(err.message)
      }
    }
  }

  const handleEditTask = (task) => {
    setNewTaskForm({
      id: task.id,
      title: task.title,
      employeeId: task.employeeId || '',
      machineId: task.machineId || '',
      productId: task.productId || '',
      quantity: task.quantity || '',
      date: task.date,
      status: task.status
    })
    setDetailTask(null)
    setNewTaskModal(true)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-slate-500/5 dark:bg-slate-500/10 border-slate-300 dark:border-slate-700/60 text-slate-600 dark:text-slate-300'
      case 'extrusion': return 'bg-orange-500/5 dark:bg-orange-500/10 border-orange-400/60 dark:border-orange-700/60 text-orange-600 dark:text-orange-400'
      case 'cutting': return 'bg-purple-500/5 dark:bg-purple-500/10 border-purple-400/60 dark:border-purple-700/60 text-purple-600 dark:text-purple-400'
      case 'completed': return 'bg-green-500/5 dark:bg-green-500/10 border-green-400/60 dark:border-green-700/60 text-green-600 dark:text-green-400'
      default: return 'bg-slate-500/5 dark:bg-slate-500/10 border-slate-300 dark:border-slate-700/60 text-slate-600 dark:text-slate-300'
    }
  }
  const getStatusLabel = (status) => {
    switch (status) {
      case 'open': return 'Açık Görev'
      case 'extrusion': return 'Ekstrüzyonda'
      case 'cutting': return 'Kesimde'
      case 'completed': return 'Tamamlandı'
      default: return 'Açık Görev'
    }
  }

  return (
    <div className="p-3 md:p-6 lg:p-8 min-h-screen bg-page-bg">
      {/* Rollover Wizard */}
      {showRollover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-theme-border animate-in fade-in zoom-in duration-200 relative">
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 right-4 p-2 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors flex items-center justify-center z-10"
              title="Geri Dön"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="p-6 text-center pt-10">
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-orange-500">update</span>
              </div>
              <h2 className="text-2xl font-black text-on-surface mb-2">Eksik Görevler Tespit Edildi</h2>
              <p className="text-on-surface-variant mb-6">
                Geçmiş günlerden tamamlanmamış {rolloverTasks.length} adet göreviniz bulunuyor. Bu görevler bugüne devredilecektir.
              </p>
              <button
                onClick={handleRolloverConfirm}
                className="w-full bg-primary text-on-primary font-bold py-3 px-4 rounded-xl hover:bg-primary/90 transition-colors"
              >
                Görevleri Bugüne Taşı ve Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {noteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-theme-border">
            <div className="p-6 border-b border-theme-border">
              <h2 className="text-xl font-black text-on-surface">Durum Değişikliği Notu</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                {getStatusLabel(noteModal.task.status)} ➔ {getStatusLabel(noteModal.newStatus)}
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-bold text-on-surface-variant mb-2">Değişiklik Notu (Zorunlu)</label>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface focus:border-primary outline-none min-h-[100px]"
                placeholder="Neden durum değiştirdiğinizi yazın..."
              />
            </div>
            <div className="p-6 pt-0 flex gap-3 justify-end">
              <button onClick={() => setNoteModal(null)} className="px-4 py-2 font-bold text-on-surface-variant hover:bg-surface-container rounded-xl">İptal</button>
              <button onClick={submitNote} className="px-4 py-2 font-bold bg-primary text-on-primary rounded-xl">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {detailTask && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-theme-border flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-theme-border flex justify-between items-center bg-surface-container-low/30 sticky top-0">
              <h2 className="text-xl font-black text-on-surface">Görev Detayı</h2>
              <button onClick={() => setDetailTask(null)} className="text-on-surface-variant hover:text-error transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Görev Başlığı</p>
                <p className="text-base font-bold text-on-surface">{detailTask.title}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Ürün / Malzeme</p>
                  <p className="text-sm font-bold text-on-surface">{detailTask.product?.name || (detailTask.order?.code ? 'Siparişe Özel' : 'Belirtilmedi')}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Miktar</p>
                  <p className="text-sm font-bold text-on-surface">{detailTask.quantity || 0}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Statü</p>
                  <p className="text-sm font-bold text-on-surface">{getStatusLabel(detailTask.status)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Tarih</p>
                  <p className="text-sm font-bold text-on-surface">{detailTask.date.split('-').reverse().join('.')}</p>
                </div>
                {detailTask.employee && (
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Personel</p>
                    <p className="text-sm font-bold text-on-surface">{detailTask.employee.name}</p>
                  </div>
                )}
                {detailTask.machine && (
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Makine</p>
                    <p className="text-sm font-bold text-on-surface">{detailTask.machine.name}</p>
                  </div>
                )}
                
                {canViewAll && (detailTask.order || detailTask.productionTask) && (() => {
                  const linkedOrder = detailTask.order || detailTask.productionTask?.orderItem?.order;
                  return (
                    <div className="col-span-2 p-4 bg-primary/5 border border-primary/20 rounded-xl mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[16px] text-primary">link</span>
                        <p className="text-xs font-bold text-primary uppercase tracking-wider">Bağlantılı Sipariş / Üretim Planı</p>
                      </div>
                      {linkedOrder?.code ? (
                        <p 
                          onClick={() => {
                            setDetailTask(null);
                            if (detailTask.productionTask) {
                              navigate('/production-tasks', { state: { openTaskId: detailTask.productionTask.id } });
                            } else {
                              navigate('/orders');
                            }
                          }}
                          className="text-sm font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                        >
                          Sipariş: {linkedOrder.code} {linkedOrder.customer?.name ? `(${linkedOrder.customer.name})` : ''}
                        </p>
                      ) : detailTask.productionTask?.code ? (
                        <p 
                          onClick={() => {
                            setDetailTask(null);
                            navigate('/production-tasks', { state: { openTaskId: detailTask.productionTask.id } });
                          }}
                          className="text-sm font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                        >
                          Stok Üretim Planı: {detailTask.productionTask.code}
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-on-surface">
                          Siparişe Bağlı Olmayan Planlama
                        </p>
                      )}
                      {detailTask.productionTask && (
                        <p className="text-[11px] font-medium text-text-muted mt-1.5 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">info</span>
                          Üretim Planlama sekmesinden gönderilmiş görev.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {canViewAll && detailTask.taskNotes && detailTask.taskNotes.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Statü Değişiklik Notları</p>
                  <div className="flex flex-col gap-3">
                    {detailTask.taskNotes.map(note => (
                      <div key={note.id} className="bg-surface-container p-4 rounded-xl border border-theme-border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/5 text-on-surface-variant">
                            {getStatusLabel(note.fromStatus)} ➔ {getStatusLabel(note.toStatus)}
                          </span>
                          <span className="text-[10px] font-bold text-on-surface-variant">
                            {new Date(note.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-on-surface">{note.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-theme-border flex justify-between bg-surface-container-low/30 sticky bottom-0">
              <div className="flex gap-2">
                {canEdit && (
                  <button
                    onClick={() => handleEditTask(detailTask)}
                    className="px-4 py-2 bg-surface-container hover:bg-black/5 dark:hover:bg-white/5 text-on-surface font-bold rounded-xl text-sm transition-colors flex items-center gap-2 border border-theme-border"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Düzenle
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteTask(detailTask.id)}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold rounded-xl text-sm transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    Sil
                  </button>
                )}
              </div>
              <button
                onClick={() => setDetailTask(null)}
                className="px-6 py-2 bg-primary text-on-primary font-bold rounded-xl text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {newTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-theme-border">
            <div className="p-6 border-b border-theme-border flex justify-between items-center">
              <h2 className="text-xl font-black text-on-surface">{newTaskForm.id ? 'Görevi Düzenle' : 'Yeni Görev Oluştur'}</h2>
              <button onClick={() => { setNewTaskModal(false); setNewTaskForm(defaultForm); }} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Görev Başlığı / Açıklama</label>
                <input required type="text" value={newTaskForm.title} onChange={e => setNewTaskForm({...newTaskForm, title: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Ürün / Malzeme</label>
                  <select value={newTaskForm.productId} onChange={e => setNewTaskForm({...newTaskForm, productId: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface outline-none">
                    <option value="">Seçiniz... (Opsiyonel)</option>
                    {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Miktar</label>
                  <input required type="number" min="1" value={newTaskForm.quantity} onChange={e => setNewTaskForm({...newTaskForm, quantity: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Tarih</label>
                <input required type="date" value={newTaskForm.date} onChange={e => setNewTaskForm({...newTaskForm, date: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface outline-none" />
              </div>
              {canViewAll && (
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Personel</label>
                  <select required value={newTaskForm.employeeId} onChange={e => setNewTaskForm({...newTaskForm, employeeId: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface outline-none">
                    <option value="">Seçiniz...</option>
                    {employees.filter(e => e.status === 'Active').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Makine (Opsiyonel)</label>
                <select value={newTaskForm.machineId} onChange={e => setNewTaskForm({...newTaskForm, machineId: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface outline-none">
                  <option value="">Yok</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Başlangıç Statüsü</label>
                <select value={newTaskForm.status} onChange={e => setNewTaskForm({...newTaskForm, status: e.target.value})} className="w-full bg-surface-container p-3 rounded-xl border border-theme-border text-on-surface outline-none">
                  <option value="open">Açık Görev</option>
                  <option value="extrusion">Ekstrüzyonda</option>
                  <option value="cutting">Kesimde</option>
                  <option value="completed">Tamamlandı</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-primary text-on-primary font-bold py-3 rounded-xl mt-2">{newTaskForm.id ? 'Kaydet' : 'Oluştur'}</button>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
            Personel Görev Takibi
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {canViewAll ? 'Tüm personellerin günlük görevleri' : 'Günlük görevleriniz'}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setNewTaskForm(defaultForm); setNewTaskModal(true); }} className="bg-primary text-on-primary px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Yeni Görev
          </button>
        )}
      </div>

      {/* Daily Summary */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Product Summary */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-theme-border shadow-sm flex flex-col">
          <h3 className="text-sm font-black text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">inventory_2</span>
            {fmtDate(dailySummary.dateStr)} - Üretim Özeti
          </h3>
          {Object.keys(dailySummary.productSummary).length === 0 ? (
            <p className="text-xs text-text-muted">Bu gün için kayıtlı görev yok.</p>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
              {Object.entries(dailySummary.productSummary).map(([pName, data]) => (
                <div key={pName} className="flex flex-col gap-1.5 border-b border-theme-border last:border-0 pb-2 last:pb-0">
                  <span className="text-xs font-bold text-on-surface truncate" title={pName}>{pName}</span>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    {data.open > 0 && <span className="text-slate-500">Açık: {data.open} {data.unit}</span>}
                    {data.extrusion > 0 && <span className="text-orange-500">Eks: {data.extrusion} {data.unit}</span>}
                    {data.cutting > 0 && <span className="text-purple-500">Kesim: {data.cutting} {data.unit}</span>}
                    {data.completed > 0 && <span className="text-green-500">Biten: {data.completed} {data.unit}</span>}
                    <span className="ml-auto text-primary px-1.5 py-0.5 bg-primary/10 rounded">Top: {data.total} {data.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Employee Summary */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-theme-border shadow-sm flex flex-col">
          <h3 className="text-sm font-black text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">engineering</span>
            Personel Başarım Özeti
          </h3>
          {Object.keys(dailySummary.employeeSummary).length === 0 ? (
            <p className="text-xs text-text-muted">Bu gün için atanan personel yok.</p>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
              {Object.entries(dailySummary.employeeSummary).map(([empName, data]) => (
                <div key={empName} className="flex flex-col gap-1.5 border-b border-theme-border last:border-0 pb-2 last:pb-0">
                  <span className="text-xs font-bold text-on-surface truncate" title={empName}>{empName}</span>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    {data.open > 0 && <span className="text-slate-500 px-1.5 py-0.5 bg-slate-500/10 rounded">Açık: {data.open}</span>}
                    {data.extrusion > 0 && <span className="text-orange-500 px-1.5 py-0.5 bg-orange-500/10 rounded">Eks: {data.extrusion}</span>}
                    {data.cutting > 0 && <span className="text-purple-500 px-1.5 py-0.5 bg-purple-500/10 rounded">Kesim: {data.cutting}</span>}
                    {data.completed > 0 && <span className="text-green-500 px-1.5 py-0.5 bg-green-500/10 rounded">Biten: {data.completed}</span>}
                    <span className="ml-auto text-on-surface-variant font-black">Top: {data.totalTasks} Görev</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Employee Filter */}
      {(canViewAll || (employees && employees.length > 0)) && (
        <div className="mb-4 flex items-center justify-end">
          <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-theme-border shadow-sm">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">filter_list</span>
            <span className="text-xs font-bold text-on-surface-variant">Personel:</span>
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold text-on-surface cursor-pointer focus:ring-0"
            >
              <option value="">Tümü</option>
              {(canViewAll ? employees : employees?.filter(e => e.id === empId))?.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Calendar Navigation */}
      <div className="flex items-center gap-2 bg-surface-container-lowest p-2 rounded-xl border border-theme-border shadow-sm w-full mb-4 md:mb-6">
        <button
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 3))}
          className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>

        <div
          className="relative flex items-center justify-center flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => dateInputRef.current?.showPicker()}
        >
          <div className="font-extrabold text-sm md:text-base text-on-surface flex items-center justify-center gap-2 pointer-events-none whitespace-nowrap">
            <span className="material-symbols-outlined text-[18px] md:text-[20px] text-primary">calendar_month</span>
            {daysOfWeek[0].dateNumber} {daysOfWeek[0].date.toLocaleDateString(undefined, { month: 'short' })} - {daysOfWeek[2].dateNumber} {daysOfWeek[2].date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          </div>
          <input
            ref={dateInputRef}
            type="date"
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            value={currentDate.toISOString().split('T')[0]}
            onChange={(e) => {
              if (e.target.value) setCurrentDate(new Date(e.target.value))
            }}
          />
        </div>

        <button
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 3))}
          className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-surface-container-lowest border border-theme-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div
          ref={scrollRef}
          className="overflow-auto hide-scrollbar select-none max-h-[calc(100vh-220px)]"
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onClickCapture={(e) => {
            if (hasDragged) {
              e.stopPropagation()
              e.preventDefault()
            }
          }}
        >
          <div className="min-w-[1000px]">
            {/* Header: Days */}
            <div className="grid grid-cols-[180px_repeat(3,minmax(0,1fr))] border-b border-theme-border bg-surface-container-low/30 sticky top-0 z-10">
              <div className="p-3 border-r border-theme-border flex items-center justify-center">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Aşama</span>
              </div>
              {daysOfWeek.map(day => (
                <div key={day.dateString} className={`p-3 border-r border-theme-border last:border-r-0 text-center flex flex-col items-center justify-center gap-1 ${day.isToday ? 'bg-primary/5' : ''}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${day.isToday ? 'text-primary' : 'text-on-surface-variant'}`}>{day.shortName}</span>
                  <span className={`text-xl font-black ${day.isToday ? 'text-primary' : 'text-on-surface'}`}>{day.dateNumber}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col relative">
              {rows.map(row => (
                <div key={row.id} className="grid grid-cols-[180px_repeat(3,minmax(0,1fr))] border-b border-theme-border last:border-b-0 group">
                  <div className="p-3 flex flex-col items-center justify-center border-r border-theme-border bg-surface-container-low/10 sticky left-0 z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 bg-surface-container ${row.color}`}>
                      <span className="material-symbols-outlined">{row.icon}</span>
                    </div>
                    <span className="text-xs font-bold text-on-surface text-center px-1 truncate w-full">{row.label}</span>
                  </div>
                  
                  {daysOfWeek.map(day => {
                    const cellKey = `${row.id}_${day.dateString}`
                    const isDragOver = dragOverCell === cellKey
                    const dayTasks = filteredTasks.filter(t => t.status === row.id && t.date === day.dateString)
                    
                    return (
                      <div 
                        key={day.dateString} 
                        onDragOver={(e) => handleDragOver(e, row.id, day.dateString)}
                        onDragEnter={(e) => handleDragOver(e, row.id, day.dateString)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, row.id, day.dateString)}
                        className={`p-3 min-h-[120px] border-r border-theme-border last:border-r-0 flex flex-col gap-2 
                          ${day.isToday ? 'bg-primary/[0.02]' : ''} 
                          ${isDragOver ? 'bg-primary/10 border-dashed border-primary' : 'hover:bg-surface-container-low/30'} 
                          transition-all cursor-pointer`}
                      >
                        {dayTasks.map(task => (
                          <div 
                            key={task.id} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, task)}
                            onClick={() => setDetailTask(task)}
                            className={`task-card rounded-xl p-3 shadow-sm border transition-all ${getStatusColor(task.status)} cursor-grab active:cursor-grabbing hover:shadow-md`}
                          >
                            <div className="flex flex-col gap-2 relative">
                              <div className="flex items-start justify-between">
                                <p className="text-sm font-extrabold leading-tight pr-6">{task.title}</p>
                                {/* Status changer dot menu or click to change status */}
                                <div className="absolute top-0 right-0 group/menu">
                                  <button onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-black/10 transition-colors text-inherit">
                                    <span className="material-symbols-outlined text-[16px]">more_vert</span>
                                  </button>
                                  <div className="absolute right-0 top-full mt-1 bg-surface border border-theme-border rounded-xl shadow-lg p-1 hidden group-hover/menu:flex flex-col min-w-[140px] z-20">
                                    <button onClick={(e) => { e.stopPropagation(); promptStatusChange(task, 'open'); }} className="text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-500/10 rounded-lg">Açık Görev</button>
                                    <button onClick={(e) => { e.stopPropagation(); promptStatusChange(task, 'extrusion'); }} className="text-left px-3 py-2 text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 rounded-lg">Ekstrüzyonda</button>
                                    <button onClick={(e) => { e.stopPropagation(); promptStatusChange(task, 'cutting'); }} className="text-left px-3 py-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 rounded-lg">Kesimde</button>
                                    <button onClick={(e) => { e.stopPropagation(); promptStatusChange(task, 'completed'); }} className="text-left px-3 py-2 text-xs font-bold text-green-600 dark:text-green-400 hover:bg-green-500/10 rounded-lg">Tamamlandı</button>
                                  </div>
                                </div>
                              </div>
                              
                              {(task.product || task.quantity > 0) && (
                                <div className="flex items-center gap-1.5 opacity-90 mt-1">
                                  <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                                  <span className="text-xs font-bold truncate">
                                    {task.product ? task.product.name : 'Özel Üretim'}
                                  </span>
                                </div>
                              )}

                              {canViewAll && task.employee && (
                                <div className="flex items-center gap-1.5 opacity-80">
                                  <span className="material-symbols-outlined text-[14px]">person</span>
                                  <span className="text-[11px] font-medium">{task.employee.name}</span>
                                </div>
                              )}

                              <div className="flex items-end justify-between mt-1 min-h-[24px]">
                                <div className="flex flex-wrap items-center gap-2">
                                  {task.machine && (
                                    <span className="text-[10px] font-bold opacity-80 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[12px]">precision_manufacturing</span>
                                      {task.machine.name}
                                    </span>
                                  )}
                                  {canViewAll && task.order && (
                                    <span className="text-[10px] font-bold opacity-80 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[12px]">receipt</span>
                                      {task.order.customer?.name.substring(0,10)}...
                                    </span>
                                  )}
                                </div>
                                
                                {(task.quantity > 0) && (
                                  <div className="text-xs font-black px-2 py-1 bg-primary text-on-primary rounded-lg shadow-sm whitespace-nowrap ml-2">
                                    {task.quantity} {task.product?.unit || 'adet'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
