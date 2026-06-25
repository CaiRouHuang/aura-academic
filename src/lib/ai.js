import { getSettings } from './store';

export const NVIDIA_MODELS = [
  { value: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B Instruct' },
  { value: 'meta/llama-3.1-405b-instruct', label: 'Llama 3.1 405B Instruct' },
  { value: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
  { value: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Nemotron 70B Instruct' },
  { value: 'custom', label: 'Custom model' },
];

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = NVIDIA_MODELS[0].value;

function getActiveSettings() {
  const settings = getSettings();
  const model = settings.ai_model === 'custom'
    ? settings.ai_custom_model
    : settings.ai_model;

  return {
    baseUrl: (settings.ai_base_url || import.meta.env.VITE_AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: model || import.meta.env.VITE_AI_MODEL || DEFAULT_MODEL,
    apiKey: settings.ai_api_key || '',
    language: settings.language === 'zh' ? 'zh-TW' : 'ja-JP',
  };
}

async function chatJson({ system, user, temperature = 0.2, maxTokens = 1800, timeoutMs = 180000 }) {
  const settings = getActiveSettings();
  const hasImageInput = Array.isArray(user);

  let response;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch('/api/ai/chat-completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        timeoutMs,
        request: {
          model: settings.model,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
      }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('AI request timed out after 180 seconds. Please try again with a smaller file or retry later.', { cause: error });
    }
    throw new Error('AI connection failed. Restart the Vite dev server so the local /api proxy is available.', { cause: error });
  } finally {
    window.clearTimeout(timeoutId);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    let message = payload?.error?.message || payload?.message || `AI API request failed (${response.status})`;
    if (hasImageInput && /image|vision|multimodal|content/i.test(message)) {
      message += ' The current AI model may not support image input. Please switch to a vision-capable model or custom endpoint before analyzing PDF images.';
    }
    throw new Error(message);
  }

  const rawContent = payload?.choices?.[0]?.message?.content;
  const content = Array.isArray(rawContent)
    ? rawContent.map(part => part?.text || '').join('\n')
    : rawContent;
  if (!content) {
    throw new Error('AI did not return parseable content.');
  }

  try {
    return parseJsonContent(content);
  } catch (error) {
    try {
      return await repairJsonContent(content, settings);
    } catch (repairError) {
      throw new Error(`AI response was not valid JSON and automatic repair failed: ${error.message}`, { cause: repairError });
    }
  }
}

function parseJsonContent(content) {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch (sliceError) {
        throw new Error(sliceError.message || 'AI response was not valid JSON.', { cause: sliceError });
      }
    }
    throw new Error(error.message || 'AI response was not valid JSON.', { cause: error });
  }
}

async function repairJsonContent(content, settings) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 60000);
  const clippedContent = content.length > 12000
    ? `${content.slice(0, 12000)}\n\n[Original response truncated before repair.]`
    : content;

  try {
    const response = await fetch('/api/ai/chat-completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        timeoutMs: 60000,
        request: {
          model: settings.model,
          temperature: 0,
          max_tokens: 2500,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: [
                'You repair malformed JSON.',
                'Return only one syntactically valid JSON object.',
                'Preserve the original keys and values as much as possible.',
                'Escape quotation marks and newlines inside string values.',
                'Do not include markdown fences, commentary, or explanations.',
              ].join('\n'),
            },
            {
              role: 'user',
              content: JSON.stringify({
                task: 'Repair this malformed JSON-like AI response into valid JSON.',
                malformed_response: clippedContent,
              }),
            },
          ],
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `JSON repair request failed (${response.status})`;
      throw new Error(message);
    }

    const repairedContent = payload?.choices?.[0]?.message?.content;
    if (!repairedContent) {
      throw new Error('JSON repair did not return content.');
    }

    return parseJsonContent(repairedContent);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('JSON repair timed out.', { cause: error });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildLanguageRule(language) {
  return language === 'zh-TW'
    ? 'Use Traditional Chinese for all user-facing text.'
    : 'Use Japanese for all user-facing text.';
}

