import { Download, Eye, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { TransactionItemsEditor } from '../components/TransactionItemsEditor';
import { currency, downloadCsv, nextDocumentNo, receiptTotal, today, uid } from '../lib/helpers';
import { cleanText, hasDuplicate, hasValidItems, isFilled } from '../lib/validation';
import { useApp } from '../store/AppContext';
import type { Receipt, TransactionItem } from '../types';

const makeItems = (materialId = '', rate = 0): TransactionItem[] => [{ id: uid('ri'), materialId, quantity: 1, rate, taxRate: 0 }];

export function Receipts() {
  const { data, addReceipt, deleteReceipt } = useApp();
  const firstMaterial = data.materials[0];
  const empty = (): Receipt => ({
    id: uid('rec'),
    receiptNo: nextDocumentNo('GRN', data.receipts.map((receipt) => receipt.receiptNo)),
    date: today(),
    supplierId: data.suppliers[0]?.id ?? '',
    invoiceNo: '',
    vehicleNo: '',
    destination: 'Central Store',
    siteId: undefined,
    items: makeItems(firstMaterial?.id, firstMaterial?.standardRate),
    notes: '',
    createdAt: new Date().toISOString(),
  });

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Receipt | null>(null);
  const [draft, setDraft] = useState<Receipt>(empty());
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => data.receipts.filter((receipt) => `${receipt.receiptNo} ${receipt.invoiceNo} ${receipt.vehicleNo} ${data.suppliers.find((supplier) => supplier.id === receipt.supplierId)?.name}`.toLowerCase().includes(query.toLowerCase())),
    [data.receipts, data.suppliers, query],
  );

  const openCreate = () => {
    setDraft(empty());
    setError('');
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Receipt = {
      ...draft,
      receiptNo: cleanText(draft.receiptNo).toUpperCase(),
      invoiceNo: cleanText(draft.invoiceNo).toUpperCase(),
      vehicleNo: cleanText(draft.vehicleNo).toUpperCase(),
      notes: cleanText(draft.notes),
      siteId: draft.destination === 'Direct to Site' ? draft.siteId : undefined,
    };

    if (!isFilled(next.receiptNo) || !isFilled(next.date) || !isFilled(next.supplierId) || !isFilled(next.invoiceNo) || !isFilled(next.vehicleNo)) {
      setError('GRN number, date, supplier, supplier invoice and vehicle number are mandatory.');
      return;
    }
    if (next.destination === 'Direct to Site' && !isFilled(next.siteId)) {
      setError('Select the construction site for a direct-to-site receipt.');
      return;
    }
    if (!hasValidItems(next.items)) {
      setError('Add at least one material line with material, quantity and rate.');
      return;
    }
    if (hasDuplicate(data.receipts, next.id, (receipt) => receipt.receiptNo.toUpperCase() === next.receiptNo)) {
      setError('Another GRN already uses this receipt number.');
      return;
    }
    if (data.receipts.some((receipt) => receipt.supplierId === next.supplierId && receipt.invoiceNo.toUpperCase() === next.invoiceNo)) {
      setError('This supplier invoice number is already recorded in a GRN.');
      return;
    }

    try {
      await addReceipt(next);
      setOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Receipt could not be saved.');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Goods inward"
        title="Material received"
        description="Record supplier deliveries, GRNs, invoice references, vehicles and direct-to-site receipts."
        actions={(
          <>
            <button className="button secondary" onClick={() => downloadCsv('material-receipts.csv', filtered.map((receipt) => ({
              GRN: receipt.receiptNo,
              Date: receipt.date,
              Supplier: data.suppliers.find((supplier) => supplier.id === receipt.supplierId)?.name,
              Invoice: receipt.invoiceNo,
              Vehicle: receipt.vehicleNo,
              Destination: receipt.destination,
              Value: receiptTotal(receipt),
            })))}><Download size={17} /> Export</button>
            <button className="button primary" disabled={!data.suppliers.length || !data.materials.length} onClick={openCreate}><Plus size={17} /> Receive material</button>
          </>
        )}
      />

      <section className="panel table-panel">
        <div className="table-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search GRN, supplier, invoice or vehicle..." />
          <div className="toolbar-summary"><strong>{filtered.length}</strong><span>receipts</span></div>
        </div>
        {filtered.length === 0 ? <EmptyState title="No receipts found" description="Record a GRN when materials arrive from a supplier." action={<button className="button primary" disabled={!data.suppliers.length || !data.materials.length} onClick={openCreate}><Plus size={17} /> Receive material</button>} /> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>GRN</th><th>Date</th><th>Supplier</th><th>Invoice / vehicle</th><th>Destination</th><th>Items</th><th>Total value</th><th /></tr></thead>
              <tbody>{filtered.map((receipt) => (
                <tr key={receipt.id}>
                  <td><strong>{receipt.receiptNo}</strong></td>
                  <td>{new Date(receipt.date).toLocaleDateString('en-IN')}</td>
                  <td>{data.suppliers.find((supplier) => supplier.id === receipt.supplierId)?.name || '-'}</td>
                  <td><strong>{receipt.invoiceNo || 'No invoice'}</strong><span>{receipt.vehicleNo || 'No vehicle'}</span></td>
                  <td><span className="soft-badge">{receipt.destination}</span>{receipt.siteId && <span>{data.sites.find((site) => site.id === receipt.siteId)?.name}</span>}</td>
                  <td>{receipt.items.length}</td>
                  <td><strong>{currency(receiptTotal(receipt))}</strong></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" onClick={() => setView(receipt)} aria-label={`View ${receipt.receiptNo}`}><Eye size={16} /></button>
                      <button className="icon-button danger" onClick={() => { if (confirm(`Delete ${receipt.receiptNo}? Stock will be recalculated.`)) void deleteReceipt(receipt.id).catch(() => undefined); }} aria-label={`Delete ${receipt.receiptNo}`}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={open} title="Receive material" subtitle="Create a goods receipt note. Stock increases immediately after saving." onClose={() => setOpen(false)} wide>
        <form className="form-stack" onSubmit={submit}>
          {error && <div className="alert danger-alert">{error}</div>}
          <div className="form-grid three">
            <label><span>GRN number *</span><input required value={draft.receiptNo} onChange={(event) => setDraft({ ...draft, receiptNo: event.target.value.toUpperCase() })} /></label>
            <label><span>Receipt date *</span><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
            <label><span>Supplier *</span><select required value={draft.supplierId} onChange={(event) => setDraft({ ...draft, supplierId: event.target.value })}><option value="">Select supplier</option>{data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            <label><span>Supplier invoice no. *</span><input required value={draft.invoiceNo} onChange={(event) => setDraft({ ...draft, invoiceNo: event.target.value.toUpperCase() })} /></label>
            <label><span>Vehicle no. *</span><input required value={draft.vehicleNo} onChange={(event) => setDraft({ ...draft, vehicleNo: event.target.value.toUpperCase() })} /></label>
            <label><span>Destination *</span><select required value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value as Receipt['destination'], siteId: event.target.value === 'Central Store' ? undefined : draft.siteId })}><option>Central Store</option><option>Direct to Site</option></select></label>
            {draft.destination === 'Direct to Site' && <label className="span-2"><span>Site *</span><select required value={draft.siteId ?? ''} onChange={(event) => setDraft({ ...draft, siteId: event.target.value })}><option value="">Select site</option>{data.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>}
          </div>
          <TransactionItemsEditor materials={data.materials} items={draft.items} onChange={(items) => setDraft({ ...draft, items })} showTax={false} steelCalc />
          <div className="document-total"><strong>Total {currency(receiptTotal(draft))}</strong></div>
          <label><span>Notes</span><textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="button primary">Save GRN & update stock</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(view)} title={view?.receiptNo ?? 'Receipt'} subtitle="Goods receipt details" onClose={() => setView(null)} wide>
        {view && (
          <div className="document-view">
            <div className="document-meta">
              <div><span>Supplier</span><strong>{data.suppliers.find((supplier) => supplier.id === view.supplierId)?.name}</strong></div>
              <div><span>Date</span><strong>{new Date(view.date).toLocaleDateString('en-IN')}</strong></div>
              <div><span>Invoice</span><strong>{view.invoiceNo || '-'}</strong></div>
              <div><span>Vehicle</span><strong>{view.vehicleNo || '-'}</strong></div>
            </div>
            <table className="items-table">
              <thead><tr><th>Material</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
              <tbody>{view.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {data.materials.find((material) => material.id === item.materialId)?.name}
                    {item.steelBundles && item.steelKgPerBundle ? (
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>
                        {item.steelSizeMm ? `${item.steelSizeMm}mm · ` : ''}{item.steelBundles} bundles × {item.steelKgPerBundle}kg
                      </span>
                    ) : null}
                  </td>
                  <td>{item.quantity} {data.materials.find((material) => material.id === item.materialId)?.unit}</td>
                  <td>{currency(item.rate)}</td>
                  <td>{currency(item.quantity * item.rate)}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="document-total"><strong>Total {currency(receiptTotal(view))}</strong></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
