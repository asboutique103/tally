import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  IndianRupee,
  Package,
  ReceiptText,
  Truck,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { billBalance, billTotal, currency, inventoryRows, number, today } from '../lib/helpers';
import { useApp } from '../store/AppContext';

export function Dashboard() {
  const { data } = useApp();
  const todayValue = today();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekValue = nextWeek.toISOString().slice(0, 10);

  const inventory = inventoryRows(data);
  const stockValue = inventory.reduce((sum, item) => sum + item.stockValue, 0);
  const lowStock = inventory.filter((item) => item.availableQty <= item.reorderLevel);
  const payable = data.bills.filter((bill) => bill.type === 'Purchase').reduce((sum, bill) => sum + billBalance(data, bill), 0);
  const receivable = data.bills.filter((bill) => bill.type === 'Client').reduce((sum, bill) => sum + billBalance(data, bill), 0);
  const totalReceived = data.receipts.reduce((sum, receipt) => sum + receipt.items.reduce((s, item) => s + item.quantity * item.rate, 0), 0);
  const totalSupplied = data.supplies.reduce((sum, supply) => sum + supply.items.reduce((s, item) => s + item.quantity * item.rate, 0), 0);
  const activeSites = data.sites.filter((site) => site.status === 'Active').length;
  const overdueBills = data.bills.filter((bill) => billBalance(data, bill) > 0 && bill.dueDate < todayValue);
  const dueSoonBills = data.bills.filter((bill) => billBalance(data, bill) > 0 && bill.dueDate >= todayValue && bill.dueDate <= nextWeekValue);

  const incompleteSuppliers = data.suppliers.filter((supplier) => !supplier.contactPerson || !supplier.phone || !supplier.gstin || !supplier.address).length;
  const incompleteSites = data.sites.filter((site) => !site.clientName || !site.location || !site.siteEngineer || !site.phone || !site.budget || !site.startDate || !site.expectedEndDate).length;
  const incompleteMaterials = data.materials.filter((material) => !material.hsnCode || !material.location || !material.reorderLevel || !material.standardRate).length;
  const missingCompanyProfile = !data.settings.gstin || !data.settings.phone || !data.settings.address || !data.settings.bankAccountNo || !data.settings.bankIfsc;

  const readiness = [
    { label: 'Company invoice profile', issue: missingCompanyProfile ? 'Bank or GST details pending' : 'Ready', ok: !missingCompanyProfile, to: '/settings' },
    { label: 'Supplier GST & contacts', issue: incompleteSuppliers ? `${incompleteSuppliers} incomplete` : 'Ready', ok: incompleteSuppliers === 0, to: '/suppliers' },
    { label: 'Site budget & engineer data', issue: incompleteSites ? `${incompleteSites} incomplete` : 'Ready', ok: incompleteSites === 0, to: '/sites' },
    { label: 'Material HSN & reorder levels', issue: incompleteMaterials ? `${incompleteMaterials} incomplete` : 'Ready', ok: incompleteMaterials === 0, to: '/materials' },
  ];

  const siteChart = data.sites.map((site) => ({
    name: site.name.length > 16 ? `${site.name.slice(0, 16)}...` : site.name,
    value:
      data.supplies.filter((entry) => entry.siteId === site.id).reduce((sum, entry) => sum + entry.items.reduce((s, item) => s + item.quantity * item.rate, 0), 0)
      + data.receipts.filter((entry) => entry.destination === 'Direct to Site' && entry.siteId === site.id).reduce((sum, entry) => sum + entry.items.reduce((s, item) => s + item.quantity * item.rate, 0), 0),
  }));

  const recentActivity = [
    ...data.receipts.slice(0, 3).map((entry) => ({ date: entry.date, title: `${entry.receiptNo} received`, detail: data.suppliers.find((supplier) => supplier.id === entry.supplierId)?.name ?? 'Supplier', icon: ArrowDownToLine })),
    ...data.supplies.slice(0, 3).map((entry) => ({ date: entry.date, title: `${entry.issueNo} supplied`, detail: data.sites.find((site) => site.id === entry.siteId)?.name ?? 'Site', icon: ArrowUpFromLine })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Executive overview"
        title="Construction control center"
        description="Live visibility across materials, suppliers, sites, billing, payments and mandatory setup readiness."
      />

      <section className="stats-grid">
        <StatCard label="Inventory value" value={currency(stockValue)} helper={`${inventory.length} active materials`} icon={Package} />
        <StatCard label="Supplier payable" value={currency(payable)} helper={`${data.bills.filter((bill) => bill.type === 'Purchase' && bill.status !== 'Paid').length} open purchase bills`} icon={IndianRupee} tone={payable > 0 ? 'warning' : 'success'} />
        <StatCard label="Client receivable" value={currency(receivable)} helper={`${data.bills.filter((bill) => bill.type === 'Client' && bill.status !== 'Paid').length} open invoices`} icon={WalletCards} tone={receivable > 0 ? 'warning' : 'success'} />
        <StatCard label="Active sites" value={String(activeSites)} helper={`${data.sites.length} total projects`} icon={Building2} />
      </section>

      <section className="operations-grid">
        <article className="panel readiness-panel">
          <div className="panel-header">
            <div><span className="eyebrow">Mandatory readiness</span><h2>Setup checklist</h2></div>
            <span className={`status-pill ${readiness.every((item) => item.ok) ? 'success' : 'warning'}`}>{readiness.filter((item) => !item.ok).length} pending</span>
          </div>
          <div className="readiness-list">
            {readiness.map((item) => (
              <Link to={item.to} className="readiness-row" key={item.label}>
                <span className={`readiness-icon ${item.ok ? 'ok' : 'attention'}`}>{item.ok ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span>
                <strong>{item.label}</strong>
                <span>{item.issue}</span>
              </Link>
            ))}
          </div>
        </article>

        <article className="panel quick-panel">
          <div className="panel-header"><div><span className="eyebrow">Daily actions</span><h2>Fast entry</h2></div><ClipboardCheck size={20} /></div>
          <div className="quick-actions">
            <Link className="button secondary" to="/receipts"><Truck size={17} /> Receive material</Link>
            <Link className="button secondary" to="/supplies"><Building2 size={17} /> Issue to site</Link>
            <Link className="button secondary" to="/bills"><ReceiptText size={17} /> Create invoice</Link>
            <Link className="button secondary" to="/payments"><WalletCards size={17} /> Record payment</Link>
          </div>
          <div className="attention-strip">
            <div><CalendarClock size={17} /><span>{overdueBills.length} overdue bills</span></div>
            <div><ReceiptText size={17} /><span>{dueSoonBills.length} due in 7 days</span></div>
            <div><AlertTriangle size={17} /><span>{lowStock.length} low-stock items</span></div>
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div><span className="eyebrow">Site consumption</span><h2>Material value by project</h2></div>
            <span className="soft-badge">Live calculation</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={siteChart} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `Rs. ${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value) => currency(Number(value))} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="currentColor" className="chart-bar" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel activity-panel">
          <div className="panel-header"><div><span className="eyebrow">Operations</span><h2>Recent activity</h2></div></div>
          <div className="activity-list">
            {recentActivity.map(({ title, detail, date, icon: Icon }, index) => (
              <div className="activity-row" key={`${title}-${index}`}>
                <div className="activity-icon"><Icon size={17} /></div>
                <div><strong>{title}</strong><span>{detail}</span></div>
                <time>{new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</time>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel">
          <div className="panel-header">
            <div><span className="eyebrow">Stock health</span><h2>Low-stock attention</h2></div>
            <span className={`status-pill ${lowStock.length ? 'danger' : 'success'}`}><AlertTriangle size={14} /> {lowStock.length} alerts</span>
          </div>
          <div className="compact-table-wrap">
            <table className="data-table compact-table">
              <thead><tr><th>Material</th><th>Available</th><th>Reorder</th><th>Status</th></tr></thead>
              <tbody>
                {(lowStock.length ? lowStock : inventory.slice(0, 4)).map((item) => (
                  <tr key={item.id}><td><strong>{item.name}</strong><span>{item.code}</span></td><td>{number(item.availableQty)} {item.unit}</td><td>{number(item.reorderLevel)} {item.unit}</td><td><span className={`status-pill ${item.availableQty <= item.reorderLevel ? 'danger' : 'success'}`}>{item.availableQty <= item.reorderLevel ? 'Reorder' : 'Healthy'}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header"><div><span className="eyebrow">Billing</span><h2>Open bill snapshot</h2></div><ReceiptText size={20} /></div>
          <div className="bill-snapshot">
            {data.bills.slice(0, 4).map((bill) => (
              <div className="bill-snapshot-row" key={bill.id}>
                <div><strong>{bill.billNo}</strong><span>{bill.partyName}</span></div>
                <div className="align-right"><strong>{currency(billTotal(bill))}</strong><span className={`status-text status-${bill.status.toLowerCase().replaceAll(' ', '-')}`}>{bill.status}</span></div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="stats-grid mini-stats">
        <StatCard label="Material received" value={currency(totalReceived)} helper={`${data.receipts.length} goods receipt notes`} icon={Truck} tone="success" />
        <StatCard label="Material supplied" value={currency(totalSupplied)} helper={`${data.supplies.length} site issue notes`} icon={Building2} />
        <StatCard label="Overdue balance" value={currency(overdueBills.reduce((sum, bill) => sum + billBalance(data, bill), 0))} helper={`${overdueBills.length} bills past due`} icon={CalendarClock} tone={overdueBills.length ? 'danger' : 'success'} />
      </section>
    </div>
  );
}
