import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProject, createCheckpoints, addLog, getAssignment } from '../../lib/store';
import { generateProjectCheckpoints } from '../../lib/ai';
import { logSystemEvent } from '../../lib/eventLogger';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import FileUploadZone from '../../components/ui/FileUploadZone';
import MarkdownRenderer from '../../components/ui/MarkdownRenderer';

export default function ProposalPage() {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const { t } = useTranslation();
  
  const [assignment, setAssignment] = useState(null);
  
  useEffect(() => {
    if (assignmentId) {
      setAssignment(getAssignment(assignmentId));
    }
  }, [assignmentId]);

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

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !expectedDeliverable.trim() || !teamMembers.trim()) return;

    setIsGenerating(true);
    setAiError('');

    try {
      const checkpoints = await generateProjectCheckpoints({
        title: title.trim(),
        description: description.trim(),
        expected_deliverable: expectedDeliverable.trim(),
        team_members: teamMembers.trim(),
        deadline: deadline || null,
        gantt_file_name: ganttFile ? ganttFile.name : null,
      });

      setPreviewCheckpoints(checkpoints);
      setShowPreview(true);
    } catch (error) {
      setAiError(error.message || 'AI checkpoint generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmStart = () => {
    // 1. Create project
    const project = createProject({
      assignment_id: assignmentId || null,
      title: title.trim(),
      description: description.trim(),
      expected_deliverable: expectedDeliverable.trim(),
      team_members: teamMembers.trim(),
      deadline: deadline || null,
      gantt_file_url: ganttFile ? ganttFile.name : null,
      created_by: 'demo-student',
      status: 'active'
    });

    // 2. Create checkpoints without temp ids
    const finalCheckpoints = previewCheckpoints.map(cp => {
      const rest = { ...cp };
      delete rest.id;
      return rest;
    });
    createCheckpoints(project.id, finalCheckpoints);
    
    // 3. Add Log
    addLog(project.id, 'checkpoint_generated', `${t('proposal.ai_generated_log')}（${finalCheckpoints.length}件）`);

    // ── Research LOG: Project Created ──
    logSystemEvent({
      event_subtype: 'project_created',
      student_id: 'demo-student',
      detail: `Project "${title.trim()}" created with ${finalCheckpoints.length} checkpoints`,
      metadata: { project_id: project.id, checkpoint_count: finalCheckpoints.length },
    });

    navigate(`/projects/${project.id}/checkpoints`);
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
      <TopBar title="NAVI" showBack />
      <div className="px-[var(--spacing-page)] max-w-2xl mx-auto pt-4 md:pt-8 pb-32">
        <h2 className="text-[22px] text-primary text-center mt-[var(--spacing-stack-lg)] mb-2 animate-fade-up font-medium">
          {t('proposal.title')}
        </h2>
        <p className="text-[14px] text-on-surface-variant text-center mb-[var(--spacing-stack-xl)] leading-relaxed animate-fade-up delay-100">
          {t('proposal.subtitle')}
        </p>

        {assignment && (
          <div className="mb-8 p-5 bg-primary-container/10 border border-primary/20 rounded-xl animate-fade-up">
            <h3 className="text-[14px] font-bold text-primary mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">assignment</span>
              {assignment.title}
            </h3>
            <MarkdownRenderer 
              content={assignment.requirement_description}
              className="text-[13px] text-on-surface-variant line-clamp-3"
            />
          </div>
        )}

        {!showPreview ? (
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

            {/* Deadline */}
            <div>
              <label className="text-[11px] text-primary font-medium tracking-wider uppercase mb-1 block">{t('proposal.deadline')}</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                max={assignment ? assignment.global_deadline.split('T')[0] : undefined}
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 px-1 text-[16px] text-on-surface outline-none transition-colors"
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
              <label className="text-[14px] text-on-surface-variant mb-2 block">
                {t('proposal.schedule_material')}
              </label>
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
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('proposal.ai_analyzing')}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px] sparkle-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  {t('proposal.generate_checkpoints')}
                </>
              )}
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
                        type="date"
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
                      {(cp.criteria || []).map((c, cIdx) => (
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

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 bg-surface-variant text-on-surface-variant py-4 rounded-full font-medium hover:bg-outline-variant/30 transition-colors"
              >
                {t('proposal.cancel')}
              </button>
              <button
                onClick={handleConfirmStart}
                className="flex-[2] bg-gradient-to-r from-primary to-tertiary text-on-primary text-[16px] font-medium py-4 rounded-full shadow-[0_16px_34px_rgba(164,48,115,0.22)] hover:shadow-[0_20px_42px_rgba(164,48,115,0.28)] transition-all flex items-center justify-center gap-2"
              >
                {t('proposal.confirm_start')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
