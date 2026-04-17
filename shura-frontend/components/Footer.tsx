import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

const Footer: React.FC = () => {
  return (
    <footer className="bg-sand text-brown-soft">
      <div className="container mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <p className="text-lg italic font-serif">“Indeed, in the remembrance of Allah do hearts find rest.”</p>
          <p className="mt-1 text-sm">(Qur'an 13:28)</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center md:text-left">
          <div>
            <Link to="/" className="flex items-center justify-center md:justify-start gap-2 mb-4 group">
                <Logo className="h-7 w-7 text-brown-dark" />
                <h3 className="font-serif text-xl font-bold text-brown-dark group-hover:text-brown-soft transition-colors">Shura</h3>
            </Link>
            <p className="text-sm">Where Faith Meets Healing.</p>
          </div>
          <div>
            <h4 className="font-semibold text-brown-dark mb-4">Navigate</h4>
            <ul className="space-y-2">
              <li><Link to="/about" className="hover:text-brown-soft transition-colors">About Us</Link></li>
              <li><Link to="/therapists" className="hover:text-brown-soft transition-colors">Our Therapists</Link></li>
              <li><Link to="/shura-hub" className="hover:text-brown-soft transition-colors">Shura Hub</Link></li>
              <li><Link to="/contact" className="hover:text-brown-soft transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-brown-dark mb-4">Support</h4>
            <ul className="space-y-2">
              <li><Link to="/contact" className="hover:text-brown-soft transition-colors">Contact</Link></li>
              <li><Link to="/contact#faq" className="hover:text-brown-soft transition-colors">FAQ</Link></li>
              <li><Link to="/join-our-network" className="hover:text-brown-soft transition-colors">Join as a Therapist</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-brown-dark mb-4">Connect</h4>
            {/* Social media links can be added here */}
            <p className="text-sm">connect@shura.health</p>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-taupe/50 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Shura. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;