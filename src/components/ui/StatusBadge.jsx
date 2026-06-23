import { useTranslation } from '../../lib/i18n';

const statusConfig = {
  passed: { bg: 'bg-status-pass-bg', text: 'text-status-pass', border: 'border-status-pass-border', labelKey: 'passed', icon: 'check_circle' },
  completed: { bg: 'bg-status-pass-bg', text: 'text-status-pass', border: 'border-status-pass-border', labelKey: 'completed', icon: 'check_circle' },
  in_progress: { bg: 'bg-primary-fixed', text: 'text-primary', border: 'border-primary-container', labelKey: 'in_progress', icon: 'pending' },
  under_review: { bg: 'bg-status-review-bg', text: 'text-status-review', border: 'border-status-review-border', labelKey: 'under_review', icon: 'rate_review' },
  pending: { bg: 'bg-surface-container', text: 'text-on-surface-variant', border: 'border-surface-container-high', labelKey: 'pending', icon: 'schedule' },
  needs_revision: { bg: 'bg-status-warning-bg', text: 'text-status-warning', border: 'border-status-warning-border', labelKey: 'needs_revision', icon: 'edit' },
  draft: { bg: 'bg-surface-container', text: 'text-on-surface-variant', border: 'border-surface-container-high', labelKey: 'draft', icon: 'draft' },
  active: { bg: 'bg-primary-fixed', text: 'text-primary', border: 'border-primary-container', labelKey: 'active', icon: 'play_circle' },
  reviewing: { bg: 'bg-status-review-bg', text: 'text-status-review', border: 'border-status-review-border', labelKey: 'reviewing', icon: 'rate_review' },
  scored: { bg: 'bg-status-pass-bg', text: 'text-status-pass', border: 'border-status-pass-border', labelKey: 'scored', icon: 'check_circle' },
  unscored: { bg: 'bg-surface-container', text: 'text-on-surface-variant', border: 'border-surface-container-high', labelKey: 'unscored', icon: 'pending' },
};

export default function StatusBadge({ status, label: customLabel, className = '' }) {
  const { t } = useTranslation();
  const config = statusConfig[status] || statusConfig.pending;
  const displayLabel = customLabel || t(`status_badge.${config.labelKey}`);

  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-medium tracking-wide px-3 py-1.5 rounded-full whitespace-nowrap ${config.bg} ${config.text} border ${config.border} ${className}`}>
      {status === 'passed' || status === 'completed' || status === 'scored' ? (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      ) : null}
      {displayLabel}
    </span>
  );
}
