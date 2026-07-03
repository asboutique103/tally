import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { currency, downloadCsv, uid } from '../lib/helpers';
import { useApp } from '../store/AppContext';
import type { Supplier } from '../types';

const emptySupplier = (): Supplier => ({ id: uid('sup'), code: '', name: '', contactPerson: '', phone: '', email: '', gstin: '', address: '', openingBalance: 0, status: 'Active', createdAt: new Date().toISOString() });

export function Suppliers() {
  const { data, upsertSupplier, deleteSupplier } = useApp();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Supplier>(emptySupplier());
  const filtered = useMemo(() => data.suppliers.filter((item) => `${item.name} ${item.code} ${item.contactPerson} ${item.phone} ${item.gstin}`.toLowerCase().includes(query.toLowerCase())), [data.suppliers, query]);
  const outstanding = (supplierId: string) => data.bills.filter((bill) => bill.supplierId === supplierId).reduce((sum, bill) => sum + bill.items.reduce((s, item) => s + item.quantity * item.rate * (1 + item.taxRate / 100), 0) + bill.otherCharges - bill.discount, 0) - data.payments.filter((p) => data.bills.some((b) => b.id === p.billId && b.supplierId === supplierId)).reduce((sum, payment) => sum + payment.amount, 0);
  const submit = (event: FormEvent) => { event.preventDefault(); upsertSupplier(draft); setOpen(false); };

  return <div className="page-stack">
    <PageHeader eyebrow="Vendor management" title="Suppliers" description="Maintain supplier identity, GST, contacts, opening balances and payable visibility." actions={<><button className="button secondary" onClick={() => downloadCsv('suppliers.csv', filtered.map((s) => ({ Code: s.code, Supplier: s.name, Contact: s.contactPerson, Phone: s.phone, GSTIN: s.gstin, Outstanding: outstanding(s.id), Status: s.status })))}><Download size={17}/> Export</button><button className="button primary" onClick={() => { setDraft({ ...emptySupplier(), code: `SUP-${String(data.suppliers.length + 1).padStart(3, '0')}` }); setOpen(true); }}><Plus size={17}/> New supplier</button></>} />
    <section className="panel table-panel">
      <div className="table-toolbar"><SearchBar value={query} onChange={setQuery} placeholder="Search supplier, GSTIN or phone..."/><div className="toolbar-summary"><strong>{filtered.length}</strong><span>suppliers</span></div></div>
      <div className="cards-grid supplier-cards">{filtered.map((supplier) => <article className="entity-card" key={supplier.id}>
        <div className="entity-card-top"><div className="entity-avatar">{supplier.name.slice(0,2).toUpperCase()}</div><span className={`status-pill ${supplier.status === 'Active' ? 'success' : 'neutral'}`}>{supplier.status}</span></div>
        <h3>{supplier.name}</h3><p>{supplier.code} · {supplier.gstin || 'GSTIN not set'}</p>
        <div className="entity-details"><div><span>Contact</span><strong>{supplier.contactPerson || '—'}</strong></div><div><span>Phone</span><strong>{supplier.phone || '—'}</strong></div><div><span>Outstanding</span><strong className={outstanding(supplier.id) > 0 ? 'negative-text' : ''}>{currency(outstanding(supplier.id))}</strong></div><div><span>Opening balance</span><strong>{currency(supplier.openingBalance)}</strong></div></div>
        <div className="entity-card-actions"><button className="button secondary small" onClick={() => { setDraft(supplier); setOpen(true); }}><Pencil size={15}/> Edit</button><button className="icon-button danger" onClick={() => confirm(`Delete ${supplier.name}?`) && deleteSupplier(supplier.id)}><Trash2 size={16}/></button></div>
      </article>)}</div>
    </section>
    <Modal open={open} title={data.suppliers.some((s) => s.id === draft.id) ? 'Edit supplier' : 'Create supplier'} subtitle="Supplier details are linked with receipts, purchase bills and payments." onClose={() => setOpen(false)} wide>
      <form className="form-stack" onSubmit={submit}><div className="form-grid two">
        <label><span>Supplier code *</span><input required value={draft.code} onChange={(e) => setDraft({...draft, code:e.target.value})}/></label>
        <label><span>Supplier name *</span><input required value={draft.name} onChange={(e) => setDraft({...draft, name:e.target.value})}/></label>
        <label><span>Contact person</span><input value={draft.contactPerson} onChange={(e) => setDraft({...draft, contactPerson:e.target.value})}/></label>
        <label><span>Phone</span><input value={draft.phone} onChange={(e) => setDraft({...draft, phone:e.target.value})}/></label>
        <label><span>Email</span><input type="email" value={draft.email} onChange={(e) => setDraft({...draft, email:e.target.value})}/></label>
        <label><span>GSTIN</span><input value={draft.gstin} onChange={(e) => setDraft({...draft, gstin:e.target.value.toUpperCase()})}/></label>
        <label><span>Opening balance</span><input type="number" step="0.01" value={draft.openingBalance} onChange={(e) => setDraft({...draft, openingBalance:Number(e.target.value)})}/></label>
        <label><span>Status</span><select value={draft.status} onChange={(e) => setDraft({...draft, status:e.target.value as Supplier['status']})}><option>Active</option><option>Inactive</option></select></label>
        <label className="span-2"><span>Address</span><textarea rows={3} value={draft.address} onChange={(e) => setDraft({...draft, address:e.target.value})}/></label>
      </div><div className="form-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button primary">Save supplier</button></div></form>
    </Modal>
  </div>;
}
