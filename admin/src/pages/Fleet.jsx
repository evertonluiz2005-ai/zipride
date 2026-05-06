import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import QRCode from 'react-qr-code';
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

function MapClickPicker({ onPick, active }) {
  useMapEvents({ click: (e) => { if (active) onPick(e.latlng); } });
  return null;
}

const EMPTY_FORM = {
  id: '', name: '', model: 'Segway Ninebot E2',
  lat: '', lng: '', hubId: '', deviceId: '', simNumber: '',
};

export default function Fleet() {
  const [scooters,     setScooters]     = useState([]);
  const [zones,        setZones]        = useState([]);
  const [hubs,         setHubs]         = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [qrScooter,    setQrScooter]    = useState(null);
  const [toast,        setToast]        = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [pickingPos,   setPickingPos]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const socketRef = useRef(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function load() {
    const [s, z, h] = await Promise.all([api.getScooters(), api.getZones(), api.getHubs()]);
    setScooters(s); setZones(z); setHubs(h);
  }

  useEffect(() => {
    load();
    const SOCKET_URL = (process.env.REACT_APP_API_URL || 'http://localhost:4000/api').replace('/api', '');
    const socket = io(SOCKET_URL);
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

  async function handleDelete(id) {
    if (!window.confirm(`Remover patinete ${id}?`)) return;
    try { await api.deleteScooter(id); showToast(`🗑️ Patinete removido`); load(); }
    catch (e) { showToast(`❌ ${e.message}`); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createScooter({
        id:        form.id.trim(),
        name:      form.name.trim(),
        model:     form.model.trim() || 'Segway Ninebot E2',
        lat:       parseFloat(form.lat),
        lng:       parseFloat(form.lng),
        hubId:     form.hubId || null,
        deviceId:  form.deviceId.trim() || null,
        simNumber: form.simNumber.trim() || null,
      });
      showToast(`✅ Patinete "${form.name}" cadastrado!`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setPickingPos(false);
      load();
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally { setSaving(false); }
  }

  const CAMPO_MOURAO = [-24.0449, -52.3831];

  return (
    <div className="page">
      {toast && <div className="toast">{toast}</div>}

      <div className="page-header">
        <h1>Frota <span className="badge">{scooters.length} patinetes</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-refresh" onClick={load}>↻ Atualizar</button>
          <button className="btn-create" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Fechar' : '+ Adicionar patinete'}
          </button>
        </div>
      </div>

      {/* Formulário de cadastro */}
      {showForm && (
        <div className="form-panel">
          <h3>Cadastrar novo patinete</h3>
          <form onSubmit={handleCreate} className="scooter-form">
            <div className="form-row">
              <div className="field">
                <label>ID (único)</label>
                <input
                  required
                  placeholder="S001"
                  value={form.id}
                  onChange={e => setField('id', e.target.value)}
                  className="mono"
                />
              </div>
              <div className="field">
                <label>Nome</label>
                <input
                  required
                  placeholder="Patinete 01"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Modelo</label>
                <input
                  placeholder="Segway Ninebot E2"
                  value={form.model}
                  onChange={e => setField('model', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Hub (opcional)</label>
                <select value={form.hubId} onChange={e => setField('hubId', e.target.value)}>
                  <option value="">— Sem hub —</option>
                  {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            </div>

            {/* IoT */}
            <div className="iot-section">
              <div className="iot-title">📡 GPS / IoT 4G</div>
              <div className="form-row">
                <div className="field">
                  <label>Device ID (IMEI)</label>
                  <input
                    placeholder="352753000000001"
                    value={form.deviceId}
                    onChange={e => setField('deviceId', e.target.value)}
                    className="mono"
                  />
                </div>
                <div className="field">
                  <label>Número SIM</label>
                  <input
                    placeholder="55119XXXXXXXX"
                    value={form.simNumber}
                    onChange={e => setField('simNumber', e.target.value)}
                    className="mono"
                  />
                </div>
              </div>
            </div>

            {/* Posição */}
            <div className="form-row">
              <div className="field">
                <label>Lat</label>
                <input
                  required
                  placeholder="-24.0449"
                  value={form.lat}
                  onChange={e => setField('lat', e.target.value)}
                  className="mono"
                />
              </div>
              <div className="field">
                <label>Lng</label>
                <input
                  required
                  placeholder="-52.3831"
                  value={form.lng}
                  onChange={e => setField('lng', e.target.value)}
                  className="mono"
                />
              </div>
            </div>

            <button
              type="button"
              className={`btn-place ${pickingPos ? 'active' : ''}`}
              onClick={() => setPickingPos(p => !p)}
            >
              {pickingPos ? '✅ Clique no mapa para posicionar' : '📍 Clicar no mapa para posição'}
            </button>

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="submit" className="btn-create" disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Salvando...' : '✅ Cadastrar patinete'}
              </button>
              <button type="button" className="btn-refresh" onClick={() => { setShowForm(false); setPickingPos(false); setForm(EMPTY_FORM); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mapa da frota */}
      <div className="fleet-map">
        <MapContainer center={CAMPO_MOURAO} zoom={15} style={{ height: '100%' }} zoomControl>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; CARTO'
          />
          <MapClickPicker
            active={pickingPos}
            onPick={(latlng) => {
              setField('lat', latlng.lat.toFixed(5));
              setField('lng', latlng.lng.toFixed(5));
              showToast(`📍 Posição: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
            }}
          />

          {zones.map((z) =>
            z.coordinates?.length >= 3 ? (
              <Polygon key={z.id} positions={z.coordinates}
                pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.07, weight: 2, dashArray: '5 4' }} />
            ) : null
          )}

          {hubs.map((h) => (
            <Marker key={h.id} position={[h.lat, h.lng]}
              icon={L.divIcon({ className: '', html: `<div style="background:#6366F1;color:white;border:2px solid white;border-radius:8px;padding:3px 6px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🅿️ ${h.name.split(' ')[1] || 'Hub'}</div>`, iconAnchor: [0, 0] })}>
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
              <th>Nome</th>
              <th>Status</th>
              <th>Bateria</th>
              <th>Device ID</th>
              <th>SIM</th>
              <th>Hub</th>
              <th>Corridas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {scooters.map((s) => (
              <tr key={s.id} className={selected?.id === s.id ? 'row-selected' : ''} onClick={() => setSelected(s)}>
                <td className="mono">{s.id}</td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
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
                <td className="mono" style={{ fontSize: 11, color: s.deviceId ? '#6EE7B7' : '#475569' }}>
                  {s.deviceId || '—'}
                </td>
                <td className="mono" style={{ fontSize: 11, color: s.simNumber ? '#6EE7B7' : '#475569' }}>
                  {s.simNumber || '—'}
                </td>
                <td style={{ fontSize: 12 }}>{s.hubId || '—'}</td>
                <td className="mono">{s.totalRides || 0}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="action-btn lock" onClick={(e) => { e.stopPropagation(); handleLock(s.id); }}>🔒</button>
                    <button className="action-btn unlock" onClick={(e) => { e.stopPropagation(); handleUnlock(s.id); }}>🔓</button>
                    <button className="action-btn" style={{ background: 'rgba(255,82,0,0.1)', color: 'var(--accent)' }}
                      onClick={(e) => { e.stopPropagation(); setQrScooter(s); }} title="Ver QR Code">⬛</button>
                    <button className="action-btn" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--danger)' }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {scooters.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#475569', padding: '24px' }}>
                Nenhum patinete cadastrado. Clique em "+ Adicionar patinete".
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

      {/* Modal QR Code */}
      {qrScooter && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 340, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{qrScooter.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>ID: {qrScooter.id}</div>
              </div>
              <button onClick={() => setQrScooter(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>

            <div style={{ background: '#fff', padding: 16, display: 'inline-block', border: '1px solid var(--border)', borderRadius: 12 }}>
              <QRCode value={qrScooter.id} size={200} />
            </div>

            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '14px 0' }}>
              Cole este QR Code no patinete. O usuário escaneará para desbloqueá-lo.
            </p>

            <button
              onClick={() => window.print()}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              🖨️ Imprimir QR Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
