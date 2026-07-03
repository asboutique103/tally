import { Download, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { downloadCsv } from '../lib/helpers';
import { useApp } from '../store/AppContext';

export function AuditTrail() {
  const { data } = useApp();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => data.auditLog.filter((entry) => `${entry.actor} ${entry.action} ${entry.module} ${entry.documentNo} ${entry.details}`.toLowerCase().includes(query.toLowerCase())), [data.auditLog, query]);
  return <div className="page-stack">
    <PageHeader eyebrow="Edit log & governance" title="Audit trail" description="Immutable-style activity history for masters, invoices, stock documents, payments and accounting vouchers." actions={<button className="button primary" onClick={() => downloadCsv('audit-trail.csv', filtered.map((entry) => ({ Timestamp: entry.timestamp, Actor: entry.actor, Action: entry.action, Module: entry.module, Document: entry.documentNo, Details: entry.details })))}><Download size={17}/> Export audit</button>} />
    <section className="panel table-panel"><div className="table-toolbar"><SearchBar value={query} onChange={setQuery} placeholder="Search actor, module, document or activity..."/><div className="toolbar-summary"><strong>{filtered.length}</strong><span>logged actions</span></div></div><div className="audit-list">{filtered.map((entry) => <article className="audit-row" key={entry.id}><div className={`audit-icon action-${entry.action.toLowerCase()}`}><ShieldCheck size={18}/></div><div className="audit-copy"><div><strong>{entry.action} · {entry.module}</strong><span>{new Date(entry.timestamp).toLocaleString('en-IN')}</span></div><p>{entry.details}</p><small>{entry.actor} · {entry.documentNo}</small></div></article>)}</div></section>
  </div>;
}
