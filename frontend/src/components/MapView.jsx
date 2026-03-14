import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon issue with bundlers
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

L.Marker.prototype.options.icon = defaultIcon

// Limbe center coordinates
const LIMBE_CENTER = [4.0226, 9.2149]

export default function MapView({ listings = [], center, zoom = 13, className = '', onMarkerClick }) {
  const mapCenter = center || LIMBE_CENTER

  return (
    <MapContainer
      center={mapCenter}
      zoom={zoom}
      className={`w-full h-full rounded-xl ${className}`}
      style={{ minHeight: '300px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {listings.map((listing) => {
        if (!listing.latitude || !listing.longitude) return null
        const firstImage = listing.images?.sort((a, b) => a.display_order - b.display_order)?.[0]
        return (
          <Marker
            key={listing.id}
            position={[listing.latitude, listing.longitude]}
            eventHandlers={{
              click: () => onMarkerClick?.(listing),
            }}
          >
            <Popup>
              <div className="min-w-[180px]">
                {firstImage && (
                  <img
                    src={firstImage.image_url}
                    alt={listing.title}
                    className="w-full h-24 object-cover rounded mb-2"
                  />
                )}
                <p className="font-semibold text-sm text-gray-900 leading-tight">
                  {listing.title}
                </p>
                <p className="text-green-600 font-bold text-sm mt-1">
                  {listing.price?.toLocaleString()} FCFA
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {listing.neighborhood || listing.location}
                </p>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
