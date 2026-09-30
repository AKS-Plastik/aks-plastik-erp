import { useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function ProductionPlanning() {
  const { t } = useTranslation()
  const { productionTasks, employees, machines } = useData()
  const { dark } = useTheme()

  const [currentDate, setCurrentDate] = useState(new Date())
  const dateInputRef = useRef(null)
  const scrollRef = useRef(null)

  // Drag to scroll logic
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)
  const [activeTab, setActiveTab] = useState('Extrusion') // 'Extrusion' or 'Cutting'

  const handleMouseDown = (e) => {
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

  const extrusionMachines = useMemo(() => {
    if (!machines) return []
    return machines.filter(m => m.type === 'Extrusion' || !m.type || m.type === 'General')
  }, [machines])

  const cuttingMachines = useMemo(() => {
    if (!machines) return []
    return machines.filter(m => m.type === 'Cutting' || !m.type || m.type === 'General')
  }, [machines])

  return (
    <div className="p-3 md:p-6 lg:p-8 min-h-screen bg-page-bg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
            {t('nav.productionPlanning', 'Üretim Planlama')}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Günlük üretim yükü ve planlaması
          </p>
        </div>
      </div>

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
            <div className="grid grid-cols-[140px_repeat(3,minmax(0,1fr))] border-b border-theme-border bg-surface-container-low/30 sticky top-0 z-10">
              <div className="p-3 border-r border-theme-border flex items-center justify-center">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Makineler</span>
              </div>
              {daysOfWeek.map(day => (
                <div key={day.dateString} className={`p-3 border-r border-theme-border last:border-r-0 text-center flex flex-col items-center justify-center gap-1 ${day.isToday ? 'bg-primary/5' : ''}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${day.isToday ? 'text-primary' : 'text-on-surface-variant'}`}>{day.shortName}</span>
                  <span className={`text-xl font-black ${day.isToday ? 'text-primary' : 'text-on-surface'}`}>{day.dateNumber}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col relative">
              
              {/* SECTION: Açık Görevler */}
              <div className="grid grid-cols-[140px_repeat(3,minmax(0,1fr))] border-b border-theme-border bg-surface-container-low/10">
                <div className="p-3 flex flex-col items-center justify-center border-r border-theme-border sticky left-0 z-10 bg-surface-container-low/10">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-xl">pending_actions</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface text-center px-1 truncate w-full">Açık Görevler</span>
                </div>
                {daysOfWeek.map(day => {
                  const tasks = productionTasks.filter(t => t.status === 'open' && t.date === day.dateString)
                  return (
                    <div key={day.dateString} className={`p-2 min-h-[120px] border-r border-theme-border last:border-r-0 flex flex-col gap-2 ${day.isToday ? 'bg-primary/[0.02]' : 'hover:bg-surface-container-low/30'} transition-colors cursor-pointer`}>
                      {tasks.map(task => (
                        <div key={task.id} className="bg-surface-container rounded-xl p-2.5 shadow-sm border border-theme-border/50 hover:border-primary/50 transition-colors">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-on-surface-variant truncate">{task.code}</span>
                          </div>
                          <p className="text-xs font-extrabold text-on-surface mb-0.5 line-clamp-2 leading-tight">
                            {task.product?.name || task.orderItem?.productName || 'Ürün Belirtilmedi'}
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded w-max">
                            {task.quantity} kg
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>

              {/* SECTION: Extrusion Header */}
              <div className="grid grid-cols-[140px_1fr] border-b border-theme-border bg-surface-container-high/50 sticky left-0">
                <div className="p-2 border-r border-theme-border" />
                <div className="p-2 text-xs font-extrabold text-on-surface uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary">precision_manufacturing</span>
                  Extrüzyon Makineleri
                </div>
              </div>

              {/* SECTION: Extrusion Machines */}
              {extrusionMachines.map(machine => (
                <div key={machine.id} className="grid grid-cols-[140px_repeat(3,minmax(0,1fr))] border-b border-theme-border last:border-b-0 group">
                  <div className="p-3 flex flex-col items-center justify-center border-r border-theme-border bg-surface-container-low/10 sticky left-0 z-10">
                    <span className="text-xs font-bold text-on-surface text-center px-1 truncate w-full">{machine.name}</span>
                  </div>
                  {daysOfWeek.map(day => {
                    const tasks = productionTasks.filter(t => t.status === 'extrusion' && t.machineId === machine.id && t.date === day.dateString)
                    return (
                      <div key={day.dateString} className={`p-2 min-h-[120px] border-r border-theme-border last:border-r-0 flex flex-col gap-2 ${day.isToday ? 'bg-primary/[0.02]' : 'hover:bg-surface-container-low/30'} transition-colors cursor-pointer`}>
                        {tasks.map(task => (
                          <div key={task.id} className="bg-surface-container rounded-xl p-2.5 shadow-sm border border-theme-border/50 hover:border-primary/50 transition-colors">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                              <span className="text-[10px] font-bold text-on-surface-variant truncate">{task.code}</span>
                            </div>
                            <p className="text-xs font-extrabold text-on-surface mb-0.5 line-clamp-2 leading-tight">
                              {task.product?.name || task.orderItem?.productName || 'Ürün Belirtilmedi'}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {task.quantity} kg
                              </div>
                              {task.operator && (
                                <div className="flex items-center gap-1 text-[9px] text-on-surface-variant font-medium max-w-[50%]">
                                  <span className="material-symbols-outlined text-[11px]">person</span>
                                  <span className="truncate">{task.operator.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* SECTION: Cutting Header */}
              <div className="grid grid-cols-[140px_1fr] border-b border-theme-border bg-surface-container-high/50 sticky left-0 mt-4">
                <div className="p-2 border-r border-theme-border" />
                <div className="p-2 text-xs font-extrabold text-on-surface uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-secondary">content_cut</span>
                  Kesim Makineleri (Cutter)
                </div>
              </div>

              {/* SECTION: Cutting Machines */}
              {cuttingMachines.map(machine => (
                <div key={machine.id} className="grid grid-cols-[140px_repeat(3,minmax(0,1fr))] border-b border-theme-border last:border-b-0 group">
                  <div className="p-3 flex flex-col items-center justify-center border-r border-theme-border bg-surface-container-low/10 sticky left-0 z-10">
                    <span className="text-xs font-bold text-on-surface text-center px-1 truncate w-full">{machine.name}</span>
                  </div>
                  {daysOfWeek.map(day => {
                    const tasks = productionTasks.filter(t => t.status === 'cutting' && t.machineId === machine.id && t.date === day.dateString)
                    return (
                      <div key={day.dateString} className={`p-2 min-h-[120px] border-r border-theme-border last:border-r-0 flex flex-col gap-2 ${day.isToday ? 'bg-primary/[0.02]' : 'hover:bg-surface-container-low/30'} transition-colors cursor-pointer`}>
                        {tasks.map(task => (
                          <div key={task.id} className="bg-surface-container rounded-xl p-2.5 shadow-sm border border-theme-border/50 hover:border-primary/50 transition-colors">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                              <span className="text-[10px] font-bold text-on-surface-variant truncate">{task.code}</span>
                            </div>
                            <p className="text-xs font-extrabold text-on-surface mb-0.5 line-clamp-2 leading-tight">
                              {task.product?.name || task.orderItem?.productName || 'Ürün Belirtilmedi'}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {task.quantity} kg
                              </div>
                              {task.operator && (
                                <div className="flex items-center gap-1 text-[9px] text-on-surface-variant font-medium max-w-[50%]">
                                  <span className="material-symbols-outlined text-[11px]">person</span>
                                  <span className="truncate">{task.operator.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* SECTION: Tamamlandı Header */}
              <div className="grid grid-cols-[140px_1fr] border-b border-theme-border bg-surface-container-high/50 sticky left-0 mt-4">
                <div className="p-2 border-r border-theme-border" />
                <div className="p-2 text-xs font-extrabold text-on-surface uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-green-500">done_all</span>
                  Tamamlandı
                </div>
              </div>

              {/* SECTION: Completed Tasks */}
              <div className="grid grid-cols-[140px_repeat(7,minmax(0,1fr))] border-b border-theme-border bg-surface-container-low/10">
                <div className="p-3 flex flex-col items-center justify-center border-r border-theme-border sticky left-0 z-10 bg-surface-container-low/10">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-xl">check_circle</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface text-center px-1 truncate w-full">Tamamlanan</span>
                </div>
                {daysOfWeek.map(day => {
                  const tasks = productionTasks.filter(t => t.status === 'completed' && t.date === day.dateString)
                  return (
                    <div key={day.dateString} className={`p-2 min-h-[120px] border-r border-theme-border last:border-r-0 flex flex-col gap-2 ${day.isToday ? 'bg-primary/[0.02]' : 'hover:bg-surface-container-low/30'} transition-colors cursor-pointer`}>
                      {tasks.map(task => (
                        <div key={task.id} className="bg-surface-container rounded-xl p-2.5 shadow-sm border border-theme-border/50 hover:border-primary/50 transition-colors">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-[10px] font-bold text-on-surface-variant truncate">{task.code}</span>
                          </div>
                          <p className="text-xs font-extrabold text-on-surface mb-0.5 line-clamp-2 leading-tight">
                            {task.product?.name || task.orderItem?.productName || 'Ürün Belirtilmedi'}
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded w-max">
                            {task.quantity} kg
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

