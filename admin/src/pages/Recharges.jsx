import { useState, useEffect, useCallback } from 'react';
import api from '../api';

const STATUS_LABEL = {
  pending:  { text: 'Pendente',   color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  paid:     { text: 'Aprovado',   color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  rejected: { text: 'Rejeitado',  color: '#EF4444', bg: 'rgba(239,68,68,0.15)'  },
  expired:  { text: 'Expirado',   color: '#64748B', bg: 'rgba(100,116,139,0.15)' },
};

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] || STATUS_LABEL.pending;
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
    }}>
      {s.text}
    </span>
  );
}

function formatCPF(cpf) {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function Recharges() {
  const [recharges, setRecharges] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('pending');
  const [toast,     setToast]     = useState('');
  const [working,   setWorking]   = useState(null);  // id em processamento
  const [rejectModal, setRejectModal] = useState(null); // { id, name }
  const [rejectReason, setRejectReason] = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const load = useCallback(async () => {
    try {
      const data = await api.getPixRecharges();
      setRecharges(data);
    } catch (err) {
      showToast('Erro ao carregar: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id) {
    if (!window.confirm('Aprovar esta recarga e creditar o saldo?')) return;
    setWorking(id);
    try {
      await api.approvePixRecharge(id);
      showToast('✅ Recarga aprovada e saldo creditado');
      await load();
    } catch (err) {
      showToast('❌ ' + err.message);
    } finally {
      setWorking(null);
    }
  }

  async function handleReject() {
    const { id } = rejectModal;
    setWorking(id);
    try {
      await api.rejectPixRecharge(id, rejectReason);
      showToast('Recarga rejeitada');
      setRejectModal(null);
      setRejectReason('');
      await load();
    } catch (err) {
      showToast('❌ ' + err.message);
    } finally {
      setWorking(null);
    }
  }

  const filtered = recharges.filter(r => filter === 'all' || r.status === filter);

  const pendingCount = recharges.filter(r => r.status === 'pending').length;

  return (
    <div className="page">
      {toast && <div className="toast">{toast}</div>}

      {rejectModal && (
        <div style={modal.overlay}>
          <div style={modal.box}>
            <h3 style={{ margin: '0 0 8px' }}>Rejeitar recarga</h3>
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>
              Usuário: <strong>{rejectModal.name}</strong> — R$ {rejectModal.amount.toFixed(2)}
            </p>
            <textarea
              placeholder="Motivo (opcional)"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={modal.textarea}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button style={modal.btnCancel} onClick={() => { setRejectModal(null); setRejectReason(''); }}>
                Cancelar
              </button>
              <button style={modal.btnReject} onClick={handleReject} disabled={working === rejectModal.id}>
                {working === rejectModal.id ? 'Rejeitando...' : 'Rejeitar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Recargas Pix</h1>
          <p className="page-sub">Aprovar transferências e creditar saldo dos usuários</p>
        </div>
        <button className="btn-refresh" onClick={load} title="Atualizar">↻</button>
      </div>

      {/* Filtros */}
      <div style={styles.filterRow}>
        {[
          { key: 'pending', label: `Pendentes${pendingCount ? ` (${pendingCount})` : ''}` },
          { key: 'paid',    label: 'Aprovadas' },
          { key: 'rejected',label: 'Rejeitadas' },
          { key: 'all',     label: 'Todas' },
        ].map(f => (
          <button
            key={f.key}
            style={{ ...styles.filterBtn, ...(filter === f.key ? styles.filterActive : {}) }}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          {filter === 'pending' ? 'Nenhuma recarga pendente 🎉' : 'Nenhum resultado'}
        </div>
      ) : (
        <div style={styles.list}>
          {filtered.map(r => (
            <div key={r.id} style={{ ...styles.card, ...(r.status === 'pending' ? styles.cardPending : {}) }}>
              <div style={styles.cardTop}>
                <div style={styles.cardLeft}>
                  <div style={styles.userName}>{r.user?.name || '—'}</div>
                  <div style={styles.userMeta}>
                    {r.user?.email} · CPF {formatCPF(r.user?.cpf)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={styles.amount}>R$ {r.amount.toFixed(2)}</div>
                  <StatusBadge status={r.status} />
                </div>
              </div>

              <div style={styles.cardMeta}>
                <span>Ref: <strong style={{ fontFamily: 'monospace' }}>{r.reference || '—'}</strong></span>
                <span>{fmtDate(r.createdAt)}</span>
              </div>

              {r.status === 'rejected' && r.rejectedReason && (
                <div style={styles.rejectedNote}>Motivo: {r.rejectedReason}</div>
              )}

              {r.status === 'pending' && (
                <div style={styles.actions}>
                  <button
                    style={styles.btnApprove}
                    onClick={() => handleApprove(r.id)}
                    disabled={working === r.id}
                  >
                    {working === r.id ? 'Aprovando...' : '✓ Aprovar e creditar'}
                  </button>
                  <button
                    style={styles.btnReject}
                    onClick={() => setRejectModal({ id: r.id, name: r.user?.name, amount: r.amount })}
                    disabled={working === r.id}
                  >
                    ✕ Rejeitar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  filterRow: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  filterBtn: {
    padding: '7px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: '#94A3B8', fontSize: 13, cursor: 'pointer',
  },
  filterActive: {
    background: 'rgba(99,102,241,0.2)', borderColor: 'rgba(99,102,241,0.5)', color: '#818CF8',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: 'var(--surface, #131320)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14, padding: '14px 16px',
  },
  cardPending: { borderColor: 'rgba(245,158,11,0.3)' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: {},
  userName: { fontWeight: 600, fontSize: 15 },
  userMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  amount: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  cardMeta: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 12, color: '#64748B', marginBottom: 8,
  },
  rejectedNote: {
    fontSize: 12, color: '#EF4444', background: 'rgba(239,68,68,0.08)',
    borderRadius: 8, padding: '6px 10px', marginBottom: 8,
  },
  actions: { display: 'flex', gap: 8, marginTop: 4 },
  btnApprove: {
    flex: 2, padding: '9px 0', borderRadius: 8, border: 'none',
    background: 'rgba(16,185,129,0.2)', color: '#10B981',
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(16,185,129,0.3)',
  },
  btnReject: {
    flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.1)', color: '#EF4444',
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  empty: { textAlign: 'center', color: '#64748B', padding: '40px 0', fontSize: 15 },
};

const modal = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  },
  box: {
    background: '#1c1c2e', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, padding: '24px', width: 360, maxWidth: '90vw',
  },
  textarea: {
    width: '100%', minHeight: 80, background: '#0a0a0f',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
    color: '#F1F5F9', padding: 10, fontSize: 13, resize: 'vertical',
    outline: 'none', boxSizing: 'border-box',
  },
  btnCancel: {
    flex: 1, padding: '10px 0', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: '#94A3B8', cursor: 'pointer', fontSize: 14,
  },
  btnReject: {
    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
    background: '#EF4444', color: '#fff', fontWeight: 700,
    fontSize: 14, cursor: 'pointer',
  },
};
