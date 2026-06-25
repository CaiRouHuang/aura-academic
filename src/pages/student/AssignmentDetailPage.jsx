import { useNavigate, useParams } from 'react-router-dom';
import { getAssignment, getProjects } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';
import MarkdownRenderer from '../../components/ui/MarkdownRenderer';

export default function AssignmentDetailPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  
  const assignment = getAssignment(assignmentId);
  const allProjects = getProjects();
  const relatedProject = allProjects.find(p => p.assignment_id === assignmentId);

  if (!assignment) {
    return (
      <>
        <TopBar showBack />
        <div className="p-8 text-center text-on-surface-variant">Assignment not found</div>
      </>
    );
  }

  const isExpired = new Date(assignment.global_deadline) < new Date();

  return (
    <>
      <TopBar title="NAVI" showBack />
      <div className="px-[var(--spacing-page)] max-w-2xl mx-auto pt-4 md:pt-8 pb-32">
        <h2 className="text-[22px] text-primary text-center mt-[var(--spacing-stack-lg)] mb-[var(--spacing-stack-xl)] animate-fade-up font-medium">
          {t('assignment.detail_title')}
        </h2>

        <GlassCard className="p-6 mb-8 animate-fade-up delay-100">
          <h3 className="text-[20px] font-bold text-on-surface mb-6 leading-snug">{assignment.title}</h3>
          
          <div className="mb-6">
            <h4 className="text-[12px] font-bold text-primary tracking-wider uppercase mb-2">
              {t('assignment.requirement')}
            </h4>
            <MarkdownRenderer 
              content={assignment.requirement_description}
              className="text-[15px] text-on-surface-variant"
            />
          </div>

          {assignment.scoring_criteria && (
            <div className="mb-6">
              <h4 className="text-[12px] font-bold text-primary tracking-wider uppercase mb-2">
                {t('assignment.scoring_criteria')}
              </h4>
              <div className="bg-surface-variant/30 p-4 rounded-xl border border-outline-variant/30">
                <MarkdownRenderer 
                  content={assignment.scoring_criteria}
                  className="text-[15px] text-on-surface-variant"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-8 pt-4 border-t border-outline-variant/50">
            <span className="material-symbols-outlined text-[20px] text-primary">event</span>
            <span className={`text-[14px] font-medium ${isExpired ? 'text-error' : 'text-on-surface-variant'}`}>
              {t('assignment.deadline')} {new Date(assignment.global_deadline).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </GlassCard>

        <div className="animate-fade-up delay-200">
          {relatedProject ? (
            <GlassCard className="p-5 flex justify-between items-center bg-primary-container/10 border-primary/20">
              <div>
                <p className="text-[12px] text-primary font-bold mb-1">{t('assignment.already_created')}</p>
                <p className="text-[16px] text-on-surface font-medium">{relatedProject.title}</p>
              </div>
              <button
                onClick={() => navigate(`/projects/${relatedProject.id}/checkpoints`)}
                className="bg-primary text-on-primary text-[14px] font-medium px-4 py-2 rounded-full hover:bg-primary/90 transition-colors"
              >
                {t('assignment.view_project')}
              </button>
            </GlassCard>
          ) : (
            <button
              onClick={() => navigate(`/assignments/${assignmentId}/new-project`)}
              disabled={isExpired}
              className="w-full bg-gradient-to-r from-primary to-tertiary text-on-primary text-[16px] font-medium py-4 rounded-full shadow-[0_16px_34px_rgba(164,48,115,0.22)] hover:shadow-[0_20px_42px_rgba(164,48,115,0.28)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">add_task</span>
              {t('assignment.create_project')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
