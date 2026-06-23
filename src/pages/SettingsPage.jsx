import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logout, getSettings, saveSettings } from '../lib/store';
import { useTranslation } from '../lib/i18n';
import TopBar from '../components/layout/TopBar';
import GlassCard from '../components/ui/GlassCard';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = getCurrentUser();
  const [settings, setSettings] = useState(getSettings());
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleSaveSettings = () => {
    saveSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <>
      <TopBar title={t('settings.profile_title')} showBack />
      <div className="px-[var(--spacing-page)] max-w-lg mx-auto">
        {/* Profile Info */}
        <section className="mt-[var(--spacing-stack-md)] mb-[var(--spacing-stack-lg)] animate-fade-up flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-container to-tertiary-container flex items-center justify-center text-[32px] font-bold text-on-primary-container mb-4 shadow-md border-4 border-surface">
            {user.name.charAt(0)}
          </div>
          <h2 className="text-[24px] font-bold text-on-surface">{user.name}</h2>
          <p className="text-[14px] text-on-surface-variant bg-surface-variant/30 px-3 py-1 rounded-full mt-2 capitalize">
            {user.role} {t('settings.account')}
          </p>
        </section>

        {/* General Settings */}
        <section className="mb-[var(--spacing-stack-lg)] animate-fade-up delay-50">
          <h3 className="text-[16px] font-bold text-on-surface mb-3 px-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>language</span>
            {t('settings.general_title')}
          </h3>
          <GlassCard className="flex flex-col gap-4">
            <div>
              <label className="text-[12px] text-on-surface-variant font-medium block mb-1">{t('settings.language_label')}</label>
              <select
                value={settings.language || 'ja'}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-3 text-[14px] text-on-surface outline-none focus:border-primary transition-colors"
              >
                <option value="ja">日本語</option>
                <option value="zh">繁體中文</option>
              </select>
            </div>
          </GlassCard>
        </section>



        {/* Save Button */}
        <section className="mb-[var(--spacing-stack-lg)] animate-fade-up delay-150">
          <button
            onClick={handleSaveSettings}
            className="w-full bg-primary text-on-primary font-medium py-3 rounded-lg shadow-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {isSaved ? t('settings.save_success') : t('settings.save_btn')}
          </button>
        </section>

        {/* Actions */}
        <section className="animate-fade-up delay-200">
          <GlassCard className="p-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 text-error hover:bg-error/10 rounded-lg transition-colors text-left"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              <span className="text-[14px] font-medium">{t('settings.logout')}</span>
            </button>
          </GlassCard>
        </section>
      </div>
    </>
  );
}
