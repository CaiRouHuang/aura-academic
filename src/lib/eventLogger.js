import { mirrorUpsert, REMOTE_TABLES } from './remoteData';

/* ================================================================
   RESEARCH EVENT LOGGER
   Captures structured research events for computational analysis.
   Events are stored in localStorage and output to console.

   Event Types:
   - upload_event         : Student uploads a file
   - ai_eval_event        : AI completes evaluation
   - student_response     : Student responds to AI feedback
   - teacher_eval_event   : Teacher submits voice/score evaluation
   - checkpoint_summary   : Auto-generated per-checkpoint summary
   - system_log           : Login, logout, errors, deadlines
   ================================================================ */

const RESEARCH_EVENTS_KEY = 'aura_research_events';

// ── Styled console output colors ──
const CONSOLE_STYLES = {
  upload_event:       'background:#1a73e8;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold',
  ai_eval_event:      'background:#9c27b0;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold',
  student_response:   'background:#00897b;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold',
  teacher_eval_event: 'background:#e65100;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold',
  checkpoint_summary: 'background:#2e7d32;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold',
  srl_probe_response: 'background:#00695c;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold',
  system_log:         'background:#546e7a;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold',
};

const LABEL = {
  upload_event:       '📤 UPLOAD',
  ai_eval_event:      '🤖 AI EVAL',
  student_response:   '✍️ STUDENT RESPONSE',
  teacher_eval_event: '🎓 TEACHER EVAL',
  checkpoint_summary: '📊 CP SUMMARY',
  system_log:         '⚙️ SYSTEM',
};

// ── Core Helpers ──

