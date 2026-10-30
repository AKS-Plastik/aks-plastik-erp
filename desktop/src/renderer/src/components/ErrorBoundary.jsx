import React from 'react';
import { API_URL } from '../config';
import { getRecentLogs } from '../utils/logger';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      reporting: false,
      reported: false,
      logFile: null,
      reportError: null,
      countdown: 10,
      isTimerActive: true,
      userNote: '',
      showNoteBox: false,
      showDetails: false,
    };
    this.timerId = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught crash:', error, errorInfo);

    // Automatically send error report to backend
    this.sendErrorReport(error, errorInfo);

    // Start auto-redirect countdown to safely take the user back to dashboard
    this.startCountdown();
  }

  componentWillUnmount() {
    this.clearCountdown();
  }

  startCountdown = () => {
    this.clearCountdown();
    this.timerId = setInterval(() => {
      this.setState((prev) => {
        if (!prev.isTimerActive) return null;
        if (prev.countdown <= 1) {
          this.clearCountdown();
          this.redirectToHome();
          return { countdown: 0 };
        }
        return { countdown: prev.countdown - 1 };
      });
    }, 1000);
  };

  clearCountdown = () => {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  };

  toggleTimer = () => {
    this.setState((prev) => {
      const next = !prev.isTimerActive;
      if (!next) {
        this.clearCountdown();
      } else {
        this.startCountdown();
      }
      return { isTimerActive: next };
    });
  };

  getUserInfo = () => {
    try {
      const saved = localStorage.getItem('aks_user_info');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return { name: 'Giriş Yapmış Kullanıcı' };
  };

  sendErrorReport = async (overrideError, overrideInfo, customNote) => {
    const error = overrideError || this.state.error;
    const errorInfo = overrideInfo || this.state.errorInfo;
    const note = customNote !== undefined ? customNote : this.state.userNote;

    this.setState({ reporting: true, reportError: null });

    try {
      const payload = {
        error: {
          name: error?.name || 'Error',
          message: error?.message || 'Bilinmeyen Hata',
          stack: error?.stack || '',
          componentStack: errorInfo?.componentStack || '',
        },
        context: {
          url: window.location.href,
          path: window.location.hash || window.location.pathname,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screen: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        },
        user: this.getUserInfo(),
        consoleLogs: getRecentLogs(),
        userNote: note,
        timestamp: new Date().toISOString(),
      };

      const res = await fetch(`${API_URL}/errors/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${(await res.text()) || 'Gönderilemedi'}`);
      }

      const data = await res.json();
      this.setState({
        reporting: false,
        reported: true,
        logFile: data.logFile,
      });
    } catch (err) {
      console.error('[ErrorBoundary] Failed to report crash to server:', err);
      this.setState({
        reporting: false,
        reportError: err.message,
      });
    }
  };

  redirectToHome = () => {
    this.clearCountdown();
    this.setState({ hasError: false, error: null, errorInfo: null });

    // In a Single Page App / PWA with HashRouter:
    // Change hash to #/dashboard and force reload to ensure completely clean slate
    const targetUrl = window.location.origin + window.location.pathname + '#/dashboard';
    window.location.href = targetUrl;
    window.location.reload();
  };

  handleManualReport = (e) => {
    e.preventDefault();
    this.sendErrorReport(this.state.error, this.state.errorInfo, this.state.userNote);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const {
      error,
      errorInfo,
      countdown,
      isTimerActive,
      reporting,
      reported,
      logFile,
      reportError,
      showNoteBox,
      userNote,
      showDetails,
    } = this.state;

    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-surface-container-lowest/95 backdrop-blur-md overflow-y-auto">
        <div className="w-full max-w-2xl bg-surface border-2 border-red-500/30 dark:border-red-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-on-surface animate-fadeIn">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <span className="material-symbols-outlined text-2xl sm:text-3xl">warning</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-500 text-white mb-1.5">
                Kritik Ekran Hatası Algılandı
              </div>
              <h1 className="text-lg sm:text-xl font-black text-on-surface leading-tight">
                Sayfa Beklenmedik Şekilde Durduruldu
              </h1>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Uygulama beyaz/boş ekranda kalmaması için kurtarma modu devreye alındı. Sistem teknik detayları toplayarak hata kaydını oluşturdu.
              </p>
            </div>
          </div>

          {/* Auto Redirect Countdown Notice */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <span className="material-symbols-outlined text-lg animate-spin">schedule</span>
              <span>
                {isTimerActive ? (
                  <>
                    <strong>{countdown} saniye</strong> içinde otomatik olarak <strong>Ana Sayfaya</strong> yönlendirileceksiniz.
                  </>
                ) : (
                  <>Otomatik yönlendirme duraklatıldı. Hatayı inceleyebilirsiniz.</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={this.toggleTimer}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-surface border border-theme-border text-text-muted hover:text-on-surface transition"
              >
                {isTimerActive ? 'Sayacı Durdur' : 'Sayacı Başlat'}
              </button>
              <button
                type="button"
                onClick={this.redirectToHome}
                className="px-3 py-1 rounded-lg text-[11px] font-bold bg-primary text-white hover:opacity-90 transition shadow-xs flex items-center gap-1"
              >
                <span>Hemen Git</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Report to Developer Status */}
          <div className="bg-surface-container-low rounded-2xl p-4 border border-theme-border space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">terminal</span>
                <span className="font-bold text-xs">Yazılımcıya Hata Bildirimi</span>
              </div>
              <div>
                {reporting && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    Sunucuya kaydediliyor...
                  </span>
                )}
                {reported && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    Sunucuya İletildi ({logFile || 'Kayıt Açıldı'})
                  </span>
                )}
                {reportError && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                    <span className="material-symbols-outlined text-xs">error</span>
                    İletilemedi: {reportError}
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-text-muted">
              Hata detayları, son konsol çıktıları ve sistem bağlamı <code>/var/www/errors</code> dizinine kaydedilir.
            </p>

            {/* Note toggle */}
            {!showNoteBox ? (
              <button
                type="button"
                onClick={() => this.setState({ showNoteBox: true, isTimerActive: false })}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">add_comment</span>
                <span>Yazılımcıya özel bir not / açıklama eklemek istiyorum</span>
              </button>
            ) : (
              <form onSubmit={this.handleManualReport} className="space-y-2 pt-2 border-t border-theme-border">
                <label className="block text-[11px] font-bold text-text-muted">
                  Hata oluşmadan önce ne yapıyordunuz? (İsteğe bağlı):
                </label>
                <textarea
                  rows={2}
                  value={userNote}
                  onChange={(e) => this.setState({ userNote: e.target.value })}
                  placeholder="Örn: Siparişlerde kalem eklerken onay butonuna bastım..."
                  className="w-full bg-surface-container-lowest border border-theme-border rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary transition"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => this.setState({ showNoteBox: false })}
                    className="px-2.5 py-1 text-xs text-text-muted hover:text-on-surface"
                  >
                    Kapat
                  </button>
                  <button
                    type="submit"
                    disabled={reporting}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">send</span>
                    <span>Yazılımcıya Gönder</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Technical Details Accordion */}
          <div className="border border-theme-border rounded-2xl overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => this.setState({ showDetails: !showDetails })}
              className="w-full bg-surface-container-low px-4 py-2.5 flex items-center justify-between text-text-muted hover:text-on-surface transition font-semibold text-left"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">code</span>
                <span>Teknik Hata Bilgisi: <strong className="text-red-600 font-mono">{error?.message || 'Bilinmeyen Hata'}</strong></span>
              </div>
              <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </button>

            {showDetails && (
              <div className="p-4 bg-surface-container-lowest space-y-3 font-mono text-[11px] max-h-60 overflow-y-auto">
                <div>
                  <span className="text-text-muted uppercase font-bold block text-[10px]">Hata Mesajı:</span>
                  <p className="text-red-500 font-bold whitespace-pre-wrap">{error?.name}: {error?.message}</p>
                </div>
                {error?.stack && (
                  <div>
                    <span className="text-text-muted uppercase font-bold block text-[10px]">Stack Trace:</span>
                    <pre className="text-text-muted whitespace-pre-wrap leading-tight text-[10px] overflow-x-auto bg-surface-container-low p-2 rounded-lg">
                      {error.stack}
                    </pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <span className="text-text-muted uppercase font-bold block text-[10px]">Component Stack:</span>
                    <pre className="text-text-muted whitespace-pre-wrap leading-tight text-[10px] overflow-x-auto bg-surface-container-low p-2 rounded-lg">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                this.clearCountdown();
                window.location.reload();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-theme-border text-xs font-semibold text-text-muted hover:text-on-surface hover:bg-hover-bg transition flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>Sayfayı Yenile</span>
            </button>

            <button
              type="button"
              onClick={this.redirectToHome}
              className="w-full sm:w-auto primary-gradient text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">home</span>
              <span>Ana Sayfaya Dön (Kurtar)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}

