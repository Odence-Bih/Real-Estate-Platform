import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../stores/authStore'
import { uploadFile } from '../lib/storage'
import { supabase } from '../lib/supabase'

const MAX_ID_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_SELFIE_SIZE = 3 * 1024 * 1024 // 3MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']

export default function Verify() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, fetchProfile } = useAuthStore()

  const [step, setStep] = useState(1) // 1: upload docs, 2: selfie, 3: payment, 4: done
  const [files, setFiles] = useState({
    idFront: null,
    idBack: null,
    selfie: null,
  })
  const [previews, setPreviews] = useState({
    idFront: null,
    idBack: null,
    selfie: null,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [existingVerification, setExistingVerification] = useState(null)

  // Check if user already has a pending/approved verification
  useEffect(() => {
    if (!user) return
    async function checkVerification() {
      const { data } = await supabase
        .from('vendor_verifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setExistingVerification(data)
      }
    }
    checkVerification()
  }, [user])

  // Redirect buyers — they don't need verification
  if (profile?.role === 'buyer') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Verification Not Required
        </h1>
        <p className="text-gray-600 mb-6">
          Buyers and renters don't need verification. You can browse and contact
          agents directly.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  // Already verified or pending
  if (existingVerification) {
    const statusConfig = {
      pending: {
        color: 'yellow',
        title: 'Verification Pending',
        message:
          'Your documents have been submitted and are under review. We will notify you once your account is approved.',
      },
      approved: {
        color: 'green',
        title: 'Verification Approved',
        message:
          'Your account is verified! You can now create and manage listings.',
      },
      rejected: {
        color: 'red',
        title: 'Verification Rejected',
        message: existingVerification.rejection_reason
          ? `Reason: ${existingVerification.rejection_reason}. You may resubmit your documents.`
          : 'Your verification was rejected. You may resubmit your documents.',
      },
    }

    const config = statusConfig[existingVerification.status]

    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div
          className={`bg-${config.color}-50 border border-${config.color}-200 rounded-xl p-8`}
        >
          <h1 className={`text-2xl font-bold text-${config.color}-800 mb-4`}>
            {config.title}
          </h1>
          <p className={`text-${config.color}-700 mb-6`}>{config.message}</p>
          {existingVerification.status === 'rejected' && (
            <button
              onClick={() => setExistingVerification(null)}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              Resubmit Documents
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="ml-3 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const handleFileChange = (field, maxSize) => (e) => {
    const file = e.target.files[0]
    if (!file) return

    const allowedTypes =
      field === 'selfie' ? ALLOWED_IMAGE_TYPES : ALLOWED_TYPES
    if (!allowedTypes.includes(file.type)) {
      setError(
        `Invalid file type. Allowed: ${allowedTypes.map((t) => t.split('/')[1]).join(', ')}`
      )
      return
    }
    if (file.size > maxSize) {
      setError(`File too large. Maximum size: ${maxSize / 1024 / 1024}MB`)
      return
    }

    setError('')
    setFiles((prev) => ({ ...prev, [field]: file }))

    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) =>
        setPreviews((prev) => ({ ...prev, [field]: e.target.result }))
      reader.readAsDataURL(file)
    } else {
      setPreviews((prev) => ({ ...prev, [field]: 'pdf' }))
    }
  }

  const handleSubmit = async () => {
    if (!files.idFront || !files.idBack || !files.selfie) {
      setError('Please upload all required documents')
      return
    }

    setLoading(true)
    setError('')

    try {
      const timestamp = Date.now()
      const userId = user.id

      // Upload all three files in parallel
      const [idFrontResult, idBackResult, selfieResult] = await Promise.all([
        uploadFile(
          'id-documents',
          `${userId}/id-front-${timestamp}.${files.idFront.name.split('.').pop()}`,
          files.idFront
        ),
        uploadFile(
          'id-documents',
          `${userId}/id-back-${timestamp}.${files.idBack.name.split('.').pop()}`,
          files.idBack
        ),
        uploadFile(
          'selfies',
          `${userId}/selfie-${timestamp}.${files.selfie.name.split('.').pop()}`,
          files.selfie
        ),
      ])

      // Create verification record
      const { error: dbError } = await supabase
        .from('vendor_verifications')
        .insert({
          user_id: userId,
          id_card_front_url: idFrontResult.path,
          id_card_back_url: idBackResult.path,
          selfie_url: selfieResult.path,
          status: 'pending',
        })

      if (dbError) throw dbError

      // Update user profile verification status
      await supabase
        .from('user_profiles')
        .update({ verification_status: 'pending' })
        .eq('id', userId)

      // Refresh profile in store
      await fetchProfile(userId)

      setStep(4) // success
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Account Verification
      </h1>
      <p className="text-gray-600 mb-8">
        To post listings, you must verify your identity. Upload your national ID
        card and a selfie photo.
      </p>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > s ? '✓' : s}
            </div>
            {s < 3 && (
              <div
                className={`w-12 h-0.5 ${step > s ? 'bg-green-600' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
        <div className="ml-4 text-sm text-gray-500">
          {step === 1 && 'National ID Card'}
          {step === 2 && 'Selfie Photo'}
          {step === 3 && 'Review & Submit'}
          {step === 4 && 'Submitted!'}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Step 1: ID Card Upload */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-1">
              ID Card — Front
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Upload the front of your national ID card (JPEG, PNG, or PDF, max
              5MB)
            </p>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileChange('idFront', MAX_ID_SIZE)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            {previews.idFront && previews.idFront !== 'pdf' && (
              <img
                src={previews.idFront}
                alt="ID Front Preview"
                className="mt-3 max-h-48 rounded-lg border border-gray-200"
              />
            )}
            {previews.idFront === 'pdf' && (
              <div className="mt-3 bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                PDF file selected: {files.idFront?.name}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-1">
              ID Card — Back
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Upload the back of your national ID card (JPEG, PNG, or PDF, max
              5MB)
            </p>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileChange('idBack', MAX_ID_SIZE)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            {previews.idBack && previews.idBack !== 'pdf' && (
              <img
                src={previews.idBack}
                alt="ID Back Preview"
                className="mt-3 max-h-48 rounded-lg border border-gray-200"
              />
            )}
            {previews.idBack === 'pdf' && (
              <div className="mt-3 bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                PDF file selected: {files.idBack?.name}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (!files.idFront || !files.idBack) {
                setError('Please upload both front and back of your ID card')
                return
              }
              setError('')
              setStep(2)
            }}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            {t('common.next')}
          </button>
        </div>
      )}

      {/* Step 2: Selfie Upload */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Selfie Photo</h2>
            <p className="text-sm text-gray-500 mb-4">
              Upload a clear selfie photo of yourself (JPEG or PNG, max 3MB).
              This will be compared with your ID card photo.
            </p>
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={handleFileChange('selfie', MAX_SELFIE_SIZE)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            {previews.selfie && (
              <img
                src={previews.selfie}
                alt="Selfie Preview"
                className="mt-3 max-h-48 rounded-lg border border-gray-200"
              />
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.back')}
            </button>
            <button
              onClick={() => {
                if (!files.selfie) {
                  setError('Please upload a selfie photo')
                  return
                }
                setError('')
                setStep(3)
              }}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Review Your Documents
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500 mb-2">ID Front</p>
                {previews.idFront && previews.idFront !== 'pdf' ? (
                  <img
                    src={previews.idFront}
                    alt="ID Front"
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-50 rounded-lg border flex items-center justify-center text-sm text-gray-500">
                    {files.idFront?.name || 'PDF'}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">ID Back</p>
                {previews.idBack && previews.idBack !== 'pdf' ? (
                  <img
                    src={previews.idBack}
                    alt="ID Back"
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-50 rounded-lg border flex items-center justify-center text-sm text-gray-500">
                    {files.idBack?.name || 'PDF'}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">Selfie</p>
                <img
                  src={previews.selfie}
                  alt="Selfie"
                  className="w-full h-32 object-cover rounded-lg border"
                />
              </div>
            </div>

            {/* Registration fee notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-1">
                Registration Fee: 2,000 FCFA
              </h3>
              <p className="text-sm text-blue-700">
                A one-time registration fee of 2,000 FCFA is required via Mobile
                Money (MTN/Orange). Payment integration will be available in
                Phase 2. For now, your documents will be submitted for review.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.back')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('common.submit')}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Documents Submitted!
          </h2>
          <p className="text-gray-600 mb-6">
            Your verification documents have been submitted for review. We'll
            notify you once your account is approved.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      )}
    </div>
  )
}
