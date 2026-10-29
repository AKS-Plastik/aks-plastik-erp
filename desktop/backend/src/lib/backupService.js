const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const archiver = require('archiver')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function createZipArchive(options = { zlib: { level: 9 } }) {
  if (typeof archiver === 'function') {
    return archiver('zip', options)
  }
  if (archiver.ZipArchive) {
    return new archiver.ZipArchive(options)
  }
  if (typeof archiver.default === 'function') {
    return archiver.default('zip', options)
  }
  throw new Error('Archiver modülü başlatılamadı.')
}

function getBackupDir() {
  const configuredDir = process.env.BACKUP_DIR || './backups'
  const resolvedDir = path.isAbsolute(configuredDir)
    ? configuredDir
    : path.resolve(__dirname, '..', '..', configuredDir)

  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true })
  }
  return resolvedDir
}

function findPgDumpBinary() {
  if (process.env.PG_DUMP_PATH && fs.existsSync(process.env.PG_DUMP_PATH)) {
    return process.env.PG_DUMP_PATH
  }

  const commonPaths = [
    'D:\\Run\\postgresql\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
    '/usr/bin/pg_dump',
    '/usr/local/bin/pg_dump',
  ]

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p
  }

  return 'pg_dump'
}

function parseDatabaseUrl(dbUrl) {
  try {
    const url = new URL(dbUrl)
    return {
      host: url.hostname || 'localhost',
      port: url.port || '5432',
      user: url.username || 'postgres',
      password: decodeURIComponent(url.password || ''),
      database: url.pathname.replace(/^\//, '') || 'aks_erp',
    }
  } catch {
    return {
      host: 'localhost',
      port: '5432',
      user: 'postgres',
      password: '',
      database: 'aks_erp',
    }
  }
}

async function exportKeycloakData() {
  const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080'
  const REALM = process.env.KEYCLOAK_REALM || 'AKS'
  const ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || 'admin'
  const ADMIN_PASS = process.env.KEYCLOAK_ADMIN_PASS || 'admin'

  try {
    const tokenRes = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: ADMIN_USER,
        password: ADMIN_PASS,
      }).toString(),
      signal: AbortSignal.timeout(6000),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      return { success: false, error: `Keycloak token alınamadı (${tokenRes.status}): ${errText}` }
    }

    const { access_token: token } = await tokenRes.json()
    const headers = { Authorization: `Bearer ${token}` }

    // 1. Realm details
    let realmData = null
    const realmRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}`, { headers, signal: AbortSignal.timeout(6000) })
    if (realmRes.ok) realmData = await realmRes.json()

    // 2. Users
    let usersData = []
    const usersRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/users?max=10000`, { headers, signal: AbortSignal.timeout(8000) })
    if (usersRes.ok) usersData = await usersRes.json()

    // 3. Roles
    let rolesData = []
    const rolesRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/roles`, { headers, signal: AbortSignal.timeout(6000) })
    if (rolesRes.ok) rolesData = await rolesRes.json()

    // 4. Clients
    let clientsData = []
    const clientsRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients`, { headers, signal: AbortSignal.timeout(6000) })
    if (clientsRes.ok) clientsData = await clientsRes.json()

    return {
      success: true,
      realm: realmData,
      users: usersData,
      roles: rolesData,
      clients: clientsData,
    }
  } catch (err) {
    return {
      success: false,
      error: `Keycloak erişim hatası: ${err.message}`,
      isNetworkError: true,
    }
  }
}

async function exportPrismaErpData() {
  try {
    const [users, employees, roles, rolePermissions, employeePermissions, customers, products] = await Promise.all([
      prisma.user.findMany({ include: { employee: true } }),
      prisma.employee.findMany(),
      prisma.userRole.findMany(),
      prisma.rolePermission.findMany(),
      prisma.employeePermission.findMany(),
      prisma.customer.findMany({ include: { tags: true } }),
      prisma.product.findMany(),
    ])

    return {
      users,
      employees,
      roles,
      rolePermissions,
      employeePermissions,
      customersCount: customers.length,
      productsCount: products.length,
      exportedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[BACKUP] Prisma data export error:', err)
    return { error: err.message }
  }
}

function dumpPostgresToFile(outputSqlPath) {
  return new Promise((resolve, reject) => {
    const pgDumpBin = findPgDumpBinary()
    const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL)

    const args = [
      `--host=${dbConfig.host}`,
      `--port=${dbConfig.port}`,
      `--username=${dbConfig.user}`,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      `--file=${outputSqlPath}`,
      dbConfig.database,
    ]

    const env = {
      ...process.env,
      PGPASSWORD: dbConfig.password,
    }

    execFile(pgDumpBin, args, { env, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`pg_dump hatası: ${error.message} - ${stderr}`))
      }
      resolve({ stdout, stderr })
    })
  })
}

