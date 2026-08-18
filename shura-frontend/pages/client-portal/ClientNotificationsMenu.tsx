import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientPortalApi, PORTAL_NOTIFICATIONS_CHANGED_EVENT } from './clientPortalApi';
import type { ClientNotification, Pagination } from './clientPortalTypes';

const relativeTime = (value: string) => {
  const elapsedSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, 'second');
  const minutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
};

const ClientNotificationsMenu: React.FC = () => {
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const loadCount = useCallback(async () => {
    try {
      const result = await clientPortalApi.getNotificationCount();
      setUnreadCount(result.unreadCount);
    } catch {
      // The panel exposes a retry state; a silent badge failure should not block navigation.
    }
  }, []);

  const loadPage = useCallback(async (page: number, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const result = await clientPortalApi.getNotifications(page, 10);
      setNotifications((current) => append ? [...current, ...result.data] : result.data);
      setPagination(result.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Notifications could not be loaded.');
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCount();
    const refresh = () => void loadCount();
    window.addEventListener(PORTAL_NOTIFICATIONS_CHANGED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener(PORTAL_NOTIFICATIONS_CHANGED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [loadCount]);

  useEffect(() => {
    if (!open) return;
    void loadPage(1);
    void loadCount();
    window.requestAnimationFrame(() => panel.current?.focus());
  }, [loadCount, loadPage, open]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [open]);

  const markRead = async (notification: ClientNotification) => {
    if (notification.readAt) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt } : item));
    setUnreadCount((current) => Math.max(0, current - 1));
    try {
      const result = await clientPortalApi.markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: result.readAt } : item));
      setStatusMessage('Notification marked as read.');
    } catch (markError) {
      setNotifications((current) => current.map((item) => item.id === notification.id ? notification : item));
      setUnreadCount((current) => current + 1);
      setError(markError instanceof Error ? markError.message : 'The notification could not be updated.');
    }
  };

  const markAllRead = async () => {
    const previous = notifications;
    const previousCount = unreadCount;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));
    setUnreadCount(0);
    try {
      await clientPortalApi.markAllNotificationsRead();
      setStatusMessage('All notifications marked as read.');
    } catch (markError) {
      setNotifications(previous);
      setUnreadCount(previousCount);
      setError(markError instanceof Error ? markError.message : 'Notifications could not be updated.');
    }
  };

  const followAction = async (notification: ClientNotification) => {
    await markRead(notification);
    if (!notification.action) return;
    setOpen(false);
    navigate(notification.action.href);
  };

  const visibleCount = unreadCount > 99 ? '99+' : String(unreadCount);
  const notificationLabel = unreadCount > 0
    ? `Notifications, ${visibleCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}`
    : 'Notifications, no unread notifications';

  return (
    <div ref={root} className="relative">
      <button ref={trigger} type="button" onClick={() => setOpen((value) => !value)} className="relative rounded-full p-2 text-brown-soft hover:bg-sand focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2" aria-label={notificationLabel} aria-expanded={open} aria-controls="client-notification-panel">
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B76243] px-1 text-[9px] font-bold text-white" aria-hidden="true">{visibleCount}</span>}
        <span className="sr-only">{unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}</span>
      </button>
      {open && <div id="client-notification-panel" ref={panel} tabIndex={-1} className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[75vh] overflow-hidden rounded-2xl border border-[#E2D5C9] bg-white shadow-2xl outline-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[390px]" aria-label="Notifications panel">
        <div className="flex items-center gap-3 border-b border-sand px-5 py-4">
          <div><h2 className="font-serif text-xl font-semibold text-brown-dark">Notifications</h2><p className="text-xs text-brown-soft">Updates about your care and account</p></div>
          {unreadCount > 0 && <button type="button" onClick={() => void markAllRead()} className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-[#8C4F3A] hover:bg-[#FBF2EC] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A]">Mark all read</button>}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <div className="space-y-3 p-5" role="status"><span className="sr-only">Loading notifications</span>{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-sand/70 motion-reduce:animate-none" />)}</div>}
          {!loading && error && <div className="p-6 text-center" role="alert"><p className="text-sm text-[#8D352D]">{error}</p><button type="button" onClick={() => void loadPage(1)} className="mt-3 rounded-full border border-[#BCA998] px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#8C4F3A]">Try again</button></div>}
          {!loading && !error && notifications.length === 0 && <div className="px-6 py-12 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EEF3EB] text-xl" aria-hidden="true">✓</div><p className="mt-4 font-semibold text-brown-dark">You’re all caught up</p><p className="mt-1 text-sm text-brown-soft">New care updates will appear here.</p></div>}
          {!loading && !error && notifications.length > 0 && <ul className="divide-y divide-sand">{notifications.map((notification) => <li key={notification.id} className={notification.readAt ? 'bg-white' : 'bg-[#FFF9F3]'}>
            <div className="px-5 py-4">
              <div className="flex gap-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? 'bg-[#D7CDC3]' : 'bg-[#B76243]'}`} aria-hidden="true" /><div className="min-w-0 flex-1"><p className="font-semibold text-brown-dark">{notification.title}</p>{notification.body && <p className="mt-1 text-sm leading-5 text-brown-soft">{notification.body}</p>}<p className="mt-2 text-xs text-[#806C5B]">{relativeTime(notification.createdAt)}</p></div></div>
              <div className="mt-3 flex justify-end gap-2">{!notification.readAt && <button type="button" onClick={() => void markRead(notification)} className="rounded-lg px-2 py-1 text-xs font-semibold text-brown-soft hover:bg-sand focus:outline-none focus:ring-2 focus:ring-[#8C4F3A]">Mark read</button>}{notification.action && <button type="button" onClick={() => void followAction(notification)} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#8C4F3A] hover:bg-[#FBF2EC] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A]">{notification.action.label}</button>}</div>
            </div>
          </li>)}</ul>}
          {!loading && !error && pagination.page < pagination.totalPages && <div className="border-t border-sand p-4 text-center"><button type="button" disabled={loadingMore} onClick={() => void loadPage(pagination.page + 1, true)} className="rounded-full border border-[#BCA998] px-4 py-2 text-sm font-semibold text-brown-dark focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more'}</button></div>}
        </div>
        <p className="sr-only" role="status" aria-live="polite">{statusMessage}</p>
      </div>}
    </div>
  );
};

export default ClientNotificationsMenu;
