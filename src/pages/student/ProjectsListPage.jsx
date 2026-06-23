import { useNavigate } from 'react-router-dom';
import { getProjects, getCheckpoints } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';

export default function ProjectsListPage() {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const projects = getProjects();

  const getProjectStats = (projectId) => {
    const cps = getCheckpoints(projectId);
    if (cps.length === 0) return { progress: 0, status: t('projects.not_started'), statusColor: 'bg-surface-variant text-on-surface-variant border-outline-variant' };
    
    const passed = cps.filter(c => c.status === 'passed').length;
    const progress = Math.round((passed / cps.length) * 100);
    
    let status = t('projects.in_progress');
    let statusColor = 'bg-primary-container/20 text-primary border-primary/10'; // Default in progress
    
    if (progress === 100) {
      status = t('projects.submitted');
      statusColor = 'bg-surface-variant text-on-surface-variant border-outline-variant';
    } else {
      const currentCp = cps.find(c => c.status !== 'passed');
      if (currentCp && currentCp.status === 'under_review') {
        status = t('projects.waiting_feedback');
        statusColor = 'bg-secondary-container/20 text-secondary border-secondary/10';
      }
    }

    return { progress, status, statusColor };
  };

  return (
    <>
      <TopBar title="Aura Academic" showBack />
      <main className="px-[var(--spacing-page)] max-w-3xl mx-auto pt-4 md:pt-8 pb-32">
        {/* Header */}
        <h2 className="text-[22px] text-primary text-center mt-[var(--spacing-stack-lg)] mb-2 animate-fade-up font-medium">
          {t('projects.title')}
        </h2>
        <p className="text-[14px] text-on-surface-variant text-center mb-[var(--spacing-stack-xl)] leading-relaxed animate-fade-up delay-100">
          {t('projects.subtitle')}
        </p>

        {/* Project List */}
        <div className="flex flex-col gap-[var(--spacing-stack-md)]">
          {projects.length > 0 ? (
            projects.map((project, idx) => {
              const { progress, status, statusColor } = getProjectStats(project.id);
              return (
                <GlassCard 
                  key={project.id} 
                  hover 
                  className="rounded-xl p-[var(--spacing-stack-md)] animate-fade-up cursor-pointer"
                  style={{ animationDelay: `${(idx + 1) * 100}ms` }}
                  onClick={() => navigate(`/projects/${project.id}/checkpoints`)}
                >
                  <div className="flex justify-between items-start mb-[var(--spacing-stack-sm)] gap-4">
                    <div>
                      <h3 className="text-[16px] font-bold text-on-surface leading-snug">{project.title}</h3>
                      <p className="text-[14px] text-on-surface-variant mt-1">
                        {project.id === 'demo-project-1' ? t('home.demo_proj1') : t('home.demo_proj2')}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${statusColor}`}>
                      {status}
                    </span>
                  </div>
                  
                  <div className="mt-[var(--spacing-stack-sm)]">
                    <div className="flex justify-between text-[12px] font-medium text-on-surface-variant mb-2">
                      <span>{t('home.progress')}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-surface-variant rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-1000 ${progress === 100 ? 'bg-surface-tint opacity-50' : 'bg-gradient-to-r from-primary-container to-tertiary-container'}`} 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-[var(--spacing-stack-md)] flex items-center gap-2 text-on-surface-variant text-[12px] font-medium">
                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                    <span className={new Date(project.deadline) < new Date() ? 'text-error' : ''}>
                      {t('home.deadline')} {new Date(project.deadline).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                </GlassCard>
              );
            })
          ) : (
            <div className="text-center py-16 animate-fade-up delay-200">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30 mb-4">folder_open</span>
              <p className="text-[14px] text-on-surface-variant">{t('projects.no_projects')}</p>
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <button 
        aria-label="Create new project" 
        onClick={() => navigate('/projects/new')}
        className="fixed bottom-28 right-[var(--spacing-page)] w-14 h-14 bg-gradient-to-br from-tertiary-container to-primary-container text-on-primary-container rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 z-40"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </>
  );
}
