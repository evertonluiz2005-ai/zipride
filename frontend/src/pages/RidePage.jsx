import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';
import BottomNav from '../components/BottomNav';

function TrackScooter({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.panTo(pos, { animate: true }); }, [pos, map]);
  return null;
}

const riderIcon = L.divIcon({
  className: '',
  html: `<div style="background:#6366F1;border:3px solid white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(99,102,241,0.6);font-size:20px;animation:pulse 2s infinite;">🛴</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatCost(unlockFee, pricePerMin, seconds) {
  const mins = seconds / 60;
  return (unlockFee + mins * pricePerMin).toFixed(2);
}

export default function RidePage() {
  const [rideData, setRideData] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [scooterPos, setScooterPos] = useState(null);
  const [ending, setEnding] = useState(false);
  const [toast, setToast] = useState('');
  const [pricing, setPricing] = useState({ unlockFee: 3, pricePerMin: 0.5 });
  const timerRef = useRef(null);
  const socketRef = useRef(null);
  const navigate = useNavigate();

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  useEffect(() => {
    api.getActiveRide().then((data) => {
      if (!data) { navigate('/map'); return; }
      setRideData(data);
      setScooterPos([data.scooter.lat, data.scooter.lng]);
      const startMs = new Date(data.ride.startTime).getTime();
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    });

    api.getPricing().then(setPricing);

    // Timer
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    // Socket
    const socket = io('http://localhost:4000');
    socketRef.current = socket;
    socket.on('scooters_update', (scooters) => {
      if (!rideData) return;
      const s = scooters.find((x) => x.id === rideData?.scooter?.id);
      if (s) setScooterPos([s.lat, s.lng]);
    });

    return () => {
      clearInterval(timerRef.current);
      socket.disconnect();
    };
  }, []);

  async function handleEndRide() {
    if (!rideData) return;
    setEnding(true);
    try {
      const result = await api.endRide(rideData.ride.id);
      clearInterval(timerRef.current);
      navigate('/history', { state: { justCompleted: result.ride } });
    } catch (err) {
      showToast(`❌ ${err.message}`);
      setEnding(false);
    }
  }

  const cost = rideData
    ? formatCost(pricing.unlockFee, pricing.pricePerMin, elapsed)
    : '0.00';

  return (
    <div className="screen">
      {toast && <div className="toast">{toast}</div>}

      {/* Status bar */}
      <div className="ride-header">
        <div className="ride-status-dot" />
        <span>Corrida em andamento</span>
        {rideData && <span className="ride-scooter-id">{rideData.scooter?.name}</span>}
      </div>

      {/* Mapa */}
      <div className="map-wrapper" style={{ flex: 1 }}>
        {scooterPos && (
          <MapContainer
            center={scooterPos}
            zoom={17}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; CARTO'
            />
            <TrackScooter pos={scooterPos} />
            <Marker position={scooterPos} icon={riderIcon} />
          </MapContainer>
        )}
        {!scooterPos && (
          <div className="map-loading">
            <div className="spinner" />
            <p>Conectando ao patinete...</p>
          </div>
        )}
      </div>

      {/* Painel da corrida */}
      <div className="ride-panel">
        <div className="ride-stats">
          <div className="stat-item">
            <span className="stat-value mono">{formatTime(elapsed)}</span>
            <span className="stat-label">Tempo</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value mono">R$ {cost}</span>
            <span className="stat-label">Custo atual</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value mono">{rideData?.scooter?.battery?.toFixed(0) ?? '--'}%</span>
            <span className="stat-label">Bateria</span>
          </div>
        </div>

        <div className="pricing-hint">
          R$ {pricing.unlockFee.toFixed(2)} desbloqueio + R$ {pricing.pricePerMin.toFixed(2)}/min
        </div>

        <button
          className="btn-danger"
          onClick={handleEndRide}
          disabled={ending}
        >
          {ending ? 'Encerrando...' : '🏁 Encerrar corrida'}
        </button>

        <p className="ride-warning">
          ⚠️ Encerre dentro de um hub ou zona permitida
        </p>
      </div>

      <BottomNav active="ride" />
    </div>
  );
}
