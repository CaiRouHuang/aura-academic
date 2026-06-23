import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addLog,
  createCheckpoints,
  createProject,
  createSrlProbeResponse,
  getAssignment,
  getCurrentParticipantCode,
  getCurrentUser,
} from '../../lib/store';
import { generateProjectCheckpoints } from '../../lib/ai';
import { logSrlProbeResponse, logSystemEvent } from '../../lib/eventLogger';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import FileUploadZone from '../../components/ui/FileUploadZone';
import MarkdownRenderer from '../../components/ui/MarkdownRenderer';
import DateTimePicker from '../../components/ui/DateTimePicker';
import { extractTextFromFile, isTextExtractable } from '../../lib/fileParser';

const REFERENCE_TEXT_MAX_CHARS = 20000;

export default function ProposalPage() {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const { t } = useTranslation();
  
  const assignment = assignmentId ? getAssignment(assignmentId) : null;
  const proposalTemplateUrl = import.meta.env.VITE_PROPOSAL_TEMPLATE_URL || '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expectedDeliverable, setExpectedDeliverable] = useState('');
  const [teamMembers, setTeamMembers] = useState('');
  const [deadline, setDeadline] = useState('');
  const [ganttFile, setGanttFile] = useState(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewCheckpoints, setPreviewCheckpoints] = useState([]);
  const [aiError, setAiError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showAssignmentDetailsModal, setShowAssignmentDetailsModal] = useState(false);
  const [directionClarity, setDirectionClarity] = useState('');
  const [probeError, setProbeError] = useState('');

  const [aiTipIndex, setAiTipIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

  const aiTips = [
    "正在分析專案目標與限制條件...",
    "正在對照相關設計方法論...",
    "正在分配時程與權重...",
    "正在建立具體的自我檢查問題...",
    "即將完成檢查點規劃..."
  ];

  useEffect(() => {
    let interval;
    if (isGenerating) {
      interval = setInterval(() => {
        setAiTipIndex(prev => (prev + 1) % aiTips.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isGenerating, aiTips.length]);

  useEffect(() => {
    let interval;
    if (isCreating) {
      interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isCreating]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !expectedDeliverable.trim() || !teamMembers.trim()) return;

    setIsGenerating(true);
    setAiError('');

    try {
      let referenceFile = null;
      if (ganttFile && isTextExtractable(ganttFile)) {
        try {
          const extractedText = await extractTextFromFile(ganttFile, {
            maxChars: REFERENCE_TEXT_MAX_CHARS,
          });
          referenceFile = {
            name: ganttFile.name,
            type: ganttFile.type || 'unknown',
            size_bytes: ganttFile.size,
            content: extractedText.slice(0, REFERENCE_TEXT_MAX_CHARS),
            truncated: extractedText.length > REFERENCE_TEXT_MAX_CHARS,
          };
        } catch (fileError) {
          console.warn('Failed to extract proposal reference file text.', fileError);
          referenceFile = {
            name: ganttFile.name,
            type: ganttFile.type || 'unknown',
            size_bytes: ganttFile.size,
            extraction_error: fileError.message || 'Unable to extract text.',
          };
        }
      }

      const checkpoints = await generateProjectCheckpoints({
        title: title.trim(),
        description: description.trim(),
        expected_deliverable: expectedDeliverable.trim(),
        team_members: teamMembers.trim(),
        deadline: deadline || null,
        gantt_file_name: ganttFile ? ganttFile.name : null,
        reference_file: referenceFile,
      });

      const fixedCheckpoints = checkpoints.map(cp => {
        let fixedDate = cp.due_date;
        if (fixedDate && fixedDate.length === 10) {
          fixedDate = `${fixedDate}T23:59`;
        }
        return { ...cp, due_date: fixedDate };
      });

      setPreviewCheckpoints(fixedCheckpoints);
      setShowPreview(true);
    } catch (error) {
      setAiError(error.message || 'AI checkpoint generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmStart = () => {
    if (!directionClarity) {
      setProbeError('請先回答清楚度量表後再開始專題。');
      return;
    }
    const user = getCurrentUser();
    const participantCode = getCurrentParticipantCode();
    setProbeError('');
    setIsCreating(true);
    setUploadProgress(0);
    setTimeout(() => {
      // 1. Create project
      const project = createProject({
        assignment_id: assignmentId || null,
        title: title.trim(),
        description: description.trim(),
        expected_deliverable: expectedDeliverable.trim(),
        team_members: teamMembers.trim(),
        deadline: deadline || null,
        gantt_file_url: ganttFile ? ganttFile.name : null,
        created_by: participantCode,
        status: 'active'
      });

      // 2. Create checkpoints without temp ids
      const finalCheckpoints = previewCheckpoints.map(cp => {
        const rest = { ...cp };
        delete rest.id;
        return rest;
      });
      createCheckpoints(project.id, finalCheckpoints);

      const probe = createSrlProbeResponse({
        probe_key: 'proposal_direction_clarity',
        prompt: '你現在對設計方向有多清楚？',
        project_id: project.id,
        rating: Number(directionClarity),
      });

      logSrlProbeResponse({
        probe_key: 'proposal_direction_clarity',
        prompt: '你現在對設計方向有多清楚？',
        user_id: user?.id,
        participant_code: participantCode,
        project_id: project.id,
        rating: Number(directionClarity),
        response_id: probe.id,
      });
      
      // 3. Add Log
      addLog(project.id, 'checkpoint_generated', `${t('proposal.ai_generated_log')}（${finalCheckpoints.length}件）`);

      // ── Research LOG: Project Created ──
      logSystemEvent({
        event_subtype: 'project_created',
        student_id: participantCode,
        detail: `Project "${title.trim()}" created with ${finalCheckpoints.length} checkpoints`,
        metadata: { project_id: project.id, checkpoint_count: finalCheckpoints.length },
      });

      navigate(`/projects/${project.id}/checkpoints`);
    }, 3000);
  };
  
  const updatePreviewCheckpoint = (id, field, value) => {
    setPreviewCheckpoints(prev => prev.map(cp => cp.id === id ? { ...cp, [field]: value } : cp));
  };

  const deletePreviewCheckpoint = (id) => {
    setPreviewCheckpoints(prev => prev.filter(cp => cp.id !== id));
  };

  const addPreviewCheckpoint = () => {
    setPreviewCheckpoints(prev => [...prev, {
      id: `temp-${Date.now()}`,
      title: 'New Checkpoint',
      goal_description: '',
      expected_deliverable: '',
      due_date: '',
      weight_percent: 0,
      criteria: []
    }]);
  };

  const updateCriterion = (cpId, criterionId, field, value) => {
    setPreviewCheckpoints(prev => prev.map(cp => {
      if (cp.id !== cpId) return cp;
      return {
        ...cp,
        criteria: (cp.criteria || []).map(c => c.id === criterionId ? { ...c, [field]: value } : c)
      };
    }));
  };

  const addCriterion = (cpId) => {
    setPreviewCheckpoints(prev => prev.map(cp => {
      if (cp.id !== cpId) return cp;
      return {
        ...cp,
        criteria: [...(cp.criteria || []), {
          id: `c-${Date.now()}`,
          label: 'New Criterion',
          description: '',
          weight: 0
        }]
      };
    }));
  };

  const deleteCriterion = (cpId, criterionId) => {
    setPreviewCheckpoints(prev => prev.map(cp => {
      if (cp.id !== cpId) return cp;
      return {
        ...cp,
        criteria: (cp.criteria || []).filter(c => c.id !== criterionId)
      };
    }));
  };

  return (
    <>
      <TopBar title="Aura Academic" showBack />
      <div className="px-[var(--spacing-page)] max-w-2xl mx-auto pt-4 md:pt-8 pb-32">
        <h2 className="text-[22px] text-primary text-center mt-[var(--spacing-stack-lg)] mb-2 animate-fade-up font-medium">
          {t('proposal.title')}
        </h2>
        <p className="text-[14px] text-on-surface-variant text-center mb-[var(--spacing-stack-xl)] leading-relaxed animate-fade-up delay-100">
          {t('proposal.subtitle')}
        </p>



        {isCreating || isGenerating ? (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-up">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-container/60 to-tertiary-container/60 flex items-center justify-center mb-6 ai-orb-pulse">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-container to-tertiary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[36px] text-primary sparkle-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              </div>
            </div>
            <p className="text-[16px] text-on-surface-variant text-center">
              {isCreating ? '正在為您建立專案空間...' : '正在為您分析提案並建立檢查點...'}
            </p>
            <p className="text-[12px] text-on-surface-variant/70 mt-2 text-center max-w-md leading-relaxed h-8 transition-opacity duration-500">
              {isCreating ? '系統正在初始化專案設定並建立檢查點，請稍候。' : aiTips[aiTipIndex]}
            </p>
            
            {isCreating && (
              <div className="w-full max-w-sm mt-6">
                <div className="h-2 rounded-full bg-surface-container-high overflow-hidden relative">
                   <div 
                     className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-tertiary rounded-full transition-all duration-300 ease-out" 
                     style={{ width: `${Math.min(100, uploadProgress)}%` }}
                   />
                </div>
                <div className="text-right mt-1 text-[10px] text-on-surface-variant">
                  {Math.min(100, uploadProgress)}%
                </div>
              </div>
            )}
          </div>
        ) : !showPreview ? (
          <form onSubmit={handleGenerate} className="flex flex-col gap-8 animate-fade-up delay-100">
            {/* Project Name */}
            <div className="relative">
              <input
                type="text"
                id="project-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder=" "
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 px-1 text-[16px] text-on-surface outline-none transition-colors peer"
                required
              />
              <label htmlFor="project-title" className="absolute left-1 top-3 text-[14px] text-on-surface-variant transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-[14px] peer-focus:-top-2 peer-focus:text-[11px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:-top-2 peer-[:not(:placeholder-shown)]:text-[11px]">
                {t('proposal.project_name')}
              </label>
            </div>

            {/* Description */}
            <div className="relative">
              <textarea
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder=" "
                rows={4}
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 px-1 text-[16px] text-on-surface outline-none transition-colors peer resize-none"
                required
              />
              <label htmlFor="project-desc" className="absolute left-1 top-3 text-[14px] text-on-surface-variant transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-[14px] peer-focus:-top-2 peer-focus:text-[11px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:-top-2 peer-[:not(:placeholder-shown)]:text-[11px]">
                {t('proposal.objective')}
              </label>
            </div>

            {/* Expected Deliverable */}
            <div className="relative">
              <input
                type="text"
                id="expected-del"
                value={expectedDeliverable}
                onChange={(e) => setExpectedDeliverable(e.target.value)}
                placeholder=" "
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 px-1 text-[16px] text-on-surface outline-none transition-colors peer"
                required
              />
              <label htmlFor="expected-del" className="absolute left-1 top-3 text-[14px] text-on-surface-variant transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-[14px] peer-focus:-top-2 peer-focus:text-[11px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:-top-2 peer-[:not(:placeholder-shown)]:text-[11px]">
                {t('proposal.expected_deliverable')}
              </label>
            </div>

            {/* Team Members */}
            <div className="relative">
              <input
                type="text"
                id="team-members"
                value={teamMembers}
                onChange={(e) => setTeamMembers(e.target.value)}
                placeholder=" "
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 px-1 text-[16px] text-on-surface outline-none transition-colors peer"
                required
              />
              <label htmlFor="team-members" className="absolute left-1 top-3 text-[14px] text-on-surface-variant transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-[14px] peer-focus:-top-2 peer-focus:text-[11px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:-top-2 peer-[:not(:placeholder-shown)]:text-[11px]">
                {t('proposal.team_members')}
              </label>
            </div>

            {/* Assignment Details Button */}
            {assignment && (
              <button
                type="button"
                onClick={() => setShowAssignmentDetailsModal(true)}
                className="w-full flex items-center justify-between p-4 bg-primary-container/10 border border-primary/20 rounded-xl hover:bg-primary-container/20 transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container/50 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">assignment</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-on-surface group-hover:text-primary transition-colors">作業詳情：{assignment.title}</p>
                    <p className="text-[12px] text-on-surface-variant line-clamp-1 mt-0.5">點擊預覽作業要求與說明</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">open_in_full</span>
              </button>
            )}

            {/* Deadline */}
            <div>
              <label className="text-[11px] text-primary font-medium tracking-wider uppercase mb-1 block">{t('proposal.deadline')}</label>
              <DateTimePicker
                value={deadline}
                onChange={setDeadline}
                type="datetime-local"
                max={assignment ? (assignment.global_deadline.includes('T') ? assignment.global_deadline.slice(0, 16) : `${assignment.global_deadline}T23:59`) : undefined}
                required
              />
              {assignment && (
                <p className="text-[11px] text-on-surface-variant mt-1">
                  {t('assignment.deadline_hint').replace('{date}', new Date(assignment.global_deadline).toLocaleDateString())}
                </p>
              )}
            </div>

            {/* Gantt Upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[14px] text-on-surface-variant block">
                  {t('proposal.schedule_material')}
                </label>
                {proposalTemplateUrl && (
                  <a 
                    href={proposalTemplateUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[13px] text-primary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">description</span>
                    下載提案範本
                  </a>
                )}
              </div>
              <FileUploadZone
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.md,.csv,.html,.py,.js"
                label={t('proposal.upload_gantt')}
                sublabel={t('proposal.file_types')}
                onFilesSelected={(files) => setGanttFile(files[0])}
              />
            </div>

            {/* Submit Button */}
            {aiError && (
              <div className="rounded-xl bg-error-container text-on-error-container border border-error/20 p-4 text-[13px] leading-relaxed">
                {aiError}
              </div>
            )}

            <button
              type="submit"
              disabled={!title.trim() || !description.trim() || !expectedDeliverable.trim() || !teamMembers.trim() || !deadline || isGenerating}
              className="w-full bg-gradient-to-r from-primary to-tertiary text-on-primary text-[16px] font-medium py-4 rounded-full shadow-[0_16px_34px_rgba(164,48,115,0.22)] hover:shadow-[0_20px_42px_rgba(164,48,115,0.28)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              <span className="material-symbols-outlined text-[20px] sparkle-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              {t('proposal.generate_checkpoints')}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-6 animate-fade-up">
            <h3 className="text-[20px] font-medium text-on-surface mb-2">{t('proposal.preview_title')}</h3>
            
            <div className="flex flex-col gap-4">
              {previewCheckpoints.map((cp, index) => (
                <div key={cp.id} className="bg-surface border border-outline-variant/50 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 rounded-l-xl"></div>
                  
                  <div className="flex justify-between items-start">
                    <span className="text-[12px] font-bold text-primary bg-primary-container/30 px-2 py-0.5 rounded-full">
                      CP {index + 1}
                    </span>
                    <button 
                      onClick={() => deletePreviewCheckpoint(cp.id)}
                      className="text-on-surface-variant hover:text-error transition-colors"
                      title={t('proposal.delete')}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                  
                  <input 
                    type="text"
                    value={cp.title}
                    onChange={(e) => updatePreviewCheckpoint(cp.id, 'title', e.target.value)}
                    className="text-[16px] font-bold text-on-surface bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary outline-none py-1 transition-colors"
                    placeholder="Checkpoint Title"
                  />
                  
                  <textarea 
                    value={cp.goal_description}
                    onChange={(e) => updatePreviewCheckpoint(cp.id, 'goal_description', e.target.value)}
                    className="text-[14px] text-on-surface-variant bg-transparent border border-transparent hover:border-outline-variant focus:border-primary outline-none p-1 rounded resize-none"
                    rows={2}
                    placeholder="Goal Description"
                  />

                  <div className="flex gap-4">
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[11px] text-on-surface-variant">{t('proposal.deadline')}</label>
                      <input 
                        type="datetime-local"
                        value={cp.due_date}
                        onChange={(e) => updatePreviewCheckpoint(cp.id, 'due_date', e.target.value)}
                        className="text-[14px] text-on-surface bg-transparent border-b border-outline-variant/30 focus:border-primary outline-none py-1"
                      />
                    </div>
                    <div className="w-24 flex flex-col gap-1">
                      <label className="text-[11px] text-on-surface-variant">Weight (%)</label>
                      <input 
                        type="number"
                        value={cp.weight_percent}
                        onChange={(e) => updatePreviewCheckpoint(cp.id, 'weight_percent', parseInt(e.target.value) || 0)}
                        className="text-[14px] text-on-surface bg-transparent border-b border-outline-variant/30 focus:border-primary outline-none py-1"
                      />
                    </div>
                  </div>

                  {/* Criteria Section */}
                  <div className="mt-2 border-t border-outline-variant/30 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[12px] font-bold text-on-surface flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">checklist</span>
                        評分標準 (Criteria)
                      </h4>
                      <button 
                        onClick={() => addCriterion(cp.id)}
                        className="text-[11px] text-primary hover:bg-primary-container/30 px-2 py-0.5 rounded-full transition-colors"
                      >
                        + Add
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {(cp.criteria || []).map((c) => (
                        <div key={c.id} className="flex gap-2 items-start bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20">
                          <div className="flex-1 flex flex-col gap-1">
                            <input 
                              type="text"
                              value={c.label}
                              onChange={(e) => updateCriterion(cp.id, c.id, 'label', e.target.value)}
                              className="text-[13px] font-medium text-on-surface bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary outline-none"
                              placeholder="Criterion Label"
                            />
                            <textarea 
                              value={c.description}
                              onChange={(e) => updateCriterion(cp.id, c.id, 'description', e.target.value)}
                              className="text-[12px] text-on-surface-variant bg-transparent border border-transparent hover:border-outline-variant focus:border-primary outline-none rounded resize-none"
                              rows={1}
                              placeholder="Description"
                            />
                          </div>
                          <div className="w-16 flex flex-col gap-1 shrink-0">
                            <input 
                              type="number"
                              value={c.weight}
                              onChange={(e) => updateCriterion(cp.id, c.id, 'weight', parseInt(e.target.value) || 0)}
                              className="text-[13px] text-center text-on-surface bg-transparent border-b border-outline-variant/30 focus:border-primary outline-none"
                              title="Weight (%)"
                            />
                          </div>
                          <button 
                            onClick={() => deleteCriterion(cp.id, c.id)}
                            className="text-on-surface-variant hover:text-error transition-colors mt-1"
                            title="Delete criterion"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </div>
                      ))}
                      {(!cp.criteria || cp.criteria.length === 0) && (
                        <p className="text-[11px] text-on-surface-variant italic text-center py-1">No criteria added. Click + Add.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={addPreviewCheckpoint}
              className="w-full py-3 border-2 border-dashed border-outline-variant text-on-surface-variant rounded-xl hover:bg-surface-variant/30 hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-2 mt-2"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              {t('proposal.add_checkpoint')}
            </button>

            <div className="rounded-2xl border border-primary/20 bg-primary-container/10 p-4">
              <p className="text-[14px] font-bold text-on-surface">你現在對設計方向有多清楚？</p>
              <div className="mt-3 grid grid-cols-5 gap-2" role="radiogroup" aria-label="設計方向清楚度">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setDirectionClarity(String(value));
                      setProbeError('');
                    }}
                    className={`h-11 rounded-full border text-[14px] font-bold transition-colors ${
                      directionClarity === String(value)
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-outline-variant/50 bg-surface text-on-surface-variant hover:border-primary/50'
                    }`}
                    aria-pressed={directionClarity === String(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-on-surface-variant">
                <span>非常不清楚</span>
                <span>非常清楚</span>
              </div>
              {probeError && (
                <p className="mt-3 text-[12px] text-error">{probeError}</p>
              )}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 bg-surface-variant text-on-surface-variant py-4 rounded-full font-medium hover:bg-outline-variant/30 transition-colors"
              >
                {t('proposal.cancel')}
              </button>
              <button
                onClick={handleConfirmStart}
                disabled={!directionClarity}
                className="flex-[2] bg-gradient-to-r from-primary to-tertiary text-on-primary text-[16px] font-medium py-4 rounded-full shadow-[0_16px_34px_rgba(164,48,115,0.22)] hover:shadow-[0_20px_42px_rgba(164,48,115,0.28)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('proposal.confirm_start')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Details Modal */}
      {showAssignmentDetailsModal && assignment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-dim/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-2xl max-h-[85vh] rounded-[28px] shadow-elevation-3 flex flex-col overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant/30">
              <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">assignment</span>
                {assignment.title}
              </h3>
              <button 
                onClick={() => setShowAssignmentDetailsModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant/50 text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto">
              <MarkdownRenderer 
                content={assignment.requirement_description}
                className="text-[14px] text-on-surface-variant leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
