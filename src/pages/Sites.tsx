import { Building2, Download, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { currency, downloadCsv, today, uid } from '../lib/helpers';
import { cleanText, compactPhone, hasDuplicate, isFilled, isPositive, isSameOrAfter, isValidIndianPhone } from '../lib/validation';
import { useApp } from '../store/AppContext';
import type { Site } from '../types';

const emptySite = (): Site => ({
  id: uid('site'),
  code: '',
  name: '',
  clientName: '',
  location: '',
  siteEngineer: '',
  phone: '',
  budget: 0,
  startDate: today(),
  expectedEndDate: '',
  status: 'Planning',
  createdAt: new Date().toISOString(),
});

export function Sites() {
  const { data, upsertSite, deleteSite } = useApp();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Site>(emptySite());
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => data.sites.filter((site) => `${site.name} ${site.code} ${site.clientName} ${site.location}`.toLowerCase().includes(query.toLowerCase())),
    [data.sites, query],
  );

  const consumption = (siteId: string) =>
    data.supplies.filter((supply) => supply.siteId === siteId).reduce((sum, supply) => sum + supply.items.reduce((a, item) => a + item.quantity * item.rate, 0), 0)
    + data.receipts.filter((receipt) => receipt.destination === 'Direct to Site' && receipt.siteId === siteId).reduce((sum, receipt) => sum + receipt.items.reduce((a, item) => a + item.quantity * item.rate, 0), 0);

  const requestDelete = (site: Site) => {
    const inUse = data.receipts.some((receipt) => receipt.siteId === site.id)
      || data.supplies.some((supply) => supply.siteId === site.id)
      || data.bills.some((bill) => bill.siteId === site.id);
    if (inUse) {
      alert('This site is already used in receipts, issues or invoices. Keep it for audit history.');
      return;
    }
    if (confirm(`Delete ${site.name}?`)) deleteSite(site.id);
  };

  const openCreate = () => {
    setDraft({ ...emptySite(), code: `SITE-${String(data.sites.length + 1).padStart(3, '0')}` });
    setError('');
    setOpen(true);
  };

  const openEdit = (site: Site) => {
    setDraft(site);
    setError('');
    setOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Site = {
      ...draft,
      code: cleanText(draft.code).toUpperCase(),
      name: cleanText(draft.name),
      clientName: cleanText(draft.clientName),
      location: cleanText(draft.location),
      siteEngineer: cleanText(draft.siteEngineer),
      phone: compactPhone(draft.phone),
      budget: draft.budget || 0,
      startDate: cleanText(draft.startDate),
      expectedEndDate: cleanText(draft.expectedEndDate),
    };

    if (!isFilled(next.code) || !isFilled(next.name) || !isFilled(next.clientName) || !isFilled(next.location) || !isFilled(next.siteEngineer) || !isFilled(next.phone) || !isFilled(next.startDate) || !isFilled(next.expectedEndDate)) {
      setError('Site code, project name, client, location, engineer, phone, start date and expected end date are mandatory.');
      return;
    }
    if (!isValidIndianPhone(next.phone)) {
      setError('Enter a valid 10-digit phone number for the site contact.');
      return;
    }
    if (!isPositive(next.budget)) {
      setError('Enter a project budget greater than zero.');
      return;
    }
    if (!isSameOrAfter(next.expectedEndDate, next.startDate)) {
      setError('Expected end date cannot be before the start date.');
      return;
    }
    if (hasDuplicate(data.sites, next.id, (site) => site.code.toUpperCase() === next.code)) {
      setError('Another site already uses this site code.');
      return;
    }

    upsertSite(next);
    setOpen(false);
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Project control"
        title="Sites & projects"
        description="Track construction locations, clients, engineers, budgets and material consumption."
        actions={(
          <>
            <button className="button secondary" onClick={() => downloadCsv('sites.csv', filtered.map((site) => ({
              Code: site.code,
              Site: site.name,
              Client: site.clientName,
              Location: site.location,
              Engineer: site.siteEngineer,
              Budget: site.budget,
              Consumption: consumption(site.id),
              Status: site.status,
            })))}><Download size={17} /> Export</button>
            <button className="button primary" onClick={openCreate}><Plus size={17} /> New site</button>
          </>
        )}
      />

      <section className="panel table-panel">
        <div className="table-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search site, client or location..." />
          <div className="toolbar-summary"><strong>{filtered.length}</strong><span>projects</span></div>
        </div>
        {filtered.length === 0 ? <EmptyState title="No sites found" description="Create a construction site or change your search filters." action={<button className="button primary" onClick={openCreate}><Plus size={17} /> Add site</button>} /> : (
          <div className="cards-grid site-cards">
            {filtered.map((site) => {
              const used = consumption(site.id);
              const usage = Math.min(100, site.budget ? (used / site.budget) * 100 : 0);
              return (
                <article className="entity-card site-card" key={site.id}>
                  <div className="site-card-cover">
                    <Building2 size={26} />
                    <span className={`status-pill status-${site.status.toLowerCase().replace(' ', '-')}`}>{site.status}</span>
                  </div>
                  <h3>{site.name}</h3>
                  <p>{site.code} / {site.clientName}</p>
                  <div className="site-location"><MapPin size={15} />{site.location}</div>
                  <div className="progress-track"><span style={{ width: `${usage}%` }} /></div>
                  <div className="entity-details">
                    <div><span>Material consumed</span><strong>{currency(used)}</strong></div>
                    <div><span>Budget</span><strong>{currency(site.budget)}</strong></div>
                    <div><span>Engineer</span><strong>{site.siteEngineer || '-'}</strong></div>
                    <div><span>Expected end</span><strong>{site.expectedEndDate ? new Date(site.expectedEndDate).toLocaleDateString('en-IN') : '-'}</strong></div>
                  </div>
                  <div className="entity-card-actions">
                    <button className="button secondary small" onClick={() => openEdit(site)}><Pencil size={15} /> Edit</button>
                    <button className="icon-button danger" onClick={() => requestDelete(site)} aria-label={`Delete ${site.name}`}><Trash2 size={16} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={open} title={data.sites.some((site) => site.id === draft.id) ? 'Edit site' : 'Create site'} subtitle="Sites receive issued materials and can have client billing." onClose={() => setOpen(false)} wide>
        <form className="form-stack" onSubmit={submit}>
          {error && <div className="alert danger-alert">{error}</div>}
          <div className="form-grid two">
            <label><span>Site code *</span><input required value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} /></label>
            <label><span>Site / project name *</span><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label><span>Client name *</span><input required value={draft.clientName} onChange={(event) => setDraft({ ...draft, clientName: event.target.value })} /></label>
            <label><span>Location *</span><input required value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label>
            <label><span>Site engineer *</span><input required value={draft.siteEngineer} onChange={(event) => setDraft({ ...draft, siteEngineer: event.target.value })} /></label>
            <label><span>Phone *</span><input required inputMode="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="9876543210" /></label>
            <label><span>Budget *</span><input required type="number" min="1" step="0.01" value={draft.budget} onChange={(event) => setDraft({ ...draft, budget: Number(event.target.value) })} /></label>
            <label><span>Status *</span><select required value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Site['status'] })}><option>Planning</option><option>Active</option><option>On Hold</option><option>Completed</option></select></label>
            <label><span>Start date *</span><input required type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label>
            <label><span>Expected end date *</span><input required type="date" value={draft.expectedEndDate} onChange={(event) => setDraft({ ...draft, expectedEndDate: event.target.value })} /></label>
          </div>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="button primary">Save site</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
