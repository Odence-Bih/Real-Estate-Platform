const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

// Middleware: verify JWT from Authorization header
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.split(' ')[1]

  try {
    // Create a client with the user's JWT to respect RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    req.user = user
    req.supabase = supabase
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

// Middleware: require admin role
const requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const { supabaseAdmin } = require('../config/supabase')

  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', req.user.id)
    .single()

  if (error || !profile || profile.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }

  next()
}

module.exports = { authenticate, requireAdmin }