function generateEventId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getAllEvents() {
  try {
    const raw = localStorage.getItem(RESEARCH_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAllEvents(events) {
  localStorage.setItem(RESEARCH_EVENTS_KEY, JSON.stringify(events));
  window.dispatchEvent(new CustomEvent('aura_research_event', { detail: { count: events.length } }));
}

function pushEvent(eventType, data) {
  const event = {
    event_id: generateEventId(),
    event_type: eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  const events = getAllEvents();
  events.push(event);
  saveAllEvents(events);
  mirrorUpsert(REMOTE_TABLES.RESEARCH_EVENTS, event, 'event_id', 'research event');

  // Console output
  printToConsole(event);

  return event;
}

function printToConsole(event) {
  const style = CONSOLE_STYLES[event.event_type] || CONSOLE_STYLES.system_log;
  const label = LABEL[event.event_type] || event.event_type;
  const time = new Date(event.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  console.groupCollapsed(`%c${label}%c @ ${time}  (id: ${event.event_id.slice(0, 8)}…)`, style, 'color:#888;font-weight:normal');
  console.table(flattenForTable(event.data));
  console.log('Raw data:', event.data);
  console.groupEnd();
}

/**
 * Flatten nested object for console.table display.
 * Arrays are joined as strings, objects are JSON-stringified.
 */
function flattenForTable(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      result[key] = value.length <= 5 ? value.join(', ') : `[${value.length} items]`;
    } else if (value !== null && typeof value === 'object') {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}


/* ================================================================
   EVENT RECORDING FUNCTIONS
   ================================================================ */

/**
 * 1. Upload Event — called when student uploads a file
 */
export function logUploadEvent({
  project_id = null,
  project_title = '',
  student_id,
  group_id = null,
  checkpoint_id,
  checkpoint_title = '',
  version_number,
  file_type,
  file_count = null,
  file_names = [],
  file_details = [],
  description_length = 0,
  days_before_deadline = null,
  document_analysis_latency_ms = null,
  frontend_latency_ms = null,
  skipped_preview_files = [],
  text_extraction_summary = [],
  pdf_analysis = null,
  docx_analysis = null,
  input_snapshot = null,
  processing_output = null,
}) {
  return pushEvent('upload_event', {
    project_id,
    project_title,
    student_id,
    group_id,
    checkpoint_id,
    checkpoint_title,
    version_number,
    file_type,
    file_count: file_count ?? file_names.length,
    file_names,
    file_details,
    description_length,
    days_before_deadline: days_before_deadline !== null ? Math.round(days_before_deadline * 100) / 100 : null,
    document_analysis_latency_ms,
    frontend_latency_ms: frontend_latency_ms ?? document_analysis_latency_ms,
    skipped_preview_files,
    text_extraction_summary,
    pdf_analysis,
    docx_analysis,
    input_snapshot,
    processing_output,
  });
}

/**
 * 2. AI Evaluation Event — called when AI returns analysis
 */
export function logAIEvalEvent({
  linked_upload_event_id = null,
  project_id = null,
  project_title = '',
  submission_id,
  checkpoint_id,
  checkpoint_title = '',
  student_id,
  completion_rate,
  completion_delta = null,
  status_label,
  feedback_text = '',
  feedback_word_count = 0,
  flagged_missing_items = [],
  eval_latency_ms = null,
  document_analysis_latency_ms = null,
  frontend_latency_ms = null,
  total_flow_latency_ms = null,
  ai_input_summary = null,
  ai_output_summary = null,
  full_ai_response = null,
  prompt_context = null,
}) {
  return pushEvent('ai_eval_event', {
    linked_upload_event_id,
    project_id,
    project_title,
    submission_id,
    checkpoint_id,
    checkpoint_title,
    student_id,
    completion_rate,
    completion_delta,
    status_label,
    eval_latency_ms,
    document_analysis_latency_ms,
    frontend_latency_ms,
    total_flow_latency_ms,
    ai_input_summary,
    ai_output_summary,
    feedback_text,
    feedback_word_count: feedback_word_count || (feedback_text ? feedback_text.length : 0),
    flagged_missing_items,
    full_ai_response,
    prompt_context,
  });
}

/**
 * 3. Student Response Event — called when student resubmits after AI feedback
 */
export function logStudentResponseEvent({
  project_id = null,
  project_title = '',
  submission_id = null,
  student_id,
  checkpoint_id,
  checkpoint_title = '',
  version_number = null,
  file_names = [],
  file_details = [],
  description = '',
  description_length = null,
  time_to_resubmit_seconds = null,
  resubmitted = true,
}) {
  return pushEvent('student_response', {
    project_id,
    project_title,
    submission_id,
    student_id,
    checkpoint_id,
    checkpoint_title,
    version_number,
    file_names,
    file_details,
    description,
    description_length: description_length ?? description.length,
    time_to_resubmit_seconds,
    resubmitted,
  });
}

/**
 * 4. Teacher Voice Evaluation Event — called when teacher submits scores
 */
export function logTeacherEvalEvent({
  student_id,
  checkpoint_id = null,
  project_id,
  teacher_id,
  voice_duration_sec = null,
  transcript_text = '',
  score_dimensions = {},
  final_weighted_score = null,
  ai_completion_rate = null,
  ai_human_score_delta = null,
}) {
  return pushEvent('teacher_eval_event', {
    student_id,
    checkpoint_id,
    project_id,
    teacher_id,
    voice_duration_sec,
    transcript_text,
    score_dimensions,
    final_weighted_score,
    ai_completion_rate,
    ai_human_score_delta,
  });
}

/**
 * 5. Checkpoint Summary Record — auto-generated when checkpoint completes
 */
export function logCheckpointSummary({
  student_id,
  checkpoint_id,
  total_upload_count,
  first_upload_timestamp = null,
  last_upload_timestamp = null,
  total_time_spent_hours = null,
  completion_rate_start = null,
  completion_rate_end = null,
  completion_rate_trajectory = [],
  max_completion_delta = null,
  stagnation_count = 0,
}) {
  return pushEvent('checkpoint_summary', {
    student_id,
    checkpoint_id,
    total_upload_count,
    first_upload_timestamp,
    last_upload_timestamp,
    total_time_spent_hours,
    completion_rate_start,
    completion_rate_end,
    completion_rate_trajectory,
    max_completion_delta,
    stagnation_count,
  });
}

/**
 * 6. System Log Event — login, logout, errors, deadline_missed
 */
export function logSrlProbeResponse({
  probe_key,
  prompt = '',
  participant_code,
  user_id = null,
  project_id = null,
  checkpoint_id = null,
  submission_id = null,
  rating = null,
  response_text = '',
  response_id = null,
  max_length = null,
  form_url = null,
}) {
  return pushEvent('srl_probe_response', {
    probe_key,
    prompt,
    participant_code,
    user_id,
    project_id,
    checkpoint_id,
    submission_id,
    rating,
    response_text,
    response_id,
    response_length: response_text ? response_text.length : 0,
    max_length,
    form_url,
  });
}

export function logSystemEvent({
  event_subtype,  // 'login' | 'logout' | 'error' | 'deadline_missed' | 'project_created' | 'checkpoint_generated'
  student_id = null,
  detail = '',
  metadata = {},
}) {
  return pushEvent('system_log', {
    event_subtype,
    student_id,
    detail,
    ...metadata,
  });
}


/* ================================================================
   QUERY & EXPORT FUNCTIONS
   ================================================================ */

/**
 * Get all research events
 */
export function getResearchEvents() {
  return getAllEvents();
}

/**
 * Get events filtered by type
 */
export function getEventsByType(eventType) {
  return getAllEvents().filter(e => e.event_type === eventType);
}

/**
 * Get events filtered by checkpoint ID
 */
export function getEventsByCheckpoint(checkpointId) {
  return getAllEvents().filter(e => e.data?.checkpoint_id === checkpointId);
}

/**
 * Get completion rate trajectory for a student + checkpoint
 * Returns an array of { version, completion_rate, timestamp }
 */
export function getCompletionTrajectory(studentId, checkpointId) {
  return getAllEvents()
    .filter(e =>
      e.event_type === 'ai_eval_event' &&
      e.data.student_id === studentId &&
      e.data.checkpoint_id === checkpointId
    )
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((e, i) => ({
      version: i + 1,
      completion_rate: e.data.completion_rate,
      timestamp: e.timestamp,
    }));
}

/**
 * Get event count summary by type
 */
export function getEventSummary() {
  const events = getAllEvents();
  const summary = {};
  for (const e of events) {
    summary[e.event_type] = (summary[e.event_type] || 0) + 1;
  }
  summary._total = events.length;
  return summary;
}

/**
 * Export all events as a downloadable JSON file
 */
export function exportEventsAsJSON() {
  const events = getAllEvents();
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `aura_research_events_${dateStamp()}.json`);
  return events.length;
}

/**
 * Export all events as a downloadable CSV file (flattened)
 */
export function exportEventsAsCSV() {
  const events = getAllEvents();
  if (events.length === 0) return 0;

  // Collect all unique data keys across all events
  const dataKeys = new Set();
  events.forEach(e => {
    Object.keys(e.data || {}).forEach(k => dataKeys.add(k));
  });

  const headers = ['event_id', 'event_type', 'timestamp', ...Array.from(dataKeys)];
  
  // BOM for UTF-8 Excel compatibility
  const BOM = '\uFEFF';
  const rows = events.map(e => {
    return headers.map(h => {
      let val;
      if (h === 'event_id' || h === 'event_type' || h === 'timestamp') {
        val = e[h];
      } else {
        val = e.data?.[h];
      }

      if (val === null || val === undefined) return '';
      if (Array.isArray(val)) return `"${val.join('; ')}"`;
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return String(val);
    }).join(',');
  });

  const csv = BOM + headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `aura_research_events_${dateStamp()}.csv`);
  return events.length;
}

/**
 * Clear all research events
 */
export function clearAllEvents() {
  localStorage.removeItem(RESEARCH_EVENTS_KEY);
  window.dispatchEvent(new CustomEvent('aura_research_event', { detail: { count: 0 } }));
  console.log('%c[AURA-LOG] All research events cleared.', 'color:#e53935;font-weight:bold');
}


/* ── Internal Helpers ── */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
