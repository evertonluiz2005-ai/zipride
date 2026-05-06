import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';
import BottomNav from '../components/BottomNav';

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:4000';

function TrackScooter({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.panTo(pos, { animate: true }); }, [pos, map]);
  return null;
}

const hubIcon = L.divIcon({
  className: '',
  html: `<div style="background:#fff;border:2px solid #E5E7EB;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.12);">🅿️</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});

const riderIcon = L.divIcon({
  className: '',
  html: `<div style="background:#FF5200;border:3px solid white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(255,82,0,0.5);font-size:20px;animation:pulse 2s infinite;">🛴</div>`,
  iconSize: [40, 40], iconAnchor: [20, 20],
});

function formatTime(s) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

// ─── Modal de resumo pós-corrida ─────────────────────────────────────────────
function RideSummaryModal({ ride, payment, onClose }) {
  const navigate = useNavigate();

  const paymentIcon = {
    paid:    { icon: '✅', label: 'Pagamento aprovado', color: '#10B981' },
    pending: { icon: '⏳', label: 'Adicione um cartão para pagar', color: '#F59E0B' },
    failed:  { icon: '❌', label: 'Pagamento recusado', color: '#EF4444' },
    free:    { icon: '🎁', label: 'Corrida gratuita', color: '#6366F1' },
  }[payment?.status] || { icon: '💰', label: 'Pagamento processado', color: '#6EE7B7' };

  const mins = ride.endTime
    ? Math.floor((new Date(ride.endTime) - new Date(ride.startTime)) / 60000)
    : 0;

  return (
    <div className="modal-overlay" style={{ alignItems: 'center' }}>
      <div className="modal-card" style={{ borderRadius: 20, maxWidth: 360, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🏁</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Corrida finalizada!</h2>
          <p style={{ fontSize: 13, opacity: 0.6 }}>{ride.scooterName || ride.scooterId}</p>
        </div>

        {/* Stats */}
        <div className="ride-stats" style={{ marginBottom: 16 }}>
          <div className="stat-item">
            <span className="stat-value mono">{mins}min</span>
            <span className="stat-label">Duração</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value mono">
              R$ {ride.cost?.toFixed(2)}
            </span>
            <span className="stat-label">Total</span>
          </div>
        </div>

        {/* Status pagamento */}
        <div style={{
          background: `${paymentIcon.color}15`,
          border: `1px solid ${paymentIcon.color}40`,
          borderRadius: 12, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 20 }}>{paymentIcon.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: paymentIcon.color }}>
              {paymentIcon.label}
            </div>
            {payment?.status === 'failed' && payment.message && (
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{payment.message}</div>
            )}
          </div>
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payment?.status === 'pending' && (
            <button className="btn-primary" onClick={() => { onClose(); navigate('/payment'); }}>
              💳 Adicionar cartão
            </button>
          )}
          {payment?.status === 'failed' && (
            <button className="btn-primary" onClick={() => { onClose(); navigate('/history'); }}>
              🔄 Ver corridas e tentar novamente
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={() => { onClose(); navigate('/history'); }}
          >
            Ver histórico
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página de corrida ────────────────────────────────────────────────────────
export default function RidePage() {
  const [rideData,     setRideData]     = useState(null);
  const [elapsed,      setElapsed]      = useState(0);
  const [scooterPos,   setScooterPos]   = useState(null);
  const [ending,       setEnding]       = useState(false);
  const [toast,        setToast]        = useState('');
  const [pricing,      setPricing]      = useState({ unlockFee: 3, pricePerMin: 0.5 });
  const [summary,      setSummary]      = useState(null);
  const [checking,     setChecking]     = useState(true);
  const [zones,        setZones]        = useState([]);
  const [hubs,         setHubs]         = useState([]);
  const [photoFile,    setPhotoFile]    = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoStep,    setPhotoStep]    = useState(false);
  const photoInputRef = useRef(null);
  const timerRef  = useRef(null);
  const socketRef = useRef(null);
  const navigate  = useNavigate();

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 4000); }

  useEffect(() => {
    api.getActiveRide().then((data) => {
      if (!data) { navigate('/map'); return; }
      setRideData(data);
      setScooterPos([data.scooter.lat, data.scooter.lng]);
      setElapsed(Math.floor((Date.now() - new Date(data.ride.startTime).getTime()) / 1000));
    }).finally(() => setChecking(false));

    api.getMap().then((data) => {
      setZones(data.zones || []);
      setHubs(data.hubs || []);
    }).catch(() => {});

    api.getPricing().then(setPricing);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.on('scooters_update', (scooters) => {
      setRideData(prev => {
        if (!prev) return prev;
        const s = scooters.find(x => x.id === prev.scooter.id);
        if (s) setScooterPos([s.lat, s.lng]);
        return prev;
      });
    });

    return () => { clearInterval(timerRef.current); socket.disconnect(); };
  }, []);

  function handlePhotoCapture(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleEndRide() {
    if (!rideData) return;
    if (!photoFile) { setPhotoStep(true); return; }

    setEnding(true);
    try {
      // Upload da foto primeiro, depois encerra a corrida
      await api.uploadReturnPhoto(rideData.ride.id, photoFile);
      const result = await api.endRide(rideData.ride.id);
      clearInterval(timerRef.current);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setSummary({ ride: result.ride, payment: result.payment });
    } catch (err) {
      showToast(`❌ ${err.message}`);
      setEnding(false);
    }
  }

  const cost = `R$ ${(pricing.unlockFee + (elapsed / 60) * pricing.pricePerMin).toFixed(2)}`;

  if (checking) return <div className="full-loader"><div className="spinner" /></div>;

  return (
    <div className="screen">
      {toast && <div className="toast">{toast}</div>}

      {/* Modal de resumo */}
      {summary && (
        <RideSummaryModal
          ride={summary.ride}
          payment={summary.payment}
          onClose={() => setSummary(null)}
        />
      )}

      <div className="ride-header">
        <div className="ride-status-dot" />
        <span>Corrida em andamento</span>
        {rideData && <span className="ride-scooter-id">{rideData.scooter?.name}</span>}
      </div>

      <div className="map-wrapper" style={{ flex: 1 }}>
        {scooterPos ? (
          <MapContainer key="ride-page" center={scooterPos} zoom={17} style={{ height: '100%' }} zoomControl={false}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; CARTO"
            />
            <TrackScooter pos={scooterPos} />

            {zones.map((z) =>
              z.coordinates?.length >= 3 ? (
                <Polygon
                  key={z.id}
                  positions={z.coordinates}
                  pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.1, weight: 2, dashArray: '6 4' }}
                />
              ) : null
            )}

            {hubs.map((h) => (
              <Marker key={h.id} position={[h.lat, h.lng]} icon={hubIcon} />
            ))}

            <Marker position={scooterPos} icon={riderIcon} />
          </MapContainer>
        ) : (
          <div className="map-loading"><div className="spinner" /><p>Conectando ao patinete...</p></div>
        )}
      </div>

      <div className="ride-panel">
        <div className="ride-stats">
          <div className="stat-item">
            <span className="stat-value mono">{formatTime(elapsed)}</span>
            <span className="stat-label">Tempo</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value mono">{cost}</span>
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
          · <span style={{ color: 'var(--accent)' }}>cobrado no cartão</span>
        </div>

        {/* Etapa de foto */}
        {photoStep && (
          <div style={{ marginBottom: 12, background: 'var(--surface)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>📷 Foto do patinete</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              Tire uma foto mostrando onde você está deixando o patinete.
            </p>
            {photoPreview && (
              <img src={photoPreview} alt="Prévia" style={{ width: '100%', borderRadius: 8, marginBottom: 8, maxHeight: 180, objectFit: 'cover' }} />
            )}
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} style={{ display: 'none' }} />
            <button
              onClick={() => photoInputRef.current?.click()}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1.5px dashed var(--border)', background: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--accent)', fontFamily: 'var(--font)', marginBottom: 8 }}
            >
              {photoFile ? '🔄 Trocar foto' : '📷 Tirar foto'}
            </button>
          </div>
        )}

        <button
          className="btn-danger"
          onClick={handleEndRide}
          disabled={ending || (photoStep && !photoFile)}
        >
          {ending ? '⏳ Encerrando...' : photoStep && photoFile ? '🏁 Confirmar encerramento' : '🏁 Encerrar corrida'}
        </button>

        <p className="ride-warning">⚠️ Encerre dentro de um hub ou zona permitida</p>
      </div>

      <BottomNav active="explore" />
    </div>
  );
}
