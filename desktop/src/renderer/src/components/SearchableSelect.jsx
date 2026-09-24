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

  const isMultiple = Array.isArray(value)

  const selectedOption = !isMultiple ? options.find((o) => o.value === value) : null
  const selectedOptions = isMultiple ? options.filter((o) => value.includes(o.value)) : []
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))

  const handleSelect = (val) => {
    if (isMultiple) {
      if (value.includes(val)) {
        onChange(value.filter((v) => v !== val))
      } else {
        onChange([...value, val])
      }
    } else {
      onChange(val)
      setOpen(false)
    }
  }

  let displayText = placeholder || 'Select...'
  if (isMultiple) {
    if (selectedOptions.length > 0) {
      displayText = selectedOptions.length === 1 ? selectedOptions[0].label : `${selectedOptions.length} seçildi`
    }
  } else {
    if (selectedOption) displayText = selectedOption.label
  }

  return (
    <div className={`relative w-full ${className || ''}`} ref={ref}>
      <div 
        className={`w-full flex items-center justify-between border rounded px-2.5 py-1.5 md:py-2 text-xs md:text-sm bg-surface-container-lowest cursor-pointer transition-colors ${error ? 'border-error text-error' : 'border-theme-border text-on-surface hover:border-primary'}`}
        onClick={() => { setOpen(!open); setSearch('') }}
      >
        <span className="truncate">{displayText}</span>
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
              filtered.map((o) => {
                const isSelected = isMultiple ? value.includes(o.value) : o.value === value
                return (
                  <div
                    key={o.value}
                    className={`px-3 py-2 text-xs md:text-sm cursor-pointer hover:bg-primary hover:text-white transition-colors flex items-center gap-2 ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-on-surface'}`}
                    onClick={() => handleSelect(o.value)}
                  >
                    {isMultiple && (
                      <span className="material-symbols-outlined text-[16px]">
                        {isSelected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                    )}
                    <span className="truncate">{o.label}</span>
                  </div>
                )
              })
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
