import { Download, Eye, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { TransactionItemsEditor } from '../components/TransactionItemsEditor';
import { currency, documentNo, downloadCsv, inventoryRows, itemsSubtotal, today, uid } from '../lib/helpers';
import { cleanText, hasDuplicate, hasValidItems, isFilled } from '../lib/validation';
import { useApp } from '../store/AppContext';
import type { Supply } from '../types';

export function Supplies() {
  const { data, addSupply, deleteSupply } = useApp();
  const stock = inventoryRows(data);
  const first = data.materials[0];
  const empty = (): Supply => ({
    id: uid('iss'),
    issueNo: documentNo('ISS', data.supplies.length),
    date: today(),
    siteId: data.sites[0]?.id ?? '',
    requestedBy: '',
    approvedBy: '',
    vehicleNo: '',
    driverName: '',
    items: [{ id: uid('si'), materialId: first?.id ?? '', quantity: 1, rate: first?.standardRate ?? 0, taxRate: first?.taxRate ?? 0 }],
    notes: '',
    createdAt: new Date().toISOString(),
  });

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Supply | null>(null);
  const [draft, setDraft] = useState<Supply>(empty());
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => data.supplies.filter((supply) => `${supply.issueNo} ${supply.vehicleNo} ${supply.requestedBy} ${data.sites.find((site) => site.id === supply.siteId)?.name}`.toLowerCase().includes(query.toLowerCase())),
    [data.supplies, data.sites, query],
  );

  const openCreate = () => {
    setDraft(empty());
    setError('');
    setOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Supply = {
      ...draft,
      issueNo: cleanText(draft.issueNo).toUpperCase(),
      requestedBy: cleanText(draft.requestedBy),
      approvedBy: cleanText(draft.approvedBy),
      vehicleNo: cleanText(draft.vehicleNo).toUpperCase(),
      driverName: cleanText(draft.driverName),
      notes: cleanText(draft.notes),
    };

    if (!isFilled(next.issueNo) || !isFilled(next.date) || !isFilled(next.siteId) || !isFilled(next.requestedBy) || !isFilled(next.approvedBy) || !isFilled(next.vehicleNo) || !isFilled(next.driverName) || !isFilled(next.notes)) {
      setError('Issue number, date, site, requester, approver, vehicle, driver and purpose are mandatory.');
      return;
    }
    if (!hasValidItems(next.items)) {
      setError('Add at least one material line with material, quantity, rate and tax.');
      return;
    }
    if (hasDuplicate(data.supplies, next.id, (supply) => supply.issueNo.toUpperCase() === next.issueNo)) {
      setError('Another material issue already uses this issue number.');
      return;
    }

    const invalid = next.items.find((item) => item.quantity > (stock.find((row) => row.id === item.materialId)?.availableQty ?? 0));
    if (invalid && data.settings.strictStockControl) {
      const material = data.materials.find((item) => item.id === invalid.materialId);
      setError(`Insufficient stock for ${material?.name ?? 'material'}. Available: ${stock.find((row) => row.id === invalid.materialId)?.availableQty ?? 0} ${material?.unit ?? ''}.`);
      return;
    }

    addSupply(next);
    setOpen(false);
    setError('');
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Site dispatch"
        title="Material supplied"
        description="Issue materials to construction sites with approvals, vehicles, drivers and stock validation."
        actions={(
          <>
            <button className="button secondary" onClick={() => downloadCsv('material-supplies.csv', filtered.map((supply) => ({
              Issue: supply.issueNo,
              Date: supply.date,
              Site: data.sites.find((site) => site.id === supply.siteId)?.name,
              RequestedBy: supply.requestedBy,
              Vehicle: supply.vehicleNo,
              Value: itemsSubtotal(supply.items),
            })))}><Download size={17} /> Export</button>
            <button className="button primary" disabled={!data.sites.length || !data.materials.length} onClick={openCreate}><Plus size={17} /> Supply material</button>
          </>
        )}
      />

      <section className="panel table-panel">
        <div className="table-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search issue, site, requester or vehicle..." />
          <div className="toolbar-summary"><strong>{filtered.length}</strong><span>issues</span></div>
        </div>
        {filtered.length === 0 ? <EmptyState title="No site issues found" description="Create an issue note when material leaves the central store." action={<button className="button primary" disabled={!data.sites.length || !data.materials.length} onClick={openCreate}><Plus size={17} /> Supply material</button>} /> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Issue note</th><th>Date</th><th>Site</th><th>Request / approval</th><th>Dispatch</th><th>Items</th><th>Material value</th><th /></tr></thead>
              <tbody>{filtered.map((supply) => (
                <tr key={supply.id}>
                  <td><strong>{supply.issueNo}</strong><span>{supply.notes || 'Site material issue'}</span></td>
                  <td>{new Date(supply.date).toLocaleDateString('en-IN')}</td>
                  <td><strong>{data.sites.find((site) => site.id === supply.siteId)?.name || '-'}</strong><span>{data.sites.find((site) => site.id === supply.siteId)?.location}</span></td>
                  <td><strong>{supply.requestedBy || '-'}</strong><span>Approved: {supply.approvedBy || '-'}</span></td>
                  <td><strong>{supply.vehicleNo || '-'}</strong><span>{supply.driverName || 'No driver'}</span></td>
                  <td>{supply.items.length}</td>
                  <td><strong>{currency(itemsSubtotal(supply.items))}</strong></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" onClick={() => setView(supply)} aria-label={`View ${supply.issueNo}`}><Eye size={16} /></button>
                      <button className="icon-button danger" onClick={() => confirm(`Delete ${supply.issueNo}? Stock will be restored.`) && deleteSupply(supply.id)} aria-label={`Delete ${supply.issueNo}`}><Trash2 size={16} /></button>
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
            <label><span>Requested by *</span><input required value={draft.requestedBy} onChange={(event) => setDraft({ ...draft, requestedBy: event.target.value })} /></label>
            <label><span>Approved by *</span><input required value={draft.approvedBy} onChange={(event) => setDraft({ ...draft, approvedBy: event.target.value })} /></label>
            <label><span>Vehicle no. *</span><input required value={draft.vehicleNo} onChange={(event) => setDraft({ ...draft, vehicleNo: event.target.value.toUpperCase() })} /></label>
            <label><span>Driver name *</span><input required value={draft.driverName} onChange={(event) => setDraft({ ...draft, driverName: event.target.value })} /></label>
          </div>
          <TransactionItemsEditor materials={data.materials} items={draft.items} onChange={(items) => setDraft({ ...draft, items })} />
          <div className="stock-hint-grid">
            {draft.items.map((item) => {
              const material = stock.find((row) => row.id === item.materialId);
              return <span key={item.id}>{material?.name}: <strong>{material?.availableQty} {material?.unit} available</strong></span>;
            })}
          </div>
          <label><span>Notes / purpose *</span><textarea required rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Example: Block A slab work" /></label>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="button primary">Save issue & deduct stock</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(view)} title={view?.issueNo ?? 'Issue'} subtitle="Site material issue details" onClose={() => setView(null)} wide>
        {view && (
          <div className="document-view">
            <div className="document-meta">
              <div><span>Site</span><strong>{data.sites.find((site) => site.id === view.siteId)?.name}</strong></div>
              <div><span>Date</span><strong>{new Date(view.date).toLocaleDateString('en-IN')}</strong></div>
              <div><span>Requested</span><strong>{view.requestedBy || '-'}</strong></div>
              <div><span>Approved</span><strong>{view.approvedBy || '-'}</strong></div>
            </div>
            <table className="items-table">
              <thead><tr><th>Material</th><th>Qty</th><th>Rate</th><th>Value</th></tr></thead>
              <tbody>{view.items.map((item) => (
                <tr key={item.id}>
                  <td>{data.materials.find((material) => material.id === item.materialId)?.name}</td>
                  <td>{item.quantity} {data.materials.find((material) => material.id === item.materialId)?.unit}</td>
                  <td>{currency(item.rate)}</td>
                  <td>{currency(item.quantity * item.rate)}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="document-total"><strong>Material value {currency(itemsSubtotal(view.items))}</strong></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
