import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function SearchableSelect({ options, value, onChange, placeholder, className, error }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ref])

  const selectedOption = options.find((o) => o.value === value)
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className={`relative w-full ${className || ''}`} ref={ref}>
      <div 
        className={`w-full flex items-center justify-between border rounded px-2.5 py-1.5 md:py-2 text-xs md:text-sm bg-surface-container-lowest cursor-pointer transition-colors ${error ? 'border-error text-error' : 'border-theme-border text-on-surface hover:border-primary'}`}
        onClick={() => { setOpen(!open); setSearch('') }}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : (placeholder || 'Select...')}</span>
        <span className="material-symbols-outlined text-[16px] text-text-muted">expand_more</span>
      </div>

      {open && (
        <div className="absolute z-[999] top-full left-0 w-full mt-1 bg-surface-container-lowest border border-theme-border rounded-lg shadow-xl max-h-60 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-theme-border sticky top-0 bg-surface-container-lowest z-10">
            <input
              autoFocus
              type="text"
              placeholder={t('common.search', 'Ara...')}
              className="w-full bg-surface-container-high border border-theme-border rounded px-2 py-1.5 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((o) => (
                <div
                  key={o.value}
                  className={`px-3 py-2 text-xs md:text-sm cursor-pointer hover:bg-primary hover:text-white transition-colors ${o.value === value ? 'bg-primary/10 text-primary font-medium' : 'text-on-surface'}`}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  {o.label}
                </div>
              ))
            ) : (
              <div className="px-3 py-3 text-xs md:text-sm text-text-muted text-center">
                {t('common.noResults', 'Sonuç bulunamadı')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
