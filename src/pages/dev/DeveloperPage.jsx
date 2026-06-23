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
  const [activeTab, setActiveTab] = useState('api'); // 'api' or 'logs'

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
      <div className="px-[var(--spacing-page)] max-w-6xl mx-auto pt-8 pb-32">
        <h2 className="text-[24px] font-bold text-primary mb-[var(--spacing-stack-lg)] animate-fade-up pl-4 md:pl-0">
          Developer Settings
        </h2>

        <div className="flex flex-col md:flex-row gap-8 animate-fade-up delay-100 items-start">
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('api')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-[15px] ${
                activeTab === 'api' 
                  ? 'bg-primary-container text-primary font-bold shadow-sm' 
                  : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">settings_suggest</span>
              API Settings
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-[15px] ${
                activeTab === 'logs' 
                  ? 'bg-primary-container text-primary font-bold shadow-sm' 
                  : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">analytics</span>
              Research Logs
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1 w-full min-h-[60vh]">
            {activeTab === 'api' && (
              <div className="flex flex-col gap-6 max-w-2xl animate-fade-in">
                <div className="pb-4 border-b border-outline-variant/30">
                  <h3 className="text-[20px] font-bold text-on-surface">API Settings</h3>
                  <p className="text-[13px] text-on-surface-variant mt-1">Configure LLM providers and access keys for system generation features.</p>
                </div>
                
                <GlassCard className="flex flex-col gap-5">
                  <div>
                    <label className="text-[13px] font-bold text-on-surface block mb-1.5 uppercase tracking-wider">Provider</label>
                    <select
                      value={settings.ai_provider}
                      onChange={(e) => setSettings({ ...settings, ai_provider: e.target.value })}
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-[15px] text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                    >
                      <option value="nvidia">NVIDIA NIM</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[13px] font-bold text-on-surface block mb-1.5 uppercase tracking-wider">API Key</label>
                    <input
                      type="password"
                      value={settings.ai_api_key}
                      onChange={(e) => setSettings({ ...settings, ai_api_key: e.target.value })}
                      placeholder="sk-..."
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-[15px] text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[13px] font-bold text-on-surface block mb-1.5 uppercase tracking-wider">Base URL</label>
                    <input
                      type="text"
                      value={settings.ai_base_url}
                      onChange={(e) => setSettings({ ...settings, ai_base_url: e.target.value })}
                      placeholder="https://integrate.api.nvidia.com/v1"
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-[15px] text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[13px] font-bold text-on-surface block mb-1.5 uppercase tracking-wider">Model</label>
                    <select
                      value={settings.ai_model}
                      onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-[15px] text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                    >
                      {NVIDIA_MODELS.map(model => (
                        <option key={model.value} value={model.value}>{model.label}</option>
                      ))}
                    </select>
                  </div>

                  {settings.ai_model === 'custom' && (
                    <div className="animate-fade-in">
                      <label className="text-[13px] font-bold text-on-surface block mb-1.5 uppercase tracking-wider">Custom model ID</label>
                      <input
                        type="text"
                        value={settings.ai_custom_model || ''}
                        onChange={(e) => setSettings({ ...settings, ai_custom_model: e.target.value })}
                        placeholder="provider/model-name"
                        className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3.5 text-[15px] text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                      />
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      onClick={handleSaveSettings}
                      className="bg-primary text-on-primary font-bold py-3.5 px-6 rounded-xl shadow-sm hover:shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      <span className="material-symbols-outlined text-[20px]">save</span>
                      {isSaved ? 'Settings Saved Successfully' : 'Save Changes'}
                    </button>
                  </div>
                </GlassCard>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="flex flex-col gap-6 w-full animate-fade-in">
                <div className="pb-4 border-b border-outline-variant/30 flex justify-between items-end">
                  <div>
                    <h3 className="text-[20px] font-bold text-on-surface">Research Logs</h3>
                    <p className="text-[13px] text-on-surface-variant mt-1">Monitor system events, error reports, and AI generations across the platform.</p>
                  </div>
                </div>
                
                <div className="w-full bg-surface border border-outline-variant/30 rounded-[24px] shadow-sm overflow-hidden">
                  <ResearchLogPanel />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
