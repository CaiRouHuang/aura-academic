import { useNavigate } from 'react-router-dom';
import { getProjects, getScoringSessions, getAssignmentsByTeacher, getCurrentUser } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';
import ProgressBar from '../../components/ui/ProgressBar';
import StatusBadge from '../../components/ui/StatusBadge';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = getCurrentUser();
  const allProjects = getProjects();
  const assignments = getAssignmentsByTeacher(user?.id || 'demo-teacher');
  const activeProjects = allProjects.filter(p => p.status === 'active' || p.status === 'reviewing' || p.status === 'completed');

  // Calculate overall progress
  const scoredCount = activeProjects.filter(p => {
    const sessions = getScoringSessions(p.id);
    return sessions.some(s => s.status === 'completed');
  }).length;
  const totalCount = activeProjects.length;
  const overallProgress = totalCount > 0 ? Math.round((scoredCount / totalCount) * 100) : 0;

  return (
    <>
      <TopBar title="NAVI" />
      <div className="px-[var(--spacing-page)] max-w-lg mx-auto">
        <h2 className="text-[24px] font-bold text-primary text-center mt-[var(--spacing-stack-md)] mb-[var(--spacing-stack-lg)] animate-fade-up">
          {t('dashboard.title')}
        </h2>

        {/* Overall Progress */}
        <section className="mb-[var(--spacing-stack-xl)] animate-fade-up delay-100">
          <GlassCard>
            <div className="flex justify-between items-end mb-2">
              <span className="text-[14px] text-on-surface">{t('dashboard.overall_progress')}</span>
              <span className="text-[14px] text-on-surface-variant">
                <span className="text-[24px] font-bold text-primary">{scoredCount}</span> / {totalCount} {t('dashboard.group_completed')}
              </span>
            </div>
            <ProgressBar value={overallProgress} />
          </GlassCard>
        </section>

        {/* Assignments Quick Access */}
        <section className="mb-[var(--spacing-stack-xl)] animate-fade-up delay-150">
          <div className="flex justify-between items-end mb-4 px-1">
            <h3 className="text-[18px] text-on-surface font-light">{t('assignment.list_title')}</h3>
            <button 
              onClick={() => navigate('/teacher/assignments')}
              className="text-[13px] text-primary hover:text-tertiary transition-colors flex items-center gap-1 font-medium"
            >
              {t('home.view_all')}
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <GlassCard hover className="p-4 flex flex-col items-center justify-center text-center cursor-pointer group" onClick={() => navigate('/teacher/assignments/new')}>
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[20px]">add</span>
              </div>
              <span className="text-[13px] font-medium text-on-surface">{t('assignment.create_title')}</span>
            </GlassCard>
            
            <GlassCard hover className="p-4 flex flex-col justify-center cursor-pointer" onClick={() => navigate('/teacher/assignments')}>
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-[20px] text-secondary">assignment</span>
                <span className="text-[24px] font-bold text-on-surface">{assignments.length}</span>
              </div>
              <span className="text-[13px] text-on-surface-variant">{t('assignment.active_count')}</span>
            </GlassCard>
          </div>
        </section>

        {/* Project List */}
        <section className="flex flex-col gap-[var(--spacing-stack-md)] animate-fade-up delay-200">
          <div className="px-1 mb-1">
            <h3 className="text-[18px] text-on-surface font-light">{t('assignment.target_projects')}</h3>
          </div>
          {activeProjects.map((project, idx) => {
            const sessions = getScoringSessions(project.id);
            const isScored = sessions.some(s => s.status === 'completed');
            const progress = isScored ? 100 : 45; // Demo logic

            return (
              <GlassCard
                key={project.id}
                hover
                onClick={() => navigate(`/teacher/projects/${project.id}`)}
                className={`flex gap-[var(--spacing-stack-md)] items-stretch overflow-hidden relative p-0 ${isScored ? 'opacity-80' : ''}`}
                style={{ animationDelay: `${(idx + 1) * 100}ms` }}
              >
                {/* Status colored left border */}
                <div className={`w-1.5 shrink-0 ${isScored ? 'bg-status-pass' : 'bg-outline-variant/30'}`} />

                <div className="flex-1 py-[var(--spacing-stack-md)] pr-[var(--spacing-stack-md)]">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[12px] text-on-surface-variant font-medium">
                      Group {String.fromCharCode(65 + idx)}
                    </span>
                    <StatusBadge status={isScored ? 'scored' : 'unscored'} />
                  </div>
                  <h3 className="text-[16px] font-bold text-on-surface mb-3 line-clamp-1">
                    {project.title}
                  </h3>
                  <div className="flex justify-between items-center text-[12px]">
                    <ProgressBar value={progress} className="flex-1 mr-4" />
                    <span className="text-on-surface-variant w-8 text-right font-medium">{progress}%</span>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </section>
      </div>
    </>
  );
}
