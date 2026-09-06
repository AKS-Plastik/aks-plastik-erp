import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function UpdateBanner() {
  const { t } = useTranslation()
  const [status, setStatus] = useState(null) // null | 'downloading' | 'ready'
  const [progress, setProgress] = useState(0)
  const [version, setVersion] = useState('')

  if (!window.api) return null

  useEffect(() => {
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

  if (!status) return null

  return (
    <div className="flex items-center gap-3 px-6 py-2 bg-surface-container border-b border-surface-container-low">
      <span className="material-symbols-outlined text-base text-primary">system_update</span>

      {status === 'downloading' && (
        <>
          <span className="text-xs text-on-surface">
            {t('updater.downloading')}{version && <span className="font-bold text-primary"> v{version}</span>}...
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
            <span className="font-bold text-primary">v{version}</span> {t('updater.ready')}
          </span>
          <button
            onClick={() => window.api.installUpdate()}
            className="px-3 py-1 text-xs font-bold bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity"
          >
            {t('updater.install')}
          </button>
          <button
            onClick={() => setStatus(null)}
            className="px-2 py-1 text-xs text-text-muted hover:text-on-surface transition-colors"
          >
            {t('updater.later')}
          </button>
        </>
      )}
    </div>
  )
}
