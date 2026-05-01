import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';

const COLORS = [
  { label: 'Azul',    value: '#3B82F6' },
  { label: 'Verde',   value: '#10B981' },
  { label: 'Amarelo', value: '#F59E0B' },
  { label: 'Roxo',    value: '#8B5CF6' },
  { label: 'Rosa',    value: '#EC4899' },
  { label: 'Laranja', value: '#F97316' },
];

function MapClickHandler({ onMapClick, active }) {
  useMapEvents({ click: (e) => { if (active) onMapClick(e.latlng); } });
  return null;
}

function FlyTo({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, 15); }, [pos]);
  return null;
}

export default function Zones() {
  const [zones, setZones]   = useState([]);
  const [toast, setToast]   = useState('');
  const [placing, setPlacing] = useState(false);
  const [flyTo, setFlyTo]   = useState(null);
  const [form, setForm]     = useState({
    name: '', color: '#3B82F6', radius: 500, lat: '', lng: '',
  });

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }
  function setField(k, v)  { setForm(f => ({ ...f, [k]: v })); }

  // Carrega zonas do backend
  async function load() {
    try {
      const data = await api.getZones();
      setZones(data);
    } catch { showToast('❌ Erro ao carregar zonas'); }
  }

  useEffect(() => { load(); }, []);

  function handleMapClick(latlng) {
    setField('lat', latlng.lat.toFixed(5));
    setField('lng', latlng.lng.toFixed(5));
    showToast(`📍 Centro selecionado: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name || !form.lat || !form.lng) {
      return showToast('❌ Preencha o nome e clique no mapa para definir o centro');
    }
    try {
      await api.createZone({
        name:   form.name,
        color:  form.color,
        radius: parseInt(form.radius),
        center: { lat: parseFloat(form.lat), lng: parseFloat(form.lng) },
      });
      showToast(`✅ Zona "${form.name}" criada!`);
      setForm({ name: '', color: '#3B82F6', radius: 500, lat: '', lng: '' });
      setPlacing(false);
      load();
    } catch (err) { showToast(`❌ ${err.message}`); }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Remover a zona "${name}"?`)) return;
    try {
      await api.deleteZone(id);
      showToast(`✅ Zona removida`);
      load();
    } catch (err) { showToast(`❌ ${err.message}`); }
  }

  const previewLat = parseFloat(form.lat) || null;
  const previewLng = parseFloat(form.lng) || null;

  return (
    <div className="page">
      {toast && <div className="toast">{toast}</div>}

      <div className="page-header">
        <h1>Zonas <span className="badge">{zones.length} ativas</span></h1>
        <span style={{ fontSize: 13, color: '#64748B' }}>
          Áreas onde os patinetes podem circular
        </span>
      </div>

      {/* Explicação rápida */}
      <div className="zone-info-box">
        <span>ℹ️</span>
        <div>
          <strong>O que são as zonas?</strong> São os círculos coloridos no mapa. Patinetes
          só podem ser desbloqueados e encerrados dentro dessas áreas. Você define o
          centro clicando no mapa e ajusta o raio em metros.
        </div>
      </div>

      <div className="hubs-layout">
        {/* Mapa */}
        <div className="hub-map" style={{ cursor: placing ? 'crosshair' : 'default' }}>
          <MapContainer center={[-24.0449, -52.3831]} zoom={14} style={{ height: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; CARTO"
            />
            <MapClickHandler onMapClick={handleMapClick} active={placing} />
            {flyTo && <FlyTo pos={flyTo} />}

            {/* Zonas existentes */}
            {zones.map((z) => (
              <Circle
                key={z.id}
                center={[z.center.lat, z.center.lng]}
                radius={z.radius}
                pathOptions={{
                  color: z.color,
                  fillColor: z.color,
                  fillOpacity: 0.15,
                  weight: 2,
                }}
              >
              </Circle>
            ))}

            {/* Preview da nova zona */}
            {previewLat && previewLng && (
              <>
                <Circle
                  center={[previewLat, previewLng]}
                  radius={parseInt(form.radius) || 500}
                  pathOptions={{
                    color: form.color,
                    fillColor: form.color,
                    fillOpacity: 0.2,
                    weight: 2,
                    dashArray: '8 4',
                  }}
                />
                <Marker
                  position={[previewLat, previewLng]}
                  icon={L.divIcon({
                    className: '',
                    html: `<div style="background:${form.color};border:2px solid white;border-radius:50%;width:14px;height:14px;"></div>`,
                    iconSize: [14, 14], iconAnchor: [7, 7],
                  })}
                />
              </>
            )}
          </MapContainer>
        </div>

        {/* Painel lateral */}
        <div className="hub-panel">

          {/* Formulário nova zona */}
          <div className="hub-form-section">
            <h3>➕ Nova zona</h3>

            <form onSubmit={handleCreate} className="hub-form">
              <div className="field">
                <label>Nome da zona</label>
                <input
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="Ex: Parque Industrial"
                />
              </div>

              {/* Seletor de cor */}
              <div className="field">
                <label>Cor no mapa</label>
                <div className="color-picker">
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      className={`color-dot ${form.color === c.value ? 'selected' : ''}`}
                      style={{ background: c.value }}
                      title={c.label}
                      onClick={() => setField('color', c.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Raio */}
              <div className="field">
                <label>Raio — <strong style={{ color: '#6EE7B7' }}>{form.radius}m</strong></label>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={form.radius}
                  onChange={e => setField('radius', e.target.value)}
                  style={{ width: '100%', accentColor: form.color }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                  <span>100m</span><span>2000m</span>
                </div>
              </div>

              {/* Coordenadas */}
              <div className="coord-fields">
                <div className="field">
                  <label>Lat</label>
                  <input className="mono" value={form.lat}
                    onChange={e => setField('lat', e.target.value)} placeholder="-24.04" />
                </div>
                <div className="field">
                  <label>Lng</label>
                  <input className="mono" value={form.lng}
                    onChange={e => setField('lng', e.target.value)} placeholder="-52.38" />
                </div>
              </div>

              <button
                type="button"
                className={`btn-place ${placing ? 'active' : ''}`}
                onClick={() => setPlacing(p => !p)}
              >
                {placing ? '✅ Clique no mapa para posicionar' : '🗺️ Ativar clique no mapa'}
              </button>

              <button type="submit" className="btn-create">
                + Criar zona
              </button>
            </form>
          </div>

          {/* Lista de zonas existentes */}
          <div className="hub-list-section">
            <h3>Zonas cadastradas</h3>

            {zones.length === 0 && (
              <p style={{ fontSize: 13, color: '#475569', padding: '8px 0' }}>
                Nenhuma zona cadastrada ainda.
              </p>
            )}

            {zones.map(z => (
              <div key={z.id} className="hub-item"
                onClick={() => setFlyTo([z.center.lat, z.center.lng])}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: z.color, flexShrink: 0,
                    boxShadow: `0 0 8px ${z.color}`,
                  }} />
                  <div>
                    <div className="hub-name">{z.name}</div>
                    <div className="hub-meta">
                      Raio: {z.radius}m · {z.center.lat?.toFixed(4)}, {z.center.lng?.toFixed(4)}
                    </div>
                  </div>
                </div>
                <button
                  className="btn-del"
                  onClick={e => { e.stopPropagation(); handleDelete(z.id, z.name); }}
                >🗑️</button>
              </div>
            ))}
          </div>

          {/* Legenda */}
          <div className="hub-form-section" style={{ padding: '12px 16px' }}>
            <h3 style={{ fontSize: 13, marginBottom: 8 }}>📖 Como funciona</h3>
            <ul style={{ fontSize: 12, color: '#64748B', lineHeight: 1.7, paddingLeft: 16 }}>
              <li>Patinete só pode ser <strong style={{color:'#6EE7B7'}}>desbloqueado</strong> dentro de uma zona</li>
              <li>Corrida só pode ser <strong style={{color:'#6EE7B7'}}>encerrada</strong> dentro de zona ou hub</li>
              <li>Fora das zonas o app exibe aviso e bloqueia a ação</li>
              <li>Clique em uma zona da lista para centralizar no mapa</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
