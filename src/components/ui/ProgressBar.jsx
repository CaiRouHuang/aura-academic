import { useEffect, useRef } from 'react';

export default function ProgressBar({ value = 0, className = '', animated = true }) {
  const barRef = useRef(null);

  useEffect(() => {
    if (animated && barRef.current) {
      requestAnimationFrame(() => {
        barRef.current.style.width = `${Math.min(100, Math.max(0, value))}%`;
      });
    }
  }, [value, animated]);

  return (
    <div className={`h-1.5 w-full bg-surface-variant rounded-full overflow-hidden ${className}`}>
      <div
        ref={barRef}
        className="h-full gradient-bar rounded-full progress-fill"
        style={animated ? { width: 0 } : { width: `${value}%` }}
      />
    </div>
  );
}
