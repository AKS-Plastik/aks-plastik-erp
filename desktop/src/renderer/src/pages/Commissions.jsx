import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const ORDER_STATUS_CONFIG = {
  Processing:             { label: 'Hazırlanıyor', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', isDone: false },
  Confirmed:              { label: 'Onaylandı', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300', isDone: false },
  'In-Production':        { label: 'Üretimde', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300', isDone: false },
  'Production Completed': { label: 'Üretim Tamamlandı', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300', isDone: false },
  'E-WayBill':            { label: 'İrsaliye Kesildi', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300', isDone: false },
  'In Delivery':          { label: 'Yolda / Dağıtımda', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300', isDone: false },
  'E-Invoice':            { label: 'Faturalandı', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300', isDone: false },
  Delivered:              { label: 'Teslim Edildi', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', isDone: true },
};

export default function Commissions() {
  const { t } = useTranslation();
  const {
    fetchCommissions,
    toggleCommissionPaid,
    batchPayCommissions,
    updateCommission,
    syncCommissions,
    fetchCommissionRates,
    updateCommissionRate,
  } = useData();
  const { token } = useAuth();

  // Sales team state & personnel rates
  const [salesTeam, setSalesTeam] = useState([]);
  const [ratesMap, setRatesMap] = useState({});

  // Data & loading states
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [commissions, setCommissions] = useState([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    activeCount: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    carriedOverPendingAmount: 0,
    closedCount: 0,
    closedAmount: 0,
  });

  // Filter states: Default periodPreset is 'all' so all existing cards are displayed immediately!
  const [selectedUser, setSelectedUser] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'paid' | 'closed'
  const [dateBasis, setDateBasis] = useState('created'); // 'created' | 'paid'
  const [periodPreset, setPeriodPreset] = useState('all'); // 'all' | 'thisMonth' | 'lastMonth' | 'customMonth' | 'customRange'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  // Selection for batch actions
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal states
  const [editModalComm, setEditModalComm] = useState(null);
  const [payModalComm, setPayModalComm] = useState(null); // single pay or batch
  const [orderDetailModalData, setOrderDetailModalData] = useState(null);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch sales team users & rates
  const loadRates = useCallback(async () => {
    try {
      const list = await fetchCommissionRates();
      if (Array.isArray(list)) {
        setSalesTeam(list);
        const map = {};
        list.forEach((u) => {
          map[u.id] = u.commissionRate !== undefined && u.commissionRate !== null ? u.commissionRate : 3;
        });
        setRatesMap(map);
      }
    } catch (err) {
      console.error('Failed to load sales team rates:', err);
    }
  }, [fetchCommissionRates]);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  // Load commissions based on active filters
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        userId: selectedUser,
        status: statusFilter,
        dateBasis,
        search,
      };

      if (periodPreset === 'thisMonth') {
        const now = new Date();
        filters.year = now.getFullYear();
        filters.month = now.getMonth() + 1;
      } else if (periodPreset === 'lastMonth') {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        filters.year = d.getFullYear();
        filters.month = d.getMonth() + 1;
      } else if (periodPreset === 'customMonth') {
        filters.year = selectedYear;
        filters.month = selectedMonth;
      } else if (periodPreset === 'customRange') {
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;
      }

      const res = await fetchCommissions(filters);
      setCommissions(res.commissions || []);
      setSummary(res.summary || {});
    } catch (err) {
      console.error('Failed to fetch commissions:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchCommissions, selectedUser, statusFilter, dateBasis, periodPreset, selectedYear, selectedMonth, dateFrom, dateTo, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync with orders
  const handleSyncOrders = async () => {
    setSyncing(true);
    try {
      await syncCommissions();
      await loadData();
      await loadRates();
    } catch (err) {
      alert(err.message || 'Senkronizasyon hatası');
    } finally {
      setSyncing(false);
    }
  };

  // Toggle single payment
  const handleTogglePaid = async (comm) => {
    if (comm.status === 'paid') {
      if (!confirm('Bu prim ödemesini geri alarak bekleme durumuna almak istediğinize emin misiniz?')) return;
      try {
        await toggleCommissionPaid(comm.id, false);
        await loadData();
      } catch (err) {
        alert(err.message || 'İşlem başarısız');
      }
    } else {
      setPayModalComm(comm);
      setPayDate(new Date().toISOString().slice(0, 10));
    }
  };

  // Confirm single payment
  const confirmSinglePayment = async () => {
    if (!payModalComm) return;
    setIsProcessing(true);
    try {
      await toggleCommissionPaid(payModalComm.id, true, payDate);
      setPayModalComm(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'Ödeme kaydedilemedi');
    } finally {
      setIsProcessing(false);
    }
  };

  // Batch pay selected
  const handleBatchPay = async () => {
    if (selectedIds.length === 0) return;
    const selectedComms = commissions.filter(c => selectedIds.includes(c.id));
    const unfinishedCount = selectedComms.filter(c => c.orderStatus !== 'Delivered').length;
    setPayModalComm({ isBatch: true, count: selectedIds.length, unfinishedCount });
    setPayDate(new Date().toISOString().slice(0, 10));
  };

  const confirmBatchPayment = async () => {
    setIsProcessing(true);
    try {
      await batchPayCommissions(selectedIds, payDate);
      setSelectedIds([]);
      setPayModalComm(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'Toplu ödeme kaydedilemedi');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper formatters
  const formatMoney = (val, currency = '₺') => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getMonthName = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${MONTH_NAMES_TR[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Check if commission is from a past month compared to current time
  const isPastMonthPending = (comm) => {
    if (comm.status !== 'pending') return false;
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const orderDate = new Date(comm.orderCreatedAt || comm.createdAt);
    return orderDate < startOfCurrentMonth;
  };

  // Check if paid in a different month than order
  const isDelayedPayment = (comm) => {
    if (comm.status !== 'paid' || !comm.paidAt) return false;
    const orderDate = new Date(comm.orderCreatedAt || comm.createdAt);
    const paidDate = new Date(comm.paidAt);
    return orderDate.getMonth() !== paidDate.getMonth() || orderDate.getFullYear() !== paidDate.getFullYear();
  };

  // Toggle select all
  const selectableComms = useMemo(() => {
    return commissions.filter((c) => c.status === 'pending');
  }, [commissions]);

  const allSelected = selectableComms.length > 0 && selectableComms.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableComms.map((c) => c.id));
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Build the list of selectable sales reps (union of salesTeam + all users in commissions)
  const uniqueReps = useMemo(() => {
    const map = new Map();
    (salesTeam || []).forEach((u) => {
      map.set(u.id, { id: u.id, name: u.name, department: u.department || 'Satış' });
    });
    (commissions || []).forEach((c) => {
      if (c.userId && !map.has(c.userId)) {
        map.set(c.userId, { id: c.userId, name: c.userName, department: 'Satış Temsilcisi' });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [salesTeam, commissions]);

  // Active selected rep details
  const activeRep = useMemo(() => {
    if (selectedUser === 'all') return null;
    return uniqueReps.find((u) => u.id === selectedUser) || null;
  }, [selectedUser, uniqueReps]);

  return (
    <div className="p-3 md:p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl md:text-3xl">payments</span>
            {t('commissions.title', 'Satış Prim Yönetimi')}
          </h1>
          <p className="text-xs md:text-sm text-text-muted mt-0.5">
            {t('commissions.subtitle', 'Satış temsilcilerinin sipariş hak edişlerini ve prim ödemelerini takip edin')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-stretch md:self-auto">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBatchPay}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">done_all</span>
              {t('commissions.batchPay', { count: selectedIds.length })}
            </button>
          )}

          <button
            onClick={() => setShowRatesModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-theme-border bg-surface-container hover:bg-hover-bg text-on-surface text-xs font-semibold transition"
            title="Personel Prim Yüzdeleri"
          >
            <span className="material-symbols-outlined text-sm text-primary">percent</span>
            Personel Prim Oranları
          </button>

          <button
            onClick={handleSyncOrders}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-theme-border bg-surface-container hover:bg-hover-bg text-on-surface text-xs font-semibold transition disabled:opacity-50"
            title={t('commissions.syncOrders')}
          >
            <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>sync</span>
            {syncing ? 'Senkronize ediliyor...' : t('commissions.syncOrders', 'Siparişlerle Senkronize Et')}
          </button>
        </div>
      </div>

      {/* ── Active Rep Highlight Info (when filtered by rep) ── */}
      {activeRep && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl primary-gradient text-white flex items-center justify-center font-bold text-base shrink-0">
              {activeRep.name ? activeRep.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm md:text-base text-on-surface">{activeRep.name}</h3>
                <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {activeRep.department || 'Satış'}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Yeni siparişlerde uygulanacak prim oranı:{' '}
                <strong className="text-on-surface font-bold">%{ratesMap[activeRep.id] ?? 3}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => setShowRatesModal(true)}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2 py-1"
            >
              <span className="material-symbols-outlined text-sm">tune</span>
              Oranı Değiştir
            </button>
          </div>
        </div>
      )}

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
        {/* Total Active Commissions */}
        <div className="bg-surface-container-lowest border border-theme-border rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('commissions.summaryTotal', 'Toplam Prim')}</span>
            <span className="material-symbols-outlined text-primary text-xl">account_balance_wallet</span>
          </div>
          <div>
            <p className="text-lg md:text-2xl font-black text-on-surface">{formatMoney(summary.totalAmount)}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{summary.activeCount} aktif sipariş kartı</p>
          </div>
        </div>

        {/* Paid Commissions */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('commissions.summaryPaid', 'Ödenen Prim')}</span>
            <span className="material-symbols-outlined text-xl">check_circle</span>
          </div>
          <div>
            <p className="text-lg md:text-2xl font-black text-emerald-700 dark:text-emerald-300">{formatMoney(summary.paidAmount)}</p>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Tamamlandı</span>
          </div>
        </div>

        {/* Pending Commissions */}
        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('commissions.summaryPending', 'Ödeme Bekleyen')}</span>
            <span className="material-symbols-outlined text-xl">hourglass_top</span>
          </div>
          <div>
            <p className="text-lg md:text-2xl font-black text-amber-700 dark:text-amber-300">{formatMoney(summary.pendingAmount)}</p>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Açık Hak Ediş</span>
          </div>
        </div>

        {/* Carried Over (Past Months) Warning */}
        <div className="bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800/40 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('commissions.summaryCarriedOver', 'Geçmişten Kalan')}</span>
            <span className="material-symbols-outlined text-xl">history_toggle_off</span>
          </div>
          <div>
            <p className="text-lg md:text-2xl font-black text-rose-700 dark:text-rose-300">{formatMoney(summary.carriedOverPendingAmount)}</p>
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">Önceki Aylardan Devreden</span>
          </div>
        </div>

        {/* Closed/Cancelled */}
        <div className="col-span-2 md:col-span-4 lg:col-span-1 bg-surface-container-low border border-theme-border/60 rounded-2xl p-4 flex flex-col justify-between opacity-80">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('commissions.summaryClosed', 'İptal / Kapatılan')}</span>
            <span className="material-symbols-outlined text-xl">cancel</span>
          </div>
          <div>
            <p className="text-base md:text-lg font-bold text-text-muted line-through">{formatMoney(summary.closedAmount)}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{summary.closedCount} kart (hesap dışı)</p>
          </div>
        </div>
      </div>

      {/* ── Filters Control Bar ── */}
      <div className="bg-surface-container-lowest border border-theme-border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Sales Rep Filter */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              {t('commissions.salesRep', 'Satış Temsilcisi')}
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-surface-container-low border border-theme-border rounded-xl px-3 py-2 text-xs font-semibold text-on-surface outline-none focus:border-primary transition"
            >
              <option value="all">{t('commissions.allSalesReps', 'Tüm Satış Personelleri (Genel)')}</option>
              {uniqueReps.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.department ? `— ${u.department}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Payout Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              {t('commissions.status', 'Ödeme Durumu')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-surface-container-low border border-theme-border rounded-xl px-3 py-2 text-xs font-semibold text-on-surface outline-none focus:border-primary transition"
            >
              <option value="all">{t('commissions.statusAll', 'Tüm Durumlar')}</option>
              <option value="pending">{t('commissions.statusPending', 'Ödeme Bekliyor (Açık)')}</option>
              <option value="paid">{t('commissions.statusPaid', 'Ödendi / Tamamlandı')}</option>
              <option value="closed">{t('commissions.statusClosed', 'Kapatıldı / İptal (Değiştirilen)')}</option>
            </select>
          </div>

          {/* 3. Date Filter Basis */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              {t('commissions.dateBasis', 'Tarih Filtresi Bazı')}
            </label>
            <select
              value={dateBasis}
              onChange={(e) => setDateBasis(e.target.value)}
              className="w-full bg-surface-container-low border border-theme-border rounded-xl px-3 py-2 text-xs font-semibold text-on-surface outline-none focus:border-primary transition"
            >
              <option value="created">{t('commissions.dateBasisOrder', 'Hak Ediş / Sipariş Tarihine Göre')}</option>
              <option value="paid">{t('commissions.dateBasisPaid', 'Ödeme / Tamamlanma Tarihine Göre')}</option>
            </select>
          </div>

          {/* 4. Period Preset (Default: 'all') */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              {t('commissions.period', 'Dönem / Ay')}
            </label>
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value)}
              className="w-full bg-surface-container-low border border-theme-border rounded-xl px-3 py-2 text-xs font-semibold text-on-surface outline-none focus:border-primary transition"
            >
              <option value="all">{t('commissions.allPeriods', 'Tüm Zamanlar')}</option>
              <option value="thisMonth">{t('commissions.currentMonth', 'Bu Ay')}</option>
              <option value="lastMonth">{t('commissions.previousMonth', 'Geçen Ay')}</option>
              <option value="customMonth">{t('commissions.month', 'Yıl & Ay Seçimi')}</option>
              <option value="customRange">{t('commissions.customRange', 'Özel Tarih Aralığı')}</option>
            </select>
          </div>
        </div>

        {/* Secondary filters row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-theme-border/60">
          <div className="flex items-center gap-2 flex-wrap">
            {periodPreset === 'customMonth' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted font-medium">{t('commissions.year')}:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="bg-surface-container-low border border-theme-border rounded-lg px-2.5 py-1 text-xs text-on-surface outline-none"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted font-medium">{t('commissions.month')}:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    className="bg-surface-container-low border border-theme-border rounded-lg px-2.5 py-1 text-xs text-on-surface outline-none"
                  >
                    {MONTH_NAMES_TR.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {periodPreset === 'customRange' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-surface-container-low border border-theme-border rounded-lg px-2.5 py-1 text-xs text-on-surface outline-none"
                />
                <span className="text-xs text-text-muted">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-surface-container-low border border-theme-border rounded-lg px-2.5 py-1 text-xs text-on-surface outline-none"
                />
              </div>
            )}
          </div>

          {/* Search box */}
          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('commissions.searchPlaceholder', 'Sipariş kodu, müşteri veya personel ara...')}
              className="w-full bg-surface-container-low border border-theme-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary transition"
            />
          </div>
        </div>
      </div>

      {/* ── Commission Cards / Table ── */}
      <div className="bg-surface-container-lowest border border-theme-border rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-2 text-text-muted">
            <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
            <p className="text-xs">{t('common.loading', 'Yükleniyor...')}</p>
          </div>
        ) : commissions.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-text-muted">
            <span className="material-symbols-outlined text-4xl opacity-50">receipt_long</span>
            <p className="text-sm font-semibold text-on-surface">{t('commissions.noCommissions', 'Seçilen kriterlere uygun prim kaydı bulunamadı.')}</p>
            <p className="text-xs max-w-sm text-center">Filtre kriterlerini değiştirerek tekrar deneyebilir veya "Siparişlerle Senkronize Et" butonuna tıklayabilirsiniz.</p>
            {(periodPreset !== 'all' || statusFilter !== 'all' || selectedUser !== 'all' || search) && (
              <button
                onClick={() => {
                  setSelectedUser('all');
                  setStatusFilter('all');
                  setPeriodPreset('all');
                  setSearch('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="mt-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                <span>Filtreleri Sıfırla (Tüm Zamanları Göster)</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-theme-border bg-surface-container-low/70 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded accent-primary cursor-pointer align-middle"
                    />
                  </th>
                  <th className="p-3">{t('commissions.salesRep', 'Satış Temsilcisi')}</th>
                  <th className="p-3">{t('commissions.cardOrder', 'Sipariş & Durum')}</th>
                  <th className="p-3">{t('commissions.cardOrderTotal', 'Sipariş Tutarı')}</th>
                  <th className="p-3">{t('commissions.cardAmount', 'Prim Tutarı & Oran')}</th>
                  <th className="p-3">{t('commissions.cardOrderDate', 'Hak Ediş Tarihi')}</th>
                  <th className="p-3">{t('commissions.status', 'Ödeme Durumu')}</th>
                  <th className="p-3 text-right">{t('common.actions', 'İşlem')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/60 text-xs">
                {commissions.map((comm) => {
                  const isClosed = comm.status === 'closed';
                  const isPaid = comm.status === 'paid' || comm.isPaid;
                  const isPastPending = isPastMonthPending(comm);
                  const isDelayed = isDelayedPayment(comm);
                  const earnedMonth = getMonthName(comm.orderCreatedAt || comm.createdAt);
                  const paidMonth = getMonthName(comm.paidAt);

                  const orderStatusCfg = ORDER_STATUS_CONFIG[comm.orderStatus] || {
                    label: comm.orderStatus || 'Bilinmiyor',
                    color: 'bg-surface-container-high text-text-muted',
                    isDone: false,
                  };

                  return (
                    <tr
                      key={comm.id}
                      className={`hover:bg-hover-bg/60 transition ${
                        isClosed ? 'opacity-50 bg-surface-container-high/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          disabled={isClosed || isPaid}
                          checked={selectedIds.includes(comm.id)}
                          onChange={() => toggleSelectRow(comm.id)}
                          className="w-4 h-4 rounded accent-primary cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed align-middle"
                        />
                      </td>

                      {/* Sales Rep */}
                      <td className="p-3 font-semibold text-on-surface">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {comm.userName ? comm.userName.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <p className="font-semibold text-on-surface text-xs leading-tight">{comm.userName}</p>
                            <span className="text-[10px] text-text-muted">Satış Temsilcisi</span>
                          </div>
                        </div>
                      </td>

                      {/* Order & Status (Clickable to open OrderDetailModal) */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => setOrderDetailModalData(comm.order || { id: comm.orderId, code: comm.orderCode, customerName: comm.customerName, status: comm.orderStatus, totalAmount: comm.orderTotal })}
                              className="font-mono font-bold text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1 transition"
                              title="Sipariş Detaylarını Görüntüle"
                            >
                              <span>{comm.orderCode || '—'}</span>
                              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                            </button>

                            {/* Order Status Badge */}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${orderStatusCfg.color}`}>
                              {orderStatusCfg.label}
                            </span>
                          </div>

                          <p className="text-[11px] text-text-muted truncate max-w-[200px]" title={comm.customerName || ''}>
                            {comm.customerName || 'Müşteri belirtilmemiş'}
                          </p>
                        </div>
                      </td>

                      {/* Order Total */}
                      <td className="p-3 font-medium text-on-surface">
                        {formatMoney(comm.orderTotal, comm.orderCurrency || '₺')}
                      </td>

                      {/* Commission Amount & Rate */}
                      <td className="p-3">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`font-bold text-xs md:text-sm ${isClosed ? 'line-through text-text-muted' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {formatMoney(comm.amount, comm.currency || '₺')}
                            </p>
                            {comm.isManualOverride && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" title="Yönetici tarafından sabit fiyat belirlendi">
                                Manuel Fiyat
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-text-muted bg-surface-container px-1 rounded font-medium">
                            %{comm.rate} hak ediş
                          </span>
                        </div>
                      </td>

                      {/* Earned Date & Period */}
                      <td className="p-3 text-text-muted">
                        <div>
                          <p className="font-medium text-on-surface">{formatDate(comm.orderCreatedAt || comm.createdAt)}</p>
                          <span className="text-[10px] text-text-muted font-medium">
                            {earnedMonth}
                          </span>
                        </div>
                      </td>

                      {/* Payout Status & Payment Info */}
                      <td className="p-3">
                        <div className="space-y-1">
                          {isClosed ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container-high text-text-muted">
                              <span className="material-symbols-outlined text-[13px]">cancel</span>
                              {t('commissions.statusClosed', 'Kapatıldı / İptal')}
                            </div>
                          ) : isPaid ? (
                            <div className="space-y-0.5">
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                {t('commissions.statusPaid', 'Ödendi')}
                              </div>
                              <p className="text-[10px] text-text-muted">
                                {formatDate(comm.paidAt)} {comm.paidByName ? `(${comm.paidByName})` : ''}
                              </p>
                              {isDelayed && (
                                <div className="inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                                  {earnedMonth} → {paidMonth}'de Ödendi
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                <span className="material-symbols-outlined text-[13px]">hourglass_empty</span>
                                {t('commissions.statusPending', 'Ödeme Bekliyor')}
                              </div>
                              {isPastPending && (
                                <div>
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                    <span className="material-symbols-outlined text-[11px]">warning</span>
                                    Geçmiş Aydan Kalan ({earnedMonth})
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {comm.notes && (
                            <p className="text-[10px] text-text-muted italic max-w-[180px] truncate" title={comm.notes}>
                              {comm.notes}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right whitespace-nowrap">
                        {!isClosed && (
                          <div className="flex items-center justify-end gap-1.5">
                            {isPaid ? (
                              <button
                                onClick={() => handleTogglePaid(comm)}
                                className="px-2.5 py-1 rounded-lg border border-theme-border text-[11px] font-medium text-text-muted hover:text-error hover:border-error/40 transition"
                                title={t('commissions.markPending', 'Ödemeyi Geri Al')}
                              >
                                {t('commissions.markPending', 'Geri Al')}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleTogglePaid(comm)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-white text-[11px] font-bold shadow-xs transition ${
                                  comm.orderStatus !== 'Delivered'
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                                title={t('commissions.markPaid', 'Ödemeyi Tamamla')}
                              >
                                <span className="material-symbols-outlined text-[13px]">
                                  {comm.orderStatus !== 'Delivered' ? 'warning' : 'check'}
                                </span>
                                {t('commissions.markPaid', 'Öde')}
                              </button>
                            )}

                            <button
                              onClick={() => setEditModalComm(comm)}
                              className="p-1 rounded-lg hover:bg-hover-bg text-text-muted hover:text-primary transition"
                              title={t('commissions.editCommission', 'Fiyat / Oran Düzenle')}
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                          </div>
                        )}
                        {isClosed && (
                          <span className="text-[11px] text-text-muted italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Rates Settings Quick Modal ── */}
      {showRatesModal && (
        <RatesSettingsModal
          salesTeam={salesTeam}
          ratesMap={ratesMap}
          onClose={() => setShowRatesModal(false)}
          onSaved={async () => {
            await loadRates();
          }}
        />
      )}

      {/* ── Order Detail Modal ── */}
      {orderDetailModalData && (
        <OrderDetailModal
          order={orderDetailModalData}
          onClose={() => setOrderDetailModalData(null)}
        />
      )}

      {/* ── Payment Date & Incomplete Order Warning Modal ── */}
      {payModalComm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface border border-theme-border rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-theme-border pb-3">
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-2xl ${
                  !payModalComm.isBatch && payModalComm.orderStatus !== 'Delivered'
                    ? 'text-amber-500'
                    : 'text-emerald-600'
                }`}>
                  {!payModalComm.isBatch && payModalComm.orderStatus !== 'Delivered' ? 'warning' : 'check_circle'}
                </span>
                <h3 className="font-bold text-sm text-on-surface">
                  {payModalComm.isBatch ? 'Toplu Prim Ödemesi' : 'Prim Ödemesini Onayla'}
                </h3>
              </div>
              <button
                onClick={() => setPayModalComm(null)}
                className="p-1 rounded-lg text-text-muted hover:text-on-surface transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Incomplete Order Warning Box (Single) */}
            {!payModalComm.isBatch && payModalComm.orderStatus !== 'Delivered' && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                  <span className="material-symbols-outlined text-base">report_problem</span>
                  <span>Dikkat: Sipariş Henüz Tamamlanmamış!</span>
                </div>
                <p className="leading-relaxed">
                  Bu sipariş henüz tamamlanmamış ve teslim edilmemiştir (Mevcut Durum: <strong>{ORDER_STATUS_CONFIG[payModalComm.orderStatus]?.label || payModalComm.orderStatus}</strong>).
                </p>
                <p className="font-semibold text-rose-600 dark:text-rose-400">
                  Bitmemiş siparişin primini vermek istediğinize emin misiniz?
                </p>
              </div>
            )}

            {/* Incomplete Order Warning Box (Batch) */}
            {payModalComm.isBatch && payModalComm.unfinishedCount > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                  <span className="material-symbols-outlined text-base">report_problem</span>
                  <span>Dikkat: Tamamlanmamış Siparişler Var!</span>
                </div>
                <p className="leading-relaxed">
                  Seçilen <strong>{payModalComm.count} adet</strong> siparişten <strong>{payModalComm.unfinishedCount} tanesi</strong> henüz teslim edilmemiş/tamamlanmamıştır.
                </p>
                <p className="font-semibold text-rose-600 dark:text-rose-400">
                  Bitmemiş siparişlerin primini vermek istediğinize emin misiniz?
                </p>
              </div>
            )}

            <div className="space-y-3 text-xs text-text-muted">
              {payModalComm.isBatch ? (
                <p className="text-on-surface">
                  Seçilen <strong>{payModalComm.count} adet</strong> prim kartının ödemesi tamamlanacak.
                </p>
              ) : (
                <div className="bg-surface-container-low p-3 rounded-xl border border-theme-border space-y-1">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Satış Temsilcisi:</span>
                    <strong className="text-on-surface">{payModalComm.userName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Sipariş:</span>
                    <span className="font-mono font-bold text-on-surface">{payModalComm.orderCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Sipariş Durumu:</span>
                    <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${ORDER_STATUS_CONFIG[payModalComm.orderStatus]?.color || ''}`}>
                      {ORDER_STATUS_CONFIG[payModalComm.orderStatus]?.label || payModalComm.orderStatus}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-theme-border">
                    <span className="text-text-muted">Ödenecek Prim:</span>
                    <strong className="text-emerald-600 text-sm">{formatMoney(payModalComm.amount)}</strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Ödeme Tarihi
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full bg-surface-container-low border border-theme-border rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme-border">
              <button
                type="button"
                onClick={() => setPayModalComm(null)}
                className="px-3.5 py-1.5 rounded-lg border border-theme-border text-xs text-text-muted hover:text-on-surface transition"
              >
                {t('common.cancel', 'Vazgeç')}
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={payModalComm.isBatch ? confirmBatchPayment : confirmSinglePayment}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-bold transition disabled:opacity-50 ${
                  !payModalComm.isBatch && payModalComm.orderStatus !== 'Delivered'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <span className="material-symbols-outlined text-sm">done</span>
                {isProcessing
                  ? 'Kaydediliyor...'
                  : !payModalComm.isBatch && payModalComm.orderStatus !== 'Delivered'
                    ? 'Yine de Ödemeyi Onayla'
                    : 'Ödemeyi Tamamla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Commission Modal (Rate / Amount Override) ── */}
      {editModalComm && (
        <EditCommissionModal
          comm={editModalComm}
          onClose={() => setEditModalComm(null)}
          onSaved={async () => {
            setEditModalComm(null);
            await loadData();
          }}
        />
      )}
    </div>
  );
}

/**
 * Order Detail Modal component
 */
function OrderDetailModal({ order, onClose }) {
  const formatMoney = (val, currency = '₺') => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  const statusCfg = ORDER_STATUS_CONFIG[order.status] || {
    label: order.status || 'Bilinmiyor',
    color: 'bg-surface-container-high text-text-muted',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-surface border border-theme-border rounded-2xl w-full max-w-xl shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-theme-border pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">receipt_long</span>
            <div>
              <h3 className="font-bold text-sm text-on-surface">
                Sipariş Detayı: <span className="font-mono text-primary">{order.code}</span>
              </h3>
              <p className="text-[11px] text-text-muted">
                {order.customer?.name || order.customerName || 'Müşteri'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-on-surface transition"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-surface-container-low p-3 rounded-xl border border-theme-border text-xs shrink-0">
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase">Sipariş Durumu</span>
            <div className="mt-0.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase">Toplam Tutar</span>
            <p className="font-bold text-on-surface text-sm mt-0.5">
              {formatMoney(order.totalAmount)}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase">Tarih</span>
            <p className="text-text-muted text-xs mt-0.5">
              {order.createdAt ? new Date(order.createdAt).toLocaleDateString('tr-TR') : '—'}
            </p>
          </div>
        </div>

        {/* Order Items Table */}
        <div className="overflow-y-auto flex-1 border border-theme-border rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low border-b border-theme-border text-[10px] font-bold text-text-muted uppercase">
              <tr>
                <th className="p-2.5">Ürün / Kalem</th>
                <th className="p-2.5 text-right">Miktar</th>
                <th className="p-2.5 text-right">Birim Fiyat</th>
                <th className="p-2.5 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border/60">
              {(order.items || []).map((item, idx) => {
                const qty = Number(item.quantity) || 1;
                const price = Number(item.unitPrice) || 0;
                const total = qty * price;
                return (
                  <tr key={item.id || idx}>
                    <td className="p-2.5 font-medium text-on-surface">{item.productName}</td>
                    <td className="p-2.5 text-right font-mono">{qty}</td>
                    <td className="p-2.5 text-right font-mono">{formatMoney(price, item.currency || '₺')}</td>
                    <td className="p-2.5 text-right font-mono font-bold">{formatMoney(total, item.currency || '₺')}</td>
                  </tr>
                );
              })}
              {(!order.items || order.items.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-text-muted text-xs italic">
                    Kalem detayları yüklenemedi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {order.notes && (
          <div className="bg-surface-container-low p-2.5 rounded-xl border border-theme-border text-xs shrink-0">
            <span className="text-[10px] font-bold text-text-muted uppercase block">Sipariş Notu:</span>
            <p className="text-text-muted mt-0.5">{order.notes}</p>
          </div>
        )}

        <div className="pt-2 border-t border-theme-border flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-theme-border text-xs text-text-muted hover:text-on-surface transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Edit Commission Modal component
 */
function EditCommissionModal({ comm, onClose, onSaved }) {
  const { t } = useTranslation();
  const { updateCommission } = useData();
  const [rate, setRate] = useState(comm.rate || 3);
  const [amount, setAmount] = useState(comm.amount || 0);
  const [notes, setNotes] = useState(comm.notes || '');
  const [saving, setSaving] = useState(false);
  const [isManual, setIsManual] = useState(comm.isManualOverride || false);

  const handleRateChange = (newRate) => {
    const r = parseFloat(newRate) || 0;
    setRate(newRate);
    const ordTotal = Number(comm.orderTotal) || 0;
    setAmount(Number(((ordTotal * r) / 100).toFixed(2)));
  };

  const handleAmountChange = (newAmt) => {
    setAmount(newAmt);
    setIsManual(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateCommission(comm.id, {
        rate: parseFloat(rate) || 0,
        amount: parseFloat(amount) || 0,
        notes,
      });
      onSaved();
    } catch (err) {
      alert(err.message || 'Güncelleme hatası');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-surface border border-theme-border rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-theme-border pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">edit</span>
            <h3 className="font-bold text-sm text-on-surface">
              {t('commissions.editCommission', 'Kart Özelinde Prim & Fiyat Düzenle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-on-surface transition"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div className="bg-surface-container-low p-3 rounded-xl border border-theme-border space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">Temsilci:</span>
              <strong className="text-on-surface">{comm.userName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Sipariş:</span>
              <strong className="text-on-surface font-mono">{comm.orderCode}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Sipariş Tutarı:</span>
              <strong className="text-on-surface">{Number(comm.orderTotal).toLocaleString('tr-TR')} ₺</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                Prim Oranı (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                value={rate}
                onChange={(e) => handleRateChange(e.target.value)}
                className="w-full bg-surface-container-low border border-theme-border rounded-xl px-3 py-2 text-xs font-semibold text-on-surface outline-none focus:border-primary transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                Prim Tutarı (₺)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full bg-surface-container-low border border-theme-border rounded-xl px-3 py-2 text-xs font-bold text-emerald-600 outline-none focus:border-primary transition"
              />
            </div>
          </div>

          {isManual && (
            <p className="text-[11px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 p-2 rounded-lg border border-purple-200 dark:border-purple-800/40">
              ℹ️ Bu karta özel bir fiyat veya oran belirlediğinizde, bu fiyat kalıcı olarak sabit kalır ve sipariş tutarı güncellense dahi otomatik değişmez.
            </p>
          )}

          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Notlar
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="İsteğe bağlı açıklama..."
              className="w-full bg-surface-container-low border border-theme-border rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-theme-border text-xs text-text-muted hover:text-on-surface transition"
            >
              {t('common.cancel', 'Vazgeç')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              {saving ? 'Kaydediliyor...' : t('common.save', 'Kaydet')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Rates Settings Quick Modal
 */
function RatesSettingsModal({ salesTeam, ratesMap, onClose, onSaved }) {
  const { updateCommissionRate } = useData();
  const [rates, setRates] = useState({ ...ratesMap });
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const handleSave = async (userId) => {
    setSavingId(userId);
    try {
      const val = parseFloat(rates[userId]);
      if (isNaN(val) || val < 0 || val > 100) {
        alert('Lütfen 0 ile 100 arasında geçerli bir prim yüzdesi girin.');
        return;
      }
      await updateCommissionRate(userId, val);
      setSavedId(userId);
      await onSaved();
      setTimeout(() => setSavedId(null), 1500);
    } catch (err) {
      alert(err.message || 'Hata oluştu');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-surface border border-theme-border rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-theme-border pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">percent</span>
            <h3 className="font-bold text-sm text-on-surface">
              Satış Temsilcisi Prim Oranları
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-on-surface transition"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <p className="text-xs text-text-muted shrink-0">
          Her personel için yeni siparişlerde uygulanacak prim yüzdesini belirleyin. Burada yapılan güncellemeler <strong>geçmişe etki etmez</strong>; yeni gelen siparişler bu oranla hesaplanır.
        </p>

        <div className="overflow-y-auto space-y-2 pr-1 flex-1">
          {salesTeam.map((u) => {
            const currentVal = rates[u.id] !== undefined ? rates[u.id] : 3;
            const isSaving = savingId === u.id;
            const isSaved = savedId === u.id;

            return (
              <div
                key={u.id}
                className="p-3 bg-surface-container-low border border-theme-border rounded-xl flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-bold text-xs text-on-surface">{u.name}</p>
                  <p className="text-[10px] text-text-muted">{u.department || 'Satış'}</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-surface-container-lowest border border-theme-border rounded-lg px-2 py-1">
                    <span className="text-xs font-bold text-text-muted">%</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={currentVal}
                      onChange={(e) => setRates({ ...rates, [u.id]: e.target.value })}
                      className="w-14 bg-transparent text-xs font-bold text-on-surface outline-none text-right"
                    />
                  </div>

                  <button
                    onClick={() => handleSave(u.id)}
                    disabled={isSaving}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition ${
                      isSaved
                        ? 'bg-emerald-600 text-white'
                        : 'bg-primary hover:bg-primary-hover text-white disabled:opacity-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {isSaved ? 'check' : isSaving ? 'progress_activity' : 'save'}
                    </span>
                    {isSaved ? 'Tamam' : isSaving ? '...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-theme-border flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-theme-border text-xs text-text-muted hover:text-on-surface transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
