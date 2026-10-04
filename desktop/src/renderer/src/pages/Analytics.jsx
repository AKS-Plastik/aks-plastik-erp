import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../config'
import * as XLSX from 'xlsx'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'

export default function Analytics() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const { permissions, employeePermissions, user } = useData()
  
  const empId = user?.employeeId
  const dept = user?.department
  
  const canSee = (page) => {
    if (isAdmin) return true
    const isEmpDenied = (employeePermissions?.[empId] || []).includes(`-${page}`)
    if (isEmpDenied) return false
    const hasRolePerm = (permissions?.[dept] || []).includes(page)
    const hasEmpPerm = (employeePermissions?.[empId] || []).includes(page)
    return hasRolePerm || hasEmpPerm
  }

  const [activeModal, setActiveModal] = useState(null) // 'production', 'sales', 'visits'

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto min-h-screen pb-24 md:pb-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-on-surface">
          Raporlar
        </h1>
        <p className="text-on-surface-variant text-xs md:text-sm lg:text-base mt-1">
          Uygulama içi üretim, satış ve saha ziyaret analizleri.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Production Card */}
        {(canSee('reports_production') || isAdmin) && (
          <div 
            onClick={() => setActiveModal('production')}
            className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-low shadow-sm cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all flex flex-col gap-4 group"
          >
            <div className="w-12 h-12 primary-gradient rounded-xl flex items-center justify-center text-white shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-2xl">precision_manufacturing</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">Üretim Raporları</h3>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Operatör performansları, makine kullanımı, fire oranları ve günlük özet analizleri.
              </p>
            </div>
          </div>
        )}

        {/* Sales Card */}
        {(canSee('reports_sales') || isAdmin) && (
          <div 
            onClick={() => setActiveModal('sales')}
            className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-low shadow-sm cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all flex flex-col gap-4 group"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-700 rounded-xl flex items-center justify-center text-white shadow-md shadow-green-500/20 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-2xl">point_of_sale</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">Satış Raporları</h3>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Temsilci bazlı ciro grafikleri, tamamlanan sipariş eğrileri ve gelir özetleri.
              </p>
            </div>
          </div>
        )}

        {/* Site Visits Card */}
        {(canSee('reports_site_visits') || isAdmin) && (
          <div 
            onClick={() => setActiveModal('visits')}
            className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-low shadow-sm cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all flex flex-col gap-4 group"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-2xl">location_on</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">Saha Ziyareti Raporları</h3>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Satış personeli ziyaret metrikleri ve müşteri kazanım durumu analizleri.
              </p>
            </div>
          </div>
        )}
      </div>

      {activeModal === 'production' && <ProductionReportModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'sales' && <SalesReportModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'visits' && <VisitsReportModal onClose={() => setActiveModal(null)} />}
    </div>
  )
}

