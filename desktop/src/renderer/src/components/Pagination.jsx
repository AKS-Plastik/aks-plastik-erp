import React from 'react'
import { useTranslation } from 'react-i18next'

export default function Pagination({ page, setPage, totalPages, totalItems, itemsPerPage = 10, label = 'customers.showingOf' }) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  return (
    <div className="flex flex-col items-center justify-center gap-4 mt-6 px-2">
      <p className="text-sm text-on-surface-variant text-center">
        {t(label, { 
          from: (page - 1) * itemsPerPage + 1, 
          to: Math.min(page * itemsPerPage, totalItems), 
          total: totalItems 
        })}
      </p>
      <div className="flex items-center justify-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none max-w-full pb-1 md:pb-0">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-lg sm:rounded-xl bg-surface-container-high text-on-surface-variant disabled:opacity-40 hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-sm sm:text-base">chevron_left</span>
        </button>

        {(() => {
          const pages = []
          const delta = window.innerWidth < 1024 ? 1 : 2
          const left  = page - delta
          const right = page + delta

          let prev = null
          for (let p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || (p >= left && p <= right)) {
              if (prev !== null && p - prev > 1) pages.push('...')
              pages.push(p)
              prev = p
            }
          }

          return pages.map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center text-on-surface-variant text-xs sm:text-sm">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                  p === page
                    ? 'primary-gradient text-white shadow-md shadow-primary/20'
                    : 'hover:bg-surface-container-high text-on-surface'
                }`}
              >
                {p}
              </button>
            )
          )
        })()}

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-lg sm:rounded-xl bg-surface-container-high text-on-surface-variant disabled:opacity-40 hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-sm sm:text-base">chevron_right</span>
        </button>
      </div>
    </div>
  )
}
