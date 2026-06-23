import { logoutExperimentAccount } from './authService';
import { hydrateRemoteDataToLocal, mirrorPatch, mirrorSaveSettings, mirrorUpsert, REMOTE_TABLES } from './remoteData';

/* ================================================================
   LOCAL STORAGE DATA SERVICE
   Demo mode: all data persisted in localStorage
   ================================================================ */

// Lazy import to avoid circular dependency — eventLogger also imports from store
let _logSystemEvent = null;
function getLogSystemEvent() {
  if (!_logSystemEvent) {
    import('./eventLogger').then(mod => { _logSystemEvent = mod.logSystemEvent; });
  }
  return _logSystemEvent;
}

const STORAGE_KEYS = {
  PROJECTS: 'aura_projects',
  CHECKPOINTS: 'aura_checkpoints',
  SUBMISSIONS: 'aura_submissions',
  AI_REVIEWS: 'aura_ai_reviews',
  SCORING_SESSIONS: 'aura_scoring_sessions',
  SCORE_ENTRIES: 'aura_score_entries',
  ACTIVITY_LOGS: 'aura_activity_logs',
  CURRENT_USER: 'aura_current_user',
  SETTINGS: 'aura_settings',
  ASSIGNMENTS: 'aura_assignments',
  CONSENTS: 'aura_consents',
  SRL_PROBES: 'aura_srl_probe_responses',
};

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getStore(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setStore(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    if (error?.name === 'QuotaExceededError' || error?.code === 22) {
      throw new Error(`Browser storage is full while saving ${key}. Please remove older submissions or use a smaller file.`, { cause: error });
    }
    throw error;
  }
  // Dispatch a custom event so same-tab listeners can react to changes
  window.dispatchEvent(new CustomEvent('aura_storage_change', { detail: { key } }));
}

export async function hydrateRemoteData() {
  return hydrateRemoteDataToLocal();
}

export function getCurrentParticipantCode() {
  const user = getCurrentUser();
  return user?.participant_code || user?.id || 'demo-student';
}

/* ── Assignments ───────────────────────────────── */
export function getAssignments() {
  const user = getCurrentUser();
  return getStore(STORAGE_KEYS.ASSIGNMENTS)
    .map(a => ({ visibility: 'all', ...a }))
    .filter(a => a.visibility === 'all' || a.teacher_id === user?.id);
}

export function getAssignment(id) {
  return getAssignments().find(a => a.id === id);
}

export function getAssignmentsByTeacher(teacherId) {
  return getAssignments().filter(a => a.teacher_id === teacherId);
}

export function createAssignment(data) {
  const assignments = getStore(STORAGE_KEYS.ASSIGNMENTS);
  const assignment = {
    id: generateId(),
    visibility: 'all',
    ...data,
    created_at: new Date().toISOString(),
  };
  assignments.push(assignment);
  setStore(STORAGE_KEYS.ASSIGNMENTS, assignments);
  mirrorUpsert(REMOTE_TABLES.ASSIGNMENTS, assignment, 'id', 'assignment create');
  return assignment;
}

export function updateAssignment(id, updates) {
  const assignments = getAssignments();
  const idx = assignments.findIndex(a => a.id === id);
  if (idx >= 0) {
    assignments[idx] = { ...assignments[idx], ...updates };
    setStore(STORAGE_KEYS.ASSIGNMENTS, assignments);
    mirrorPatch(REMOTE_TABLES.ASSIGNMENTS, id, updates, 'assignment update');
    return assignments[idx];
  }
  return null;
}

/* ── Projects ──────────────────────────────────── */
export function getProjects() {
  const projects = getStore(STORAGE_KEYS.PROJECTS);
  const user = getCurrentUser();
  if (!user || user.role !== 'student') return projects;
  const participantCode = getCurrentParticipantCode();
  return projects.filter(project =>
    project.created_by === participantCode ||
    project.created_by === user.id ||
    project.created_by === 'demo-student'
  );
}

