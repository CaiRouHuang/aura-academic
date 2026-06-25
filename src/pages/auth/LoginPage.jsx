import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setCurrentUser, seedDemoData } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    seedDemoData();

    let role = 'student';
    if (email.includes('teacher')) role = 'teacher';
    if (email.includes('dev')) role = 'dev';

    setCurrentUser({
      id: `demo-${role}`,
      name: role === 'teacher' ? 'Demo Teacher' : role === 'dev' ? 'Developer' : 'ユウキ',
      role: role,
      email: email || `${role}@example.com`,
    });

    if (role === 'teacher') navigate('/teacher/dashboard');
    else if (role === 'dev') navigate('/dev');
    else navigate('/');
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-[var(--spacing-page)] relative overflow-hidden bg-background">
      {/* Background Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary-container rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-tertiary-container rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-secondary-container rounded-full mix-blend-multiply filter blur-[80px] opacity-30 animate-blob animation-delay-4000" />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-fade-up">
        <div className="text-center mb-12">
          <h1 className="text-[32px] font-light text-brand-gradient mb-2">NAVI</h1>
          <p className="text-[14px] text-on-surface-variant">Your calm space for academic focus.</p>
        </div>

        <form onSubmit={handleLogin} className="glass-card rounded-[24px] p-8 shadow-xl">
          <div className="flex flex-col gap-5 mb-6">
            <div className="relative">
              <input
                type="text"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                className="w-full bg-transparent border border-outline-variant/50 rounded-xl focus:border-primary py-4 px-4 text-[16px] text-on-surface outline-none transition-colors peer"
              />
              <label
                htmlFor="email"
                className="absolute left-4 top-4 text-[14px] text-on-surface-variant transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[16px] peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px] pointer-events-none"
              >
                {t('login.email')}
              </label>
            </div>

            <div className="relative">
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                className="w-full bg-transparent border border-outline-variant/50 rounded-xl focus:border-primary py-4 px-4 text-[16px] text-on-surface outline-none transition-colors peer"
              />
              <label
                htmlFor="password"
                className="absolute left-4 top-4 text-[14px] text-on-surface-variant transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[16px] peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px] pointer-events-none"
              >
                {t('login.password')}
              </label>
              <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[20px]">visibility_off</span>
              </button>
            </div>
          </div>

          <div className="text-right mb-8">
            <a href="#" className="text-[12px] text-primary hover:underline">{t('login.forgot_pwd')}</a>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-primary-container to-tertiary-container hover:from-primary hover:to-tertiary text-on-primary-container hover:text-on-primary text-[16px] font-medium py-4 rounded-full shadow-md hover:shadow-lg transition-all"
          >
            {t('login.login_btn')}
          </button>
          
          <p className="text-[12px] text-on-surface-variant text-center mt-4">
            <span className="font-mono bg-surface-variant/50 px-1 rounded">teacher</span> {t('login.teacher_hint')}
          </p>
        </form>

        <div className="text-center mt-8">
          <p className="text-[12px] text-on-surface-variant">
            © 2024 NAVI. All rights reserved.<br />
            {t('login.terms')}
          </p>
        </div>
      </div>
    </div>
  );
}
