import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function CreateProductionTaskModal({
    onClose,
    onSave,
    isSaving = false,
    machines,
    employees,
    orders,
    products
}) {
    const { t } = useTranslation();

    const [
        mode,
        setMode
    ] = useState('order');

    const [
        orderId,
        setOrderId
    ] = useState('');

    const [
        orderItemId,
        setOrderItemId
    ] = useState('');

    const [
        productId,
        setProductId
    ] = useState('');

    const todayIso = new Date().toISOString().split('T')[0];

    const [
        form,
        setForm
    ] = useState({
        extrusionMachineId: '',
        extrusionOperatorId: '',
        cuttingMachineId: '',
        cuttingOperatorId: '',
        quantity: '',
        date: todayIso
    });

    const [
        errors,
        setErrors
    ] = useState({});

    const set = (f) => (e) => {
        let val = e.target.value;
        if(f === 'quantity') {
            val = String(val).replace(/,/g, '.');
            val = val.replace(/[^0-9.]/g, '');
            const parts = val.split('.');
            if(parts.length > 2) {
                val = parts[0] + '.' + parts.slice(1).join('');
            }
        }
        setForm((p) => ({
            ...p,
            [f]: val
        }));
    };

    const extrusionMachines = machines.filter(m => m.type === 'Extrusion' || !m.type || m.type === 'General');
    const cuttingMachines = machines.filter(m => m.type === 'Cutting' || !m.type || m.type === 'General');

    const PRODUCTION_STATUSES = [
        'Confirmed',
        'In-Production',
        'Production Completed'
    ];

    const availableOrders = useMemo(() => {
        return orders.filter(o => PRODUCTION_STATUSES.includes(o.status));
    }, [
        orders
    ]);

    const selectedOrder = useMemo(() => {
        return availableOrders.find(o => o.id === orderId);
    }, [
        orderId,
        availableOrders
    ]);

    const orderItems = useMemo(() => {
        if(!selectedOrder) {
            return [];
        }
        return (selectedOrder.items || []).map(it => {
            const produced = it.producedQuantity || 0;
            const inProd = it.inProductionQuantity || 0;
            const remaining = it.quantity - produced - inProd;
            return {
                ...it,
                remaining
            };
        });
    }, [
        selectedOrder
    ]);

    const selectedItem = useMemo(() => {
        return orderItems.find(it => it.id === orderItemId);
    }, [
        orderItemId,
        orderItems
    ]);

    const hasAvailableItems = orderItems.some(it => it.remaining > 0);

    useEffect(() => {
        setOrderItemId('');
        setForm(p => ({
            ...p,
            quantity: ''
        }));
    }, [
        orderId
    ]);

    useEffect(() => {
        if(selectedItem) {
            setForm(p => ({
                ...p,
                quantity: selectedItem.remaining
            }));
        }
    }, [
        selectedItem
    ]);

    function handleSave() {
        if(isSaving) {
            return;
        }
        const e = {};
        
        const parsedQty = parseFloat(String(form.quantity).replace(',', '.'));
        if(mode === 'order') {
            if(!orderId) {
                e.orderId = 'Required';
            }
            if(!orderItemId) {
                e.orderItemId = 'Required';
            }
            if(!form.quantity || isNaN(parsedQty) || parsedQty <= 0 || (selectedItem && parsedQty > selectedItem.remaining)) {
                e.quantity = 'Invalid';
            }
        } else {
            if(!productId) {
                e.productId = 'Required';
            }
            if(!form.quantity || isNaN(parsedQty) || parsedQty <= 0) {
                e.quantity = 'Invalid';
            }
        }

        if(!form.date) {
            e.date = 'Required';
        }

        if(Object.keys(e).length > 0) {
            setErrors(e);
            return;
        }

        const payload = {
            ...form,
            quantity: parsedQty,
            source: mode
        };

        if(mode === 'order') {
            payload.orderItemId = orderItemId;
        } else {
            payload.productId = productId;
        }

        onSave(payload);
    }

    return (
        <div 
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3 md:p-6" 
            onClick={isSaving ? undefined : onClose}
        >
            <div 
                className="bg-surface-container-lowest rounded-2xl shadow-xl w-[95%] md:w-[500px] max-w-none p-4 md:p-6 flex flex-col" 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-on-surface">Yeni Görev Oluştur</h2>
                    <button 
                        onClick={onClose} 
                        disabled={isSaving}
                        className="text-text-muted hover:text-error disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex items-center gap-2 mb-6 bg-surface-container-high p-1 rounded-xl">
                    <button
                        onClick={() => setMode('order')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'order' ? 'bg-surface-container-lowest text-primary shadow' : 'text-text-muted hover:text-on-surface'}`}
                    >
                        Sipariş
                    </button>
                    <button
                        onClick={() => setMode('stock')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'stock' ? 'bg-surface-container-lowest text-primary shadow' : 'text-text-muted hover:text-on-surface'}`}
                    >
                        Stok
                    </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
                    {mode === 'order' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-muted mb-1">
                                    {t('orders.order')} *
                                </label>
                                <select 
                                    className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-sm text-on-surface outline-none focus:border-primary ${errors.orderId ? 'border-error' : 'border-theme-border'}`} 
                                    value={orderId} 
                                    onChange={(e) => setOrderId(e.target.value)}
                                >
                                    <option value="">{t('common.select')}</option>
                                    {availableOrders.map(o => (
                                        <option 
                                            key={o.id} 
                                            value={o.id}
                                        >
                                            {o.code} - {o.customer?.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {orderId && (
                                <div>
                                    <label className="block text-xs font-semibold text-text-muted mb-1">
                                        Kalem *
                                    </label>
                                    {!hasAvailableItems ? (
                                        <p className="text-sm font-semibold text-error bg-error/10 p-2 rounded">
                                            Bu siparişe ait üretime gönderilecek uygun kalem bulunmuyor.
                                        </p>
                                    ) : (
                                        <select 
                                            className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-sm text-on-surface outline-none focus:border-primary ${errors.orderItemId ? 'border-error' : 'border-theme-border'}`} 
                                            value={orderItemId} 
                                            onChange={(e) => setOrderItemId(e.target.value)}
                                        >
                                            <option value="">{t('common.select')}</option>
                                            {orderItems.filter(it => it.remaining > 0).map(it => (
                                                <option 
                                                    key={it.id} 
                                                    value={it.id}
                                                >
                                                    {it.productName} (Kalan: {it.remaining})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {selectedItem && (
                                        <div className="flex gap-1.5 text-[10px] md:text-xs font-bold items-center mt-3 bg-surface-container-high/50 p-2.5 rounded-lg border border-theme-border justify-center">
                                            <span className="text-text-muted bg-surface-container-high px-2 py-1 rounded" title={t('orders.remaining')}>
                                                Kalan: {selectedItem.remaining}
                                            </span>
                                            <span className="text-white bg-orange-500 px-2 py-1 rounded shadow-sm" title={t('production.inProduction')}>
                                                Üretimde: {selectedItem.inProductionQuantity || 0}
                                            </span>
                                            <span className="text-green-700 bg-green-100 px-2 py-1 rounded" title={t('production.produced')}>
                                                Tamamlanan: {selectedItem.producedQuantity || 0}
                                            </span>
                                            <span className="text-text-muted mx-1">=</span>
                                            <span className="text-primary bg-primary/10 px-2.5 py-1 rounded font-extrabold" title={t('orders.total')}>
                                                Toplam: {selectedItem.quantity}
                                            </span>
                                        </div>
                                    )}
                                    {selectedItem?.notes && selectedItem.notes.length > 0 && (
                                        <div className="mt-2.5 bg-red-50/70 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40 rounded-xl p-3">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <span className="material-symbols-outlined text-[15px] text-red-600 dark:text-red-400">
                                                    sticky_note_2
                                                </span>
                                                <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                                                    {t('orders.itemNotes', 'Kalem Notları')} ({selectedItem.notes.length})
                                                </span>
                                            </div>
                                            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                                                {selectedItem.notes.map((n) => (
                                                    <div 
                                                        key={n.id} 
                                                        className="bg-surface-container-lowest p-2 rounded-lg border border-theme-border/50 text-[11px]"
                                                    >
                                                        <div className="flex items-center justify-between text-[10px] text-red-700 dark:text-red-300 font-semibold mb-0.5">
                                                            <span>{n.authorName || 'Kullanıcı'}</span>
                                                            <span className="font-mono opacity-70">
                                                                {new Date(n.createdAt).toLocaleDateString('tr-TR')}
                                                            </span>
                                                        </div>
                                                        <p className="text-on-surface whitespace-pre-wrap">{n.note}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'stock' && (
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-1">
                                {t('nav.products')} *
                            </label>
                            <select 
                                className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-sm text-on-surface outline-none focus:border-primary ${errors.productId ? 'border-error' : 'border-theme-border'}`} 
                                value={productId} 
                                onChange={(e) => setProductId(e.target.value)}
                            >
                                <option value="">{t('common.select')}</option>
                                {products.map(p => (
                                    <option 
                                        key={p.id} 
                                        value={p.id}
                                    >
                                        {p.stockNo} - {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="space-y-3 bg-surface-container-high/50 p-3 rounded-xl border border-theme-border">
                            <h3 className="text-xs font-bold text-on-surface flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">precision_manufacturing</span> 
                                {t('production.extrusionPlan')}
                            </h3>
                            <div>
                                <label className="block text-[10px] font-semibold text-text-muted mb-1">
                                    {t('productionTasks.machine')}
                                </label>
                                <select 
                                    className="w-full bg-surface-container-lowest border rounded px-3 py-2 text-[11px] text-on-surface outline-none focus:border-primary border-theme-border" 
                                    value={form.extrusionMachineId} 
                                    onChange={set('extrusionMachineId')}
                                >
                                    <option value="">{t('common.select')}</option>
                                    {extrusionMachines.map(m => (
                                        <option 
                                            key={m.id} 
                                            value={m.id}
                                        >
                                            {m.name} ({m.type || 'General'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-text-muted mb-1">
                                    {t('productionTasks.operator')}
                                </label>
                                <select 
                                    className="w-full bg-surface-container-lowest border rounded px-3 py-2 text-[11px] text-on-surface outline-none focus:border-primary border-theme-border" 
                                    value={form.extrusionOperatorId} 
                                    onChange={set('extrusionOperatorId')}
                                >
                                    <option value="">{t('common.select')}</option>
                                    {employees.map(e => (
                                        <option 
                                            key={e.id} 
                                            value={e.id}
                                        >
                                            {e.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3 bg-surface-container-high/50 p-3 rounded-xl border border-theme-border">
                            <h3 className="text-xs font-bold text-on-surface flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">content_cut</span> 
                                {t('production.cuttingPlan')}
                            </h3>
                            <div>
                                <label className="block text-[10px] font-semibold text-text-muted mb-1">
                                    {t('productionTasks.machine')}
                                </label>
                                <select 
                                    className="w-full bg-surface-container-lowest border rounded px-3 py-2 text-[11px] text-on-surface outline-none focus:border-primary border-theme-border" 
                                    value={form.cuttingMachineId} 
                                    onChange={set('cuttingMachineId')}
                                >
                                    <option value="">{t('common.select')}</option>
                                    {cuttingMachines.map(m => (
                                        <option 
                                            key={m.id} 
                                            value={m.id}
                                        >
                                            {m.name} ({m.type || 'General'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-text-muted mb-1">
                                    {t('productionTasks.operator')}
                                </label>
                                <select 
                                    className="w-full bg-surface-container-lowest border rounded px-3 py-2 text-[11px] text-on-surface outline-none focus:border-primary border-theme-border" 
                                    value={form.cuttingOperatorId} 
                                    onChange={set('cuttingOperatorId')}
                                >
                                    <option value="">{t('common.select')}</option>
                                    {employees.map(e => (
                                        <option 
                                            key={e.id} 
                                            value={e.id}
                                        >
                                            {e.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-1">
                                {t('common.date') || 'Tarih'} *
                            </label>
                            <input 
                                type="date" 
                                min={todayIso}
                                className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-sm text-on-surface outline-none focus:border-primary ${errors.date ? 'border-error' : 'border-theme-border'}`} 
                                value={form.date} 
                                onChange={set('date')} 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-1">
                                {t('orders.qty')} *
                            </label>
                            <input 
                                type="text" 
                                inputMode="decimal"
                                placeholder="1"
                                className={`w-full bg-surface-container-lowest border rounded px-3 py-2 text-sm text-on-surface outline-none focus:border-primary ${errors.quantity ? 'border-error' : 'border-theme-border'}`} 
                                value={form.quantity} 
                                onChange={set('quantity')} 
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button 
                        onClick={onClose} 
                        disabled={isSaving}
                        className="flex-1 border border-theme-border rounded-lg py-2 text-sm text-text-muted hover:bg-hover-bg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                        {isSaving ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                <span>Kaydediliyor...</span>
                            </>
                        ) : (
                            t('common.save')
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
