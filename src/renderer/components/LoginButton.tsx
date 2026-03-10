import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { authService } from '../services/auth';
import { i18nService } from '../services/i18n';

const UserMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const quota = useSelector((state: RootState) => state.auth.quota);

  const handleLogout = async () => {
    await authService.logout();
    onClose();
  };

  const handleTopUp = async () => {
    await window.electron.shell.openExternal('https://portal.lobsterai.com');
  };

  const phoneSuffix = user?.phone ? user.phone.slice(-4) : '';

  return (
    <div className="absolute bottom-full left-0 mb-1 w-56 dark:bg-claude-darkSurface bg-claude-surface rounded-xl shadow-popover border dark:border-claude-darkBorder border-claude-border overflow-hidden z-50 popover-enter">
      {/* User info */}
      <div className="px-4 py-3 border-b dark:border-claude-darkBorder border-claude-border">
        <div className="text-sm font-medium dark:text-claude-darkText text-claude-text truncate">
          {user?.nickname || phoneSuffix}
        </div>
        {phoneSuffix && (
          <div className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary mt-0.5">
            ****{phoneSuffix}
          </div>
        )}
      </div>

      {/* Quota info */}
      {quota && (
        <div className="px-4 py-3 border-b dark:border-claude-darkBorder border-claude-border">
          <div className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary mb-1.5">
            {i18nService.t('authDailyQuota')}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-claude-accent transition-all"
                style={{ width: `${Math.min(100, (quota.dailyUsed / Math.max(1, quota.dailyLimit)) * 100)}%` }}
              />
            </div>
            <span className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary shrink-0">
              {quota.dailyUsed}/{quota.dailyLimit}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="py-1">
        <button
          type="button"
          onClick={handleTopUp}
          className="w-full px-4 py-2 text-left text-sm dark:text-claude-darkText text-claude-text dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover transition-colors"
        >
          {i18nService.t('authTopUp')}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full px-4 py-2 text-left text-sm text-red-500 dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover transition-colors"
        >
          {i18nService.t('authLogout')}
        </button>
      </div>
    </div>
  );
};

const LoginButton: React.FC = () => {
  const { isLoggedIn, isLoading, user } = useSelector((state: RootState) => state.auth);
  const [showMenu, setShowMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  if (isLoading) {
    return null;
  }

  const handleClick = async () => {
    if (isLoggedIn) {
      setShowMenu(!showMenu);
    } else {
      await authService.login();
    }
  };

  const phoneSuffix = user?.phone ? user.phone.slice(-4) : '';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium dark:text-claude-darkTextSecondary text-claude-textSecondary hover:text-claude-text dark:hover:text-claude-darkText hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
      >
        {isLoggedIn ? (
          <>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-4 w-4 rounded-full" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></svg>
            )}
            <span className="truncate max-w-[80px]">{user?.nickname || `****${phoneSuffix}`}</span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></svg>
            {i18nService.t('login')}
          </>
        )}
      </button>
      {showMenu && <UserMenu onClose={() => setShowMenu(false)} />}
    </div>
  );
};

export default LoginButton;
