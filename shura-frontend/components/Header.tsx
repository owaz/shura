import React, { useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { MenuIcon, CloseIcon, ChevronDownIcon } from './Icons';
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';

const navLinks = [
  { name: 'Home', path: '/' },
  // About and Services will be handled separately
  { name: 'Therapists', path: '/therapists' },
  { name: 'Shura Hub', path: '/shura-hub' },
];

const aboutLinks = [
    { name: 'Our Story', path: '/about' },
    { name: 'Contact Us', path: '/contact' },
];

const servicesLinks = [
    { name: 'Individual Therapy', category: 'Individual' },
    { name: 'Couples Therapy', category: 'Couples' },
    { name: 'Family Therapy', category: 'Family' },
    { name: 'Child Therapy', category: 'Child' },
];

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [isMobileAboutOpen, setIsMobileAboutOpen] = useState(false);
  const [isMobileServicesOpen, setIsMobileServicesOpen] = useState(false);

  const [aboutTimeoutId, setAboutTimeoutId] = useState<number | null>(null);
  const [servicesTimeoutId, setServicesTimeoutId] = useState<number | null>(null);
  
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLoginClick = () => {
    closeAllMenus();
    navigate('/login-hub');
  };

  const handleLogout = () => {
    closeAllMenus();
    logout();
    navigate('/');
  };
  
  const closeAllMenus = () => {
    setIsMenuOpen(false);
    setIsAboutOpen(false);
    setIsServicesOpen(false);
    setIsMobileAboutOpen(false);
    setIsMobileServicesOpen(false);
  };

  const handleAboutEnter = () => {
    if (aboutTimeoutId) {
      clearTimeout(aboutTimeoutId);
      setAboutTimeoutId(null);
    }
    setIsAboutOpen(true);
  };

  const handleAboutLeave = () => {
    const timeoutId = window.setTimeout(() => {
      setIsAboutOpen(false);
    }, 200);
    setAboutTimeoutId(timeoutId);
  };
  
  const handleServicesEnter = () => {
    if (servicesTimeoutId) {
      clearTimeout(servicesTimeoutId);
      setServicesTimeoutId(null);
    }
    setIsServicesOpen(true);
  };

  const handleServicesLeave = () => {
    const timeoutId = window.setTimeout(() => {
      setIsServicesOpen(false);
    }, 200);
    setServicesTimeoutId(timeoutId);
  };

  const linkClass = "text-brown-dark hover:text-brown-soft transition-colors duration-300";
  const activeLinkClass = "text-brown-soft font-semibold";
  
  const isAboutActive = location.pathname.startsWith('/about') || location.pathname.startsWith('/contact');

  const AuthButton: React.FC<{ isMobile?: boolean }> = ({ isMobile }) => {
    const mobileClass = "block w-full py-3";
    const desktopClass = "px-6 py-2";
    if (isAuthenticated) {
      return (
        <button
          onClick={handleLogout}
          className={`bg-brown-soft text-white rounded-full hover:bg-opacity-90 transition-colors duration-300 font-semibold ${isMobile ? mobileClass : desktopClass}`}
        >
          Logout
        </button>
      );
    }
    if (isMobile) {
      return (
        <div className="space-y-2">
          <button
            onClick={handleLoginClick}
            className={`bg-brown-soft text-white rounded-full hover:bg-opacity-90 transition-colors duration-300 font-semibold ${mobileClass}`}
          >
            Login
          </button>
          <Link
            to="/signup"
            onClick={closeAllMenus}
            className={`bg-brown-soft text-white rounded-full hover:bg-opacity-90 transition-colors duration-300 font-semibold ${mobileClass} text-center block`}
          >
            Signup
          </Link>
        </div>
      );
    }
    return (
      <div className="flex gap-2">
        <button
          onClick={handleLoginClick}
          className={`bg-brown-soft text-white rounded-full hover:bg-opacity-90 transition-colors duration-300 font-semibold px-6 py-2`}
        >
          Login
        </button>
        <Link
          to="/signup"
          className={`bg-brown-soft text-white rounded-full hover:bg-opacity-90 transition-colors duration-300 font-semibold px-6 py-2 inline-block`}
        >
          Signup
        </Link>
      </div>
    );
  };

  return (
    <header className="bg-cream/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <NavLink to="/" onClick={closeAllMenus} className="flex items-center gap-2 text-3xl font-serif font-bold text-brown-dark hover:text-brown-soft transition-colors">
          <Logo className="h-8 w-8" />
          <span>Shura</span>
        </NavLink>
        <nav className="hidden md:flex items-center space-x-8">
          <ul className="flex items-center space-x-8">
             <li>
                <NavLink to={navLinks[0].path} className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                    {navLinks[0].name}
                </NavLink>
            </li>
            
            <li className="relative" onMouseEnter={handleAboutEnter} onMouseLeave={handleAboutLeave}>
                <NavLink to="/about" className={`${linkClass} ${isAboutActive ? activeLinkClass : ''} flex items-center gap-1`}>
                    About Us <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isAboutOpen ? 'rotate-180' : ''}`} />
                </NavLink>
                 {isAboutOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-white shadow-lg rounded-md py-2 z-50 animate-fade-in" style={{animationDuration: '150ms'}}>
                        <ul>
                            {aboutLinks.map(link => (
                                <li key={link.path}>
                                    <Link 
                                        to={link.path}
                                        onClick={() => setIsAboutOpen(false)}
                                        className="block px-4 py-2 text-brown-soft hover:bg-sand hover:text-brown-dark transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </li>

            <li className="relative" onMouseEnter={handleServicesEnter} onMouseLeave={handleServicesLeave}>
                <NavLink to="/services" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''} flex items-center gap-1`}>
                    Services <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isServicesOpen ? 'rotate-180' : ''}`} />
                </NavLink>
                {isServicesOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-white shadow-lg rounded-md py-2 z-50 animate-fade-in" style={{animationDuration: '150ms'}}>
                        <ul>
                            {servicesLinks.map(link => (
                                <li key={link.category}>
                                    <Link 
                                        to="/services" 
                                        state={{ defaultCategory: link.category }}
                                        onClick={() => setIsServicesOpen(false)}
                                        className="block px-4 py-2 text-brown-soft hover:bg-sand hover:text-brown-dark transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </li>
            {navLinks.slice(1).map((link) => (
              <li key={link.path}>
                <NavLink to={link.path} className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''}`}>
                  {link.name}
                </NavLink>
              </li>
            ))}
          </ul>
          <AuthButton />
        </nav>
        <div className="md:hidden">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Open menu">
            {isMenuOpen ? <CloseIcon className="h-7 w-7 text-brown-dark" /> : <MenuIcon className="h-7 w-7 text-brown-dark" />}
          </button>
        </div>
      </div>
      {isMenuOpen && (
        <div className="md:hidden bg-cream absolute top-full left-0 w-full shadow-lg">
          <div className="container mx-auto px-6 py-4">
            <ul className="space-y-4 text-center">
              <li>
                  <NavLink to={navLinks[0].path} className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''} block py-3 text-lg`} onClick={closeAllMenus}>{navLinks[0].name}</NavLink>
              </li>
              <li>
                    <button onClick={() => setIsMobileAboutOpen(!isMobileAboutOpen)} className={`${linkClass} ${isAboutActive ? activeLinkClass : ''} w-full flex justify-center items-center gap-1 py-3 text-lg`}>
                        About Us <ChevronDownIcon className={`h-5 w-5 transition-transform duration-200 ${isMobileAboutOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isMobileAboutOpen && (
                        <div className="bg-sand rounded-lg my-2 py-2">
                             {aboutLinks.map(link => (
                                <Link 
                                    key={link.path}
                                    to={link.path}
                                    onClick={closeAllMenus}
                                    className="block py-2 text-brown-soft hover:text-brown-dark transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </div>
                    )}
               </li>
               <li>
                    <button onClick={() => setIsMobileServicesOpen(!isMobileServicesOpen)} className={`${linkClass} w-full flex justify-center items-center gap-1 py-3 text-lg`}>
                        Services <ChevronDownIcon className={`h-5 w-5 transition-transform duration-200 ${isMobileServicesOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isMobileServicesOpen && (
                        <div className="bg-sand rounded-lg my-2 py-2">
                             {servicesLinks.map(link => (
                                <Link 
                                    key={link.category}
                                    to="/services" 
                                    state={{ defaultCategory: link.category }}
                                    onClick={closeAllMenus}
                                    className="block py-2 text-brown-soft hover:text-brown-dark transition-colors"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </div>
                    )}
               </li>
               {navLinks.slice(1).map((link) => (
                  <li key={link.path}>
                    <NavLink to={link.path} className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : ''} block py-3 text-lg`} onClick={closeAllMenus}>{link.name}</NavLink>
                  </li>
              ))}
              <li>
                <AuthButton isMobile />
              </li>
            </ul>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;