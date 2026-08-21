import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import ClientNotificationsMenu from './ClientNotificationsMenu';
import { clientPortalApi } from './clientPortalApi';

type IconName = 'home' | 'calendar' | 'heart' | 'user' | 'settings' | 'card' | 'logout' | 'bell' | 'menu' | 'close';

const Icon: React.FC<{ name: IconName; className?: string }> = ({ name, className = 'h-5 w-5' }) => {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" /><path d="M9.5 12h5M12 9.5v5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    settings: <><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="m19.4 15 .1 1.6-2.1 1.2-1.3-1a7.8 7.8 0 0 1-2 .8l-.4 1.6h-2.4l-.4-1.6a7.8 7.8 0 0 1-2-.8l-1.3 1-2.1-1.2.1-1.6a8 8 0 0 1-1-1.7L3 12l1.6-1.3a8 8 0 0 1 1-1.7l-.1-1.6 2.1-1.2 1.3 1a7.8 7.8 0 0 1 2-.8l.4-1.6h2.4l.4 1.6a7.8 7.8 0 0 1 2 .8l1.3-1 2.1 1.2-.1 1.6a8 8 0 0 1 1 1.7L21 12l-1.6 1.3a8 8 0 0 1-1 1.7Z" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-6" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{paths[name]}</svg>;
};

const navItems: Array<{ to: string; label: string; icon: IconName; mobile?: boolean }> = [
  { to: '/portal/home', label: 'Home', icon: 'home', mobile: true },
  { to: '/portal/sessions', label: 'My Sessions', icon: 'calendar', mobile: true },
  { to: '/portal/therapist', label: 'My Therapist', icon: 'heart', mobile: true },
  { to: '/portal/profile', label: 'My Profile', icon: 'user', mobile: true },
  { to: '/portal/preferences', label: 'Preferences', icon: 'settings' },
  { to: '/portal/billing', label: 'Billing', icon: 'card' },
];

const titleForPath = (pathname: string) => {
  const item = navItems.find(({ to }) => to === pathname);
  return item?.label || (pathname === '/portal/onboarding'
    ? 'Welcome to Shura'
    : pathname === '/portal/book'
      ? 'Book a Session'
      : 'Client Portal');
};

const initials = (name?: string, email?: string) => {
  const values = (name || email || 'S').trim().split(/\s+/).filter(Boolean);
  return values.slice(0, 2).map((value) => value[0]).join('').toUpperCase();
};

const PortalContentFallback: React.FC = () => (
  <div className="space-y-5" role="status" aria-live="polite">
    <span className="sr-only">Loading this portal page</span>
    <div className="h-32 animate-pulse rounded-2xl border border-sand bg-white/80 motion-reduce:animate-none" aria-hidden="true" />
    <div className="h-52 animate-pulse rounded-2xl border border-sand bg-white/80 motion-reduce:animate-none" aria-hidden="true" />
  </div>
);

