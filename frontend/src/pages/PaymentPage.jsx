import { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';

const CARD_STYLE = {
  style: {
    base: {
      color: '#F1F5F9',
      fontFamily: '"Space Grotesk", system-ui, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#475569' },
    },
    invalid: { color: '#EF4444', iconColor: '#EF4444' },
  },
};

const RECHARGE_AMOUNTS = [10, 20, 50];

// ─── Formulário de cartão Stripe ──────────────────────────────────────────────
function CardForm({ onSuccess }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [ready,   setReady]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(''); setLoading(true);
    try {
      const { clientSecret } = await api.createSetupIntent();
      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(
        clientSecret,
        { payment_method: { card: elements.getElement(CardElement) } }
      );
      if (stripeError) return setError(stripeError.message);
      const result = await api.saveCard(setupIntent.payment_method);
      onSuccess(result.card);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-form">
      <div className="stripe-card-wrapper">
        <CardElement options={CARD_STYLE} onReady={() => setReady(true)}
          onChange={(e) => { if (e.error) setError(e.error.message); else setError(''); }} />
      </div>
      {error && <div className="error-msg">{error}</div>}
      <div className="test-cards">
        <div className="test-cards-title">🧪 Cartões de teste</div>
        {[
          { num: '4242 4242 4242 4242', label: 'Aprovado' },
          { num: '4000 0000 0000 0002', label: 'Recusado' },
        ].map(c => (
          <div key={c.num} className="test-card-row">
            <code>{c.num}</code><span>{c.label}</span>
          </div>
        ))}
        <div className="test-card-hint">Qualquer data futura e qualquer CVC</div>
      </div>
      <button type="submit" className="btn-primary" disabled={!stripe || !ready || loading}>
        {loading ? '🔐 Salvando...' : '💳 Salvar cartão'}
      </button>
    </form>
  );
}

