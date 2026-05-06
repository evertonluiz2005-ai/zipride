import { useEffect, useRef } from 'react';

export default function QRScanner({ onResult, onClose }) {
  const mounted = useRef(true);
  const scanner = useRef(null);

  useEffect(() => {
    mounted.current = true;

    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      if (!mounted.current) return;

      scanner.current = new Html5QrcodeScanner(
        'qr-scanner-box',
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0, showTorchButtonIfSupported: true },
        false
      );

      scanner.current.render(
        (text) => {
          if (!mounted.current) return;
          scanner.current.clear().catch(() => {});
          onResult(text.trim());
        },
        () => {}
      );
    }).catch(() => {
      onClose();
    });

    return () => {
      mounted.current = false;
      if (scanner.current) scanner.current.clear().catch(() => {});
    };
  }, []);

  return (
    <div style={s.overlay}>
      <div style={s.sheet}>
        <div style={s.header}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Escanear patinete</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Aponte a câmera para o QR Code no patinete
            </div>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>
        <div id="qr-scanner-box" />
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    zIndex: 2000, display: 'flex', alignItems: 'flex-end',
  },
  sheet: {
    background: '#fff', width: '100%', maxWidth: 480, margin: '0 auto',
    borderRadius: '20px 20px 0 0', padding: '20px 16px 36px',
    maxHeight: '90vh', overflowY: 'auto',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16,
  },
  closeBtn: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, width: 32, height: 32, fontSize: 16,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
