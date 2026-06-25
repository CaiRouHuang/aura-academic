import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../../lib/store';
import { useTranslation } from '../../lib/i18n';

export default function SideBar() {
  const location = useLocation();
  const { t } = useTranslation();
  const user = getCurrentUser();
  const isTeacher = user?.role === 'teacher';
  const isDev = user?.role === 'dev';
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems = [
    { to: '/', icon: 'home', label: t('nav.home') },
    { to: '/assignments', icon: 'assignment', label: t('nav.assignments') },
    { to: '/projects', icon: 'account_tree', label: t('nav.projects') },
    { to: '/upload', icon: 'cloud_upload', label: t('nav.upload') },
    { to: '/log', icon: 'list_alt', label: t('nav.log') },
    { to: '/profile', icon: 'person', label: t('nav.profile') },
  ];

  const items = isTeacher
    ? [
        { to: '/teacher', icon: 'home', label: t('nav.home') },
        { to: '/teacher/assignments', icon: 'assignment', label: t('nav.assignments') },
        { to: '/teacher/dashboard', icon: 'account_tree', label: t('nav.projects') },
        { to: '/upload', icon: 'cloud_upload', label: t('nav.upload') },
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
    <nav 
      className={`hidden md:flex flex-col fixed top-0 left-0 h-full z-50 glass-nav border-r border-outline-variant/25 transition-all duration-300 ${
        isExpanded ? 'w-64' : 'w-20'
      }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex items-center justify-center h-24 mb-8">
        <span className="material-symbols-outlined text-primary text-[32px]">
          school
        </span>
        {isExpanded && (
          <span className="ml-3 font-bold text-xl text-primary whitespace-nowrap animate-fade-in">
            NAVI
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 px-3">
        {items.map((item) => {
          const isActive = item.to === '/' || item.to === '/teacher' || item.to === '/dev'
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center px-4 py-3 rounded-[16px] transition-all duration-200 group ${
                isActive 
                  ? 'bg-primary-container/40 text-primary' 
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <span 
                className={`material-symbols-outlined text-[24px] ${
                  isActive ? 'text-primary' : 'text-on-surface-variant/80 group-hover:text-primary/80'
                }`}
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              
              {isExpanded && (
                <span className={`ml-4 text-[15px] font-medium whitespace-nowrap animate-fade-in ${
                  isActive ? 'text-primary font-bold' : ''
                }`}>
                  {item.label}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
