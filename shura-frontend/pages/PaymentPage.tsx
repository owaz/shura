
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import type { Therapist } from '../types';
import { Logo } from '../components/Logo';
import { ChevronLeftIcon } from '../components/Icons';
import { apiFetch } from '../config/api';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
const RAZORPAY_CHECKOUT_SCRIPT_ID = 'razorpay-checkout-script';
let razorpayScriptPromise: Promise<void> | null = null;

const loadRazorpayCheckoutScript = async (): Promise<void> => {
    if (window.Razorpay) {
        return;
    }

    if (razorpayScriptPromise) {
        return razorpayScriptPromise;
    }

    razorpayScriptPromise = new Promise<void>((resolve, reject) => {
        const existingScript = document.getElementById(RAZORPAY_CHECKOUT_SCRIPT_ID) as HTMLScriptElement | null;

        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => {
                razorpayScriptPromise = null;
                reject(new Error('Unable to load Razorpay checkout. Please try again.'));
            }, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = RAZORPAY_CHECKOUT_SCRIPT_ID;
        script.src = RAZORPAY_CHECKOUT_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            razorpayScriptPromise = null;
            reject(new Error('Unable to load Razorpay checkout. Please try again.'));
        };
        document.body.appendChild(script);
    });

    return razorpayScriptPromise;
};

const PaymentPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    
    const { therapist, sessionType, price, bookingSelection } = (location.state as {
      therapist: Therapist,
      sessionType: string,
      price: number,
      bookingSelection?: {
        therapist_id: number;
        date: string;
        time: string;
        session_type: 'video' | 'audio' | 'text' | 'intro';
        amount_cents: number;
      };
    }) || {};

    useEffect(() => {
        if (!therapist || !sessionType || !price || !bookingSelection) {
            navigate('/therapists');
        }
    }, [therapist, sessionType, price, bookingSelection, navigate]);
    
    const handlePayment = async () => {
        if (!bookingSelection) return;
        setIsProcessing(true);
        setPaymentError('');
        try {
            await loadRazorpayCheckoutScript();
            if (!window.Razorpay) {
                throw new Error('Razorpay checkout is unavailable right now. Please try again.');
            }

            const createOrderResponse = await apiFetch('/payments/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingSelection),
            });
            const createOrderData = await createOrderResponse.json();
            if (!createOrderResponse.ok) {
                throw new Error(createOrderData.error || 'Unable to start payment');
            }

            const options = {
                key: createOrderData.key_id || 'rzp_test_1DP5mmOlF5G5ag',
                amount: createOrderData.amount || (price * 100),
                currency: createOrderData.currency || 'INR',
                name: 'Shura',
                description: `Payment for ${sessionType}`,
                order_id: createOrderData.order_id,
                image: '/logo.png',
                handler: async (response: any) => {
                    try {
                        const verifyResponse = await apiFetch('/payments/verify-and-finalize-booking', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_signature: response.razorpay_signature,
                            }),
                        });
                        const verifyData = await verifyResponse.json();
                        if (!verifyResponse.ok) {
                            throw new Error(verifyData.error || 'Payment verification failed');
                        }
                        navigate(`/chat/${therapist.id}`);
                    } catch (error) {
                        setPaymentError(error instanceof Error ? error.message : 'Payment verification failed');
                    } finally {
                        setIsProcessing(false);
                    }
                },
                prefill: {
                    name: 'Shura Client',
                },
                notes: {
                    therapist_id: bookingSelection.therapist_id,
                    date: bookingSelection.date,
                    time: bookingSelection.time,
                },
                theme: {
                    color: '#6B8A9A'
                }
            };
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', (resp: any) => {
                setPaymentError(resp?.error?.description || 'Payment failed. Please try again.');
                setIsProcessing(false);
            });
            rzp.open();
        } catch (error) {
            setPaymentError(error instanceof Error ? error.message : 'Unable to start payment');
            setIsProcessing(false);
        }
    };

    if (!therapist || !sessionType || !price || !bookingSelection) {
        return null;
    }

    return (
        <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-6 relative">
            <div className="absolute top-6 left-6">
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-brown-soft hover:text-brown-dark transition-colors font-semibold group"
                    aria-label="Go back to previous page"
                >
                    <ChevronLeftIcon className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                    <span>Back</span>
                </button>
            </div>
            
            <div className="max-w-5xl w-full grid lg:grid-cols-5 gap-12 items-center">
                
                {/* Order Summary */}
                <div className="lg:col-span-2 bg-ivory p-8 rounded-2xl shadow-lg animate-fade-in">
                    <h2 className="text-3xl font-serif font-bold text-brown-dark mb-8">Order Summary</h2>
                    <div className="flex items-center gap-4 mb-6">
                        <img src={therapist.imageUrl} alt={therapist.name} className="w-20 h-20 rounded-full object-cover border-4 border-sand shadow-md"/>
                        <div>
                            <p className="text-sm text-taupe">You are booking with</p>
                            <h3 className="text-2xl font-serif font-semibold text-brown-dark">{therapist.name}</h3>
                            <p className="text-sm text-brown-soft">{therapist.title}</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4 text-lg">
                        <div className="flex justify-between items-center text-brown-soft border-b border-sand pb-4">
                            <span>Service:</span>
                            <span className="font-semibold text-brown-dark">{sessionType}</span>
                        </div>
                        <div className="flex justify-between items-center text-xl pt-4">
                            <span className="font-bold text-brown-dark">Total Amount:</span>
                            <span className="font-bold text-brown-soft font-serif text-2xl">₹{price.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Section */}
                <div className="lg:col-span-3 bg-white p-8 rounded-2xl shadow-xl animate-fade-in" style={{ animationDelay: '150ms' }}>
                    <div className="text-center mb-8">
                        <Link to="/" className="inline-flex items-center justify-center gap-2 mb-2 group">
                            <Logo className="h-8 w-8 text-brown-dark" />
                            <h3 className="font-serif text-3xl font-bold text-brown-dark group-hover:text-brown-soft transition-colors">Shura</h3>
                        </Link>
                        <h1 className="text-2xl font-serif font-bold text-brown-dark mt-2">Secure Payment</h1>
                        <p className="text-brown-soft text-sm">Complete your booking with Razorpay - safe and secure online payment.</p>
                    </div>

                    <div className="text-center">
                        <button 
                            onClick={handlePayment}
                            disabled={isProcessing}
                            className="bg-brown-soft text-white py-4 px-8 rounded-lg font-semibold hover:bg-opacity-90 transition-all duration-300 transform hover:scale-105 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? 'Processing...' : `Pay ₹${price.toLocaleString('en-IN')} with Razorpay`}
                        </button>
                    </div>
                    {paymentError && (
                        <p className="text-sm text-red-600 text-center mt-4">{paymentError}</p>
                    )}
                    <p className="text-xs text-taupe text-center mt-6">All transactions are processed securely through Razorpay.</p>
                </div>

            </div>
        </div>
    );
};

export default PaymentPage;
