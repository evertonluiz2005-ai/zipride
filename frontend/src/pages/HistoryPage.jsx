import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';

function formatDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
function formatDuration(start, end) {
  if (!end) return '⏳ Em andamento';
  const mins = Math.floor((new Date(end) - new Date(start)) / 60000);
  const secs = Math.floor(((new Date(end) - new Date(start)) % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

// Badge de status de pagamento
function PaymentBadge({ status, rideId, onRetry }) {
  const map = {
    paid:    { label: '✅ Pago',     style: { background: 'rgba(16,185,129,0.15)', color: '#10B981' } },
    pending: { label: '⏳ Pendente', style: { background: 'rgba(245,158,11,0.15)',  color: '#F59E0B' } },
    failed:  { label: '❌ Falhou',   style: { background: 'rgba(239,68,68,0.15)',   color: '#EF4444' } },
    free:    { label: '🎁 Grátis',   style: { background: 'rgba(99,102,241,0.15)',  color: '#818CF8' } },
  };
  const info = map[status];
  if (!info) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <span className="ride-badge" style={{ ...info.style, fontSize: 11 }}>{info.label}</span>
      {(status === 'failed' || status === 'pending') && (
        <button
          onClick={() => onRetry(rideId)}
          style={{
            background: 'none', border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 6, color: '#818CF8', fontSize: 11,
            padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          🔄 Pagar agora
        </button>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [rides,    setRides]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState('');
  const { user, logout }        = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const justCompleted = location.state?.justCompleted;

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  useEffect(() => {
    api.getMyRides().then(setRides).finally(() => setLoading(false));
  }, []);

  async function handleRetry(rideId) {
    try {
      showToast('⏳ Processando pagamento...');
      const result = await api.retryPayment(rideId);
      if (result.status === 'paid') {
        showToast('✅ Pagamento aprovado!');
        setRides(prev => prev.map(r => r.id === rideId ? { ...r, paymentStatus: 'paid' } : r));
      } else if (result.status === 'pending') {
        showToast('💳 Adicione um cartão primeiro');
        navigate('/payment');
      } else {
        showToast(`❌ ${result.message}`);
      }
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  }

  const completedRides = rides.filter(r => r.status === 'completed');
  const totalCost      = completedRides.reduce((s, r) => s + (r.cost || 0), 0);
  const paidTotal      = completedRides
    .filter(r => r.paymentStatus === 'paid')
    .reduce((s, r) => s + (r.cost || 0), 0);

  return (
    <div className="screen">
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div className="profile-header">
        <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
        <div>
          <h3>{user?.name}</h3>
          <p>{user?.email}</p>
        </div>
        <button className="btn-icon" onClick={logout}>🚪</button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-card-val">{rides.length}</span>
          <span className="stat-card-lbl">Corridas</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-val">R$ {totalCost.toFixed(2)}</span>
          <span className="stat-card-lbl">Total</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-val" style={{ color: '#10B981' }}>
            R$ {paidTotal.toFixed(2)}
          </span>
          <span className="stat-card-lbl">Pago</span>
        </div>
      </div>

      {/* Atalho para cartão */}
      <div
        className="payment-quick-banner"
        onClick={() => navigate('/payment')}
      >
        <span>💳</span>
        <span>Gerenciar cartão de pagamento</span>
        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>›</span>
      </div>

      <div className="section-title">Histórico de corridas</div>

      {loading && <div className="center-msg"><div className="spinner" /></div>}

      {!loading && rides.length === 0 && (
        <div className="empty-state">
          <span>🛴</span>
          <p>Nenhuma corrida ainda.</p>
          <p style={{ fontSize: 13, opacity: 0.5 }}>Desbloqueie um patinete no mapa!</p>
        </div>
      )}

      <div className="ride-list">
        {rides.map((ride) => (
          <div key={ride.id} className={`ride-card ${ride.status}`}>
            <div className="ride-card-top">
              <span className="ride-card-scooter">{ride.scooterName || ride.scooterId}</span>
              <span className={`ride-badge ${ride.status}`}>
                {ride.status === 'active' ? '🟢 Ativa' : '✅ Finalizada'}
              </span>
            </div>
            <div className="ride-card-date">{formatDate(ride.startTime)}</div>
            <div className="ride-card-stats">
              <span>⏱ {formatDuration(ride.startTime, ride.endTime)}</span>
              {ride.cost != null && <span>💰 R$ {ride.cost.toFixed(2)}</span>}
            </div>
            {ride.status === 'completed' && (
              <PaymentBadge
                status={ride.paymentStatus}
                rideId={ride.id}
                onRetry={handleRetry}
              />
            )}
          </div>
        ))}
      </div>

      <BottomNav active="history" />
    </div>
  );
}
