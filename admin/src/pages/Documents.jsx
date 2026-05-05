import { useState, useEffect } from 'react';
import api from '../api';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

function getToken() { return localStorage.getItem('admin_token'); }

async function fetchImageBlobUrl(filename) {
  const name = filename.split('/').pop();
  const res  = await fetch(`${BASE}/admin/documents/image/${name}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function AuthImage({ documentImageUrl }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!documentImageUrl) return;
    let objectUrl = null;
    fetchImageBlobUrl(documentImageUrl).then(url => {
      objectUrl = url;
      setSrc(url);
    });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [documentImageUrl]);

  if (!src) return (
    <div style={{ textAlign: 'center', padding: 32, background: 'var(--surface)', borderRadius: 10, marginBottom: 14, color: 'var(--muted)', fontSize: 13 }}>
      Carregando imagem...
    </div>
  );
  return (
    <img
      src={src}
      alt="Documento de identidade"
      style={{ width: '100%', borderRadius: 10, marginBottom: 14, border: '1px solid var(--border)', display: 'block' }}
    />
  );
}

function StatusChip({ status }) {
  const map = {
    pending:  { label: 'Pendente',  bg: 'rgba(217,119,6,0.1)',  color: '#D97706' },
    approved: { label: 'Aprovado',  bg: 'rgba(22,163,74,0.1)',  color: '#16A34A' },
    rejected: { label: 'Rejeitado', bg: 'rgba(220,38,38,0.1)',  color: '#DC2626' },
  };
  const s = map[status] || map.pending;
  return (
    <span className="status-chip" style={{ background: s.bg, color: s.color }}>{s.label}</span>
  );
}

export default function Documents() {
  const [docs,         setDocs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('pending');
  const [modal,        setModal]        = useState(null);
  const [rejectStep,   setRejectStep]   = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  async function load() {
    setLoading(true);
    try { setDocs(await api.getDocuments()); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openModal(doc) {
    setModal(doc);
    setRejectStep(false);
    setRejectReason('');
  }

  async function handleApprove(userId) {
    setSaving(true);
    try {
      await api.approveDocument(userId);
      setDocs(prev => prev.map(d => d.id === userId ? { ...d, documentStatus: 'approved', documentRejectedReason: null } : d));
      setModal(prev => prev?.id === userId ? { ...prev, documentStatus: 'approved' } : prev);
      showToast('✅ Documento aprovado');
    } catch (err) { showToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  async function handleReject(userId) {
    setSaving(true);
    try {
      await api.rejectDocument(userId, rejectReason);
      const updated = { documentStatus: 'rejected', documentRejectedReason: rejectReason || null };
      setDocs(prev => prev.map(d => d.id === userId ? { ...d, ...updated } : d));
      setModal(prev => prev?.id === userId ? { ...prev, ...updated } : prev);
      setRejectStep(false);
      setRejectReason('');
      showToast('Documento rejeitado');
    } catch (err) { showToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  const filtered = docs.filter(d => d.documentStatus === filter);
  const pendingCount = docs.filter(d => d.documentStatus === 'pending').length;

  return (
    <div className="page">
      {toast && <div className="toast">{toast}</div>}

      <div className="page-header">
        <h1>🪪 Documentos</h1>
        {pendingCount > 0 && <span className="badge">{pendingCount} pendentes</span>}
        <button className="btn-refresh" onClick={load} disabled={loading}>↻ Atualizar</button>
      </div>

      <div className="filter-tabs">
        {[
          { key: 'pending',  label: 'Pendentes' },
          { key: 'approved', label: 'Aprovados' },
          { key: 'rejected', label: 'Rejeitados' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`filter-tab ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 14 }}>
          Nenhum documento {filter === 'pending' ? 'pendente de análise' : filter === 'approved' ? 'aprovado' : 'rejeitado'}.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>CPF</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{doc.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{doc.email}</div>
                  </td>
                  <td className="mono">
                    {doc.cpf
                      ? `${doc.cpf.slice(0,3)}.${doc.cpf.slice(3,6)}.${doc.cpf.slice(6,9)}-${doc.cpf.slice(9)}`
                      : '—'}
                  </td>
                  <td><StatusChip status={doc.documentStatus} /></td>
                  <td>
                    <button className="btn-refresh" onClick={() => openModal(doc)}>
                      Ver documento
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de análise */}
      {modal && (
        <div style={styles.overlay} onClick={() => setModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{modal.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{modal.email}</div>
              </div>
              <button
                onClick={() => setModal(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Imagem */}
            {modal.documentImageUrl ? (
              <AuthImage documentImageUrl={modal.documentImageUrl} />
            ) : (
              <div style={{ textAlign: 'center', padding: 32, background: 'var(--surface)', borderRadius: 10, marginBottom: 14, color: 'var(--muted)' }}>
                Nenhum documento enviado ainda.
              </div>
            )}

            {/* Status atual */}
            <div style={{ marginBottom: 14 }}>
              <StatusChip status={modal.documentStatus} />
              {modal.documentStatus === 'rejected' && modal.documentRejectedReason && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)', background: 'rgba(220,38,38,0.06)', borderRadius: 8, padding: '8px 10px' }}>
                  Motivo: {modal.documentRejectedReason}
                </div>
              )}
            </div>

            {/* Ações — só para pendentes com imagem */}
            {modal.documentStatus === 'pending' && modal.documentImageUrl && !rejectStep && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-create"
                  style={{ flex: 1 }}
                  onClick={() => handleApprove(modal.id)}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : '✓ Aprovar'}
                </button>
                <button
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: 'rgba(220,38,38,0.1)', color: 'var(--danger)', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
                  onClick={() => setRejectStep(true)}
                  disabled={saving}
                >
                  ✕ Rejeitar
                </button>
              </div>
            )}

            {/* Form de rejeição */}
            {rejectStep && (
              <div>
                <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Motivo da rejeição (opcional)</div>
                <input
                  type="text"
                  placeholder="Ex: Documento ilegível, foto borrada..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', marginBottom: 10, fontFamily: 'inherit', boxSizing: 'border-box' }}
                  onKeyDown={e => e.key === 'Enter' && handleReject(modal.id)}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
                    onClick={() => setRejectStep(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
                    onClick={() => handleReject(modal.id)}
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : 'Confirmar rejeição'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  },
  modal: {
    background: '#fff', borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
};
