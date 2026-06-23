export default function GlassCard({ children, className = '', hover = false, onClick }) {
  return (
    <div
      className={`glass-card rounded-[28px] p-6 ${hover ? 'hover-lift cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
