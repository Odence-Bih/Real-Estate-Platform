import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const PLACEHOLDER_IMG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2UyZThmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk0YTNiOCI+Tm8gUGhvdG88L3RleHQ+PC9zdmc+'

export default function ListingCard({ listing, view = 'grid' }) {
  const { t } = useTranslation()

  const coverImage =
    listing.images?.sort((a, b) => a.display_order - b.display_order)[0]
      ?.image_url || PLACEHOLDER_IMG

  const statusColors = {
    available: 'bg-green-100 text-green-700',
    under_offer: 'bg-yellow-100 text-yellow-700',
    rented: 'bg-gray-100 text-gray-600',
    sold: 'bg-gray-100 text-gray-600',
  }

  const statusLabels = {
    available: t('listing.available'),
    under_offer: t('listing.underOffer'),
    rented: t('listing.rented'),
    sold: t('listing.sold'),
  }

  const pricePeriod = {
    per_month: t('listing.perMonth'),
    per_year: t('listing.perYear'),
    per_week: '/week',
    total: '',
  }

  if (view === 'list') {
    return (
      <Link
        to={`/listings/${listing.id}`}
        className="flex bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
      >
        <div className="w-48 h-36 shrink-0">
          <img
            src={coverImage}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 truncate">
              {listing.title}
            </h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColors[listing.status]}`}
            >
              {statusLabels[listing.status]}
            </span>
          </div>
          <p className="text-green-600 font-bold mt-1">
            {listing.price?.toLocaleString()} FCFA
            {listing.transaction_type === 'rent' &&
              pricePeriod[listing.price_period]}
          </p>
          <p className="text-sm text-gray-500 mt-1">{listing.location}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {listing.bedrooms != null && (
              <span>{listing.bedrooms} bed</span>
            )}
            {listing.bathrooms != null && (
              <span>{listing.bathrooms} bath</span>
            )}
            {listing.size_sqm && (
              <span>{listing.size_sqm} m²</span>
            )}
            <span className="capitalize">{listing.property_type}</span>
          </div>
        </div>
      </Link>
    )
  }

  // Grid view (default)
  return (
    <Link
      to={`/listings/${listing.id}`}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="relative h-48">
        <img
          src={coverImage}
          alt={listing.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <span
          className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[listing.status]}`}
        >
          {statusLabels[listing.status]}
        </span>
        <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-black/60 text-white capitalize">
          {listing.transaction_type === 'sale'
            ? t('home.forSale')
            : t('home.forRent')}
        </span>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 truncate">
          {listing.title}
        </h3>
        <p className="text-green-600 font-bold text-lg mt-1">
          {listing.price?.toLocaleString()} FCFA
          {listing.transaction_type === 'rent' &&
            pricePeriod[listing.price_period]}
        </p>
        <p className="text-sm text-gray-500 mt-1">{listing.location}</p>
        <div className="flex items-center gap-3 mt-auto pt-3 text-xs text-gray-500 border-t border-gray-100">
          {listing.bedrooms != null && (
            <span>{listing.bedrooms} bed</span>
          )}
          {listing.bathrooms != null && (
            <span>{listing.bathrooms} bath</span>
          )}
          {listing.size_sqm && (
            <span>{listing.size_sqm} m²</span>
          )}
          <span className="capitalize ml-auto">{listing.property_type}</span>
        </div>
      </div>
    </Link>
  )
}
