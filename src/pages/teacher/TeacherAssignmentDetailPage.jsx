import { useNavigate, useParams } from 'react-router-dom';
import { getAssignment, getProjects } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';
import MarkdownRenderer from '../../components/ui/MarkdownRenderer';

export default function TeacherAssignmentDetailPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  
  const assignment = getAssignment(assignmentId);
  const allProjects = getProjects();
  const relatedProjects = allProjects.filter(p => p.assignment_id === assignmentId);

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
      <div className="px-[var(--spacing-page)] max-w-2xl mx-auto pt-4 pb-32">
        <h2 className="text-[24px] font-bold text-primary text-center mt-[var(--spacing-stack-md)] mb-[var(--spacing-stack-lg)] animate-fade-up">
          {t('assignment.detail_title') || 'Assignment Details'}
        </h2>

        <GlassCard className="p-6 mb-8 animate-fade-up delay-100">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-[20px] font-bold text-on-surface leading-snug">{assignment.title}</h3>
            <button 
              onClick={() => navigate(`/teacher/assignments/${assignmentId}/edit`)}
              className="ml-4 shrink-0 bg-primary-container text-primary text-[14px] font-medium px-4 py-1.5 rounded-full hover:bg-primary-container/80 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              {t('assignment.edit') || 'Edit'}
            </button>
          </div>
          
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
          <GlassCard className="p-5 bg-surface-variant/10 border-outline-variant/50">
            <h4 className="text-[14px] font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">group</span>
              {t('assignment.groups_submitted') || 'Submitted Projects'} ({relatedProjects.length})
            </h4>
            
            {relatedProjects.length > 0 ? (
              <div className="flex flex-col gap-3">
                {relatedProjects.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-surface-variant/30 p-3 rounded-lg cursor-pointer hover:bg-surface-variant/50 transition-colors" onClick={() => navigate(`/teacher/projects/${p.id}`)}>
                    <div>
                      <p className="text-[14px] font-medium text-on-surface">{p.title}</p>
                      <p className="text-[12px] text-on-surface-variant">By: {p.created_by}</p>
                    </div>
                    <span className="material-symbols-outlined text-primary text-[18px]">chevron_right</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-on-surface-variant text-center py-4">No projects submitted yet.</p>
            )}
          </GlassCard>
        </div>
      </div>
    </>
  );
}
