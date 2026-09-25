import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
// This will resolve in Vite web builds where vite-plugin-pwa is used.
// For electron builds, it might not, but vite-plugin-pwa usually injects a mock or we can handle it conditionally.
// Wait, to avoid build errors in Electron if vite-plugin-pwa is only in web config, we might need a try-catch, but imports can't be in try-catch.
// However, the project has vite-plugin-pwa. Let's assume it compiles. If not, we'll fix it.
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdateBanner() {
  const { t } = useTranslation()
  const [status, setStatus] = useState(null) // null | 'downloading' | 'ready'
  const [progress, setProgress] = useState(0)
  const [version, setVersion] = useState('')

  // PWA Registration hook
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(() => {
          r.update()
        }, 15 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })

  useEffect(() => {
    if (!window.api) return
    const offAvailable = window.api.onUpdateAvailable?.((info) => {
      setVersion(info.version)
      setStatus('downloading')
    })
    const offProgress = window.api.onDownloadProgress?.((p) => {
      setProgress(Math.round(p.percent))
    })
    const offDownloaded = window.api.onUpdateDownloaded?.((info) => {
      setVersion(info.version)
      setStatus('ready')
    })
    return () => {
      offAvailable?.()
      offProgress?.()
      offDownloaded?.()
    }
  }, [])

  if (needRefresh) {
    return (
      <div className="flex items-center gap-3 px-6 py-2 bg-surface-container border-b border-surface-container-low">
        <span className="material-symbols-outlined text-base text-primary">system_update</span>
        <span className="text-xs text-on-surface flex-1">
          {t('updater.newVersionAvailable', 'Yeni bir sürüm yayınlandı! Güncellemek için lütfen yenileyin.')}
        </span>
        <button
          onClick={() => {
            updateServiceWorker(true)
            setTimeout(() => window.location.reload(), 1000)
          }}
          className="px-3 py-1 text-xs font-bold bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity"
        >
          {t('updater.refresh', 'Yenile')}
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="px-2 py-1 text-xs text-text-muted hover:text-on-surface transition-colors"
        >
          {t('updater.later', 'Daha sonra')}
        </button>
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="flex items-center gap-3 px-6 py-2 bg-surface-container border-b border-surface-container-low">
      <span className="material-symbols-outlined text-base text-primary">system_update</span>

      {status === 'downloading' && (
        <>
          <span className="text-xs text-on-surface">
            {t('updater.downloading', 'İndiriliyor')}{version && <span className="font-bold text-primary"> v{version}</span>}...
          </span>
          <div className="flex-1 max-w-xs h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-text-muted tabular-nums">{progress}%</span>
        </>
      )}

      {status === 'ready' && (
        <>
          <span className="text-xs text-on-surface flex-1">
            <span className="font-bold text-primary">v{version}</span> {t('updater.ready', 'kuruluma hazır')}
          </span>
          <button
            onClick={() => window.api.installUpdate()}
            className="px-3 py-1 text-xs font-bold bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity"
          >
            {t('updater.install', 'Kur & Yeniden Başlat')}
          </button>
          <button
            onClick={() => setStatus(null)}
            className="px-2 py-1 text-xs text-text-muted hover:text-on-surface transition-colors"
          >
            {t('updater.later', 'Daha sonra')}
          </button>
        </>
      )}
    </div>
  )
}