export function getProject(id) {
  return getProjects().find(p => p.id === id);
}

export function createProject(data) {
  const projects = getProjects();
  const project = {
    id: generateId(),
    ...data,
    status: 'draft',
    created_at: new Date().toISOString(),
  };
  projects.push(project);
  setStore(STORAGE_KEYS.PROJECTS, projects);
  mirrorUpsert(REMOTE_TABLES.PROJECTS, project, 'id', 'project create');
  addLog(project.id, 'create', 'プロジェクトが作成されました');
  return project;
}

export function updateProject(id, updates) {
  const projects = getProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx >= 0) {
    projects[idx] = { ...projects[idx], ...updates };
    setStore(STORAGE_KEYS.PROJECTS, projects);
    mirrorPatch(REMOTE_TABLES.PROJECTS, id, updates, 'project update');
    return projects[idx];
  }
  return null;
}

/* ── Checkpoints ───────────────────────────────── */
export function getCheckpoints(projectId) {
  return getStore(STORAGE_KEYS.CHECKPOINTS)
    .filter(c => c.project_id === projectId)
    .sort((a, b) => a.order_index - b.order_index);
}

export function getCheckpoint(id) {
  return getStore(STORAGE_KEYS.CHECKPOINTS).find(c => c.id === id);
}

export function createCheckpoints(projectId, checkpointsData) {
  const all = getStore(STORAGE_KEYS.CHECKPOINTS);
  const newCheckpoints = checkpointsData.map((cp, i) => ({
    id: generateId(),
    project_id: projectId,
    order_index: i + 1,
    status: 'pending',
    ...cp,
    criteria: cp.criteria || [], // ensuring criteria is saved
  }));
  all.push(...newCheckpoints);
  setStore(STORAGE_KEYS.CHECKPOINTS, all);
  newCheckpoints.forEach(checkpoint => {
    mirrorUpsert(REMOTE_TABLES.CHECKPOINTS, checkpoint, 'id', 'checkpoint create');
  });
  return newCheckpoints;
}

export function updateCheckpoint(id, updates) {
  const all = getStore(STORAGE_KEYS.CHECKPOINTS);
  const idx = all.findIndex(c => c.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    setStore(STORAGE_KEYS.CHECKPOINTS, all);
    mirrorPatch(REMOTE_TABLES.CHECKPOINTS, id, updates, 'checkpoint update');
    return all[idx];
  }
  return null;
}

/* ── Submissions ───────────────────────────────── */
export function getSubmissions(checkpointId) {
  return getStore(STORAGE_KEYS.SUBMISSIONS)
    .filter(s => s.checkpoint_id === checkpointId)
    .sort((a, b) => b.version - a.version);
}

export function getSubmissionsByProject(projectId) {
  const checkpoints = getCheckpoints(projectId);
  const cpIds = new Set(checkpoints.map(c => c.id));
  return getStore(STORAGE_KEYS.SUBMISSIONS).filter(s => cpIds.has(s.checkpoint_id));
}

function compactSubmissionForStorage(submission) {
  return {
    ...submission,
    files_data: Array.isArray(submission.files_data)
      ? submission.files_data.map(file => ({
          name: file.name,
          type: file.type,
          size: file.size,
          text_content: file.text_content
            ? `${String(file.text_content).slice(0, 1000)}${String(file.text_content).length > 1000 ? '\n\n[Older stored preview compacted to free browser storage.]' : ''}`
            : undefined,
          text_truncated: Boolean(file.text_content && String(file.text_content).length > 1000),
          extracted_text_length: file.extracted_text_length || (file.text_content ? String(file.text_content).length : undefined),
          data: null,
          preview_note: file.data ? 'Preview data compacted to free browser storage.' : file.preview_note,
        }))
      : submission.files_data,
  };
}

