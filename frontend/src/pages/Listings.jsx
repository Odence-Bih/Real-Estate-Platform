import { useEffect, useState, lazy, Suspense } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import ListingCard from '../components/ListingCard'

const MapView = lazy(() => import('../components/MapView'))

const NEIGHBORHOODS = [
  'Bota', 'Down Beach', 'GRA', 'Mabeta', 'Mile One', 'Mile Two',
  'Mile Four', 'Church Street', 'Limbe Town', 'Batoke', 'Idenau', 'Other',
]

const PROPERTY_TYPES = [
  { value: 'land', label: 'Land' },
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'room', label: 'Room' },
]

export default function Listings() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const navigate = useNavigate()
  const [view, setView] = useState('grid') // grid | list | map
  const [showFilters, setShowFilters] = useState(false)

  // Read filters from URL
  const filters = {
    search: searchParams.get('search') || '',
    property_type: searchParams.get('type') || '',
    transaction_type: searchParams.get('transaction') || '',
    neighborhood: searchParams.get('neighborhood') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    bedrooms: searchParams.get('bedrooms') || '',
    sort: searchParams.get('sort') || 'newest',
    page: parseInt(searchParams.get('page') || '1'),
  }

  const ITEMS_PER_PAGE = 12

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    // Reset to page 1 when changing filters
    if (key !== 'page') params.set('page', '1')
    setSearchParams(params)
  }

  const clearFilters = () => {
    setSearchParams({})
  }

  useEffect(() => {
    async function fetchListings() {
      setLoading(true)

      let query = supabase
        .from('listings')
        .select(
          `*, images:listing_images (id, image_url, display_order)`,
          { count: 'exact' }
        )
        .eq('is_active', true)
        .eq('status', 'available')

      if (filters.property_type) {
        query = query.eq('property_type', filters.property_type)
      }
      if (filters.transaction_type) {
        query = query.eq('transaction_type', filters.transaction_type)
      }
      if (filters.neighborhood) {
        query = query.eq('neighborhood', filters.neighborhood)
      }
      if (filters.min_price) {
        query = query.gte('price', parseInt(filters.min_price))
      }
      if (filters.max_price) {
        query = query.lte('price', parseInt(filters.max_price))
      }
      if (filters.bedrooms) {
        query = query.gte('bedrooms', parseInt(filters.bedrooms))
      }
      if (filters.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        )
      }

      // Sort
      if (filters.sort === 'price_asc') {
        query = query.order('price', { ascending: true })
      } else if (filters.sort === 'price_desc') {
        query = query.order('price', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      // Pagination
      const offset = (filters.page - 1) * ITEMS_PER_PAGE
      query = query.range(offset, offset + ITEMS_PER_PAGE - 1)

      const { data, error, count } = await query

      if (!error) {
        setListings(data || [])
        setTotal(count || 0)
      }
      setLoading(false)
    }

    fetchListings()
  }, [searchParams])

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)
  const hasActiveFilters =
    filters.property_type ||
    filters.transaction_type ||
    filters.neighborhood ||
    filters.min_price ||
    filters.max_price ||
    filters.bedrooms ||
    filters.search

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('common.listings')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} {total === 1 ? 'property' : 'properties'} found
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort */}
          <select
            value={filters.sort}
            onChange={(e) => updateFilter('sort', e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>

          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded ${view === 'grid' ? 'bg-white shadow-sm' : ''}`}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z" />
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded ${view === 'list' ? 'bg-white shadow-sm' : ''}`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z" />
              </svg>
            </button>
            <button
              onClick={() => setView('map')}
              className={`p-1.5 rounded ${view === 'map' ? 'bg-white shadow-sm' : ''}`}
              title="Map view"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M15.817.113A.5.5 0 0116 .5v14a.5.5 0 01-.402.49l-5 1a.502.502 0 01-.196 0L5.5 15.01l-4.902.98A.5.5 0 010 15.5v-14a.5.5 0 01.402-.49l5-1a.502.502 0 01.196 0L10.5.99l4.902-.98a.5.5 0 01.415.103zM10 1.91l-4-.8v12.98l4 .8V1.91zm1 12.98l4-.8V1.11l-4 .8v12.98zm-6-.8V1.11l-4 .8v12.98l4-.8z" />
              </svg>
            </button>
          </div>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            Filters
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Filters sidebar */}
        <aside
          className={`shrink-0 ${showFilters ? 'block w-full' : 'hidden'} md:block md:w-64`}
        >
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5 sticky top-20">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Filters</h2>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('common.search')}
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder={t('home.searchPlaceholder')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Transaction type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transaction
              </label>
              <select
                value={filters.transaction_type}
                onChange={(e) => updateFilter('transaction', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">All</option>
                <option value="sale">{t('home.forSale')}</option>
                <option value="rent">{t('home.forRent')}</option>
              </select>
            </div>

            {/* Property type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Type
              </label>
              <select
                value={filters.property_type}
                onChange={(e) => updateFilter('type', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Types</option>
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Neighborhood */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Neighborhood
              </label>
              <select
                value={filters.neighborhood}
                onChange={(e) => updateFilter('neighborhood', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Neighborhoods</option>
                {NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Price range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price Range (FCFA)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={filters.min_price}
                  onChange={(e) => updateFilter('min_price', e.target.value)}
                  placeholder="Min"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  value={filters.max_price}
                  onChange={(e) => updateFilter('max_price', e.target.value)}
                  placeholder="Max"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Bedrooms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Bedrooms
              </label>
              <select
                value={filters.bedrooms}
                onChange={(e) => updateFilter('bedrooms', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Any</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        {/* Listings grid / map */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg mb-2">
                {t('common.noResults')}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-green-600 hover:underline text-sm"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : view === 'map' ? (
            <Suspense
              fallback={
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              <div style={{ height: '600px' }} className="rounded-xl overflow-hidden border border-gray-200">
                <MapView
                  listings={listings}
                  onMarkerClick={(listing) => navigate(`/listings/${listing.id}`)}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Showing {listings.filter((l) => l.latitude && l.longitude).length} of {listings.length} listings with map coordinates
              </p>
            </Suspense>
          ) : (
            <>
              <div
                className={
                  view === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'space-y-4'
                }
              >
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    view={view}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    onClick={() =>
                      updateFilter('page', String(filters.page - 1))
                    }
                    disabled={filters.page <= 1}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {filters.page} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      updateFilter('page', String(filters.page + 1))
                    }
                    disabled={filters.page >= totalPages}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
