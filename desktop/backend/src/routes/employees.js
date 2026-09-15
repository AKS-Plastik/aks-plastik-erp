const { Router } = require('express')
const { PrismaClient } = require('@prisma/client')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const prisma = new PrismaClient()
const router = Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'employees')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${req.params.id}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

router.get('/', async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: 'desc' },
      include: { supervisor: { select: { id: true, name: true } } },
    })
    const photos = await prisma.$queryRaw`SELECT id, photo FROM "Employee"`
    const photoMap = {}
    photos.forEach(r => { photoMap[r.id] = r.photo || null })
    employees.forEach(e => { e.photo = photoMap[e.id] || null })
    res.json(employees)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } })
    if (!employee) return res.status(404).json({ error: 'Employee not found' })
    res.json(employee)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /employees/setmanager — set one employee as dept manager, clear others
// Also sets supervisorId for all other dept employees so they appear as subordinates
router.post('/setmanager', async (req, res) => {
  try {
    const { employeeId, department } = req.body
    if (!employeeId || !department) return res.status(400).json({ error: 'employeeId and department are required' })
    // Clear isManager flag for the whole department
    await prisma.employee.updateMany({ where: { department }, data: { isManager: false } })
    // Mark the new manager
    await prisma.employee.update({ where: { id: employeeId }, data: { isManager: true } })
    // Set supervisorId for all other dept employees so the manager can see their requests
    await prisma.employee.updateMany({
      where: { department, id: { not: employeeId } },
      data: { supervisorId: employeeId },
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, department, position, phone, email, salary, status, hireDate, supervisorId } = req.body
    const code = `EMP-${String(Date.now()).slice(-5)}`
    const initials = (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('')
    const employee = await prisma.employee.create({
      data: {
        code,
        name,
        initials,
        department: department || 'General',
        position: position || '',
        phone: phone || null,
        email: email || null,
        salary: parseFloat(salary) || 0,
        status: status || 'Active',
        hireDate: hireDate || null,
        supervisorId: supervisorId || null,
        isManager: false,
      },
      include: { supervisor: { select: { id: true, name: true } } },
    })
    res.status(201).json(employee)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { name, department, position, phone, email, salary, status, hireDate, supervisorId } = req.body
    const initials = (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('')
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        name,
        initials,
        department: department || 'General',
        position: position || '',
        phone: phone || null,
        email: email || null,
        salary: parseFloat(salary) || 0,
        status: status || 'Active',
        hireDate: hireDate || null,
        supervisorId: supervisorId || null,
      },
      include: { supervisor: { select: { id: true, name: true } } },
    })
    res.json(employee)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const photoUrl = `/uploads/employees/${req.file.filename}`
    await prisma.$executeRawUnsafe(`UPDATE "Employee" SET photo = $1 WHERE id = $2`, photoUrl, req.params.id)
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { supervisor: { select: { id: true, name: true } } },
    })
    const raw = await prisma.$queryRaw`SELECT photo FROM "Employee" WHERE id = ${req.params.id}`
    if (employee && raw[0]) employee.photo = raw[0].photo
    res.json(employee)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}, async (req, res) => {
  try {
    await prisma.employee.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
