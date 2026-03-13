import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import useAuthStore from '../stores/authStore'

const MapView = lazy(() => import('../components/MapView'))

const API = import.meta.env.VITE_API_URL || ''

export default function ListingDetail() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [agentRating, setAgentRating] = useState(null)
  const [agentReviewCount, setAgentReviewCount] = useState(0)

  useEffect(() => {
    async function fetchListing() {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          images:listing_images (id, image_url, display_order),
          videos:listing_videos (id, video_url, display_order),
          owner:user_profiles!owner_id (id, full_name, role, verification_status, created_at)
        `)
        .eq('id', id)
        .single()

      if (!error && data) {
        data.images?.sort((a, b) => a.display_order - b.display_order)
        setListing(data)
      }
      setLoading(false)
    }
    fetchListing()
  }, [id])

  // Fetch agent rating
  useEffect(() => {
    if (!listing?.owner_id) return
    async function fetchRating() {
      try {
        const res = await fetch(`${API}/api/reviews/user/${listing.owner_id}`)
        if (res.ok) {
          const data = await res.json()
          setAgentRating(data.average_rating)
          setAgentReviewCount(data.total_reviews)
        }
      } catch {}
    }
    fetchRating()
  }, [listing?.owner_id])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Listing Not Found
        </h1>
        <Link
          to="/listings"
          className="text-green-600 hover:underline"
        >
          Browse all listings
        </Link>
      </div>
    )
  }

  const images = listing.images || []
  const listingVideos = listing.videos?.sort((a, b) => a.display_order - b.display_order) || []
  const pricePeriod = {
    per_month: t('listing.perMonth'),
    per_year: t('listing.perYear'),
    per_week: '/week',
    total: '',
  }

  const statusColors = {
    available: 'bg-green-100 text-green-700',
    under_offer: 'bg-yellow-100 text-yellow-700',
    rented: 'bg-gray-100 text-gray-600',
    sold: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/listings" className="hover:text-green-600">
          {t('common.listings')}
        </Link>
        <span>/</span>
        <span className="text-gray-900 truncate">{listing.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Images + Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Gallery */}
          <div>
            {images.length > 0 ? (
              <>
                <div className="rounded-xl overflow-hidden bg-gray-100 h-64 sm:h-80 md:h-96">
                  <img
                    src={images[activeImage]?.image_url}
                    alt={`${listing.title} - Photo ${activeImage + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                    {images.map((img, idx) => (
                      <button
                        key={img.id}
                        onClick={() => setActiveImage(idx)}
                        className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                          idx === activeImage
                            ? 'border-green-600'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={img.image_url}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl bg-gray-100 h-64 flex items-center justify-center text-gray-400">
                No photos available
              </div>
            )}
          </div>

          {/* Videos */}
          {listingVideos.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Videos
              </h2>
              <div className="space-y-3">
                {listingVideos.map((video) => (
                  <video
                    key={video.id}
                    controls
                    preload="metadata"
                    className="w-full rounded-xl border border-gray-200"
                    style={{ maxHeight: '400px' }}
                  >
                    <source src={video.video_url} />
                    Your browser does not support video playback.
                  </video>
                ))}
              </div>
            </div>
          )}

          {/* Title + Price (mobile) */}
          <div className="lg:hidden">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[listing.status]}`}
              >
                {listing.status?.replace('_', ' ')}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                {listing.property_type} &middot;{' '}
                {listing.transaction_type === 'sale' ? t('home.forSale') : t('home.forRent')}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {listing.title}
            </h1>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {listing.price?.toLocaleString()} FCFA
              {listing.transaction_type === 'rent' &&
                pricePeriod[listing.price_period]}
            </p>
          </div>

          {/* Description */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {t('listing.description')}
            </h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {listing.description}
            </p>
          </div>

          {/* Property Details */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Property Details
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Type</p>
                <p className="font-medium text-gray-900 capitalize">
                  {listing.property_type}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Transaction</p>
                <p className="font-medium text-gray-900 capitalize">
                  {listing.transaction_type}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{t('listing.location')}</p>
                <p className="font-medium text-gray-900">{listing.location}</p>
              </div>
              {listing.neighborhood && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Neighborhood</p>
                  <p className="font-medium text-gray-900">
                    {listing.neighborhood}
                  </p>
                </div>
              )}
              {listing.bedrooms != null && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{t('listing.bedrooms')}</p>
                  <p className="font-medium text-gray-900">
                    {listing.bedrooms}
                  </p>
                </div>
              )}
              {listing.bathrooms != null && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{t('listing.bathrooms')}</p>
                  <p className="font-medium text-gray-900">
                    {listing.bathrooms}
                  </p>
                </div>
              )}
              {listing.size_sqm && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{t('listing.size')}</p>
                  <p className="font-medium text-gray-900">
                    {listing.size_sqm} {t('listing.sqm')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Amenities */}
          {listing.amenities?.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                {t('listing.amenities')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {listing.amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="bg-green-50 text-green-700 text-sm px-3 py-1.5 rounded-full"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Payment Terms */}
          {listing.payment_terms && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Payment Terms
              </h2>
              <p className="text-gray-700">{listing.payment_terms}</p>
            </div>
          )}

          {/* Map */}
          {listing.latitude && listing.longitude && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                {t('listing.location')}
              </h2>
              <Suspense
                fallback={
                  <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center">
                    <div className="w-6 h-6 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                <div style={{ height: '300px' }} className="rounded-xl overflow-hidden border border-gray-200">
                  <MapView
                    listings={[listing]}
                    center={[listing.latitude, listing.longitude]}
                    zoom={16}
                  />
                </div>
              </Suspense>
            </div>
          )}
        </div>

        {/* Right sidebar: Price + Agent + Contact */}
        <div className="space-y-4">
          {/* Price card (desktop) */}
          <div className="hidden lg:block bg-white rounded-xl border border-gray-200 p-6 sticky top-20">
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[listing.status]}`}
              >
                {listing.status?.replace('_', ' ')}
              </span>
              <span className="text-xs text-gray-500 capitalize">
                {listing.property_type} &middot;{' '}
                {listing.transaction_type === 'sale'
                  ? t('home.forSale')
                  : t('home.forRent')}
              </span>
            </div>

            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {listing.title}
            </h1>

            <p className="text-2xl font-bold text-green-600 mb-1">
              {listing.price?.toLocaleString()} FCFA
              {listing.transaction_type === 'rent' &&
                pricePeriod[listing.price_period]}
            </p>

            <p className="text-sm text-gray-500 mb-6">{listing.location}</p>

            {/* Agent info */}
            {listing.owner && (
              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="font-bold text-green-600">
                      {listing.owner.full_name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {listing.owner.full_name}
                    </p>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 capitalize">
                        {listing.owner.role}
                      </span>
                      {listing.owner.verification_status === 'approved' && (
                        <span className="text-xs text-green-600">
                          &bull; Verified
                        </span>
                      )}
                    </div>
                    {agentRating && (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={`text-xs ${star <= Math.round(agentRating) ? 'text-yellow-400' : 'text-gray-300'}`}
                            >
                              &#9733;
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500">
                          {agentRating} ({agentReviewCount})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Contact button */}
            <button
              onClick={() => {
                if (!user) {
                  navigate('/login')
                  return
                }
                // Will navigate to messages in Feature 8
                navigate(`/messages?listing=${listing.id}&seller=${listing.owner_id}`)
              }}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              {t('listing.contactAgent')}
            </button>

            {/* Initiate Payment */}
            {user && listing.owner_id !== user.id && listing.status === 'available' && (
              <>
                <button
                  onClick={() => setShowPayment(!showPayment)}
                  className="w-full mt-3 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {t('escrow.initiatePayment')}
                </button>

                {showPayment && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-xs text-blue-700 mb-3">
                      {t('escrow.paymentProtected')}
                    </p>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('escrow.amount')} (FCFA)
                    </label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={listing.price?.toString()}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={async () => {
                        const amount = parseInt(paymentAmount) || listing.price
                        if (!amount || amount <= 0) return
                        setPaymentLoading(true)
                        try {
                          const { data: { session } } = await supabase.auth.getSession()
                          const res = await fetch(`${API}/api/escrow/initiate`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${session?.access_token}`,
                            },
                            body: JSON.stringify({ listing_id: listing.id, amount }),
                          })
                          const data = await res.json()
                          if (res.ok && data.payment_url) {
                            window.location.href = data.payment_url
                          } else if (res.ok) {
                            navigate(`/dashboard/escrow?escrow=${data.escrow_id}`)
                          } else {
                            alert(data.error || 'Payment initiation failed')
                          }
                        } catch {
                          alert('Payment initiation failed')
                        } finally {
                          setPaymentLoading(false)
                        }
                      }}
                      disabled={paymentLoading}
                      className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {paymentLoading ? t('common.loading') : t('escrow.payNow')}
                    </button>
                  </div>
                )}
              </>
            )}

            <p className="text-xs text-gray-400 text-center mt-2">
              Phone numbers are hidden until a deal is initiated
            </p>
          </div>

          {/* Mobile contact bar */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
            <div className="flex items-center gap-4 max-w-7xl mx-auto">
              <div className="flex-1">
                <p className="text-lg font-bold text-green-600">
                  {listing.price?.toLocaleString()} FCFA
                  {listing.transaction_type === 'rent' &&
                    pricePeriod[listing.price_period]}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!user) {
                    navigate('/login')
                    return
                  }
                  navigate(`/messages?listing=${listing.id}&seller=${listing.owner_id}`)
                }}
                className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                {t('listing.contactAgent')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom padding for mobile fixed bar */}
      <div className="h-20 lg:hidden" />
    </div>
  )
}
