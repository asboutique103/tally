import { Download, Plus, Trash2, WalletCards } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { billBalance, currency, downloadCsv, nextDocumentNo, today, uid } from '../lib/helpers';
import { cleanText, hasDuplicate, isFilled, isPositive } from '../lib/validation';
import { useApp } from '../store/AppContext';
import type { Payment } from '../types';

export function Payments() {
  const { data, addPayment, deletePayment } = useApp();
  const openBills = data.bills.filter((bill) => billBalance(data, bill) > 0);
  const firstBill = openBills[0];
  const empty = (): Payment => ({
    id: uid('pay'),
    paymentNo: nextDocumentNo('PAY', data.payments.map((payment) => payment.paymentNo)),
    date: today(),
    billId: firstBill?.id ?? '',
    partyName: firstBill?.partyName ?? '',
    direction: firstBill?.type === 'Client' ? 'Received' : 'Paid',
    amount: firstBill ? billBalance(data, firstBill) : 0,
    mode: 'Bank Transfer',
    reference: '',
    notes: '',
    createdAt: new Date().toISOString(),
  });

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Payment>(empty());
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => data.payments.filter((payment) => `${payment.paymentNo} ${payment.partyName} ${payment.reference} ${payment.mode}`.toLowerCase().includes(query.toLowerCase())),
    [data.payments, query],
  );

  const openCreate = () => {
    setDraft(empty());
    setError('');
    setOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const bill = data.bills.find((item) => item.id === draft.billId);
    if (!bill) {
      setError('Select an open bill before saving the payment.');
      return;
    }

    const balance = billBalance(data, bill);
    const next: Payment = {
      ...draft,
      paymentNo: cleanText(draft.paymentNo).toUpperCase(),
      partyName: cleanText(draft.partyName),
      direction: bill.type === 'Client' ? 'Received' : 'Paid',
      reference: cleanText(draft.reference).toUpperCase(),
      notes: cleanText(draft.notes),
      amount: draft.amount || 0,
    };

    if (!isFilled(next.paymentNo) || !isFilled(next.date) || !isFilled(next.billId) || !isFilled(next.partyName)) {
      setError('Payment number, date, open bill and party name are mandatory.');
      return;
    }
    if (!isPositive(next.amount) || next.amount > balance) {
      setError(`Payment must be more than zero and cannot exceed ${currency(balance)}.`);
      return;
    }
    if (next.mode !== 'Cash' && !isFilled(next.reference)) {
      setError('Reference is mandatory for bank transfer, cheque, UPI and card payments.');
      return;
    }
    if (hasDuplicate(data.payments, next.id, (payment) => payment.paymentNo.toUpperCase() === next.paymentNo)) {
      setError('Another payment already uses this payment number.');
      return;
    }

    addPayment(next);
    setOpen(false);
    setError('');
  };

  const selectBill = (id: string) => {
    const bill = data.bills.find((item) => item.id === id);
    setDraft({
      ...draft,
      billId: id,
      partyName: bill?.partyName ?? '',
      direction: bill?.type === 'Client' ? 'Received' : 'Paid',
      amount: bill ? billBalance(data, bill) : 0,
    });
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cash flow"
        title="Payments"
        description="Record supplier payments and client receipts against bills with bank, UPI, cheque, card or cash references."
        actions={(
          <>
            <button className="button secondary" onClick={() => downloadCsv('payments.csv', filtered.map((payment) => ({
              Payment: payment.paymentNo,
              Date: payment.date,
              Party: payment.partyName,
              Direction: payment.direction,
              Amount: payment.amount,
              Mode: payment.mode,
              Reference: payment.reference,
            })))}><Download size={17} /> Export</button>
            <button className="button primary" disabled={!openBills.length} onClick={openCreate}><Plus size={17} /> Record payment</button>
          </>
        )}
      />

      <section className="stats-grid mini-stats">
        <article className="stat-card"><div className="stat-icon"><WalletCards size={21} /></div><div className="stat-copy"><span>Total paid</span><strong>{currency(data.payments.filter((payment) => payment.direction === 'Paid').reduce((sum, payment) => sum + payment.amount, 0))}</strong><small>Supplier outflow</small></div></article>
        <article className="stat-card"><div className="stat-icon"><WalletCards size={21} /></div><div className="stat-copy"><span>Total received</span><strong>{currency(data.payments.filter((payment) => payment.direction === 'Received').reduce((sum, payment) => sum + payment.amount, 0))}</strong><small>Client collections</small></div></article>
        <article className="stat-card"><div className="stat-icon"><WalletCards size={21} /></div><div className="stat-copy"><span>Open bills</span><strong>{openBills.length}</strong><small>Awaiting settlement</small></div></article>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search payment, party, mode or reference..." />
          <div className="toolbar-summary"><strong>{filtered.length}</strong><span>payments</span></div>
        </div>
        {filtered.length === 0 ? <EmptyState title="No payments found" description="Record a payment once a purchase bill or client invoice is open." action={<button className="button primary" disabled={!openBills.length} onClick={openCreate}><Plus size={17} /> Record payment</button>} /> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Payment</th><th>Date</th><th>Party</th><th>Against bill</th><th>Direction</th><th>Mode</th><th>Reference</th><th>Amount</th><th /></tr></thead>
              <tbody>{filtered.map((payment) => (
                <tr key={payment.id}>
                  <td><strong>{payment.paymentNo}</strong><span>{payment.notes || 'Payment entry'}</span></td>
                  <td>{new Date(payment.date).toLocaleDateString('en-IN')}</td>
                  <td><strong>{payment.partyName}</strong></td>
                  <td>{data.bills.find((bill) => bill.id === payment.billId)?.billNo || '-'}</td>
                  <td><span className={`status-pill ${payment.direction === 'Received' ? 'success' : 'warning'}`}>{payment.direction}</span></td>
                  <td>{payment.mode}</td>
                  <td>{payment.reference || '-'}</td>
                  <td><strong className={payment.direction === 'Received' ? 'positive-text' : ''}>{currency(payment.amount)}</strong></td>
                  <td><button className="icon-button danger" onClick={() => confirm(`Delete ${payment.paymentNo}? Bill status will be recalculated.`) && deletePayment(payment.id)} aria-label={`Delete ${payment.paymentNo}`}><Trash2 size={16} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={open} title="Record payment" subtitle="Payments are allocated to a specific open bill." onClose={() => setOpen(false)}>
        <form className="form-stack" onSubmit={submit}>
          {error && <div className="alert danger-alert">{error}</div>}
          <div className="form-grid two">
            <label><span>Payment number *</span><input required value={draft.paymentNo} onChange={(event) => setDraft({ ...draft, paymentNo: event.target.value.toUpperCase() })} /></label>
            <label><span>Date *</span><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
            <label className="span-2"><span>Open bill *</span><select required value={draft.billId} onChange={(event) => selectBill(event.target.value)}><option value="">Select bill</option>{openBills.map((bill) => <option key={bill.id} value={bill.id}>{bill.billNo} / {bill.partyName} / Balance {currency(billBalance(data, bill))}</option>)}</select></label>
            <label><span>Direction *</span><select required disabled value={draft.direction}><option>Paid</option><option>Received</option></select></label>
            <label><span>Amount *</span><input required type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })} /></label>
            <label><span>Mode *</span><select required value={draft.mode} onChange={(event) => setDraft({ ...draft, mode: event.target.value as Payment['mode'] })}><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>UPI</option><option>Card</option></select></label>
            <label><span>Reference {draft.mode !== 'Cash' ? '*' : ''}</span><input required={draft.mode !== 'Cash'} value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} placeholder="UTR / cheque / transaction ID" /></label>
            <label className="span-2"><span>Notes</span><textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
          </div>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="button primary">Save payment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
