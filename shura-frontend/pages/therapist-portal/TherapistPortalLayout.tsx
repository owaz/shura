
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { PaymentsIcon, ChatIcon } from '../../components/Icons';

const DashboardIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
);

const ProfileIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const LogoutIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

const CallIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
);

const CalendarIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const ClipboardIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
);

const TherapistPortalLayout: React.FC = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };
    
    const linkClass = "flex items-center px-4 py-3 text-ivory/80 hover:bg-brown-dark hover:text-white rounded-lg transition-colors duration-200";
    const activeLinkClass = "bg-brown-dark text-white font-semibold";

    return (
        <div className="flex h-screen bg-cream">
            {/* Sidebar */}
            <aside className="w-64 bg-brown-soft text-ivory flex flex-col p-4 shadow-lg">
                <div className="flex items-center gap-2 px-4 py-2 mb-8">
                    <Logo className="h-8 w-8" />
                    <span className="text-xl font-serif font-bold">Shura Portal</span>
                </div>
                <nav className="flex-grow">
                    <ul className="space-y-2">
                        <li>
                            <NavLink to="/therapist-portal/dashboard" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <DashboardIcon className="h-5 w-5 mr-3" />
                                <span>Dashboard</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/therapist-portal/calendar" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <CalendarIcon className="h-5 w-5 mr-3" />
                                <span>Calendar</span>
                            </NavLink>
                        </li>
                         <li>
                            <NavLink to="/therapist-portal/chat" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <ChatIcon className="h-5 w-5 mr-3" />
                                <span>Chat</span>
                            </NavLink>
                        </li>
                         <li>
                            <NavLink to="/therapist-portal/intake-forms" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <ClipboardIcon className="h-5 w-5 mr-3" />
                                <span>Intake Forms</span>
                            </NavLink>
                        </li>
                         <li>
                            <NavLink to="/therapist-portal/payments" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <PaymentsIcon className="h-5 w-5 mr-3" />
                                <span>Payments</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/therapist-portal/profile" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <ProfileIcon className="h-5 w-5 mr-3" />
                                <span>Profile</span>
                            </NavLink>
                        </li>
                    </ul>
                </nav>
                <div className="mt-auto">
                    <button onClick={handleLogout} className={`${linkClass} w-full`}>
                        <LogoutIcon className="h-5 w-5 mr-3" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-sand">
                    <div className="container mx-auto px-6 py-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TherapistPortalLayout;