function normalizeCheckpoint(raw, index, deadline) {
  const criteria = Array.isArray(raw.criteria) 
    ? raw.criteria.map((c, i) => ({
        id: String(c.id || `c-${Date.now()}-${i}`),
        label: String(c.label || `Criterion ${i+1}`).slice(0, 100),
        description: String(c.description || '').slice(0, 500),
        weight: Number(c.weight) || 0
      }))
    : [];
    
  // normalize criteria weights if they don't sum to 100
  const cTotal = criteria.reduce((s, c) => s + c.weight, 0);
  if (cTotal > 0 && cTotal !== 100) {
    let used = 0;
    criteria.forEach((c, i) => {
      if (i === criteria.length - 1) {
        c.weight = Math.max(0, 100 - used);
      } else {
        c.weight = Math.round((c.weight / cTotal) * 100);
        used += c.weight;
      }
    });
  } else if (cTotal === 0 && criteria.length > 0) {
    const even = Math.floor(100 / criteria.length);
    criteria.forEach((c, i) => { c.weight = (i === criteria.length - 1) ? 100 - even * (criteria.length - 1) : even; });
  }

  return {
    id: `temp-${Date.now()}-${index}`,
    title: String(raw.title || `Checkpoint ${index + 1}`).slice(0, 80),
    goal_description: String(raw.goal_description || raw.description || '').slice(0, 600),
    expected_deliverable: String(raw.expected_deliverable || '').slice(0, 240),
    due_date: raw.due_date || deadline || '',
    weight_percent: Number(raw.weight_percent) || 0,
    strategy_prompt: String(raw.strategy_prompt || ''),
    self_check_questions: Array.isArray(raw.self_check_questions) ? raw.self_check_questions : [],
    convergence_focus: String(raw.convergence_focus || ''),
    help_seeking_hint: String(raw.help_seeking_hint || ''),
    criteria
  };
}

function normalizeWeights(checkpoints) {
  const total = checkpoints.reduce((sum, cp) => sum + (Number(cp.weight_percent) || 0), 0);
  if (!total) {
    const even = Math.floor(100 / checkpoints.length);
    return checkpoints.map((cp, idx) => ({
      ...cp,
      weight_percent: idx === checkpoints.length - 1 ? 100 - even * (checkpoints.length - 1) : even,
    }));
  }

  let used = 0;
  return checkpoints.map((cp, idx) => {
    if (idx === checkpoints.length - 1) {
      return { ...cp, weight_percent: Math.max(1, 100 - used) };
    }
    const weight = Math.max(1, Math.round((Number(cp.weight_percent) / total) * 100));
    used += weight;
    return { ...cp, weight_percent: weight };
  });
}

function buildFallbackCheckpoints(project, today) {
  const phases = [
    {
      title: '問題定義與研究整理',
      goal_description: `釐清「${project.title || '本專案'}」的核心問題、使用情境、目標族群與設計限制，整理參考文件中的關鍵需求。`,
      expected_deliverable: '研究摘要、問題定義、使用者/情境分析、初步設計方向。',
      strategy_prompt: '使用桌面研究、利害關係人分析與問題框定方法，將參考資料轉換成可評估的設計需求。',
      convergence_focus: '收斂出一個明確、可驗證的核心設計問題。',
    },
    {
      title: '概念發展與設計策略',
      goal_description: '根據研究結果提出多個設計概念，並比較其可行性、創新性與符合需求的程度。',
      expected_deliverable: '概念草圖、設計策略說明、概念比較表、選定方向的理由。',
      strategy_prompt: '使用發散/收斂、概念矩陣或 FSE（Feature, Specification, Evidence）整理每個設計選擇的依據。',
      convergence_focus: '選定一個主要設計方向，並說明放棄其他方向的理由。',
    },
    {
      title: '原型製作與設計驗證',
      goal_description: '將選定概念轉化為可檢視的原型或具體設計表現，並收集測試或回饋證據。',
      expected_deliverable: '原型、視覺/結構/流程稿、測試紀錄、回饋整理。',
      strategy_prompt: '以快速原型、使用者回饋或同儕評論驗證關鍵假設，記錄設計修改前後的差異。',
      convergence_focus: '驗證最關鍵的一項設計假設，並提出具體修改。',
    },
    {
      title: '最終整合與提案呈現',
      goal_description: '整合研究、設計過程、原型成果與反思，完成可提交的最終提案。',
      expected_deliverable: project.expected_deliverable || '最終設計提案、成果展示資料與過程反思。',
      strategy_prompt: '檢查成果是否回應原始問題，並用證據說明設計決策與最終成果之間的關係。',
      convergence_focus: '完成一份邏輯清楚、證據完整、可被評估的最終提案。',
    },
  ];

  const totalDays = getDaysBetween(today, project.deadline || addDays(today, 28));
  return normalizeWeights(phases.map((phase, index) => normalizeCheckpoint({
    ...phase,
    due_date: addDays(today, Math.max(index + 1, Math.round(((index + 1) / phases.length) * totalDays))),
    weight_percent: index === phases.length - 1 ? 30 : index === 0 ? 20 : 25,
    self_check_questions: [
      '我目前的設計決策是否有明確證據支持？',
      '我是否能說明本階段成果和最終交付物的關係？',
      '下一步最需要收斂或驗證的是什麼？',
    ],
    help_seeking_hint: '當設計方向、評估標準或原型可行性不明確時，請帶著目前成果與具體問題向同儕或教師請教。',
    criteria: [
      {
        id: 'c-relevance',
        label: '任務關聯性',
        description: '成果需清楚回應本階段目標，並與專案主題、課程要求或參考文件內容相關。',
        weight: 35,
      },
      {
        id: 'c-evidence',
        label: '證據與說明',
        description: '需提供足夠的研究、草圖、測試、比較或反思證據，支持設計判斷。',
        weight: 35,
      },
      {
        id: 'c-deliverable',
        label: '交付完整度',
        description: '提交內容需符合預期交付物，檔案、文字說明與成果呈現需可被檢查。',
        weight: 30,
      },
    ],
  }, index, project.deadline)));
}