function ProductionReportModal({ onClose }) {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('month') // today, week, month, year, all

  useEffect(() => {
    setLoading(true)
    fetch(`${API_URL}/analytics/production?filter=${filter}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filter, token])

  const handleExport = () => {
    if (!data) return
    const wb = XLSX.utils.book_new()

    // 1. Günlük Trend
    if (data.trend && data.trend.length > 0) {
      const wsTrend = XLSX.utils.json_to_sheet(data.trend.map(d => ({
        'Tarih': d.date,
        'Tamamlanan Görev': d.totalCompletedTasks,
        'Toplam Üretim (Miktar)': d.totalQuantity
      })))
      XLSX.utils.book_append_sheet(wb, wsTrend, 'Günlük Trend')
    }

    // 2. Operatör Özeti
    if (data.metrics?.byOperator) {
      const opData = Object.entries(data.metrics.byOperator).map(([op, m]) => ({
        'Operatör': op,
        'Tamamlanan Görev': m.tasksCompleted,
        'Kesimde Kalan Görev': m.tasksCutting,
        'Ekstrüzyonda Kalan Görev': m.tasksExtrusion,
        'Açık Kalan Görev': m.tasksOpen
      }))
      if (opData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opData), 'Operatör Özeti')
      }
    }

    // 3. Ürün Özeti
    if (data.metrics?.byProduct) {
      const prodData = Object.entries(data.metrics.byProduct).map(([prod, pDetail]) => ({
        'Ürün': prod,
        'Birim': pDetail.unit,
        'Tamamlanan Miktar': pDetail.completed || 0,
        'Kesimde Bekleyen': pDetail.cutting || 0,
        'Ekstrüzyonda Bekleyen': pDetail.extrusion || 0,
        'Açık Bekleyen': pDetail.open || 0
      }))
      if (prodData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodData), 'Ürün Özeti')
      }
    }

    XLSX.writeFile(wb, 'Uretim_Raporu.xlsx')
  }

  const renderQuantities = (quantities) => {
    if (!quantities || Object.keys(quantities).length === 0) return '0 Miktar';
    return Object.entries(quantities).map(([unit, val]) => `${val.toLocaleString()} ${unit}`).join(' | ');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-3xl shadow-2xl shadow-inverse-surface/20 w-[95%] md:w-[90%] lg:w-[85%] h-[90vh] flex flex-col mx-4 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-surface-container-low shrink-0 bg-surface-container-lowest">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 primary-gradient rounded-xl flex items-center justify-center text-white">
              <span className="material-symbols-outlined">precision_manufacturing</span>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-on-surface">Üretim Raporu Detayları</h2>
              <p className="text-[10px] md:text-xs text-on-surface-variant">Geçmişe dönük üretim özetleri ve detaylar.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-surface-container border border-theme-border rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none"
            >
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
              <option value="all">Tüm Zamanlar</option>
            </select>
            <button onClick={handleExport} className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-bold text-xs flex items-center gap-2 transition-colors">
              <span className="material-symbols-outlined text-[16px]">download</span> Excel
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-surface-container/30">
          {loading || !data ? (
            <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span></div>
          ) : (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-low shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Toplam Görev</p>
                  <p className="text-2xl font-black text-on-surface mt-1">{data.totalTasks || 0}</p>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-low shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Açık Bekleyen</p>
                  <p className="text-2xl font-black text-on-surface mt-1">{data.metrics?.byStatus?.open?.tasks || 0} Görev</p>
                  <p className="text-xs text-on-surface-variant mt-1">{renderQuantities(data.metrics?.byStatus?.open?.quantities)}</p>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-low shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Ekstrüzyonda Kalan</p>
                  <p className="text-2xl font-black text-on-surface mt-1">{data.metrics?.byStatus?.extrusion?.tasks || 0} Görev</p>
                  <p className="text-xs text-on-surface-variant mt-1">{renderQuantities(data.metrics?.byStatus?.extrusion?.quantities)}</p>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-low shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Kesimde Kalan</p>
                  <p className="text-2xl font-black text-on-surface mt-1">{data.metrics?.byStatus?.cutting?.tasks || 0} Görev</p>
                  <p className="text-xs text-on-surface-variant mt-1">{renderQuantities(data.metrics?.byStatus?.cutting?.quantities)}</p>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-low shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Tamamlanan</p>
                  <p className="text-2xl font-black text-on-surface mt-1">{data.metrics?.byStatus?.completed?.tasks || 0} Görev</p>
                  <p className="text-xs text-on-surface-variant mt-1">{renderQuantities(data.metrics?.byStatus?.completed?.quantities)}</p>
                </div>
              </div>

              {/* Chart */}
              {data.trend && data.trend.length > 0 && (
                <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-surface-container-low shadow-sm h-[300px] w-full">
                  <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">Günlük İşlem Trendi (Tüm Aşamalar)</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" tick={{fontSize: 10}} stroke="#888" />
                      <YAxis tick={{fontSize: 10}} stroke="#888" />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="totalQuantity" stroke="#2563eb" strokeWidth={3} dot={{r:4}} activeDot={{r:6}} name="Miktar (Tümü)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Detailed Tables */}
              {data.metrics && (
                <div className="grid grid-cols-1 gap-6">
                  {/* Operators */}
                  <div className="bg-surface-container-lowest rounded-xl border border-surface-container-low overflow-hidden">
                    <div className="bg-surface-container-low px-4 py-3 border-b border-surface-container-low">
                      <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Operatör Bazlı İşlem Özeti</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-container text-on-surface-variant">
                          <tr>
                            <th className="px-4 py-2 font-medium">Operatör</th>
                            <th className="px-4 py-2 font-medium text-center">Tamamlanan Görev</th>
                            <th className="px-4 py-2 font-medium text-center">Kesimde Kalan Görev</th>
                            <th className="px-4 py-2 font-medium text-center">Ekstrüzyonda Kalan Görev</th>
                            <th className="px-4 py-2 font-medium text-center">Açık Kalan Görev</th>
                            <th className="px-4 py-2 font-medium">Ürün Detayları (Aşama Miktarları)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container">
                          {Object.entries(data.metrics.byOperator || {}).map(([op, m]) => (
                            <tr key={op} className="hover:bg-surface-container-lowest/50">
                              <td className="px-4 py-3 font-bold align-top">{op}</td>
                              <td className="px-4 py-3 text-center align-top">{m.tasksCompleted}</td>
                              <td className="px-4 py-3 text-center align-top">{m.tasksCutting}</td>
                              <td className="px-4 py-3 text-center align-top">{m.tasksExtrusion}</td>
                              <td className="px-4 py-3 text-center align-top">{m.tasksOpen}</td>
                              <td className="px-4 py-3">
                                <ul className="space-y-1">
                                  {Object.entries(m.productDetails || {}).map(([prod, pDetail]) => (
                                    <li key={prod} className="text-on-surface-variant border-b border-theme-border/50 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
                                      <span className="font-bold text-on-surface">{prod}:</span> 
                                      {pDetail.completed > 0 && <span className="ml-2 font-bold text-green-600">Tamamlanan: {pDetail.completed.toLocaleString()} {pDetail.unit}</span>}
                                      {pDetail.cutting > 0 && <span className="ml-2 font-bold text-purple-600">Kesimde: {pDetail.cutting.toLocaleString()} {pDetail.unit}</span>}
                                      {pDetail.extrusion > 0 && <span className="ml-2 font-bold text-blue-600">Ekstrüzyonda: {pDetail.extrusion.toLocaleString()} {pDetail.unit}</span>}
                                      {pDetail.open > 0 && <span className="ml-2 font-bold text-orange-600">Açık: {pDetail.open.toLocaleString()} {pDetail.unit}</span>}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          ))}
                          {Object.keys(data.metrics.byOperator || {}).length === 0 && (
                            <tr><td colSpan="5" className="px-4 py-4 text-center text-on-surface-variant">Veri yok</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Products */}
                  <div className="bg-surface-container-lowest rounded-xl border border-surface-container-low overflow-hidden">
                    <div className="bg-surface-container-low px-4 py-3 border-b border-surface-container-low">
                      <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Ürün Bazlı İşlem Özeti</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-container text-on-surface-variant">
                          <tr>
                            <th className="px-4 py-2 font-medium">Ürün</th>
                            <th className="px-4 py-2 font-medium text-right text-green-700">Tamamlanan Miktar</th>
                            <th className="px-4 py-2 font-medium text-right text-purple-700">Kesimde Bekleyen Miktar</th>
                            <th className="px-4 py-2 font-medium text-right text-blue-700">Ekstrüzyonda Bekleyen Miktar</th>
                            <th className="px-4 py-2 font-medium text-right text-orange-700">Açık Bekleyen Miktar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container">
                          {Object.entries(data.metrics.byProduct || {}).map(([prod, pDetail]) => (
                            <tr key={prod} className="hover:bg-surface-container-lowest/50">
                              <td className="px-4 py-2 font-bold">{prod} <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant ml-2">{pDetail.unit}</span></td>
                              <td className="px-4 py-2 text-right">{(pDetail.completed || 0).toLocaleString()} {pDetail.unit}</td>
                              <td className="px-4 py-2 text-right">{(pDetail.cutting || 0).toLocaleString()} {pDetail.unit}</td>
                              <td className="px-4 py-2 text-right">{(pDetail.extrusion || 0).toLocaleString()} {pDetail.unit}</td>
                              <td className="px-4 py-2 text-right">{(pDetail.open || 0).toLocaleString()} {pDetail.unit}</td>
                            </tr>
                          ))}
                          {Object.keys(data.metrics.byProduct || {}).length === 0 && (
                            <tr><td colSpan="5" className="px-4 py-4 text-center text-on-surface-variant">Veri yok</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SalesReportModal({ onClose }) {
  const { token } = useAuth()
  const [data, setData] = useState({ totalOrders: 0, totalRevenue: 0, orders: [], metrics: { bySalesRep: {}, byProduct: {} } })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('month')

  useEffect(() => {
    setLoading(true)
    fetch(`${API_URL}/analytics/sales?filter=${filter}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        setData(d.metrics ? d : { totalOrders: 0, totalRevenue: 0, orders: [], metrics: { bySalesRep: {}, byProduct: {} } })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filter, token])

  // Process data for charts
  const chartData = useMemo(() => {
    const daily = {}
    ;(data.orders || []).forEach(order => {
      const dateStr = new Date(order.createdAt).toISOString().split('T')[0]
      if (!daily[dateStr]) daily[dateStr] = { date: dateStr, count: 0, totalAmount: 0 }
      daily[dateStr].count += 1
      daily[dateStr].totalAmount += order.totalAmount || 0
    })
    return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  const handleExport = () => {
    if (!data) return
    const wb = XLSX.utils.book_new()
    
    // Temsilci Performansı
    if (data.metrics?.bySalesRep) {
      const repData = Object.entries(data.metrics.bySalesRep).map(([rep, m]) => ({
        'Temsilci': rep,
        'Toplam Sipariş': m.totalOrders,
        'Toplam Ciro': m.totalRevenue
      }))
      if (repData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(repData), 'Temsilci Performansı')
    }

    // Ürün Bazlı Satış Özeti
    if (data.metrics?.byProduct) {
      const prodData = Object.entries(data.metrics.byProduct).map(([prod, m]) => ({
        'Ürün': prod,
        'Satılan Toplam Miktar': m.totalQuantity,
        'Toplam Ciro': m.totalRevenue
      }))
      if (prodData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodData), 'Ürün Özeti')
    }

    // Günlük Trend verisini de ekleyelim
    if (chartData && chartData.length > 0) {
      const trendData = chartData.map(d => ({
        'Tarih': d.date,
        'Sipariş Sayısı': d.count,
        'Ciro': d.totalAmount
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendData), 'Günlük Trend')
    }

    XLSX.writeFile(wb, 'Satis_Raporu.xlsx')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-3xl shadow-2xl shadow-inverse-surface/20 w-[95%] md:w-[90%] lg:w-[85%] h-[90vh] flex flex-col mx-4 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-surface-container-low shrink-0 bg-surface-container-lowest">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-700 rounded-xl flex items-center justify-center text-white">
              <span className="material-symbols-outlined">point_of_sale</span>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-on-surface">Satış Raporları</h2>
              <p className="text-[10px] md:text-xs text-on-surface-variant">Geçmiş sipariş ve gelir özetleri.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-surface-container border border-theme-border rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none"
            >
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
              <option value="all">Tüm Zamanlar</option>
            </select>
            <button onClick={handleExport} className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-bold text-xs flex items-center gap-2 transition-colors">
              <span className="material-symbols-outlined text-[16px]">download</span> Excel
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-surface-container/30">
          {loading ? (
            <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl text-green-600">sync</span></div>
          ) : (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-low shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Toplam Sipariş</p>
                  <p className="text-2xl font-black text-on-surface mt-1">{data.totalOrders || 0}</p>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-low shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Toplam Ciro</p>
                  <p className="text-2xl font-black text-on-surface mt-1 text-green-600">₺{(data.totalRevenue || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-surface-container-low shadow-sm h-[300px] w-full">
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">Günlük Satış Trendi</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" tick={{fontSize: 10}} stroke="#888" />
                    <YAxis tick={{fontSize: 10}} stroke="#888" />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="totalAmount" fill="#16a34a" radius={[4, 4, 0, 0]} name="Ciro (₺)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-surface-container-low shadow-sm overflow-x-auto">
                  <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">Satış Temsilcisi Performansı</h3>
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-on-surface-variant uppercase border-b border-theme-border">
                      <tr>
                        <th className="px-4 py-2 font-medium">Temsilci</th>
                        <th className="px-4 py-2 font-medium text-center">Sipariş</th>
                        <th className="px-4 py-2 font-medium text-right">Ciro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {Object.entries(data.metrics?.bySalesRep || {}).sort((a, b) => b[1].totalRevenue - a[1].totalRevenue).map(([rep, m]) => (
                        <tr key={rep} className="hover:bg-surface-container-lowest/50">
                          <td className="px-4 py-3 font-bold">{rep}</td>
                          <td className="px-4 py-3 text-center">{m.totalOrders}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-bold">₺{m.totalRevenue.toLocaleString()}</td>
                        </tr>
                      ))}
                      {Object.keys(data.metrics?.bySalesRep || {}).length === 0 && (
                        <tr><td colSpan="3" className="px-4 py-4 text-center text-on-surface-variant">Kayıt bulunamadı</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-surface-container-low shadow-sm overflow-x-auto">
                  <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">Ürün Bazlı Satış Özeti</h3>
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-on-surface-variant uppercase border-b border-theme-border">
                      <tr>
                        <th className="px-4 py-2 font-medium">Ürün</th>
                        <th className="px-4 py-2 font-medium text-center">Satılan Miktar</th>
                        <th className="px-4 py-2 font-medium text-right">Ciro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {Object.entries(data.metrics?.byProduct || {}).sort((a, b) => b[1].totalRevenue - a[1].totalRevenue).map(([prod, m]) => (
                        <tr key={prod} className="hover:bg-surface-container-lowest/50">
                          <td className="px-4 py-3 font-bold">{prod}</td>
                          <td className="px-4 py-3 text-center">{m.totalQuantity.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-bold">₺{m.totalRevenue.toLocaleString()}</td>
                        </tr>
                      ))}
                      {Object.keys(data.metrics?.byProduct || {}).length === 0 && (
                        <tr><td colSpan="3" className="px-4 py-4 text-center text-on-surface-variant">Kayıt bulunamadı</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function VisitsReportModal({ onClose }) {
  const { token } = useAuth()
  const [data, setData] = useState({ totalVisits: 0, metrics: { byStatus: {}, byEmployee: {} } })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('month')

  useEffect(() => {
    setLoading(true)
    fetch(`${API_URL}/analytics/site-visits?filter=${filter}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        setData(d.metrics ? d : { totalVisits: 0, metrics: { byStatus: {}, byEmployee: {} } })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filter, token])

  const handleExport = () => {
    if (!data) return
    const wb = XLSX.utils.book_new()
    
    if (data.metrics?.byEmployee) {
      const empData = Object.entries(data.metrics.byEmployee).map(([emp, m]) => {
        const row = { 'Personel': emp, 'Toplam Ziyaret': m.total }
        Object.entries(m.statuses || {}).forEach(([st, c]) => { row[st] = c })
        return row
      })
      if (empData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empData), 'Personel Ziyaretleri')
    }

    XLSX.writeFile(wb, 'Saha_Ziyaretleri_Raporu.xlsx')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-3xl shadow-2xl shadow-inverse-surface/20 w-[95%] md:w-[90%] lg:w-[85%] h-[90vh] flex flex-col mx-4 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-surface-container-low shrink-0 bg-surface-container-lowest">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-xl flex items-center justify-center text-white">
              <span className="material-symbols-outlined">location_on</span>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-extrabold text-on-surface">Saha Ziyaretleri Raporu</h2>
              <p className="text-[10px] md:text-xs text-on-surface-variant">Personel ziyaret özetleri.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-surface-container border border-theme-border rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none"
            >
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
              <option value="all">Tüm Zamanlar</option>
            </select>
            <button onClick={handleExport} className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-bold text-xs flex items-center gap-2 transition-colors">
              <span className="material-symbols-outlined text-[16px]">download</span> Excel
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-surface-container/30">
          {loading ? (
            <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl text-blue-600">sync</span></div>
          ) : (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-low shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Toplam Ziyaret Kaydı</p>
                  <p className="text-2xl font-black text-on-surface mt-1">{data.totalVisits || 0}</p>
                </div>
                {Object.entries(data.metrics.byStatus || {}).map(([status, count]) => (
                  <div key={status} className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-low shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">{status}</p>
                    <p className="text-2xl font-black text-on-surface mt-1">{count}</p>
                  </div>
                ))}
              </div>

              <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl border border-surface-container-low shadow-sm w-full overflow-x-auto">
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">Personel Bazlı Ziyaret Özetleri</h3>
                <div className="min-w-[600px]">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-on-surface-variant uppercase border-b border-theme-border">
                      <tr>
                        <th className="px-4 py-2 font-medium">Personel</th>
                        <th className="px-4 py-2 font-medium text-center">Toplam Ziyaret</th>
                        <th className="px-4 py-2 font-medium">Durum Detayları</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {Object.entries(data.metrics.byEmployee || {}).map(([emp, m]) => (
                        <tr key={emp} className="hover:bg-surface-container-lowest/50">
                          <td className="px-4 py-3 font-bold align-top">{emp}</td>
                          <td className="px-4 py-3 text-center align-top">{m.total}</td>
                          <td className="px-4 py-3">
                            <ul className="space-y-1">
                              {Object.entries(m.statuses || {}).map(([status, count]) => (
                                <li key={status} className="text-on-surface-variant border-b border-theme-border/50 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
                                  <span className="font-bold text-on-surface">{status}:</span>
                                  <span className="ml-2 font-bold">{count}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                      {Object.keys(data.metrics.byEmployee || {}).length === 0 && (
                        <tr><td colSpan="3" className="px-4 py-4 text-center text-on-surface-variant">Kayıt bulunamadı</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