const ClientPortalLayout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const mobileMenuButton = useRef<HTMLButtonElement>(null);
  const mobileSidebar = useRef<HTMLElement>(null);
  const accountRoot = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const pageTitle = useMemo(() => titleForPath(location.pathname), [location.pathname]);
  const visibleNavItems = useMemo(() => navItems.filter((item) => item.to !== '/portal/billing' || billingEnabled), [billingEnabled]);

  useEffect(() => {
    let active = true;
    clientPortalApi.getSettings()
      .then((settings) => { if (active) setBillingEnabled(settings.features?.billingEnabled === true); })
      .catch(() => { if (active) setBillingEnabled(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const desktopMedia = window.matchMedia('(min-width: 1024px)');
    const closeAtDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setSidebarOpen(false);
    };
    closeAtDesktop(desktopMedia);
    desktopMedia.addEventListener('change', closeAtDesktop);
    return () => desktopMedia.removeEventListener('change', closeAtDesktop);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileSidebar.current?.querySelector<HTMLElement>('button, a')?.focus();
    const handleSidebarKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !mobileSidebar.current) return;
      const focusable = [...mobileSidebar.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleSidebarKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleSidebarKeys);
      if (window.matchMedia('(min-width: 1024px)').matches) {
        document.getElementById('portal-main')?.focus();
      } else {
        mobileMenuButton.current?.focus();
      }
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && accountRoot.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
      if (event instanceof KeyboardEvent) accountButton.current?.focus();
    };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeMenu);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeMenu);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl border-l-4 px-3 py-3 text-sm transition-colors ${
      isActive
        ? 'border-[#B76243] bg-sand/80 font-semibold text-brown-dark'
        : 'border-transparent text-brown-soft hover:bg-sand/60 hover:text-brown-dark'
    }`;

  const sidebar = (mobile = false) => (
    <nav aria-label="Client portal navigation" className="flex h-full flex-col px-3 py-5">
      <div className="mb-8 flex items-center justify-between px-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <Logo className="h-9 w-9 shrink-0" />
          {(!desktopCollapsed || mobile) && <span className="whitespace-nowrap font-serif text-xl font-bold text-brown-dark">Shura</span>}
        </div>
        {mobile && <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-brown-soft hover:bg-sand" aria-label="Close navigation"><Icon name="close" /></button>}
      </div>
      <ul className="space-y-1">
        {visibleNavItems.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} onClick={() => setSidebarOpen(false)} className={linkClass} title={desktopCollapsed && !mobile ? item.label : undefined}>
              <Icon name={item.icon} className="h-5 w-5 shrink-0" />
              {(!desktopCollapsed || mobile) && <span>{item.label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t border-sand pt-4">
        <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-brown-soft transition-colors hover:bg-sand/60 hover:text-brown-dark" title={desktopCollapsed && !mobile ? 'Sign Out' : undefined}>
          <Icon name="logout" className="h-5 w-5 shrink-0" />
          {(!desktopCollapsed || mobile) && <span>Sign Out</span>}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-brown-dark">
      <a href="#portal-main" className="sr-only z-[100] rounded-md bg-white px-4 py-3 text-brown-dark focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-[#8C4F3A]">Skip to portal content</a>
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-sand bg-white/95 shadow-sm lg:block ${desktopCollapsed ? 'w-20' : 'w-64'}`}>
        {sidebar()}
        <button type="button" onClick={() => setDesktopCollapsed((value) => !value)} className="absolute -right-3 top-8 rounded-full border border-sand bg-white px-1.5 py-1 text-brown-soft shadow-sm" aria-label={desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'}>‹</button>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-brown-dark/30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
      {sidebarOpen && <aside ref={mobileSidebar} role="dialog" aria-modal="true" aria-label="Client portal navigation" className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl lg:hidden">
        {sidebar(true)}
      </aside>}

      <div className={`${desktopCollapsed ? 'lg:pl-20' : 'lg:pl-64'} min-h-screen`}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-sand bg-[#FAF7F2]/95 px-4 backdrop-blur md:px-7">
          <div className="flex items-center gap-3">
            <button ref={mobileMenuButton} type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-brown-soft hover:bg-sand focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] lg:hidden" aria-label="Open navigation" aria-expanded={sidebarOpen}><Icon name="menu" /></button>
            <Logo className="h-7 w-7 lg:hidden" />
            <h1 className="font-serif text-xl font-semibold text-brown-dark md:text-2xl">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <ClientNotificationsMenu />
            <div ref={accountRoot} className="relative">
              <button ref={accountButton} type="button" onClick={() => setMenuOpen((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1D7C5] text-xs font-bold text-brown-dark ring-2 ring-white focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2" aria-label="Account menu" aria-expanded={menuOpen} aria-controls="client-account-menu">{initials(currentUser?.full_name, currentUser?.email)}</button>
              {menuOpen && <div id="client-account-menu" className="absolute right-0 mt-2 w-44 rounded-xl border border-sand bg-white p-1 shadow-lg">
                <button type="button" onClick={() => { setMenuOpen(false); navigate('/portal/profile'); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-brown-dark hover:bg-sand focus:outline-none focus:ring-2 focus:ring-[#8C4F3A]">My Profile</button>
                <button type="button" onClick={() => { setMenuOpen(false); navigate('/portal/preferences'); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-brown-dark hover:bg-sand focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] md:hidden">Preferences</button>
                {billingEnabled && <button type="button" onClick={() => { setMenuOpen(false); navigate('/portal/billing'); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-brown-dark hover:bg-sand focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] md:hidden">Billing</button>}
                <button type="button" onClick={handleLogout} className="w-full rounded-lg px-3 py-2 text-left text-sm text-brown-dark hover:bg-sand focus:outline-none focus:ring-2 focus:ring-[#8C4F3A]">Sign Out</button>
              </div>}
            </div>
          </div>
        </header>
        <main id="portal-main" tabIndex={-1} className="mx-auto max-w-7xl px-4 pb-24 pt-6 outline-none md:px-7 md:pt-8 lg:pb-8"><React.Suspense fallback={<PortalContentFallback />}><Outlet /></React.Suspense></main>
      </div>

      <nav aria-label="Mobile client portal navigation" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-sand bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-4px_18px_rgba(92,80,67,0.08)] md:hidden">
        {visibleNavItems.filter((item) => item.mobile).map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[11px] ${isActive ? 'font-semibold text-[#A75035]' : 'text-brown-soft'}`}>
            <Icon name={item.icon} className="h-5 w-5" />{item.label === 'My Sessions' ? 'Sessions' : item.label.replace('My ', '')}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default ClientPortalLayout;
