import { useState, useEffect } from 'react';

export default function DateTimePicker({ value, onChange, placeholder, required, type = 'datetime-local', min, max, className }) {
  const [textValue, setTextValue] = useState(formatForText(value, type));

  useEffect(() => {
    setTextValue(formatForText(value, type));
  }, [value, type]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setTextValue(val);
    
    const parsed = parseFromText(val, type);
    if (parsed) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFromText(textValue, type);
    if (!parsed && textValue.trim() !== '') {
      setTextValue(formatForText(value, type));
    } else if (textValue.trim() === '') {
      onChange('');
    }
  };

  const handleNativeChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setTextValue(formatForText(val, type));
  };

  function formatForText(val, type) {
    if (!val) return '';
    if (type === 'date') return val;
    return val.replace('T', ' ');
  }

  function parseFromText(val, type) {
    if (!val) return '';
    if (type === 'date') {
      const match = val.match(/^\d{4}-\d{2}-\d{2}$/);
      if (match) {
        const d = new Date(val);
        return !isNaN(d.getTime()) ? val : null;
      }
      return null;
    }
    const match = val.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    if (match) {
      const d = new Date(val.replace(' ', 'T'));
      return !isNaN(d.getTime()) ? val.replace(' ', 'T') : null;
    }
    return null;
  }

  return (
    <div className={`relative flex items-center bg-transparent border-b border-outline-variant/50 focus-within:border-primary transition-colors ${className || ''}`}>
      <input
        type="text"
        value={textValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder={placeholder || (type === 'date' ? 'YYYY-MM-DD (例如 2026-06-23)' : 'YYYY-MM-DD HH:mm (例如 2026-06-23 12:00)')}
        className="w-full py-4 px-1 text-[16px] text-on-surface outline-none bg-transparent"
        required={required}
      />
      
      <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
        <button 
          type="button" 
          tabIndex={-1}
          className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-primary-container hover:text-primary transition-colors focus:outline-none"
        >
          <span className="material-symbols-outlined text-[20px]">calendar_month</span>
        </button>
        <input
          type={type}
          value={value || ''}
          onChange={handleNativeChange}
          min={min}
          max={max}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          tabIndex={-1}
          title="選擇日期"
        />
      </div>
    </div>
  );
}
