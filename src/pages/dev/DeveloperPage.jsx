import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getSettings, saveSettings } from '../../lib/store';
import { NVIDIA_MODELS } from '../../lib/ai';
import { useTranslation } from '../../lib/i18n';
import TopBar from '../../components/layout/TopBar';
import GlassCard from '../../components/ui/GlassCard';
import ResearchLogPanel from '../../components/ui/ResearchLogPanel';

export default function DeveloperPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = getCurrentUser();
  const [settings, setSettings] = useState(getSettings());
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'dev') {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSaveSettings = () => {
    saveSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  if (!user || user.role !== 'dev') return null;

  return (
    <>
      <TopBar title="Developer Console" showBack />
      <div className="px-[var(--spacing-page)] max-w-4xl mx-auto pt-4 pb-32">
        <h2 className="text-[24px] font-bold text-primary text-center mt-[var(--spacing-stack-md)] mb-[var(--spacing-stack-lg)] animate-fade-up">
          Developer Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-up delay-100">
          <div className="flex flex-col gap-6">
            <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-primary">settings_suggest</span>
              API Settings
            </h3>
            <GlassCard className="flex flex-col gap-4">
              <div>
                <label className="text-[12px] text-on-surface-variant font-medium block mb-1">Provider</label>
                <select
                  value={settings.ai_provider}
                  onChange={(e) => setSettings({ ...settings, ai_provider: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 text-[14px] text-on-surface outline-none focus:border-primary transition-colors"
                >
                  <option value="nvidia">NVIDIA NIM</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] text-on-surface-variant font-medium block mb-1">API Key</label>
                <input
                  type="password"
                  value={settings.ai_api_key}
                  onChange={(e) => setSettings({ ...settings, ai_api_key: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 text-[14px] text-on-surface outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-[12px] text-on-surface-variant font-medium block mb-1">Base URL</label>
                <input
                  type="text"
                  value={settings.ai_base_url}
                  onChange={(e) => setSettings({ ...settings, ai_base_url: e.target.value })}
                  placeholder="https://integrate.api.nvidia.com/v1"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 text-[14px] text-on-surface outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-[12px] text-on-surface-variant font-medium block mb-1">Model</label>
                <select
                  value={settings.ai_model}
                  onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 text-[14px] text-on-surface outline-none focus:border-primary transition-colors"
                >
                  {NVIDIA_MODELS.map(model => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>

              {settings.ai_model === 'custom' && (
                <div>
                  <label className="text-[12px] text-on-surface-variant font-medium block mb-1">Custom model ID</label>
                  <input
                    type="text"
                    value={settings.ai_custom_model || ''}
                    onChange={(e) => setSettings({ ...settings, ai_custom_model: e.target.value })}
                    placeholder="provider/model-name"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 text-[14px] text-on-surface outline-none focus:border-primary transition-colors"
                  />
                </div>
              )}

              <button
                onClick={handleSaveSettings}
                className="w-full bg-primary text-on-primary font-medium py-3 mt-2 rounded-lg shadow-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {isSaved ? 'Saved!' : 'Save API Settings'}
              </button>
            </GlassCard>
          </div>

          <div className="flex flex-col gap-6">
            <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-primary">analytics</span>
              Research Logs
            </h3>
            {/* The ResearchLogPanel is now rendered statically */}
            <ResearchLogPanel />
          </div>
        </div>
      </div>
    </>
  );
}
