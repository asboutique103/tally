import { Plus, Trash2 } from 'lucide-react';
import { NumberField } from './NumberField';
import { uid } from '../lib/helpers';
import type { Material, TransactionItem } from '../types';

const isSteel = (material: Material | undefined) => (material?.category ?? '').trim().toLowerCase() === 'steel';

export function TransactionItemsEditor({ materials, items, onChange, showTax = true, steelCalc = false }: { materials: Material[]; items: TransactionItem[]; onChange: (items: TransactionItem[]) => void; showTax?: boolean; steelCalc?: boolean }) {
  const update = (id: string, patch: Partial<TransactionItem>) => onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const remove = (id: string) => onChange(items.filter((item) => item.id !== id));
  const add = () => {
    const first = materials[0];
    if (!first) return;
    const steelDefault = steelCalc && isSteel(first);
    onChange([...items, { id: uid('item'), materialId: first.id, quantity: steelDefault ? 0 : 1, rate: first.standardRate ?? 0, taxRate: 0 }]);
  };

  const updateSteel = (item: TransactionItem, patch: Partial<Pick<TransactionItem, 'steelSizeMm' | 'steelBundles' | 'steelKgPerBundle'>>) => {
    const next = { ...item, ...patch };
    const bundles = next.steelBundles ?? 0;
    const kgPerBundle = next.steelKgPerBundle ?? 0;
    update(item.id, { ...patch, quantity: bundles && kgPerBundle ? Math.round(bundles * kgPerBundle * 100) / 100 : item.quantity });
  };

  return (
    <div className="items-editor">
      <div className="section-title-row">
        <div>
          <h3>Material line items</h3>
          <p>Add one or more materials to this document.</p>
        </div>
        <button type="button" className="button secondary small" onClick={add}><Plus size={16} /> Add material</button>
      </div>
      <div className="items-table-wrap">
        <table className="items-table">
          <thead><tr><th>Material</th><th>Qty</th><th>Rate</th>{showTax && <th>Tax %</th>}<th>Amount</th><th /></tr></thead>
          <tbody>
            {items.map((item) => {
              const material = materials.find((entry) => entry.id === item.materialId);
              const steel = steelCalc && isSteel(material);
              return (
                <tr key={item.id}>
                  <td>
                    <select value={item.materialId} onChange={(event) => {
                      const selected = materials.find((candidate) => candidate.id === event.target.value);
                      const becomesSteel = steelCalc && isSteel(selected);
                      update(item.id, {
                        materialId: event.target.value,
                        rate: selected?.standardRate ?? item.rate,
                        // Switching material clears any previous steel calc so a stale mm/bundle figure can't carry over silently.
                        steelSizeMm: undefined,
                        steelBundles: undefined,
                        steelKgPerBundle: undefined,
                        quantity: becomesSteel ? 0 : item.quantity,
                      });
                    }}>
                      {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry.unit})</option>)}
                    </select>
                  </td>
                  <td>
                    {steel ? (
                      <div className="steel-calc">
                        <div className="steel-calc-inputs">
                          <label><span>mm</span><NumberField min="0" step="0.1" placeholder="mm" value={item.steelSizeMm} onChange={(value) => updateSteel(item, { steelSizeMm: value })} /></label>
                          <label><span>Bundles</span><NumberField min="0" step="1" placeholder="bundles" value={item.steelBundles} onChange={(value) => updateSteel(item, { steelBundles: value })} /></label>
                          <label><span>Kg/bundle</span><NumberField min="0" step="0.01" placeholder="kg" value={item.steelKgPerBundle} onChange={(value) => updateSteel(item, { steelKgPerBundle: value })} /></label>
                        </div>
                        <div className="steel-calc-total">= <strong>{item.quantity || 0} kg</strong>{!item.quantity && <span className="steel-calc-warning"> — enter bundles &amp; kg/bundle</span>}</div>
                      </div>
                    ) : (
                      <NumberField min="0.01" step="0.01" value={item.quantity} onChange={(value) => update(item.id, { quantity: value ?? 0 })} />
                    )}
                  </td>
                  <td><NumberField min="0" step="0.01" value={item.rate} onChange={(value) => update(item.id, { rate: value ?? 0 })} /></td>
                  {showTax && <td><NumberField min="0" step="0.01" value={item.taxRate} onChange={(value) => update(item.id, { taxRate: value ?? 0 })} /></td>}
                  <td className="amount-cell">₹{(item.quantity * item.rate * (1 + (showTax ? item.taxRate / 100 : 0))).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td><button className="icon-button danger" type="button" onClick={() => remove(item.id)} disabled={items.length === 1}><Trash2 size={16} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
