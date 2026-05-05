export default function LgpdModal({ onAccept, onReject }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.title}>Termos de Uso e Privacidade</h3>
        <div style={styles.body}>
          <p style={styles.intro}>
            Para usar o <strong>ZipRide</strong> você precisa concordar com nossa Política de
            Privacidade, em conformidade com a <strong>LGPD (Lei nº 13.709/2018)</strong>.
          </p>

          <h4 style={styles.section}>Dados coletados e finalidades</h4>
          <ul style={styles.list}>
            <li><strong>Nome e e-mail</strong> — identificação na plataforma</li>
            <li><strong>CPF</strong> — exigido para serviços de micromobilidade urbana (obrigação legal)</li>
            <li><strong>Localização GPS</strong> — somente durante corridas ativas, para registro de trajeto e cobrança</li>
            <li><strong>Dados de pagamento</strong> — processados com segurança pelo Stripe; não armazenamos dados do cartão</li>
          </ul>

          <h4 style={styles.section}>Base legal</h4>
          <p style={styles.text}>
            Execução de contrato (Art. 7º, V) e cumprimento de obrigação legal (Art. 7º, II) da LGPD.
          </p>

          <h4 style={styles.section}>Seus direitos</h4>
          <p style={styles.text}>
            Você pode a qualquer momento solicitar acesso, correção, portabilidade ou exclusão dos seus
            dados pelo e-mail <strong>privacidade@zipride.com.br</strong>.
          </p>

          <h4 style={styles.section}>Retenção</h4>
          <p style={styles.text}>
            Dados mantidos enquanto a conta estiver ativa ou conforme exigência legal.
          </p>
        </div>
        <div style={styles.actions}>
          <button style={styles.btnReject} onClick={onReject}>Recusar</button>
          <button style={styles.btnAccept} onClick={onAccept}>Li e aceito</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 1000, padding: '0 0 0 0',
  },
  modal: {
    background: '#1e1e1e', borderRadius: '20px 20px 0 0',
    padding: '24px 20px 32px', width: '100%', maxWidth: 480,
    maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 0,
  },
  title: {
    margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#fff',
  },
  body: {
    overflowY: 'auto', flex: 1, paddingRight: 4,
  },
  intro: {
    color: '#ccc', fontSize: 14, lineHeight: 1.5, marginBottom: 12,
  },
  section: {
    color: '#fff', fontSize: 13, fontWeight: 600, margin: '12px 0 4px',
  },
  list: {
    color: '#ccc', fontSize: 13, lineHeight: 1.7, paddingLeft: 20, margin: 0,
  },
  text: {
    color: '#ccc', fontSize: 13, lineHeight: 1.5, margin: 0,
  },
  actions: {
    display: 'flex', gap: 12, marginTop: 20,
  },
  btnReject: {
    flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #444',
    background: 'transparent', color: '#aaa', fontSize: 15, cursor: 'pointer',
  },
  btnAccept: {
    flex: 2, padding: '12px 0', borderRadius: 10, border: 'none',
    background: 'var(--primary, #6C63FF)', color: '#fff', fontSize: 15,
    fontWeight: 600, cursor: 'pointer',
  },
};
