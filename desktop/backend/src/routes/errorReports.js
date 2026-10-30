const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

function getErrorDir() {
  const configuredDir = process.env.ERROR_LOGS_DIR || process.env.ERRORS_DIR || '/var/www/errors';
  try {
    if (!fs.existsSync(configuredDir)) {
      fs.mkdirSync(configuredDir, { recursive: true });
    }
    const testFile = path.join(configuredDir, '.write_test_' + Date.now());
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return configuredDir;
  } catch (err) {
    console.warn(`[ErrorReports] Failed to use configured dir '${configuredDir}', falling back to local errors directory. Reason:`, err.message);
    const fallbackDir = path.resolve(__dirname, '../../errors');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return fallbackDir;
  }
}

/**
 * POST /api/errors/report
 * Public/Protected endpoint: Accepts crash report from frontend
 */
router.post('/report', async (req, res) => {
  try {
    const {
      error,
      context,
      user,
      consoleLogs,
      userNote,
      timestamp,
    } = req.body;

    const errorDir = getErrorDir();

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const rand = Math.random().toString(36).substring(2, 7);

    const filename = `crash_${dateStr}_${timeStr}_${rand}.json`;
    const filePath = path.join(errorDir, filename);

    const reportData = {
      id: `crash_${Date.now()}_${rand}`,
      reportedAt: now.toISOString(),
      clientTimestamp: timestamp || now.toISOString(),
      user: user || req.user || { name: 'Anonim / Çıkış Yapılmış', role: 'unknown' },
      userNote: userNote || '',
      error: {
        name: error?.name || 'Error',
        message: error?.message || 'Bilinmeyen Hata',
        stack: error?.stack || '',
        componentStack: error?.componentStack || '',
      },
      context: {
        url: context?.url || '',
        path: context?.path || '',
        userAgent: context?.userAgent || req.headers['user-agent'] || '',
        platform: context?.platform || '',
        screen: context?.screen || {},
        ip: req.ip || req.headers['x-forwarded-for'] || '',
      },
      consoleLogs: Array.isArray(consoleLogs) ? consoleLogs : [],
    };

    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2), 'utf8');

    // Also append one line to summary log file
    const summaryLogPath = path.join(errorDir, 'crash_summary.log');
    const summaryLine = `[${now.toISOString()}] [CRASH] User: ${reportData.user.name || 'Anon'} (${reportData.user.role || '-'}) | Path: ${reportData.context.path} | Error: ${reportData.error.name}: ${reportData.error.message} | File: ${filename}\n`;
    fs.appendFileSync(summaryLogPath, summaryLine, 'utf8');

    console.log(`[ErrorReports] Crash report saved to ${filePath}`);

    res.status(201).json({
      success: true,
      logFile: filename,
      errorDir,
      message: 'Hata raporu başarıyla kaydedildi.',
    });
  } catch (err) {
    console.error('[ErrorReports] Failed to save crash report:', err);
    res.status(500).json({ error: 'Hata raporu kaydedilemedi: ' + err.message });
  }
});

/**
 * GET /api/errors/recent
 * Retrieve list of recent error files
 */
router.get('/recent', async (req, res) => {
  try {
    const errorDir = getErrorDir();
    const files = fs.readdirSync(errorDir)
      .filter(f => f.startsWith('crash_') && f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 30);

    const reports = files.map(file => {
      try {
        const content = fs.readFileSync(path.join(errorDir, file), 'utf8');
        const parsed = JSON.parse(content);
        return {
          filename: file,
          id: parsed.id,
          reportedAt: parsed.reportedAt,
          user: parsed.user?.name || 'Anon',
          error: parsed.error?.message || 'Bilinmiyor',
          path: parsed.context?.path || '',
        };
      } catch {
        return { filename: file, error: 'Dosya okunamadı' };
      }
    });

    res.json({ errorDir, reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

