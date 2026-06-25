import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProject, getCheckpoints, getAIReviews, getScoringSessions, getScoreEntries, calculateFinalScore, scoreToGrade } from '../../lib/store';
import { generateFinalReport } from '../../lib/ai';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';

const DIMENSION_LABELS = {
  completion: '完成度',
  creativity: '独創性',
  logic: '論理性',
  expression: '表現力',
  practicality: '実用性',
};

const WAVEFORM_HEIGHTS = [8, 14, 18, 11, 20, 16, 9, 13, 17, 10, 15, 7];

export default function ReportPage() {
  const { projectId } = useParams();
  const { t } = useTranslation();
  const project = getProject(projectId);
  const [aiReport, setAiReport] = useState(null);
  const [aiReportError, setAiReportError] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const sessions = project ? getScoringSessions(projectId).filter(s => s.status === 'completed') : [];
  const finalScore = project ? calculateFinalScore(projectId) || 92 : 0; // Demo fallback

  // Aggregate dimension scores
  const dimScores = {};
  const scoreEntries = [];
  sessions.forEach(session => {
    const entries = getScoreEntries(session.id);
    scoreEntries.push(...entries);
    entries.forEach(e => {
      if (!dimScores[e.dimension]) dimScores[e.dimension] = [];
      dimScores[e.dimension].push(e.score);
    });
  });

  // Demo scores if no real data
  const displayDimScores = Object.keys(dimScores).length > 0
    ? Object.fromEntries(Object.entries(dimScores).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length * 20)]))
    : { completion: 94, creativity: 88, logic: 92, expression: 86, practicality: 90 };

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      const liveProject = getProject(projectId);
      if (!liveProject) return;

      const liveSessions = getScoringSessions(projectId).filter(s => s.status === 'completed');
      const liveScoreEntries = liveSessions.flatMap(session => getScoreEntries(session.id));
      const liveFinalScore = calculateFinalScore(projectId) || 92;
      const liveGrade = scoreToGrade(liveFinalScore);

      setIsGeneratingReport(true);
      setAiReportError('');
      try {
        const report = await generateFinalReport({
          project: liveProject,
          checkpoints: getCheckpoints(projectId),
          reviews: getAIReviews(projectId),
          scores: liveScoreEntries,
          finalScore: liveFinalScore,
          grade: liveGrade,
        });
        if (!cancelled) setAiReport(report);
      } catch (error) {
        if (!cancelled) setAiReportError(error.message || 'AI final report generation failed.');
      } finally {
        if (!cancelled) setIsGeneratingReport(false);
      }
    }

    loadReport();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!project) {
    return (
      <>
        <TopBar showBack title={t('report.title')} />
        <div className="px-[var(--spacing-page)] text-center py-20">
          <p className="text-on-surface-variant">{t('report.not_found')}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar showBack title={t('report.title')} />
      <div className="px-[var(--spacing-page)] max-w-lg mx-auto pt-4 md:pt-8 pb-32">
        <h2 className="text-[22px] text-primary text-center mt-[var(--spacing-stack-lg)] mb-[var(--spacing-stack-xl)] animate-fade-up font-medium">
          {t('report.title')}
        </h2>

        {/* Score Circle */}
        <section className="animate-fade-up">
          <GlassCard className="text-center mt-[var(--spacing-stack-md)]">
            <h3 className="text-[16px] text-on-surface font-bold mb-4">{t('report.score')}</h3>
            <div className="relative w-36 h-36 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-surface-variant)" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${finalScore * 2.64} 264`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[42px] font-light text-on-surface">{finalScore}</span>
              </div>
            </div>

            {/* Dimension bars */}
            <div className="flex flex-col gap-3 text-left">
              {Object.entries(displayDimScores).map(([dim, score]) => (
                <div key={dim} className="flex items-center gap-3">
                  <span className="text-[14px] text-on-surface w-16 shrink-0">{t(`report.dim_${dim}`) || DIMENSION_LABELS[dim] || dim}</span>
                  <div className="flex-1 h-2 bg-surface-variant rounded-full overflow-hidden">
                    <div
                      className="h-full gradient-bar rounded-full transition-all duration-1000"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        {/* Teacher Comments */}
        <section className="mt-[var(--spacing-stack-lg)] animate-fade-up delay-100">
          <h3 className="text-[18px] text-on-surface font-bold mb-3">{t('report.teacher_comment')}</h3>
          <GlassCard>
            <p className="text-[14px] text-on-surface-variant leading-relaxed">
              {t('report.demo_teacher_comment')}
            </p>
          </GlassCard>

          {/* Audio Player */}
          <div className="mt-3 glass-card rounded-xl p-4 flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors">
              <span className="material-symbols-outlined text-[20px]">play_arrow</span>
            </button>
            <div className="flex-1 flex items-center gap-1">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="flex-1 h-1 rounded-full" style={{
                  height: `${WAVEFORM_HEIGHTS[i]}px`,
                  backgroundColor: i < 5 ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                }} />
              ))}
            </div>
            <span className="text-[12px] text-on-surface-variant shrink-0">0:45</span>
          </div>
        </section>

        {/* AI Summary */}
        <section className="mt-[var(--spacing-stack-lg)] animate-fade-up delay-200">
          <h3 className="text-[18px] text-on-surface font-bold mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            {t('report.ai_summary')}
          </h3>
          <GlassCard>
            <p className="text-[14px] text-on-surface-variant leading-relaxed">
              {aiReport?.ai_summary || (isGeneratingReport ? 'AI is generating the final summary...' : t('report.demo_ai_summary'))}
            </p>
            {aiReportError && (
              <p className="mt-3 text-[12px] text-error leading-relaxed">{aiReportError}</p>
            )}
          </GlassCard>
        </section>

        {/* Suggestions */}
        <section className="mt-[var(--spacing-stack-lg)] mb-[var(--spacing-stack-xl)] animate-fade-up delay-300">
          <h3 className="text-[18px] text-on-surface font-bold mb-3">{t('report.overall_advice')}</h3>
          <div className="flex flex-col gap-3">
            {(aiReport?.advice?.length ? aiReport.advice : [t('report.demo_advice_1'), t('report.demo_advice_2')]).map((advice, index) => (
              <div key={index} className="flex gap-3 items-start">
                <span className="material-symbols-outlined text-[18px] text-status-pass mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <p className="text-[14px] text-on-surface-variant">{advice}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Download Button */}
        <div className="sticky bottom-24 pb-4">
          <button className="w-full bg-gradient-to-r from-primary to-tertiary text-on-primary text-[16px] font-medium py-4 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[20px]">download</span>
            {t('report.download')}
          </button>
        </div>
      </div>
    </>
  );
}
