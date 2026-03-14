import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import useAuthStore from '../stores/authStore'

export default function Dashboard() {
  const { t } = useTranslation()
  const { profile } = useAuthStore()

  const roleBadgeColor = {
    buyer: 'bg-blue-100 text-blue-700',
    vendor: 'bg-purple-100 text-purple-700',
    agent: 'bg-orange-100 text-orange-700',
    landlord: 'bg-teal-100 text-teal-700',
    admin: 'bg-red-100 text-red-700',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-green-600">
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {profile?.full_name || 'User'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  roleBadgeColor[profile?.role] || 'bg-gray-100 text-gray-700'
                }`}
              >
                {profile?.role?.charAt(0).toUpperCase() + profile?.role?.slice(1)}
              </span>
              {profile?.verification_status === 'approved' && (
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                  Verified
                </span>
              )}
              {profile?.verification_status === 'pending' && (
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                  Pending Verification
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">{t('auth.email')}</p>
            <p className="font-medium text-gray-900">{profile?.email}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">{t('auth.phone')}</p>
            <p className="font-medium text-gray-900">
              {profile?.phone || 'Not set'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Member since</p>
            <p className="font-medium text-gray-900">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString()
                : '-'}
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/dashboard/escrow"
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors"
          >
            <p className="font-medium text-blue-800">{t('escrow.title')}</p>
            <p className="text-sm text-blue-600 mt-1">View your escrow transactions</p>
          </Link>
          {profile?.role !== 'buyer' && (
            <Link
              to="/dashboard/payouts"
              className="bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors"
            >
              <p className="font-medium text-green-800">Earnings & Payouts</p>
              <p className="text-sm text-green-600 mt-1">Track your sales earnings</p>
            </Link>
          )}
          <Link
            to="/messages"
            className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors"
          >
            <p className="font-medium text-gray-800">{t('common.messages')}</p>
            <p className="text-sm text-gray-600 mt-1">View your conversations</p>
          </Link>
        </div>

        {/* Verification prompt for vendor/agent/landlord */}
        {profile?.role !== 'buyer' &&
          profile?.role !== 'admin' &&
          profile?.verification_status !== 'approved' && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-800 mb-1">
                Verification Required
              </h3>
              <p className="text-sm text-yellow-700">
                You need to verify your identity before you can post listings.
                Upload your national ID and selfie, and pay the 2,000 FCFA
                registration fee.
              </p>
              <Link
                to="/verify"
                className="inline-block mt-3 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-700 transition-colors"
              >
                Start Verification
              </Link>
            </div>
          )}
      </div>
    </div>
  )
}
