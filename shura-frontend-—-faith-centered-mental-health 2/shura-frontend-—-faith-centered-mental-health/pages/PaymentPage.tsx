
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config/api';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface Payment {
  id: number;
  session_id: number;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  payment_date: string;
  payment_method: string;
  therapist_name: string;
  therapist_image: string;
  session_type: string;
  session_date: string;
}

const PaymentPage: React.FC = () => {
    const navigate = useNavigate();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'pending'>('all');
    
    // Newsletter states
    const [newsletterName, setNewsletterName] = useState('');
    const [newsletterEmail, setNewsletterEmail] = useState('');
    const [newsletterOptIn, setNewsletterOptIn] = useState(false);
    const [newsletterLoading, setNewsletterLoading] = useState(false);
    const [newsletterMessage, setNewsletterMessage] = useState('');
    const [newsletterError, setNewsletterError] = useState('');

    // Mock data for demonstration
    const mockPayments: Payment[] = [
      {
        id: 1,
        session_id: 101,
        amount: 2000,
        status: 'completed',
        payment_date: '2026-01-28T10:00:00',
        payment_method: 'Razorpay',
        therapist_name: 'Dr. Zara Khan',
        therapist_image: 'https://picsum.photos/id/1009/400/400',
        session_type: 'Video Session',
        session_date: '2026-01-25T14:00:00'
      },
      {
        id: 2,
        session_id: 102,
        amount: 1500,
        status: 'completed',
        payment_date: '2026-01-20T15:30:00',
        payment_method: 'Razorpay',
        therapist_name: 'Dr. Omar Siddiq',
        therapist_image: 'https://picsum.photos/id/1005/400/400',
        session_type: 'Audio Session',
        session_date: '2026-01-18T11:00:00'
      },
      {
        id: 3,
        session_id: 103,
        amount: 2000,
        status: 'pending',
        payment_date: '2026-02-05T16:00:00',
        payment_method: 'Pending',
        therapist_name: 'Dr. Zara Khan',
        therapist_image: 'https://picsum.photos/id/1009/400/400',
        session_type: 'Video Session',
        session_date: '2026-02-10T10:00:00'
      },
      {
        id: 4,
        session_id: 104,
        amount: 1800,
        status: 'completed',
        payment_date: '2026-01-15T09:00:00',
        payment_method: 'Razorpay',
        therapist_name: 'Dr. Omar Siddiq',
        therapist_image: 'https://picsum.photos/id/1005/400/400',
        session_type: 'Video Session',
        session_date: '2026-01-12T15:00:00'
      }
    ];

    useEffect(() => {
      // In production, fetch from API
      // fetchPayments();
      setPayments(mockPayments);
      setLoading(false);
    }, []);

    const filteredPayments = payments.filter(payment => {
      if (activeTab === 'all') return true;
      if (activeTab === 'completed') return payment.status === 'completed';
      if (activeTab === 'pending') return payment.status === 'pending';
      return true;
    });

    const totalPaid = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPending = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'completed':
          return 'bg-[#D4C4B0] text-[#5C5043]';
        case 'pending':
          return 'bg-[#C5A059] text-[#5C5043]';
        case 'failed':
          return 'bg-[#C86B5A] text-white';
        default:
          return 'bg-[#8D7B68] text-white';
      }
    };

    const handleNewsletterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setNewsletterLoading(true);
      setNewsletterMessage('');
      setNewsletterError('');

      try {
        const response = await fetch(`${config.apiUrl}/newsletter/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newsletterName, email: newsletterEmail, optIn: newsletterOptIn })
        });

        if (!response.ok) throw new Error('Subscription failed');
        
        setNewsletterMessage('Thank you for subscribing! Check your email for updates.');
        setNewsletterName('');
        setNewsletterEmail('');
        setNewsletterOptIn(false);
      } catch (err) {
        setNewsletterError(err instanceof Error ? err.message : 'Subscription failed');
      } finally {
        setNewsletterLoading(false);
      }
    };

    if (loading) {
      return (
        <div className="min-h-screen bg-[#F3E9DC] flex items-center justify-center">
          <div className="text-[#5C5043] text-xl">Loading...</div>
        </div>
      );
    }

    return (
        <>
        <Header />
        <div className="min-h-screen bg-[#F3E9DC] relative">
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                }
                .float-animation {
                    animation: float 6s ease-in-out infinite;
                }
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .fade-in-up {
                    animation: fadeInUp 0.6s ease-out forwards;
                    opacity: 0;
                }
            `}</style>
            {/* Watermark */}
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                <img 
                    src="https://res.cloudinary.com/dyqspp2ud/image/upload/e_background_removal/v1762852351/grey_shura_logo_cdrwgs.png"
                    alt="Shura Logo Watermark"
                    className="opacity-5"
                    style={{width: '400px', height: '400px', objectFit: 'contain'}}
                />
            </div>
            
            <div className="relative max-w-6xl mx-auto px-6 py-12 z-10">
                {/* Header */}
                <div className="mb-8 fade-in-up" style={{animationDelay: '0.1s'}}>
                    <h1 className="text-2xl md:text-3xl font-bold text-[#5C5043] font-serif mb-2">Payment History</h1>
                    <p className="text-[#8D7B68]">View your past and pending payments</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow p-6 fade-in-up" style={{animationDelay: '0.2s'}}>
                        <div className="text-[#8D7B68] text-sm mb-1">Total Paid</div>
                        <div className="text-2xl font-bold text-[#5C5043]">₹{totalPaid.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-white rounded-xl shadow p-6 fade-in-up" style={{animationDelay: '0.3s'}}>
                        <div className="text-[#8D7B68] text-sm mb-1">Pending Payments</div>
                        <div className="text-2xl font-bold text-[#5C5043]">₹{totalPending.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-white rounded-xl shadow p-6 fade-in-up" style={{animationDelay: '0.4s'}}>
                        <div className="text-[#8D7B68] text-sm mb-1">Total Transactions</div>
                        <div className="text-2xl font-bold text-[#5C5043]">{payments.length}</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow mb-6 fade-in-up" style={{animationDelay: '0.5s'}}>
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-6 py-4 font-semibold transition-colors ${
                                activeTab === 'all'
                                    ? 'text-[#5C5043] border-b-2 border-[#b4845c]'
                                    : 'text-[#8D7B68] hover:text-[#5C5043]'
                            }`}
                        >
                            All Payments
                        </button>
                        <button
                            onClick={() => setActiveTab('completed')}
                            className={`px-6 py-4 font-semibold transition-colors ${
                                activeTab === 'completed'
                                    ? 'text-[#5C5043] border-b-2 border-[#b4845c]'
                                    : 'text-[#8D7B68] hover:text-[#5C5043]'
                            }`}
                        >
                            Completed
                        </button>
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`px-6 py-4 font-semibold transition-colors ${
                                activeTab === 'pending'
                                    ? 'text-[#5C5043] border-b-2 border-[#b4845c]'
                                    : 'text-[#8D7B68] hover:text-[#5C5043]'
                            }`}
                        >
                            Pending
                        </button>
                    </div>

                    {/* Payment List */}
                    <div className="space-y-4 p-6">
                        {filteredPayments.length === 0 ? (
                            <div className="text-center text-[#8D7B68]">
                                No payments found
                            </div>
                        ) : (
                            filteredPayments.map((payment, index) => (
                                <div key={payment.id} className="p-6 bg-[#F3E9DC] rounded-lg shadow hover:shadow-md transition-shadow fade-in-up" style={{animationDelay: `${0.6 + index * 0.1}s`}}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-4 mb-2">
                                                <img 
                                                    src={payment.therapist_image} 
                                                    alt={payment.therapist_name}
                                                    className="w-12 h-12 rounded-full object-cover"
                                                />
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-semibold text-[#5C5043]">
                                                        {payment.therapist_name}
                                                    </h3>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                                                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-sm text-[#8D7B68] space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span>Session Type:</span>
                                                    <span className="font-medium">{payment.session_type}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span>Session Date:</span>
                                                    <span className="font-medium">{formatDate(payment.session_date)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span>Payment Date:</span>
                                                    <span className="font-medium">{formatDate(payment.payment_date)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span>Payment Method:</span>
                                                    <span className="font-medium">{payment.payment_method}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-[#5C5043]">
                                                ₹{payment.amount.toLocaleString('en-IN')}
                                            </div>
                                            {payment.status === 'pending' && (
                                                <button className="mt-2 px-4 py-2 bg-[#b4845c] text-white rounded-lg text-sm font-semibold hover:bg-[#8D7B68] transition-colors">
                                                    Pay Now
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Newsletter Section */}
        <div className="bg-[#F5F1ED]">
            <div className="container mx-auto px-6 py-16 md:py-20">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#5C5043] mb-4">
                        Let's stay in touch
                    </h2>
                    <p className="text-[#8D7B68] mb-8">Get the latest updates and more.</p>

                    {newsletterMessage && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-green-600 text-sm">{newsletterMessage}</p>
                        </div>
                    )}

                    {newsletterError && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-600 text-sm">{newsletterError}</p>
                        </div>
                    )}

                    <form onSubmit={handleNewsletterSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={newsletterName}
                                onChange={(e) => setNewsletterName(e.target.value)}
                                className="w-full bg-white rounded-full py-3 px-5 border-2 border-[#D4C4B0] focus:ring-2 focus:ring-[#8D7B68]/50 focus:border-[#8D7B68]/50 transition text-[#5C5043] placeholder:text-[#8D7B68]"
                                required
                                disabled={newsletterLoading}
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={newsletterEmail}
                                onChange={(e) => setNewsletterEmail(e.target.value)}
                                className="w-full bg-white rounded-full py-3 px-5 border-2 border-[#D4C4B0] focus:ring-2 focus:ring-[#8D7B68]/50 focus:border-[#8D7B68]/50 transition text-[#5C5043] placeholder:text-[#8D7B68]"
                                required
                                disabled={newsletterLoading}
                            />
                        </div>
                        <div className="flex items-center justify-center pt-2">
                            <input
                                id="newsletter-opt-in"
                                name="newsletter-opt-in"
                                type="checkbox"
                                checked={newsletterOptIn}
                                onChange={(e) => setNewsletterOptIn(e.target.checked)}
                                className="h-4 w-4 bg-white border-2 border-[#8D7B68] rounded text-[#5C5043] focus:ring-[#8D7B68]"
                                disabled={newsletterLoading}
                            />
                            <label htmlFor="newsletter-opt-in" className="ml-3 text-sm text-[#8D7B68]">
                                Opt in to receive news and updates
                            </label>
                        </div>
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={newsletterLoading}
                                className="bg-[#8D7B68] text-white font-semibold py-3 px-10 rounded-full hover:bg-[#5C5043] transition-colors duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {newsletterLoading ? 'Subscribing...' : 'Subscribe Now'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <Footer />
        </>
    );
};

export default PaymentPage;
