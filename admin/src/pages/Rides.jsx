import { useState, useEffect } from 'react';
import api from '../api';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
function getToken() { return localStorage.getItem('admin_token'); }

async function fetchRidePhoto(filename) {
  const name = filename.split('/').pop();
  const res  = await fetch(`${BASE}/admin/ride-photo/${name}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}

function RidePhotoModal({ url, onClose }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    fetchRidePhoto(url).then(u => { objectUrl = u; setSrc(u); });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Foto de devolução</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>
        {src
          ? <img src={src} alt="Devolução" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />
          : <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 13 }}>Carregando...</div>
        }
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function formatDuration(start, end) {
  if (!end) return '⏳ Em andamento';
  const mins = Math.floor((new Date(end) - new Date(start)) / 60000);
  const secs = Math.floor(((new Date(end) - new Date(start)) % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export default function Rides() {
  const [rides,      setRides]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('all');
  const [photoModal, setPhotoModal] = useState(null);

  useEffect(() => {
    api.getRides().then(setRides).finally(() => setLoading(false));
    const id = setInterval(() => api.getRides().then(setRides), 8000);
    return () => clearInterval(id);
  }, []);

  const filtered = filter === 'all' ? rides : rides.filter(r => r.status === filter);
  const total = rides.filter(r => r.status === 'completed').reduce((s, r) => s + (r.cost || 0), 0);

  return (
    <div className="page">
      {photoModal && <RidePhotoModal url={photoModal} onClose={() => setPhotoModal(null)} />}

      <div className="page-header">
        <h1>Corridas <span className="badge">{rides.length} total</span></h1>
        <span className="revenue-total">💰 R$ {total.toFixed(2)}</span>
      </div>

      <div className="filter-tabs">
        {[['all', 'Todas'], ['active', '🟢 Ativas'], ['completed', '✅ Concluídas']].map(([v, l]) => (
          <button key={v} className={`filter-tab ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuário</th>
                <th>Patinete</th>
                <th>Início</th>
                <th>Duração</th>
                <th>Custo</th>
                <th>Status</th>
                <th>Foto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{r.id.slice(0, 8)}...</td>
                  <td style={{ fontSize: 13 }}>{r.userName}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.scooterId}</td>
                  <td style={{ fontSize: 12 }}>{formatDate(r.startTime)}</td>
                  <td style={{ fontSize: 12 }}>{formatDuration(r.startTime, r.endTime)}</td>
                  <td className="mono" style={{ color: r.cost ? 'var(--accent)' : 'var(--muted)' }}>
                    {r.cost ? `R$ ${r.cost.toFixed(2)}` : '—'}
                  </td>
                  <td>
                    <span className="status-chip" style={{
                      background: r.status === 'active' ? 'rgba(22,163,74,0.1)' : 'rgba(255,82,0,0.08)',
                      color: r.status === 'active' ? '#16A34A' : 'var(--accent)',
                    }}>
                      {r.status === 'active' ? '● Ativa' : '✓ Concluída'}
                    </span>
                  </td>
                  <td>
                    {r.returnPhotoUrl ? (
                      <button
                        className="btn-refresh"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => setPhotoModal(r.returnPhotoUrl)}
                      >
                        📷 Ver
                      </button>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              Nenhuma corrida encontrada
            </div>
          )}
        </div>
      )}
    </div>
  );
}
