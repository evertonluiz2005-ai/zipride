import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';

// Ícones customizados
const scooterIcon = (battery) => {
  const color = battery > 50 ? '#10B981' : battery > 20 ? '#F59E0B' : '#EF4444';
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};border:2px solid white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:18px;">🛴</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const hubIcon = L.divIcon({
  className: '',
  html: `<div style="background:#6366F1;border:2px solid white;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-size:16px;">🅿️</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function FlyToUser({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, 16); }, [pos, map]);
  return null;
}

export default function MapPage() {
  const [scooters, setScooters] = useState([]);
  const [zones, setZones] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const socketRef = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  useEffect(() => {
    // Buscar mapa inicial
    api.getMap().then((data) => {
      setScooters(data.scooters);
      setZones(data.zones);
      setHubs(data.hubs);
    });

    // Checar corrida ativa
    api.getActiveRide().then((data) => {
      if (data) { setActiveRide(data); navigate('/ride'); }
    }).catch(() => {});

    // Geolocalização
    navigator.geolocation?.getCurrentPosition(
      (p) => setUserPos([p.coords.latitude, p.coords.longitude]),
      () => {}
    );

    // Socket.io
    const socket = io('http://localhost:4000');
    socketRef.current = socket;
    socket.on('scooters_update', (data) => {
      setScooters(data.filter((s) => s.status === 'available' && s.battery >= 10));
    });
    return () => socket.disconnect();
  }, []);

  async function handleUnlock(scooter) {
    setShowQR(scooter);
  }

  async function confirmUnlock(scooter) {
    setLoading(true);
    try {
      const data = await api.startRide(scooter.id);
      showToast(`🛴 Patinete desbloqueado! Boa viagem!`);
      setShowQR(null);
      setTimeout(() => navigate('/ride'), 1000);
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const CAMPO_MOURAO = [-24.0449, -52.3831];
  const zoneColors = { 'zone-centro': '#3B82F6', 'zone-unicentro': '#10B981', 'zone-shopping': '#F59E0B' };

  return (
    <div className="screen">
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div className="map-header">
        <div>
          <h2>ZipRide <span className="badge-green">{scooters.length} disponíveis</span></h2>
          <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>Campo Mourão, PR</p>
        </div>
        <button className="btn-icon" onClick={() => navigate('/history')}>📋</button>
      </div>

      {/* Mapa */}
      <div className="map-wrapper">
        <MapContainer
          center={CAMPO_MOURAO}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          {userPos && <FlyToUser pos={userPos} />}

          {/* Zonas */}
          {zones.map((zone) => (
            <Circle
              key={zone.id}
              center={[zone.center.lat, zone.center.lng]}
              radius={zone.radius}
              pathOptions={{
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: 0.08,
                weight: 2,
                dashArray: '6 4',
              }}
            />
          ))}

          {/* Hubs */}
          {hubs.map((hub) => (
            <Marker key={hub.id} position={[hub.lat, hub.lng]} icon={hubIcon}>
              <Popup className="dark-popup">
                <div className="popup-hub">
                  <strong>{hub.name}</strong>
                  <span>Capacidade: {hub.capacity}</span>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Patinetes */}
          {scooters.map((s) => (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={scooterIcon(s.battery)}
              eventHandlers={{ click: () => setSelected(s) }}
            >
              <Popup className="dark-popup">
                <div className="popup-scooter">
                  <div className="popup-title">{s.name}</div>
                  <div className="popup-battery">
                    <span>🔋</span>
                    <div className="battery-bar">
                      <div style={{ width: `${s.battery}%`, background: s.battery > 50 ? '#10B981' : s.battery > 20 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                    <span>{s.battery}%</span>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8 }}>{s.model}</div>
                  <button className="btn-primary btn-sm" onClick={() => handleUnlock(s)}>
                    📷 Desbloquear via QR
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legenda */}
      <div className="map-legend">
        {zones.map((z) => (
          <span key={z.id} className="legend-item">
            <span style={{ background: z.color, width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />
            {z.name}
          </span>
        ))}
      </div>

      {/* Modal QR */}
      {showQR && (
        <div className="modal-overlay" onClick={() => setShowQR(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Desbloquear {showQR.name}</h3>
            <div className="qr-simulation">
              <div className="qr-box">
                <div className="qr-inner">
                  {/* QR simulado visual */}
                  <div className="qr-visual">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div key={i} className="qr-cell" style={{ background: Math.random() > 0.5 ? '#fff' : 'transparent' }} />
                    ))}
                  </div>
                </div>
                <p className="qr-id">{showQR.id}</p>
              </div>
              <p style={{ fontSize: 13, opacity: 0.7, textAlign: 'center' }}>
                Aproxime o celular do QR Code no patinete para desbloquear
              </p>
              <div className="scooter-info-row">
                <span>🔋 {showQR.battery}%</span>
                <span>📍 {showQR.hubId?.replace('hub-0', 'Hub ')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={() => setShowQR(null)}>Cancelar</button>
              <button className="btn-primary" onClick={() => confirmUnlock(showQR)} disabled={loading}>
                {loading ? 'Desbloqueando...' : '✅ Confirmar desbloqueio'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="map" />
    </div>
  );
}
