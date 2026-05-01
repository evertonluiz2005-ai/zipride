import { useState, useEffect } from 'react';
import api from '../api';

function KpiCard({ label, value, sub, color = '#6EE7B7', icon }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: `${color}20`, color }}>{icon}</div>
      <div className="kpi-body">
        <span className="kpi-value" style={{ color }}>{value}</span>
        <span className="kpi-label">{label}</span>
        {sub && <span className="kpi-sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try { setData(await api.getDashboard()); }
    finally { setRefreshing(false); }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  if (!data) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <button className="btn-refresh" onClick={load} disabled={refreshing}>
          {refreshing ? '⟳' : '↻'} Atualizar
        </button>
      </div>

      <div className="kpi-grid">
        <KpiCard icon="🛴" label="Patinetes" value={data.scooters.total} sub={`${data.scooters.available} disponíveis`} color="#6EE7B7" />
        <KpiCard icon="🔴" label="Em uso agora" value={data.scooters.inUse} color="#F59E0B" />
        <KpiCard icon="📴" label="Offline" value={data.scooters.offline} color="#EF4444" />
        <KpiCard icon="💰" label="Receita total" value={`R$ ${data.revenue.total.toFixed(2)}`} sub={`Hoje: R$ ${data.revenue.today.toFixed(2)}`} color="#818CF8" />
        <KpiCard icon="📊" label="Corridas total" value={data.rides.total} sub={`${data.rides.active} ativas`} color="#6366F1" />
        <KpiCard icon="🔋" label="Bateria média" value={`${data.fleet.avgBattery}%`} color="#10B981" />
        <KpiCard icon="👥" label="Usuários" value={data.users.total} color="#F472B6" />
        <KpiCard icon="🅿️" label="Hubs" value={data.hubs.total} color="#38BDF8" />
      </div>

      <div className="section-title">Status da Frota</div>
      <div className="status-bars">
        {[
          { label: 'Disponíveis', val: data.scooters.available, total: data.scooters.total, color: '#10B981' },
          { label: 'Em uso', val: data.scooters.inUse, total: data.scooters.total, color: '#F59E0B' },
          { label: 'Offline', val: data.scooters.offline, total: data.scooters.total, color: '#EF4444' },
        ].map(({ label, val, total, color }) => (
          <div key={label} className="status-bar-row">
            <span className="status-bar-label">{label}</span>
            <div className="status-bar-track">
              <div style={{ width: `${total > 0 ? (val / total) * 100 : 0}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.5s' }} />
            </div>
            <span className="status-bar-val" style={{ color }}>{val}/{total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
