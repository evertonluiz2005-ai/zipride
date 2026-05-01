import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';

function formatDuration(start, end) {
  if (!end) return 'Em andamento';
  const mins = Math.floor((new Date(end) - new Date(start)) / 60000);
  const secs = Math.floor(((new Date(end) - new Date(start)) % 60000) / 1000);
  return `${mins}min ${secs}s`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoryPage() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();
  const justCompleted = location.state?.justCompleted;

  useEffect(() => {
    api.getMyRides()
      .then(setRides)
      .finally(() => setLoading(false));
  }, []);

  const totalCost = rides.filter(r => r.status === 'completed').reduce((s, r) => s + (r.cost || 0), 0);

  return (
    <div className="screen">
      {/* Header perfil */}
      <div className="profile-header">
        <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
        <div>
          <h3>{user?.name}</h3>
          <p>{user?.email}</p>
        </div>
        <button className="btn-icon" onClick={logout}>🚪</button>
      </div>

      {/* Stats do usuário */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-card-val">{rides.length}</span>
          <span className="stat-card-lbl">Corridas</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-val">R$ {totalCost.toFixed(2)}</span>
          <span className="stat-card-lbl">Total gasto</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-val">{rides.filter(r => r.status === 'completed').length}</span>
          <span className="stat-card-lbl">Completas</span>
        </div>
      </div>

      {/* Corrida recém-encerrada */}
      {justCompleted && (
        <div className="ride-completed-banner">
          <h3>🎉 Corrida finalizada!</h3>
          <p>Duração: {formatDuration(justCompleted.startTime, justCompleted.endTime)}</p>
          <p className="cost-highlight">Total: R$ {justCompleted.cost?.toFixed(2)}</p>
          {justCompleted.nearestHub && <p>📍 Hub: {justCompleted.nearestHub}</p>}
        </div>
      )}

      {/* Lista de corridas */}
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
              <span className="ride-card-scooter">{ride.scooterName}</span>
              <span className={`ride-badge ${ride.status}`}>
                {ride.status === 'active' ? '🟢 Ativa' : '✅ Finalizada'}
              </span>
            </div>
            <div className="ride-card-date">{formatDate(ride.startTime)}</div>
            <div className="ride-card-stats">
              <span>⏱ {formatDuration(ride.startTime, ride.endTime)}</span>
              {ride.cost != null && <span>💰 R$ {ride.cost.toFixed(2)}</span>}
            </div>
          </div>
        ))}
      </div>

      <BottomNav active="history" />
    </div>
  );
}
