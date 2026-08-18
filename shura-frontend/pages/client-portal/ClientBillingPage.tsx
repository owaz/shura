import React, { useCallback, useEffect, useState } from 'react';
import { clientPortalApi } from './clientPortalApi';
import type { ClientBillingStatus, ClientBillingSummary, ClientBillingTransaction, Pagination } from './clientPortalTypes';
import { ErrorState, PageSkeleton, PortalCard, Toast } from './PortalUi';

const receiptButton = 'rounded-full border border-[#BCA998] bg-white px-3.5 py-2 text-sm font-semibold text-[#8C4F3A] transition hover:bg-[#FBF2EC] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';
const pageButton = 'rounded-full border border-[#BCA998] bg-white px-4 py-2 text-sm font-semibold text-brown-dark transition hover:bg-[#F8F1EA] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';

const statusDetails: Record<ClientBillingStatus, { label: string; classes: string }> = {
  paid: { label: 'Paid', classes: 'bg-[#E8F0E4] text-[#466044]' },
  pending: { label: 'Pending', classes: 'bg-[#FFF2D8] text-[#805C1A]' },
  failed: { label: 'Failed', classes: 'bg-[#FFF0ED] text-[#8D352D]' },
  refunded: { label: 'Refunded', classes: 'bg-[#E9EEF5] text-[#425B75]' },
  refund_required: { label: 'Refund required', classes: 'bg-[#FFF0ED] text-[#8D352D]' },
  refund_pending: { label: 'Refund pending', classes: 'bg-[#FFF2D8] text-[#805C1A]' },
  refund_failed: { label: 'Refund failed', classes: 'bg-[#FFF0ED] text-[#8D352D]' },
};

const formatMoney = (amountMinor: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(amountMinor / 100);
  } catch {
    return `${currency || 'INR'} ${(amountMinor / 100).toFixed(2)}`;
  }
};

const formatDate = (value: string, timezone: string, withTime = false) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone,
  day: 'numeric', month: 'short', year: 'numeric',
  ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
}).format(new Date(value));

