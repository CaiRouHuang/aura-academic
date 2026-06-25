import { useState, useEffect, useCallback } from 'react';
import {
  getResearchEvents,
  getEventSummary,
  exportEventsAsJSON,
  exportEventsAsCSV,
  clearAllEvents,
} from '../../lib/eventLogger';

const EVENT_TYPE_LABELS = {
  upload_event: { label: '📤 Upload', color: '#1a73e8' },
  ai_eval_event: { label: '🤖 AI Eval', color: '#9c27b0' },
  student_response: { label: '✍️ Response', color: '#00897b' },
  teacher_eval_event: { label: '🎓 Teacher', color: '#e65100' },
  checkpoint_summary: { label: '📊 Summary', color: '#2e7d32' },
  system_log: { label: '⚙️ System', color: '#546e7a' },
};

export default function ResearchLogPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({});
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const refresh = useCallback(() => {
    setEvents(getResearchEvents());
    setSummary(getEventSummary());
  }, []);

  // Listen for new research events
  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('aura_research_event', handler);
    return () => window.removeEventListener('aura_research_event', handler);
  }, [refresh]);

  // Also refresh when panel opens
  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

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
      <div style={{
        width: '100%',
        minHeight: '400px',
        maxHeight: '600px',
        background: '#1e1e2e',
        borderRadius: '16px',
        boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Inter', 'SF Mono', monospace",
        color: '#e0e0e0',
      }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#c4b5fd' }}>
                🔬 Research Event Logger
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                {summary._total || 0} events recorded
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <PanelButton onClick={handleExportJSON} title="Export JSON">JSON</PanelButton>
              <PanelButton onClick={handleExportCSV} title="Export CSV">CSV</PanelButton>
              <PanelButton onClick={handleClear} title="Clear all" danger>🗑</PanelButton>
            </div>
          </div>

          {/* Stats Bar */}
          <div style={{
            padding: '10px 20px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            borderBottom: '1px solid #333',
          }}>
            <FilterChip
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              color="#888"
            >
              All ({summary._total || 0})
            </FilterChip>
            {Object.entries(EVENT_TYPE_LABELS).map(([type, { label, color }]) => (
              <FilterChip
                key={type}
                active={filter === type}
                onClick={() => setFilter(type)}
                color={color}
              >
                {label} ({summary[type] || 0})
              </FilterChip>
            ))}
          </div>

          {/* Event List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 12px',
          }}>
            {reversedFiltered.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#666',
                fontSize: '13px',
              }}>
                No events recorded yet.
                <br />
                <span style={{ fontSize: '11px' }}>
                  Events will appear here as you use the system.
                </span>
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
      style={{
        padding: '4px 10px',
        borderRadius: '8px',
        border: `1px solid ${danger ? '#ef4444' : '#444'}`,
        background: danger ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
        color: danger ? '#ef4444' : '#ccc',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)'; }}
    >
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        borderRadius: '999px',
        border: `1px solid ${active ? color : '#444'}`,
        background: active ? `${color}22` : 'transparent',
        color: active ? color : '#888',
        fontSize: '11px',
        fontWeight: active ? 700 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function EventRow({ event, expanded, onToggle }) {
  const typeInfo = EVENT_TYPE_LABELS[event.event_type] || { label: event.event_type, color: '#888' };
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
      style={{
        marginBottom: '4px',
        borderRadius: '10px',
        background: expanded ? '#2a2a3e' : 'transparent',
        border: expanded ? `1px solid ${typeInfo.color}33` : '1px solid transparent',
        transition: 'all 0.15s',
        cursor: 'pointer',
      }}
      onClick={onToggle}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = '#252535'; }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Row Header */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        {/* Type Badge */}
        <span style={{
          background: `${typeInfo.color}22`,
          color: typeInfo.color,
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          border: `1px solid ${typeInfo.color}44`,
        }}>
          {typeInfo.label}
        </span>

        {/* Brief */}
        <span style={{
          flex: 1,
          fontSize: '12px',
          color: '#bbb',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {brief}
        </span>

        {/* Time */}
        <span style={{ fontSize: '10px', color: '#666', whiteSpace: 'nowrap' }}>
          {date} {time}
        </span>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div style={{
          padding: '4px 12px 12px',
          fontSize: '11px',
          lineHeight: '1.6',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {Object.entries(event.data).map(([key, value]) => (
                <tr key={key}>
                  <td style={{
                    padding: '3px 8px 3px 0',
                    color: '#888',
                    verticalAlign: 'top',
                    whiteSpace: 'nowrap',
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    fontSize: '10px',
                  }}>
                    {key}
                  </td>
                  <td style={{
                    padding: '3px 0',
                    color: '#ddd',
                    wordBreak: 'break-all',
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    fontSize: '10px',
                  }}>
                    {formatValue(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '6px', fontSize: '10px', color: '#555' }}>
            ID: {event.event_id}
          </div>
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
      return d.resubmitted ? `resubmitted (${d.time_to_resubmit_hours ?? '?'}h)` : 'no resubmit';
    case 'teacher_eval_event':
      return `score: ${d.final_weighted_score ?? '?'} | delta: ${d.ai_human_score_delta ?? '?'}`;
    case 'checkpoint_summary':
      return `${d.total_upload_count || 0} uploads, ${d.completion_rate_start ?? '?'}→${d.completion_rate_end ?? '?'}%`;
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
