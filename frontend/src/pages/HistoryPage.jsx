import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { UPLOADS_BASE } from '../api';
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
    paid:    { label: '✅ Pago',     style: { background: 'rgba(22,163,74,0.1)',   color: '#16A34A' } },
    pending: { label: '⏳ Pendente', style: { background: 'rgba(217,119,6,0.1)',   color: '#D97706' } },
    failed:  { label: '❌ Falhou',   style: { background: 'rgba(220,38,38,0.1)',   color: '#DC2626' } },
    free:    { label: '🎁 Grátis',   style: { background: 'rgba(255,82,0,0.08)',   color: '#FF5200' } },
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
            background: 'none', border: '1px solid rgba(255,82,0,0.4)',
            borderRadius: 6, color: '#FF5200', fontSize: 11,
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
  const [rides,      setRides]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState('');
  const [uploading,  setUploading]  = useState(false);
  const fileRef = useRef(null);
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const justCompleted = location.state?.justCompleted;

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  useEffect(() => {
    api.getMyRides().then(setRides).finally(() => setLoading(false));
  }, []);

  async function handleDocUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadDocument(file);
      await refreshUser();
      showToast('Documento enviado! Aguardando análise.');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

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

      {/* Verificação de identidade */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Verificação de identidade</span>
          {user?.documentStatus === 'approved' && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', background: 'rgba(22,163,74,0.1)', padding: '2px 8px', borderRadius: 20 }}>✓ Aprovado</span>
          )}
          {user?.documentStatus === 'pending' && user?.documentImageUrl && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#D97706', background: 'rgba(217,119,6,0.1)', padding: '2px 8px', borderRadius: 20 }}>⏳ Em análise</span>
          )}
          {user?.documentStatus === 'rejected' && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', background: 'rgba(220,38,38,0.08)', padding: '2px 8px', borderRadius: 20 }}>✗ Rejeitado</span>
          )}
          {user?.documentStatus === 'pending' && !user?.documentImageUrl && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Pendente</span>
          )}
        </div>

        {user?.documentStatus === 'approved' ? (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sua identidade foi verificada com sucesso.</p>
        ) : user?.documentStatus === 'pending' && user?.documentImageUrl ? (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Documento recebido. A equipe ZipRide irá analisar em breve.</p>
        ) : (
          <>
            {user?.documentStatus === 'rejected' && user?.documentRejectedReason && (
              <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>
                Motivo: {user.documentRejectedReason}
              </p>
            )}
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
              Envie uma foto do seu RG ou CNH para ativar sua conta.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleDocUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%', padding: '10px', borderRadius: 10,
                border: '1.5px dashed var(--border)', background: 'var(--surface)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                color: uploading ? 'var(--muted)' : 'var(--accent)',
                fontFamily: 'inherit',
              }}
            >
              {uploading ? 'Enviando...' : '📷 Tirar foto ou escolher da galeria'}
            </button>
          </>
        )}
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
