const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in production')
    process.exit(1)
  }
  console.warn(
    'Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env'
  )
}

// Service role client — use for admin operations (bypasses RLS)
const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key'
)

module.exports = { supabaseAdmin }