function generateRestoreInstructions(dbName, zipName) {
  return `# AKS ERP - Yedek Geri Yükleme Rehberi (Restore Instructions)

Bu yedek dosyası **${zipName}**, AKS ERP sisteminin PostgreSQL veritabanını, ERP kullanıcılarını ve Keycloak kimlik verilerini eksiksiz içerir.

---

## 1. Paket İçeriği
- \`aks_erp.sql\`: PostgreSQL tam şema ve veri dökümü (pg_dump formatında).
- \`aks_erp_users.json\`: ERP kullanıcıları, çalışan kartları ve rol yetkileri dökümü.
- \`aks_erp_snapshot.json\`: Temel sistem modelleri ve kayıt özetleri.
- \`keycloak_realm.json\` / \`keycloak_users.json\`: Keycloak realm ve kullanıcı yapılandırmaları.
- \`metadata.json\`: Yedeğin oluşturulma tarihi, türü, versiyonu ve dosya boyutları.

---

## 2. PostgreSQL Veritabanını Geri Yükleme (Restore)

### Yöntem A: Komut Satırı (psql) ile Geri Yükleme
Zipten çıkan \`aks_erp.sql\` dosyasını doğrudan PostgreSQL sunucunuza aktarabilirsiniz:

\`\`\`bash
# 1. Hedef veritabanı yoksa oluşturun:
createdb -h localhost -p 5432 -U postgres ${dbName}

# 2. SQL yedeğini çalıştırın:
psql -h localhost -p 5432 -U postgres -d ${dbName} -f aks_erp.sql
\`\`\`

*(Windows için pg_dump/psql yolunu kullanın, örneğin: \`"D:\\Run\\postgresql\\bin\\psql.exe" -U postgres -d ${dbName} -f aks_erp.sql\`)*

### Yöntem B: pgAdmin veya DBeaver ile Geri Yükleme
1. pgAdmin veya DBeaver ile PostgreSQL sunucunuza bağlanın.
2. \`${dbName}\` veritabanına sağ tıklayın -> **Query Tool (Sorgu Aracı)** açın.
3. \`aks_erp.sql\` dosyasını açıp çalıştırın (Execute).

---

## 3. Keycloak Kullanıcılarını ve Ayarlarını Geri Yükleme
- Keycloak Yönetim Paneline (\`https://keycloak.aksplastikambalaj.com\` veya yerel) **admin** olarak giriş yapın.
- Sol menüden **Realm Settings** -> **Action** -> **Partial Import** seçeneğine tıklayın.
- Zipten çıkan \`keycloak_realm.json\` veya \`keycloak_users.json\` dosyasını seçerek içe aktarın.

---
Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}
`
}

