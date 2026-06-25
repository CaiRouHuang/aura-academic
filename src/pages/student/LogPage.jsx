import { useState } from 'react';
import { getProjects, getLogs, getCheckpoints, getSubmissions, getAIReview } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import FilePreviewModal from '../../components/ui/FilePreviewModal';

export default function LogPage() {
  const { t } = useTranslation();
  const projects = getProjects();
  const [selectedProject, setSelectedProject] = useState(projects[0]?.id || '');
  const logs = selectedProject ? getLogs(selectedProject) : [];
  const checkpoints = selectedProject ? getCheckpoints(selectedProject) : [];

  // Build log entries with AI review data
  const enrichedLogs = logs.filter(l => l.action_type === 'upload' || l.action_type === 'checkpoint_pass' || l.action_type === 'checkpoint_generated').map(log => {
    const cpId = log.metadata?.checkpoint_id;
    const cp = checkpoints.find(c => c.id === cpId);
    const submissions = cpId ? getSubmissions(cpId) : [];
    const latestSub = submissions[0];
    const aiReview = latestSub ? getAIReview(latestSub.id) : null;
    return { ...log, checkpoint: cp, submission: latestSub, aiReview };
  });

  return (
    <>
      <TopBar title="NAVI" showBack />
      <div className="px-[var(--spacing-page)] max-w-2xl mx-auto pt-4 md:pt-8">
        <h2 className="text-[22px] text-primary text-center mt-[var(--spacing-stack-lg)] mb-2 animate-fade-up font-medium">
          {t('log.title')}
        </h2>
        <p className="text-[14px] text-on-surface-variant text-center mb-[var(--spacing-stack-xl)] leading-relaxed animate-fade-up delay-100">
          {t('log.subtitle')}
        </p>

        {/* Project Selector */}
        {projects.length > 1 && (
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full bg-transparent border-b border-outline-variant/50 focus:border-primary py-4 text-[14px] text-on-surface outline-none mb-[var(--spacing-stack-xl)]"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        )}

        {enrichedLogs.length === 0 ? (
          <div className="text-center py-16 animate-fade-up delay-200">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30 mb-4">history</span>
            <p className="text-[14px] text-on-surface-variant">{t('log.no_logs')}</p>
          </div>
        ) : (
          /* Timeline */
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-outline-variant/30 rounded-full" />

            <div className="flex flex-col gap-7">
              {enrichedLogs.map((log, idx) => {
                const score = log.aiReview?.completion_rate || log.metadata?.score;
                const isPassed = score >= 80;

                return (
                  <div key={log.id} className="flex gap-[var(--spacing-gutter)] items-start animate-fade-up" style={{ animationDelay: `${(idx + 1) * 100}ms` }}>
                    {/* Node */}
                    <div className="shrink-0 relative z-10">
                      {isPassed || log.action_type === 'checkpoint_pass' ? (
                        <div className="w-10 h-10 rounded-full bg-status-pass-bg text-status-pass flex items-center justify-center border border-status-pass-border">
                          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        </div>
                      ) : log.action_type === 'checkpoint_generated' ? (
                        <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center border border-primary-container">
                          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-status-warning-bg text-status-warning flex items-center justify-center border border-status-warning-border">
                          <span className="material-symbols-outlined text-[20px]">error_outline</span>
                        </div>
                      )}
                    </div>

                    {/* Card */}
                    <LogCard log={log} score={score} isPassed={isPassed} t={t} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function LogCard({ log, score, isPassed, t }) {
  const [expanded, setExpanded] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  return (
    <div className={`flex-1 glass-card rounded-[28px] overflow-hidden border-t-2 ${isPassed ? 'border-t-status-pass' : log.action_type === 'checkpoint_generated' ? 'border-t-primary' : 'border-t-status-warning'}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <p className="text-[12px] text-on-surface-variant">
              {new Date(log.created_at).toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' })}
              {' '}
              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </p>
            {log.metadata?.document_analysis_latency_ms && (
              <div className="text-[12px] text-outline mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">terminal</span>
                  前端擷取: {(log.metadata.document_analysis_latency_ms / 1000).toFixed(1)}s
                </span>
                {log.metadata?.eval_latency_ms && (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">psychology</span>
                    AI分析: {(log.metadata.eval_latency_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            )}
          </div>
          {score && (
            <span className={`text-[14px] font-bold px-2 py-0.5 rounded-full ${isPassed ? 'bg-status-pass-bg text-status-pass' : 'bg-status-warning-bg text-status-warning'}`}>
              {isPassed ? '⊕' : '⊘'} {score}/100
            </span>
          )}
        </div>

        {/* Checkpoint name */}
        <h3 className="text-[17px] font-bold text-on-surface mb-4 leading-snug">
          {log.checkpoint ? `${t('log.checkpoint')}${log.checkpoint.order_index}: ${log.checkpoint.title}` : log.description}
        </h3>

        {/* Uploaded files preview */}
        {log.submission?.files_data && (
          <div className="flex gap-3 mb-4 flex-wrap">
            {log.submission.files_data.map((f, i) => (
              <button
                key={i}
                onClick={() => setPreviewFile(f)}
                className="block relative group overflow-hidden rounded-xl border border-outline-variant/30 shadow-sm text-left h-20 bg-surface-container-low transition-transform hover:scale-105 shrink-0"
                style={{ width: '80px' }}
              >
                {f.data && f.data.startsWith('data:image/') ? (
                  <img src={f.data} alt={f.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2">
                    <span className="material-symbols-outlined text-[24px] text-on-surface-variant mb-1">
                      {(() => {
                        const ext = (f.name || '').split('.').pop().toLowerCase();
                        const iconMap = { pdf: 'picture_as_pdf', doc: 'article', docx: 'article', md: 'edit_note', html: 'code', py: 'terminal', js: 'terminal', jsx: 'terminal', ts: 'terminal', tsx: 'terminal', css: 'terminal', txt: 'description', csv: 'description', json: 'description' };
                        return iconMap[ext] || 'description';
                      })()}
                    </span>
                    <span className="text-[10px] text-on-surface-variant truncate w-full text-center" title={f.name}>
                      {f.name}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <span className="material-symbols-outlined text-white text-[20px]">visibility</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* AI Feedback */}
        {log.aiReview && (
          <div className="flex gap-3 items-start bg-surface-container-low/55 rounded-[22px] p-4">
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0 mt-0.5">description</span>
            <div className="flex-1">
              <p className="text-[13px] text-on-surface-variant leading-relaxed">
                {log.aiReview.analysis_summary}
              </p>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[12px] text-primary font-medium mt-2 flex items-center gap-1"
              >
                {t('log.view_ai_suggestion')}
                <span className="material-symbols-outlined text-[14px]">{expanded ? 'expand_less' : 'expand_more'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Expanded suggestions */}
        {expanded && log.aiReview && (
          <div className="mt-4 p-4 bg-primary-fixed/30 rounded-[22px] animate-fade-up">
            <p className="text-[12px] text-primary font-medium mb-1">{t('log.improvement_suggestion')}</p>
            <p className="text-[13px] text-on-surface-variant">{log.aiReview.suggestions}</p>
            {log.aiReview.encouragement && (
              <p className="text-[13px] text-on-surface-variant mt-2 italic">{log.aiReview.encouragement}</p>
            )}
            {log.aiReview.criteria_results && log.aiReview.criteria_results.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-[12px] font-bold text-on-surface flex items-center gap-1 border-b border-outline-variant/30 pb-1">
                  <span className="material-symbols-outlined text-[14px]">checklist</span>
                  逐項評分明細
                </h4>
                {log.aiReview.criteria_results.map((cr, i) => {
                  const criterion = log.checkpoint?.criteria?.find(c => c.id === cr.criterion_id);
                  return (
                    <div key={i} className="bg-surface/50 rounded-lg p-3 border border-outline-variant/10 flex flex-col gap-1.5">
                      <div className="flex justify-between items-start">
                        <span className="text-[13px] font-bold text-on-surface">{criterion?.label || '評分項目'}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${cr.passed ? 'bg-status-pass-bg text-status-pass' : 'bg-status-warning-bg text-status-warning'}`}>
                          {cr.passed ? '達成' : '未達'} ({cr.score}分)
                        </span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant/80">{criterion?.description}</p>
                      <div className="mt-1 pt-2 border-t border-outline-variant/10">
                        <p className="text-[13px] text-on-surface-variant flex items-start gap-1">
                          <span className="material-symbols-outlined text-[14px] text-primary shrink-0 mt-0.5" style={{fontVariationSettings: "'FILL' 1"}}>auto_awesome</span>
                          <span>{cr.comment}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}
