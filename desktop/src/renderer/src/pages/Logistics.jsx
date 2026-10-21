import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const LOGISTIC_STATUSES = [
    'completed',
    'In Delivery',
    'Invoiced',
    'Delivered'
];

const statusNext = {
    'completed': 'In Delivery',
    'In Delivery': 'Invoiced',
    'Invoiced': 'Delivered'
};

const statusIcon = {
    'completed': 'check_circle',
    'In Delivery': 'local_shipping',
    'Invoiced': 'receipt_long',
    'Delivered': 'inventory'
};

const statusStyle = {
    'completed': 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
    'In Delivery': 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    'Invoiced': 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
    'Delivered': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
};

const statusColor = {
    'completed': 'text-green-600 dark:text-green-400',
    'In Delivery': 'text-blue-600 dark:text-blue-400',
    'Invoiced': 'text-purple-600 dark:text-purple-400',
    'Delivered': 'text-emerald-600 dark:text-emerald-400'
};

const normalizeStatus = (status) => {
    if(!status) {
        return 'completed';
    }
    const lower = String(status).trim().toLowerCase();
    if(lower === 'completed' || lower === 'production completed' || lower === 'tamamlandı' || lower === 'üretim tamamlandı') {
        return 'completed';
    }
    if(lower === 'in delivery' || lower === 'in_delivery' || lower === 'teslimatta') {
        return 'In Delivery';
    }
    if(lower === 'invoiced' || lower === 'in_voiced' || lower === 'fatura kesildi' || lower === 'e-invoice' || lower === 'e-fatura') {
        return 'Invoiced';
    }
    if(lower === 'delivered' || lower === 'teslim edildi') {
        return 'Delivered';
    }
    return status;
};

const getStatusLabel = (status, t) => {
    const norm = normalizeStatus(status);
    if(norm === 'completed') {
        return t('logistics.statusCompleted', 'Tamamlandı');
    }
    if(norm === 'In Delivery') {
        return t('logistics.statusInDelivery', 'Teslimatta');
    }
    if(norm === 'Invoiced') {
        return t('logistics.statusInvoiced', 'Fatura kesildi');
    }
    if(norm === 'Delivered') {
        return t('logistics.statusDelivered', 'Teslim Edildi');
    }
    return norm;
};

