import { Download, Eye, Plus, Printer, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { TransactionItemsEditor } from '../components/TransactionItemsEditor';
import {
  amountInIndianWords, currency, downloadCsv, gstAmount, inventoryRows, nextDocumentNo,
  stockShortage, supplyTotal, taxableAmount, today, uid,
} from '../lib/helpers';
import { cleanText, hasDuplicate, hasValidItems, isFilled } from '../lib/validation';
import { useApp } from '../store/AppContext';
import type { Supply } from '../types';

const formatDate = (value: string) => value ? new Date(value).toLocaleDateString('en-IN') : '—';
const numberForInvoice = (value: number) => (value || 0).toLocaleString('en-IN', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 });

export function Supplies() {
  const { data, addSupply, deleteSupply } = useApp();
  const stock = inventoryRows(data);
  const first = data.materials[0];
  const empty = (): Supply => ({
    id: uid('iss'),
    issueNo: nextDocumentNo('ISS', data.supplies.map((supply) => supply.issueNo)),
    date: today(),
    siteId: data.sites[0]?.id ?? '',
    items: [{ id: uid('si'), materialId: first?.id ?? '', quantity: 1, rate: first?.standardRate ?? 0, taxRate: 0 }],
    notes: '',
    gstEnabled: false,
    gstRate: data.settings.defaultTaxRate || 18,
    createdAt: new Date().toISOString(),
  });

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Supply | null>(null);
  const [draft, setDraft] = useState<Supply>(empty());
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => data.supplies.filter((supply) => `${supply.issueNo} ${data.sites.find((site) => site.id === supply.siteId)?.name}`.toLowerCase().includes(query.toLowerCase())),
    [data.supplies, data.sites, query],
  );

  const openCreate = () => {
    setDraft(empty());
    setError('');
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Supply = {
      ...draft,
      issueNo: cleanText(draft.issueNo).toUpperCase(),
      notes: cleanText(draft.notes),
      gstRate: draft.gstEnabled ? (draft.gstRate || 0) : 0,
    };

    if (!isFilled(next.issueNo) || !isFilled(next.date) || !isFilled(next.siteId)) {
      setError('Issue number, date and site are mandatory.');
      return;
    }
    if (!hasValidItems(next.items)) {
      setError('Add at least one material line with material, quantity and rate.');
      return;
    }
    if (hasDuplicate(data.supplies, next.id, (supply) => supply.issueNo.toUpperCase() === next.issueNo)) {
      setError('Another material issue already uses this issue number.');
      return;
    }

    const shortage = stockShortage(next.items, stock);
    if (shortage && data.settings.strictStockControl) {
      const [materialId] = shortage;
      const material = data.materials.find((item) => item.id === materialId);
      setError(`Insufficient stock for ${material?.name ?? 'material'}. Available: ${stock.find((row) => row.id === materialId)?.availableQty ?? 0} ${material?.unit ?? ''}.`);
      return;
    }

    try {
      await addSupply(next);
      setOpen(false);
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Issue could not be saved.');
    }
  };

  const printSupply = (supply: Supply) => {
    setView(supply);
    setTimeout(() => window.print(), 120);
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Site dispatch"
        title="Material supplied"
        description="Issue materials to construction sites, optionally with GST, and print a dispatch invoice."
        actions={(
          <>
            <button className="button secondary" onClick={() => downloadCsv('material-supplies.csv', filtered.map((supply) => ({
              Issue: supply.issueNo,
              Date: supply.date,
              Site: data.sites.find((site) => site.id === supply.siteId)?.name,
              GST: supply.gstEnabled ? `${supply.gstRate}%` : 'No GST',
              Value: supplyTotal(supply),
            })))}><Download size={17} /> Export</button>
            <button className="button primary" disabled={!data.sites.length || !data.materials.length} onClick={openCreate}><Plus size={17} /> Supply material</button>
          </>
        )}
      />

      <section className="panel table-panel">
        <div className="table-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search issue note or site..." />
          <div className="toolbar-summary"><strong>{filtered.length}</strong><span>issues</span></div>
        </div>
        {filtered.length === 0 ? <EmptyState title="No site issues found" description="Create an issue note when material leaves the central store." action={<button className="button primary" disabled={!data.sites.length || !data.materials.length} onClick={openCreate}><Plus size={17} /> Supply material</button>} /> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Issue note</th><th>Date</th><th>Site</th><th>Items</th><th>GST</th><th>Total value</th><th /></tr></thead>
              <tbody>{filtered.map((supply) => (
                <tr key={supply.id}>
                  <td><strong>{supply.issueNo}</strong><span>{supply.notes || 'Site material issue'}</span></td>
                  <td>{new Date(supply.date).toLocaleDateString('en-IN')}</td>
                  <td><strong>{data.sites.find((site) => site.id === supply.siteId)?.name || '-'}</strong><span>{data.sites.find((site) => site.id === supply.siteId)?.location}</span></td>
                  <td>{supply.items.length}</td>
                  <td><span className={`soft-badge ${supply.gstEnabled ? '' : 'warning-badge'}`}>{supply.gstEnabled ? `${supply.gstRate}% GST` : 'No GST'}</span></td>
                  <td><strong>{currency(supplyTotal(supply))}</strong></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" onClick={() => setView(supply)} aria-label={`View ${supply.issueNo}`}><Eye size={16} /></button>
                      <button className="icon-button" onClick={() => printSupply(supply)} aria-label={`Print ${supply.issueNo}`}><Printer size={16} /></button>
                      <button className="icon-button danger" onClick={() => { if (confirm(`Delete ${supply.issueNo}? Stock will be restored.`)) void deleteSupply(supply.id).catch(() => undefined); }} aria-label={`Delete ${supply.issueNo}`}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={open} title="Supply material to site" subtitle="Stock is checked before the site issue note is saved." onClose={() => setOpen(false)} wide>
        <form className="form-stack" onSubmit={submit}>
          {error && <div className="alert danger-alert">{error}</div>}
          <div className="form-grid three">
            <label><span>Issue number *</span><input required value={draft.issueNo} onChange={(event) => setDraft({ ...draft, issueNo: event.target.value.toUpperCase() })} /></label>
            <label><span>Issue date *</span><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
            <label><span>Site *</span><select required value={draft.siteId} onChange={(event) => setDraft({ ...draft, siteId: event.target.value })}><option value="">Select site</option>{data.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          </div>
          <TransactionItemsEditor materials={data.materials} items={draft.items} onChange={(items) => setDraft({ ...draft, items })} showTax={false} />
          <div className="stock-hint-grid">
            {draft.items.map((item) => {
              const material = stock.find((row) => row.id === item.materialId);
              return <span key={item.id}>{material?.name}: <strong>{material?.availableQty} {material?.unit} available</strong></span>;
            })}
          </div>
          <div className="form-grid three">
            <label className="toggle-label span-2"><input type="checkbox" checked={draft.gstEnabled} onChange={(event) => setDraft({ ...draft, gstEnabled: event.target.checked })} /><span><strong>Include GST on this issue</strong><small>Turn on if this site issue should be billed with GST.</small></span></label>
            {draft.gstEnabled && <label><span>GST % *</span><input required type="number" min="0" step="0.01" value={draft.gstRate} onChange={(event) => setDraft({ ...draft, gstRate: Number(event.target.value) })} /></label>}
          </div>
          <div className="document-total">
            <span>Taxable amount {currency(taxableAmount(draft.items))}</span>
            {draft.gstEnabled && <span>GST {currency(gstAmount(draft.items, draft.gstEnabled, draft.gstRate))}</span>}
            <strong>Total {currency(supplyTotal(draft))}</strong>
          </div>
          <label><span>Notes / purpose</span><textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Example: Block A slab work" /></label>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="button primary">Save issue & deduct stock</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(view)} title={view?.issueNo ?? 'Issue'} subtitle="Print-ready site issue invoice" onClose={() => setView(null)} wide>
        {view && (() => {
          const site = data.sites.find((candidate) => candidate.id === view.siteId);
          const taxable = taxableAmount(view.items);
          const gst = gstAmount(view.items, view.gstEnabled, view.gstRate);
          const grandTotal = supplyTotal(view);
          return (
            <div className="vmv-invoice">
              <div className="vmv-company-box">
                <img src="/logo.png" alt="Company logo" className="vmv-logo" />
                <h1>{data.settings.companyName}</h1>
                <p>{data.settings.address}</p>
                <div><strong>GST NO :</strong><span>{data.settings.gstin || '—'}</span><strong>PH NO –</strong><span>{data.settings.phone || '—'}</span></div>
              </div>
              <div className="vmv-title">MATERIAL SUPPLY INVOICE</div>
              <div className="vmv-party-grid">
                <div className="vmv-party-left">
                  <strong>SITE,</strong>
                  <h3>{site?.name ?? '—'}</h3>
                  <p>{site?.location || '—'}</p>
                  <p>{site?.clientName ? `Client: ${site.clientName}` : ''}</p>
                </div>
                <div className="vmv-party-right">
                  <p><strong>ISSUE NO</strong><span>: {view.issueNo}</span></p>
                  <p><strong>ISSUE DATE</strong><span>: {formatDate(view.date)}</span></p>
                  <p><strong>GST</strong><span>: {view.gstEnabled ? `${view.gstRate}%` : 'Not applicable'}</span></p>
                </div>
              </div>
              <table className="vmv-items">
                <thead><tr><th>SI.No</th><th>Particular</th><th>HSN CODE</th><th>Qty</th><th>Rate</th><th>Total<br />Amount</th></tr></thead>
                <tbody>
                  {view.items.map((item, index) => {
                    const material = data.materials.find((candidate) => candidate.id === item.materialId);
                    return (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td><strong>{material?.name ?? 'Material'}</strong></td>
                        <td>{material?.hsnCode || '-'}</td>
                        <td>{numberForInvoice(item.quantity)} {material?.unit ?? ''}</td>
                        <td>{numberForInvoice(item.rate)}</td>
                        <td>{numberForInvoice(item.quantity * item.rate)}</td>
                      </tr>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 6 - view.items.length) }, (_, index) => <tr key={`blank-${index}`}><td>&nbsp;</td><td /><td /><td /><td /><td /></tr>)}
                </tbody>
                <tfoot>
                  <tr><td colSpan={2} rowSpan={view.gstEnabled ? 4 : 2} className="vmv-words"><strong>Amount in word Rupees:</strong> {amountInIndianWords(grandTotal)}</td><td /><td colSpan={2}><strong>Taxable Amount</strong></td><td><strong>{numberForInvoice(taxable)}</strong></td></tr>
                  {view.gstEnabled && <tr><td /><td colSpan={2}><strong>CGST@{numberForInvoice(view.gstRate / 2)}%</strong></td><td><strong>{numberForInvoice(gst / 2)}</strong></td></tr>}
                  {view.gstEnabled && <tr><td /><td colSpan={2}><strong>SGST@{numberForInvoice(view.gstRate / 2)}%</strong></td><td><strong>{numberForInvoice(gst / 2)}</strong></td></tr>}
                  <tr><td /><td colSpan={2} className="vmv-grand"><strong>GRAND TOTAL</strong></td><td className="vmv-grand"><strong>{numberForInvoice(grandTotal)}</strong></td></tr>
                </tfoot>
              </table>
              <div className="vmv-footer">
                <div>
                  <h3>Bank Details</h3>
                  <p><strong>{data.settings.companyName}</strong></p>
                  <p>Our Bank Name: {data.settings.bankName || '—'}</p>
                  <p>Branch Name : {data.settings.bankBranch || '—'}</p>
                  <p>A/C No : {data.settings.bankAccountNo || '—'}</p>
                  <p>IFSC CODE : {data.settings.bankIfsc || '—'}</p>
                </div>
                <div className="vmv-sign"><strong>FOR {data.settings.companyName}</strong><span>Authorized Signatory</span></div>
              </div>
              <div className="form-actions no-print"><button className="button primary" onClick={() => window.print()}><Printer size={17} /> Print invoice</button></div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
