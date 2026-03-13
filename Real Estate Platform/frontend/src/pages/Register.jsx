import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../stores/authStore'

export default function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signUp = useAuthStore((s) => s.signUp)

  const [step, setStep] = useState(1) // Step 1: role, Step 2: details
  const [form, setForm] = useState({
    role: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const roles = [
    { value: 'buyer', label: t('auth.roleBuyer'), icon: '🏠' },
    { value: 'vendor', label: t('auth.roleVendor'), icon: '🏷️' },
    { value: 'agent', label: t('auth.roleAgent'), icon: '🤝' },
    { value: 'landlord', label: t('auth.roleLandlord'), icon: '🔑' },
  ]

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleRoleSelect = (role) => {
    setForm({ ...form, role })
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const result = await signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        role: form.role,
      })
      // If email confirmation is enabled, session will be null
      if (result?.session) {
        navigate('/dashboard')
      } else {
        // Show confirmation message
        setStep(3)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
          {t('auth.registerTitle')}
        </h1>

        {/* Step 3: Email Confirmation */}
        {step === 3 && (
          <div className="text-center bg-white border border-gray-200 rounded-xl p-8">
            <div className="text-4xl mb-4">📧</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Check Your Email
            </h2>
            <p className="text-gray-600 mb-6">
              We sent a confirmation link to <strong>{form.email}</strong>.
              Click the link to activate your account, then log in.
            </p>
            <Link
              to="/login"
              className="inline-block bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Go to {t('common.login')}
            </Link>
          </div>
        )}

        {/* Step 1: Role Selection */}
        {step === 1 && (
          <div>
            <p className="text-center text-gray-600 mb-6">
              {t('auth.selectRole')}
            </p>
            <div className="space-y-3">
              {roles.map((role) => (
                <button
                  key={role.value}
                  onClick={() => handleRoleSelect(role.value)}
                  className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-colors text-left"
                >
                  <span className="text-2xl">{role.icon}</span>
                  <span className="font-medium text-gray-900">{role.label}</span>
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 mt-6">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="text-green-600 hover:underline">
                {t('common.login')}
              </Link>
            </p>
          </div>
        )}

        {/* Step 2: Registration Form */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              &larr; {t('common.back')}
            </button>

            {/* Selected role badge */}
            <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-lg text-center">
              {roles.find((r) => r.value === form.role)?.icon}{' '}
              {roles.find((r) => r.value === form.role)?.label}
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.fullName')}
              </label>
              <input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.email')}
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.phone')}
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+237..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.password')}
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.confirmPassword')}
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            {/* Info for vendor/agent/landlord */}
            {form.role !== 'buyer' && (
              <div className="bg-yellow-50 text-yellow-700 text-sm px-4 py-3 rounded-lg">
                As a {form.role}, you'll need to complete verification (ID upload + 2,000 FCFA fee) before posting listings.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('common.register')}
            </button>

            <p className="text-center text-sm text-gray-500">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="text-green-600 hover:underline">
                {t('common.login')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
