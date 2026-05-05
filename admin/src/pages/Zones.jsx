import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import api from '../api';

const COLORS = [
  { label: 'Azul',    value: '#3B82F6' },
  { label: 'Verde',   value: '#10B981' },
  { label: 'Amarelo', value: '#F59E0B' },
  { label: 'Roxo',    value: '#8B5CF6' },
  { label: 'Rosa',    value: '#EC4899' },
  { label: 'Laranja', value: '#F97316' },
];

function DrawHandler({ isDrawing, onAddPoint }) {
  useMapEvents({
    click(e) {
      if (isDrawing) onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function FlyTo({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, 15); }, [pos]);
  return null;
}

export default function Zones() {
  const [zones,       setZones]       = useState([]);
  const [toast,       setToast]       = useState('');
  const [isDrawing,   setIsDrawing]   = useState(false);
  const [drawPoints,  setDrawPoints]  = useState([]);
  const [flyTo,       setFlyTo]       = useState(null);
  const [name,        setName]        = useState('');
  const [color,       setColor]       = useState('#3B82F6');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  async function load() {
    try { setZones(await api.getZones()); }
    catch { showToast('❌ Erro ao carregar zonas'); }
  }

  useEffect(() => { load(); }, []);

  function handleAddPoint(point) {
    setDrawPoints(prev => [...prev, point]);
  }

  function handleUndo() {
    setDrawPoints(prev => prev.slice(0, -1));
  }

  function handleCancelDraw() {
    setIsDrawing(false);
    setDrawPoints([]);
  }

  async function handleSave() {
    if (!name.trim()) return showToast('❌ Digite um nome para a zona');
    if (drawPoints.length < 3) return showToast('❌ Desenhe ao menos 3 pontos no mapa');
    try {
      await api.createZone({ name: name.trim(), color, coordinates: drawPoints });
      showToast(`✅ Zona "${name}" criada!`);
      setName('');
      setColor('#3B82F6');
      setDrawPoints([]);
      setIsDrawing(false);
      load();
    } catch (err) { showToast(`❌ ${err.message}`); }
  }

  async function handleDelete(id, zoneName) {
    if (!window.confirm(`Remover a zona "${zoneName}"?`)) return;
    try {
      await api.deleteZone(id);
      showToast('✅ Zona removida');
      load();
    } catch (err) { showToast(`❌ ${err.message}`); }
  }

  // Linha fechando o polígono em preview (último ponto → primeiro)
  const previewPolyline = drawPoints.length >= 2
    ? [...drawPoints, drawPoints[0]]
    : drawPoints;

  return (
    <div className="page">
      {toast && <div className="toast">{toast}</div>}

      <div className="page-header">
        <h1>Zonas <span className="badge">{zones.length} ativas</span></h1>
        <span style={{ fontSize: 13, color: '#64748B' }}>Áreas onde os patinetes podem operar</span>
      </div>

      <div className="hubs-layout">
        {/* Mapa */}
        <div className="hub-map" style={{ cursor: isDrawing ? 'crosshair' : 'default' }}>
          <MapContainer center={[-24.0449, -52.3831]} zoom={14} style={{ height: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; CARTO"
            />
            <DrawHandler isDrawing={isDrawing} onAddPoint={handleAddPoint} />
            {flyTo && <FlyTo pos={flyTo} />}

            {/* Zonas salvas */}
            {zones.map((z) =>
              z.coordinates?.length >= 3 ? (
                <Polygon
                  key={z.id}
                  positions={z.coordinates}
                  pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.15, weight: 2 }}
                />
              ) : null
            )}

            {/* Polígono sendo desenhado */}
            {drawPoints.length >= 2 && (
              <Polyline
                positions={previewPolyline}
                pathOptions={{ color, weight: 2, dashArray: '6 4', opacity: 0.9 }}
              />
            )}

            {/* Fill preview quando >= 3 pontos */}
            {drawPoints.length >= 3 && (
              <Polygon
                positions={drawPoints}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 0 }}
              />
            )}

            {/* Marcadores dos pontos */}
            {drawPoints.map((pt, i) => (
              <CircleMarker
                key={i}
                center={pt}
                radius={i === 0 ? 8 : 5}
                pathOptions={{
                  color: 'white',
                  fillColor: i === 0 ? color : '#fff',
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
            ))}
          </MapContainer>
        </div>

        {/* Painel lateral */}
        <div className="hub-panel">

          {/* Formulário */}
          <div className="hub-form-section">
            <h3>✏️ Nova zona</h3>

            <div className="field">
              <label>Nome da zona</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Centro Histórico"
              />
            </div>

            <div className="field">
              <label>Cor no mapa</label>
              <div className="color-picker">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={`color-dot ${color === c.value ? 'selected' : ''}`}
                    style={{ background: c.value }}
                    title={c.label}
                    onClick={() => setColor(c.value)}
                  />
                ))}
              </div>
            </div>

            {/* Instruções de desenho */}
            <div className="draw-instructions">
              {!isDrawing ? (
                <>
                  <p>Clique em <strong>Iniciar desenho</strong> e depois clique no mapa para adicionar os vértices da zona.</p>
                  <button className="btn-place" onClick={() => { setIsDrawing(true); setDrawPoints([]); }}>
                    🖊️ Iniciar desenho no mapa
                  </button>
                </>
              ) : (
                <>
                  <div className="draw-status">
                    <span style={{ color: '#6EE7B7', fontWeight: 700 }}>● Desenhando</span>
                    <span style={{ color: '#64748B', fontSize: 12 }}>{drawPoints.length} pontos</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '6px 0' }}>
                    Clique no mapa para adicionar vértices. Mínimo 3 pontos para salvar.
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn-refresh"
                      onClick={handleUndo}
                      disabled={drawPoints.length === 0}
                      style={{ flex: 1 }}
                    >
                      ↩ Desfazer
                    </button>
                    <button
                      className="btn-refresh"
                      onClick={handleCancelDraw}
                      style={{ flex: 1, color: '#EF4444' }}
                    >
                      ✕ Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              className="btn-create"
              onClick={handleSave}
              disabled={drawPoints.length < 3 || !name.trim()}
              style={{ marginTop: 8 }}
            >
              {drawPoints.length < 3
                ? `Faltam ${Math.max(0, 3 - drawPoints.length)} ponto(s)`
                : `✅ Salvar zona (${drawPoints.length} pts)`}
            </button>
          </div>

          {/* Lista de zonas */}
          <div className="hub-list-section">
            <h3>Zonas cadastradas</h3>

            {zones.length === 0 && (
              <p style={{ fontSize: 13, color: '#475569', padding: '8px 0' }}>
                Nenhuma zona cadastrada. Desenhe a primeira no mapa.
              </p>
            )}

            {zones.map(z => {
              const coords = z.coordinates || [];
              // Calcula centro aproximado para FlyTo
              const centerLat = coords.reduce((s, c) => s + c[0], 0) / (coords.length || 1);
              const centerLng = coords.reduce((s, c) => s + c[1], 0) / (coords.length || 1);
              return (
                <div
                  key={z.id}
                  className="hub-item"
                  onClick={() => setFlyTo([centerLat, centerLng])}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: z.color, flexShrink: 0,
                      boxShadow: `0 0 8px ${z.color}`,
                    }} />
                    <div>
                      <div className="hub-name">{z.name}</div>
                      <div className="hub-meta">{coords.length} vértices</div>
                    </div>
                  </div>
                  <button
                    className="btn-del"
                    onClick={e => { e.stopPropagation(); handleDelete(z.id, z.name); }}
                  >🗑️</button>
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="hub-form-section" style={{ padding: '12px 16px' }}>
            <h3 style={{ fontSize: 13, marginBottom: 8 }}>📖 Como funciona</h3>
            <ul style={{ fontSize: 12, color: '#64748B', lineHeight: 1.7, paddingLeft: 16 }}>
              <li>Patinetes só podem ser <strong style={{ color: '#6EE7B7' }}>desbloqueados</strong> dentro de uma zona</li>
              <li>Corridas só podem ser <strong style={{ color: '#6EE7B7' }}>encerradas</strong> dentro de zona ou hub</li>
              <li>Clique em uma zona da lista para centralizar no mapa</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
