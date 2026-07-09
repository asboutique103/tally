import { BookOpen, Download, Landmark, Plus, Scale, Trash2, WalletCards } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { accountActivity, accountBalances, allVouchers, currency, downloadCsv, nextDocumentNo, today, uid, voucherTotals } from '../lib/helpers';
import { useApp } from '../store/AppContext';
import type { Voucher, VoucherLine, VoucherType } from '../types';

type Tab = 'Day Book' | 'General Ledger' | 'Trial Balance' | 'Profit & Loss' | 'Balance Sheet' | 'Manual Vouchers';
const tabs: { name: Tab; icon: typeof BookOpen }[] = [
  { name: 'Day Book', icon: BookOpen },
  { name: 'General Ledger', icon: Landmark },
  { name: 'Trial Balance', icon: Scale },
  { name: 'Profit & Loss', icon: WalletCards },
  { name: 'Balance Sheet', icon: Landmark },
  { name: 'Manual Vouchers', icon: BookOpen },
];

const newLine = (accountId = ''): VoucherLine => ({ id: uid('vl'), accountId, debit: 0, credit: 0, narration: '' });

export function Accounts() {
  const { data, addVoucher, deleteVoucher } = useApp();
  const [tab, setTab] = useState<Tab>('Day Book');
  const [ledgerId, setLedgerId] = useState(data.accounts[0]?.id ?? '');
  const [open, setOpen] = useState(false);
  const empty = (): Voucher => ({ id: uid('vch'), voucherNo: nextDocumentNo('JV', data.vouchers.map((voucher) => voucher.voucherNo)), type: 'Journal', date: today(), partyName: '', reference: '', narration: '', lines: [newLine(data.accounts[0]?.id), newLine(data.accounts[1]?.id)], sourceType: 'Manual', createdAt: new Date().toISOString() });
  const [draft, setDraft] = useState<Voucher>(empty());

  const vouchers = useMemo(() => allVouchers(data), [data]);
  const balances = useMemo(() => accountBalances(data), [data]);
  const ledger = useMemo(() => accountActivity(data, ledgerId), [data, ledgerId]);
  const ledgerAccount = data.accounts.find((account) => account.id === ledgerId);
  let running = 0;
  const income = balances.filter((account) => account.category === 'Income').reduce((sum, account) => sum + account.credit - account.debit, 0);
  const expenses = balances.filter((account) => account.category === 'Expense').reduce((sum, account) => sum + account.debit - account.credit, 0);
  const profit = income - expenses;
  const assets = balances.filter((account) => account.category === 'Asset');
  const liabilities = balances.filter((account) => account.category === 'Liability');
  const equity = balances.filter((account) => account.category === 'Equity');

  const setLine = (id: string, patch: Partial<VoucherLine>) => setDraft((current) => ({ ...current, lines: current.lines.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const totals = voucherTotals(draft);
    if (!draft.lines.length || totals.debit <= 0 || Math.abs(totals.debit - totals.credit) > 0.01) {
      alert('Voucher debit and credit totals must be equal and greater than zero.');
      return;
    }
    if (draft.lines.some((entry) => !entry.accountId || (entry.debit > 0 && entry.credit > 0))) {
      alert('Select an account and enter either debit or credit on each line.');
      return;
    }
    if (data.vouchers.some((voucher) => voucher.id !== draft.id && voucher.voucherNo.toUpperCase() === draft.voucherNo.trim().toUpperCase())) {
      alert('Another manual voucher already uses this voucher number.');
      return;
    }
    addVoucher(draft);
    setOpen(false);
  };

  const exportCurrent = () => {
    if (tab === 'Day Book') downloadCsv('day-book.csv', vouchers.map((voucher) => ({ Date: voucher.date, Voucher: voucher.voucherNo, Type: voucher.type, Party: voucher.partyName, Reference: voucher.reference, Debit: voucherTotals(voucher).debit, Credit: voucherTotals(voucher).credit, Source: voucher.sourceType })));
    if (tab === 'General Ledger') downloadCsv('general-ledger.csv', ledger.map((entry) => ({ Date: entry.voucher.date, Voucher: entry.voucher.voucherNo, Type: entry.voucher.type, Party: entry.voucher.partyName, Narration: entry.narration || entry.voucher.narration, Debit: entry.debit, Credit: entry.credit })));
    if (tab === 'Trial Balance') downloadCsv('trial-balance.csv', balances.map((account) => ({ Code: account.code, Account: account.name, Group: account.group, Debit: Math.max(0, account.net), Credit: Math.max(0, -account.net) })));
  };

  return <div className="page-stack">
    <PageHeader eyebrow="Double-entry accounting" title="Accounts & vouchers" description="Automatic vouchers from invoices, stock issues and payments, with complete day book, ledgers, trial balance and financial statements." actions={<><button className="button secondary" onClick={exportCurrent}><Download size={17}/> Export</button><button className="button primary" onClick={() => { setDraft(empty()); setOpen(true); }}><Plus size={17}/> Manual voucher</button></>} />

    <div className="report-tabs account-tabs">{tabs.map(({ name, icon: Icon }) => <button className={tab === name ? 'active' : ''} onClick={() => setTab(name)} key={name}><Icon size={18}/><span>{name}</span></button>)}</div>

    {tab === 'Day Book' && <section className="panel table-panel"><div className="panel-header"><div><span className="eyebrow">All posted transactions</span><h2>Day Book</h2></div><span className="soft-badge">{vouchers.length} vouchers</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Date / voucher</th><th>Type</th><th>Party / narration</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Source</th></tr></thead><tbody>{vouchers.map((voucher) => { const totals = voucherTotals(voucher); return <tr key={voucher.id}><td><strong>{voucher.voucherNo}</strong><span>{new Date(voucher.date).toLocaleDateString('en-IN')}</span></td><td><span className="soft-badge">{voucher.type}</span></td><td><strong>{voucher.partyName || '—'}</strong><span>{voucher.narration || 'Automatic posting'}</span></td><td>{voucher.reference || '—'}</td><td>{currency(totals.debit)}</td><td>{currency(totals.credit)}</td><td>{voucher.sourceType || 'Manual'}</td></tr>; })}</tbody></table></div></section>}

    {tab === 'General Ledger' && <section className="panel table-panel"><div className="table-toolbar split-toolbar"><label className="ledger-picker"><span>Ledger account</span><select value={ledgerId} onChange={(event) => setLedgerId(event.target.value)}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label><div className="toolbar-summary"><strong>{ledgerAccount?.name}</strong><span>{ledgerAccount?.group}</span></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th>Debit</th><th>Credit</th><th>Running balance</th></tr></thead><tbody>{ledger.map((entry) => { running += entry.debit - entry.credit; return <tr key={`${entry.voucher.id}-${entry.id}`}><td>{new Date(entry.voucher.date).toLocaleDateString('en-IN')}</td><td><strong>{entry.voucher.voucherNo}</strong><span>{entry.voucher.type}</span></td><td><strong>{entry.voucher.partyName || entry.voucher.narration}</strong><span>{entry.narration}</span></td><td>{entry.debit ? currency(entry.debit) : '—'}</td><td>{entry.credit ? currency(entry.credit) : '—'}</td><td><strong>{currency(Math.abs(running))} {running >= 0 ? 'Dr' : 'Cr'}</strong></td></tr>; })}</tbody></table></div></section>}

    {tab === 'Trial Balance' && <section className="panel table-panel"><div className="panel-header"><div><span className="eyebrow">Control report</span><h2>Trial Balance</h2></div><span className="soft-badge">Double-entry verified</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Account</th><th>Group</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{balances.map((account) => <tr key={account.id}><td><strong>{account.name}</strong><span>{account.code}</span></td><td>{account.group}</td><td>{account.net > 0 ? currency(account.net) : '—'}</td><td>{account.net < 0 ? currency(-account.net) : '—'}</td></tr>)}</tbody><tfoot><tr><td colSpan={2}>Grand total</td><td>{currency(balances.reduce((sum, account) => sum + Math.max(0, account.net), 0))}</td><td>{currency(balances.reduce((sum, account) => sum + Math.max(0, -account.net), 0))}</td></tr></tfoot></table></div></section>}

    {tab === 'Profit & Loss' && <section className="financial-grid"><article className="panel financial-card"><div className="panel-header"><div><span className="eyebrow">Revenue</span><h2>Income</h2></div><strong>{currency(income)}</strong></div>{balances.filter((account) => account.category === 'Income').map((account) => <div className="financial-row" key={account.id}><span>{account.name}</span><strong>{currency(account.credit - account.debit)}</strong></div>)}</article><article className="panel financial-card"><div className="panel-header"><div><span className="eyebrow">Costs</span><h2>Expenses</h2></div><strong>{currency(expenses)}</strong></div>{balances.filter((account) => account.category === 'Expense').map((account) => <div className="financial-row" key={account.id}><span>{account.name}</span><strong>{currency(account.debit - account.credit)}</strong></div>)}</article><article className={`panel profit-card ${profit < 0 ? 'loss' : ''}`}><span>{profit >= 0 ? 'Net profit' : 'Net loss'}</span><strong>{currency(Math.abs(profit))}</strong><small>Generated from every posted voucher</small></article></section>}

    {tab === 'Balance Sheet' && <section className="financial-grid two"><article className="panel financial-card"><div className="panel-header"><div><span className="eyebrow">Resources</span><h2>Assets</h2></div><strong>{currency(assets.reduce((sum, account) => sum + account.net, 0))}</strong></div>{assets.map((account) => <div className="financial-row" key={account.id}><span>{account.name}</span><strong>{currency(account.net)}</strong></div>)}</article><article className="panel financial-card"><div className="panel-header"><div><span className="eyebrow">Funding</span><h2>Liabilities & equity</h2></div><strong>{currency(liabilities.reduce((sum, account) => sum - account.net, 0) + equity.reduce((sum, account) => sum - account.net, 0) + profit)}</strong></div>{liabilities.map((account) => <div className="financial-row" key={account.id}><span>{account.name}</span><strong>{currency(-account.net)}</strong></div>)}{equity.map((account) => <div className="financial-row" key={account.id}><span>{account.name}</span><strong>{currency(-account.net)}</strong></div>)}<div className="financial-row total"><span>Current period profit / loss</span><strong>{currency(profit)}</strong></div></article></section>}

    {tab === 'Manual Vouchers' && <section className="panel table-panel"><div className="panel-header"><div><span className="eyebrow">User-entered accounting</span><h2>Manual vouchers</h2></div><button className="button primary" onClick={() => { setDraft(empty()); setOpen(true); }}><Plus size={17}/> New voucher</button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Voucher</th><th>Type</th><th>Party</th><th>Debit</th><th>Credit</th><th/></tr></thead><tbody>{data.vouchers.map((voucher) => { const totals = voucherTotals(voucher); return <tr key={voucher.id}><td><strong>{voucher.voucherNo}</strong><span>{new Date(voucher.date).toLocaleDateString('en-IN')}</span></td><td>{voucher.type}</td><td><strong>{voucher.partyName || '—'}</strong><span>{voucher.narration}</span></td><td>{currency(totals.debit)}</td><td>{currency(totals.credit)}</td><td><button className="icon-button danger" onClick={() => confirm(`Delete ${voucher.voucherNo}?`) && deleteVoucher(voucher.id)}><Trash2 size={16}/></button></td></tr>; })}</tbody></table></div></section>}

    <Modal open={open} title="Post manual voucher" subtitle="Every voucher must balance. Debit total must equal credit total." onClose={() => setOpen(false)} wide><form className="form-stack" onSubmit={submit}><div className="form-grid three"><label><span>Voucher number *</span><input required value={draft.voucherNo} onChange={(event) => setDraft({ ...draft, voucherNo: event.target.value })}/></label><label><span>Voucher type</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as VoucherType })}>{(['Journal', 'Contra', 'Receipt', 'Payment', 'Debit Note', 'Credit Note'] as VoucherType[]).map((type) => <option key={type}>{type}</option>)}</select></label><label><span>Date *</span><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label><label><span>Party / payee</span><input value={draft.partyName} onChange={(event) => setDraft({ ...draft, partyName: event.target.value })}/></label><label><span>Reference</span><input value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })}/></label><label><span>Narration</span><input value={draft.narration} onChange={(event) => setDraft({ ...draft, narration: event.target.value })}/></label></div><div className="voucher-lines"><div className="voucher-line heading"><span>Account</span><span>Debit</span><span>Credit</span><span/></div>{draft.lines.map((entry) => <div className="voucher-line" key={entry.id}><select value={entry.accountId} onChange={(event) => setLine(entry.id, { accountId: event.target.value })}><option value="">Select account</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select><input type="number" min="0" step="0.01" value={entry.debit || ''} onChange={(event) => setLine(entry.id, { debit: Number(event.target.value), credit: Number(event.target.value) ? 0 : entry.credit })}/><input type="number" min="0" step="0.01" value={entry.credit || ''} onChange={(event) => setLine(entry.id, { credit: Number(event.target.value), debit: Number(event.target.value) ? 0 : entry.debit })}/><button type="button" className="icon-button danger" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((line) => line.id !== entry.id) })}><Trash2 size={16}/></button></div>)}<button type="button" className="button secondary" onClick={() => setDraft({ ...draft, lines: [...draft.lines, newLine()] })}><Plus size={16}/> Add line</button></div><div className="document-total"><span>Debit {currency(voucherTotals(draft).debit)}</span><span>Credit {currency(voucherTotals(draft).credit)}</span><strong>Difference {currency(Math.abs(voucherTotals(draft).debit - voucherTotals(draft).credit))}</strong></div><div className="form-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button primary">Post voucher</button></div></form></Modal>
  </div>;
}