// ─── Modal Pix ────────────────────────────────────────────────────────────────
function PixModal({ pixData, onClose, onPaid, refreshUser }) {
  const [status,      setStatus]     = useState('pending');
  const [copiedKey,   setCopiedKey]  = useState(false);
  const [copiedRef,   setCopiedRef]  = useState(false);
  const [rejectedMsg, setRejectedMsg] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getPixStatus(pixData.rechargeId);
        if (data.status === 'paid') {
          clearInterval(pollRef.current);
          setStatus('paid');
          await refreshUser();
          setTimeout(onPaid, 2000);
        } else if (data.status === 'rejected') {
          clearInterval(pollRef.current);
          setStatus('rejected');
          setRejectedMsg(data.rejectedReason || '');
        } else if (data.status === 'expired') {
          clearInterval(pollRef.current);
          setStatus('expired');
        }
      } catch { /* ignora erros de rede */ }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  async function copy(text, setCopied) {
    try { await navigator.clipboard.writeText(text); } catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={pix.overlay}>
      <div style={pix.modal}>

        {status === 'paid' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 56 }}>✅</div>
            <h3 style={{ color: '#6EE7B7', margin: '12px 0 6px' }}>Pagamento confirmado!</h3>
            <p style={{ color: '#aaa', fontSize: 14 }}>
              R$ {pixData.amount.toFixed(2)} adicionados ao seu saldo
            </p>
          </div>
        )}

        {status === 'rejected' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 48 }}>❌</div>
            <h3 style={{ color: '#EF4444', margin: '12px 0 6px' }}>Recarga rejeitada</h3>
            {rejectedMsg && <p style={{ color: '#aaa', fontSize: 13 }}>{rejectedMsg}</p>}
            <p style={{ color: '#64748B', fontSize: 12, marginTop: 8 }}>Entre em contato com o suporte se precisar de ajuda.</p>
            <button style={pix.btnClose} onClick={onClose}>Fechar</button>
          </div>
        )}

        {status === 'expired' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 44 }}>⌛</div>
            <h3 style={{ margin: '12px 0 6px' }}>Solicitação expirada</h3>
            <p style={{ color: '#aaa', fontSize: 14 }}>Gere uma nova recarga para continuar.</p>
            <button style={{ ...pix.btnClose, marginTop: 16 }} onClick={onClose}>Fechar</button>
          </div>
        )}

        {status === 'pending' && (
          <>
            <div style={pix.header}>
              <div>
                <div style={pix.headerLabel}>Recarga via Pix</div>
                <div style={pix.headerAmount}>R$ {pixData.amount.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={pix.refLabel}>Referência</div>
                <div style={pix.refCode}>{pixData.reference}</div>
              </div>
            </div>

            <div style={pix.instrucoes}>
              <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 13 }}>Como pagar:</p>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#aaa', lineHeight: 1.8 }}>
                <li>Abra o app do seu banco</li>
                <li>Acesse <strong>Pix → Pagar → Chave Pix</strong></li>
                <li>Cole a chave abaixo e informe R$ {pixData.amount.toFixed(2)}</li>
                <li>No campo <em>descrição/observação</em>, informe o código <strong>{pixData.reference}</strong></li>
              </ol>
            </div>

            {/* Chave Pix */}
            <div style={pix.keyBox}>
              <div style={pix.keyMeta}>
                <span style={pix.keyTypeBadge}>{pixData.pixKeyType?.toUpperCase()}</span>
                <span style={pix.keyBeneficiary}>{pixData.beneficiaryName}</span>
              </div>
              <div style={pix.keyRow}>
                <span style={pix.keyText}>{pixData.pixKeyFormatted || pixData.pixKey}</span>
                <button
                  style={copiedKey ? pix.btnCopied : pix.btnCopyInline}
                  onClick={() => copy(pixData.pixKey, setCopiedKey)}
                >
                  {copiedKey ? '✓' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Código de referência */}
            <div style={pix.refBox}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>
                Inclua este código na descrição do Pix
              </div>
              <div style={pix.keyRow}>
                <span style={{ ...pix.keyText, fontFamily: 'monospace', fontSize: 16, letterSpacing: 1 }}>
                  {pixData.reference}
                </span>
                <button
                  style={copiedRef ? pix.btnCopied : pix.btnCopyInline}
                  onClick={() => copy(pixData.reference, setCopiedRef)}
                >
                  {copiedRef ? '✓' : 'Copiar'}
                </button>
              </div>
            </div>

            <div style={pix.polling}>
              <span style={pix.dot} />
              Aguardando confirmação do pagamento...
            </div>

            <p style={{ fontSize: 11, color: '#64748B', textAlign: 'center', margin: '0 0 12px' }}>
              Após o pagamento, o saldo é creditado em até alguns minutos após confirmação.
            </p>

            <button style={pix.btnClose} onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PaymentPage() {
  const { user, refreshUser }   = useAuth();
  const [stripePromise, setSP]  = useState(null);
  const [card,     setCard]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [removing, setRemoving] = useState(false);
  const [toast,    setToast]    = useState('');
  const [showForm, setShowForm] = useState(false);

  const [pixStep,     setPixStep]     = useState('idle');
  const [customAmt,   setCustomAmt]   = useState('');
  const [selectedAmt, setSelectedAmt] = useState(null);
  const [pixData,     setPixData]     = useState(null);
  const [pixError,    setPixError]    = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  useEffect(() => {
    async function init() {
      try {
        const { key } = await api.getStripeKey();
        setSP(loadStripe(key));
        const cardData = await api.getCard();
        if (cardData.hasCard) setCard(cardData);
      } catch {
        showToast('⚠️ Configure STRIPE_PUBLISHABLE_KEY no backend');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleRemoveCard() {
    if (!window.confirm('Remover cartão salvo?')) return;
    setRemoving(true);
    try {
      await api.removeCard();
      setCard(null); setShowForm(false);
      showToast('✅ Cartão removido');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      setRemoving(false);
    }
  }

  async function handleStartPix() {
    const amount = selectedAmt || parseFloat(customAmt);
    if (!amount || amount < 5)  return setPixError('Valor mínimo é R$ 5,00');
    if (amount > 500)            return setPixError('Valor máximo é R$ 500,00');
    setPixError('');
    setPixStep('loading');
    try {
      const data = await api.createPixPayment(amount);
      setPixData(data);
      setPixStep('modal');
    } catch (err) {
      setPixError(err.message);
      setPixStep('selecting');
    }
  }

  if (loading) {
    return (
      <div className="screen">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
        <BottomNav active="payment" />
      </div>
    );
  }

  return (
    <div className="screen">
      {toast && <div className="toast">{toast}</div>}

      {pixStep === 'modal' && pixData && (
        <PixModal
          pixData={pixData}
          onClose={() => { setPixStep('idle'); setPixData(null); setSelectedAmt(null); setCustomAmt(''); }}
          onPaid={() => { setPixStep('idle'); setPixData(null); setSelectedAmt(null); setCustomAmt(''); showToast('✅ Saldo adicionado!'); }}
          refreshUser={refreshUser}
        />
      )}

      <div className="map-header">
        <div>
          <h2>💳 Pagamento</h2>
          <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>Cobrado ao encerrar corrida</p>
        </div>
      </div>

      <div className="payment-content">

        {/* ── Saldo ──────────────────────────────────────────────────── */}
        <div style={s.balanceCard}>
          <div style={s.balanceLeft}>
            <div style={s.balanceLabel}>Saldo disponível</div>
            <div style={s.balanceValue}>R$ {(user?.balance ?? 0).toFixed(2)}</div>
            <div style={s.balanceHint}>Usado automaticamente se não houver cartão</div>
          </div>
          <button
            style={s.btnPix}
            onClick={() => { setPixStep('selecting'); setPixError(''); setSelectedAmt(null); setCustomAmt(''); }}
            disabled={pixStep === 'loading'}
          >
            {pixStep === 'loading' ? '...' : '+ Recarregar'}
          </button>
        </div>

        {/* ── Seletor de valor ────────────────────────────────────────── */}
        {(pixStep === 'selecting' || pixStep === 'loading') && (
          <div style={s.pixSelector}>
            <div style={s.pixSelectorTitle}>
              <span>Recarga via Pix</span>
              <button style={s.btnX} onClick={() => setPixStep('idle')}>✕</button>
            </div>

            <div style={s.amountGrid}>
              {RECHARGE_AMOUNTS.map(v => (
                <button
                  key={v}
                  style={{ ...s.amountBtn, ...(selectedAmt === v ? s.amountBtnActive : {}) }}
                  onClick={() => { setSelectedAmt(v); setCustomAmt(''); }}
                >
                  R$ {v}
                </button>
              ))}
            </div>

            <div style={s.customRow}>
              <span style={s.customPrefix}>R$</span>
              <input
                type="number" min="5" max="500"
                placeholder="Outro valor"
                value={customAmt}
                onChange={e => { setCustomAmt(e.target.value); setSelectedAmt(null); }}
                style={s.customInput}
              />
            </div>

            {pixError && <div className="error-msg">{pixError}</div>}

            <div style={s.pixInfo}>
              <span>⚡ Aprovação em minutos</span>
              <span>🏦 Qualquer banco</span>
              <span>🔒 Seguro</span>
            </div>

            <button
              style={s.btnPixConfirm}
              onClick={handleStartPix}
              disabled={pixStep === 'loading' || (!selectedAmt && !customAmt)}
            >
              {pixStep === 'loading' ? 'Gerando cobrança...' : 'Continuar'}
            </button>
          </div>
        )}

        {/* ── Info de preços ──────────────────────────────────────────── */}
        <div className="payment-info-box">
          <div className="pricing-grid">
            <div className="pricing-item">
              <span className="pricing-val">R$ 3,00</span>
              <span className="pricing-lbl">Desbloqueio</span>
            </div>
            <div className="pricing-sep">+</div>
            <div className="pricing-item">
              <span className="pricing-val">R$ 0,50</span>
              <span className="pricing-lbl">Por minuto</span>
            </div>
          </div>
        </div>

        {/* ── Cartão salvo ────────────────────────────────────────────── */}
        {card && !showForm && (
          <div className="saved-card-box">
            <div className="saved-card-header">
              <span>Cartão salvo</span>
              <span className="badge-green">✓ Ativo</span>
            </div>
            <div className="saved-card-body">
              <span style={{ fontSize: 12, fontWeight: 700, background: '#334155', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                {card.brand || 'card'}
              </span>
              <span className="card-number">•••• •••• •••• {card.last4}</span>
              <span className="card-exp">{card.expMonth}/{card.expYear}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn-secondary" onClick={() => setShowForm(true)} style={{ flex: 1 }}>
                🔄 Trocar
              </button>
              <button className="btn-secondary" onClick={handleRemoveCard} disabled={removing}
                style={{ flex: 1, color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                {removing ? 'Removendo...' : '🗑️ Remover'}
              </button>
            </div>
          </div>
        )}

        {!card && !showForm && (
          <div className="no-card-box">
            <span style={{ fontSize: 36 }}>💳</span>
            <h3>Nenhum cartão cadastrado</h3>
            <p>Adicione um cartão para cobrança automática ao encerrar corridas.</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>+ Adicionar cartão</button>
          </div>
        )}

        {showForm && stripePromise && (
          <div className="card-form-section">
            <div className="card-form-header">
              <h3>Novo cartão</h3>
              <button className="btn-icon" onClick={() => setShowForm(false)}
                style={{ width: 32, height: 32, fontSize: 14 }}>✕</button>
            </div>
            <Elements stripe={stripePromise}>
              <CardForm onSuccess={(cardData) => { setCard(cardData); setShowForm(false); showToast('✅ Cartão salvo!'); }} />
            </Elements>
          </div>
        )}

        <div className="security-row">
          <span>🔐 SSL</span>
          <span>🏦 Stripe</span>
          <span>🛡️ PCI DSS</span>
        </div>
      </div>

      <BottomNav active="payment" />
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = {
  balanceCard: {
    background: 'linear-gradient(135deg, #1c1c3a 0%, #0f2027 100%)',
    border: '1px solid rgba(110,231,183,0.25)',
    borderRadius: 16, padding: '16px 18px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  balanceLeft:  { display: 'flex', flexDirection: 'column', gap: 2 },
  balanceLabel: { fontSize: 11, color: '#6EE7B7', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceValue: { fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.2 },
  balanceHint:  { fontSize: 11, color: '#64748B', marginTop: 2 },
  btnPix: {
    background: 'linear-gradient(135deg, #6EE7B7, #6366F1)',
    color: '#fff', border: 'none', borderRadius: 10,
    padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  pixSelector: {
    background: '#1c1c2e', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '16px', marginBottom: 14,
  },
  pixSelectorTitle: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontWeight: 600, fontSize: 15, marginBottom: 14,
  },
  btnX: { background: 'none', border: 'none', color: '#64748B', fontSize: 18, cursor: 'pointer', padding: 0 },
  amountGrid: { display: 'flex', gap: 8, marginBottom: 12 },
  amountBtn: {
    flex: 1, padding: '10px 0', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)', color: '#F1F5F9',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  amountBtnActive: {
    border: '1px solid #6EE7B7', background: 'rgba(110,231,183,0.12)', color: '#6EE7B7',
  },
  customRow: {
    display: 'flex', alignItems: 'center',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, overflow: 'hidden',
    background: 'rgba(255,255,255,0.04)', marginBottom: 12,
  },
  customPrefix: { padding: '0 12px', color: '#64748B', fontSize: 15 },
  customInput: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#F1F5F9', fontSize: 15, padding: '11px 0',
  },
  pixInfo: { display: 'flex', gap: 10, fontSize: 11, color: '#64748B', marginBottom: 14, flexWrap: 'wrap' },
  btnPixConfirm: {
    width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #6EE7B7, #6366F1)',
    color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
  },
};

const pix = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#131320', borderRadius: '20px 20px 0 0',
    padding: '24px 20px 36px', width: '100%', maxWidth: 480,
    maxHeight: '92vh', overflowY: 'auto',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16,
  },
  headerLabel:  { fontSize: 12, color: '#64748B', marginBottom: 2 },
  headerAmount: { fontSize: 28, fontWeight: 700, color: '#6EE7B7' },
  refLabel:     { fontSize: 11, color: '#64748B', textAlign: 'right', marginBottom: 2 },
  refCode:      { fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'monospace', letterSpacing: 1 },
  instrucoes: {
    background: 'rgba(110,231,183,0.07)', border: '1px solid rgba(110,231,183,0.15)',
    borderRadius: 12, padding: '12px 14px', marginBottom: 14,
  },
  keyBox: {
    background: '#0a0a0f', borderRadius: 12, padding: '12px 14px', marginBottom: 10,
  },
  refBox: {
    background: '#0a0a0f', borderRadius: 12, padding: '12px 14px', marginBottom: 14,
  },
  keyMeta: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  keyTypeBadge: {
    background: '#1d4ed8', color: '#fff', fontSize: 10, fontWeight: 700,
    padding: '2px 7px', borderRadius: 4, letterSpacing: 0.5,
  },
  keyBeneficiary: { fontSize: 12, color: '#94A3B8' },
  keyRow: { display: 'flex', alignItems: 'center', gap: 10 },
  keyText: { flex: 1, fontSize: 14, color: '#F1F5F9', wordBreak: 'break-all' },
  btnCopyInline: {
    flexShrink: 0, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.5)',
    background: 'rgba(99,102,241,0.15)', color: '#818CF8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  btnCopied: {
    flexShrink: 0, padding: '6px 14px', borderRadius: 8, border: 'none',
    background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  polling: {
    display: 'flex', alignItems: 'center', gap: 8,
    color: '#64748B', fontSize: 13, marginBottom: 6, justifyContent: 'center',
  },
  dot: {
    width: 8, height: 8, borderRadius: '50%', background: '#6EE7B7', display: 'inline-block',
  },
  btnClose: {
    width: '100%', padding: '12px 0', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent', color: '#94A3B8', fontSize: 14, cursor: 'pointer',
  },
};
