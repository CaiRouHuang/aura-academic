import { useNavigate } from 'react-router-dom';
import { getProjects, getCheckpoints, getCurrentUser, getAssignments } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';
import ProgressBar from '../../components/ui/ProgressBar';

export default function HomePage() {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const projects = getProjects();
  const assignments = getAssignments();
  const user = getCurrentUser();

  const getProjectProgress = (projectId) => {
    const cps = getCheckpoints(projectId);
    if (cps.length === 0) return 0;
    const passed = cps.filter(c => c.status === 'passed').length;
    return Math.round((passed / cps.length) * 100);
  };

  const getNextCheckpoint = (projectId) => {
    const cps = getCheckpoints(projectId);
    return cps.find(c => c.status !== 'passed');
  };

  const hasProjects = projects.length > 0;
  
  const todoAssignments = assignments.filter(a => 
    !projects.some(p => p.assignment_id === a.id) && 
    new Date(a.global_deadline) >= new Date()
  );

  return (
    <>
      <TopBar />
      <div className="px-[var(--spacing-page)] max-w-3xl mx-auto pt-4 md:pt-0">
        {/* Greeting */}
        <section className="mt-[var(--spacing-stack-xl)] mb-24 animate-fade-up">
          <p className="text-[12px] font-medium text-on-surface-variant/70 tracking-widest uppercase mb-3">
            {new Date().toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="text-[28px] font-light tracking-tight text-on-surface leading-[40px]">
            {t('home.greeting')}<br />
            <span className="font-medium text-primary">{user?.name || 'ユウキ'}</span>{t('home.name_suffix')}
          </h2>
          <p className="text-[15px] text-on-surface-variant mt-6 max-w-sm leading-loose">
            {hasProjects ? t('home.has_projects') : t('home.no_projects')}
          </p>
        </section>

        {/* AI Insight Card */}
        <section className="mb-24 animate-fade-up delay-100">
          <GlassCard hover className="shimmer-bg relative overflow-hidden group p-6">
            <div className="absolute -left-4 -top-4 w-16 h-16 bg-primary-container rounded-full blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
            <div className="flex items-start gap-5 relative z-10">
              <div className="bg-primary/10 text-primary p-3 rounded-full shrink-0">
                <span className="material-symbols-outlined text-[24px] sparkle-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              </div>
              <div className="flex-1 mt-1">
                <h3 className="text-[13px] font-bold text-on-surface tracking-wider uppercase mb-2">{t('home.ai_insight')}</h3>
                <p className="text-[15px] text-on-surface-variant mb-5 leading-relaxed">
                  {hasProjects ? t('home.insight_has_projects') : t('home.insight_no_projects')}
                </p>
                <button
                  onClick={() => navigate(hasProjects ? '/projects' : '/projects/new')}
                  className="bg-primary hover:bg-primary/90 text-on-primary text-[14px] font-medium px-5 py-3 rounded-full transition-colors shadow-sm flex items-center gap-2"
                >
                  <span>{hasProjects ? t('home.btn_outline') : t('home.btn_proposal')}</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* To Do Assignments Section */}
        {todoAssignments.length > 0 && (
          <section className="mb-16 animate-fade-up delay-150">
            <h3 className="text-[20px] text-on-surface mb-6 px-1 font-light flex items-center gap-2" style={{ letterSpacing: '-0.01em' }}>
              <span className="material-symbols-outlined text-[20px] text-secondary">assignment_late</span>
              {t('home.todo_assignments')}
            </h3>
            <div className="flex flex-col gap-4">
              {todoAssignments.slice(0, 2).map((assignment, idx) => {
                const daysLeft = Math.ceil((new Date(assignment.global_deadline) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <GlassCard 
                    key={assignment.id} 
                    hover 
                    className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer"
                    onClick={() => navigate(`/assignments/${assignment.id}`)}
                    style={{ animationDelay: `${(idx + 1) * 100}ms` }}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-bold text-error bg-error-container/30 px-2 py-0.5 rounded-full">
                          {t('assignment.days_left').replace('{n}', daysLeft)}
                        </span>
                      </div>
                      <h4 className="text-[16px] font-bold text-on-surface">{assignment.title}</h4>
                    </div>
                    <button className="text-[13px] font-medium text-primary bg-primary-container/20 px-4 py-2 rounded-full hover:bg-primary/10 transition-colors shrink-0">
                      {t('assignment.btn_create_proposal')}
                    </button>
                  </GlassCard>
                );
              })}
              {todoAssignments.length > 2 && (
                <button 
                  onClick={() => navigate('/assignments')}
                  className="text-[13px] text-primary hover:text-tertiary transition-colors flex items-center gap-1 group font-medium px-1"
                >
                  {t('assignment.more_assignments').replace('{n}', todoAssignments.length - 2)}
                  <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* Projects Section */}
        <section className="mb-24 animate-fade-up delay-200">
          <div className="flex justify-between items-end mb-6 px-1">
            <h3 className="text-[24px] text-on-surface font-light" style={{ letterSpacing: '-0.01em' }}>
              {t('home.active_projects')}
            </h3>
            {hasProjects && (
              <button
                onClick={() => navigate('/projects')}
                className="text-[13px] text-primary hover:text-tertiary transition-colors flex items-center gap-1 group font-medium"
              >
                {t('home.view_all')}
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">chevron_right</span>
              </button>
            )}
          </div>

          {hasProjects ? (
            <div className="flex overflow-x-auto gap-6 pb-6 pt-2 -mx-[var(--spacing-page)] px-[var(--spacing-page)] no-scrollbar snap-x snap-mandatory">
              {projects.map(project => {
                const progress = getProjectProgress(project.id);
                const nextCp = getNextCheckpoint(project.id);
                return (
                  <GlassCard
                    key={project.id}
                    hover
                    className="min-w-[320px] w-[85vw] max-w-[380px] snap-center shrink-0 flex flex-col justify-between p-6"
                    onClick={() => navigate(`/projects/${project.id}/checkpoints`)}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <span className="bg-tertiary/10 text-tertiary text-[13px] font-medium px-3 py-1.5 rounded-full">
                          {project.id === 'demo-project-1' ? t('home.demo_proj1') : t('home.demo_proj2')}
                        </span>
                        <button className="text-on-surface-variant/50 hover:text-on-surface-variant p-2 rounded-full hover:bg-surface-variant/50">
                          <span className="material-symbols-outlined text-[24px]">more_horiz</span>
                        </button>
                      </div>
                      <h4 className="text-[18px] font-bold text-on-surface mb-4 leading-snug">{project.title}</h4>
                      {nextCp && (
                        <div className="flex items-center gap-2 mb-8">
                          <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                          <span className="text-[14px] text-on-surface-variant">{t('home.next')} {nextCp.title}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex justify-between text-[13px] mb-3">
                        <span className="text-on-surface-variant">{t('home.progress')}</span>
                        <span className="text-primary font-bold">{progress}%</span>
                      </div>
                      <ProgressBar value={progress} />
                      <div className="mt-5 flex justify-between items-center">
                        <span className={`text-[13px] flex items-center gap-1.5 ${new Date(project.deadline) < new Date() ? 'text-error' : 'text-on-surface-variant'}`}>
                          <span className="material-symbols-outlined text-[16px]">schedule</span>
                          {t('home.deadline')} {new Date(project.deadline).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'zh-TW', { month: 'long', day: 'numeric' })}
                        </span>
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full border-2 border-surface bg-primary-container text-on-primary-container flex items-center justify-center text-[12px] font-medium">Y</div>
                          <div className="w-8 h-8 rounded-full border-2 border-surface bg-secondary-container text-on-secondary-container flex items-center justify-center text-[12px]">+2</div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}

              {/* Add New Project Card */}
              <div
                onClick={() => navigate('/projects/new')}
                className="glass-card hover-lift rounded-[28px] p-8 min-w-[240px] snap-center shrink-0 flex flex-col items-center justify-center border-dashed border-2 border-primary-container hover:bg-primary-container/10 transition-colors cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">add</span>
                </div>
                <span className="text-[14px] text-primary font-medium">{t('home.new_project')}</span>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-5 shadow-sm">
                <span className="material-symbols-outlined text-[48px] text-primary">auto_stories</span>
              </div>
              <h3 className="text-[22px] text-primary font-medium mb-3">{t('home.empty_title')}</h3>
              <p className="text-[15px] text-on-surface-variant max-w-md mb-8 leading-relaxed">
                {t('home.empty_desc')}
              </p>
              <button
                onClick={() => navigate('/projects/new')}
                className="bg-gradient-to-r from-primary to-tertiary text-on-primary text-[16px] font-medium py-4 px-8 rounded-full shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                {t('home.btn_submit')}
              </button>
            </div>
          )}
        </section>

        {/* Quick Access */}
        <section className="mb-24 animate-fade-up delay-300">
          <h3 className="text-[24px] text-on-surface mb-6 px-1 font-light" style={{ letterSpacing: '-0.01em' }}>
            {t('home.quick_access')}
          </h3>
          <div className="grid grid-cols-2 gap-5">
            <GlassCard hover className="flex flex-col items-center justify-center text-center group py-6" onClick={() => navigate('/assignments')}>
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[20px]">assignment</span>
              </div>
              <span className="text-[12px] text-on-surface font-medium">{t('nav.assignments')}</span>
            </GlassCard>
            <GlassCard hover className="flex flex-col items-center justify-center text-center group py-6" onClick={() => navigate('/upload')}>
              <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
              </div>
              <span className="text-[12px] text-on-surface font-medium">{t('home.qa_upload')}</span>
            </GlassCard>
            <GlassCard hover className="flex flex-col items-center justify-center text-center group py-6" onClick={() => navigate('/log')}>
              <div className="w-10 h-10 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[20px]">list_alt</span>
              </div>
              <span className="text-[12px] text-on-surface font-medium">{t('home.qa_log')}</span>
            </GlassCard>
          </div>
        </section>
      </div>
    </>
  );
}
