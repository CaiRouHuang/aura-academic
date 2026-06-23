import { NavLink, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';

export default function NavBar() {
  const location = useLocation();
  const { t } = useTranslation();
  const user = getCurrentUser();
  const isTeacher = user?.role === 'teacher';
  const isDev = user?.role === 'dev';

  const navItems = [
    { to: '/', icon: 'home', label: t('nav.home') },
    { to: '/assignments', icon: 'assignment', label: t('nav.assignments') },
    { to: '/projects', icon: 'account_tree', label: t('nav.projects') },
    { to: '/upload', icon: 'cloud_upload', label: t('nav.upload'), prominent: true },
    { to: '/log', icon: 'list_alt', label: t('nav.log') },
    { to: '/profile', icon: 'person', label: t('nav.profile') },
  ];

  const items = isTeacher
    ? [
        { to: '/teacher', icon: 'home', label: t('nav.home') },
        { to: '/teacher/assignments', icon: 'assignment', label: t('nav.assignments') },
        { to: '/teacher/dashboard', icon: 'account_tree', label: t('nav.projects') },
        { to: '/upload', icon: 'cloud_upload', label: t('nav.upload'), prominent: true },
        { to: '/log', icon: 'list_alt', label: t('nav.log') },
        { to: '/profile', icon: 'person', label: t('nav.profile') },
      ]
    : isDev
    ? [
        { to: '/dev', icon: 'developer_mode', label: 'Developer' },
        ...navItems
      ]
    : navItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 h-24 glass-nav border-t border-outline-variant/25 shadow-[0_-8px_30px_rgba(87,56,120,0.07)] rounded-t-[24px] pb-safe">
      {items.map((item) => {
        const isActive = item.to === '/' || item.to === '/teacher' || item.to === '/dev'
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to);

        if (item.prominent) {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center w-16 group active:scale-95 transition-transform"
            >
              <div className={`relative w-12 h-12 rounded-[20px] flex items-center justify-center transition-all ${
                isActive ? 'bg-primary-container/40 text-primary' : 'bg-transparent text-on-surface-variant/60'
              } group-hover:bg-primary-container/30 group-hover:text-primary`}>
                <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
              </div>
              <span className={`text-[10px] font-medium mt-1 transition-colors ${
                isActive ? 'text-primary' : 'text-on-surface-variant/60'
              }`}>{item.label}</span>
            </NavLink>
          );
        }

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex flex-col items-center justify-center w-16 group active:scale-95 transition-transform"
          >
            <div className="relative">
              <div className={`absolute -inset-3 bg-primary-container/35 rounded-[18px] transition-all duration-300 ${
                isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
              }`} />
              <span
                className={`material-symbols-outlined text-[24px] relative z-10 transition-colors ${
                  isActive ? 'text-primary' : 'text-on-surface-variant/60 group-hover:text-primary/80'
                }`}
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
            </div>
            <span className={`text-[10px] font-medium mt-1 transition-colors ${
              isActive ? 'text-primary font-bold' : 'text-on-surface-variant/60'
            }`}>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
