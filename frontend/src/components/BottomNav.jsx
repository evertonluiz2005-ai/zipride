import { useNavigate } from 'react-router-dom';

export default function BottomNav({ active }) {
  const navigate = useNavigate();
  const items = [
    { key: 'explore', icon: '🛴', label: 'Explorar',  path: '/map' },
    { key: 'payment', icon: '💳', label: 'Pagamento', path: '/payment' },
    { key: 'history', icon: '📋', label: 'Histórico', path: '/history' },
  ];
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.key}
          className={`nav-item ${active === item.key ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
