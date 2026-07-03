import { Building2, Download, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { currency, downloadCsv, uid } from '../lib/helpers';
import { useApp } from '../store/AppContext';
import type { Site } from '../types';

const emptySite = (): Site => ({ id: uid('site'), code: '', name: '', clientName: '', location: '', siteEngineer: '', phone: '', budget: 0, startDate: new Date().toISOString().slice(0,10), expectedEndDate: '', status: 'Planning', createdAt: new Date().toISOString() });

export function Sites() {
  const { data, upsertSite, deleteSite } = useApp();
  const [query, setQuery] = useState(''); const [open, setOpen] = useState(false); const [draft, setDraft] = useState<Site>(emptySite());
  const filtered = useMemo(() => data.sites.filter((site) => `${site.name} ${site.code} ${site.clientName} ${site.location}`.toLowerCase().includes(query.toLowerCase())), [data.sites, query]);
  const consumption = (siteId:string) => data.supplies.filter((s) => s.siteId === siteId).reduce((sum,s) => sum + s.items.reduce((a,i) => a + i.quantity*i.rate,0),0) + data.receipts.filter((r) => r.destination === 'Direct to Site' && r.siteId === siteId).reduce((sum,r) => sum + r.items.reduce((a,i) => a + i.quantity*i.rate,0),0);
  const submit=(e:FormEvent)=>{e.preventDefault();upsertSite(draft);setOpen(false);};
  return <div className="page-stack">
    <PageHeader eyebrow="Project control" title="Sites & projects" description="Track construction locations, clients, engineers, budgets and material consumption." actions={<><button className="button secondary" onClick={() => downloadCsv('sites.csv', filtered.map((s)=>({Code:s.code,Site:s.name,Client:s.clientName,Location:s.location,Engineer:s.siteEngineer,Budget:s.budget,Consumption:consumption(s.id),Status:s.status})))}><Download size={17}/> Export</button><button className="button primary" onClick={()=>{setDraft({...emptySite(),code:`SITE-${String(data.sites.length+1).padStart(3,'0')}`});setOpen(true);}}><Plus size={17}/> New site</button></>} />
    <section className="panel table-panel"><div className="table-toolbar"><SearchBar value={query} onChange={setQuery} placeholder="Search site, client or location..."/><div className="toolbar-summary"><strong>{filtered.length}</strong><span>projects</span></div></div>
      <div className="cards-grid site-cards">{filtered.map((site)=><article className="entity-card site-card" key={site.id}><div className="site-card-cover"><Building2 size={26}/><span className={`status-pill status-${site.status.toLowerCase().replace(' ','-')}`}>{site.status}</span></div><h3>{site.name}</h3><p>{site.code} · {site.clientName}</p><div className="site-location"><MapPin size={15}/>{site.location}</div><div className="progress-track"><span style={{width:`${Math.min(100, site.budget ? consumption(site.id)/site.budget*100 : 0)}%`}}/></div><div className="entity-details"><div><span>Material consumed</span><strong>{currency(consumption(site.id))}</strong></div><div><span>Budget</span><strong>{currency(site.budget)}</strong></div><div><span>Engineer</span><strong>{site.siteEngineer || '—'}</strong></div><div><span>Expected end</span><strong>{site.expectedEndDate ? new Date(site.expectedEndDate).toLocaleDateString('en-IN') : '—'}</strong></div></div><div className="entity-card-actions"><button className="button secondary small" onClick={()=>{setDraft(site);setOpen(true);}}><Pencil size={15}/> Edit</button><button className="icon-button danger" onClick={()=>confirm(`Delete ${site.name}?`)&&deleteSite(site.id)}><Trash2 size={16}/></button></div></article>)}</div>
    </section>
    <Modal open={open} title={data.sites.some((s)=>s.id===draft.id)?'Edit site':'Create site'} subtitle="Sites receive issued materials and can have client billing." onClose={()=>setOpen(false)} wide><form className="form-stack" onSubmit={submit}><div className="form-grid two">
      <label><span>Site code *</span><input required value={draft.code} onChange={(e)=>setDraft({...draft,code:e.target.value})}/></label><label><span>Site / project name *</span><input required value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})}/></label>
      <label><span>Client name</span><input value={draft.clientName} onChange={(e)=>setDraft({...draft,clientName:e.target.value})}/></label><label><span>Location *</span><input required value={draft.location} onChange={(e)=>setDraft({...draft,location:e.target.value})}/></label>
      <label><span>Site engineer</span><input value={draft.siteEngineer} onChange={(e)=>setDraft({...draft,siteEngineer:e.target.value})}/></label><label><span>Phone</span><input value={draft.phone} onChange={(e)=>setDraft({...draft,phone:e.target.value})}/></label>
      <label><span>Budget</span><input type="number" min="0" value={draft.budget} onChange={(e)=>setDraft({...draft,budget:Number(e.target.value)})}/></label><label><span>Status</span><select value={draft.status} onChange={(e)=>setDraft({...draft,status:e.target.value as Site['status']})}><option>Planning</option><option>Active</option><option>On Hold</option><option>Completed</option></select></label>
      <label><span>Start date</span><input type="date" value={draft.startDate} onChange={(e)=>setDraft({...draft,startDate:e.target.value})}/></label><label><span>Expected end date</span><input type="date" value={draft.expectedEndDate} onChange={(e)=>setDraft({...draft,expectedEndDate:e.target.value})}/></label>
    </div><div className="form-actions"><button type="button" className="button secondary" onClick={()=>setOpen(false)}>Cancel</button><button className="button primary">Save site</button></div></form></Modal>
  </div>;
}
