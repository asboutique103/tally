import { Download, Plus, Trash2, WalletCards } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import {
  billBalance, currency, downloadCsv, nextDocumentNo, paidForEmployee, receiptBalance,
  receiptTotal, supplyBalance, supplyTotal, today, uid,
} from '../lib/helpers';
import { cleanText, hasDuplicate, isFilled, isPositive } from '../lib/validation';
import { useApp } from '../store/AppContext';
import type { Payment, PaymentCategory } from '../types';

const categoryLabel: Record<PaymentCategory, string> = {
  Bill: 'Bill / invoice',
  Supply: 'Material supplied to site',
  Receipt: 'Material received from supplier',
  Employee: 'Employee wage / salary',
};

export function Payments() {
  const { data, addPayment, deletePayment } = useApp();

  type OpenTarget = { id: string; label: string; sub: string; balance: number; direction: 'Paid' | 'Received'; partyName: string };

  const targetsFor = (category: PaymentCategory): OpenTarget[] => {
    if (category === 'Bill') {
      return data.bills.filter((bill) => billBalance(data, bill) > 0).map((bill) => ({
        id: bill.id, label: `${bill.billNo} — ${bill.partyName}`, sub: bill.type, balance: billBalance(data, bill), direction: bill.type === 'Client' ? 'Received' : 'Paid', partyName: bill.partyName,
      }));
    }
    if (category === 'Supply') {
      return data.supplies.filter((supply) => supplyBalance(data, supply) > 0).map((supply) => {
        const site = data.sites.find((candidate) => candidate.id === supply.siteId);
        return { id: supply.id, label: `${supply.issueNo} — ${site?.name ?? 'Site'}`, sub: 'Site material issue', balance: supplyBalance(data, supply), direction: 'Received', partyName: site?.clientName || site?.name || 'Site' };
      });
    }
    if (category === 'Receipt') {
      return data.receipts.filter((receipt) => receiptBalance(data, receipt) > 0).map((receipt) => {
        const supplier = data.suppliers.find((candidate) => candidate.id === receipt.supplierId);
        return { id: receipt.id, label: `${receipt.receiptNo} — ${supplier?.name ?? 'Supplier'}`, sub: 'Goods receipt', balance: receiptBalance(data, receipt), direction: 'Paid', partyName: supplier?.name ?? 'Supplier' };
      });
    }
    return data.employees.filter((employee) => employee.status === 'Active').map((employee) => ({
      id: employee.id, label: `${employee.name} (${employee.code})`, sub: `${employee.branch} · ${employee.payCycle}`, balance: Number.POSITIVE_INFINITY, direction: 'Paid', partyName: employee.name,
    }));
  };

  const empty = (): Payment => {
    const category: PaymentCategory = 'Bill';
    const targets = targetsFor(category);
    const first = targets[0];
    return {
      id: uid('pay'),
      paymentNo: nextDocumentNo('PAY', data.payments.map((payment) => payment.paymentNo)),
      date: today(),
      category,
      targetId: first?.id ?? '',
      partyName: first?.partyName ?? '',
      direction: first?.direction ?? 'Paid',
      amount: first && Number.isFinite(first.balance) ? first.balance : 0,
      mode: 'Bank Transfer',
      reference: '',
      notes: '',
      createdAt: new Date().toISOString(),
    };
  };

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Payment>(empty());
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => data.payments.filter((payment) => `${payment.paymentNo} ${payment.partyName} ${payment.reference} ${payment.mode} ${payment.category}`.toLowerCase().includes(query.toLowerCase())),
    [data.payments, query],
  );

  const anyTargetsAvailable = (['Bill', 'Supply', 'Receipt', 'Employee'] as const).some((category) => targetsFor(category).length > 0);

  const openCreate = () => {
    setDraft(empty());
    setError('');
    setOpen(true);
  };

  const changeCategory = (category: PaymentCategory) => {
    const targets = targetsFor(category);
    const first = targets[0];
    setDraft({
      ...draft,
      category,
      targetId: first?.id ?? '',
      partyName: first?.partyName ?? '',
      direction: first?.direction ?? 'Paid',
      amount: first && Number.isFinite(first.balance) ? first.balance : 0,
    });
  };

  const selectTarget = (id: string) => {
    const target = targetsFor(draft.category).find((candidate) => candidate.id === id);
    setDraft({
      ...draft,
      targetId: id,
      partyName: target?.partyName ?? '',
      direction: target?.direction ?? draft.direction,
      amount: target && Number.isFinite(target.balance) ? target.balance : draft.amount,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const targets = targetsFor(draft.category);
    const target = targets.find((candidate) => candidate.id === draft.targetId);
    if (!target) {
      setError(`Select an ${categoryLabel[draft.category].toLowerCase()} before saving the payment.`);
      return;
    }

    const next: Payment = {
      ...draft,
      paymentNo: cleanText(draft.paymentNo).toUpperCase(),
      partyName: cleanText(draft.partyName) || target.partyName,
      direction: target.direction,
      reference: cleanText(draft.reference).toUpperCase(),
      notes: cleanText(draft.notes),
      amount: draft.amount || 0,
      billId: draft.category === 'Bill' ? draft.targetId : undefined,
    };

    if (!isFilled(next.paymentNo) || !isFilled(next.date) || !isFilled(next.targetId) || !isFilled(next.partyName)) {
      setError('Payment number, date, target document and party name are mandatory.');
      return;
    }
    if (!isPositive(next.amount)) {
      setError('Payment amount must be more than zero.');
      return;
    }
    if (Number.isFinite(target.balance) && next.amount > target.balance) {
      setError(`Payment cannot exceed the outstanding balance of ${currency(target.balance)}.`);
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

    try {
      await addPayment(next);
      setOpen(false);
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Payment could not be saved.');
    }
  };

  const targetLabel = (payment: Payment) => {
    if (payment.category === 'Bill') return data.bills.find((bill) => bill.id === payment.targetId)?.billNo || '-';
    if (payment.category === 'Supply') return data.supplies.find((supply) => supply.id === payment.targetId)?.issueNo || '-';
    if (payment.category === 'Receipt') return data.receipts.find((receipt) => receipt.id === payment.targetId)?.receiptNo || '-';
    return data.employees.find((employee) => employee.id === payment.targetId)?.name || '-';
  };

  const currentTargets = targetsFor(draft.category);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cash flow"
        title="Payments"
        description="Record payments and receipts against bills, material supplied to sites, material received from suppliers, or employee wages."
        actions={(
          <>
            <button className="button secondary" onClick={() => downloadCsv('payments.csv', filtered.map((payment) => ({
              Payment: payment.paymentNo,
              Date: payment.date,
              Category: payment.category,
              Against: targetLabel(payment),
              Party: payment.partyName,
              Direction: payment.direction,
              Amount: payment.amount,
              Mode: payment.mode,
              Reference: payment.reference,
            })))}><Download size={17} /> Export</button>
            <button className="button primary" disabled={!anyTargetsAvailable} onClick={openCreate}><Plus size={17} /> Record payment</button>
          </>
        )}
      />

      <section className="stats-grid mini-stats">
        <article className="stat-card"><div className="stat-icon"><WalletCards size={21} /></div><div className="stat-copy"><span>Total paid</span><strong>{currency(data.payments.filter((payment) => payment.direction === 'Paid').reduce((sum, payment) => sum + payment.amount, 0))}</strong><small>Suppliers, wages & outflow</small></div></article>
        <article className="stat-card"><div className="stat-icon"><WalletCards size={21} /></div><div className="stat-copy"><span>Total received</span><strong>{currency(data.payments.filter((payment) => payment.direction === 'Received').reduce((sum, payment) => sum + payment.amount, 0))}</strong><small>Client & site collections</small></div></article>
        <article className="stat-card"><div className="stat-icon"><WalletCards size={21} /></div><div className="stat-copy"><span>Open documents</span><strong>{(['Bill', 'Supply', 'Receipt'] as const).reduce((sum, category) => sum + targetsFor(category).length, 0)}</strong><small>Awaiting settlement</small></div></article>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search payment, party, mode or reference..." />
          <div className="toolbar-summary"><strong>{filtered.length}</strong><span>payments</span></div>
        </div>
        {filtered.length === 0 ? <EmptyState title="No payments found" description="Record a payment once a bill, site issue, receipt or employee is due." action={<button className="button primary" disabled={!anyTargetsAvailable} onClick={openCreate}><Plus size={17} /> Record payment</button>} /> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Payment</th><th>Date</th><th>Category</th><th>Party</th><th>Against</th><th>Direction</th><th>Mode</th><th>Reference</th><th>Amount</th><th /></tr></thead>
              <tbody>{filtered.map((payment) => (
                <tr key={payment.id}>
                  <td><strong>{payment.paymentNo}</strong><span>{payment.notes || 'Payment entry'}</span></td>
                  <td>{new Date(payment.date).toLocaleDateString('en-IN')}</td>
                  <td><span className="soft-badge">{payment.category}</span></td>
                  <td><strong>{payment.partyName}</strong></td>
                  <td>{targetLabel(payment)}</td>
                  <td><span className={`status-pill ${payment.direction === 'Received' ? 'success' : 'warning'}`}>{payment.direction}</span></td>
                  <td>{payment.mode}</td>
                  <td>{payment.reference || '-'}</td>
                  <td><strong className={payment.direction === 'Received' ? 'positive-text' : ''}>{currency(payment.amount)}</strong></td>
                  <td><button className="icon-button danger" onClick={() => { if (confirm(`Delete ${payment.paymentNo}?`)) void deletePayment(payment.id).catch(() => undefined); }} aria-label={`Delete ${payment.paymentNo}`}><Trash2 size={16} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={open} title="Record payment" subtitle="Payments can be recorded against bills, site material issues, supplier receipts or employee wages." onClose={() => setOpen(false)} wide>
        <form className="form-stack" onSubmit={submit}>
          {error && <div className="alert danger-alert">{error}</div>}
          <div className="segmented form-segmented">
            {(['Bill', 'Supply', 'Receipt', 'Employee'] as const).map((category) => (
              <button type="button" key={category} className={draft.category === category ? 'active' : ''} onClick={() => changeCategory(category)}>{categoryLabel[category]}</button>
            ))}
          </div>
          <div className="form-grid two">
            <label><span>Payment number *</span><input required value={draft.paymentNo} onChange={(event) => setDraft({ ...draft, paymentNo: event.target.value.toUpperCase() })} /></label>
            <label><span>Date *</span><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
            <label className="span-2"><span>{categoryLabel[draft.category]} *</span>
              <select required value={draft.targetId} onChange={(event) => selectTarget(event.target.value)}>
                <option value="">Select {categoryLabel[draft.category].toLowerCase()}</option>
                {currentTargets.map((target) => <option key={target.id} value={target.id}>{target.label} {Number.isFinite(target.balance) ? `/ Balance ${currency(target.balance)}` : ''}</option>)}
              </select>
              {currentTargets.length === 0 && <small>No {categoryLabel[draft.category].toLowerCase()} available right now.</small>}
            </label>
            <label><span>Direction *</span><select required disabled value={draft.direction}><option>Paid</option><option>Received</option></select></label>
            <label><span>Amount *</span><input required type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })} /></label>
            <label><span>Mode *</span><select required value={draft.mode} onChange={(event) => setDraft({ ...draft, mode: event.target.value as Payment['mode'] })}><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>UPI</option><option>Card</option></select></label>
            <label><span>Reference {draft.mode !== 'Cash' ? '*' : ''}</span><input required={draft.mode !== 'Cash'} value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} placeholder="UTR / cheque / transaction ID" /></label>
            <label className="span-2"><span>Notes</span><textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
          </div>
          {draft.category === 'Employee' && (() => {
            const employee = data.employees.find((candidate) => candidate.id === draft.targetId);
            if (!employee) return null;
            return <div className="alert info-alert">Already paid to {employee.name} so far: <strong>{currency(paidForEmployee(data, employee.id))}</strong> (this is a running total, not a capped balance).</div>;
          })()}
          {draft.category === 'Supply' && draft.targetId && (() => {
            const supply = data.supplies.find((candidate) => candidate.id === draft.targetId);
            if (!supply) return null;
            return <div className="alert info-alert">Issue total {currency(supplyTotal(supply))}, balance due {currency(supplyBalance(data, supply))}.</div>;
          })()}
          {draft.category === 'Receipt' && draft.targetId && (() => {
            const receipt = data.receipts.find((candidate) => candidate.id === draft.targetId);
            if (!receipt) return null;
            return <div className="alert info-alert">Receipt total {currency(receiptTotal(receipt))}, balance due {currency(receiptBalance(data, receipt))}.</div>;
          })()}
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="button primary">Save payment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
