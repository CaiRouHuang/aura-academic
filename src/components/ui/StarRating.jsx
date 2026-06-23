import { useState } from 'react';

export default function StarRating({ value = 0, onChange, maxStars = 5, size = 'md' }) {
  const [hovered, setHovered] = useState(0);
  const sizeClass = size === 'lg' ? 'text-[32px]' : 'text-[28px]';

  return (
    <div className="star-rating flex items-center gap-0.5" onMouseLeave={() => setHovered(0)}>
      {Array.from({ length: maxStars }, (_, i) => {
        const starValue = i + 1;
        const isActive = starValue <= (hovered || value);

        return (
          <button
            key={i}
            type="button"
            className={`star ${isActive ? 'active' : 'inactive'} ${sizeClass} transition-all`}
            onClick={() => onChange?.(starValue)}
            onMouseEnter={() => setHovered(starValue)}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              star
            </span>
          </button>
        );
      })}
    </div>
  );
}
