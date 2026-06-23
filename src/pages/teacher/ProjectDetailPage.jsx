import { useParams, useNavigate } from 'react-router-dom';
import { getProject, getCheckpoints, getSubmissionsByProject, getAIReviews } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const project = getProject(projectId);

  if (!project) {
    return (
      <>
        <TopBar showBack title="Project Details" />
        <div className="px-[var(--spacing-page)] text-center py-20">
          <p className="text-on-surface-variant">{t('project_detail.not_found')}</p>
        </div>
      </>
    );
  }

  const checkpoints = getCheckpoints(projectId);
  const submissions = getSubmissionsByProject(projectId);
  const reviews = getAIReviews(projectId);

  // Calculate average AI score
  const avgScore = reviews.length > 0
    ? Math.round(reviews.reduce((acc, r) => acc + r.completion_rate, 0) / reviews.length)
    : 85;

  // Gather all unique files submitted
  const allFiles = Array.from(new Set(submissions.flatMap(s => s.file_urls)));

  return (
    <>
      <TopBar showBack title="Project Details" />
      <div className="px-[var(--spacing-page)] max-w-lg mx-auto">
        {/* Header */}
        <header className="mt-[var(--spacing-stack-md)] mb-[var(--spacing-stack-lg)] animate-fade-up">
          <div className="flex justify-between items-center mb-2">
            <span className="bg-secondary-container text-on-secondary-container text-[12px] font-medium px-3 py-1 rounded-full">
              Group A
            </span>
            <span className="text-[12px] text-on-surface-variant">
              {new Date(project.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
            </span>
          </div>
          <h2 className="text-[24px] font-light text-on-surface leading-tight">
            {project.title}
          </h2>
        </header>

        {/* AI Analysis Card */}
        <section className="mb-[var(--spacing-stack-lg)] animate-fade-up delay-100">
          <GlassCard className="relative overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <h3 className="text-[14px] font-medium text-primary">{t('project_detail.ai_analysis')}</h3>
            </div>

            <div className="flex flex-col items-center">
              {/* Score Ring */}
              <div className="relative w-32 h-32 mb-6">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-surface-variant)" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${avgScore * 2.64} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[32px] font-light text-on-surface">{avgScore}<span className="text-[16px]">%</span></span>
                </div>
              </div>

              {/* AI Insights List */}
              <div className="w-full flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-status-pass mt-0.5">check_circle</span>
                  <span className="text-[14px] text-on-surface">{t('project_detail.logic_clear')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-status-warning mt-0.5">error</span>
                  <span className="text-[14px] text-on-surface">{t('project_detail.ref_lacking')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-status-pass mt-0.5">check_circle</span>
                  <span className="text-[14px] text-on-surface">{t('project_detail.practicality_good')}</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Submitted Files */}
        <section className="mb-[var(--spacing-stack-lg)] animate-fade-up delay-200">
          <h3 className="text-[14px] text-on-surface-variant mb-3">{t('project_detail.submitted_docs')}</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {allFiles.length > 0 ? allFiles.map((file, idx) => (
              <GlassCard key={idx} hover className="min-w-[120px] w-[120px] shrink-0 flex flex-col items-center p-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${file.endsWith('.pdf') ? 'bg-secondary-fixed text-secondary' : 'bg-primary-fixed text-primary'}`}>
                  <span className="material-symbols-outlined text-[24px]">
                    {file.endsWith('.pdf') ? 'picture_as_pdf' : file.endsWith('.docx') ? 'description' : 'insert_drive_file'}
                  </span>
                </div>
                <span className="text-[12px] text-on-surface text-center truncate w-full">{file}</span>
              </GlassCard>
            )) : (
              <div className="text-[12px] text-on-surface-variant italic px-2">{t('project_detail.no_docs')}</div>
            )}
          </div>
        </section>

        {/* Timeline */}
        <section className="mb-[var(--spacing-stack-xl)] animate-fade-up delay-300">
          <h3 className="text-[14px] text-on-surface-variant mb-4">{t('project_detail.timeline')}</h3>
          <div className="flex flex-col gap-6 relative ml-2">
            <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-outline-variant/30" />
            {checkpoints.map(cp => (
              <div key={cp.id} className="flex gap-4 items-start relative">
                <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 relative z-10 ${cp.status === 'passed' ? 'bg-secondary' : cp.status === 'pending' ? 'bg-surface-variant' : 'bg-primary'}`} />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[14px] ${cp.status === 'passed' ? 'text-secondary' : cp.status === 'pending' ? 'text-on-surface-variant' : 'text-primary font-medium'}`}>
                      Phase {cp.order_index}: {cp.title}
                    </span>
                    <span className="text-[12px] text-on-surface-variant">
                      {cp.due_date ? new Date(cp.due_date).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }) : 'Now'}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${cp.status === 'passed' ? 'bg-secondary-container/50 text-secondary' : cp.status === 'pending' ? 'hidden' : 'bg-primary-container/50 text-primary'}`}>
                    {cp.status === 'passed' ? 'Pass' : 'Reviewing'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Evaluate Button */}
        <div className="sticky bottom-24 pb-4 animate-fade-up delay-400">
          <button
            onClick={() => navigate(`/teacher/projects/${projectId}/score`)}
            className="w-full bg-secondary hover:bg-secondary/90 text-on-secondary text-[16px] font-medium py-4 rounded-full shadow-lg transition-colors flex items-center justify-center gap-2"
          >
            {t('project_detail.proceed_eval')}
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </>
  );
}
