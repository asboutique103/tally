import { CalendarClock, Download, ReceiptIndianRupee, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { directCustomerPhone, isDirectCustomerBill } from '../lib/directCustomers';
import { billBalance, billTotal, currency, downloadCsv, today } from '../lib/helpers';
import { useApp } from '../store/AppContext';

type CreditFilter = 'All' | 'Open' | 'Overdue' | 'Paid';

const formatDate = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN') : '—';
const daysBetween = (from: string, to: string) => Math.max(0, Math.floor((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000));

export function Credit() {
  const { data } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CreditFilter>('Open');
  const todayValue = today();

  const rows = useMemo(() => data.bills.filter(isDirectCustomerBill).map((bill) => {
    const total = billTotal(bill);
    const balance = billBalance(data, bill);
    const payments = data.payments
      .filter((payment) => payment.category === 'Bill' && payment.targetId === bill.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const overdue = balance > 0 && bill.dueDate < todayValue;
    return {
      bill,
      total,
      paid: total - balance,
      balance,
      overdue,
      phone: directCustomerPhone(bill),
      lastPayment: payments[0],
      creditAge: daysBetween(bill.date, todayValue),
      overdueDays: overdue ? daysBetween(bill.dueDate, todayValue) : 0,
    };
  }), [data, todayValue]);

  const filtered = useMemo(() => rows.filter((row) => {
    const matchesFilter = filter === 'All'
      || (filter === 'Open' && row.balance > 0)
      || (filter === 'Overdue' && row.overdue)
      || (filter === 'Paid' && row.balance <= 0);
    const haystack = `${row.bill.billNo} ${row.bill.partyName} ${row.phone} ${row.bill.partyGstin ?? ''} ${row.bill.status}`.toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  }), [filter, query, rows]);

  const openRows = rows.filter((row) => row.balance > 0);
  const overdueRows = rows.filter((row) => row.overdue);
  const totalOutstanding = openRows.reduce((sum, row) => sum + row.balance, 0);
  const overdueAmount = overdueRows.reduce((sum, row) => sum + row.balance, 0);
  const totalCollected = rows.reduce((sum, row) => sum + row.paid, 0);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Direct customer collections"
        title="Credit tracker"
        description="Track every direct customer invoice, partial payment, unpaid balance, due date and collection history in one place."
        actions={(
          <button className="button secondary" onClick={() => downloadCsv('direct-customer-credit.csv', filtered.map((row) => ({
            Invoice: row.bill.billNo,
            InvoiceDate: row.bill.date,
            DueDate: row.bill.dueDate,
            Customer: row.bill.partyName,
            Phone: row.phone,
            GSTIN: row.bill.partyGstin ?? '',
            Total: row.total,
            Paid: row.paid,
            CreditBalance: row.balance,
            Status: row.overdue ? 'Overdue' : row.balance > 0 ? 'Open' : 'Paid',
            CreditAgeDays: row.creditAge,
            OverdueDays: row.overdueDays,
            LastPaymentDate: row.lastPayment?.date ?? '',
            LastPaymentMode: row.lastPayment?.mode ?? '',
            LastPaymentReference: row.lastPayment?.reference ?? '',
          })))}><Download size={17} /> Export credit</button>
        )}
      />

      <section className="stats-grid mini-stats">
        <article className="stat-card"><div className="stat-icon"><WalletCards size={21} /></div><div className="stat-copy"><span>Credit outstanding</span><strong>{currency(totalOutstanding)}</strong><small>{openRows.length} open direct customer invoices</small></div></article>
        <article className="stat-card"><div className="stat-icon"><CalendarClock size={21} /></div><div className="stat-copy"><span>Overdue</span><strong>{currency(overdueAmount)}</strong><small>{overdueRows.length} invoices past due</small></div></article>
        <article className="stat-card"><div className="stat-icon"><ReceiptIndianRupee size={21} /></div><div className="stat-copy"><span>Amount collected</span><strong>{currency(totalCollected)}</strong><small>Full and partial receipts recorded</small></div></article>
        <article className="stat-card"><div className="stat-icon"><ReceiptIndianRupee size={21} /></div><div className="stat-copy"><span>Direct invoices</span><strong>{rows.length}</strong><small>{rows.filter((row) => row.balance <= 0).length} fully settled</small></div></article>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar split-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search customer, phone, invoice or GSTIN..." />
          <div className="segmented">{(['All', 'Open', 'Overdue', 'Paid'] as const).map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="No credit records found"
            description="Create a Direct Customer invoice with partial payment or credit to start tracking collections."
            action={<button className="button primary" onClick={() => navigate('/bills')}>Create direct invoice</button>}
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Due date</th><th>Total</th><th>Paid</th><th>Credit balance</th><th>Age</th><th>Last payment</th><th>Status</th><th /></tr></thead>
              <tbody>{filtered.map((row) => (
                <tr key={row.bill.id}>
                  <td><strong>{row.bill.billNo}</strong><span>{formatDate(row.bill.date)}</span></td>
                  <td><strong>{row.bill.partyName}</strong><span>{row.phone || 'No phone'}{row.bill.partyGstin ? ` · ${row.bill.partyGstin}` : ''}</span></td>
                  <td><strong className={row.overdue ? 'negative-text' : ''}>{formatDate(row.bill.dueDate)}</strong><span>{row.overdue ? `${row.overdueDays} days overdue` : row.balance > 0 ? 'Within due date' : 'Settled'}</span></td>
                  <td><strong>{currency(row.total)}</strong></td>
                  <td className="positive-text"><strong>{currency(row.paid)}</strong></td>
                  <td><strong className={row.balance > 0 ? 'negative-text' : 'positive-text'}>{currency(row.balance)}</strong></td>
                  <td>{row.creditAge} days</td>
                  <td>{row.lastPayment ? <><strong>{formatDate(row.lastPayment.date)}</strong><span>{row.lastPayment.mode}{row.lastPayment.reference ? ` · ${row.lastPayment.reference}` : ''}</span></> : <span>No payment yet</span>}</td>
                  <td><span className={`status-pill ${row.overdue ? 'warning' : row.balance > 0 ? '' : 'success'}`}>{row.overdue ? 'Overdue' : row.balance > 0 ? 'Open' : 'Paid'}</span></td>
                  <td>{row.balance > 0 && <button className="button secondary compact-button" onClick={() => navigate('/payments')}>Receive</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