export async function generateProjectCheckpoints(project) {
  const { language } = getActiveSettings();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let result;
  try {
    result = await chatJson({
    system: [
      'You are an academic project planning assistant for a design course.',
      'Write checkpoint descriptions and questions in plain, direct language — as if a studio mentor is briefing the student before they start working. Avoid bureaucratic or academic phrasing.',
      buildLanguageRule(language),
      'Return syntactically valid JSON only. Do not use markdown fences or explanations.',
      'All string values must be plain text: no markdown tables, no bullet markers, no backticks, no unescaped quotation marks, and no literal newline characters inside strings.',
      'Keep every string short. Each description must be 1 sentence. Each array item must be 1 short sentence.',
      `Today's date is ${today}. All checkpoint due_date values must be AFTER today and in chronological order.`,
      '',
      '## Proposal-Aware Checkpoint Generation',
      'The student\'s proposal follows a Design Thinking structure with three sections:',
      '1. Empathize: user scenario, emotional needs, user observations.',
      '2. Define: design challenge (HMW statement), core tension interpretation.',
      '3. Ideate: 3+ character concept directions, visual strategy exploration, convergence decision with rationale, design boundaries.',
      '',
      'When generating checkpoints, your primary job is to BRIDGE GAPS between what the student defined and what they plan to execute:',
      '- If the student identified user needs in Empathize but their chosen direction in Ideate does not clearly address one of those needs, the checkpoint should ask them to clarify the connection.',
      '- If the student defined a design challenge in Define but their convergence decision seems to solve a different problem, the checkpoint should surface this misalignment.',
      '- If a rejected direction in Ideate contained a valuable element that could strengthen the chosen direction, the checkpoint may suggest the student consider incorporating it.',
      '- If the student\'s proposal leaves visual details vague (e.g., no specific color rationale, no scenario-specific behavior), the checkpoint should make those implicit decisions explicit.',
      '',
      '## Key Principle: Make the Vague Concrete, Do Not Over-Question the Clear',
      'If the student has already provided a well-reasoned justification for a design decision (e.g., clear link from user need to character trait to visual strategy), do NOT challenge it just for the sake of asking questions.',
      'Focus checkpoint questions on areas where the student\'s reasoning has gaps, is superficial, or where a decision was made without stated rationale.',
      'The tone should be that of a thoughtful design mentor: direct, specific, and constructive — not interrogative or generic.',
      '',
      '## Output Format',
      'Return only a JSON object with key "checkpoints".',
      'The value must be an array of exactly 4 checkpoints.',
      'Each checkpoint must contain: title, goal_description, expected_deliverable, due_date as YYYY-MM-DD, weight_percent as integer, and a "criteria" array.',
      'Each checkpoint must also contain the following string arrays or strings:',
      '- strategy_prompt (string): Suggest 1-2 specific design methods, tools, or data collection approaches the student should use during this phase.',
      '- self_check_questions (array of strings): Provide 2-3 self-monitoring questions the student should ask themselves during this phase. These should reference SPECIFIC content from their proposal (e.g., their stated user need, their design challenge, their chosen direction).',
      '- convergence_focus (string): State ONE specific, narrow focus that the student must converge on during this phase. This should address a gap identified in their proposal. Avoid broad or abstract goals.',
      '- help_seeking_hint (string): Describe a specific scenario in which the student should seek help from peers or instructors, and what kind of help to ask for.',
      'The "criteria" array must contain 3 to 6 evaluation criteria for the checkpoint.',
      'Each criterion must contain: id (string), label (string), description (specific requirement to evaluate), and weight (integer).',
      'The criteria weights must sum to 100 for each checkpoint.',
      'All checkpoint weight_percent values must sum to 100.',
      'Dates must be in chronological order, all strictly after today, and no later than the project deadline.',
      'Distribute due dates evenly between today and the project deadline based on the number of checkpoints.',
      'If project.reference_file.content exists, use it as the main reference for project-specific phases and deliverables.',
      'Do not copy long passages from the project or reference file into the JSON. Summarize them briefly.',
    ].join('\n'),
    user: JSON.stringify({
      task: 'Create practical checkpoints for this student project.',
      project,
      today,
    }),
    temperature: 0.15,
    maxTokens: 3600,
    });
  } catch (error) {
    console.warn('AI checkpoint generation failed; using local fallback checkpoints.', error);
    return buildFallbackCheckpoints(project, today);
  }

  const raw = Array.isArray(result.checkpoints) ? result.checkpoints : [];
  if (!raw.length) {
    console.warn('AI did not generate checkpoints; using local fallback checkpoints.', result);
    return buildFallbackCheckpoints(project, today);
  }

  // Post-process: clamp dates to be >= today
  const processed = raw.map((cp, index) => {
    const normalized = normalizeCheckpoint(cp, index, project.deadline);
    if (normalized.due_date && normalized.due_date < today) {
      // Recalculate a sensible date between today and deadline
      const deadline = project.deadline || today;
      const totalCps = raw.length;
      const daysFromNow = Math.round(((index + 1) / totalCps) * getDaysBetween(today, deadline));
      normalized.due_date = addDays(today, Math.max(daysFromNow, index + 1));
    }
    return normalized;
  });

  return normalizeWeights(processed);
}

function getDaysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function reviewSubmission({ project, checkpoint, submission, images = [], texts = [], imageContext = '', submissionMeta = null }) {
  const { language } = getActiveSettings();
  
  const textsInfo = texts.length > 0 
    ? `\n\n[Attached Text Files Content]:\n${texts.map(t => `--- File: ${t.name} ---\n${t.content}`).join('\n\n')}`
    : '';

  // Create a clean copy of submission to avoid sending massive base64 data to AI
  const cleanSubmission = { ...submission };
  if (cleanSubmission.files_data) {
    cleanSubmission.files_data = cleanSubmission.files_data.map(f => {
      const { data, text_content, ...rest } = f;
      return { ...rest, has_data: !!data, has_text: !!text_content };
    });
  }

  let userContentObj = {
    task: 'Review this checkpoint submission.',
    project,
    checkpoint,
    submission: cleanSubmission,
    note: (images.length > 0 ? 'The uploaded image files and/or rendered PDF page images are attached. Inspect visual content such as charts, screenshots, diagrams, scans, layout, and embedded images when evaluating. ' : '') +
          (imageContext ? `${imageContext} ` : '') +
          (texts.length > 0 ? 'The text file contents are provided below. ' : 'If no file content is visible, judge based on the filenames and description.') +
          textsInfo,
    design_state_instructions: 'The student\'s submission should include a design_state object with: current_state, round_goal, version_diff, design_evidence, design_rationale, unresolved_issues, decision_outcome, and next_milestone. When reviewing, cross-validate the student\'s self-reported design_state against the actual submission content. Flag discrepancies between claimed changes and visible evidence.',
  };

  if (submissionMeta) {
    userContentObj.submission_metadata = submissionMeta;
  }

  let userContent = JSON.stringify(userContentObj);

  if (images.length > 0) {
    userContent = [
      { type: 'text', text: userContent },
      ...images.map(img => ({ type: 'image_url', image_url: { url: img } }))
    ];
  }

  const systemPrompt = [
    'You are an academic checkpoint reviewer for a design course.',
    'Write as if you are a direct but warm design studio mentor talking to the student face-to-face. Use clear, simple language. Avoid academic jargon. Speak to the student directly using "you".',
    buildLanguageRule(language),
    'Return syntactically valid JSON only. Do not use markdown fences or explanations. Escape all quotes and newlines inside string values.',
    'Be concrete, fair, and supportive.',
    'You MUST evaluate the submission item by item against the specific criteria defined in the checkpoint.',
    'IMPORTANT: Cross-validate the submission. Check if the report references materials (e.g., generated images, experimental results, screenshots) that are NOT actually attached as files. If the student claims to have produced N items but only submitted fewer, flag this discrepancy explicitly in the relevant criterion comment and adjust the score accordingly.',
    'The submission metadata shows exactly how many files were uploaded and their types. Use this information to verify claims made in the report content.',
    '',
    '## Design Thinking Context',
    'The student\'s project proposal was structured using Design Thinking (Empathize → Define → Ideate).',
    'Their proposal contains: user scenario and emotional needs (Empathize), a design challenge definition and core tension interpretation (Define), multiple character concept directions with a convergence decision (Ideate).',
    'When reviewing, check whether the submission\'s design choices align with the user needs and design challenge stated in the proposal.',
    'If the student\'s FSE rationale clearly traces back to their stated user needs and design challenge, acknowledge the alignment — do not question well-grounded decisions just to generate feedback.',
    'Focus critique on areas where the connection between user need → design decision → visual execution is weak, missing, or contradictory.',
    '',
    '## Two-Phase Review',
    'IMPORTANT: Structure your response to enable a TWO-PHASE review experience:',
    'Phase 1 — Evaluation (Feedback): Score each criterion objectively. This is the "listen to others" phase.',
    'Phase 2 — Reflection Scaffolding: For each criterion that scored below 70, generate ONE targeted reflection question that the student must answer in their next submission.',
    'These questions should: ask "why" the student made specific design decisions (not "what" they did), reframe gaps as learning opportunities, and encourage the student to articulate their design rationale using the FSE structure (Feature, Specification, Evidence).',
    'If a criterion scored 70 or above AND the student\'s rationale is already well-grounded, do NOT generate a reflection question for that criterion.',
    '',
    '## Output Format',
    'Return only a JSON object with keys: criteria_results, reflection_questions, overall_comment, suggestions, encouragement.',
    'criteria_results must be an array where each object corresponds to a criterion from the checkpoint and has keys: criterion_id, passed (boolean), score (0-100 integer), and comment (specific feedback for this criterion).',
    'reflection_questions must be an array of objects with keys: criterion_id, question, fse_prompt.',
    'Keep each criterion comment under 80 words to avoid malformed or overlong JSON.',
    'overall_comment should summarize how well the submission meets the checkpoint overall.',
    'suggestions should list the most important next improvements in one concise paragraph. Only suggest improvements based on the criteria that were not fully met. Reference the student\'s own design challenge or user needs when suggesting improvements.',
    'encouragement should be short and motivating.',
  ].join('\n');

  const result = await chatJson({
    system: systemPrompt,
    user: userContent,
    temperature: 0.2,
    maxTokens: 4000,
  });

  const criteria_results = Array.isArray(result.criteria_results) ? result.criteria_results : [];
  
  // Calculate completion_rate based on criteria weights and scores
  let completion_rate;
  if (checkpoint.criteria && checkpoint.criteria.length > 0 && criteria_results.length > 0) {
    let totalScore = 0;
    checkpoint.criteria.forEach(c => {
      const cr = criteria_results.find(res => res.criterion_id === c.id);
      const score = cr ? Number(cr.score) || 0 : 0;
      totalScore += score * (c.weight / 100);
    });
    completion_rate = Math.round(totalScore);
  } else {
    // Fallback if no criteria
    completion_rate = Math.max(0, Math.min(100, Math.round(Number(result.completion_rate || result.score) || 0)));
  }

  return {
    reviewData: {
      completion_rate,
      criteria_results: criteria_results.map(r => ({
        criterion_id: String(r.criterion_id),
        passed: Boolean(r.passed),
        score: Number(r.score) || 0,
        comment: String(r.comment || '').slice(0, 300)
      })),
      reflection_questions: Array.isArray(result.reflection_questions) ? result.reflection_questions : [],
      overall_comment: String(result.overall_comment || result.analysis_summary || '').slice(0, 900),
      suggestions: String(result.suggestions || '').slice(0, 900),
      encouragement: String(result.encouragement || '').slice(0, 360),
    },
    promptContext: {
      system: systemPrompt,
      user: userContentObj
    }
  };
}

