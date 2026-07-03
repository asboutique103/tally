import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Building2, IndianRupee, Package, ReceiptText, Truck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { billBalance, billTotal, currency, inventoryRows, number } from '../lib/helpers';
import { useApp } from '../store/AppContext';

export function Dashboard() {
  const { data } = useApp();
  const inventory = inventoryRows(data);
  const stockValue = inventory.reduce((sum, item) => sum + item.stockValue, 0);
  const lowStock = inventory.filter((item) => item.availableQty <= item.reorderLevel);
  const payable = data.bills.filter((bill) => bill.type === 'Purchase').reduce((sum, bill) => sum + billBalance(data, bill), 0);
  const totalReceived = data.receipts.reduce((sum, receipt) => sum + receipt.items.reduce((s, item) => s + item.quantity * item.rate, 0), 0);
  const totalSupplied = data.supplies.reduce((sum, supply) => sum + supply.items.reduce((s, item) => s + item.quantity * item.rate, 0), 0);
  const siteChart = data.sites.map((site) => ({
    name: site.name.length > 16 ? `${site.name.slice(0, 16)}…` : site.name,
    value:
      data.supplies.filter((entry) => entry.siteId === site.id).reduce((sum, entry) => sum + entry.items.reduce((s, item) => s + item.quantity * item.rate, 0), 0)
      + data.receipts.filter((entry) => entry.destination === 'Direct to Site' && entry.siteId === site.id).reduce((sum, entry) => sum + entry.items.reduce((s, item) => s + item.quantity * item.rate, 0), 0),
  }));

  const recentActivity = [
    ...data.receipts.slice(0, 3).map((entry) => ({ date: entry.date, title: `${entry.receiptNo} received`, detail: data.suppliers.find((s) => s.id === entry.supplierId)?.name ?? 'Supplier', icon: ArrowDownToLine })),
    ...data.supplies.slice(0, 3).map((entry) => ({ date: entry.date, title: `${entry.issueNo} supplied`, detail: data.sites.find((s) => s.id === entry.siteId)?.name ?? 'Site', icon: ArrowUpFromLine })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Executive overview" title="Construction control center" description="Live visibility across materials, suppliers, sites, billing and payments." />

      <section className="stats-grid">
        <StatCard label="Inventory value" value={currency(stockValue)} helper={`${inventory.length} active materials`} icon={Package} />
        <StatCard label="Supplier payable" value={currency(payable)} helper={`${data.bills.filter((b) => b.type === 'Purchase' && b.status !== 'Paid').length} open purchase bills`} icon={IndianRupee} tone={payable > 0 ? 'warning' : 'success'} />
        <StatCard label="Material received" value={currency(totalReceived)} helper={`${data.receipts.length} goods receipt notes`} icon={Truck} tone="success" />
        <StatCard label="Material supplied" value={currency(totalSupplied)} helper={`${data.supplies.length} site issue notes`} icon={Building2} />
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
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} />
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
    </div>
  );
}
