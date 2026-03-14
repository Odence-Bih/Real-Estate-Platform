import { useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { uploadFile } from '../lib/storage'

const LocationPicker = lazy(() => import('../components/LocationPicker'))

const NEIGHBORHOODS = [
  'Bota', 'Down Beach', 'GRA', 'Mabeta', 'Mile One', 'Mile Two',
  'Mile Four', 'Church Street', 'Limbe Town', 'Batoke', 'Idenau',
  'Bimbia', 'Moliwe', 'Other',
]

const AMENITIES_LIST = [
  'Water Supply', 'Electricity', 'Fenced Compound', 'Parking',
  'Borehole', 'Generator', 'Security Guard', 'Tiled Floors',
  'Modern Kitchen', 'Balcony', 'Garden', 'Internet/WiFi',
]

const PROPERTY_TYPES = [
  { value: 'land', label: 'Land' },
  { value: 'house', label: 'House / Villa' },
  { value: 'apartment', label: 'Apartment / Flat' },
  { value: 'room', label: 'Room' },
]

export default function CreateListing() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [step, setStep] = useState(1) // 1: basics, 2: details, 3: photos, 4: review
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    property_type: '',
    transaction_type: '',
    price: '',
    price_period: 'per_month',
    location: '',
    neighborhood: '',
    size_sqm: '',
    bedrooms: '',
    bathrooms: '',
    amenities: [],
    payment_terms: '',
    latitude: null,
    longitude: null,
  })

  const [photos, setPhotos] = useState([]) // { file, preview }
  const [videos, setVideos] = useState([]) // { file, name }
  const [uploadProgress, setUploadProgress] = useState(0)

  // Guard: must be verified
  if (
    profile &&
    profile.role !== 'admin' &&
    (profile.role === 'buyer' || profile.verification_status !== 'approved')
  ) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Cannot Create Listing
        </h1>
        <p className="text-gray-600 mb-6">
          {profile.role === 'buyer'
            ? 'Buyers cannot create listings. Switch to a vendor/agent/landlord account.'
            : 'Your account must be verified before you can post listings.'}
        </p>
        <button
          onClick={() => navigate(profile.role === 'buyer' ? '/dashboard' : '/verify')}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
        >
          {profile.role === 'buyer' ? 'Go to Dashboard' : 'Start Verification'}
        </button>
      </div>
    )
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const toggleAmenity = (amenity) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }))
  }

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files)
    const remaining = 20 - photos.length
    const toAdd = files.slice(0, remaining)

    const newPhotos = toAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))

    setPhotos((prev) => [...prev, ...newPhotos])
    e.target.value = '' // reset input
  }

  const removePhoto = (idx) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const movePhoto = (idx, direction) => {
    setPhotos((prev) => {
      const arr = [...prev]
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= arr.length) return arr
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return arr
    })
  }

  const handleVideoAdd = (e) => {
    const files = Array.from(e.target.files)
    const remaining = 2 - videos.length
    const toAdd = files.slice(0, remaining)

    // Check file sizes (max 100MB each)
    for (const file of toAdd) {
      if (file.size > 100 * 1024 * 1024) {
        setError('Each video must be under 100MB')
        return
      }
    }

    setVideos((prev) => [...prev, ...toAdd.map((file) => ({ file, name: file.name }))])
    e.target.value = ''
  }

  const removeVideo = (idx) => {
    setVideos((prev) => prev.filter((_, i) => i !== idx))
  }

  const validateStep1 = () => {
    if (!form.title.trim()) return 'Title is required'
    if (!form.property_type) return 'Select a property type'
    if (!form.transaction_type) return 'Select sale or rent'
    if (!form.price || parseInt(form.price) <= 0) return 'Enter a valid price'
    if (!form.location.trim()) return 'Location is required'
    return null
  }

  const validateStep2 = () => {
    if (!form.description.trim()) return 'Description is required'
    if (form.description.trim().length < 30)
      return 'Description must be at least 30 characters'
    return null
  }

  const validateStep3 = () => {
    if (photos.length < 2) return 'Upload at least 2 photos'
    return null
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      // 1. Upload all photos
      const uploadedImages = []
      for (let i = 0; i < photos.length; i++) {
        setUploadProgress(Math.round(((i + 1) / photos.length) * 100))
        const photo = photos[i]
        const ext = photo.file.name.split('.').pop()
        const path = `${user.id}/${Date.now()}-${i}.${ext}`
        const result = await uploadFile('property-images', path, photo.file)
        uploadedImages.push({
          image_url: result.url,
          storage_path: result.path,
          display_order: i,
        })
      }

      // 2. Create listing via Supabase directly (RLS handles auth)
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .insert({
          owner_id: user.id,
          title: form.title.trim(),
          description: form.description.trim(),
          property_type: form.property_type,
          transaction_type: form.transaction_type,
          price: parseInt(form.price),
          price_period:
            form.transaction_type === 'rent' ? form.price_period : 'total',
          location: form.location.trim(),
          neighborhood: form.neighborhood || null,
          size_sqm: form.size_sqm ? parseFloat(form.size_sqm) : null,
          bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
          bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
          amenities: form.amenities,
          payment_terms: form.payment_terms.trim() || null,
          latitude: form.latitude,
          longitude: form.longitude,
        })
        .select()
        .single()

      if (listingError) throw listingError

      // 3. Insert images
      const imageRecords = uploadedImages.map((img) => ({
        listing_id: listing.id,
        ...img,
      }))

      const { error: imgError } = await supabase
        .from('listing_images')
        .insert(imageRecords)

      if (imgError) throw imgError

      // 4. Upload videos (if any)
      if (videos.length > 0) {
        const uploadedVideos = []
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i]
          const ext = video.file.name.split('.').pop()
          const path = `${user.id}/${Date.now()}-${i}.${ext}`
          const result = await uploadFile('property-videos', path, video.file)
          uploadedVideos.push({
            listing_id: listing.id,
            video_url: result.url,
            storage_path: result.path,
            display_order: i,
          })
        }

        const { error: vidError } = await supabase
          .from('listing_videos')
          .insert(uploadedVideos)

        if (vidError) console.error('Video insert error:', vidError)
      }

      // Success — navigate to the listing
      navigate(`/listings/${listing.id}`)
    } catch (err) {
      setError(err.message || 'Failed to create listing')
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Post a New Listing
      </h1>
      <p className="text-gray-600 mb-6">
        Fill in the property details to create your listing.
      </p>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {['Basics', 'Details', 'Photos', 'Review'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (i + 1 < step) setStep(i + 1)
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step > i + 1
                  ? 'bg-green-600 text-white cursor-pointer'
                  : step === i + 1
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > i + 1 ? '✓' : i + 1}
            </button>
            <span className="text-xs text-gray-500 hidden sm:inline">
              {label}
            </span>
            {i < 3 && (
              <div
                className={`w-8 h-0.5 ${step > i + 1 ? 'bg-green-600' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Step 1: Basics */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g., 3-Bedroom House in Bota"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Type *
              </label>
              <select
                name="property_type"
                value={form.property_type}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="">Select type</option>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transaction Type *
              </label>
              <select
                name="transaction_type"
                value={form.transaction_type}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="">Select</option>
                <option value="sale">{t('home.forSale')}</option>
                <option value="rent">{t('home.forRent')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (FCFA) *
              </label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                min="0"
                placeholder="e.g., 50000"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            {form.transaction_type === 'rent' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price Period
                </label>
                <select
                  name="price_period"
                  value={form.price_period}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                >
                  <option value="per_month">Per Month</option>
                  <option value="per_year">Per Year</option>
                  <option value="per_week">Per Week</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location / Area *
              </label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g., Bota, Limbe"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Neighborhood
              </label>
              <select
                name="neighborhood"
                value={form.neighborhood}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="">Select neighborhood</option>
                {NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Map Location Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pin Location on Map (optional)
            </label>
            <Suspense
              fallback={
                <div className="h-62.5 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="w-6 h-6 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onLocationSelect={(pos) =>
                  setForm((prev) => ({ ...prev, latitude: pos.lat, longitude: pos.lng }))
                }
              />
            </Suspense>
          </div>

          <button
            onClick={() => {
              const err = validateStep1()
              if (err) return setError(err)
              setError('')
              setStep(2)
            }}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            {t('common.next')}
          </button>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={5}
              placeholder="Describe the property in detail — condition, surroundings, unique features..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              {form.description.length} / 30 min characters
            </p>
          </div>

          {form.property_type !== 'land' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bedrooms
                </label>
                <input
                  type="number"
                  name="bedrooms"
                  value={form.bedrooms}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bathrooms
                </label>
                <input
                  type="number"
                  name="bathrooms"
                  value={form.bathrooms}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Size (m²)
                </label>
                <input
                  type="number"
                  name="size_sqm"
                  value={form.size_sqm}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>
            </div>
          )}

          {form.property_type === 'land' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size (m² or number of plots)
              </label>
              <input
                type="number"
                name="size_sqm"
                value={form.size_sqm}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amenities
            </label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES_LIST.map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    form.amenities.includes(amenity)
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>

          {form.transaction_type === 'sale' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Terms
              </label>
              <textarea
                name="payment_terms"
                value={form.payment_terms}
                onChange={handleChange}
                rows={2}
                placeholder="e.g., Full payment upfront, or 50% deposit + balance on title transfer"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.back')}
            </button>
            <button
              onClick={() => {
                const err = validateStep2()
                if (err) return setError(err)
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

      {/* Step 3: Photos */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Photos * (min 2, max 20)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              First photo will be the cover image. Drag to reorder is not
              supported yet — use arrows to reorder.
            </p>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handlePhotoAdd}
              disabled={photos.length >= 20}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50"
            />
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-lg overflow-hidden border border-gray-200"
                >
                  <img
                    src={photo.preview}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-28 object-cover"
                  />
                  {idx === 0 && (
                    <span className="absolute top-1 left-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded">
                      Cover
                    </span>
                  )}
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {idx > 0 && (
                      <button
                        onClick={() => movePhoto(idx, -1)}
                        className="bg-white/90 rounded p-1 text-xs hover:bg-white"
                      >
                        &larr;
                      </button>
                    )}
                    {idx < photos.length - 1 && (
                      <button
                        onClick={() => movePhoto(idx, 1)}
                        className="bg-white/90 rounded p-1 text-xs hover:bg-white"
                      >
                        &rarr;
                      </button>
                    )}
                    <button
                      onClick={() => removePhoto(idx)}
                      className="bg-red-500/90 text-white rounded p-1 text-xs hover:bg-red-600"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-sm text-gray-500">
            {photos.length} / 20 photos uploaded
          </p>

          {/* Video Upload */}
          <div className="border-t border-gray-200 pt-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Videos (optional, max 2, max 100MB each)
            </label>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={handleVideoAdd}
              disabled={videos.length >= 2}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            {videos.length > 0 && (
              <div className="mt-3 space-y-2">
                {videos.map((video, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-blue-600 shrink-0">🎬</span>
                      <span className="text-sm text-gray-700 truncate">{video.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        ({(video.file.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeVideo(idx)}
                      className="text-red-500 hover:text-red-700 text-sm ml-2 shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-500 mt-2">
              {videos.length} / 2 videos added
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.back')}
            </button>
            <button
              onClick={() => {
                const err = validateStep3()
                if (err) return setError(err)
                setError('')
                setStep(4)
              }}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Review Your Listing
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <span className="text-gray-500">Title:</span>
                <p className="font-medium text-gray-900">{form.title}</p>
              </div>
              <div>
                <span className="text-gray-500">Type:</span>
                <p className="font-medium text-gray-900 capitalize">
                  {form.property_type} — {form.transaction_type === 'sale' ? 'For Sale' : 'For Rent'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Price:</span>
                <p className="font-medium text-gray-900">
                  {parseInt(form.price).toLocaleString()} FCFA
                  {form.transaction_type === 'rent' &&
                    ` / ${form.price_period.replace('per_', '')}`}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Location:</span>
                <p className="font-medium text-gray-900">
                  {form.location}
                  {form.neighborhood && `, ${form.neighborhood}`}
                </p>
              </div>
              {form.bedrooms && (
                <div>
                  <span className="text-gray-500">Bedrooms:</span>
                  <p className="font-medium text-gray-900">{form.bedrooms}</p>
                </div>
              )}
              {form.bathrooms && (
                <div>
                  <span className="text-gray-500">Bathrooms:</span>
                  <p className="font-medium text-gray-900">{form.bathrooms}</p>
                </div>
              )}
              {form.size_sqm && (
                <div>
                  <span className="text-gray-500">Size:</span>
                  <p className="font-medium text-gray-900">{form.size_sqm} m²</p>
                </div>
              )}
              <div>
                <span className="text-gray-500">Photos:</span>
                <p className="font-medium text-gray-900">{photos.length} uploaded</p>
              </div>
            </div>

            <div className="mb-4">
              <span className="text-sm text-gray-500">Description:</span>
              <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                {form.description}
              </p>
            </div>

            {form.amenities.length > 0 && (
              <div className="mb-4">
                <span className="text-sm text-gray-500">Amenities:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {form.amenities.map((a) => (
                    <span
                      key={a}
                      className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {form.payment_terms && (
              <div>
                <span className="text-sm text-gray-500">Payment Terms:</span>
                <p className="text-sm text-gray-900 mt-1">
                  {form.payment_terms}
                </p>
              </div>
            )}
          </div>

          {/* Photo preview strip */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((photo, idx) => (
              <img
                key={idx}
                src={photo.preview}
                alt={`Photo ${idx + 1}`}
                className="h-20 w-20 object-cover rounded-lg border border-gray-200 shrink-0"
              />
            ))}
          </div>

          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 mb-2">
                Uploading photos... {uploadProgress}%
              </p>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              disabled={loading}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {t('common.back')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Publishing...' : 'Publish Listing'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
