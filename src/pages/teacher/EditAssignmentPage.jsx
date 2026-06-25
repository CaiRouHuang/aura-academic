import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAssignment, updateAssignment, getCurrentUser } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import MarkdownRenderer from '../../components/ui/MarkdownRenderer';

export default function EditAssignmentPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = getCurrentUser();

  const [title, setTitle] = useState('');
  const [requirementDesc, setRequirementDesc] = useState('');
  const [scoringCriteria, setScoringCriteria] = useState('');
  const [deadline, setDeadline] = useState('');
  
  const [previewRequirement, setPreviewRequirement] = useState(false);
  const [previewScoring, setPreviewScoring] = useState(false);

  useEffect(() => {
    const assignment = getAssignment(assignmentId);
    if (assignment) {
      setTitle(assignment.title);
      setRequirementDesc(assignment.requirement_description);
      setScoringCriteria(assignment.scoring_criteria || '');
      setDeadline(assignment.global_deadline ? new Date(assignment.global_deadline).toISOString().split('T')[0] : '');
    } else {
      navigate('/teacher/assignments');
    }
  }, [assignmentId, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !requirementDesc.trim() || !deadline) return;

    updateAssignment(assignmentId, {
      title: title.trim(),
      requirement_description: requirementDesc.trim(),
      scoring_criteria: scoringCriteria.trim(),
      global_deadline: deadline,
    });

    navigate(`/teacher/assignments/${assignmentId}`);
  };

  return (
    <>
      <TopBar title="NAVI" showBack />
      <div className="px-[var(--spacing-page)] max-w-2xl mx-auto pt-4 pb-32">
        <h2 className="text-[24px] font-bold text-primary text-center mt-[var(--spacing-stack-md)] mb-[var(--spacing-stack-lg)] animate-fade-up">
          {t('assignment.edit_title') || 'Edit Assignment'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8 animate-fade-up delay-100">
          <div className="relative">
            <input
              type="text"
              id="assignment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=" "
              className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 px-1 text-[16px] text-on-surface outline-none transition-colors peer"
              required
            />
            <label htmlFor="assignment-title" className="absolute left-1 top-3 text-[14px] text-on-surface-variant transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-[14px] peer-focus:-top-2 peer-focus:text-[11px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:-top-2 peer-[:not(:placeholder-shown)]:text-[11px]">
              {t('assignment.title_label')}
            </label>
          </div>

          <div className="relative pt-6">
            <div className="absolute right-0 top-0 flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewRequirement(false)}
                className={`text-[12px] font-medium px-2 py-1 rounded transition-colors ${!previewRequirement ? 'bg-primary-container text-primary' : 'text-on-surface-variant hover:bg-surface-variant/50'}`}
              >
                {t('assignment.edit')}
              </button>
              <button
                type="button"
                onClick={() => setPreviewRequirement(true)}
                className={`text-[12px] font-medium px-2 py-1 rounded transition-colors ${previewRequirement ? 'bg-primary-container text-primary' : 'text-on-surface-variant hover:bg-surface-variant/50'}`}
              >
                {t('assignment.preview')}
              </button>
            </div>
            {previewRequirement ? (
              <div className="w-full bg-surface-variant/20 border-b border-outline-variant/50 py-4 px-1 min-h-[160px] max-h-[400px] overflow-y-auto">
                <MarkdownRenderer content={requirementDesc || '*内容がありません*'} />
              </div>
            ) : (
              <textarea
                id="requirement-desc"
                value={requirementDesc}
                onChange={(e) => setRequirementDesc(e.target.value)}
                placeholder=" "
                rows={6}
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 px-1 text-[16px] text-on-surface outline-none transition-colors peer resize-y"
                required
              />
            )}
            <label htmlFor="requirement-desc" className="absolute left-1 top-6 text-[14px] text-on-surface-variant transition-all peer-placeholder-shown:top-6 peer-placeholder-shown:text-[14px] peer-focus:top-0 peer-focus:text-[11px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[11px] -translate-y-full peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-full peer-[:not(:placeholder-shown)]:-translate-y-full">
              {t('assignment.requirement')} (Markdown)
            </label>
          </div>

          <div className="relative pt-6">
            <div className="absolute right-0 top-0 flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewScoring(false)}
                className={`text-[12px] font-medium px-2 py-1 rounded transition-colors ${!previewScoring ? 'bg-primary-container text-primary' : 'text-on-surface-variant hover:bg-surface-variant/50'}`}
              >
                {t('assignment.edit')}
              </button>
              <button
                type="button"
                onClick={() => setPreviewScoring(true)}
                className={`text-[12px] font-medium px-2 py-1 rounded transition-colors ${previewScoring ? 'bg-primary-container text-primary' : 'text-on-surface-variant hover:bg-surface-variant/50'}`}
              >
                {t('assignment.preview')}
              </button>
            </div>
            {previewScoring ? (
              <div className="w-full bg-surface-variant/20 border-b border-outline-variant/50 py-4 px-1 min-h-[120px] max-h-[300px] overflow-y-auto">
                <MarkdownRenderer content={scoringCriteria || '*内容がありません*'} />
              </div>
            ) : (
              <textarea
                id="scoring-criteria"
                value={scoringCriteria}
                onChange={(e) => setScoringCriteria(e.target.value)}
                placeholder=" "
                rows={4}
                className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 px-1 text-[16px] text-on-surface outline-none transition-colors peer resize-y"
              />
            )}
            <label htmlFor="scoring-criteria" className="absolute left-1 top-6 text-[14px] text-on-surface-variant transition-all peer-placeholder-shown:top-6 peer-placeholder-shown:text-[14px] peer-focus:top-0 peer-focus:text-[11px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[11px] -translate-y-full peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-full peer-[:not(:placeholder-shown)]:-translate-y-full">
              {t('assignment.scoring_criteria')} (Markdown)
            </label>
          </div>

          <div>
            <label className="text-[11px] text-primary font-medium tracking-wider uppercase mb-1 block">{t('assignment.deadline')}</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 px-1 text-[16px] text-on-surface outline-none transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={!title.trim() || !requirementDesc.trim() || !deadline}
            className="w-full bg-gradient-to-r from-primary to-tertiary text-on-primary text-[16px] font-medium py-4 rounded-full shadow-[0_16px_34px_rgba(164,48,115,0.22)] hover:shadow-[0_20px_42px_rgba(164,48,115,0.28)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            {t('assignment.save_btn') || 'Save Changes'}
          </button>
        </form>
      </div>
    </>
  );
}
