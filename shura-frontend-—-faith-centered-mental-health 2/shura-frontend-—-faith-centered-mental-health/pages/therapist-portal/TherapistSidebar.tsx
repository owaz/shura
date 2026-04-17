import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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

const MenuIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const CloseIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

interface TherapistSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

const TherapistSidebar: React.FC<TherapistSidebarProps> = ({ isOpen, onClose, onOpen }) => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };
    
    const linkClass = "flex items-center px-4 py-3 text-ivory/80 hover:bg-brown-dark hover:text-white rounded-lg transition-colors duration-200";
    const activeLinkClass = "bg-brown-dark text-white font-semibold";

    return (
        <>
            {/* Mobile Menu Button - Fixed Top Right */}
            {!isOpen && (
                <button 
                    onClick={onOpen}
                    className="fixed top-24 left-4 z-40 md:hidden p-2 text-brown-soft hover:text-brown-dark"
                >
                    <MenuIcon className="h-6 w-6" />
                </button>
            )}

            {/* Overlay for Mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/30 z-30 md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed md:fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-brown-soft text-ivory flex flex-col p-4 shadow-lg z-40 transform transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:w-64`}>
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <Logo className="h-8 w-8" />
                        <span className="text-lg font-serif font-bold whitespace-nowrap">Portal</span>
                    </div>
                    <button 
                        onClick={onClose}
                        className="md:hidden text-ivory hover:text-white"
                    >
                        <CloseIcon className="h-5 w-5" />
                    </button>
                </div>
                <nav className="flex-grow overflow-y-auto">
                    <ul className="space-y-2">
                        <li className="mb-6 pb-6 border-b border-ivory/20">
                            <p className="text-xs font-semibold text-ivory/60 uppercase">Portal</p>
                        </li>
                        <li>
                            <NavLink to="/therapist-portal/dashboard" onClick={onClose} className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <DashboardIcon className="h-5 w-5 mr-3" />
                                <span>Dashboard</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/therapist-portal/calendar" onClick={onClose} className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <CalendarIcon className="h-5 w-5 mr-3" />
                                <span>Calendar</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/therapist-portal/chat" onClick={onClose} className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <ChatIcon className="h-5 w-5 mr-3" />
                                <span>Chat</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/therapist-portal/intake-forms" onClick={onClose} className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <ClipboardIcon className="h-5 w-5 mr-3" />
                                <span>Intake Forms</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/therapist-portal/payments" onClick={onClose} className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <PaymentsIcon className="h-5 w-5 mr-3" />
                                <span>Payments</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/therapist-portal/profile" onClick={onClose} className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                                <ProfileIcon className="h-5 w-5 mr-3" />
                                <span>Profile</span>
                            </NavLink>
                        </li>
                    </ul>
                </nav>
                <div className="mt-auto pt-4 border-t border-ivory/20">
                    <button onClick={handleLogout} className={`${linkClass} w-full justify-start`}>
                        <LogoutIcon className="h-5 w-5 mr-3" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default TherapistSidebar;
