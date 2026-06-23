import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getConsentForCurrentUser, getCurrentUser, recordConsent } from '../../lib/store';
import { logSystemEvent } from '../../lib/eventLogger';

const CONSENT_VERSION = '2026-06-experiment-v1';

export default function ConsentPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const existingConsent = getConsentForCurrentUser();
  const [hasRead, setHasRead] = useState(false);
  const [hasCompletedForm, setHasCompletedForm] = useState(false);

  const profileFormUrl = import.meta.env.VITE_PROFILE_FORM_URL || '';
  const hasProfileFormUrl = /^https:\/\/.+/i.test(profileFormUrl);
  const canContinue = hasRead && hasCompletedForm && hasProfileFormUrl;

  const participantLabel = useMemo(() => (
    user?.participant_code || user?.name || user?.id || 'Unknown'
  ), [user]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'student') return <Navigate to={user.role === 'teacher' ? '/teacher/dashboard' : '/dev'} replace />;
  if (existingConsent) return <Navigate to="/" replace />;

  const handleSubmit = () => {
    if (!canContinue) return;

    const consent = recordConsent({
      consent_version: CONSENT_VERSION,
      metadata: {
        participant_label: participantLabel,
        profile_form_url: profileFormUrl,
        user_agent: navigator.userAgent,
      },
    });

    logSystemEvent({
      event_subtype: 'consent_recorded',
      student_id: user.participant_code || user.id,
      detail: `${participantLabel} completed consent and profile form confirmation.`,
      metadata: {
        consent_id: consent.id,
        consent_version: CONSENT_VERSION,
        consented_at: consent.consented_at,
        profile_form_confirmed_at: consent.profile_form_confirmed_at,
      },
    });

    navigate('/', { replace: true });
  };

  return (
    <main className="min-h-dvh bg-background px-[var(--spacing-page)] py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">Aura Academic</p>
            <h1 className="mt-2 text-[28px] font-light text-on-surface">知情同意與基本資料確認</h1>
          </div>
          <div className="rounded-full border border-outline-variant/40 bg-surface px-4 py-2 text-[13px] font-medium text-on-surface-variant">
            {participantLabel}
          </div>
        </div>

        <section className="rounded-[24px] border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="mb-6 text-[22px] font-bold text-on-surface text-center">實驗研究參與同意書</h2>
          <div className="space-y-6 text-[14px] leading-relaxed text-on-surface-variant">
            {/* 基本資訊 */}
            <div className="bg-surface p-4 rounded-xl border border-outline-variant/30">
              <ul className="space-y-2">
                <li><span className="font-bold text-on-surface">計畫名稱：</span>以AI檢查點支持設計學生自我調節迭代之RtD研究</li>
                <li><span className="font-bold text-on-surface">計畫主持人姓名：</span>黃彩柔</li>
                <li><span className="font-bold text-on-surface">實驗地點：</span>線上網路操作</li>
              </ul>
            </div>

            {/* 各項說明 */}
            <div>
              <h3 className="font-bold text-[16px] text-on-surface mb-2">■ 研究目的與流程說明：</h3>
              <p>本研究旨在探討導入「AI檢查點系統（Aura Academic）」後，如何輔助並支持設計領域學生在進行專題研究或設計開發過程中的自我調節與迭代歷程。參與本研究之過程中，您將獲邀使用本平台進行專題提案之建立、階段性檢查點之提交、設計作品與文件之匯出及上傳，並閱讀由人工智慧所生成之階段性回饋與建議。本研究純屬學術探討性質，側重於使用者之設計決策與行為分析，並非涉及任何身體檢測或醫療診斷範疇。</p>
            </div>

            <div>
              <h3 className="font-bold text-[16px] text-on-surface mb-2">■ 參與者納入條件：</h3>
              <p>本研究之受試對象，主要招募具備設計相關學術背景或實務經驗之人員與學生。</p>
            </div>

            <div>
              <h3 className="font-bold text-[16px] text-on-surface mb-2">■ 潛在風險評估與防範機制：</h3>
              <p>本研究過程主要透過線上系統進行常規的軟體操作與介面體驗，經評估不會對參與者之生理或心理層面產生任何可預期之風險或損害。倘若於研究過程中因系統操作而產生疲勞或任何不適感，您可隨時中斷操作並休息。若依本研究所訂之實驗流程進行而發生非預期之不良反應，研究團隊將於釐清相關責任歸屬後，提供必要之協助。</p>
            </div>

            <div>
              <h3 className="font-bold text-[16px] text-on-surface mb-2">■ 參與回饋與補償：</h3>
              <p>本研究屬純學術性質之系統評估，故未提供任何形式之金錢補償或實質報酬。我們由衷感謝您無償貢獻寶貴之時間參與本研究，您的協助將對於設計教育與教育科技之發展具有重要之學術貢獻。</p>
            </div>

            <div>
              <h3 className="font-bold text-[16px] text-on-surface mb-2">■ 資料保密與隱私權宣告：</h3>
              <p>於研究期間，系統將自動記錄您的登入活動、同意時間戳記、專案與檢查點之操作軌跡、檔案上傳紀錄、AI 回饋數據及研究用之微探針問卷回覆。前述所蒐集之研究資料，均依循匿名化或去識別化之原則進行處理，並僅限本研究團隊核心成員用於學術分析。研究成果之發表將採整體數據或趨勢描述之形式，絕不會揭露任何足以辨識個人身分之實驗結果或私領域資訊。所有數位資料將妥善保存於加密或受保護之研究載體中，並預計於 2028 年底進行全數銷毀。</p>
            </div>

            <div>
              <h3 className="font-bold text-[16px] text-on-surface mb-2">■ 利益衝突與商業應用聲明：</h3>
              <p>本研究計畫及其衍生之研究成果與分析數據，僅供作為學術論文發表、教學研討或學術交流之用，絕無牽涉任何形式之專利申請或衍生之商業利益分配。</p>
            </div>

            <div>
              <h3 className="font-bold text-[16px] text-on-surface mb-2">■ 自主意願與退出權利：</h3>
              <p>您得基於個人自主意願，自由選擇是否參與本研究。於實驗進行之任何階段，您皆有權隨時終止或退出參與，無須提供任何理由，亦無須承擔任何法律與賠償責任。您退出研究之決定，絕不會對您的學業成績、課堂評價或既有之任何權益造成負面影響。</p>
            </div>

            <div>
              <h3 className="font-bold text-[16px] text-on-surface mb-2">■ 聯絡資訊：</h3>
              <p>倘若您對本研究之流程、參與者權益或實驗資料之處置有任何疑義，歡迎隨時與本計畫之研究團隊聯繫。<br />
              計畫主持人：黃彩柔<br />
              聯絡電話：0979979272<br />
              電子信箱：m11435018@yuntech.edu.tw</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary-container/10 p-4">
            <p className="text-[13px] font-bold text-on-surface">基本資料表單</p>
            <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">
              請先開啟 Google 表單填寫基本資料，完成後回到此頁勾選確認。
            </p>
            {hasProfileFormUrl ? (
              <a
                href={profileFormUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-on-primary transition-opacity hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                開啟基本資料表單
              </a>
            ) : (
              <div className="mt-3 rounded-xl border border-status-warning-border bg-status-warning-bg/40 p-3 text-[13px] leading-relaxed text-status-warning">
                尚未設定基本資料表單連結。請在 .env.local 或 Vercel Environment Variables 設定 VITE_PROFILE_FORM_URL。
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-start gap-3 rounded-2xl border border-outline-variant/30 bg-surface p-4 text-[14px] text-on-surface">
              <input
                type="checkbox"
                checked={hasRead}
                onChange={(event) => setHasRead(event.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>我已閱讀研究說明，並同意參與本研究。</span>
            </label>
            <label className={`flex items-start gap-3 rounded-2xl border border-outline-variant/30 bg-surface p-4 text-[14px] text-on-surface ${hasProfileFormUrl ? '' : 'opacity-50'}`}>
              <input
                type="checkbox"
                checked={hasCompletedForm}
                disabled={!hasProfileFormUrl}
                onChange={(event) => setHasCompletedForm(event.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>我已完成 Google 基本資料表單。</span>
            </label>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/login"
              className="rounded-full border border-outline-variant/50 px-5 py-3 text-center text-[14px] font-medium text-on-surface-variant transition-colors hover:bg-surface-variant/40"
            >
              回到登入
            </Link>
            <button
              type="button"
              disabled={!canContinue}
              onClick={handleSubmit}
              className="flex-1 rounded-full bg-gradient-to-r from-primary to-tertiary px-5 py-3 text-[14px] font-bold text-on-primary shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-40"
            >
              同意並進入首頁
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
