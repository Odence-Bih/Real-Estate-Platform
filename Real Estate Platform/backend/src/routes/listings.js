const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { supabaseAdmin } = require('../config/supabase')

// Middleware: require verified vendor/agent/landlord
const requireVerified = async (req, res, next) => {
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role, verification_status')
    .eq('id', req.user.id)
    .single()

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' })
  }

  if (profile.role === 'buyer') {
    return res.status(403).json({ error: 'Buyers cannot create listings' })
  }

  if (profile.role !== 'admin' && profile.verification_status !== 'approved') {
    return res.status(403).json({ error: 'Account must be verified to create listings' })
  }

  next()
}

// GET /api/listings — browse all active listings (public)
router.get('/', async (req, res) => {
  const {
    property_type,
    transaction_type,
    location,
    min_price,
    max_price,
    bedrooms,
    search,
    sort = 'newest',
    page = 1,
    limit = 20,
  } = req.query

  try {
    let query = supabaseAdmin
      .from('listings')
      .select(`
        *,
        images:listing_images (id, image_url, display_order),
        owner:user_profiles!owner_id (id, full_name, role, verification_status)
      `, { count: 'exact' })
      .eq('is_active', true)

    if (property_type) query = query.eq('property_type', property_type)
    if (transaction_type) query = query.eq('transaction_type', transaction_type)
    if (location) query = query.ilike('location', `%${location}%`)
    if (min_price) query = query.gte('price', parseInt(min_price))
    if (max_price) query = query.lte('price', parseInt(max_price))
    if (bedrooms) query = query.gte('bedrooms', parseInt(bedrooms))
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

    // Sorting
    if (sort === 'price_asc') query = query.order('price', { ascending: true })
    else if (sort === 'price_desc') query = query.order('price', { ascending: false })
    else query = query.order('created_at', { ascending: false })

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit)
    query = query.range(offset, offset + parseInt(limit) - 1)

    const { data, error, count } = await query

    if (error) throw error

    res.json({
      listings: data,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listings' })
  }
})

// GET /api/listings/:id — single listing detail (public)
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('listings')
      .select(`
        *,
        images:listing_images (id, image_url, display_order),
        owner:user_profiles!owner_id (id, full_name, role, verification_status, avatar_url, created_at)
      `)
      .eq('id', req.params.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Listing not found' })
    }

    // Sort images by display_order
    if (data.images) {
      data.images.sort((a, b) => a.display_order - b.display_order)
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listing' })
  }
})

// POST /api/listings — create new listing (requires auth + verified)
router.post('/', authenticate, requireVerified, async (req, res) => {
  const {
    title,
    description,
    property_type,
    transaction_type,
    price,
    price_period,
    location,
    neighborhood,
    latitude,
    longitude,
    size_sqm,
    bedrooms,
    bathrooms,
    amenities,
    payment_terms,
    images, // array of { image_url, storage_path, display_order }
  } = req.body

  // Validate required fields
  if (!title || !description || !property_type || !transaction_type || !price || !location) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (!images || images.length < 2) {
    return res.status(400).json({ error: 'At least 2 photos are required' })
  }

  if (images.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 photos allowed' })
  }

  try {
    // Create listing
    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .insert({
        owner_id: req.user.id,
        title,
        description,
        property_type,
        transaction_type,
        price: parseInt(price),
        price_period: price_period || (transaction_type === 'rent' ? 'per_month' : 'total'),
        location,
        neighborhood,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        size_sqm: size_sqm ? parseFloat(size_sqm) : null,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseInt(bathrooms) : null,
        amenities: amenities || [],
        payment_terms,
      })
      .select()
      .single()

    if (listingError) throw listingError

    // Insert images
    const imageRecords = images.map((img, idx) => ({
      listing_id: listing.id,
      image_url: img.image_url,
      storage_path: img.storage_path,
      display_order: img.display_order ?? idx,
    }))

    const { error: imagesError } = await supabaseAdmin
      .from('listing_images')
      .insert(imageRecords)

    if (imagesError) throw imagesError

    // Fetch complete listing with images
    const { data: complete } = await supabaseAdmin
      .from('listings')
      .select(`
        *,
        images:listing_images (id, image_url, display_order)
      `)
      .eq('id', listing.id)
      .single()

    res.status(201).json(complete)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create listing' })
  }
})

// PATCH /api/listings/:id — update listing (owner only)
router.patch('/:id', authenticate, async (req, res) => {
  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from('listings')
    .select('owner_id')
    .eq('id', req.params.id)
    .single()

  if (!existing) {
    return res.status(404).json({ error: 'Listing not found' })
  }

  if (existing.owner_id !== req.user.id) {
    // Check if admin
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' })
    }
  }

  const allowedFields = [
    'title', 'description', 'property_type', 'transaction_type',
    'price', 'price_period', 'location', 'neighborhood',
    'latitude', 'longitude', 'size_sqm', 'bedrooms', 'bathrooms',
    'amenities', 'payment_terms', 'status', 'is_active',
  ]

  const updates = {}
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field]
    }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('listings')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update listing' })
  }
})

// DELETE /api/listings/:id — delete listing (owner or admin)
router.delete('/:id', authenticate, async (req, res) => {
  const { data: existing } = await supabaseAdmin
    .from('listings')
    .select('owner_id')
    .eq('id', req.params.id)
    .single()

  if (!existing) {
    return res.status(404).json({ error: 'Listing not found' })
  }

  if (existing.owner_id !== req.user.id) {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' })
    }
  }

  try {
    const { error } = await supabaseAdmin
      .from('listings')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ message: 'Listing deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete listing' })
  }
})

// GET /api/listings/my/all — get current user's listings
router.get('/my/all', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('listings')
      .select(`
        *,
        images:listing_images (id, image_url, display_order)
      `)
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your listings' })
  }
})

module.exports = router
