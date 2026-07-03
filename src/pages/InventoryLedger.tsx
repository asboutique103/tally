import { Download, PackageSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { currency, downloadCsv, number, stockMovements } from '../lib/helpers';
import { useApp } from '../store/AppContext';

export function InventoryLedger() {
  const { data } = useApp();
  const [materialId, setMaterialId] = useState(data.materials[0]?.id ?? '');
  const material = data.materials.find((entry) => entry.id === materialId);
  const movements = useMemo(() => stockMovements(data).filter((entry) => entry.materialId === materialId), [data, materialId]);
  let running = 0;
  const exportRows = () => downloadCsv('stock-ledger.csv', movements.map((entry) => ({ Date: entry.date, Document: entry.documentNo, Source: entry.source, Site: data.sites.find((site) => site.id === entry.siteId)?.name ?? '', Inward: entry.inward, Outward: entry.outward, Rate: entry.rate, Value: entry.value, Note: entry.note })));
  return <div className="page-stack">
    <PageHeader eyebrow="Perpetual inventory" title="Stock movement ledger" description="Trace every unit from opening stock, supplier receipt and purchase invoice through site issue or client invoice." actions={<button className="button primary" onClick={exportRows}><Download size={17}/> Export ledger</button>} />
    <section className="panel table-panel"><div className="table-toolbar split-toolbar"><label className="ledger-picker"><span>Material</span><select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>{data.materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.code} — {entry.name}</option>)}</select></label><div className="toolbar-summary"><strong>{material?.name}</strong><span>{material?.unit} · {material?.location}</span></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Date / document</th><th>Source</th><th>Site / note</th><th>Inward</th><th>Outward</th><th>Rate</th><th>Value</th><th>Running stock</th></tr></thead><tbody>{movements.map((entry) => { running += entry.inward - entry.outward; return <tr key={entry.id}><td><strong>{entry.documentNo}</strong><span>{new Date(entry.date).toLocaleDateString('en-IN')}</span></td><td><span className="soft-badge">{entry.source}</span></td><td><strong>{data.sites.find((site) => site.id === entry.siteId)?.name ?? 'Central Store'}</strong><span>{entry.note || '—'}</span></td><td className="positive-text">{entry.inward ? `${number(entry.inward)} ${material?.unit}` : '—'}</td><td className="negative-text">{entry.outward ? `${number(entry.outward)} ${material?.unit}` : '—'}</td><td>{currency(entry.rate)}</td><td>{currency(entry.value)}</td><td><strong>{number(running)} {material?.unit}</strong></td></tr>; })}</tbody></table></div>{!movements.length && <div className="empty-state"><PackageSearch size={28}/><strong>No stock movements</strong><span>Create a receipt, issue or auto-posting invoice.</span></div>}</section>
  </div>;
}
