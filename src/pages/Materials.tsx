import { AlertTriangle, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { currency, downloadCsv, inventoryRows, number, uid } from '../lib/helpers';
import { useApp } from '../store/AppContext';
import type { Material, Unit } from '../types';

const units: Unit[] = ['KG', 'Ltr', 'Pcs', 'Nos', 'Bag', 'Box', 'Cft', 'Sqft', 'Mtr', 'Load'];

const emptyMaterial = (): Material => ({ id: uid('mat'), code: '', name: '', category: '', hsnCode: '', unit: 'Nos', standardRate: 0, taxRate: 18, reorderLevel: 0, openingStock: 0, location: '', createdAt: new Date().toISOString() });

export function Materials() {
  const { data, upsertMaterial, deleteMaterial } = useApp();
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Material>(emptyMaterial());
  const inventory = inventoryRows(data);
  const filtered = useMemo(() => inventory.filter((item) => `${item.name} ${item.code} ${item.category} ${item.location}`.toLowerCase().includes(query.toLowerCase())), [inventory, query]);

  const openCreate = () => {
    setDraft({ ...emptyMaterial(), code: `MAT-${String(data.materials.length + 1).padStart(3, '0')}` });
    setModalOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    upsertMaterial(draft);
    setModalOpen(false);
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Inventory master" title="Materials & stock" description="Manage the material catalogue and monitor real-time central-store availability." actions={<><button className="button secondary" onClick={() => downloadCsv('materials-stock.csv', inventory.map((m) => ({ Code: m.code, Material: m.name, Category: m.category, HSNCode: m.hsnCode ?? '', Unit: m.unit, GRNReceived: m.receivedQty, InvoicePurchased: m.purchasedQty, SiteSupplied: m.suppliedQty, InvoiceSold: m.soldQty, Available: m.availableQty, Rate: m.standardRate, Value: m.stockValue })))}><Download size={17} /> Export</button><button className="button primary" onClick={openCreate}><Plus size={17} /> New material</button></>} />

      <section className="panel table-panel">
        <div className="table-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search material, code, category or rack..." />
          <div className="toolbar-summary"><strong>{filtered.length}</strong><span>materials</span></div>
        </div>
        {filtered.length === 0 ? <EmptyState title="No materials found" description="Create a material or change your search filters." action={<button className="button primary" onClick={openCreate}><Plus size={17} /> Add material</button>} /> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Material</th><th>Category</th><th>Opening</th><th>GRN inward</th><th>Invoice inward</th><th>Site issue</th><th>Invoice outward</th><th>Available</th><th>Rate</th><th>Stock value</th><th>Status</th><th /></tr></thead>
              <tbody>{filtered.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong><span>{item.code} · HSN {item.hsnCode || '—'} · {item.location || 'No rack'}</span></td>
                  <td>{item.category}</td><td>{number(item.openingStock)} {item.unit}</td><td className="positive-text">+{number(item.receivedQty)} {item.unit}</td><td className="positive-text">+{number(item.purchasedQty)} {item.unit}</td><td className="negative-text">-{number(item.suppliedQty)} {item.unit}</td><td className="negative-text">-{number(item.soldQty)} {item.unit}</td><td><strong>{number(item.availableQty)} {item.unit}</strong></td><td>{currency(item.standardRate)}</td><td><strong>{currency(item.stockValue)}</strong></td>
                  <td><span className={`status-pill ${item.availableQty <= item.reorderLevel ? 'danger' : 'success'}`}>{item.availableQty <= item.reorderLevel && <AlertTriangle size={13} />}{item.availableQty <= item.reorderLevel ? 'Low stock' : 'Healthy'}</span></td>
                  <td><div className="row-actions"><button className="icon-button" onClick={() => { setDraft(item); setModalOpen(true); }}><Pencil size={16} /></button><button className="icon-button danger" onClick={() => confirm(`Delete ${item.name}?`) && deleteMaterial(item.id)}><Trash2 size={16} /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={modalOpen} title={data.materials.some((item) => item.id === draft.id) ? 'Edit material' : 'Create material'} subtitle="Material master values are used across receipts, supplies and bills." onClose={() => setModalOpen(false)} wide>
        <form onSubmit={submit} className="form-stack">
          <div className="form-grid three">
            <label><span>Material code *</span><input required value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></label>
            <label className="span-2"><span>Material name *</span><input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label><span>Category *</span><input required value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Cement, Steel..." /></label>
            <label><span>HSN code</span><input value={draft.hsnCode ?? ''} onChange={(e) => setDraft({ ...draft, hsnCode: e.target.value })} placeholder="72142090" /></label>
            <label><span>Unit *</span><select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as Unit })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
            <label><span>Storage location</span><input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Rack / yard" /></label>
            <label><span>Standard rate</span><input type="number" min="0" step="0.01" value={draft.standardRate} onChange={(e) => setDraft({ ...draft, standardRate: Number(e.target.value) })} /></label>
            <label><span>GST / tax %</span><input type="number" min="0" step="0.01" value={draft.taxRate} onChange={(e) => setDraft({ ...draft, taxRate: Number(e.target.value) })} /></label>
            <label><span>Reorder level</span><input type="number" min="0" step="0.01" value={draft.reorderLevel} onChange={(e) => setDraft({ ...draft, reorderLevel: Number(e.target.value) })} /></label>
            <label><span>Opening stock</span><input type="number" min="0" step="0.01" value={draft.openingStock} onChange={(e) => setDraft({ ...draft, openingStock: Number(e.target.value) })} /></label>
          </div>
          <div className="form-actions"><button type="button" className="button secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="button primary">Save material</button></div>
        </form>
      </Modal>
    </div>
  );
}
