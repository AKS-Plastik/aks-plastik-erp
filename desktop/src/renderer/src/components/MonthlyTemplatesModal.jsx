import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'

export default function MonthlyTemplatesModal({
    onClose,
    initialMachineId = null
}) {
    const { t } = useTranslation()
    const { machines = [], getMonthlyTemplates, updateMonthlyTemplates } = useData()

    const [selectedMachineId, setSelectedMachineId] = useState(
        initialMachineId ? String(initialMachineId) : 'global'
    )
    const [templates, setTemplates] = useState([])
    const [isCustom, setIsCustom] = useState(false)
    const [defaultTemplates, setDefaultTemplates] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [savedMsg, setSavedMsg] = useState(false)
    const [syncYear, setSyncYear] = useState(true)

    const currentYear = new Date().getFullYear()

    const loadData = async (mId) => {
        setLoading(true)
        setSavedMsg(false)
        try {
            const machineParam = mId === 'global' ? null : parseInt(mId)
            const res = await getMonthlyTemplates(machineParam)
            if(res) {
                setTemplates(Array.isArray(res.templates) ? [...res.templates] : [])
                setIsCustom(Boolean(res.isCustom))
                setDefaultTemplates(Array.isArray(res.defaultTemplates) ? [...res.defaultTemplates] : [])
            }
        } catch(err) {
            console.error('Failed to load templates:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData(selectedMachineId)
    }, [selectedMachineId])

    const handleMachineChange = (e) => {
        setSelectedMachineId(e.target.value)
    }

    const handleAddTask = () => {
        setTemplates((prev) => [...prev, ''])
    }

    const handleRemoveTask = (idx) => {
        setTemplates((prev) => prev.filter((_, i) => i !== idx))
    }

    const handleTaskChange = (idx, value) => {
        setTemplates((prev) => {
            const next = [...prev]
            next[idx] = value
            return next
        })
    }

    const handleCustomizeForMachine = () => {
        setIsCustom(true)
        if(templates.length === 0 && defaultTemplates.length > 0) {
            setTemplates([...defaultTemplates])
        }
    }

    const handleRevertToGlobal = async () => {
        if(!confirm(t('maintenance.confirmRevertGlobal', 'Bu makine için tanımlanmış özel görevler silinecek ve genel şablona dönülecektir. Onaylıyor musunuz?'))) {
            return
        }
        setSaving(true)
        try {
            const mId = parseInt(selectedMachineId)
            await updateMonthlyTemplates({
                templates: [],
                machineId: mId,
                syncYear: syncYear ? currentYear : null,
                resetToGlobal: true
            })
            await loadData(selectedMachineId)
            setSavedMsg(true)
            setTimeout(() => setSavedMsg(false), 2500)
        } catch(err) {
            alert(err.message || 'Hata oluştu')
        } finally {
            setSaving(false)
        }
    }

    const handleSave = async (e) => {
        if(e) e.preventDefault()
        setSaving(true)
        try {
            const cleanTemplates = templates.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
            const mId = selectedMachineId === 'global' ? null : parseInt(selectedMachineId)

            await updateMonthlyTemplates({
                templates: cleanTemplates,
                machineId: mId,
                syncYear: syncYear ? currentYear : null,
                resetToGlobal: false
            })
            await loadData(selectedMachineId)
            setSavedMsg(true)
            setTimeout(() => setSavedMsg(false), 2500)
        } catch(err) {
            alert(err.message || 'Hata oluştu')
        } finally {
            setSaving(false)
        }
    }

    const selectedMachine = machines.find((m) => String(m.id) === String(selectedMachineId))

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-3 md:p-4 backdrop-blur-xs animate-fadeIn" onClick={onClose}>
            <div className="bg-surface-container-lowest border border-theme-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-theme-border primary-gradient text-white">
                    <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-2xl">settings_suggest</span>
                        <div>
                            <h3 className="text-sm font-bold leading-tight">
                                {t('maintenance.monthlyTemplatesTitle', 'Aylık Standart Bakım Görevleri')}
                            </h3>
                            <p className="text-[11px] text-white/80 mt-0.5">
                                {t('maintenance.monthlyTemplatesSubtitle', 'Tüm aylar için otomatik tekrarlanan dinamik kontrol listesi')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1 transition"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    
                    {/* Machine Selector Section */}
                    <div className="bg-surface-container-low/70 border border-theme-border rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm text-primary">precision_manufacturing</span>
                                {t('maintenance.selectScope', 'Kapsam / Makine Seçimi')}
                            </label>

                            {selectedMachineId !== 'global' && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isCustom 
                                        ? 'bg-primary/10 text-primary border border-primary/20' 
                                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                }`}>
                                    {isCustom ? t('maintenance.customMachinePlan', 'Makineye Özel Şablon') : t('maintenance.usingGlobalPlan', 'Genel Şablon Kullanılıyor')}
                                </span>
                            )}
                        </div>

                        <select
                            value={selectedMachineId}
                            onChange={handleMachineChange}
                            className="w-full bg-surface-container-lowest border border-theme-border rounded-xl px-3 py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition font-medium"
                        >
                            <option value="global">
                                🌐 {t('maintenance.globalTemplateOption', 'Genel Şablon (Tüm Makineler İçin Varsayılan)')}
                            </option>
                            {machines.map((m) => (
                                <option key={m.id} value={String(m.id)}>
                                    🔧 {m.name} ({m.code}) {m.type ? `[${m.type}]` : ''}
                                </option>
                            ))}
                        </select>

                        {selectedMachineId !== 'global' && !isCustom && (
                            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-text-muted bg-surface-container-lowest p-2 rounded-lg border border-theme-border/60">
                                <span>{t('maintenance.inheritNotice', 'Bu makine henüz genel şablonu miras alıyor.')}</span>
                                <button
                                    type="button"
                                    onClick={handleCustomizeForMachine}
                                    className="text-primary hover:underline font-bold text-[11px] shrink-0"
                                >
                                    {t('maintenance.customizeButton', 'Makineye Özel Yap')}
                                </button>
                            </div>
                        )}

                        {selectedMachineId !== 'global' && isCustom && (
                            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-text-muted">
                                <span className="text-emerald-500 font-medium">
                                    ✓ {t('maintenance.customActiveNotice', 'Bu makine için bağımsız görev listesi tanımlı.')}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleRevertToGlobal}
                                    disabled={saving}
                                    className="text-red-400 hover:text-red-500 hover:underline font-medium text-[11px] shrink-0"
                                >
                                    {t('maintenance.resetToGlobalButton', 'Genel Şablona Sıfırla')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Task List */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                                {t('maintenance.taskListTitle', 'Standart Aylık Görev Listesi')} ({templates.length})
                            </span>
                            <span className="text-[11px] text-text-muted">
                                {selectedMachineId === 'global' ? t('maintenance.appliesToAll', 'Tüm makinelere uygulanır') : selectedMachine?.name}
                            </span>
                        </div>

                        {loading ? (
                            <div className="py-8 text-center text-text-muted text-xs space-y-2">
                                <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
                                <p>{t('common.loading', 'Yükleniyor…')}</p>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="py-8 px-4 text-center border border-dashed border-theme-border rounded-xl text-text-muted text-xs space-y-3">
                                <span className="material-symbols-outlined text-3xl opacity-40">playlist_add</span>
                                <p>{t('maintenance.noTasksInTemplate', 'Bu şablonda henüz standart görev yok.')}</p>
                                <button
                                    type="button"
                                    onClick={handleAddTask}
                                    className="inline-flex items-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 font-bold px-3 py-1.5 rounded-lg text-xs transition"
                                >
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    {t('maintenance.addFirstTask', 'İlk Görevi Ekle')}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                                {templates.map((tpl, i) => (
                                    <div key={i} className="flex items-center gap-2 group">
                                        <div className="w-6 h-6 rounded-lg bg-surface-container-high text-text-muted flex items-center justify-center text-[11px] font-bold shrink-0">
                                            {i + 1}
                                        </div>
                                        <input
                                            type="text"
                                            value={tpl}
                                            onChange={(e) => handleTaskChange(i, e.target.value)}
                                            placeholder={t('maintenance.taskPlaceholder', 'Görev açıklaması (Örn: Rulman yağlama kontrolü)...')}
                                            className="flex-1 bg-surface-container-lowest border border-theme-border rounded-xl px-3 py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTask(i)}
                                            title={t('common.delete', 'Sil')}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-500/10 transition shrink-0"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Task Button */}
                        {!loading && templates.length > 0 && (
                            <button
                                type="button"
                                onClick={handleAddTask}
                                className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-theme-border hover:border-primary rounded-xl text-xs font-semibold text-text-muted hover:text-primary transition"
                            >
                                <span className="material-symbols-outlined text-base">add</span>
                                {t('maintenance.addNewTaskButton', 'Yeni Standart Görev Ekle')}
                            </button>
                        )}
                    </div>

                    {/* Sync Year Option */}
                    <div className="pt-2 border-t border-theme-border">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={syncYear}
                                onChange={(e) => setSyncYear(e.target.checked)}
                                className="mt-0.5 w-4 h-4 accent-primary cursor-pointer shrink-0"
                            />
                            <div>
                                <span className="text-xs font-semibold text-on-surface block">
                                    {t('maintenance.syncCurrentYearLabel', 'Mevcut yılın ({{year}}) 12 ayına hemen senkronize et', { year: currentYear })}
                                </span>
                                <span className="text-[11px] text-text-muted block mt-0.5 leading-relaxed">
                                    {t('maintenance.syncCurrentYearDesc', 'Tamamlanmamış standart görevler güncellenir ve yeni eklenen görevler takvime otomatik işlenir.')}
                                </span>
                            </div>
                        </label>
                    </div>

                    {/* Feedback Alert */}
                    {savedMsg && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2 animate-fadeIn">
                            <span className="material-symbols-outlined text-base">check_circle</span>
                            {t('maintenance.templatesSavedSuccess', 'Standart bakım görevleri başarıyla kaydedildi ve senkronize edildi.')}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-theme-border flex items-center justify-between gap-2 bg-surface-container-high/20">
                    <span className="text-[11px] text-text-muted hidden sm:inline">
                        {templates.filter((s) => s.trim()).length} {t('maintenance.activeTaskCount', 'aktif görev')}
                    </span>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-on-surface hover:bg-surface-container-high transition"
                        >
                            {t('common.close', 'Kapat')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="flex items-center gap-1.5 primary-gradient text-white px-5 py-2 rounded-xl text-xs font-bold hover:opacity-95 transition disabled:opacity-40 shadow-sm shadow-primary/20"
                        >
                            {saving ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                                    {t('common.saving', 'Kaydediliyor…')}
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[16px]">save</span>
                                    {t('maintenance.saveAndSync', 'Kaydet ve Uygula')}
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    )
}

