import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createScoringSession, createScoreEntries, updateProject, calculateWeightedScore, getAIReviews } from '../../lib/store';
import { logTeacherEvalEvent } from '../../lib/eventLogger';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';
import StarRating from '../../components/ui/StarRating';

const DIMENSIONS = [
  { id: 'completion', label: '完成度' },
  { id: 'creativity', label: '独創性' },
  { id: 'logic', label: '論理性' },
  { id: 'expression', label: '表現力' },
  { id: 'practicality', label: '実用性' },
];

export default function ScoringPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleScoreChange = (dimId, val) => {
    setScores(prev => ({ ...prev, [dimId]: val }));
  };

  const handleRecordToggle = () => {
    // Demo implementation for audio recording visual
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      setTimeout(() => setIsRecording(false), 5000); // Auto stop after 5s for demo
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Create session
    const session = createScoringSession(projectId, 'demo-teacher');

    // Create entries
    const entries = DIMENSIONS.map(dim => ({
      session_id: session.id,
      dimension: dim.id,
      score: scores[dim.id] || 0,
      text_comment: comment,
    }));
    createScoreEntries(entries);

    // Update session status (using direct store mutation for demo simplicity)
    const sessions = JSON.parse(localStorage.getItem('aura_scoring_sessions') || '[]');
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      sessions[idx].status = 'completed';
      localStorage.setItem('aura_scoring_sessions', JSON.stringify(sessions));
    }

    // Update project status to completed if this was the final review (demo logic)
    updateProject(projectId, { status: 'completed' });

    // ── Research LOG: Teacher Evaluation Event ──
    const weightedScore = calculateWeightedScore(scores);
    // Get the latest AI completion rate for this project to compute delta
    const aiReviews = getAIReviews(projectId);
    const latestAiRate = aiReviews.length > 0
      ? aiReviews[aiReviews.length - 1].completion_rate
      : null;
    const aiHumanDelta = latestAiRate !== null ? weightedScore - latestAiRate : null;

    logTeacherEvalEvent({
      student_id: 'demo-student',
      project_id: projectId,
      teacher_id: 'demo-teacher',
      transcript_text: comment,
      score_dimensions: scores,
      final_weighted_score: weightedScore,
      ai_completion_rate: latestAiRate,
      ai_human_score_delta: aiHumanDelta,
    });

    await new Promise(r => setTimeout(r, 1000));
    setIsSubmitting(false);
    navigate('/teacher/dashboard');
  };

  const allScored = DIMENSIONS.every(d => scores[d.id] > 0);

  return (
    <>
      <TopBar showBack title={t('scoring.title')} />
      <div className="px-[var(--spacing-page)] max-w-2xl mx-auto pt-4 md:pt-0">

        {/* Rating Section */}
        <section className="mt-[var(--spacing-stack-lg)] mb-[var(--spacing-stack-xl)] animate-fade-up">
          <GlassCard>
            <div className="flex justify-between text-[14px] text-on-surface-variant mb-6 px-2">
              <span>{t('scoring.evaluation_items')}</span>
            </div>
            <div className="flex flex-col">
              {DIMENSIONS.map((dim, idx) => (
                <div key={dim.id} className={`flex items-center justify-between py-5 px-2 ${idx !== DIMENSIONS.length - 1 ? 'border-b border-outline-variant/30' : ''}`}>
                  <span className="text-[16px] text-on-surface">{t(`report.dim_${dim.id}`) || dim.label}</span>
                  <StarRating
                    value={scores[dim.id] || 0}
                    onChange={(val) => handleScoreChange(dim.id, val)}
                  />
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        {/* Text Comment */}
        <section className="mb-[var(--spacing-stack-xl)] animate-fade-up delay-100">
          <GlassCard className="p-0 overflow-hidden">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('scoring.comment_placeholder')}
              rows={4}
              className="w-full bg-transparent p-6 text-[16px] text-on-surface outline-none resize-none"
            />
          </GlassCard>
        </section>

        {/* Audio Recording */}
        <section className="mb-[var(--spacing-stack-xl)] flex flex-col items-center animate-fade-up delay-200">
          <button
            onClick={handleRecordToggle}
            className={`w-32 h-32 rounded-full flex flex-col items-center justify-center gap-1 transition-all shadow-[0_18px_46px_rgba(111,80,146,0.12)] ${
              isRecording
                ? 'bg-gradient-to-br from-secondary-container to-tertiary-container shadow-secondary-container/50 scale-105'
                : 'bg-gradient-to-br from-primary-container to-tertiary-container hover:scale-105'
            }`}
          >
            {isRecording ? (
              <div className="flex items-center gap-0.5 h-8">
                <span className="waveform-bar" />
                <span className="waveform-bar" />
                <span className="waveform-bar" />
                <span className="waveform-bar" />
                <span className="waveform-bar" />
              </div>
            ) : (
              <span className="material-symbols-outlined text-[32px] text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
            )}
            <span className="text-[12px] font-bold text-on-primary-container mt-1">
              {isRecording ? t('scoring.recording') : t('scoring.record')}
            </span>
          </button>
          <p className="text-[14px] text-on-surface-variant mt-6">
            {t('scoring.record_desc')}
          </p>
        </section>

        {/* Submit */}
        <div className="sticky bottom-28 pb-6 animate-fade-up delay-300">
          <button
            onClick={handleSubmit}
            disabled={!allScored || isSubmitting}
            className="w-full bg-primary hover:bg-primary/90 text-on-primary text-[16px] font-medium py-4 rounded-full shadow-[0_16px_34px_rgba(111,80,146,0.2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            {t('scoring.submit')}
          </button>
        </div>
      </div>
    </>
  );
}