export async function generateReflectionScaffold({ review, checkpoint, previousSubmissions }) {
  const { language } = getActiveSettings();
  const result = await chatJson({
    system: [
      'You are a design education mentor who guides reflection, not a judge.',
      'Use conversational, encouraging language. Write as if you are talking directly to the student. Avoid formal academic phrasing. Keep sentences short and clear.',
      buildLanguageRule(language),
      'Return syntactically valid JSON only. Do not use markdown fences or explanations.',
      '',
      '## Your Role',
      'You have just provided evaluation feedback to a design student.',
      'Now your task is to help the student REFLECT on the feedback and plan their next iteration.',
      'You help students find logical, cognitive steps they can control within ambiguous design situations.',
      '',
      '## Reflection Sequence',
      'Guide the student through this sequence:',
      '',
      '### Step 1: Acknowledge & Interpret',
      '- Summarize what went well and what needs improvement.',
      '- Reframe any "failures" as information: "This unexpected result tells you something about [X]. What does it tell you?"',
      '- Guide them to reflect on HOW the gap occurred and how it can drive the next design direction.',
      '- When acknowledging strengths, reference specific connections the student made between user needs (from their Empathize section) and design decisions.',
      '',
      '### Step 2: Convergence',
      '- From the unresolved issues, select ONE specific micro-focus the student should address in the next work session.',
      '- The focus must be narrow enough to be actionable within a single work session (2-4 hours).',
      '- Frame it as: "In your next submission, demonstrate [X] by [Y]."',
      '- When possible, connect the convergence focus back to the student\'s own design challenge (from their Define section) or an unaddressed user need.',
      '',
      '### Step 3: Strategy Adjustment',
      '- Based on the review results, suggest ONE specific change to the student\'s design method, tool usage, or data collection approach.',
      '- Do NOT suggest starting over. Suggest iteration on existing work.',
      '',
      '### Step 4: Guiding Questions',
      '- Provide 2-3 questions that the student should be able to answer when they submit the next version.',
      '',
      'Return a JSON object with keys:',
      '  acknowledgment (string),',
      '  reframed_learning (string),',
      '  convergence_focus (string),',
      '  strategy_adjustment (string),',
      '  guiding_questions (array of strings),',
      '  decision_recommendation (one of: continue, modify, branch, rollback, converge)',
    ].join('\n'),
    user: JSON.stringify({
      task: 'Generate reflection scaffold for the student.',
      review_results: review,
      checkpoint,
      submission_history_count: previousSubmissions?.length || 0,
    }),
    temperature: 0.3,
    maxTokens: 1200,
  });
  return result;
}

