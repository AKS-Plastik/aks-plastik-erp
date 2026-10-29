import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../config'

export default function NotificationCenter() {
  const { t, i18n } = useTranslation()
  const { token, user } = useAuth()
  const navigate = useNavigate()

  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'unread'
  const containerRef = useRef(null)

  const lang = i18n.language === 'tr' ? 'tr' : 'en'

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0)
    } catch {
      // ignore network errors
    }
  }, [token])

  // Fetch full list
  const fetchNotifications = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) {
        setNotifications(data)
        const unread = data.filter((n) => !n.isRead).length
        setUnreadCount(unread)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token])

  // Polling unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Fetch list when opened
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Mark single notification as read
  async function markAsRead(notification) {
    if (!notification.isRead) {
      try {
        await fetch(`${API_URL}/notifications/${notification.id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        })
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch {
        // ignore
      }
    }
    setIsOpen(false)
    if (notification.link) {
      navigate(notification.link)
    }
  }

  // Mark all as read
  async function markAllAsRead() {
    try {
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      // ignore
    }
  }

  // Format time helper
  function formatTimeAgo(dateStr) {
    if (!dateStr) return ''
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 45) return lang === 'tr' ? 'Az önce' : 'Just now'
    if (diffMin < 60) return lang === 'tr' ? `${diffMin} dk önce` : `${diffMin}m ago`
    if (diffHour < 24) return lang === 'tr' ? `${diffHour} sa önce` : `${diffHour}h ago`
    if (diffDay === 1) return lang === 'tr' ? 'Dün' : 'Yesterday'
    if (diffDay < 7) return lang === 'tr' ? `${diffDay} gün önce` : `${diffDay}d ago`
    return new Date(dateStr).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Notification type icon and color
  function getTypeMeta(type) {
    switch (type) {
      case 'order':
        return { icon: 'shopping_bag', color: 'text-primary bg-primary/10' }
      case 'production':
        return { icon: 'precision_manufacturing', color: 'text-amber-500 bg-amber-500/10' }
      case 'work_order':
      case 'task':
        return { icon: 'assignment', color: 'text-blue-500 bg-blue-500/10' }
      case 'maintenance':
        return { icon: 'build', color: 'text-orange-500 bg-orange-500/10' }
      case 'stock':
      case 'inventory':
        return { icon: 'inventory_2', color: 'text-emerald-500 bg-emerald-500/10' }
      case 'customer':
        return { icon: 'groups', color: 'text-indigo-500 bg-indigo-500/10' }
      default:
        return { icon: 'notifications', color: 'text-primary bg-primary/10' }
    }
  }

  const displayedList = filter === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="p-1.5 md:p-2 text-text-muted hover:text-primary transition-colors rounded-full hover:bg-hover-bg relative"
        title={lang === 'tr' ? 'Bildirimler' : 'Notifications'}
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-[20px] md:text-[24px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[9px] font-black flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="fixed right-3 md:right-16 top-14 md:top-[4.5rem] w-96 max-w-[calc(100vw-1.5rem)] bg-surface-container-lowest rounded-2xl shadow-2xl shadow-inverse-surface/20 border border-surface-container-low overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-surface-container-low flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-on-surface">
                {lang === 'tr' ? 'Bildirimler' : 'Notifications'}
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {unreadCount} {lang === 'tr' ? 'yeni' : 'new'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-medium text-primary hover:underline hover:opacity-80 transition-opacity"
                >
                  {lang === 'tr' ? 'Tümünü Okundu Say' : 'Mark all read'}
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-surface-container-low px-4 pt-2 gap-4 text-xs font-semibold">
            <button
              onClick={() => setFilter('all')}
              className={`pb-2 border-b-2 transition-colors ${
                filter === 'all'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-text-muted hover:text-on-surface'
              }`}
            >
              {lang === 'tr' ? 'Tümü' : 'All'} ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`pb-2 border-b-2 transition-colors ${
                filter === 'unread'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-text-muted hover:text-on-surface'
              }`}
            >
              {lang === 'tr' ? 'Okunmamış' : 'Unread'} ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-surface-container-low">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-muted text-xs flex flex-col items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
                <span>{lang === 'tr' ? 'Yükleniyor...' : 'Loading...'}</span>
              </div>
            ) : displayedList.length === 0 ? (
              <div className="px-4 py-10 text-center text-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-4xl block mb-2 text-text-muted">notifications_none</span>
                <p className="font-medium text-xs text-text-muted">
                  {filter === 'unread'
                    ? (lang === 'tr' ? 'Okunmamış bildirim bulunmuyor' : 'No unread notifications')
                    : (lang === 'tr' ? 'Henüz bir bildirim yok' : 'No notifications yet')}
                </p>
              </div>
            ) : (
              displayedList.map((item) => {
                const meta = getTypeMeta(item.type)
                return (
                  <div
                    key={item.id}
                    onClick={() => markAsRead(item)}
                    className={`px-4 py-3 hover:bg-hover-bg transition-colors cursor-pointer flex items-start gap-3 relative ${
                      !item.isRead ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Unread dot */}
                    {!item.isRead && (
                      <span className="absolute left-1.5 top-5 w-2 h-2 rounded-full bg-primary" />
                    )}

                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate ${!item.isRead ? 'font-bold text-on-surface' : 'font-medium text-on-surface/80'}`}>
                          {item.title}
                        </p>
                        <span className="text-[10px] text-text-muted whitespace-nowrap flex-shrink-0">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant line-clamp-2 mt-0.5 leading-relaxed">
                        {item.body}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 bg-surface-container-low border-t border-surface-container-low text-center">
              <span className="text-[10px] text-text-muted">
                {lang === 'tr'
                  ? 'Yalnızca yetkiniz olan bölümlerin bildirimleri listelenir'
                  : 'Only notifications for authorized sections are shown'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