async function createBackup({ isAutomatic = false } = {}) {
  const backupDir = getBackupDir()
  const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL)
  const now = new Date()

  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`
  const prefix = isAutomatic ? 'aks_auto_backup' : 'aks_manual_backup'
  const zipFileName = `${prefix}_${timestamp}.zip`
  const zipFilePath = path.join(backupDir, zipFileName)

  const tempSqlFile = path.join(backupDir, `temp_dump_${timestamp}.sql`)

  try {
    // 1. PostgreSQL dump
    let pgDumpSuccess = false
    let pgDumpError = null
    try {
      await dumpPostgresToFile(tempSqlFile)
      pgDumpSuccess = true
    } catch (err) {
      console.warn('[BACKUP] pg_dump failed or binary not found, generating JSON export:', err.message)
      pgDumpError = err.message
    }

    // 2. Keycloak Export
    const keycloakExport = await exportKeycloakData()

    // 3. Prisma ERP Data Export
    const erpDataExport = await exportPrismaErpData()

    // 4. Create ZIP Archive
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipFilePath)
      const archive = createZipArchive({ zlib: { level: 9 } })

      output.on('close', resolve)
      archive.on('error', reject)

      archive.pipe(output)

      // Add PostgreSQL dump if created
      if (pgDumpSuccess && fs.existsSync(tempSqlFile)) {
        archive.file(tempSqlFile, { name: 'aks_erp.sql' })
      }

      // Add ERP users and data
      archive.append(JSON.stringify(erpDataExport.users || [], null, 2), { name: 'aks_erp_users.json' })
      archive.append(JSON.stringify(erpDataExport, null, 2), { name: 'aks_erp_snapshot.json' })

      // Add Keycloak data
      if (keycloakExport.success) {
        archive.append(JSON.stringify(keycloakExport.realm || {}, null, 2), { name: 'keycloak_realm.json' })
        archive.append(JSON.stringify(keycloakExport.users || [], null, 2), { name: 'keycloak_users.json' })
        archive.append(JSON.stringify({ roles: keycloakExport.roles, clients: keycloakExport.clients }, null, 2), { name: 'keycloak_roles_clients.json' })
      } else {
        archive.append(JSON.stringify({
          status: 'skipped_or_unreachable',
          error: keycloakExport.error,
          note: 'Keycloak sunucusuna erişilemedi, ancak veritabanı ve ERP kullanıcıları eksiksiz yedeklendi.',
          timestamp: new Date().toISOString(),
        }, null, 2), { name: 'keycloak_status.json' })
      }

      // Add restore instructions
      const instructions = generateRestoreInstructions(dbConfig.database, zipFileName)
      archive.append(instructions, { name: 'RESTORE_INSTRUCTIONS.md' })

      // Metadata
      const metadata = {
        fileName: zipFileName,
        createdAt: now.toISOString(),
        isAutomatic,
        type: isAutomatic ? 'cron' : 'manual',
        database: dbConfig.database,
        postgresHost: dbConfig.host,
        pgDumpSuccess,
        pgDumpError,
        keycloakSuccess: keycloakExport.success,
        keycloakUserCount: keycloakExport.users?.length || 0,
        erpUserCount: erpDataExport.users?.length || 0,
        appVersion: require('../../package.json').version || '2.1.3',
      }
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' })

      archive.finalize()
    })

    // Clean up temporary SQL dump file
    if (fs.existsSync(tempSqlFile)) {
      try { fs.unlinkSync(tempSqlFile) } catch {}
    }

    const fileStat = fs.statSync(zipFilePath)

    // Run retention cleanup
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10)
    const cleanupResult = cleanupOldBackups(retentionDays)

    return {
      success: true,
      fileName: zipFileName,
      filePath: zipFilePath,
      sizeBytes: fileStat.size,
      sizeFormatted: (fileStat.size / (1024 * 1024)).toFixed(2) + ' MB',
      createdAt: now.toISOString(),
      isAutomatic,
      keycloakIncluded: keycloakExport.success,
      cleanupCount: cleanupResult.deletedCount,
    }
  } catch (err) {
    if (fs.existsSync(tempSqlFile)) {
      try { fs.unlinkSync(tempSqlFile) } catch {}
    }
    throw err
  }
}

function cleanupOldBackups(retentionDays = 7) {
  const backupDir = getBackupDir()
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  let deletedCount = 0
  const deletedFiles = []

  try {
    const files = fs.readdirSync(backupDir)
    for (const file of files) {
      if (!file.endsWith('.zip') || (!file.startsWith('aks_') && !file.includes('backup'))) continue

      const fullPath = path.join(backupDir, file)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.mtimeMs < cutoffTime) {
          fs.unlinkSync(fullPath)
          deletedCount++
          deletedFiles.push(file)
          console.log(`[BACKUP CLEANUP] 7 günden eski yedek silindi: ${file}`)
        }
      } catch (err) {
        console.error(`[BACKUP CLEANUP] Dosya silinemedi (${file}):`, err.message)
      }
    }
  } catch (err) {
    console.error('[BACKUP CLEANUP] Hata:', err)
  }

  return { deletedCount, deletedFiles }
}

function listBackups() {
  const backupDir = getBackupDir()
  const backups = []

  try {
    const files = fs.readdirSync(backupDir)
    for (const file of files) {
      if (!file.endsWith('.zip')) continue

      const fullPath = path.join(backupDir, file)
      try {
        const stat = fs.statSync(fullPath)
        const isAutomatic = file.includes('auto')
        backups.push({
          fileName: file,
          sizeBytes: stat.size,
          sizeFormatted: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
          createdAt: stat.mtime.toISOString(),
          isAutomatic,
          type: isAutomatic ? 'Otomatik (Cron)' : 'Manuel',
        })
      } catch {}
    }

    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  } catch (err) {
    console.error('[BACKUP] List error:', err)
  }

  return backups
}

function deleteBackup(fileName) {
  const backupDir = getBackupDir()
  const safeName = path.basename(fileName)
  const fullPath = path.join(backupDir, safeName)

  if (!fs.existsSync(fullPath)) {
    throw new Error('Yedek dosyası bulunamadı.')
  }

  fs.unlinkSync(fullPath)
  return { success: true, fileName: safeName }
}

module.exports = {
  getBackupDir,
  createBackup,
  listBackups,
  cleanupOldBackups,
  deleteBackup,
}
