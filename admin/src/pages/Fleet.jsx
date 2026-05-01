import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import api from '../api';

function statusColor(s) {
  return { available: '#10B981', in_use: '#F59E0B', offline: '#EF4444', maintenance: '#6366F1' }[s] || '#888';
}

function scooterMarkerIcon(s) {
  const c = statusColor(s.status);
  return L.divIcon({
    className: '',
    html: `<div style="background:${c};border:2px solid white;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);font-size:16px;">🛴</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export default function Fleet() {
  const [scooters, setScooters] = useState([]);
  const [zones, setZones] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const socketRef = useRef(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function load() {
    const [s, z, h] = await Promise.all([api.getScooters(), api.getZones(), api.getHubs()]);
    setScooters(s); setZones(z); setHubs(h);
  }

  useEffect(() => {
    load();
    const socket = io('http://localhost:4000');
    socketRef.current = socket;
    socket.on('scooters_update', setScooters);
    return () => socket.disconnect();
  }, []);

  async function handleLock(id) {
    try { await api.lockScooter(id); showToast(`🔒 Patinete ${id} bloqueado`); }
    catch (e) { showToast(`❌ ${e.message}`); }
  }

  async function handleUnlock(id) {
    try { await api.unlockScooter(id); showToast(`🔓 Patinete ${id} desbloqueado`); }
    catch (e) { showToast(`❌ ${e.message}`); }
  }

  const CAMPO_MOURAO = [-24.0449, -52.3831];

  return (
    <div className="page">
      {toast && <div className="toast">{toast}</div>}

      <div className="page-header">
        <h1>Frota <span className="badge">{scooters.length} patinetes</span></h1>
        <button className="btn-refresh" onClick={load}>↻ Atualizar</button>
      </div>

      {/* Mapa da frota */}
      <div className="fleet-map">
        <MapContainer center={CAMPO_MOURAO} zoom={15} style={{ height: '100%' }} zoomControl>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; CARTO'
          />

          {zones.map((z) => (
            <Circle key={z.id} center={[z.center.lat, z.center.lng]} radius={z.radius}
              pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.07, weight: 2, dashArray: '5 4' }} />
          ))}

          {hubs.map((h) => (
            <Marker key={h.id} position={[h.lat, h.lng]}
              icon={L.divIcon({ className: '', html: `<div style="background:#6366F1;color:white;border:2px solid white;border-radius:8px;padding:3px 6px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🅿️ ${h.name.split(' ')[1] || 'Hub'}</div>`, iconAnchor: [0, 0] })}
            >
              <Popup>{h.name}</Popup>
            </Marker>
          ))}

          {scooters.map((s) => (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={scooterMarkerIcon(s)}
              eventHandlers={{ click: () => setSelected(s) }}>
              <Popup>
                <div style={{ minWidth: 140, fontFamily: 'Space Grotesk, sans-serif' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
                  <div style={{ fontSize: 12, marginBottom: 2 }}>🔋 {s.battery?.toFixed(0)}%</div>
                  <div style={{ fontSize: 12, marginBottom: 8, color: statusColor(s.status) }}>● {s.status}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleLock(s.id)}
                      style={{ flex: 1, background: '#EF4444', color: 'white', border: 'none', borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                      🔒 Bloquear
                    </button>
                    <button onClick={() => handleUnlock(s.id)}
                      style={{ flex: 1, background: '#10B981', color: 'white', border: 'none', borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                      🔓 Liberar
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Tabela */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Bateria</th>
              <th>Modelo</th>
              <th>Hub</th>
              <th>Corridas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {scooters.map((s) => (
              <tr key={s.id} className={selected?.id === s.id ? 'row-selected' : ''} onClick={() => setSelected(s)}>
                <td className="mono">{s.id}</td>
                <td>
                  <span className="status-chip" style={{ background: `${statusColor(s.status)}20`, color: statusColor(s.status) }}>
                    ● {s.status}
                  </span>
                </td>
                <td>
                  <div className="battery-cell">
                    <div className="bat-track">
                      <div style={{ width: `${s.battery}%`, background: s.battery > 50 ? '#10B981' : s.battery > 20 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                    <span className="mono">{s.battery?.toFixed(0)}%</span>
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>{s.model}</td>
                <td style={{ fontSize: 12 }}>{s.hubId || '—'}</td>
                <td className="mono">{s.totalRides || 0}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="action-btn lock" onClick={(e) => { e.stopPropagation(); handleLock(s.id); }}>🔒</button>
                    <button className="action-btn unlock" onClick={(e) => { e.stopPropagation(); handleUnlock(s.id); }}>🔓</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