// ─── Task Detail Modal ────────────────────────────────────────────────────────
const TaskDetailModal = ({
    onAdvance,
    onClose,
    canAct,
    task
}) => {
    const { t } = useTranslation();
    const [
        confirming,
        setConfirming
    ] = useState(false);
    const [
        selectedStatus,
        setSelectedStatus
    ] = useState(normalizeStatus(task.status));

    const currentStatus = normalizeStatus(task.status);
    const next = statusNext[currentStatus];
    const orderItem = task.orderItem;
    const parentOrder = orderItem?.order;
    const customer = parentOrder?.customer;
    const currency = orderItem?.currency || 'TRY';
    const unitPrice = parseFloat(orderItem?.unitPrice) || 0;
    const taskQuantity = parseInt(task.quantity, 10) || 0;
    const parentQuantity = parseInt(orderItem?.quantity, 10) || taskQuantity;
    const taskTotal = unitPrice * taskQuantity;
    const unit = orderItem?.product?.unit || task.product?.unit || 'adet';
    const notes = orderItem?.notes || [];

    const percentage = parentQuantity > 0 ? Math.min(100, Math.round((taskQuantity / parentQuantity) * 100)) : 100;

    const handleConfirmAdvance = async () => {
        if(!next) {
            return;
        }
        await onAdvance(task.id, next);
        setConfirming(false);
    };

    const handleDirectChange = async () => {
        if(!selectedStatus || selectedStatus === currentStatus) {
            return;
        }
        await onAdvance(task.id, selectedStatus);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 md:p-6"
            onClick={onClose}
        >
            <div
                className="bg-surface-container-lowest rounded-2xl shadow-xl w-[95%] md:w-[85%] max-w-4xl p-5 md:p-8 max-h-[90dvh] overflow-y-auto flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start justify-between mb-5 gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-text-muted">
                                {task.code}
                            </span>
                            {parentOrder?.code && (
                                <>
                                    <span className="text-text-muted text-xs">•</span>
                                    <span className="text-xs font-mono text-text-muted">
                                        #{parentOrder.code}
                                    </span>
                                </>
                            )}
                            {(orderItem?.product?.stockNo || task.product?.stockNo) && (
                                <>
                                    <span className="text-text-muted text-xs">•</span>
                                    <span className="text-xs font-mono text-text-muted">
                                        {orderItem?.product?.stockNo || task.product?.stockNo}
                                    </span>
                                </>
                            )}
                        </div>
                        <h2 className="text-base md:text-xl font-bold text-on-surface leading-tight">
                            {orderItem?.productName || task.product?.name || 'Ürün'}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs md:text-sm font-semibold text-text-muted">
                                {customer?.name || '—'}
                            </span>
                            {(customer?.accountCode || customer?.code) && (
                                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest">
                                    {customer.accountCode || customer.code}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${statusStyle[currentStatus] || 'bg-surface-container-high text-text-muted'}`}>
                            {getStatusLabel(currentStatus, t)}
                        </span>
                        <button
                            onClick={onClose}
                            className="text-text-muted hover:text-error transition cursor-pointer"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                {/* Lojistik Süreci (Clean Flat Stepper without nested borders) */}
                <div className="mb-5">
                    <p className="text-[10px] md:text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                        {t('logistics.processStatus', 'Lojistik Süreci')}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {LOGISTIC_STATUSES.map((stepKey, idx) => {
                            const isCurrent = currentStatus === stepKey;
                            const currentIndex = LOGISTIC_STATUSES.indexOf(currentStatus);
                            const isPassed = currentIndex > idx;

                            let bgClass = 'bg-surface-container-high/60 text-text-muted hover:bg-surface-container-high';
                            if(isCurrent) {
                                bgClass = 'bg-primary text-white shadow-xs';
                            } else if(isPassed) {
                                bgClass = 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400';
                            }

                            return (
                                <div
                                    key={stepKey}
                                    onClick={() => {
                                        if(canAct) {
                                            setSelectedStatus(stepKey);
                                        }
                                    }}
                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition cursor-pointer ${bgClass}`}
                                >
                                    <span className="material-symbols-outlined text-base shrink-0">
                                        {isPassed ? 'check_circle' : statusIcon[stepKey]}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[9px] uppercase font-semibold opacity-75 leading-tight">
                                            {idx + 1}. Aşama
                                        </p>
                                        <p className="text-xs font-bold truncate leading-tight mt-0.5">
                                            {getStatusLabel(stepKey, t)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Information Panels (Sipariş & Parça Miktarı) using standard bg-surface-container-high rounded-xl */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                    {/* Sipariş Bilgileri */}
                    <div className="bg-surface-container-high rounded-xl p-4 space-y-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="material-symbols-outlined text-sm text-text-muted">business</span>
                            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                                {t('orders.order', 'Sipariş Bilgileri')}
                            </h3>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted">{t('common.customer', 'Müşteri')}:</span>
                            <span className="font-semibold text-on-surface text-right">{customer?.name || '—'}</span>
                        </div>
                        {(customer?.accountCode || customer?.code) && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-text-muted">Cari Kodu:</span>
                                <span className="font-mono font-bold text-amber-500">{customer.accountCode || customer.code}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted">{t('orders.salesRep', 'Satış Temsilcisi')}:</span>
                            <span className="font-medium text-on-surface">{parentOrder?.salesRep?.name || parentOrder?.employee?.name || '—'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted">{t('orders.shipment', 'Sevkiyat Türü')}:</span>
                            <span className="font-medium text-on-surface">{parentOrder?.shipmentType || 'Standart Sevkiyat'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted">{t('orders.payment', 'Ödeme Yöntemi')}:</span>
                            <span className="font-medium text-on-surface">{parentOrder?.paymentMethod || '—'}</span>
                        </div>
                    </div>

                    {/* Parça Miktarı & Tutarı */}
                    <div className="bg-surface-container-high rounded-xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm text-text-muted">inventory_2</span>
                                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                                    {t('logistics.itemQty', 'Parça & Miktar')}
                                </h3>
                            </div>
                            {percentage < 100 && (
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    %{percentage} Parti
                                </span>
                            )}
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted">{t('logistics.itemQty', 'Parça Miktarı')}:</span>
                            <span className="font-bold text-on-surface">
                                {taskQuantity} {unit}
                                {parentQuantity !== taskQuantity && (
                                    <span className="text-text-muted font-normal text-[11px] ml-1">
                                        (Toplam: {parentQuantity} {unit})
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden my-1">
                            <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted">{t('orders.unitPrice', 'Birim Fiyat')}:</span>
                            <span className="font-mono text-on-surface">
                                {currency} {unitPrice.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-theme-border/40">
                            <span className="font-bold text-on-surface">{t('logistics.totalAmount', 'Parça Tutarı')}:</span>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                {currency} {taskTotal.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Machine & Operator Strip (clean background, no extra borders) */}
                <div className="bg-surface-container-high/60 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted mb-4">
                    <div className="flex items-center gap-4 flex-wrap">
                        {task.machine?.name ? (
                            <span className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm text-text-muted">precision_manufacturing</span>
                                Makine: <strong className="text-on-surface font-semibold ml-0.5">{task.machine.name}</strong>
                            </span>
                        ) : null}
                        {task.operator?.name ? (
                            <span className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm text-text-muted">badge</span>
                                Operatör: <strong className="text-on-surface font-semibold ml-0.5">{task.operator.name}</strong>
                            </span>
                        ) : null}
                    </div>
                    {task.date ? (
                        <span className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="material-symbols-outlined text-sm text-text-muted">calendar_today</span>
                            {task.date}
                        </span>
                    ) : null}
                </div>

                {/* Line Item Notes */}
                {notes.length > 0 && (
                    <div className="bg-surface-container-high rounded-xl p-3.5 mb-4 text-xs">
                        <p className="font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-amber-500">sticky_note_2</span>
                            {t('orders.itemNotes', 'Sipariş Kalem Notları')} ({notes.length})
                        </p>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                            {notes.map((n) => (
                                <div
                                    key={n.id}
                                    className="p-2.5 rounded-lg bg-surface-container-lowest/80 text-xs"
                                >
                                    <div className="flex items-center justify-between text-[11px] text-text-muted mb-0.5">
                                        <span className="font-semibold text-on-surface">{n.authorName || 'Kullanıcı'}</span>
                                        <span className="font-mono text-[10px]">
                                            {n.createdAt ? new Date(n.createdAt).toLocaleDateString('tr-TR') : ''}
                                        </span>
                                    </div>
                                    <p className="text-on-surface whitespace-pre-wrap">{n.note}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Status Controls (Matching Orders.jsx style) */}
                {canAct && (
                    <div className="pt-4 mt-1 border-t border-theme-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        {/* Direct Status Selector */}
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-text-muted text-sm">swap_horiz</span>
                            <label className="text-xs font-semibold text-text-muted whitespace-nowrap">
                                {t('logistics.changeStatus', 'Aşama')}:
                            </label>
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="bg-surface-container-lowest border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-primary cursor-pointer"
                            >
                                {LOGISTIC_STATUSES.map((st) => (
                                    <option
                                        key={st}
                                        value={st}
                                    >
                                        {getStatusLabel(st, t)}
                                    </option>
                                ))}
                            </select>
                            {selectedStatus !== currentStatus && (
                                <button
                                    onClick={handleDirectChange}
                                    className="bg-primary hover:opacity-90 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                                >
                                    {t('common.save', 'Uygula')}
                                </button>
                            )}
                        </div>

                        {/* Next Stage Button or Confirmation */}
                        {next && !confirming && (
                            <button
                                onClick={() => setConfirming(true)}
                                className="flex items-center justify-center gap-1.5 bg-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition cursor-pointer shadow-xs"
                            >
                                <span>{t('logistics.advanceTo', { status: getStatusLabel(next, t) })}</span>
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </button>
                        )}

                        {next && confirming && (
                            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl px-3 py-1.5 text-xs">
                                <span className="material-symbols-outlined text-amber-500 text-sm">warning</span>
                                <span className="text-amber-700 dark:text-amber-300">
                                    <strong>{getStatusLabel(next, t)}</strong> aşamasına geçilsin mi?
                                </span>
                                <button
                                    onClick={() => setConfirming(false)}
                                    className="text-text-muted hover:text-on-surface px-1.5 py-0.5 rounded transition cursor-pointer ml-1"
                                >
                                    {t('common.cancel', 'Vazgeç')}
                                </button>
                                <button
                                    onClick={handleConfirmAdvance}
                                    className="font-semibold text-white bg-primary hover:opacity-90 px-2.5 py-1 rounded-lg transition cursor-pointer"
                                >
                                    {t('common.confirm', 'Onayla')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Logistics Component ────────────────────────────────────────────────
export default function Logistics() {
    const { t } = useTranslation();
    const {
        refreshProductionTasks,
        employeePermissions,
        productionTasks,
        moveProductionTask,
        refreshOrders,
        permissions,
        employees
    } = useData();
    const {
        user: currentUser,
        isAdmin
    } = useAuth();

    const empId = currentUser?.employeeId;
    const activeEmployee = employees?.find((e) => e.id === empId);
    const activeDept = activeEmployee?.department || currentUser?.department;
    const empPerms = employeePermissions?.[empId] || [];
    const deptPerms = permissions[activeDept] || [];
    const isLogisticDept = (activeDept || '').toLowerCase().includes('logistic');
    const hasLogisticPerm = empPerms.includes('logistics') || deptPerms.includes('logistics');
    const canAct = isAdmin || isLogisticDept || hasLogisticPerm;

    const [
        search,
        setSearch
    ] = useState('');
    const [
        filterStatus,
        setFilterStatus
    ] = useState('');
    const [
        detailTask,
        setDetailTask
    ] = useState(null);

    useEffect(() => {
        refreshProductionTasks();
        refreshOrders();
    }, []);

    // Filter tasks that belong to logistics (completed production tasks onwards)
    const logisticTasks = useMemo(() => {
        return (productionTasks || []).filter((task) => {
            const norm = normalizeStatus(task.status);
            return LOGISTIC_STATUSES.includes(norm);
        });
    }, [productionTasks]);

    // Keep detailTask updated if productionTasks refreshed
    useEffect(() => {
        if(!detailTask) {
            return;
        }
        const updated = (productionTasks || []).find((t) => t.id === detailTask.id);
        if(updated) {
            setDetailTask(updated);
        }
    }, [productionTasks]);

    const filteredTasks = useMemo(() => {
        return logisticTasks.filter((task) => {
            const norm = normalizeStatus(task.status);
            if(filterStatus && norm !== filterStatus) {
                return false;
            }
            if(!search) {
                return true;
            }
            const q = search.toLowerCase();
            const code = (task.code || '').toLowerCase();
            const orderCode = (task.orderItem?.order?.code || '').toLowerCase();
            const customerName = (task.orderItem?.order?.customer?.name || '').toLowerCase();
            const customerCode = (task.orderItem?.order?.customer?.accountCode || task.orderItem?.order?.customer?.code || '').toLowerCase();
            const productName = (task.orderItem?.productName || task.product?.name || '').toLowerCase();
            const stockNo = (task.orderItem?.product?.stockNo || task.product?.stockNo || '').toLowerCase();

            return (
                code.includes(q) ||
                orderCode.includes(q) ||
                customerName.includes(q) ||
                customerCode.includes(q) ||
                productName.includes(q) ||
                stockNo.includes(q)
            );
        });
    }, [logisticTasks, filterStatus, search]);

    const counts = useMemo(() => {
        return LOGISTIC_STATUSES.reduce((acc, s) => {
            acc[s] = logisticTasks.filter((task) => normalizeStatus(task.status) === s).length;
            return acc;
        }, {});
    }, [logisticTasks]);

    const handleAdvance = async (taskId, nextStatus) => {
        try {
            await moveProductionTask(taskId, nextStatus);
            setDetailTask((prev) => {
                if(!prev || prev.id !== taskId) {
                    return prev;
                }
                return {
                    ...prev,
                    status: nextStatus
                };
            });
        } catch (err) {
            alert(t('common.error', 'Hata') + ': ' + (err.message || 'Durum güncellenemedi'));
        }
    };

    const handleRefresh = () => {
        refreshProductionTasks();
        refreshOrders();
    };

    return (
        <div className="p-3 md:p-8 max-w-7xl mx-auto pb-24">
            {/* Header */}
            <div className="flex flex-row items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-on-surface tracking-tight">
                        {t('logistics.title', 'Lojistik')}
                    </h1>
                    <p className="text-xs md:text-sm text-text-muted mt-0.5">
                        {t('logistics.totalTasks', { count: logisticTasks.length, defaultValue: `${logisticTasks.length} parça lojistikte` })}
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="flex items-center gap-1.5 border border-theme-border px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold text-text-muted hover:bg-hover-bg hover:text-on-surface transition cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[15px] md:text-base">refresh</span>
                    <span>{t('common.refresh', 'Yenile')}</span>
                </button>
            </div>

            {/* Status Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                {LOGISTIC_STATUSES.map((statusKey) => {
                    const isSelected = filterStatus === statusKey;
                    return (
                        <div
                            key={statusKey}
                            onClick={() => setFilterStatus(isSelected ? '' : statusKey)}
                            className={`rounded-xl md:rounded-2xl border border-theme-border bg-surface-container-lowest p-3 md:p-4 transition cursor-pointer ${
                                isSelected
                                    ? 'border-primary ring-1 ring-primary'
                                    : 'hover:border-primary/40'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5 md:mb-2">
                                <span className={`material-symbols-outlined text-xl md:text-2xl ${statusColor[statusKey]}`}>
                                    {statusIcon[statusKey]}
                                </span>
                                <span className="text-lg md:text-2xl font-bold text-on-surface">
                                    {counts[statusKey] || 0}
                                </span>
                            </div>
                            <p className="text-[10px] md:text-xs font-semibold text-text-muted uppercase tracking-wide md:tracking-wider leading-tight">
                                {getStatusLabel(statusKey, t)}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row items-center gap-2.5 md:gap-3 mb-5">
                <div className="relative w-full md:flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-base md:text-lg">
                        search
                    </span>
                    <input
                        className="w-full bg-surface-container-lowest border border-theme-border rounded-xl pl-9 pr-9 py-2.5 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition"
                        placeholder={t('logistics.searchPlaceholder', 'Görev kodu, sipariş, müşteri veya ürün ara...')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {(search || filterStatus) && (
                        <button
                            onClick={() => { setSearch(''); setFilterStatus(''); }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 text-text-muted hover:text-error transition cursor-pointer"
                            title={t('common.clear', 'Temizle')}
                        >
                            <span className="material-symbols-outlined text-base">close</span>
                        </button>
                    )}
                </div>
                <select
                    className="w-full md:w-auto bg-surface-container-lowest border border-theme-border rounded-xl px-3.5 py-2.5 text-xs md:text-sm font-semibold text-on-surface outline-none focus:border-primary cursor-pointer"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="">{t('orders.allStatuses', 'Tüm Durumlar')}</option>
                    {LOGISTIC_STATUSES.map((statusKey) => (
                        <option
                            key={statusKey}
                            value={statusKey}
                        >
                            {getStatusLabel(statusKey, t)}
                        </option>
                    ))}
                </select>
            </div>

            {/* Tasks Table */}
            <div className="bg-transparent xl:bg-surface-container-lowest rounded-2xl xl:border border-theme-border overflow-hidden shadow-xs">
                <table className="w-full text-sm block xl:table">
                    <thead className="hidden xl:table-header-group bg-surface-container-high/60">
                        <tr className="border-b border-theme-border text-text-muted text-[11px] uppercase tracking-wider font-extrabold">
                            <th className="text-left px-4 py-3.5">{t('logistics.taskCode', 'Parça Kodu')}</th>
                            <th className="text-left px-4 py-3.5">{t('logistics.orderCode', 'Sipariş')}</th>
                            <th className="text-left px-4 py-3.5">{t('common.customer', 'Müşteri')}</th>
                            <th className="text-left px-4 py-3.5">{t('orders.product', 'Ürün')}</th>
                            <th className="text-right px-4 py-3.5">{t('logistics.itemQty', 'Parça Miktarı')}</th>
                            <th className="text-right px-4 py-3.5">{t('logistics.totalAmount', 'Tutar')}</th>
                            <th className="text-left px-4 py-3.5">{t('common.status', 'Durum')}</th>
                            <th className="text-left px-4 py-3.5">{t('common.date', 'Tarih')}</th>
                        </tr>
                    </thead>
                    <tbody className="block xl:table-row-group">
                        {filteredTasks.length === 0 ? (
                            <tr className="block xl:table-row w-full">
                                <td
                                    colSpan={8}
                                    className="block xl:table-cell w-full text-center py-16 text-text-muted bg-surface-container-lowest rounded-2xl xl:rounded-none"
                                >
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="w-12 h-12 rounded-2xl bg-surface-container-high/60 flex items-center justify-center text-text-muted">
                                            <span className="material-symbols-outlined text-3xl">local_shipping</span>
                                        </div>
                                        <p className="text-sm font-semibold">{t('logistics.noData', 'Lojistikte parça bulunmuyor')}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredTasks.map((task) => {
                                const currentStatus = normalizeStatus(task.status);
                                const orderItem = task.orderItem;
                                const parentOrder = orderItem?.order;
                                const customer = parentOrder?.customer;
                                const currency = orderItem?.currency || 'TRY';
                                const unitPrice = parseFloat(orderItem?.unitPrice) || 0;
                                const taskTotal = unitPrice * (parseInt(task.quantity, 10) || 0);
                                const unit = orderItem?.product?.unit || task.product?.unit || 'adet';
                                const dateStr = task.date || (task.createdAt ? new Date(task.createdAt).toLocaleDateString('tr-TR') : '—');

                                return (
                                    <tr
                                        key={task.id}
                                        onClick={() => setDetailTask(task)}
                                        className="block xl:table-row border border-theme-border xl:border-b xl:border-0 xl:border-b-theme-border rounded-2xl xl:rounded-none bg-surface-container-lowest mb-3 xl:mb-0 hover:bg-hover-bg transition-colors cursor-pointer p-4 xl:p-0"
                                    >
                                        {/* Task Code */}
                                        <td className="block xl:table-cell px-2 xl:px-4 py-1 xl:py-3.5">
                                            <div className="flex items-center justify-between xl:justify-start">
                                                <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                                    {t('logistics.taskCode', 'Parça Kodu')}
                                                </span>
                                                <span className="font-mono text-xs font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                                                    {task.code}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Order Code */}
                                        <td className="block xl:table-cell px-2 xl:px-4 py-1 xl:py-3.5">
                                            <div className="flex items-center justify-between xl:justify-start">
                                                <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                                    {t('orders.order', 'Sipariş')}
                                                </span>
                                                <span className="font-mono text-xs font-bold text-on-surface bg-surface-container-high px-2 py-0.5 rounded">
                                                    {parentOrder?.code || '—'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Customer */}
                                        <td className="block xl:table-cell px-2 xl:px-4 py-1 xl:py-3.5">
                                            <div className="flex items-center justify-between xl:justify-start">
                                                <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                                    {t('common.customer', 'Müşteri')}
                                                </span>
                                                <div className="flex flex-col items-end xl:items-start text-xs">
                                                    <span className="font-bold text-on-surface line-clamp-1">
                                                        {customer?.name || '—'}
                                                    </span>
                                                    {(customer?.accountCode || customer?.code) && (
                                                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                                                            {customer.accountCode || customer.code}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Product */}
                                        <td className="block xl:table-cell px-2 xl:px-4 py-1 xl:py-3.5">
                                            <div className="flex items-center justify-between xl:justify-start">
                                                <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                                    {t('orders.product', 'Ürün')}
                                                </span>
                                                <span className="text-xs text-on-surface font-semibold truncate max-w-[220px]" title={orderItem?.productName || task.product?.name}>
                                                    {orderItem?.productName || task.product?.name || '—'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Quantity */}
                                        <td className="block xl:table-cell px-2 xl:px-4 py-1 xl:py-3.5">
                                            <div className="flex items-center justify-between xl:justify-end">
                                                <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                                    {t('orders.qty', 'Miktar')}
                                                </span>
                                                <div className="text-right">
                                                    <span className="text-xs font-black text-on-surface">
                                                        {task.quantity} {unit}
                                                    </span>
                                                    {orderItem?.quantity && orderItem.quantity !== task.quantity && (
                                                        <span className="block text-[10px] text-text-muted">
                                                            (Top: {orderItem.quantity})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Amount */}
                                        <td className="block xl:table-cell px-2 xl:px-4 py-1 xl:py-3.5">
                                            <div className="flex items-center justify-between xl:justify-end">
                                                <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                                    {t('logistics.totalAmount', 'Tutar')}
                                                </span>
                                                <span className="text-xs font-extrabold text-emerald-400 font-mono text-right">
                                                    <span className="text-[10px] text-text-muted mr-1">{currency}</span>
                                                    {taskTotal.toFixed(2)}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="block xl:table-cell px-2 xl:px-4 py-1 xl:py-3.5">
                                            <div className="flex items-center justify-between xl:justify-start">
                                                <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                                    {t('common.status', 'Durum')}
                                                </span>
                                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyle[currentStatus] || 'bg-surface-container-high text-text-muted'}`}>
                                                    {getStatusLabel(currentStatus, t)}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Date */}
                                        <td className="block xl:table-cell px-2 xl:px-4 py-1 xl:py-3.5">
                                            <div className="flex items-center justify-between xl:justify-start">
                                                <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                                    {t('common.date', 'Tarih')}
                                                </span>
                                                <span className="text-xs text-text-muted font-mono whitespace-nowrap">
                                                    {dateStr}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Task Detail Modal */}
            {detailTask && (
                <TaskDetailModal
                    task={detailTask}
                    canAct={canAct}
                    onClose={() => setDetailTask(null)}
                    onAdvance={handleAdvance}
                />
            )}
        </div>
    );
}
