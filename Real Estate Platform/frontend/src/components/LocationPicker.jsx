import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon
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

const LIMBE_CENTER = [4.0226, 9.2149]

function ClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export default function LocationPicker({ latitude, longitude, onLocationSelect }) {
  const [position, setPosition] = useState(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  )

  useEffect(() => {
    if (latitude && longitude) {
      setPosition({ lat: latitude, lng: longitude })
    }
  }, [latitude, longitude])

  const handleSelect = (pos) => {
    setPosition(pos)
    onLocationSelect(pos)
  }

  const center = position ? [position.lat, position.lng] : LIMBE_CENTER

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">
        Click on the map to set the property location
      </p>
      <MapContainer
        center={center}
        zoom={position ? 16 : 14}
        className="w-full rounded-lg border border-gray-300"
        style={{ height: '250px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onLocationSelect={handleSelect} />
        {position && <Marker position={[position.lat, position.lng]} />}
      </MapContainer>
      {position && (
        <p className="text-xs text-gray-400 mt-1">
          {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
        </p>
      )}
    </div>
  )
}
