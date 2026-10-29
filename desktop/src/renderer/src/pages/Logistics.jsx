import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

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
    if (!status) {
        return 'completed';
    }
    const lower = String(status).trim().toLowerCase();
    if (lower === 'completed' || lower === 'production completed' || lower === 'tamamlandı' || lower === 'üretim tamamlandı') {
        return 'completed';
    }
    if (lower === 'in delivery' || lower === 'in_delivery' || lower === 'teslimatta') {
        return 'In Delivery';
    }
    if (lower === 'invoiced' || lower === 'in_voiced' || lower === 'fatura kesildi' || lower === 'e-invoice' || lower === 'e-fatura') {
        return 'Invoiced';
    }
    if (lower === 'delivered' || lower === 'teslim edildi') {
        return 'Delivered';
    }
    return status;
};

const getStatusLabel = (status, t) => {
    const norm = normalizeStatus(status);
    if (norm === 'completed') {
        return t('logistics.statusCompleted', 'Tamamlandı');
    }
    if (norm === 'In Delivery') {
        return t('logistics.statusInDelivery', 'Teslimatta');
    }
    if (norm === 'Invoiced') {
        return t('logistics.statusInvoiced', 'Fatura kesildi');
    }
    if (norm === 'Delivered') {
        return t('logistics.statusDelivered', 'Teslim Edildi');
    }
    return norm;
};

