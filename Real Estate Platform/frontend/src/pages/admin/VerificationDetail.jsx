import { useEffect, useState } from 'react'
import useAuthStore from '../../stores/authStore'
import { supabase } from '../../lib/supabase'

export default function VerificationDetail({ verificationId, onBack }) {
  const { user } = useAuthStore()
  const [verification, setVerification] = useState(null)
  const [signedUrls, setSignedUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    async function fetchDetail() {
      const { data, error } = await supabase
        .from('vendor_verifications')
        .select(`
          *,
          user:user_profiles!user_id (
            id, email, full_name, phone, role, bio, address, created_at
          )
        `)
        .eq('id', verificationId)
        .single()

      if (!error && data) {
        setVerification(data)

        // Get signed URLs for private documents
        const [front, back, selfie] = await Promise.all([
          supabase.storage
            .from('id-documents')
            .createSignedUrl(data.id_card_front_url, 3600),
          supabase.storage
            .from('id-documents')
            .createSignedUrl(data.id_card_back_url, 3600),
          supabase.storage
            .from('selfies')
            .createSignedUrl(data.selfie_url, 3600),
        ])

        setSignedUrls({
          front: front.data?.signedUrl,
          back: back.data?.signedUrl,
          selfie: selfie.data?.signedUrl,
        })
      }
      setLoading(false)
    }
    fetchDetail()
  }, [verificationId])

  const handleApprove = async () => {
    setActionLoading(true)
    setMessage(null)

    try {
      // Update verification
      const { error: vError } = await supabase
        .from('vendor_verifications')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', verificationId)

      if (vError) throw vError

      // Update user profile
      await supabase
        .from('user_profiles')
        .update({ verification_status: 'approved' })
        .eq('id', verification.user_id)

      // Audit log
      await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'approve_verification',
        target_type: 'vendor_verification',
        target_id: verificationId,
        details: { user_id: verification.user_id },
      })

      setMessage({ type: 'success', text: 'Verification approved successfully!' })
      setVerification((prev) => ({ ...prev, status: 'approved' }))
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to approve' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setMessage({ type: 'error', text: 'Please provide a rejection reason' })
      return
    }

    setActionLoading(true)
    setMessage(null)

    try {
      const { error: vError } = await supabase
        .from('vendor_verifications')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', verificationId)

      if (vError) throw vError

      await supabase
        .from('user_profiles')
        .update({ verification_status: 'rejected' })
        .eq('id', verification.user_id)

      await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'reject_verification',
        target_type: 'vendor_verification',
        target_id: verificationId,
        details: { user_id: verification.user_id, reason: rejectionReason },
      })

      setMessage({ type: 'success', text: 'Verification rejected.' })
      setVerification((prev) => ({ ...prev, status: 'rejected' }))
      setShowRejectForm(false)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to reject' })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!verification) {
    return <div className="text-center py-12 text-gray-500">Verification not found</div>
  }

  const isPending = verification.status === 'pending'

  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        &larr; Back to queue
      </button>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Applicant Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Applicant Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Full Name:</span>
            <p className="font-medium text-gray-900">{verification.user?.full_name}</p>
          </div>
          <div>
            <span className="text-gray-500">Email:</span>
            <p className="font-medium text-gray-900">{verification.user?.email}</p>
          </div>
          <div>
            <span className="text-gray-500">Phone:</span>
            <p className="font-medium text-gray-900">{verification.user?.phone || 'Not provided'}</p>
          </div>
          <div>
            <span className="text-gray-500">Role:</span>
            <p className="font-medium text-gray-900 capitalize">{verification.user?.role}</p>
          </div>
          <div>
            <span className="text-gray-500">Registered:</span>
            <p className="font-medium text-gray-900">
              {new Date(verification.user?.created_at).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Submitted:</span>
            <p className="font-medium text-gray-900">
              {new Date(verification.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Documents — Side by Side */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">ID Card — Front</p>
            {signedUrls.front ? (
              <img
                src={signedUrls.front}
                alt="ID Front"
                className="w-full h-48 object-contain bg-gray-50 rounded-lg border cursor-pointer"
                onClick={() => window.open(signedUrls.front, '_blank')}
              />
            ) : (
              <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                Unable to load
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">ID Card — Back</p>
            {signedUrls.back ? (
              <img
                src={signedUrls.back}
                alt="ID Back"
                className="w-full h-48 object-contain bg-gray-50 rounded-lg border cursor-pointer"
                onClick={() => window.open(signedUrls.back, '_blank')}
              />
            ) : (
              <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                Unable to load
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Selfie Photo</p>
            {signedUrls.selfie ? (
              <img
                src={signedUrls.selfie}
                alt="Selfie"
                className="w-full h-48 object-contain bg-gray-50 rounded-lg border cursor-pointer"
                onClick={() => window.open(signedUrls.selfie, '_blank')}
              />
            ) : (
              <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                Unable to load
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {isPending && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Action</h3>

          {showRejectForm ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Rejection Reason
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="e.g., ID photo is blurry, please resubmit a clearer image"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Approving...' : 'Approve'}
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                className="bg-red-50 text-red-600 px-5 py-2.5 rounded-lg font-medium hover:bg-red-100 transition-colors"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* Already processed */}
      {!isPending && (
        <div
          className={`rounded-xl border p-6 ${
            verification.status === 'approved'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <p className="font-medium">
            Status: <span className="capitalize">{verification.status}</span>
          </p>
          {verification.rejection_reason && (
            <p className="text-sm mt-1">Reason: {verification.rejection_reason}</p>
          )}
          {verification.reviewed_at && (
            <p className="text-sm mt-1 opacity-75">
              Reviewed: {new Date(verification.reviewed_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
