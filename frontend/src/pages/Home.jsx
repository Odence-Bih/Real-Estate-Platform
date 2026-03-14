import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export default function Home() {
  const { t } = useTranslation()

  const categories = [
    { key: 'land', icon: '🏞️', label: t('home.land') },
    { key: 'houses', icon: '🏠', label: t('home.houses') },
    { key: 'apartments', icon: '🏢', label: t('home.apartments') },
    { key: 'rooms', icon: '🛏️', label: t('home.rooms') },
  ]

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            {t('home.hero')}
          </h1>
          <p className="text-lg md:text-xl text-green-100 mb-8 max-w-2xl mx-auto">
            {t('home.subtitle')}
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto">
            <div className="flex bg-white rounded-lg overflow-hidden shadow-lg">
              <input
                type="text"
                placeholder={t('home.searchPlaceholder')}
                className="flex-1 px-4 py-3 text-gray-900 outline-none"
              />
              <button className="bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-800 transition-colors">
                {t('common.search')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {t('home.categories')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.key}
              to={`/listings?type=${cat.key}`}
              className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow border border-gray-100"
            >
              <div className="text-4xl mb-3">{cat.icon}</div>
              <h3 className="font-semibold text-gray-900">{cat.label}</h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              to="/listings?transaction=sale"
              className="bg-green-50 rounded-xl p-5 sm:p-8 hover:bg-green-100 transition-colors"
            >
              <h3 className="text-xl font-bold text-green-800 mb-2">
                {t('home.forSale')}
              </h3>
              <p className="text-green-600">
                Land, houses, and apartments for sale in Limbe
              </p>
            </Link>
            <Link
              to="/listings?transaction=rent"
              className="bg-blue-50 rounded-xl p-5 sm:p-8 hover:bg-blue-100 transition-colors"
            >
              <h3 className="text-xl font-bold text-blue-800 mb-2">
                {t('home.forRent')}
              </h3>
              <p className="text-blue-600">
                Houses, apartments, and rooms for rent in Limbe
              </p>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
