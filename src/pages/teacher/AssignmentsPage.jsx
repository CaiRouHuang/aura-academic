import { useNavigate } from 'react-router-dom';
import { getAssignmentsByTeacher, getCurrentUser, getProjects } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';

export default function TeacherAssignmentsPage() {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const user = getCurrentUser();
  const assignments = getAssignmentsByTeacher(user?.id || 'demo-teacher');
  const allProjects = getProjects();

  return (
    <>
      <TopBar title="NAVI" />
      <div className="px-[var(--spacing-page)] max-w-2xl mx-auto pt-4 pb-32">
        <h2 className="text-[24px] font-bold text-primary text-center mt-[var(--spacing-stack-md)] mb-[var(--spacing-stack-lg)] animate-fade-up">
          {t('assignment.list_title')}
        </h2>

        <div className="flex flex-col gap-[var(--spacing-stack-md)]">
          {assignments.length > 0 ? (
            assignments.map((assignment, idx) => {
              const relatedProjects = allProjects.filter(p => p.assignment_id === assignment.id);
              const isExpired = new Date(assignment.global_deadline) < new Date();
              
              return (
                <GlassCard 
                  key={assignment.id} 
                  hover 
                  className="p-[var(--spacing-stack-md)] animate-fade-up cursor-pointer"
                  style={{ animationDelay: `${(idx + 1) * 100}ms` }}
                  onClick={() => navigate(`/teacher/assignments/${assignment.id}`)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-[18px] font-bold text-on-surface flex-1 pr-4">{assignment.title}</h3>
                    <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${isExpired ? 'bg-surface-variant text-on-surface-variant border-outline-variant' : 'bg-primary-container/20 text-primary border-primary/10'}`}>
                      {isExpired ? t('assignment.status_expired') : t('assignment.status_active')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-outline-variant/30 text-[13px] text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">group</span>
                      <span className="font-medium text-on-surface">{relatedProjects.length}</span> {t('assignment.groups_submitted')}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">event</span>
                      {new Date(assignment.global_deadline).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'zh-TW')}
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

      <button 
        aria-label="Create new assignment" 
        onClick={() => navigate('/teacher/assignments/new')}
        className="fixed bottom-28 right-[var(--spacing-page)] w-14 h-14 bg-gradient-to-br from-tertiary-container to-primary-container text-on-primary-container rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 z-40"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </>
  );
}