export function createSubmission(data) {
  const all = getStore(STORAGE_KEYS.SUBMISSIONS);
  const existing = all.filter(s => s.checkpoint_id === data.checkpoint_id);
  const submission = {
    id: generateId(),
    version: existing.length + 1,
    submitted_at: new Date().toISOString(),
    ...data,
  };
  all.push(submission);
  try {
    setStore(STORAGE_KEYS.SUBMISSIONS, all);
    mirrorUpsert(REMOTE_TABLES.SUBMISSIONS, submission, 'id', 'submission create');
    return submission;
  } catch (error) {
    if (!String(error?.message || '').includes('Browser storage is full')) {
      throw error;
    }

    const compacted = all.map(compactSubmissionForStorage);
    setStore(STORAGE_KEYS.SUBMISSIONS, compacted);
    const compactedSubmission = compacted[compacted.length - 1];
    mirrorUpsert(REMOTE_TABLES.SUBMISSIONS, compactedSubmission, 'id', 'submission compact create');
    return compactedSubmission;
  }
}

/* ── AI Reviews ────────────────────────────────── */
export function getAIReview(submissionId) {
  return getStore(STORAGE_KEYS.AI_REVIEWS).find(r => r.submission_id === submissionId);
}

export function getAIReviews(projectId) {
  const submissions = getSubmissionsByProject(projectId);
  const subIds = new Set(submissions.map(s => s.id));
  return getStore(STORAGE_KEYS.AI_REVIEWS).filter(r => subIds.has(r.submission_id));
}

export function createAIReview(data) {
  const all = getStore(STORAGE_KEYS.AI_REVIEWS);
  const review = {
    id: generateId(),
    reviewed_at: new Date().toISOString(),
    criteria_results: data.criteria_results || [], // saving criteria_results
    ...data,
  };
  all.push(review);
  setStore(STORAGE_KEYS.AI_REVIEWS, all);
  mirrorUpsert(REMOTE_TABLES.AI_REVIEWS, review, 'id', 'ai review create');
  return review;
}

/* ── Scoring Sessions ──────────────────────────── */
export function getScoringSessions(projectId) {
  return getStore(STORAGE_KEYS.SCORING_SESSIONS).filter(s => s.project_id === projectId);
}

export function createScoringSession(projectId, reviewerId) {
  const all = getStore(STORAGE_KEYS.SCORING_SESSIONS);
  const session = {
    id: generateId(),
    project_id: projectId,
    reviewer_id: reviewerId,
    status: 'in_progress',
    started_at: new Date().toISOString(),
  };
  all.push(session);
  setStore(STORAGE_KEYS.SCORING_SESSIONS, all);
  mirrorUpsert(REMOTE_TABLES.SCORING_SESSIONS, session, 'id', 'scoring session create');
  return session;
}

export function completeScoringSession(id) {
  const all = getStore(STORAGE_KEYS.SCORING_SESSIONS);
  const idx = all.findIndex(s => s.id === id);
  if (idx >= 0) {
    all[idx].status = 'completed';
    all[idx].completed_at = new Date().toISOString();
    setStore(STORAGE_KEYS.SCORING_SESSIONS, all);
    mirrorPatch(REMOTE_TABLES.SCORING_SESSIONS, id, {
      status: 'completed',
      completed_at: all[idx].completed_at,
    }, 'scoring session complete');
    return all[idx];
  }
  return null;
}

/* ── Score Entries ──────────────────────────────── */
export function getScoreEntries(sessionId) {
  return getStore(STORAGE_KEYS.SCORE_ENTRIES).filter(e => e.session_id === sessionId);
}

export function createScoreEntry(data) {
  const all = getStore(STORAGE_KEYS.SCORE_ENTRIES);
  const entry = { id: generateId(), ...data };
  all.push(entry);
  setStore(STORAGE_KEYS.SCORE_ENTRIES, all);
  mirrorUpsert(REMOTE_TABLES.SCORE_ENTRIES, entry, 'id', 'score entry create');
  return entry;
}

