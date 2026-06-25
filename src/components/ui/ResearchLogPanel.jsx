import { useState, useEffect, useCallback } from 'react';
import {
  getResearchEvents,
  getEventSummary,
  exportEventsAsJSON,
  exportEventsAsCSV,
  clearAllEvents,
} from '../../lib/eventLogger';

const EVENT_TYPE_LABELS = {
  upload_event: { label: '📤 Upload', color: 'text-primary bg-primary-container/30 border-primary/20' },
  ai_eval_event: { label: '🤖 AI Eval', color: 'text-secondary bg-secondary-container/30 border-secondary/20' },
  student_response: { label: '✍️ Response', color: 'text-tertiary bg-tertiary-container/30 border-tertiary/20' },
  teacher_eval_event: { label: '🎓 Teacher', color: 'text-error bg-error-container/30 border-error/20' },
  checkpoint_summary: { label: '📊 Summary', color: 'text-status-pass bg-status-pass-bg border-status-pass/20' },
  system_log: { label: '⚙️ System', color: 'text-on-surface-variant bg-surface-variant/50 border-outline-variant/30' },
};

export default function ResearchLogPanel() {
  const [events, setEvents] = useState(() => getResearchEvents());
  const [summary, setSummary] = useState(() => getEventSummary());
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const refresh = useCallback(() => {
    setEvents(getResearchEvents());
    setSummary(getEventSummary());
  }, []);

  // Listen for new research events
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('aura_research_event', handler);
    return () => window.removeEventListener('aura_research_event', handler);
  }, [refresh]);

  const filtered = filter === 'all'
    ? events
    : events.filter(e => e.event_type === filter);

  const reversedFiltered = [...filtered].reverse(); // newest first

  const handleExportJSON = () => {
    const count = exportEventsAsJSON();
    alert(`Exported ${count} events as JSON`);
  };

  const handleExportCSV = () => {
    const count = exportEventsAsCSV();
    alert(`Exported ${count} events as CSV`);
  };

  const handleClear = () => {
    if (window.confirm('Clear all research events? This cannot be undone.')) {
      clearAllEvents();
      refresh();
    }
  };

  return (
      <div className="w-full flex flex-col h-[70vh] min-h-[500px] bg-surface-container-lowest border border-outline-variant/30 rounded-[20px] shadow-sm overflow-hidden font-mono">
          {/* Header */}
          <div className="px-5 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container/30">
            <div>
              <div className="text-[14px] font-bold text-primary flex items-center gap-2 font-sans">
                <span className="material-symbols-outlined text-[18px]">manage_search</span>
                Research Event Logger
              </div>
              <div className="text-[12px] text-on-surface-variant mt-0.5 font-sans">
                {summary._total || 0} events recorded
              </div>
            </div>
            <div className="flex gap-2">
              <PanelButton onClick={handleExportJSON} title="Export JSON">JSON</PanelButton>
              <PanelButton onClick={handleExportCSV} title="Export CSV">CSV</PanelButton>
              <PanelButton onClick={handleClear} title="Clear all" danger>Clear</PanelButton>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="px-4 py-3 border-b border-outline-variant/30 flex gap-2 flex-wrap bg-surface-container-lowest">
            <FilterChip
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              baseClass="text-on-surface-variant bg-surface-variant/30 border-outline-variant/30 hover:bg-surface-variant/50"
              activeClass="text-primary bg-primary-container/30 border-primary/40 font-bold"
            >
              All ({summary._total || 0})
            </FilterChip>
            {Object.entries(EVENT_TYPE_LABELS).map(([type, { label, color }]) => (
              <FilterChip
                key={type}
                active={filter === type}
                onClick={() => setFilter(type)}
                baseClass="text-on-surface-variant bg-surface-variant/30 border-outline-variant/30 hover:bg-surface-variant/50"
                activeClass={`${color} font-bold`}
              >
                {label} ({summary[type] || 0})
              </FilterChip>
            ))}
          </div>

          {/* Event List */}
          <div className="flex-1 overflow-y-auto p-3 bg-surface-container-lowest/50">
            {reversedFiltered.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant font-sans">
                <div className="text-[14px] font-medium mb-1">No events recorded yet.</div>
                <div className="text-[12px] opacity-70">Events will appear here as you use the system.</div>
              </div>
            ) : (
              reversedFiltered.slice(0, 100).map(event => (
                <EventRow
                  key={event.event_id}
                  event={event}
                  expanded={expandedId === event.event_id}
                  onToggle={() => setExpandedId(expandedId === event.event_id ? null : event.event_id)}
                />
              ))
            )}
          </div>
      </div>
  );
}

