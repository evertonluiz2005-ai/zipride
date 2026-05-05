import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';

const hubIcon = L.divIcon({
  className: '',
  html: `<div style="background:#6366F1;border:2px solid white;border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.4);">🅿️</div>`,
  iconSize: [30, 30], iconAnchor: [15, 15],
});

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

export default function Hubs() {
  const [hubs, setHubs] = useState([]);
  const [zones, setZones] = useState([]);
  const [toast, setToast] = useState('');
  const [newHub, setNewHub] = useState({ name: '', lat: '', lng: '', capacity: 4, zoneId: '' });
  const [placing, setPlacing] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function load() {
    const [h, z] = await Promise.all([api.getHubs(), api.getZones()]);
    setHubs(h); setZones(z);
  }

  useEffect(() => { load(); }, []);

  function handleMapClick(latlng) {
    if (!placing) return;
    setNewHub(h => ({ ...h, lat: latlng.lat.toFixed(5), lng: latlng.lng.toFixed(5) }));
    showToast(`📍 Posição selecionada: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newHub.name || !newHub.lat || !newHub.lng) {
      return showToast('❌ Preencha nome e posição (clique no mapa)');
    }
    try {
      await api.createHub(newHub);
      showToast(`✅ Hub "${newHub.name}" criado!`);
      setNewHub({ name: '', lat: '', lng: '', capacity: 4, zoneId: '' });
      setPlacing(false);
      load();
    } catch (e) { showToast(`❌ ${e.message}`); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remover este hub?')) return;
    try { await api.deleteHub(id); showToast('✅ Hub removido'); load(); }
    catch (e) { showToast(`❌ ${e.message}`); }
  }

  return (
    <div className="page">
      {toast && <div className="toast">{toast}</div>}

      <div className="page-header">
        <h1>Hubs <span className="badge">{hubs.length}</span></h1>
      </div>

      <div className="hubs-layout">
        {/* Mapa */}
        <div className="hub-map" style={{ cursor: placing ? 'crosshair' : 'default' }}>
          <MapContainer center={[-24.0449, -52.3831]} zoom={15} style={{ height: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; CARTO'
            />
            <MapClickHandler onMapClick={handleMapClick} />

            {zones.map((z) =>
              z.coordinates?.length >= 3 ? (
                <Polygon key={z.id} positions={z.coordinates}
                  pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.07, weight: 2, dashArray: '5 4' }} />
              ) : null
            )}

            {hubs.map((h) => (
              <Marker key={h.id} position={[h.lat, h.lng]} icon={hubIcon}>
                <Popup>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', minWidth: 140 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{h.name}</div>
                    <div style={{ fontSize: 12, marginBottom: 8 }}>Capacidade: {h.capacity}</div>
                    <button onClick={() => handleDelete(h.id)}
                      style={{ background: '#EF4444', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      🗑️ Remover
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {newHub.lat && newHub.lng && (
              <Marker position={[parseFloat(newHub.lat), parseFloat(newHub.lng)]}
                icon={L.divIcon({ className: '', html: `<div style="background:#F59E0B;border:2px solid white;border-radius:50%;width:20px;height:20px;"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] })}
              />
            )}
          </MapContainer>
        </div>

        {/* Painel lateral */}
        <div className="hub-panel">
          <div className="hub-form-section">
            <h3>Novo Hub</h3>
            <p className="hint-text">
              {placing ? '📍 Clique no mapa para posicionar' : 'Configure e posicione o hub no mapa'}
            </p>

            <form onSubmit={handleCreate} className="hub-form">
              <div className="field">
                <label>Nome do hub</label>
                <input value={newHub.name} onChange={e => setNewHub(h => ({ ...h, name: e.target.value }))} placeholder="Ex: Hub Terminal" />
              </div>
              <div className="field">
                <label>Zona</label>
                <select value={newHub.zoneId} onChange={e => setNewHub(h => ({ ...h, zoneId: e.target.value }))}>
                  <option value="">Nenhuma</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Capacidade</label>
                <input type="number" min="1" max="20" value={newHub.capacity}
                  onChange={e => setNewHub(h => ({ ...h, capacity: parseInt(e.target.value) }))} />
              </div>
              <div className="coord-fields">
                <div className="field">
                  <label>Lat</label>
                  <input className="mono" value={newHub.lat} onChange={e => setNewHub(h => ({ ...h, lat: e.target.value }))} placeholder="-24.04" />
                </div>
                <div className="field">
                  <label>Lng</label>
                  <input className="mono" value={newHub.lng} onChange={e => setNewHub(h => ({ ...h, lng: e.target.value }))} placeholder="-52.38" />
                </div>
              </div>

              <button type="button" className={`btn-place ${placing ? 'active' : ''}`} onClick={() => setPlacing(p => !p)}>
                {placing ? '✅ Modo posicionamento ativo' : '📍 Ativar posicionamento no mapa'}
              </button>
              <button type="submit" className="btn-create">+ Criar Hub</button>
            </form>
          </div>

          <div className="hub-list-section">
            <h3>Hubs existentes</h3>
            {hubs.map(h => (
              <div key={h.id} className="hub-item">
                <div>
                  <div className="hub-name">🅿️ {h.name}</div>
                  <div className="hub-meta">Cap: {h.capacity} · {h.lat?.toFixed(4)}, {h.lng?.toFixed(4)}</div>
                </div>
                <button className="btn-del" onClick={() => handleDelete(h.id)}>🗑️</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
