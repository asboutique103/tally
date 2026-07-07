import { AlertTriangle, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { currency, downloadCsv, inventoryRows, number, uid } from '../lib/helpers';
import { cleanText, hasDuplicate, isFilled, isPositive, isValidHsn, isZeroOrPositive } from '../lib/validation';
import { useApp } from '../store/AppContext';
import type { InventoryRow, Material, Unit } from '../types';

const units: Unit[] = ['KG', 'Ltr', 'Pcs', 'Nos', 'Bag', 'Box', 'Cft', 'Sqft', 'Mtr', 'Load'];

const emptyMaterial = (): Material => ({
  id: uid('mat'),
  code: '',
  name: '',
  category: '',
  hsnCode: '',
  unit: 'Nos',
  standardRate: 0,
  taxRate: 18,
  reorderLevel: 0,
  openingStock: 0,
  location: '',
  createdAt: new Date().toISOString(),
});

const editableMaterial = (item: Material | InventoryRow): Material => ({
  id: item.id,
  code: item.code,
  name: item.name,
  category: item.category,
  hsnCode: item.hsnCode ?? '',
  unit: item.unit,
  standardRate: item.standardRate,
  taxRate: item.taxRate,
  reorderLevel: item.reorderLevel,
  openingStock: item.openingStock,
  location: item.location,
  createdAt: item.createdAt,
});

export function Materials() {
  const { data, upsertMaterial, deleteMaterial } = useApp();
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Material>(emptyMaterial());
  const [error, setError] = useState('');
  const inventory = inventoryRows(data);
  const filtered = useMemo(
    () => inventory.filter((item) => `${item.name} ${item.code} ${item.category} ${item.location}`.toLowerCase().includes(query.toLowerCase())),
    [inventory, query],
  );

  const openCreate = () => {
    setDraft({ ...emptyMaterial(), code: `MAT-${String(data.materials.length + 1).padStart(3, '0')}` });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (item: InventoryRow) => {
    setDraft(editableMaterial(item));
    setError('');
    setModalOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Material = {
      ...draft,
      code: cleanText(draft.code).toUpperCase(),
      name: cleanText(draft.name),
      category: cleanText(draft.category),
      hsnCode: cleanText(draft.hsnCode),
      location: cleanText(draft.location),
      standardRate: draft.standardRate || 0,
      taxRate: draft.taxRate || 0,
      reorderLevel: draft.reorderLevel || 0,
      openingStock: draft.openingStock || 0,
    };

    if (!isFilled(next.code) || !isFilled(next.name) || !isFilled(next.category) || !isFilled(next.hsnCode) || !isFilled(next.location)) {
      setError('Material code, name, category, HSN code and storage location are mandatory.');
      return;
    }
    if (!isValidHsn(next.hsnCode)) {
      setError('HSN code must be 4 to 8 digits.');
      return;
    }
    if (!isPositive(next.standardRate)) {
      setError('Standard rate must be greater than zero.');
      return;
    }
    if (!isZeroOrPositive(next.taxRate)) {
      setError('GST / tax percentage cannot be negative.');
      return;
    }
    if (!isPositive(next.reorderLevel)) {
      setError('Reorder level must be greater than zero so low-stock alerts can work.');
      return;
    }
    if (!isZeroOrPositive(next.openingStock)) {
      setError('Opening stock cannot be negative.');
      return;
    }
    if (hasDuplicate(data.materials, next.id, (material) => material.code.toUpperCase() === next.code)) {
      setError('Another material already uses this material code.');
      return;
    }

    upsertMaterial(next);
    setModalOpen(false);
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Inventory master"
        title="Materials & stock"
        description="Manage the construction material catalogue and monitor real-time central-store availability."
        actions={(
          <>
            <button className="button secondary" onClick={() => downloadCsv('materials-stock.csv', inventory.map((material) => ({
              Code: material.code,
              Material: material.name,
              Category: material.category,
              HSNCode: material.hsnCode ?? '',
              Unit: material.unit,
              GRNReceived: material.receivedQty,
              InvoicePurchased: material.purchasedQty,
              SiteSupplied: material.suppliedQty,
              InvoiceSold: material.soldQty,
              Available: material.availableQty,
              Rate: material.standardRate,
              Value: material.stockValue,
            })))}><Download size={17} /> Export</button>
            <button className="button primary" onClick={openCreate}><Plus size={17} /> New material</button>
          </>
        )}
      />

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
                  <td><strong>{item.name}</strong><span>{item.code} / HSN {item.hsnCode || '-'} / {item.location || 'No rack'}</span></td>
                  <td>{item.category}</td>
                  <td>{number(item.openingStock)} {item.unit}</td>
                  <td className="positive-text">+{number(item.receivedQty)} {item.unit}</td>
                  <td className="positive-text">+{number(item.purchasedQty)} {item.unit}</td>
                  <td className="negative-text">-{number(item.suppliedQty)} {item.unit}</td>
                  <td className="negative-text">-{number(item.soldQty)} {item.unit}</td>
                  <td><strong>{number(item.availableQty)} {item.unit}</strong></td>
                  <td>{currency(item.standardRate)}</td>
                  <td><strong>{currency(item.stockValue)}</strong></td>
                  <td><span className={`status-pill ${item.availableQty <= item.reorderLevel ? 'danger' : 'success'}`}>{item.availableQty <= item.reorderLevel && <AlertTriangle size={13} />}{item.availableQty <= item.reorderLevel ? 'Low stock' : 'Healthy'}</span></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`}><Pencil size={16} /></button>
                      <button className="icon-button danger" onClick={() => confirm(`Delete ${item.name}?`) && deleteMaterial(item.id)} aria-label={`Delete ${item.name}`}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={modalOpen} title={data.materials.some((item) => item.id === draft.id) ? 'Edit material' : 'Create material'} subtitle="Material master values are used across receipts, supplies, bills and GST invoice print." onClose={() => setModalOpen(false)} wide>
        <form onSubmit={submit} className="form-stack">
          {error && <div className="alert danger-alert">{error}</div>}
          <div className="form-grid three">
            <label><span>Material code *</span><input required value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} /></label>
            <label className="span-2"><span>Material name *</span><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label><span>Category *</span><input required value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Cement, Steel..." /></label>
            <label><span>HSN code *</span><input required inputMode="numeric" value={draft.hsnCode ?? ''} onChange={(event) => setDraft({ ...draft, hsnCode: event.target.value })} placeholder="72142090" /></label>
            <label><span>Unit *</span><select required value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value as Unit })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
            <label><span>Storage location *</span><input required value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Rack / yard" /></label>
            <label><span>Standard rate *</span><input required type="number" min="0.01" step="0.01" value={draft.standardRate} onChange={(event) => setDraft({ ...draft, standardRate: Number(event.target.value) })} /></label>
            <label><span>GST / tax % *</span><input required type="number" min="0" step="0.01" value={draft.taxRate} onChange={(event) => setDraft({ ...draft, taxRate: Number(event.target.value) })} /></label>
            <label><span>Reorder level *</span><input required type="number" min="0.01" step="0.01" value={draft.reorderLevel} onChange={(event) => setDraft({ ...draft, reorderLevel: Number(event.target.value) })} /></label>
            <label><span>Opening stock *</span><input required type="number" min="0" step="0.01" value={draft.openingStock} onChange={(event) => setDraft({ ...draft, openingStock: Number(event.target.value) })} /></label>
          </div>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="button primary">Save material</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
