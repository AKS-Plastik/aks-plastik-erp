const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080'
const REALM = process.env.KEYCLOAK_REALM || 'AKS'

const jwks = jwksClient({
  jwksUri: `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
  rateLimit: true,
})

function getSigningKey(header) {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(header.kid, (err, key) => {
      if (err) reject(err)
      else resolve(key.getPublicKey())
    })
  })
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const token = header.split(' ')[1]

    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          getSigningKey(header).then((key) => callback(null, key)).catch(callback)
        },
        { algorithms: ['RS256'] },
        (err, payload) => {
          if (err) reject(err)
          else resolve(payload)
        }
      )
    })

    // Use email, fallback to preferred_username (which is 'admin' for the admin user)
    const userEmail = decoded.email || decoded.preferred_username;
    // console.log('KEYCLOAK DECODED USER:', userEmail);

    // Look up Prisma user by email to get ERP-specific fields (role, department, etc.)
    let dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: userEmail },
          ...(decoded.email ? [{ email: decoded.email }] : []),
          ...(userEmail === 'admin' ? [{ email: 'admin@fieldhub.com' }] : []),
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        employeeId: true,
        employee: {
          select: {
            id: true,
            name: true,
            department: true,
            position: true,
            isManager: true,
          },
        },
      },
    })

    if (!dbUser && (decoded.email || decoded.preferred_username)) {
      const email = decoded.email || (userEmail === 'admin' ? 'admin@fieldhub.com' : `${userEmail}@aksplastikambalaj.com`)
      const name = decoded.name || [decoded.given_name, decoded.family_name].filter(Boolean).join(' ') || decoded.preferred_username || email
      dbUser = await prisma.user.create({
        data: {
          email,
          name,
          password: Math.random().toString(36),
          role: 'admin',
        },
        select: { id: true, email: true, name: true, role: true, department: true, employeeId: true },
      })
    }

    if (!dbUser) {
      return res.status(401).json({ error: 'User not registered in this system' })
    }

    req.user = dbUser
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

module.exports = { authenticate, adminOnly }
