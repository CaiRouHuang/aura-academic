import { useNavigate } from 'react-router-dom';

export default function TopBar({ title, showBack = false }) {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-[var(--spacing-page)] h-[72px] min-h-[72px] glass-nav border-b border-outline-variant/20">
      {showBack ? (
        <button
          onClick={() => navigate(-1)}
          className="text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 flex items-center justify-center w-10 h-10 rounded-full"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
      ) : (
        <button className="text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 flex items-center justify-center w-10 h-10 rounded-full">
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
      )}

      <div className="text-center flex-1">
        <h1 className="text-[20px] font-bold text-brand-gradient">
          {title || 'NAVI'}
        </h1>
      </div>

      <button
        onClick={() => navigate('/profile')}
        className="w-10 h-10 rounded-full overflow-hidden hover:opacity-80 transition-opacity active:scale-95 border border-white/80 shadow-[0_8px_24px_rgba(87,56,120,0.08)]"
      >
        <div className="w-full h-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm">
          Y
        </div>
      </button>
    </header>
  );
}