export function createScoreEntries(entries) {
  const all = getStore(STORAGE_KEYS.SCORE_ENTRIES);
  const newEntries = entries.map(e => ({ id: generateId(), ...e }));
  all.push(...newEntries);
  setStore(STORAGE_KEYS.SCORE_ENTRIES, newEntries);
  newEntries.forEach(entry => {
    mirrorUpsert(REMOTE_TABLES.SCORE_ENTRIES, entry, 'id', 'score entries create');
  });
  return newEntries;
}

/* ── Activity Logs ─────────────────────────────── */
export function getLogs(projectId) {
  return getStore(STORAGE_KEYS.ACTIVITY_LOGS)
    .filter(l => l.project_id === projectId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function addLog(projectId, actionType, description, metadata = {}) {
  const all = getStore(STORAGE_KEYS.ACTIVITY_LOGS);
  const log = {
    id: generateId(),
    project_id: projectId,
    action_type: actionType,
    description,
    metadata,
    created_at: new Date().toISOString(),
  };
  all.push(log);
  setStore(STORAGE_KEYS.ACTIVITY_LOGS, all);
  mirrorUpsert(REMOTE_TABLES.ACTIVITY_LOGS, log, 'id', 'activity log create');
  return log;
}

/* ── Current User ──────────────────────────────── */
export function getConsentForCurrentUser() {
  const participantCode = getCurrentParticipantCode();
  const user = getCurrentUser();
  return getStore(STORAGE_KEYS.CONSENTS)
    .find(item => item.participant_code === participantCode || item.user_id === user?.id) || null;
}

export function recordConsent({ consent_version = '2026-06-experiment-v1', metadata = {} } = {}) {
  const user = getCurrentUser();
  const participantCode = getCurrentParticipantCode();
  const all = getStore(STORAGE_KEYS.CONSENTS);
  const existingIndex = all.findIndex(item => item.participant_code === participantCode || item.user_id === user?.id);
  const now = new Date().toISOString();
  const consent = {
    id: existingIndex >= 0 ? all[existingIndex].id : generateId(),
    user_id: user?.id || participantCode,
    participant_code: participantCode,
    consent_version,
    consented_at: existingIndex >= 0 ? all[existingIndex].consented_at : now,
    profile_form_confirmed_at: now,
    metadata,
  };

  if (existingIndex >= 0) all[existingIndex] = consent;
  else all.push(consent);
  setStore(STORAGE_KEYS.CONSENTS, all);
  mirrorUpsert(REMOTE_TABLES.CONSENTS, consent, 'id', 'consent record');
  return consent;
}

export function getSrlProbeResponses(projectId = null) {
  const participantCode = getCurrentParticipantCode();
  const user = getCurrentUser();
  return getStore(STORAGE_KEYS.SRL_PROBES)
    .filter(item =>
      (!projectId || item.project_id === projectId) &&
      (item.participant_code === participantCode || item.user_id === user?.id)
    )
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
}

export function getSrlProbeResponse({ probe_key, project_id = null, checkpoint_id = null, submission_id = null }) {
  return getSrlProbeResponses(project_id).find(item =>
    item.probe_key === probe_key &&
    (!checkpoint_id || item.checkpoint_id === checkpoint_id) &&
    (!submission_id || item.submission_id === submission_id)
  ) || null;
}

export function createSrlProbeResponse(data) {
  const user = getCurrentUser();
  const response = {
    id: generateId(),
    user_id: user?.id || getCurrentParticipantCode(),
    participant_code: getCurrentParticipantCode(),
    project_id: null,
    checkpoint_id: null,
    submission_id: null,
    rating: null,
    response_text: '',
    submitted_at: new Date().toISOString(),
    ...data,
  };
  const all = getStore(STORAGE_KEYS.SRL_PROBES);
  all.push(response);
  setStore(STORAGE_KEYS.SRL_PROBES, all);
  mirrorUpsert(REMOTE_TABLES.SRL_PROBES, response, 'id', 'srl probe response');
  return response;
}

export function getCurrentUser() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  // ── Research LOG: Login ──
  const logFn = getLogSystemEvent();
  if (logFn) {
    logFn({
      event_subtype: 'login',
      student_id: user?.participant_code || user?.id || user?.name || 'unknown',
      detail: `User "${user?.name || 'unknown'}" logged in as ${user?.role || 'unknown'}`,
      metadata: { role: user?.role },
    });
  }
}

export async function logout() {
  const user = getCurrentUser();
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  await logoutExperimentAccount();
  // ── Research LOG: Logout ──
  const logFn = getLogSystemEvent();
  if (logFn) {
    logFn({
      event_subtype: 'logout',
      student_id: user?.participant_code || user?.id || user?.name || 'unknown',
      detail: `User "${user?.name || 'unknown'}" logged out`,
    });
  }
}

/* ── Settings ──────────────────────────────────── */
export function getSettings() {
  const defaults = {
    ai_provider: 'nvidia',
    ai_api_key: '',
    ai_model: 'meta/llama-3.1-70b-instruct',
    ai_custom_model: '',
    ai_base_url: 'https://integrate.api.nvidia.com/v1',
    language: 'zh',
  };

  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? { ...defaults, ...JSON.parse(data) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  window.dispatchEvent(new Event('settings_changed'));
  // Sync to Supabase
  mirrorSaveSettings(settings);
}

/* ── Scoring Formula ───────────────────────────── */
const DIMENSION_WEIGHTS = {
  completion: 0.25,
  creativity: 0.20,
  logic: 0.25,
  expression: 0.15,
  practicality: 0.15,
};

export function calculateWeightedScore(scores) {
  // scores: { completion: 3, creativity: 4, ... } (1-5 scale)
  let total = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    total += (scores[dim] || 0) * 20 * weight; // scale 1-5 → 20-100
  }
  return Math.round(total);
}

export function calculateFinalScore(projectId) {
  const sessions = getScoringSessions(projectId).filter(s => s.status === 'completed');
  if (sessions.length === 0) return null;

  const reviewerScores = sessions.map(session => {
    const entries = getScoreEntries(session.id);
    const scores = {};
    entries.forEach(e => { scores[e.dimension] = e.score; });
    return calculateWeightedScore(scores);
  });

  reviewerScores.sort((a, b) => a - b);

  let finalScore;
  if (reviewerScores.length >= 4) {
    // Remove highest and lowest
    const trimmed = reviewerScores.slice(1, -1);
    finalScore = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  } else {
    finalScore = reviewerScores.reduce((a, b) => a + b, 0) / reviewerScores.length;
  }

  return Math.round(finalScore);
}

export function scoreToGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

/* ── Demo Data Seeding ─────────────────────────── */
export function seedDemoData() {
  return;

  // Create demo assignments
  const assignments = [
    {
      id: 'demo-assignment-1',
      teacher_id: 'demo-teacher',
      title: '行動経済学におけるナッジ理論の応用',
      requirement_description: '身の回りにある課題に対して、行動経済学の「ナッジ理論」を応用した解決策を提案してください。実際の応用事例を分析し、その倫理的な側面を探ることも含めます。',
      scoring_criteria: '1. ナッジ理論の理解度\n2. 提案の実現可能性\n3. 倫理的課題への配慮\n4. プレゼンテーションの明確さ',
      global_deadline: '2024-12-20',
      created_at: '2024-09-01T09:00:00Z',
    },
    {
      id: 'demo-assignment-2',
      teacher_id: 'demo-teacher',
      title: 'キャンパス内UXリサーチとプロトタイピング',
      requirement_description: 'キャンパス内での学生の体験（移動、学習、コミュニケーションなど）を改善するためのUXリサーチを行い、解決策となるアプリのプロトタイプを作成してください。',
      scoring_criteria: '1. ユーザーリサーチの深さ\n2. ペインポイントの的確な特定\n3. プロトタイプのユーザビリティ\n4. デザインの完成度',
      global_deadline: '2024-11-15',
      created_at: '2024-09-05T10:00:00Z',
    }
  ];
  setStore(STORAGE_KEYS.ASSIGNMENTS, assignments);

  // Create demo project
  const project = {
    id: 'demo-project-1',
    assignment_id: 'demo-assignment-1',
    title: '行動経済学におけるナッジ理論の応用と倫理的課題',
    description: 'ナッジ理論の実際の応用事例を分析し、その倫理的な側面を探る研究プロジェクト。行動経済学の基礎理論から始め、公共政策や企業戦略における具体的な適用例を検討する。',
    expected_deliverable: '最終レポート（A4 20ページ以上）、プレゼンテーション資料',
    deadline: '2024-12-15',
    status: 'active',
    gantt_file_url: null,
    created_by: 'demo-student',
    created_at: '2024-09-15T09:00:00Z',
  };
  setStore(STORAGE_KEYS.PROJECTS, [project]);

  // Create checkpoints
  const checkpoints = [
    {
      id: 'demo-cp-1',
      project_id: 'demo-project-1',
      order_index: 1,
      title: 'リサーチテーマの決定',
      goal_description: '関心のある分野を絞り込み、信頼できる初期ソースを3つ収集する。',
      expected_deliverable: 'テーマ選定書、参考文献リスト',
      due_date: '2024-10-15',
      weight_percent: 15,
      status: 'passed',
      criteria: [
        { id: 'c1-1', label: 'テーマの明確さ', description: '研究テーマが具体的で、行動経済学に関連しているか。', weight: 40 },
        { id: 'c1-2', label: '参考文献の質', description: '信頼できる学術的ソースを3つ以上収集できているか。', weight: 40 },
        { id: 'c1-3', label: '書式と構成', description: '指定されたフォーマットに従って提出されているか。', weight: 20 }
      ]
    },
    {
      id: 'demo-cp-2',
      project_id: 'demo-project-1',
      order_index: 2,
      title: '中間レポートのドラフト提出',
      goal_description: '収集した情報を元に章立てを行い、中間レポートのドラフトを作成する。',
      expected_deliverable: '中間レポート（A4 10ページ）',
      due_date: '2024-11-01',
      weight_percent: 30,
      status: 'under_review',
      criteria: [
        { id: 'c2-1', label: '論理構成', description: '章立てが論理的で、議論の流れが明確か。', weight: 35 },
        { id: 'c2-2', label: '証拠の提示', description: '主張を裏付ける十分なデータや文献が引用されているか。', weight: 40 },
        { id: 'c2-3', label: '学術的表現', description: '適切な学術用語が使用され、文章が客観的か。', weight: 25 }
      ]
    },
    {
      id: 'demo-cp-3',
      project_id: 'demo-project-1',
      order_index: 3,
      title: '最終プレゼンテーション資料',
      goal_description: '研究成果をまとめたプレゼンテーション資料を作成する。',
      expected_deliverable: 'プレゼンテーション（15分）',
      due_date: '2024-11-20',
      weight_percent: 25,
      status: 'pending',
      criteria: [
        { id: 'c3-1', label: '視覚的明瞭さ', description: 'スライドのデザインが見やすく、要点が整理されているか。', weight: 30 },
        { id: 'c3-2', label: '内容の網羅性', description: '研究の背景、方法、結果、結論が全て含まれているか。', weight: 40 },
        { id: 'c3-3', label: '時間配分', description: '15分以内に収まる分量と構成になっているか。', weight: 30 }
      ]
    },
    {
      id: 'demo-cp-4',
      project_id: 'demo-project-1',
      order_index: 4,
      title: 'プロジェクト完了報告',
      goal_description: '最終レポートの完成とフォーマット調整を行い、提出する。',
      expected_deliverable: '最終レポート（A4 20ページ以上）',
      due_date: '2024-12-05',
      weight_percent: 30,
      status: 'pending',
      criteria: [
        { id: 'c4-1', label: '要件達成度', description: '指定されたページ数と形式の要件を満たしているか。', weight: 30 },
        { id: 'c4-2', label: '倫理的考察', description: 'ナッジ理論の応用に伴う倫理的課題について深く考察されているか。', weight: 40 },
        { id: 'c4-3', label: '結論の妥当性', description: '分析に基づいた説得力のある結論が導き出されているか。', weight: 30 }
      ]
    },
  ];
  setStore(STORAGE_KEYS.CHECKPOINTS, checkpoints);

  // Create submissions
  const submissions = [
    {
      id: 'demo-sub-1',
      checkpoint_id: 'demo-cp-1',
      submitted_by: 'demo-student',
      file_urls: ['research_theme.pdf'],
      description: 'ナッジ理論に関するテーマ選定書と参考文献リストを提出します。',
      version: 1,
      submitted_at: '2024-10-10T18:45:00Z',
    },
    {
      id: 'demo-sub-2',
      checkpoint_id: 'demo-cp-2',
      submitted_by: 'demo-student',
      file_urls: ['mid_report_draft.pdf', 'data_analysis.docx'],
      description: '中間レポートのドラフトとデータ分析資料です。',
      version: 1,
      submitted_at: '2024-10-24T14:30:00Z',
    },
  ];
  setStore(STORAGE_KEYS.SUBMISSIONS, submissions);

  // Create AI reviews
  const reviews = [
    {
      id: 'demo-review-1',
      submission_id: 'demo-sub-1',
      completion_rate: 88,
      overall_comment: '研究の動機が明確で、読者の興味を惹きつける良い導入です。参考文献の選定も適切です。',
      suggestions: 'より多角的な視点を加えるために、海外の事例研究も追加することを検討してください。',
      encouragement: '素晴らしいスタートです！テーマの選定が的確で、今後の展開が楽しみです。',
      reviewed_at: '2024-10-10T18:50:00Z',
      criteria_results: [
        { criterion_id: 'c1-1', passed: true, score: 95, comment: 'テーマが非常によく練られており、行動経済学の観点が明確です。' },
        { criterion_id: 'c1-2', passed: true, score: 85, comment: '質の高いソースが3つ揃っています。さらに幅広い視点からの文献があるとより良くなります。' },
        { criterion_id: 'c1-3', passed: true, score: 80, comment: 'フォーマットは概ね遵守されていますが、一部引用のスタイルにばらつきがあります。' }
      ]
    },
    {
      id: 'demo-review-2',
      submission_id: 'demo-sub-2',
      completion_rate: 65,
      overall_comment: '全体的に論理構成がしっかりしており、主張が一貫しています。使用されている語彙も適切で、アカデミックなトーンが保たれています。',
      suggestions: 'いくつかの論点で証拠が不足しています。再検討をお勧めします。接続詞の使用が単調になっている箇所があります。',
      encouragement: '着実に進歩しています。あと少しで素晴らしいレポートになります。',
      reviewed_at: '2024-10-24T14:35:00Z',
      criteria_results: [
        { criterion_id: 'c2-1', passed: true, score: 80, comment: '章立ては概ね論理的ですが、第2章から第3章への移行が少し唐突です。' },
        { criterion_id: 'c2-2', passed: false, score: 55, comment: '主張を裏付けるデータが不足しています。特にナッジの効果を定量的に示すデータを追加してください。' },
        { criterion_id: 'c2-3', passed: true, score: 60, comment: '学術的な表現はできていますが、一部口語的な表現が混じっています。推敲が必要です。' }
      ]
    },
  ];
  setStore(STORAGE_KEYS.AI_REVIEWS, reviews);

  // Create activity logs
  const logs = [
    {
      id: 'log-1',
      project_id: 'demo-project-1',
      action_type: 'create',
      description: 'プロジェクトが作成されました',
      metadata: {},
      created_at: '2024-09-15T09:00:00Z',
    },
    {
      id: 'log-2',
      project_id: 'demo-project-1',
      action_type: 'checkpoint_generated',
      description: 'AIがチェックポイントを生成しました（4件）',
      metadata: { count: 4 },
      created_at: '2024-09-15T09:05:00Z',
    },
    {
      id: 'log-3',
      project_id: 'demo-project-1',
      action_type: 'upload',
      description: 'チェックポイント1: リサーチテーマの決定 に成果物を提出',
      metadata: { checkpoint_id: 'demo-cp-1', score: 88 },
      created_at: '2024-10-10T18:45:00Z',
    },
    {
      id: 'log-4',
      project_id: 'demo-project-1',
      action_type: 'checkpoint_pass',
      description: 'チェックポイント1が完了しました',
      metadata: { checkpoint_id: 'demo-cp-1' },
      created_at: '2024-10-10T19:00:00Z',
    },
    {
      id: 'log-5',
      project_id: 'demo-project-1',
      action_type: 'upload',
      description: 'チェックポイント2: 中間レポートのドラフト提出 に成果物を提出',
      metadata: { checkpoint_id: 'demo-cp-2', score: 65 },
      created_at: '2024-10-24T14:30:00Z',
    },
  ];
  setStore(STORAGE_KEYS.ACTIVITY_LOGS, logs);

  // Create a second demo project (empty for contrast)
  const projects = getProjects();
  projects.push({
    id: 'demo-project-2',
    assignment_id: 'demo-assignment-2',
    title: 'UXリサーチ：キャンパス内ナビゲーションアプリ',
    description: 'キャンパス内の移動体験を改善するナビゲーションアプリのUXリサーチプロジェクト。',
    expected_deliverable: 'ユーザーリサーチレポート、プロトタイプ',
    deadline: '2024-11-02',
    status: 'active',
    gantt_file_url: null,
    created_by: 'demo-student',
    created_at: '2024-09-20T10:00:00Z',
  });
  setStore(STORAGE_KEYS.PROJECTS, projects);

  // Checkpoints for project 2
  const cp2 = getStore(STORAGE_KEYS.CHECKPOINTS);
  cp2.push(
    {
      id: 'demo-cp-2-1',
      project_id: 'demo-project-2',
      order_index: 1,
      title: 'ユーザーインタビュー計画',
      goal_description: 'ターゲットユーザーの定義とインタビューガイドの作成。',
      due_date: '2024-10-01',
      weight_percent: 25,
      status: 'passed',
    },
    {
      id: 'demo-cp-2-2',
      project_id: 'demo-project-2',
      order_index: 2,
      title: 'ユーザーインタビューまとめ',
      goal_description: 'インタビュー結果の分析とペインポイントの特定。',
      due_date: '2024-10-15',
      weight_percent: 25,
      status: 'passed',
    },
    {
      id: 'demo-cp-2-3',
      project_id: 'demo-project-2',
      order_index: 3,
      title: 'プロトタイプ作成',
      goal_description: 'ワイヤーフレームとインタラクティブプロトタイプの作成。',
      due_date: '2024-10-25',
      weight_percent: 30,
      status: 'in_progress',
    },
    {
      id: 'demo-cp-2-4',
      project_id: 'demo-project-2',
      order_index: 4,
      title: 'ユーザビリティテスト',
      goal_description: 'プロトタイプのユーザビリティテストと改善提案。',
      due_date: '2024-11-02',
      weight_percent: 20,
      status: 'pending',
      criteria: [
        { id: 'c2-4-1', label: 'テスト計画', description: 'ユーザビリティテストの計画が適切か。', weight: 30 },
        { id: 'c2-4-2', label: 'テスト実施', description: 'テスト結果が詳細に記録されているか。', weight: 40 },
        { id: 'c2-4-3', label: '改善提案', description: 'テスト結果に基づいた具体的な改善提案があるか。', weight: 30 }
      ]
    }
  );
  setStore(STORAGE_KEYS.CHECKPOINTS, cp2);
}
