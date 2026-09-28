const fs = require('fs');
const path = require('path');

function requestLogger(req, res, next) {
  const logPath = process.env.API_LOG_PATH;
  if (!logPath) {
    return next();
  }

  // Klasör yoksa oluştur
  if (!fs.existsSync(logPath)) {
    try {
      fs.mkdirSync(logPath, { recursive: true });
    } catch (err) {
      console.error('[requestLogger] Log dizini oluşturulamadı:', err);
      return next();
    }
  }

  const start = Date.now();

  res.on('finish', () => {
    try {
      const date = new Date();
      // Türkiye saati ile dosya isimlendirmesi için lokal tarih al
      const dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
        .toISOString()
        .split('T')[0]; // YYYY-MM-DD

      const logFile = path.join(logPath, `${dateString}.txt`);

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const method = req.method;
      const url = req.originalUrl || req.url;

      let userStr = 'Guest';
      if (req.user) {
        userStr = `User[${req.user.id}, ${req.user.email}]`;
      }

      // Parolaları loglamamak için basit bir kopyalama
      let safeBody = {};
      if (req.body) {
        safeBody = { ...req.body };
        if (safeBody.password) safeBody.password = '***';
        if (safeBody.oldPassword) safeBody.oldPassword = '***';
        if (safeBody.newPassword) safeBody.newPassword = '***';
      }

      const payload = {
        body: safeBody,
        query: req.query,
      };

      const logEntry = `[${date.toISOString()}] | IP: ${ip} | User: ${userStr} | Agent: ${userAgent} | Req: ${method} ${url} | Status: ${res.statusCode} | Time: ${Date.now() - start}ms | Payload: ${JSON.stringify(payload)}\n`;

      fs.appendFile(logFile, logEntry, (err) => {
        if (err) console.error('[requestLogger] Log dosyasına yazılamadı:', err);
      });
    } catch (error) {
      console.error('[requestLogger] Beklenmeyen hata:', error);
    }
  });

  next();
}
module.exports = requestLogger;
