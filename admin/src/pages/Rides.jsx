import { useState, useEffect } from 'react';
import api from '../api';

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
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.getRides().then(setRides).finally(() => setLoading(false));
    const id = setInterval(() => api.getRides().then(setRides), 8000);
    return () => clearInterval(id);
  }, []);

  const filtered = filter === 'all' ? rides : rides.filter(r => r.status === filter);
  const total = rides.filter(r => r.status === 'completed').reduce((s, r) => s + (r.cost || 0), 0);

  return (
    <div className="page">
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
                  <td className="mono" style={{ color: r.cost ? '#6EE7B7' : '#888' }}>
                    {r.cost ? `R$ ${r.cost.toFixed(2)}` : '—'}
                  </td>
                  <td>
                    <span className="status-chip" style={{
                      background: r.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                      color: r.status === 'active' ? '#10B981' : '#818CF8'
                    }}>
                      {r.status === 'active' ? '● Ativa' : '✓ Concluída'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
              Nenhuma corrida encontrada
            </div>
          )}
        </div>
      )}
    </div>
  );
}
