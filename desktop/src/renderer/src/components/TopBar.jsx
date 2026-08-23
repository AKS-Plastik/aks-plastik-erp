import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useData } from '../context/DataContext'
import { API_URL } from '../config'

export default function TopBar({ setSidebarOpen }) {
  const { t, i18n } = useTranslation()
  const { user, token, isAdmin } = useAuth()
  const { dark, toggleTheme } = useTheme()
  const { permissions, reports, siteVisits, machines, employees } = useData()
  const navigate = useNavigate()
  const [now, setNow] = useState(new Date())
  const [showAlarms, setShowAlarms] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [leaveAlerts, setLeaveAlerts] = useState([])
  const alarmsRef = useRef(null)
  const userMenuRef = useRef(null)

  const locale = i18n.language === 'tr' ? 'tr-TR' : 'en-US'

  const dept = user?.department
  const canSee = (page) => isAdmin || (permissions[dept] || []).includes(page)

  function toggleLang() {
    const next = i18n.language === 'tr' ? 'en' : 'tr'
    i18n.changeLanguage(next)
    localStorage.setItem('lang', next)
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!showAlarms && !showUserMenu) return
    function handleClick(e) {
      if (showAlarms && alarmsRef.current && !alarmsRef.current.contains(e.target)) setShowAlarms(false)
      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAlarms, showUserMenu])

  const matchedEmployee = user?.employeeId
    ? (employees || []).find((e) => e.id === user.employeeId)
    : user?.email
      ? (employees || []).find((e) => e.email && e.email.toLowerCase() === user.email.toLowerCase())
      : null

  // Fetch leave alerts — admin sees all pending, managers see their subordinates'
  useEffect(() => {
    if (!token || !employees.length) return
    let url
    if (isAdmin) {
      url = `${API_URL}/leave-requests`
    } else if (matchedEmployee?.isManager) {
      url = `${API_URL}/leave-requests?supervisorId=${matchedEmployee.id}`
    } else {
      setLeaveAlerts([])
      return
    }
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setLeaveAlerts(Array.isArray(data) ? data.filter((r) => r.status === 'Pending') : []))
      .catch(() => { })
  }, [token, isAdmin, matchedEmployee?.id, matchedEmployee?.isManager, employees.length])

  // Alert computations
  const today = new Date(new Date().toDateString())
  const in3Days = new Date(today); in3Days.setDate(today.getDate() + 3)
  const in7Days = new Date(today); in7Days.setDate(today.getDate() + 7)

  const overdueReports = canSee('reports')
    ? (reports || []).filter((r) => r.dueDate && new Date(r.dueDate) < today && r.column !== 'completed' && r.column !== 'cancelled')
    : []

  const upcomingVisits = canSee('work-orders')
    ? (siteVisits || []).filter((v) => {
      const d = new Date(v.date)
      return v.status === 'Scheduled' && d >= today && d <= in3Days
    })
    : []

  const maintenanceAlerts = canSee('maintenance')
    ? (machines || []).filter((m) => {
      if (!m.nextMaintenanceDue) return false
      return new Date(m.nextMaintenanceDue) <= in7Days
    })
    : []

  const totalAlarms = overdueReports.length + upcomingVisits.length + maintenanceAlerts.length + leaveAlerts.length

  const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const utcOffset = -now.getTimezoneOffset() / 60
  const timezone = `UTC${utcOffset >= 0 ? '+' : ''}${utcOffset}`
  const date = now.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '??'

  const roleBadge = user?.role === 'admin' ? t('topbar.admin') : t('topbar.user')

  return (
    <header className="w-full h-12 md:h-16 sticky top-0 z-30 bg-surface-container-lowest flex items-center justify-between px-3 md:px-6">
      {/* Left section: Hamburger + Date & Time */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Hamburger Menu (Mobile Only) */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 md:p-2 -ml-1.5 md:-ml-2 text-text-muted hover:text-primary transition-colors rounded-full hover:bg-hover-bg md:hidden flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[20px] md:text-[24px]">menu</span>
        </button>

        {/* Date & Time */}
        <div className="flex items-center gap-2 md:gap-3">
          <span className="material-symbols-outlined text-primary text-xl hidden sm:block">schedule</span>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs md:text-sm font-bold text-on-surface" style={{ fontVariantNumeric: 'tabular-nums', minWidth: '5.5em' }}>{time}</span>
            </div>
          </div>
          <p className="text-[11px] text-text-muted mt-0.5 hidden sm:block">{date}</p>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 md:gap-2">

          {/* Web Download Help */}
          {!window.electron && (
            <button
              onClick={() => alert("Tablet veya telefonunuza uygulamayı kurmak için:\n\nTarayıcınızın (Chrome/Safari) menüsüne tıklayın ve 'Ana Ekrana Ekle' (Add to Home Screen) seçeneğini seçin.\n\n(Not: Güvenlik gereği otomatik indirme penceresi yalnızca HTTPS bağlantılarında açılmaktadır.)")}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors mr-1 md:mr-2"
              title="Uygulamayı Kur"
            >
              <span className="material-symbols-outlined text-[18px]">install_mobile</span>
              <span className="text-[11px] font-bold">Uygulamayı Kur</span>
            </button>
          )}

          {/* Alarm Bell */}
          <div className="relative" ref={alarmsRef}>
            <button
              onClick={() => setShowAlarms((v) => !v)}
              className="p-1.5 md:p-2 text-text-muted hover:text-primary transition-colors rounded-full hover:bg-hover-bg relative"
            >
              <span className="material-symbols-outlined text-[20px] md:text-[24px]">notifications</span>
              {totalAlarms > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-error text-on-error text-[9px] font-black flex items-center justify-center">
                  {totalAlarms > 9 ? '9+' : totalAlarms}
                </span>
              )}
            </button>

            {showAlarms && (
              <div className="fixed right-3 md:right-6 top-14 md:top-[4.5rem] w-96 max-w-[calc(100vw-1.5rem)] bg-surface-container-lowest rounded-2xl shadow-2xl shadow-inverse-surface/20 border border-surface-container-low overflow-hidden z-[100]">
                <div className="px-4 pt-4 pb-3 border-b border-surface-container-low flex items-center justify-between">
                  <span className="text-xs font-extrabold text-on-surface">{t('topbar.alerts')}</span>
                  {totalAlarms > 0 && (
                    <span className="text-[10px] font-bold text-error bg-error-container px-2 py-0.5 rounded-full">
                      {totalAlarms} {t('topbar.active')}
                    </span>
                  )}
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                  {totalAlarms === 0 ? (
                    <div className="px-4 py-8 text-center text-on-surface-variant text-sm">
                      <span className="material-symbols-outlined text-3xl block mb-2 text-success">check_circle</span>
                      {t('topbar.noAlerts')}
                    </div>
                  ) : (
                    <>
                      {/* Overdue Tasks */}
                      {overdueReports.length > 0 && (
                        <section>
                          <div className="px-4 py-2 bg-surface-container-low flex items-center justify-between sticky top-0">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm text-error">assignment_late</span>
                              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">{t('topbar.overdueTasks')}</span>
                            </div>
                            <span className="text-[10px] font-bold text-error">{overdueReports.length}</span>
                          </div>
                          {overdueReports.map((r) => (
                            <div
                              key={r.id}
                              onClick={() => { navigate('/reports'); setShowAlarms(false) }}
                              className="px-4 py-2.5 hover:bg-hover-bg transition-colors border-b border-surface-container-low last:border-0 cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-on-surface truncate">{r.title}</p>
                                <span className="text-[10px] font-bold text-error whitespace-nowrap">
                                  {t('topbar.dOverdue', { n: Math.ceil((today - new Date(r.dueDate)) / 86400000) })}
                                </span>
                              </div>
                              <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">
                                {r.customer?.name || 'No customer'} · {r.employee?.name || 'Unassigned'}
                              </p>
                            </div>
                          ))}
                        </section>
                      )}

                      {/* Upcoming Site Visits */}
                      {upcomingVisits.length > 0 && (
                        <section>
                          <div className="px-4 py-2 bg-surface-container-low flex items-center justify-between sticky top-0">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">{t('topbar.upcomingSiteVisits')}</span>
                            </div>
                            <span className="text-[10px] font-bold text-primary">{upcomingVisits.length}</span>
                          </div>
                          {upcomingVisits.map((v) => {
                            const diff = Math.ceil((new Date(v.date) - today) / 86400000)
                            return (
                              <div
                                key={v.id}
                                onClick={() => { navigate('/work-orders'); setShowAlarms(false) }}
                                className="px-4 py-2.5 hover:bg-hover-bg transition-colors border-b border-surface-container-low last:border-0 cursor-pointer"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-on-surface truncate">{v.title}</p>
                                  <span className="text-[10px] font-bold text-primary whitespace-nowrap">
                                    {diff === 0 ? t('topbar.today') : diff === 1 ? t('topbar.tomorrow') : t('topbar.inNDays', { n: diff })}
                                  </span>
                                </div>
                                <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">
                                  {v.customerName || '—'} · {v.time || ''}
                                </p>
                              </div>
                            )
                          })}
                        </section>
                      )}

                      {/* Maintenance Due */}
                      {maintenanceAlerts.length > 0 && (
                        <section>
                          <div className="px-4 py-2 bg-surface-container-low flex items-center justify-between sticky top-0">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm text-tertiary">build</span>
                              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">{t('topbar.maintenanceDue')}</span>
                            </div>
                            <span className="text-[10px] font-bold text-tertiary">{maintenanceAlerts.length}</span>
                          </div>
                          {maintenanceAlerts.map((m) => {
                            const diff = Math.ceil((new Date(m.nextMaintenanceDue) - today) / 86400000)
                            return (
                              <div
                                key={m.id}
                                onClick={() => { navigate('/maintenance'); setShowAlarms(false) }}
                                className="px-4 py-2.5 hover:bg-hover-bg transition-colors border-b border-surface-container-low last:border-0 cursor-pointer"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-on-surface truncate">{m.name}</p>
                                  <span className={`text-[10px] font-bold whitespace-nowrap ${diff < 0 ? 'text-error' : 'text-tertiary'}`}>
                                    {diff < 0
                                      ? t('topbar.dOverdue', { n: Math.abs(diff) })
                                      : diff === 0
                                        ? t('topbar.dueToday')
                                        : t('topbar.inNDays', { n: diff })}
                                  </span>
                                </div>
                                <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">
                                  {m.code} · {m.location || '—'}
                                </p>
                              </div>
                            )
                          })}
                        </section>
                      )}

                      {/* Pending Leave Requests */}
                      {leaveAlerts.length > 0 && (
                        <section>
                          <div className="px-4 py-2 bg-surface-container-low flex items-center justify-between sticky top-0">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm text-secondary">event_busy</span>
                              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">{t('topbar.pendingLeave')}</span>
                            </div>
                            <span className="text-[10px] font-bold text-secondary">{leaveAlerts.length}</span>
                          </div>
                          {leaveAlerts.map((lr) => (
                            <div
                              key={lr.id}
                              onClick={() => { navigate('/attendance?tab=team'); setShowAlarms(false) }}
                              className="px-4 py-2.5 hover:bg-hover-bg transition-colors border-b border-surface-container-low last:border-0 cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-on-surface truncate">{lr.employee?.name || 'Employee'}</p>
                                <span className="text-[10px] font-bold text-secondary whitespace-nowrap">{lr.type}</span>
                              </div>
                              <p className="text-[11px] text-on-surface-variant mt-0.5">
                                {lr.startDate} → {lr.endDate} · {lr.days}d
                              </p>
                            </div>
                          ))}
                        </section>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Only Actions */}
          <div className="hidden md:flex items-center gap-1">

            <button className="hidden p-2 text-text-muted hover:text-primary transition-colors rounded-full hover:bg-hover-bg">
              <span className="material-symbols-outlined">help_outline</span>
            </button>

            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="px-2.5 py-1.5 text-text-muted hover:text-primary transition-colors rounded-lg hover:bg-hover-bg text-xs font-bold tracking-wide"
              title={i18n.language === 'tr' ? 'Switch to English' : "Türkçe'ye geç"}
            >
              {i18n.language === 'tr' ? 'EN' : 'TR'}
            </button>

            {/* Theme toggle */}
            <button onClick={toggleTheme} className="p-2 text-text-muted hover:text-primary transition-colors rounded-full hover:bg-hover-bg" title={dark ? 'Light mode' : 'Dark mode'}>
              <span className="material-symbols-outlined">{dark ? 'light_mode' : 'dark_mode'}</span>
            </button>
          </div>
        </div>

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-theme-border hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-on-surface leading-none">{user?.name || 'User'}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{roleBadge}</p>
              {matchedEmployee && (
                <p className="text-[10px] text-primary mt-0.5 flex items-center justify-end gap-0.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>badge</span>
                  {matchedEmployee.name}
                </p>
              )}
            </div>
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-full overflow-hidden flex-shrink-0">
              {matchedEmployee?.photo
                ? <img src={`${API_URL.replace('/api', '')}${matchedEmployee.photo}`} alt={user?.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full primary-gradient flex items-center justify-center text-white text-xs md:text-sm font-bold">{initials}</div>
              }
            </div>
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-2xl shadow-inverse-surface/20 border border-surface-container-low overflow-hidden z-50">
              <div className="md:hidden border-b border-surface-container-low py-1">
                <button className="hidden flex items-center gap-2.5 md:gap-3 w-full px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-on-surface hover:bg-hover-bg transition-colors">
                  <span className="material-symbols-outlined text-[14px] md:text-base text-text-muted">help_outline</span>
                  {i18n.language === 'tr' ? 'Yardım' : 'Help'}
                </button>
                <button onClick={toggleLang} className="flex items-center gap-2.5 md:gap-3 w-full px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-on-surface hover:bg-hover-bg transition-colors">
                  <span className="material-symbols-outlined text-[14px] md:text-base text-text-muted">language</span>
                  {i18n.language === 'tr' ? 'English' : 'Türkçe'}
                </button>
                <button onClick={toggleTheme} className="flex items-center gap-2.5 md:gap-3 w-full px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-on-surface hover:bg-hover-bg transition-colors">
                  <span className="material-symbols-outlined text-[14px] md:text-base text-text-muted">{dark ? 'light_mode' : 'dark_mode'}</span>
                  {dark ? (i18n.language === 'tr' ? 'Açık Tema' : 'Light Mode') : (i18n.language === 'tr' ? 'Koyu Tema' : 'Dark Mode')}
                </button>
              </div>

              <button
                onClick={() => { navigate('/account'); setShowUserMenu(false) }}
                className="flex items-center gap-2.5 md:gap-3 w-full px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-on-surface hover:bg-hover-bg transition-colors"
              >
                <span className="material-symbols-outlined text-[14px] md:text-base text-text-muted">person</span>
                {t('topbar.myAccount')}
              </button>
              <button
                onClick={() => { navigate('/attendance'); setShowUserMenu(false) }}
                className="flex items-center gap-2.5 md:gap-3 w-full px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-on-surface hover:bg-hover-bg transition-colors border-t border-surface-container-low"
              >
                <span className="material-symbols-outlined text-[14px] md:text-base text-text-muted">schedule</span>
                {t('topbar.attendance')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