const getPhotoFullUrl = (url) => {
    if (!url) {
        return '';
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    const base = API_URL.replace(/\/api\/?$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

// ─── Delivery Dispatch Modal ─────────────────────────────────────────────────
const DeliveryDispatchModal = ({
    task,
    onClose,
    onSuccess
}) => {
    const { t } = useTranslation();
    const {
        employees,
        vehicles,
        createProductionTaskDelivery
    } = useData();

    const [
        isOutsource,
        setIsOutsource
    ] = useState(false);
    const [
        carrierEmployeeId,
        setCarrierEmployeeId
    ] = useState('');
    const [
        carrierName,
        setCarrierName
    ] = useState('');
    const [
        vehicleId,
        setVehicleId
    ] = useState('');
    const [
        vehicleInfo,
        setVehicleInfo
    ] = useState('');
    const [
        notes,
        setNotes
    ] = useState('');
    const [
        photoBlob,
        setPhotoBlob
    ] = useState(null);
    const [
        photoPreview,
        setPhotoPreview
    ] = useState(null);
    const [
        cameraActive,
        setCameraActive
    ] = useState(false);
    const [
        submitting,
        setSubmitting
    ] = useState(false);
    const [
        formError,
        setFormError
    ] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const startCamera = async () => {
        try {
            setFormError(null);
            setCameraActive(true);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            setFormError('Kamera açılamadı: ' + (err.message || 'Erişim izni verilmedi.'));
            setCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject;
            const tracks = stream.getTracks();
            tracks.forEach((track) => track.stop());
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) {
            return;
        }
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (blob) {
                setPhotoBlob(blob);
                setPhotoPreview(URL.createObjectURL(blob));
                stopCamera();
            }
        }, 'image/jpeg', 0.85);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoBlob(file);
            setPhotoPreview(URL.createObjectURL(file));
            stopCamera();
        }
    };

    const handleSubmit = async (e) => {
        if (e) {
            e.preventDefault();
        }
        setFormError(null);

        if (!isOutsource && !carrierEmployeeId) {
            setFormError('Lütfen sevkiyatı yapacak şirket personelini seçiniz.');
            return;
        }
        if (isOutsource && !carrierName.trim()) {
            setFormError('Lütfen outsource sevkiyat sorumlusu / firma adını giriniz.');
            return;
        }

        if (!isOutsource && !vehicleId) {
            setFormError('Lütfen sevkiyat aracını seçiniz.');
            return;
        }

        if (isOutsource && !vehicleInfo.trim()) {
            setFormError('Lütfen araç / plaka bilgisini giriniz.');
            return;
        }

        if (!photoBlob) {
            setFormError('Lütfen araca yükleme / sevkiyat fotoğrafını ekleyiniz. Fotoğraf eklenmesi zorunludur.');
            return;
        }

        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('isOutsource', String(isOutsource));
            if (!isOutsource) {
                formData.append('carrierEmployeeId', carrierEmployeeId);
                const emp = (employees || []).find((e) => e.id === carrierEmployeeId);
                if (emp) {
                    formData.append('carrierName', emp.name);
                }
                formData.append('vehicleId', vehicleId);
                const veh = (vehicles || []).find((v) => v.id === vehicleId);
                if (veh) {
                    formData.append('vehicleInfo', `${veh.name} (${veh.brand} ${veh.model})`);
                }
            } else {
                formData.append('carrierName', carrierName.trim());
                formData.append('vehicleInfo', vehicleInfo.trim());
            }
            if (notes.trim()) {
                formData.append('notes', notes.trim());
            }
            if (photoBlob) {
                formData.append('photo', photoBlob, 'delivery_cargo.jpg');
            }

            await createProductionTaskDelivery(task.id, formData);
            stopCamera();
            if (onSuccess) {
                onSuccess();
            }
        } catch (err) {
            setFormError(err.message || 'Teslimat kaydedilemedi.');
        } finally {
            setSubmitting(false);
        }
    };

    const orderItem = task.orderItem;
    const parentOrder = orderItem?.order;
    const unit = orderItem?.product?.unit || task.product?.unit || 'adet';

    return (
        <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-3 md:p-6"
            onClick={() => !submitting && onClose()}
        >
            <div
                className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-theme-border w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="primary-gradient text-white px-5 py-3.5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-lg">local_shipping</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-sm md:text-base leading-tight">
                                {t('logistics.dispatchTitle', 'Teslimat Çıkışı (Teslimatta)')}
                            </h3>
                            <div className="flex items-center gap-2 text-[10px] md:text-xs text-white/80 mt-0.5">
                                <span className="font-mono">{task.code}</span>
                                {parentOrder?.code && <span>• #{parentOrder.code}</span>}
                                <span>• {task.quantity} {unit}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => !submitting && onClose()}
                        className="text-white/80 hover:text-white transition p-1 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-4 md:p-5 overflow-y-auto space-y-4 text-xs">
                    {/* Error Banner */}
                    {formError && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl p-3 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">error</span>
                                <span>{formError}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormError(null)}
                                className="hover:opacity-75 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>
                    )}

                    {/* Carrier Type Toggle */}
                    <div>
                        <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                            {t('logistics.carrierType', 'Sevkiyat Türü')}
                        </label>
                        <div className="flex p-1 bg-surface-container rounded-xl border border-theme-border/50">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOutsource(false);
                                    setCarrierName('');
                                    setVehicleInfo('');
                                }}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${!isOutsource
                                        ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                                        : 'text-text-muted hover:text-on-surface'
                                    }`}
                            >
                                {t('logistics.companyStaff', 'Şirket Personeli')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOutsource(true);
                                    setCarrierEmployeeId('');
                                    setVehicleId('');
                                }}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${isOutsource
                                        ? 'bg-surface-container-lowest text-on-surface shadow-xs'
                                        : 'text-text-muted hover:text-on-surface'
                                    }`}
                            >
                                {t('logistics.outsource', 'Outsource (Dış Nakliye / Kargo)')}
                            </button>
                        </div>
                    </div>

                    {/* Carrier Person (Mandatory) */}
                    <div>
                        {!isOutsource ? (
                            <div>
                                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                                    {t('logistics.selectStaff', 'Sevkiyatı Yapacak Personel')} <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={carrierEmployeeId}
                                    onChange={(e) => setCarrierEmployeeId(e.target.value)}
                                    className="w-full bg-surface-container border border-theme-border rounded-xl px-3 py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition cursor-pointer"
                                >
                                    <option value="">— Personel Seçiniz —</option>
                                    {(employees || []).map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name} {emp.department ? `(${emp.department})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                                    {t('logistics.outsourceCarrierName', 'Sevkiyat Sorumlusu / Firma Adı')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder={t('logistics.outsourceCarrierPlaceholder', 'örn: Aras Kargo, Mehmet Bey veya Dadaş Nakliyat')}
                                    value={carrierName}
                                    onChange={(e) => setCarrierName(e.target.value)}
                                    className="w-full bg-surface-container border border-theme-border rounded-xl px-3 py-2 text-xs md:text-sm text-on-surface placeholder:text-text-muted outline-none focus:border-primary transition"
                                />
                            </div>
                        )}
                    </div>

                    {/* Vehicle Selection or Input (Mandatory) */}
                    <div>
                        {!isOutsource ? (
                            <div>
                                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                                    {t('logistics.selectVehicle', 'Sevkiyat Aracı')} <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={vehicleId}
                                    onChange={(e) => setVehicleId(e.target.value)}
                                    className="w-full bg-surface-container border border-theme-border rounded-xl px-3 py-2 text-xs md:text-sm text-on-surface outline-none focus:border-primary transition cursor-pointer"
                                >
                                    <option value="">— Araç Seçiniz —</option>
                                    {(vehicles || []).map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.name} ({v.brand} {v.model})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                                    {t('logistics.outsourceVehicle', 'Araç / Plaka / Sevkiyat Bilgisi')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder={t('logistics.outsourceVehiclePlaceholder', 'örn: 34 XYZ 99 veya Kiralık Kamyonet')}
                                    value={vehicleInfo}
                                    onChange={(e) => setVehicleInfo(e.target.value)}
                                    className="w-full bg-surface-container border border-theme-border rounded-xl px-3 py-2 text-xs md:text-sm text-on-surface placeholder:text-text-muted outline-none focus:border-primary transition"
                                />
                            </div>
                        )}
                    </div>

                    {/* Photo Capture & Upload */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                {t('logistics.deliveryPhoto', 'Araca Yükleme Fotoğrafı')} <span className="text-red-500">*</span>
                            </label>
                            {!photoPreview && (
                                <span className="text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                                    Zorunlu
                                </span>
                            )}
                        </div>

                        {/* Hidden canvas for snapshot */}
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Live Camera View */}
                        {cameraActive && (
                            <div className="bg-black rounded-xl overflow-hidden mb-3 relative flex flex-col items-center border border-theme-border">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full max-h-52 object-contain"
                                />
                                <div className="p-2.5 w-full flex items-center justify-center gap-3 bg-surface-container-high/90">
                                    <button
                                        type="button"
                                        onClick={capturePhoto}
                                        className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-base">photo_camera</span>
                                        <span>{t('logistics.captureSnapshot', 'Fotoğrafı Yakala')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={stopCamera}
                                        className="flex items-center gap-1 border border-theme-border text-text-muted px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:text-on-surface transition cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-sm">close</span>
                                        <span>{t('logistics.closeCamera', 'Kapat')}</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Photo Preview Card */}
                        {photoPreview && !cameraActive && (
                            <div className="relative rounded-xl overflow-hidden border border-theme-border bg-surface-container p-2.5 flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <img
                                        src={photoPreview}
                                        alt="Önizleme"
                                        className="w-16 h-16 object-cover rounded-lg border border-theme-border/60"
                                    />
                                    <div>
                                        <p className="text-xs font-bold text-on-surface">Fotoğraf Eklendi</p>
                                        <p className="text-[10px] text-text-muted">Araca yüklenen durumun görseli kaydedilecektir.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPhotoBlob(null);
                                        setPhotoPreview(null);
                                    }}
                                    className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                                    title={t('logistics.removePhoto', 'Fotoğrafı Kaldır')}
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>
                        )}

                        {/* Buttons to trigger Camera or File Picker */}
                        {!photoPreview && !cameraActive && (
                            <div className="space-y-1.5">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={startCamera}
                                        className="flex items-center justify-center gap-1.5 border border-theme-border bg-surface-container hover:bg-surface-container-high p-2.5 rounded-xl text-xs font-semibold text-on-surface transition cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-base text-primary">photo_camera</span>
                                        <span>{t('logistics.takePhoto', 'Kameradan Çek')}</span>
                                    </button>

                                    <label className="flex items-center justify-center gap-1.5 border border-theme-border bg-surface-container hover:bg-surface-container-high p-2.5 rounded-xl text-xs font-semibold text-on-surface transition cursor-pointer">
                                        <span className="material-symbols-outlined text-base text-blue-500">upload_file</span>
                                        <span>{t('logistics.selectFile', 'Dosyadan Seç')}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                                <p className="text-[10px] text-text-muted italic text-center">
                                    * Sevkiyatı yapan personel ve araca yüklenen ürünün görselini kameradan çekin veya dosyadan yükleyin (Zorunludur).
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Dispatch Notes */}
                    <div>
                        <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                            {t('logistics.deliveryNotes', 'Sevkiyat Notu (İsteğe Bağlı)')}
                        </label>
                        <textarea
                            rows={2}
                            placeholder={t('logistics.deliveryNotesPlaceholder', 'Yükleme durumu veya teslimat ile ilgili ek açıklama...')}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-surface-container border border-theme-border rounded-xl px-3 py-2 text-xs md:text-sm text-on-surface placeholder:text-text-muted outline-none focus:border-primary transition resize-none"
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-2.5 pt-3 border-t border-theme-border">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => {
                                stopCamera();
                                onClose();
                            }}
                            className="flex-1 border border-theme-border rounded-xl py-2 text-xs font-semibold text-text-muted hover:bg-surface-container transition cursor-pointer"
                        >
                            {t('common.cancel', 'Vazgeç')}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 primary-gradient text-white rounded-xl py-2 text-xs font-bold hover:opacity-95 shadow-md shadow-primary/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            {submitting ? (
                                <>
                                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                    <span>{t('common.saving', 'Kaydediliyor...')}</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-sm">local_shipping</span>
                                    <span>{t('logistics.confirmDispatch', 'Teslimata Çıkar & Kaydet')}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Task Detail Modal ────────────────────────────────────────────────────────
const TaskDetailModal = ({
    onAdvance,
    onClose,
    canAct,
    isAdmin,
    task
}) => {
    const { t } = useTranslation();
    const {
        deleteProductionTaskDelivery,
        toggleProductionTaskInvoice,
        refreshProductionTasks
    } = useData();

    const [
        confirming,
        setConfirming
    ] = useState(false);
    const [
        togglingInvoice,
        setTogglingInvoice
    ] = useState(false);
    const [
        selectedStatus,
        setSelectedStatus
    ] = useState(normalizeStatus(task.status));
    const [
        showDispatchModal,
        setShowDispatchModal
    ] = useState(false);
    const [
        lightboxPhoto,
        setLightboxPhoto
    ] = useState(null);
    const [
        deletingRecordId,
        setDeletingRecordId
    ] = useState(null);

    const currentStatus = normalizeStatus(task.status);
    const next = statusNext[currentStatus];
    const orderItem = task.orderItem;
    const parentOrder = orderItem?.order;
    const customer = parentOrder?.customer;
    const currency = orderItem?.currency || 'TRY';
    const unitPrice = parseFloat(orderItem?.unitPrice) || 0;
    const taskQuantity = parseFloat(String(task.quantity).replace(',', '.')) || 0;
    const parentQuantity = parseFloat(String(orderItem?.quantity).replace(',', '.')) || taskQuantity;
    const taskTotal = unitPrice * taskQuantity;
    const unit = orderItem?.product?.unit || task.product?.unit || 'adet';
    const notes = orderItem?.notes || [];

    const percentage = parentQuantity > 0 ? Math.min(100, Math.round((taskQuantity / parentQuantity) * 100)) : 100;

    const handleToggleInvoice = async (targetInvoiced) => {
        try {
            setTogglingInvoice(true);
            await toggleProductionTaskInvoice(task.id, targetInvoiced);
        } catch (err) {
            alert(t('common.error', 'Hata') + ': ' + (err.message || 'Fatura durumu güncellenemedi'));
        } finally {
            setTogglingInvoice(false);
        }
    };

    const handleAdvanceDeliveredWithInvoice = async () => {
        try {
            if(!task.isInvoiced) {
                await toggleProductionTaskInvoice(task.id, true);
            }
            await onAdvance(task.id, 'Delivered');
        } catch (err) {
            alert(t('common.error', 'Hata') + ': ' + (err.message || 'İşlem tamamlanamadı'));
        }
    };

    const handleConfirmAdvance = async () => {
        if(!next) {
            return;
        }
        if(next === 'In Delivery') {
            setConfirming(false);
            setShowDispatchModal(true);
            return;
        }
        await onAdvance(task.id, next);
        setConfirming(false);
    };

    const handleDirectChange = async () => {
        if(!selectedStatus || selectedStatus === currentStatus) {
            return;
        }
        if(selectedStatus === 'In Delivery' && (!task.deliveryRecords || task.deliveryRecords.length === 0)) {
            setShowDispatchModal(true);
            return;
        }
        await onAdvance(task.id, selectedStatus);
    };

    const handleDeleteDeliveryRecord = async (deliveryId) => {
        if (!isAdmin) {
            alert('Teslimat kayıtlarını yalnızca sistem yöneticisi (admin) silebilir.');
            return;
        }
        if (!window.confirm(t('logistics.deleteDeliveryConfirm', 'Bu teslimat kaydını silmek istediğinize emin misiniz?'))) {
            return;
        }
        try {
            setDeletingRecordId(deliveryId);
            await deleteProductionTaskDelivery(task.id, deliveryId);
        } catch (err) {
            alert('Hata: ' + (err.message || 'Kayıt silinemedi'));
        } finally {
            setDeletingRecordId(null);
        }
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
                        {currentStatus === 'Delivered' ? (
                            task.isInvoiced ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                    <span className="material-symbols-outlined text-xs">verified</span>
                                    <span>{t('logistics.statusDeliveredInvoiced', 'Teslim Edildi (Faturalı)')}</span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                                    <span className="material-symbols-outlined text-xs">receipt_long</span>
                                    <span>{t('logistics.statusDeliveredNotInvoiced', 'Teslim Edildi (Faturasız)')}</span>
                                </span>
                            )
                        ) : (
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${statusStyle[currentStatus] || 'bg-surface-container-high text-text-muted'}`}>
                                {getStatusLabel(currentStatus, t)}
                            </span>
                        )}
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
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] md:text-xs font-semibold text-text-muted uppercase tracking-wider">
                            {t('logistics.processStatus', 'Lojistik Süreci')}
                        </p>
                        <span className="text-[10px] text-text-muted italic">
                            * Aşamaları değiştirmek veya geri almak için tıklayabilirsiniz
                        </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {LOGISTIC_STATUSES.map((stepKey, idx) => {
                            let isDone = false;
                            let isCurrent = false;
                            let stepTitle = getStatusLabel(stepKey, t);
                            let subBadge = '';

                            if(stepKey === 'completed') {
                                isDone = currentStatus !== 'completed';
                                isCurrent = currentStatus === 'completed';
                            } else if(stepKey === 'In Delivery') {
                                isDone = currentStatus === 'Delivered';
                                isCurrent = currentStatus === 'In Delivery';
                            } else if(stepKey === 'Invoiced') {
                                // Fatura kesildi ONLY if task.isInvoiced is true!
                                isDone = Boolean(task.isInvoiced);
                                isCurrent = false;
                                stepTitle = isDone ? t('logistics.invoiceDone', 'Fatura Kesildi') : t('logistics.invoicePending', 'Fatura Kesilmedi');
                                subBadge = isDone ? 'Tamamlandı' : 'Boşta / Bekliyor';
                            } else if(stepKey === 'Delivered') {
                                isDone = currentStatus === 'Delivered';
                                isCurrent = currentStatus === 'Delivered';
                                subBadge = isDone ? (task.isInvoiced ? 'Faturalı' : 'Faturasız') : '';
                            }

                            let bgClass = 'bg-surface-container-high/60 text-text-muted hover:bg-surface-container-high';
                            let iconName = statusIcon[stepKey];

                            if(stepKey === 'Invoiced') {
                                if(isDone) {
                                    bgClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800';
                                    iconName = 'check_circle';
                                } else {
                                    // Fatura kesilmediğinde BOŞTA OLMALI, YEŞİL OLMAMALI!
                                    bgClass = 'bg-surface-container-high/40 text-text-muted hover:bg-surface-container-high border border-dashed border-theme-border/80';
                                    iconName = 'receipt_long';
                                }
                            } else if(isCurrent) {
                                if(stepKey === 'Delivered') {
                                    bgClass = task.isInvoiced
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-amber-600 text-white shadow-xs';
                                } else {
                                    bgClass = 'bg-primary text-white shadow-xs';
                                }
                            } else if(isDone) {
                                bgClass = 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400';
                                iconName = 'check_circle';
                            }

                            return (
                                <div
                                    key={stepKey}
                                    onClick={() => {
                                        if(!canAct) {
                                            return;
                                        }
                                        if(stepKey === 'Invoiced') {
                                            if(task.isInvoiced) {
                                                if(window.confirm('Fatura kesildi işaretini geri almak (faturasız duruma çevirmek) istiyor musunuz?')) {
                                                    handleToggleInvoice(false);
                                                }
                                            } else {
                                                if(window.confirm('Bu teslimatı Fatura Kesildi olarak işaretlemek istiyor musunuz?')) {
                                                    handleToggleInvoice(true);
                                                }
                                            }
                                        } else if(stepKey === 'In Delivery') {
                                            if(currentStatus === 'Delivered') {
                                                if(window.confirm('Aşamayı geri alıp tekrar "Teslimatta" durumuna getirmek istiyor musunuz?')) {
                                                    onAdvance(task.id, 'In Delivery');
                                                }
                                            } else if(currentStatus === 'completed') {
                                                setShowDispatchModal(true);
                                            }
                                        } else if(stepKey === 'completed') {
                                            if(currentStatus !== 'completed') {
                                                if(window.confirm('Aşamayı geri alıp tekrar "Tamamlandı" (Üretim bitti) durumuna getirmek istiyor musunuz?')) {
                                                    onAdvance(task.id, 'completed');
                                                }
                                            }
                                        } else if(stepKey === 'Delivered') {
                                            if(currentStatus !== 'Delivered') {
                                                if(window.confirm('Teslimatı tamamlandı (Teslim Edildi) olarak işaretlemek istiyor musunuz?')) {
                                                    onAdvance(task.id, 'Delivered');
                                                }
                                            }
                                        }
                                    }}
                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition cursor-pointer ${bgClass}`}
                                    title={stepKey === 'Invoiced' ? (task.isInvoiced ? 'Fatura Kesildi (Geri almak için tıklayın)' : 'Fatura Kesilmedi (İşaretlemek için tıklayın)') : `${idx + 1}. Aşama`}
                                >
                                    <span className="material-symbols-outlined text-base shrink-0">
                                        {iconName}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[9px] uppercase font-semibold opacity-75 leading-tight">
                                                {idx + 1}. Aşama
                                            </p>
                                            {subBadge && (
                                                <span className="text-[8px] font-bold uppercase tracking-wider opacity-85 px-1 rounded bg-black/10 dark:bg-white/10">
                                                    {subBadge}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs font-bold truncate leading-tight mt-0.5">
                                            {stepTitle}
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

                {/* Delivery & Shipment History */}
                <div className="bg-surface-container-high rounded-xl p-3.5 mb-4 text-xs">
                    <div className="flex items-center justify-between mb-2.5">
                        <p className="font-semibold text-on-surface flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-primary">local_shipping</span>
                            {t('logistics.deliveryHistory', 'Teslimat & Sevkiyat Geçmişi')}
                            {task.deliveryRecords?.length > 0 && (
                                <span className="bg-surface-container text-text-muted text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                                    {task.deliveryRecords.length}
                                </span>
                            )}
                        </p>
                        {canAct && (
                            <button
                                onClick={() => setShowDispatchModal(true)}
                                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-sm">add</span>
                                <span>Yeni Teslimat Kaydı</span>
                            </button>
                        )}
                    </div>

                    {(!task.deliveryRecords || task.deliveryRecords.length === 0) ? (
                        <p className="text-text-muted text-[11px] py-1 italic">
                            {t('logistics.noDeliveryHistory', 'Henüz teslimat kaydı bulunmuyor')}
                        </p>
                    ) : (
                        <div className="space-y-2.5 max-h-56 overflow-y-auto">
                            {task.deliveryRecords.map((rec) => {
                                const fullPhotoUrl = getPhotoFullUrl(rec.photoUrl);
                                const dateFormatted = rec.createdAt ? new Date(rec.createdAt).toLocaleString('tr-TR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                }) : '—';

                                return (
                                    <div
                                        key={rec.id}
                                        className="p-3 rounded-xl bg-surface-container-lowest flex items-start justify-between gap-3 border border-theme-border/30"
                                    >
                                        {/* Left Photo or Icon */}
                                        {fullPhotoUrl ? (
                                            <div
                                                onClick={() => setLightboxPhoto({
                                                    url: fullPhotoUrl,
                                                    title: rec.carrierName,
                                                    details: `${rec.vehicleInfo || ''}${rec.createdByName ? ' • Kaydeden: ' + rec.createdByName : ''}`,
                                                    date: dateFormatted
                                                })}
                                                className="w-14 h-14 rounded-lg overflow-hidden shrink-0 cursor-pointer relative group border border-theme-border/60 hover:opacity-90 transition"
                                            >
                                                <img
                                                    src={fullPhotoUrl}
                                                    alt="Teslimat Fotoğrafı"
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                                    <span className="material-symbols-outlined text-white text-base">zoom_in</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-text-muted">
                                                <span className="material-symbols-outlined text-xl">local_shipping</span>
                                            </div>
                                        )}

                                        {/* Center Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="font-bold text-on-surface text-xs">
                                                    {rec.carrierName}
                                                </span>
                                                {rec.isOutsource ? (
                                                    <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full">
                                                        Outsource
                                                    </span>
                                                ) : (
                                                    <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full">
                                                        Şirket Personeli
                                                    </span>
                                                )}
                                                <span className="text-[11px] text-text-muted font-mono ml-auto">
                                                    {dateFormatted}
                                                </span>
                                            </div>

                                            <p className="text-[11px] text-text-muted flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">directions_car</span>
                                                <span className="font-semibold text-on-surface">{rec.vehicleInfo || '—'}</span>
                                            </p>

                                            {rec.notes && (
                                                <p className="text-[11px] text-text-muted mt-1 italic whitespace-pre-wrap">
                                                    {rec.notes}
                                                </p>
                                            )}

                                            {rec.createdByName && (
                                                <p className="text-[10px] text-text-muted mt-1">
                                                    {t('logistics.recordedBy', 'Kaydeden')}: <span className="font-medium text-on-surface">{rec.createdByName}</span>
                                                </p>
                                            )}
                                        </div>

                                        {/* Right Delete Button (Admin Only!) */}
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleDeleteDeliveryRecord(rec.id)}
                                                disabled={deletingRecordId === rec.id}
                                                title="Teslimat Kaydını Sil (Admin Özel)"
                                                className="p-1 rounded-lg text-red-500/70 hover:text-red-600 hover:bg-red-500/10 transition cursor-pointer disabled:opacity-50 shrink-0"
                                            >
                                                <span className={`material-symbols-outlined text-base ${deletingRecordId === rec.id ? 'animate-spin' : ''}`}>
                                                    {deletingRecordId === rec.id ? 'progress_activity' : 'delete'}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Lojistik İşlem Geçmişi (Loglar) */}
                <div className="bg-surface-container-high rounded-xl p-3.5 mb-4 text-xs">
                    <div className="flex items-center justify-between mb-2.5">
                        <p className="font-semibold text-on-surface flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-blue-500">history</span>
                            {t('logistics.logsTitle', 'Lojistik Logları (İşlem Geçmişi)')}
                            {task.logisticsLogs?.length > 0 && (
                                <span className="bg-surface-container text-text-muted text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                                    {task.logisticsLogs.length}
                                </span>
                            )}
                        </p>
                    </div>

                    {(!task.logisticsLogs || task.logisticsLogs.length === 0) ? (
                        <p className="text-text-muted text-[11px] py-1 italic">
                            {t('logistics.noLogs', 'Henüz lojistik işlem geçmişi bulunmuyor.')}
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {task.logisticsLogs.map((log) => {
                                const dateFormatted = log.createdAt ? new Date(log.createdAt).toLocaleString('tr-TR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                }) : '—';

                                let badgeColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
                                let icon = 'swap_horiz';
                                let actionLabel = 'Aşama Değişimi';

                                if(log.action === 'ROLLBACK') {
                                    badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                                    icon = 'undo';
                                    actionLabel = 'Geri Alma';
                                } else if(log.action === 'INVOICE_TOGGLE') {
                                    badgeColor = log.isInvoiced
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
                                    icon = 'receipt_long';
                                    actionLabel = log.isInvoiced ? 'Fatura Kesildi' : 'Fatura İptal';
                                } else if(log.action === 'DELIVERY_DISPATCH') {
                                    badgeColor = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
                                    icon = 'local_shipping';
                                    actionLabel = 'Sevkiyat Çıkışı';
                                } else if(log.action === 'DELIVERY_DELETE') {
                                    badgeColor = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
                                    icon = 'delete';
                                    actionLabel = 'Sevkiyat Silindi';
                                }

                                return (
                                    <div
                                        key={log.id}
                                        className="p-2.5 rounded-xl bg-surface-container-lowest flex items-start gap-2.5 border border-theme-border/30 text-xs"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-text-muted mt-0.5">
                                            <span className="material-symbols-outlined text-sm">{icon}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${badgeColor}`}>
                                                    {actionLabel}
                                                </span>
                                                <span className="font-semibold text-on-surface text-xs">
                                                    {log.userName || 'Kullanıcı'}
                                                </span>
                                                <span className="text-[10px] text-text-muted font-mono ml-auto">
                                                    {dateFormatted}
                                                </span>
                                            </div>
                                            <p className="text-on-surface text-[11px] leading-relaxed">
                                                {log.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Status Controls (Matching Orders.jsx style) */}
                {canAct && (
                    <div className="pt-4 mt-1 border-t border-theme-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        {/* Left Side: Fatura Durumu Toggle & Direct Selector */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            {/* Fatura Durumu Butonu */}
                            <button
                                type="button"
                                disabled={togglingInvoice}
                                onClick={() => {
                                    if(task.isInvoiced) {
                                        if(window.confirm('Fatura kesildi işaretini geri almak (faturasız duruma çevirmek) istiyor musunuz?')) {
                                            handleToggleInvoice(false);
                                        }
                                    } else {
                                        if(window.confirm('Bu teslimatı Fatura Kesildi olarak işaretlemek istiyor musunuz?')) {
                                            handleToggleInvoice(true);
                                        }
                                    }
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                    task.isInvoiced
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                        : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-theme-border'
                                }`}
                                title={task.isInvoiced ? 'Fatura Kesildi (İptal etmek için tıklayın)' : 'Fatura Kesildi Olarak İşaretle'}
                            >
                                <span className={`material-symbols-outlined text-sm ${togglingInvoice ? 'animate-spin' : ''}`}>
                                    {togglingInvoice ? 'progress_activity' : (task.isInvoiced ? 'verified' : 'receipt_long')}
                                </span>
                                <span>
                                    {task.isInvoiced
                                        ? t('logistics.invoiceDone', 'Fatura Kesildi (Geri Al)')
                                        : t('logistics.markInvoice', 'Fatura Kesildi İşaretle')}
                                </span>
                            </button>

                            {/* Direct Status Selector */}
                            <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-text-muted text-sm">swap_horiz</span>
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="bg-surface-container-lowest border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-primary cursor-pointer"
                                >
                                    <option value="completed">{getStatusLabel('completed', t)}</option>
                                    <option value="In Delivery">{getStatusLabel('In Delivery', t)}</option>
                                    <option value="Delivered">{getStatusLabel('Delivered', t)}</option>
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
                        </div>

                        {/* Right Side: Primary Advance / Rollback Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {currentStatus === 'completed' && (
                                <button
                                    onClick={() => setShowDispatchModal(true)}
                                    className="flex items-center justify-center gap-1.5 bg-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition cursor-pointer shadow-xs"
                                >
                                    <span>{t('logistics.advanceTo', { defaultValue: 'Teslimatta aşamasına geç', status: 'Teslimatta' })}</span>
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </button>
                            )}

                            {currentStatus === 'In Delivery' && (
                                <>
                                    {!task.isInvoiced ? (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                onClick={() => {
                                                    if(window.confirm('Fatura kesilmeden "Teslim Edildi" olarak tamamlanacak. Onaylıyor musunuz?')) {
                                                        onAdvance(task.id, 'Delivered');
                                                    }
                                                }}
                                                className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                                                title="Fatura kesmeden doğrudan teslim edildi yap"
                                            >
                                                <span className="material-symbols-outlined text-sm">local_shipping</span>
                                                <span>Faturasız Teslim Et</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if(window.confirm('Fatura kesildi olarak işaretlenip "Teslim Edildi" yapılacak. Onaylıyor musunuz?')) {
                                                        handleAdvanceDeliveredWithInvoice();
                                                    }
                                                }}
                                                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                                                title="Fatura kesildi ve teslim edildi olarak tamamla"
                                            >
                                                <span className="material-symbols-outlined text-sm">verified</span>
                                                <span>Faturalı Teslim Et</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                if(window.confirm('Teslimat tamamlandı (Teslim Edildi) olarak işaretlensin mi?')) {
                                                    onAdvance(task.id, 'Delivered');
                                                }
                                            }}
                                            className="flex items-center justify-center gap-1.5 bg-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition cursor-pointer shadow-xs"
                                        >
                                            <span>Teslim Edildi Olarak Tamamla</span>
                                            <span className="material-symbols-outlined text-sm">check</span>
                                        </button>
                                    )}
                                </>
                            )}

                            {currentStatus === 'Delivered' && (
                                <div className="flex items-center gap-2">
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                                        task.isInvoiced
                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                    }`}>
                                        <span className="material-symbols-outlined text-sm">
                                            {task.isInvoiced ? 'verified' : 'receipt_long'}
                                        </span>
                                        <span>{task.isInvoiced ? 'Teslim Edildi (Faturalı)' : 'Teslim Edildi (Faturasız)'}</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if(window.confirm('Aşamayı geri alıp tekrar "Teslimatta" durumuna getirmek istiyor musunuz?')) {
                                                onAdvance(task.id, 'In Delivery');
                                            }
                                        }}
                                        className="flex items-center gap-1 bg-surface-container hover:bg-surface-container-high text-on-surface border border-theme-border px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                                        title="Yanlışlıkla tıklandıysa aşamayı geri alın"
                                    >
                                        <span className="material-symbols-outlined text-sm text-amber-500">undo</span>
                                        <span>{t('logistics.revertStage', 'Aşamayı Geri Al')}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Delivery Dispatch Modal when triggered */}
                {showDispatchModal && (
                    <DeliveryDispatchModal
                        task={task}
                        onClose={() => setShowDispatchModal(false)}
                        onSuccess={() => {
                            setShowDispatchModal(false);
                            refreshProductionTasks();
                        }}
                    />
                )}

                {/* Lightbox Modal for enlarged photo */}
                {lightboxPhoto && (
                    <div
                        className="fixed inset-0 z-70 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs"
                        onClick={() => setLightboxPhoto(null)}
                    >
                        <div
                            className="relative max-w-4xl max-h-[90vh] bg-surface-container-lowest rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-theme-border"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-3.5 bg-surface-container-high border-b border-theme-border">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">local_shipping</span>
                                    <span className="text-xs font-bold text-on-surface">Araca Yükleme Fotoğrafı</span>
                                    {lightboxPhoto.title && (
                                        <span className="text-[11px] text-text-muted font-semibold">• {lightboxPhoto.title}</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setLightboxPhoto(null)}
                                    className="p-1 rounded-lg hover:bg-hover-bg text-text-muted hover:text-on-surface transition cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            </div>
                            <div className="p-2 flex items-center justify-center bg-black/60 overflow-auto max-h-[75vh]">
                                <img
                                    src={lightboxPhoto.url}
                                    alt="Araca Yükleme"
                                    className="max-h-[70vh] w-auto object-contain rounded-lg shadow-md"
                                />
                            </div>
                            {lightboxPhoto.details && (
                                <div className="p-3 bg-surface-container-lowest border-t border-theme-border text-xs text-text-muted flex items-center justify-between">
                                    <span className="font-medium text-on-surface">{lightboxPhoto.details}</span>
                                    {lightboxPhoto.date && (
                                        <span className="font-mono text-[11px] text-text-muted">{lightboxPhoto.date}</span>
                                    )}
                                </div>
                            )}
                        </div>
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
        if (!detailTask) {
            return;
        }
        const updated = (productionTasks || []).find((t) => t.id === detailTask.id);
        if (updated) {
            setDetailTask(updated);
        }
    }, [productionTasks]);

    const counts = useMemo(() => {
        const c = {
            'completed': 0,
            'In Delivery': 0,
            'Invoiced': 0,
            'Delivered': 0,
            'deliveredInvoiced': 0,
            'deliveredNotInvoiced': 0
        };
        (logisticTasks || []).forEach((task) => {
            const norm = normalizeStatus(task.status);
            if(c[norm] !== undefined) {
                c[norm]++;
            }
            if(task.isInvoiced) {
                c['Invoiced']++;
            }
            if(norm === 'Delivered') {
                if(task.isInvoiced) {
                    c['deliveredInvoiced']++;
                } else {
                    c['deliveredNotInvoiced']++;
                }
            }
        });
        return c;
    }, [logisticTasks]);

    const filteredTasks = useMemo(() => {
        return logisticTasks.filter((task) => {
            const norm = normalizeStatus(task.status);
            if(filterStatus) {
                if(filterStatus === 'Invoiced') {
                    if(!task.isInvoiced) {
                        return false;
                    }
                } else if(filterStatus === 'Delivered_Invoiced') {
                    if(norm !== 'Delivered' || !task.isInvoiced) {
                        return false;
                    }
                } else if(filterStatus === 'Delivered_NotInvoiced') {
                    if(norm !== 'Delivered' || task.isInvoiced) {
                        return false;
                    }
                } else if(norm !== filterStatus) {
                    return false;
                }
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

    const handleAdvance = async (taskId, nextStatus) => {
        try {
            await moveProductionTask(taskId, nextStatus);
            setDetailTask((prev) => {
                if (!prev || prev.id !== taskId) {
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
                    let countNum = counts[statusKey] || 0;
                    let extraInfo = '';
                    if(statusKey === 'Invoiced') {
                        countNum = counts['Invoiced'] || 0;
                    } else if(statusKey === 'Delivered') {
                        extraInfo = `${counts['deliveredInvoiced'] || 0} Faturalı • ${counts['deliveredNotInvoiced'] || 0} Faturasız`;
                    }
                    return (
                        <div
                            key={statusKey}
                            onClick={() => setFilterStatus(isSelected ? '' : statusKey)}
                            className={`rounded-xl md:rounded-2xl border border-theme-border bg-surface-container-lowest p-3 md:p-4 transition cursor-pointer ${isSelected
                                    ? 'border-primary ring-1 ring-primary'
                                    : 'hover:border-primary/40'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-1.5 md:mb-2">
                                <span className={`material-symbols-outlined text-xl md:text-2xl ${statusColor[statusKey]}`}>
                                    {statusIcon[statusKey]}
                                </span>
                                <span className="text-lg md:text-2xl font-bold text-on-surface">
                                    {countNum}
                                </span>
                            </div>
                            <p className="text-[10px] md:text-xs font-semibold text-text-muted uppercase tracking-wide md:tracking-wider leading-tight">
                                {statusKey === 'Invoiced' ? 'Fatura Kesilenler' : getStatusLabel(statusKey, t)}
                            </p>
                            {extraInfo && (
                                <p className="text-[10px] text-text-muted mt-1 font-mono font-medium">
                                    {extraInfo}
                                </p>
                            )}
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
                    <option value="completed">{getStatusLabel('completed', t)}</option>
                    <option value="In Delivery">{getStatusLabel('In Delivery', t)}</option>
                    <option value="Invoiced">Fatura Kesilenler (Faturalı)</option>
                    <option value="Delivered">Teslim Edildi (Tümü)</option>
                    <option value="Delivered_Invoiced">Teslim Edildi (Faturalı)</option>
                    <option value="Delivered_NotInvoiced">Teslim Edildi (Faturasız)</option>
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
                                const taskTotal = unitPrice * (parseFloat(String(task.quantity).replace(',', '.')) || 0);
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
                                            <div className="flex items-center justify-between xl:justify-start gap-1.5 flex-wrap">
                                                <span className="xl:hidden text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                                    {t('common.status', 'Durum')}
                                                </span>
                                                {currentStatus === 'Delivered' ? (
                                                    task.isInvoiced ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                                            <span className="material-symbols-outlined text-xs">verified</span>
                                                            <span>{t('logistics.deliveredInvoiced', 'Teslim Edildi (Faturalı)')}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                                                            <span className="material-symbols-outlined text-xs">receipt_long</span>
                                                            <span>{t('logistics.deliveredNotInvoiced', 'Teslim Edildi (Faturasız)')}</span>
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyle[currentStatus] || 'bg-surface-container-high text-text-muted'}`}>
                                                        {getStatusLabel(currentStatus, t)}
                                                    </span>
                                                )}
                                                {currentStatus !== 'Delivered' && task.isInvoiced && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                        <span className="material-symbols-outlined text-[11px]">receipt_long</span>
                                                        <span>Fatura Kesildi</span>
                                                    </span>
                                                )}
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
                    isAdmin={isAdmin}
                    onClose={() => setDetailTask(null)}
                    onAdvance={handleAdvance}
                />
            )}
        </div>
    );
}