/* ── Sub-components ── */

function PanelButton({ onClick, title, children, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-colors font-sans ${
        danger 
          ? 'border-error/30 text-error hover:bg-error-container/30' 
          : 'border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
      }`}
    >
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, baseClass, activeClass, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[12px] border transition-all whitespace-nowrap font-sans ${
        active ? activeClass : baseClass
      }`}
    >
      {children}
    </button>
  );
}

function EventRow({ event, expanded, onToggle }) {
  const typeInfo = EVENT_TYPE_LABELS[event.event_type] || { label: event.event_type, color: 'text-on-surface-variant bg-surface-variant/30 border-outline-variant/30' };
  const time = new Date(event.timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const date = new Date(event.timestamp).toLocaleDateString('en-GB', {
    month: 'short', day: 'numeric',
  });

  // Pick a brief summary from the data
  const brief = getBrief(event);

  return (
    <div
      className={`mb-2 rounded-xl transition-all border cursor-pointer ${
        expanded 
          ? 'bg-surface-container border-outline-variant shadow-sm' 
          : 'bg-transparent border-transparent hover:bg-surface-container-low'
      }`}
      onClick={onToggle}
    >
      {/* Row Header */}
      <div className="px-3 py-2.5 flex items-center gap-3">
        {/* Type Badge */}
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap border font-sans ${typeInfo.color}`}>
          {typeInfo.label}
        </span>

        {/* Brief */}
        <span className="flex-1 text-[13px] text-on-surface truncate">
          {brief}
        </span>

        {/* Time */}
        <span className="text-[11px] text-on-surface-variant whitespace-nowrap font-sans">
          {date} {time}
        </span>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-4 text-[12px] leading-relaxed cursor-default" onClick={e => e.stopPropagation()}>
          <table className="w-full border-collapse">
            <tbody>
              {Object.entries(event.data).map(([key, value]) => (
                <tr key={key} className="border-t border-outline-variant/20 last:border-0">
                  <td className="py-2 pr-3 text-on-surface-variant align-top whitespace-nowrap">
                    {key}
                  </td>
                  <td className="py-2 text-on-surface break-all">
                    {formatValue(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 pt-3 border-t border-outline-variant/30 text-[11px] text-on-surface-variant font-sans flex items-center justify-between">
            <span>ID: <span className="font-mono text-[10px]">{event.event_id}</span></span>
          </div>
          <details className="mt-3 border-t border-outline-variant/30 pt-3">
            <summary className="text-[11px] text-on-surface-variant font-sans cursor-pointer select-none">
              Raw event JSON
            </summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-surface-container-high p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
              {JSON.stringify(event, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

/** Extract a brief summary from event data */
function getBrief(event) {
  const d = event.data;
  switch (event.event_type) {
    case 'upload_event':
      return `v${d.version_number || '?'} → ${d.checkpoint_id || ''}`;
    case 'ai_eval_event':
      return `${d.completion_rate ?? '?'}% ${d.status_label || ''} (Δ${d.completion_delta ?? '?'})`;
    case 'student_response':
      return d.resubmitted
        ? `resubmitted (${d.time_to_resubmit_seconds ?? d.time_to_resubmit_hours ?? '?'}s)`
        : 'initial submit';
    case 'teacher_eval_event':
      return `score: ${d.final_weighted_score ?? '?'} | delta: ${d.ai_human_score_delta ?? '?'}`;
    case 'checkpoint_summary':
      return `${d.total_upload_count || 0} uploads, ${d.completion_rate_start ?? '?'}→${d.completion_rate_end ?? '?'}%`;
    case 'srl_probe_response':
      return `${d.probe_key || 'probe'}: ${d.rating ?? d.response_text ?? ''}`;
    case 'system_log':
      return `[${d.event_subtype || '?'}] ${d.detail || ''}`;
    default:
      return '';
  }
}

/** Format a value for display in the detail table */
function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[${value.join(', ')}]`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  return String(value);
}