export async function summarizePdfChunk({ chunkText, chunkImages = [], chunkInfo, checkpoint, project }) {
  const { language } = getActiveSettings();
  
  let userContentObj = {
    task: 'Summarize this portion of the PDF submission.',
    project_context: { title: project.title },
    checkpoint_criteria: checkpoint.criteria?.map(c => ({ id: c.id, description: c.description })) || [],
    chunk_info: chunkInfo,
    content: chunkText
  };

  let userContent = JSON.stringify(userContentObj);

  if (chunkImages.length > 0) {
    userContent = [
      { type: 'text', text: userContent },
      ...chunkImages.map(img => ({ type: 'image_url', image_url: { url: img } }))
    ];
  }

  const result = await chatJson({
    system: [
      'You are an academic document summarizer.',
      buildLanguageRule(language),
      'Return syntactically valid JSON only. Do not use markdown fences or explanations. Escape all quotes and newlines inside string values.',
      'Your task is to summarize a specific chunk of a larger PDF submission.',
      'Extract any information that is relevant to the provided checkpoint criteria.',
      'Return only a JSON object with keys: summary, key_claims, evidence_found, visual_content_described, design_rationale_traces, strategy_mentions.',
      'summary: A concise paragraph summarizing the chunk.',
      'key_claims: An array of strings describing claims the student makes in this chunk.',
      'evidence_found: An array of strings describing concrete evidence (e.g., data, code, screenshots) presented in this chunk.',
      'visual_content_described: An array of strings describing what visual elements (if any) are present in the attached images for this chunk.',
      'Additionally, identify any design rationale statements in the text using the FSE framework:',
      '- Feature: What specific design element is being justified?',
      '- Specification: What need or requirement does it address?',
      '- Evidence: What data, test result, or observation supports this choice?',
      'design_rationale_traces: An array of objects with keys: feature, specification, evidence. If no design rationale is found, return an empty array.',
      'strategy_mentions: An array of strings representing any mentions of design methods, tools, or approaches the student describes using.'
    ].join('\n'),
    user: userContent,
    temperature: 0.15,
    maxTokens: 800,
  });

  return {
    summary: String(result.summary || ''),
    key_claims: Array.isArray(result.key_claims) ? result.key_claims : [],
    evidence_found: Array.isArray(result.evidence_found) ? result.evidence_found : [],
    visual_content_described: Array.isArray(result.visual_content_described) ? result.visual_content_described : [],
    design_rationale_traces: Array.isArray(result.design_rationale_traces) ? result.design_rationale_traces : [],
    strategy_mentions: Array.isArray(result.strategy_mentions) ? result.strategy_mentions : []
  };
}

