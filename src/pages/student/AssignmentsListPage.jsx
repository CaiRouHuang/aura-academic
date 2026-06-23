import { useNavigate } from 'react-router-dom';
import { getAssignments, getProjects } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';

export default function AssignmentsListPage() {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const assignments = getAssignments();
  const allProjects = getProjects();

  return (
    <>
      <TopBar title="Aura Academic" />
      <div className="px-[var(--spacing-page)] max-w-2xl mx-auto pt-4 md:pt-8 pb-32">
        <h2 className="text-[22px] text-primary text-center mt-[var(--spacing-stack-lg)] mb-[var(--spacing-stack-xl)] animate-fade-up font-medium">
          {t('assignment.list_title')}
        </h2>

        <div className="flex flex-col gap-[var(--spacing-stack-md)]">
          {assignments.length > 0 ? (
            assignments.map((assignment, idx) => {
              const relatedProject = allProjects.find(p => p.assignment_id === assignment.id);
              const isExpired = new Date(assignment.global_deadline) < new Date();
              
              return (
                <GlassCard 
                  key={assignment.id} 
                  hover 
                  className={`p-[var(--spacing-stack-md)] animate-fade-up cursor-pointer ${relatedProject ? 'opacity-70' : ''}`}
                  style={{ animationDelay: `${(idx + 1) * 100}ms` }}
                  onClick={() => {
                    if (relatedProject) {
                      navigate(`/projects/${relatedProject.id}/checkpoints`);
                    } else {
                      navigate(`/assignments/${assignment.id}`);
                    }
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-[18px] font-bold text-on-surface flex-1 pr-4">{assignment.title}</h3>
                    {relatedProject ? (
                      <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border bg-surface-variant text-on-surface-variant border-outline-variant">
                        {t('assignment.already_created')}
                      </span>
                    ) : (
                      <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${isExpired ? 'bg-error-container text-on-error-container border-error/20' : 'bg-primary-container/20 text-primary border-primary/10'}`}>
                        {isExpired ? t('assignment.status_expired') : t('assignment.status_unproposed')}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-outline-variant/30 text-[13px] text-on-surface-variant">
                    <div className={`flex items-center gap-1.5 ${isExpired ? 'text-error' : ''}`}>
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      {t('assignment.deadline')} {new Date(assignment.global_deadline).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </GlassCard>
              );
            })
          ) : (
            <div className="text-center py-16 animate-fade-up delay-200">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30 mb-4">assignment</span>
              <p className="text-[14px] text-on-surface-variant">{t('assignment.no_assignments')}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
