
import React, { useState, useMemo } from 'react';
import type { Payment, Client } from '../../types';
import { ChevronDownIcon } from '../../components/Icons';

// Mock Data
const mockClients: Client[] = [
  { id: 1, name: 'Aisha P.', avatarUrl: 'https://i.pravatar.cc/150?u=aisha' },
  { id: 2, name: 'Omar F.', avatarUrl: 'https://i.pravatar.cc/150?u=omar' },
  { id: 3, name: 'Fatima K.', avatarUrl: 'https://i.pravatar.cc/150?u=fatima' },
  { id: 4, name: 'Yusuf K.', avatarUrl: 'https://i.pravatar.cc/150?u=yusuf' },
  { id: 5, name: 'Samira B.', avatarUrl: 'https://i.pravatar.cc/150?u=samira' },
];

const mockPayments: Payment[] = [
  { id: 'txn_1', client: mockClients[0], date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), amount: 2000, status: 'Paid' },
  { id: 'txn_2', client: mockClients[1], date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), amount: 1200, status: 'Paid' },
  { id: 'txn_3', client: mockClients[2], date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), amount: 2000, status: 'Paid' },
  { id: 'txn_4', client: mockClients[3], date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), amount: 800, status: 'Paid' },
  { id: 'txn_5', client: mockClients[4], date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), amount: 1200, status: 'Pending' },
  { id: 'txn_6', client: mockClients[0], date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), amount: 2000, status: 'Paid' },
  { id: 'txn_7', client: mockClients[2], date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), amount: 3000, status: 'Failed' },
  { id: 'txn_8', client: mockClients[1], date: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(), amount: 1200, status: 'Paid' },
];

type SortKey = 'client' | 'date' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

const StatCard: React.FC<{ title: string; value: string; description: string }> = ({ title, value, description }) => (
    <div className="bg-ivory p-6 rounded-xl shadow-sm">
        <h3 className="text-sm font-semibold text-taupe">{title}</h3>
        <p className="text-3xl font-bold text-brown-dark mt-1">{value}</p>
        <p className="text-xs text-brown-soft mt-1">{description}</p>
    </div>
);

const TherapistPaymentsPage: React.FC = () => {
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };
    
    const sortedPayments = useMemo(() => {
        return [...mockPayments].sort((a, b) => {
            let valA, valB;
            switch(sortKey) {
                case 'client':
                    valA = a.client.name;
                    valB = b.client.name;
                    break;
                case 'date':
                    valA = new Date(a.date).getTime();
                    valB = new Date(b.date).getTime();
                    break;
                case 'amount':
                    valA = a.amount;
                    valB = b.amount;
                    break;
                case 'status':
                    valA = a.status;
                    valB = b.status;
                    break;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [sortKey, sortDirection]);

    const statusColors: Record<Payment['status'], string> = {
        Paid: 'bg-green-100 text-green-800',
        Pending: 'bg-yellow-100 text-yellow-800',
        Failed: 'bg-red-100 text-red-800',
    };
    
    const totalEarnings = mockPayments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
    const monthlyEarnings = mockPayments.filter(p => p.status === 'Paid' && new Date(p.date).getMonth() === new Date().getMonth()).reduce((sum, p) => sum + p.amount, 0);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif font-bold text-brown-dark">Payments</h1>
                <p className="text-brown-soft mt-1">Review your earnings and transaction history.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="This Month's Earnings" value={`₹${monthlyEarnings.toLocaleString('en-IN')}`} description="from completed sessions" />
                <StatCard title="Total Earnings" value={`₹${totalEarnings.toLocaleString('en-IN')}`} description="all-time" />
                <StatCard title="Pending Payments" value={mockPayments.filter(p => p.status === 'Pending').length.toString()} description="awaiting confirmation" />
            </div>

            {/* Payments Table */}
            <div className="bg-ivory rounded-xl shadow-sm overflow-hidden">
                <div className="p-6">
                    <h2 className="text-xl font-serif font-semibold text-brown-dark">Transaction History</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-sand text-brown-dark text-sm">
                            <tr>
                                <th className="p-4 font-semibold">Transaction ID</th>
                                {(['client', 'date', 'amount', 'status'] as SortKey[]).map(key => (
                                     <th key={key} className="p-4 font-semibold cursor-pointer" onClick={() => handleSort(key)}>
                                        <div className="flex items-center gap-1">
                                            <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                                            {sortKey === key && <ChevronDownIcon className={`h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />}
                                        </div>
                                     </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPayments.map(payment => (
                                <tr key={payment.id} className="border-t border-sand hover:bg-sand/50">
                                    <td className="p-4 text-sm text-taupe font-mono">{payment.id}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <img src={payment.client.avatarUrl} alt={payment.client.name} className="w-8 h-8 rounded-full object-cover" />
                                            <span className="font-medium text-brown-dark">{payment.client.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-brown-soft">{new Date(payment.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                    <td className="p-4 font-semibold text-brown-dark">₹{payment.amount.toLocaleString('en-IN')}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusColors[payment.status]}`}>{payment.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TherapistPaymentsPage;
