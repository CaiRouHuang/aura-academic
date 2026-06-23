import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConsentForCurrentUser, hydrateRemoteData, seedDemoData, setCurrentUser } from '../../lib/store';
import { loginWithExperimentAccount } from '../../lib/authService';
import { isSupabaseConfigured } from '../../lib/supabaseRest';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured()) {
        // seedDemoData();
      }

      const user = await loginWithExperimentAccount(loginId, password);
      setCurrentUser(user);
      await hydrateRemoteData();

      if (user.role === 'teacher') {
        navigate('/teacher/dashboard');
      } else if (user.role === 'dev') {
        navigate('/dev');
      } else if (!getConsentForCurrentUser()) {
        navigate('/consent');
      } else {
        navigate('/');
      }
    } catch (error) {
      setLoginError(error.message || '登入失敗，請確認帳號與密碼。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-[var(--spacing-page)] relative overflow-hidden bg-background">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary-container rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-tertiary-container rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-secondary-container rounded-full mix-blend-multiply filter blur-[80px] opacity-30 animate-blob animation-delay-4000" />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-fade-up">
        <div className="text-center mb-12">
          <h1 className="text-[32px] font-light text-brand-gradient mb-2">Aura Academic</h1>
          <p className="text-[14px] text-on-surface-variant">Experiment login for checkpoint-based design learning.</p>
        </div>

        <form onSubmit={handleLogin} className="glass-card rounded-[24px] p-8 shadow-xl">
          <div className="flex flex-col gap-5 mb-6">
            <div className="relative">
              <input
                type="text"
                id="login-id"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                placeholder=" "
                autoComplete="username"
                className="w-full bg-transparent border border-outline-variant/50 rounded-xl focus:border-primary py-4 px-4 text-[16px] text-on-surface outline-none transition-colors peer"
              />
              <label
                htmlFor="login-id"
                className="absolute left-4 top-4 text-[14px] text-on-surface-variant transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[16px] peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px] pointer-events-none"
              >
                受測者編號
              </label>
            </div>

            <div className="relative">
              <input
                type="password"
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder=" "
                autoComplete="current-password"
                className="w-full bg-transparent border border-outline-variant/50 rounded-xl focus:border-primary py-4 px-4 text-[16px] text-on-surface outline-none transition-colors peer"
              />
              <label
                htmlFor="password"
                className="absolute left-4 top-4 text-[14px] text-on-surface-variant transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[16px] peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px] pointer-events-none"
              >
                密碼
              </label>
            </div>
          </div>

          {loginError && (
            <div className="mb-5 rounded-xl bg-error-container text-on-error-container border border-error/20 p-3 text-[13px] leading-relaxed">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !loginId.trim() || !password.trim()}
            className="w-full bg-gradient-to-r from-primary-container to-tertiary-container hover:from-primary hover:to-tertiary text-on-primary-container hover:text-on-primary text-[16px] font-medium py-4 rounded-full shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '登入中...' : '登入'}
          </button>
        </form>

        <div className="text-center mt-8">
          <p className="text-[12px] text-on-surface-variant">
            Aura Academic experiment build
          </p>
        </div>
      </div>
    </div>
  );
}
