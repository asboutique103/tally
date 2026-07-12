import { Plus, Trash2 } from 'lucide-react';
import { uid } from '../lib/helpers';
import type { Material, TransactionItem } from '../types';

export function TransactionItemsEditor({ materials, items, onChange, showTax = true }: { materials: Material[]; items: TransactionItem[]; onChange: (items: TransactionItem[]) => void; showTax?: boolean }) {
  const update = (id: string, patch: Partial<TransactionItem>) => onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const remove = (id: string) => onChange(items.filter((item) => item.id !== id));
  const add = () => {
    const first = materials[0];
    if (!first) return;
    onChange([...items, { id: uid('item'), materialId: first.id, quantity: 1, rate: first.standardRate ?? 0, taxRate: 0 }]);
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
              return (
                <tr key={item.id}>
                  <td>
                    <select value={item.materialId} onChange={(event) => {
                      const selected = materials.find((candidate) => candidate.id === event.target.value);
                      update(item.id, { materialId: event.target.value, rate: selected?.standardRate ?? item.rate });
                    }}>
                      {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry.unit})</option>)}
                    </select>
                  </td>
                  <td><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => update(item.id, { quantity: Number(event.target.value) })} /></td>
                  <td><input type="number" min="0" step="0.01" value={item.rate} onChange={(event) => update(item.id, { rate: Number(event.target.value) })} /></td>
                  {showTax && <td><input type="number" min="0" step="0.01" value={item.taxRate} onChange={(event) => update(item.id, { taxRate: Number(event.target.value) })} /></td>}
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
