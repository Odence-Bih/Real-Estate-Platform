import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../stores/authStore'
import NotificationBell from '../NotificationBell'

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en'
    i18n.changeLanguage(newLang)
    localStorage.setItem('limbehomes-lang', newLang)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">LH</span>
            </div>
            <span className="text-xl font-bold text-gray-900">
              {t('common.appName')}
            </span>
          </Link>

          {/* Nav Links - desktop */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className="text-gray-600 hover:text-green-600 transition-colors"
            >
              {t('common.home')}
            </Link>
            <Link
              to="/listings"
              className="text-gray-600 hover:text-green-600 transition-colors"
            >
              {t('common.listings')}
            </Link>
            {user && (
              <Link
                to="/messages"
                className="text-gray-600 hover:text-green-600 transition-colors"
              >
                {t('common.messages')}
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Post Listing button for verified users */}
            {user && profile?.verification_status === 'approved' && (
              <Link
                to="/post-listing"
                className="hidden md:inline-flex bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                + Post Listing
              </Link>
            )}

            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {i18n.language === 'en' ? 'FR' : 'EN'}
            </button>

            {user ? (
              /* Logged in */
              <div className="flex items-center gap-3">
                <NotificationBell />
                <Link
                  to="/dashboard"
                  className="hidden md:flex items-center gap-2 text-gray-700 hover:text-green-600 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-green-600">
                      {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {profile?.full_name?.split(' ')[0] || 'Account'}
                  </span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-gray-500 hover:text-red-600 text-sm transition-colors"
                >
                  {t('common.logout')}
                </button>
              </div>
            ) : (
              /* Not logged in */
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-green-600 transition-colors text-sm"
                >
                  {t('common.login')}
                </Link>
                <Link
                  to="/register"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
                >
                  {t('common.register')}
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-2">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              {t('common.home')}
            </Link>
            <Link
              to="/listings"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              {t('common.listings')}
            </Link>
            {user && (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  {t('common.dashboard')}
                </Link>
                <Link
                  to="/messages"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  {t('common.messages')}
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
