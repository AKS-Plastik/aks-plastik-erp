import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'

export default function ProductionPlanning() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const { productionTasks, orders, products, machines, employees } = useData()

  return (
    <div className="p-3 md:p-6 lg:p-8 min-h-screen bg-page-bg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
            {t('nav.productionPlanning', 'Üretim Planlama')}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Üretim planlama ve süreç yönetimi
          </p>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-theme-border p-6 md:p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
          <span className="material-symbols-outlined text-3xl">calendar_month</span>
        </div>
        <h2 className="text-lg font-bold text-on-surface mb-2">Üretim Planlama Modülü</h2>
        <p className="text-sm text-text-muted max-w-md">
          Bu alan yeni görev oluşturma ve detaylı üretim planlaması için hazırlanmaktadır.
        </p>
      </div>
    </div>
  )
}