const StatusBadge: React.FC<{ status: ClientBillingStatus }> = ({ status }) => {
  const detail = statusDetails[status] || statusDetails.pending;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${detail.classes}`}>{detail.label}</span>;
};

const BillingModeCard: React.FC<{ summary: ClientBillingSummary }> = ({ summary }) => {
  if (summary.mode === 'covered') {
    return <PortalCard className="border-[#BFCDB8] bg-[#F3F7F0]"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#526A4C]">Your coverage</p><h2 className="mt-2 font-serif text-2xl font-semibold text-brown-dark">Your sessions are covered</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-brown-soft">You will not be asked to pay at checkout while coverage is active. Your earlier payment history and receipts remain available below.</p></PortalCard>;
  }
  if (summary.mode === 'free') {
    return <PortalCard className="border-[#BFCDB8] bg-[#F3F7F0]"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#526A4C]">Payment status</p><h2 className="mt-2 font-serif text-2xl font-semibold text-brown-dark">No payment is required</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-brown-soft">Portal payment is currently disabled, so eligible sessions are confirmed without a Razorpay charge.</p></PortalCard>;
  }
  return <PortalCard><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#F4E8DD] text-2xl text-[#8C4F3A]" aria-hidden="true">▣</div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8C624E]">Payment method</p><h2 className="mt-1 font-serif text-2xl font-semibold text-brown-dark">Secure payment at booking</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-brown-soft">Shura uses one-time Razorpay checkout and does not store card details. Saved payment methods and automatic future charges are not enabled.</p></div></div></PortalCard>;
};

const TransactionActions: React.FC<{
  transaction: ClientBillingTransaction;
  downloading: string;
  onDownload: (transaction: ClientBillingTransaction) => void;
}> = ({ transaction, downloading, onDownload }) => transaction.receiptAvailable
  ? <button type="button" onClick={() => onDownload(transaction)} disabled={downloading === transaction.id} className={receiptButton}>{downloading === transaction.id ? 'Preparing…' : 'Download PDF'}</button>
  : <span className="text-xs text-brown-soft">Receipt unavailable</span>;

const ClientBillingPage: React.FC = () => {
  const [summary, setSummary] = useState<ClientBillingSummary | null>(null);
  const [transactions, setTransactions] = useState<ClientBillingTransaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [toast, setToast] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryResult, transactionResult] = await Promise.all([
        clientPortalApi.getBillingSummary(),
        clientPortalApi.getBillingTransactions(1, 20),
      ]);
      setSummary(summaryResult);
      setTransactions(transactionResult.data);
      setPagination(transactionResult.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Your billing information could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const changePage = async (page: number) => {
    if (page < 1 || page > pagination.totalPages || page === pagination.page) return;
    setPageLoading(true);
    try {
      const result = await clientPortalApi.getBillingTransactions(page, pagination.limit);
      setTransactions(result.data);
      setPagination(result.pagination);
      document.getElementById('payment-history-heading')?.focus();
    } catch (pageError) {
      setToast({ kind: 'error', message: pageError instanceof Error ? pageError.message : 'That page could not be loaded.' });
    } finally {
      setPageLoading(false);
    }
  };

  const downloadReceipt = async (transaction: ClientBillingTransaction) => {
    setDownloading(transaction.id);
    try {
      const { blob, filename } = await clientPortalApi.downloadBillingReceipt(transaction.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setToast({ kind: 'success', message: 'Your receipt has been downloaded.' });
    } catch (downloadError) {
      setToast({ kind: 'error', message: downloadError instanceof Error ? downloadError.message : 'Your receipt could not be downloaded.' });
    } finally {
      setDownloading('');
    }
  };

  if (loading) return <PageSkeleton />;
  if (error || !summary) return <ErrorState message={error || 'Your billing information could not be loaded.'} onRetry={() => void load()} />;
  if (!summary.billingEnabled) {
    return <PortalCard className="mx-auto max-w-2xl py-12 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#F2E6DA] text-2xl text-[#8C4F3A]" aria-hidden="true">▣</div><h2 className="mt-5 font-serif text-2xl font-semibold text-brown-dark">Billing is not available</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-brown-soft">The billing area is currently disabled by Shura. No payment-method controls or future charges are active here.</p></PortalCard>;
  }

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C624E]">Your payments</p><h2 className="mt-2 font-serif text-3xl font-semibold text-brown-dark">Billing and receipts</h2><p className="mt-2 max-w-3xl text-[15px] leading-6 text-brown-soft">Review session payment status, refund progress, and client-owned PDF receipts.</p></div>

      <BillingModeCard summary={summary} />

      <PortalCard>
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8C624E]">What to expect</p><h2 className="mt-2 font-serif text-2xl font-semibold text-brown-dark">Upcoming sessions and payment status</h2><p className="mt-2 text-sm leading-6 text-brown-soft">Paid sessions are charged once during booking. Shura does not schedule automatic future charges.</p></div>
        {summary.upcomingCharges.length === 0 ? <div className="mt-5 rounded-xl bg-[#F8F3EE] p-5"><p className="font-semibold text-brown-dark">No upcoming session charges</p><p className="mt-1 text-sm text-brown-soft">Your confirmed upcoming sessions will appear here with their payment or coverage status.</p></div> : <div className="mt-5 grid gap-3 lg:grid-cols-2">{summary.upcomingCharges.map((charge) => <article key={charge.bookingId} className="rounded-xl border border-sand bg-[#FFFCF8] p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold text-brown-dark">{charge.therapist}</p><p className="mt-1 text-sm text-brown-soft">{formatDate(charge.sessionDate, summary.timezone, true)}</p></div><strong className="whitespace-nowrap text-brown-dark">{charge.kind === 'paid' ? formatMoney(charge.amountMinor, charge.currency) : charge.kind === 'covered' ? 'Covered' : 'Free'}</strong></div><p className="mt-3 border-t border-sand pt-3 text-xs leading-5 text-brown-soft">{charge.explanation}{charge.chargeDate ? ` Charged ${formatDate(charge.chargeDate, summary.timezone)}.` : ''}</p></article>)}</div>}
      </PortalCard>

      <PortalCard>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8C624E]">Transactions</p><h2 id="payment-history-heading" tabIndex={-1} className="mt-2 font-serif text-2xl font-semibold text-brown-dark outline-none">Payment history</h2></div><p className="text-sm text-brown-soft">{pagination.total} {pagination.total === 1 ? 'transaction' : 'transactions'}</p></div>
        {transactions.length === 0 ? <div className="mt-6 rounded-xl bg-[#F8F3EE] p-6 text-center"><p className="font-semibold text-brown-dark">No payment history yet</p><p className="mt-2 text-sm text-brown-soft">Paid, failed, pending, and refunded transactions will appear here.</p></div> : <div className={`mt-6 ${pageLoading ? 'opacity-55' : ''}`} aria-busy={pageLoading}>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><caption className="sr-only">Your payment and refund history</caption><thead><tr className="border-b border-sand text-xs uppercase tracking-wider text-brown-soft"><th scope="col" className="px-3 py-3">Date</th><th scope="col" className="px-3 py-3">Description</th><th scope="col" className="px-3 py-3">Amount</th><th scope="col" className="px-3 py-3">Status</th><th scope="col" className="px-3 py-3 text-right">Receipt</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id} className="border-b border-[#EFE5DB] last:border-0"><td className="px-3 py-4 align-top text-brown-soft">{formatDate(transaction.date, summary.timezone)}</td><td className="px-3 py-4 align-top"><p className="font-semibold text-brown-dark">{transaction.description}</p><p className="mt-1 font-mono text-xs text-brown-soft">{transaction.reference}</p></td><td className="px-3 py-4 align-top font-semibold text-brown-dark">{formatMoney(transaction.amountMinor, transaction.currency)}{transaction.refundAmountMinor > 0 && <span className="mt-1 block text-xs font-normal text-brown-soft">Refund: {formatMoney(transaction.refundAmountMinor, transaction.currency)}</span>}</td><td className="px-3 py-4 align-top"><StatusBadge status={transaction.status} /></td><td className="px-3 py-4 text-right align-top"><TransactionActions transaction={transaction} downloading={downloading} onDownload={(item) => void downloadReceipt(item)} /></td></tr>)}</tbody></table></div>
          <div className="grid gap-3 md:hidden">{transactions.map((transaction) => <article key={transaction.id} className="rounded-xl border border-sand bg-[#FFFCF8] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-brown-dark">{transaction.description}</p><p className="mt-1 text-sm text-brown-soft">{formatDate(transaction.date, summary.timezone)}</p></div><StatusBadge status={transaction.status} /></div><div className="mt-4 flex items-end justify-between gap-4 border-t border-sand pt-4"><div><p className="text-lg font-semibold text-brown-dark">{formatMoney(transaction.amountMinor, transaction.currency)}</p>{transaction.refundAmountMinor > 0 && <p className="mt-1 text-xs text-brown-soft">Refund: {formatMoney(transaction.refundAmountMinor, transaction.currency)}</p>}<p className="mt-1 font-mono text-[11px] text-brown-soft">{transaction.reference}</p></div><TransactionActions transaction={transaction} downloading={downloading} onDownload={(item) => void downloadReceipt(item)} /></div></article>)}</div>
        </div>}
        {pagination.totalPages > 1 && <nav aria-label="Payment history pages" className="mt-6 flex items-center justify-between gap-3 border-t border-sand pt-5"><button type="button" onClick={() => void changePage(pagination.page - 1)} disabled={pagination.page <= 1 || pageLoading} className={pageButton}>Previous</button><span className="text-sm text-brown-soft">Page {pagination.page} of {pagination.totalPages}</span><button type="button" onClick={() => void changePage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages || pageLoading} className={pageButton}>Next</button></nav>}
      </PortalCard>

      <details className="rounded-2xl border border-[#E5D8CB] bg-white shadow-[0_8px_30px_rgba(92,80,67,0.06)]"><summary className="cursor-pointer list-none px-5 py-5 font-semibold text-brown-dark focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#8C4F3A] md:px-7">Refund and cancellation policy <span className="float-right text-brown-soft" aria-hidden="true">⌄</span></summary><div className="border-t border-sand px-5 py-5 text-sm leading-6 text-brown-soft md:px-7"><p>{summary.refundPolicy.text}</p><p className="mt-3">Refunds are recorded separately from cancellation and may remain pending or require support if Razorpay reports a failure.</p></div></details>

      {toast && <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ClientBillingPage;
