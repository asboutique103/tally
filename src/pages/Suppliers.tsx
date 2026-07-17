import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { billBalance, currency, downloadCsv, uid } from '../lib/helpers';
import { cleanText, compactPhone, hasDuplicate, isFilled, isValidGstin, isValidIndianPhone, normalizeGstin } from '../lib/validation';
import { useApp } from '../store/AppContext';
import type { Supplier } from '../types';

const emptySupplier = (): Supplier => ({
  id: uid('sup'),
  code: '',
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  gstin: '',
  address: '',
  openingBalance: 0,
  status: 'Active',
  createdAt: new Date().toISOString(),
});

export function Suppliers() {
  const { data, upsertSupplier, deleteSupplier } = useApp();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Supplier>(emptySupplier());
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => data.suppliers.filter((item) => `${item.name} ${item.code} ${item.contactPerson} ${item.phone} ${item.gstin}`.toLowerCase().includes(query.toLowerCase())),
    [data.suppliers, query],
  );

  const outstanding = (supplierId: string) =>
    data.bills.filter((bill) => bill.supplierId === supplierId).reduce((sum, bill) => sum + billBalance(data, bill), 0);

  const requestDelete = (supplier: Supplier) => {
    const inUse = data.receipts.some((receipt) => receipt.supplierId === supplier.id)
      || data.bills.some((bill) => bill.supplierId === supplier.id);
    if (inUse) {
      alert('This supplier is already used in receipts or bills. Keep it for audit history.');
      return;
    }
    if (confirm(`Delete ${supplier.name}?`)) void deleteSupplier(supplier.id).catch(() => undefined);
  };

  const openCreate = () => {
    setDraft({ ...emptySupplier(), code: `SUP-${String(data.suppliers.length + 1).padStart(3, '0')}` });
    setError('');
    setOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setDraft(supplier);
    setError('');
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Supplier = {
      ...draft,
      code: cleanText(draft.code).toUpperCase(),
      name: cleanText(draft.name),
      contactPerson: cleanText(draft.contactPerson),
      phone: compactPhone(draft.phone),
      email: cleanText(draft.email).toLowerCase(),
      gstin: normalizeGstin(draft.gstin),
      address: cleanText(draft.address),
      openingBalance: Math.max(0, draft.openingBalance || 0),
    };

    if (!isFilled(next.code) || !isFilled(next.name) || !isFilled(next.contactPerson) || !isFilled(next.phone) || !isFilled(next.gstin) || !isFilled(next.address)) {
      setError('Supplier code, name, contact person, phone, GSTIN and address are mandatory.');
      return;
    }
    if (!isValidIndianPhone(next.phone)) {
      setError('Enter a valid 10-digit Indian mobile number for the supplier.');
      return;
    }
    if (!isValidGstin(next.gstin)) {
      setError('Enter a valid 15-character GSTIN for the supplier.');
      return;
    }
    if (hasDuplicate(data.suppliers, next.id, (supplier) => supplier.code.toUpperCase() === next.code)) {
      setError('Another supplier already uses this supplier code.');
      return;
    }
    if (hasDuplicate(data.suppliers, next.id, (supplier) => supplier.gstin.toUpperCase() === next.gstin)) {
      setError('Another supplier already uses this GSTIN.');
      return;
    }

    try {
      await upsertSupplier(next);
      setOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Supplier could not be saved.');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Vendor management"
        title="Suppliers"
        description="Maintain mandatory supplier identity, GST, contacts, opening balances and payable visibility."
        actions={(
          <>
            <button className="button secondary" onClick={() => downloadCsv('suppliers.csv', filtered.map((supplier) => ({
              Code: supplier.code,
              Supplier: supplier.name,
              Contact: supplier.contactPerson,
              Phone: supplier.phone,
              GSTIN: supplier.gstin,
              Outstanding: outstanding(supplier.id),
              Status: supplier.status,
            })))}><Download size={17} /> Export</button>
            <button className="button primary" onClick={openCreate}><Plus size={17} /> New supplier</button>
          </>
        )}
      />

      <section className="panel table-panel">
        <div className="table-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search supplier, GSTIN or phone..." />
          <div className="toolbar-summary"><strong>{filtered.length}</strong><span>suppliers</span></div>
        </div>
        {filtered.length === 0 ? <EmptyState title="No suppliers found" description="Create a supplier or change your search filters." action={<button className="button primary" onClick={openCreate}><Plus size={17} /> Add supplier</button>} /> : (
          <div className="cards-grid supplier-cards">
            {filtered.map((supplier) => (
              <article className="entity-card" key={supplier.id}>
                <div className="entity-card-top">
                  <div className="entity-avatar">{supplier.name.slice(0, 2).toUpperCase()}</div>
                  <span className={`status-pill ${supplier.status === 'Active' ? 'success' : 'neutral'}`}>{supplier.status}</span>
                </div>
                <h3>{supplier.name}</h3>
                <p>{supplier.code} / {supplier.gstin || 'GSTIN missing'}</p>
                <div className="entity-details">
                  <div><span>Contact</span><strong>{supplier.contactPerson || '-'}</strong></div>
                  <div><span>Phone</span><strong>{supplier.phone || '-'}</strong></div>
                  <div><span>Outstanding</span><strong className={outstanding(supplier.id) > 0 ? 'negative-text' : ''}>{currency(outstanding(supplier.id))}</strong></div>
                  <div><span>Opening balance</span><strong>{currency(supplier.openingBalance)}</strong></div>
                </div>
                <div className="entity-card-actions">
                  <button className="button secondary small" onClick={() => openEdit(supplier)}><Pencil size={15} /> Edit</button>
                  <button className="icon-button danger" onClick={() => requestDelete(supplier)} aria-label={`Delete ${supplier.name}`}><Trash2 size={16} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal open={open} title={data.suppliers.some((supplier) => supplier.id === draft.id) ? 'Edit supplier' : 'Create supplier'} subtitle="Supplier details are linked with receipts, purchase bills and payments." onClose={() => setOpen(false)} wide>
        <form className="form-stack" onSubmit={submit}>
          {error && <div className="alert danger-alert">{error}</div>}
          <div className="form-grid two">
            <label><span>Supplier code *</span><input required value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} /></label>
            <label><span>Supplier name *</span><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label><span>Contact person *</span><input required value={draft.contactPerson} onChange={(event) => setDraft({ ...draft, contactPerson: event.target.value })} /></label>
            <label><span>Phone *</span><input required inputMode="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="9876543210" /></label>
            <label><span>Email</span><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
            <label><span>GSTIN *</span><input required maxLength={15} value={draft.gstin} onChange={(event) => setDraft({ ...draft, gstin: event.target.value.toUpperCase() })} placeholder="33ABCDE1234F1Z5" /></label>
            <label><span>Opening balance</span><input type="number" min="0" step="0.01" value={draft.openingBalance} onChange={(event) => setDraft({ ...draft, openingBalance: Number(event.target.value) })} /></label>
            <label><span>Status *</span><select required value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Supplier['status'] })}><option>Active</option><option>Inactive</option></select></label>
            <label className="span-2"><span>Address *</span><textarea required rows={3} value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
          </div>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="button primary">Save supplier</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