export async function generateFinalReport({ project, checkpoints, reviews, scores, finalScore, grade }) {
  const { language } = getActiveSettings();
  const result = await chatJson({
    system: [
      'You are an academic final report assistant.',
      buildLanguageRule(language),
      'Return syntactically valid JSON only. Do not use markdown fences or explanations. Escape all quotes and newlines inside string values.',
      'Return only a JSON object with keys: ai_summary, process_trajectory, srl_growth_observations, design_rationale_quality, advice, meta_reflection_prompts.',
      'ai_summary should summarize project progress, strengths, risks, and scoring evidence in one paragraph.',
      'process_trajectory should describe the student\'s iteration pattern across checkpoints: Was it linear? Did they branch or rollback? How did their strategy change over time?',
      'srl_growth_observations should note any observable changes in the student\'s self-regulation behaviors across submissions (e.g. goal-setting specificity, help-seeking, self-monitoring).',
      'design_rationale_quality should assess the overall quality of design rationale across all submissions using these dimensions: specificity, evidence-grounding, and structural coherence.',
      'advice must be an array of 2 to 4 concise actionable suggestions focused on the student\'s PROCESS, not just the final output.',
      'meta_reflection_prompts should be an array of 2-3 questions that encourage the student to reflect on their own learning process across the entire project.',
    ].join('\n'),
    user: JSON.stringify({
      task: 'Generate a student-facing final AI report.',
      project,
      checkpoints,
      reviews,
      scores,
      final_score: finalScore,
      grade,
    }),
    temperature: 0.25,
    maxTokens: 1400,
  });

  const advice = Array.isArray(result.advice) ? result.advice : [result.advice].filter(Boolean);
  const metaPrompts = Array.isArray(result.meta_reflection_prompts) ? result.meta_reflection_prompts : [result.meta_reflection_prompts].filter(Boolean);

  return {
    ai_summary: String(result.ai_summary || '').slice(0, 1200),
    process_trajectory: String(result.process_trajectory || ''),
    srl_growth_observations: String(result.srl_growth_observations || ''),
    design_rationale_quality: String(result.design_rationale_quality || ''),
    advice: advice.map(item => String(item).slice(0, 500)).filter(Boolean).slice(0, 4),
    meta_reflection_prompts: metaPrompts.map(item => String(item).slice(0, 300)).filter(Boolean).slice(0, 3),
  };
}
