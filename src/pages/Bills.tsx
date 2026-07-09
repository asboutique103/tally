import { Download, Eye, Plus, Printer, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { TransactionItemsEditor } from '../components/TransactionItemsEditor';
import {
  amountInIndianWords, billBalance, billTotal, currency, downloadCsv, inventoryRows,
  itemsSubtotal, itemsTax, nextDocumentNo, stockShortage, today, uid,
} from '../lib/helpers';
import { cleanText, hasDuplicate, hasValidItems, isFilled, isSameOrAfter, isValidGstin } from '../lib/validation';
import { useApp } from '../store/AppContext';
import type { Bill, BillType } from '../types';

const formatDate = (value: string) => value ? new Date(value).toLocaleDateString('en-IN') : '—';

export function Bills() {
  const { data, addBill, deleteBill } = useApp();
  const first = data.materials[0];

  const empty = (type: BillType = 'Purchase'): Bill => {
    const supplier = data.suppliers[0];
    const site = data.sites[0];
    return {
      id: uid('bill'),
      billNo: nextDocumentNo(type === 'Purchase' ? 'PB' : data.settings.invoicePrefix || 'INV', data.bills.filter((b) => b.type === type).map((bill) => bill.billNo)),
      type,
      date: today(),
      dueDate: today(),
      supplierId: type === 'Purchase' ? supplier?.id : undefined,
      siteId: type === 'Client' ? site?.id : undefined,
      partyName: type === 'Purchase' ? supplier?.name ?? '' : site?.clientName || site?.name || '',
      partyAddress: type === 'Purchase' ? supplier?.address ?? '' : site?.location ?? '',
      partyGstin: type === 'Purchase' ? supplier?.gstin ?? '' : '',
      state: 'TAMIL NADU',
      deliveryAddress: type === 'Client' ? site?.location ?? '' : '',
      ewayBillNo: '',
      vehicleNo: '',
      referenceNo: '',
      items: [{ id: uid('bi'), materialId: first?.id ?? '', quantity: 1, rate: first?.standardRate ?? 0, taxRate: first?.taxRate ?? data.settings.defaultTaxRate }],
      discount: 0,
      otherCharges: 0,
      notes: '',
      status: 'Unpaid',
      inventoryPosting: 'Auto Post',
      createdAt: new Date().toISOString(),
    };
  };

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | BillType>('All');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Bill | null>(null);
  const [draft, setDraft] = useState<Bill>(empty());
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => data.bills.filter((bill) => (filter === 'All' || bill.type === filter) && `${bill.billNo} ${bill.partyName} ${bill.referenceNo} ${bill.status}`.toLowerCase().includes(query.toLowerCase())),
    [data.bills, filter, query],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Bill = {
      ...draft,
      billNo: cleanText(draft.billNo).toUpperCase(),
      partyName: cleanText(draft.partyName),
      partyAddress: cleanText(draft.partyAddress),
      partyGstin: cleanText(draft.partyGstin).toUpperCase(),
      state: cleanText(draft.state).toUpperCase(),
      deliveryAddress: cleanText(draft.deliveryAddress),
      ewayBillNo: cleanText(draft.ewayBillNo).toUpperCase(),
      vehicleNo: cleanText(draft.vehicleNo).toUpperCase(),
      referenceNo: cleanText(draft.referenceNo).toUpperCase(),
      notes: cleanText(draft.notes),
      discount: draft.discount || 0,
      otherCharges: draft.otherCharges || 0,
    };

    if (!isFilled(next.billNo) || !isFilled(next.date) || !isFilled(next.dueDate) || !isFilled(next.referenceNo) || !isFilled(next.partyName) || !isFilled(next.partyAddress) || !isFilled(next.state)) {
      setError('Bill number, dates, reference / PO, party name, party address and state are mandatory.');
      return;
    }
    if (next.type === 'Purchase' && !isFilled(next.supplierId)) {
      setError('Select a supplier for a purchase bill.');
      return;
    }
    if (next.type === 'Client' && !isFilled(next.siteId)) {
      setError('Select the project / client for a client invoice.');
      return;
    }
    if (next.type === 'Client' && !isFilled(next.deliveryAddress)) {
      setError('Delivery address is mandatory for client invoices.');
      return;
    }
    if (!isSameOrAfter(next.dueDate, next.date)) {
      setError('Due date cannot be before the invoice date.');
      return;
    }
    const partyGstin = next.partyGstin ?? '';
    if (!isFilled(partyGstin) || !isValidGstin(partyGstin, true)) {
      setError('Enter a valid party GSTIN, or use URP for an unregistered party.');
      return;
    }
    if (!hasValidItems(next.items)) {
      setError('Add at least one material line with material, quantity, rate and tax.');
      return;
    }
    if (next.items.some((item) => !data.materials.find((material) => material.id === item.materialId)?.hsnCode)) {
      setError('Every billed material must have an HSN code in the material master.');
      return;
    }
    if (next.discount > itemsSubtotal(next.items) + next.otherCharges) {
      setError('Discount cannot be greater than subtotal plus other charges.');
      return;
    }
    if (hasDuplicate(data.bills, next.id, (bill) => bill.billNo.toUpperCase() === next.billNo)) {
      setError('Another bill or invoice already uses this number.');
      return;
    }
    if (next.inventoryPosting === 'Auto Post' && next.type === 'Client') {
      const stock = inventoryRows(data);
      const shortage = stockShortage(next.items, stock);
      if (shortage && data.settings.strictStockControl) {
        const [materialId] = shortage;
        const material = data.materials.find((item) => item.id === materialId);
        setError(`Insufficient stock for ${material?.name ?? 'material'}. Available: ${stock.find((row) => row.id === materialId)?.availableQty ?? 0} ${material?.unit ?? ''}.`);
        return;
      }
    }
    addBill(next);
    setOpen(false);
    setError('');
  };

  const changeType = (type: BillType) => {
    const supplier = data.suppliers[0];
    const site = data.sites[0];
    setError('');
    setDraft({
      ...draft,
      type,
      billNo: nextDocumentNo(type === 'Purchase' ? 'PB' : data.settings.invoicePrefix || 'INV', data.bills.filter((bill) => bill.type === type).map((bill) => bill.billNo)),
      supplierId: type === 'Purchase' ? supplier?.id : undefined,
      siteId: type === 'Client' ? site?.id : undefined,
      partyName: type === 'Purchase' ? supplier?.name ?? '' : site?.clientName || site?.name || '',
      partyAddress: type === 'Purchase' ? supplier?.address ?? '' : site?.location ?? '',
      partyGstin: type === 'Purchase' ? supplier?.gstin ?? '' : '',
      deliveryAddress: type === 'Client' ? site?.location ?? '' : '',
    });
  };

  const printBill = (bill: Bill) => {
    setView(bill);
    setTimeout(() => window.print(), 120);
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Accounts receivable & payable"
        title="Bills & invoices"
        description="Create supplier purchase bills and client/site invoices with tax, discounts, due dates and payment status."
        actions={(
          <>
            <button className="button secondary" onClick={() => downloadCsv('bills.csv', filtered.map((bill) => ({
              Bill: bill.billNo,
              Type: bill.type,
              Date: bill.date,
              DueDate: bill.dueDate,
              Party: bill.partyName,
              PartyGSTIN: bill.partyGstin ?? '',
              EwayBillNo: bill.ewayBillNo ?? '',
              VehicleNo: bill.vehicleNo ?? '',
              Reference: bill.referenceNo,
              Total: billTotal(bill),
              Balance: billBalance(data, bill),
              Status: bill.status,
            })))}><Download size={17} /> Export</button>
            <button className="button primary" disabled={!data.materials.length} onClick={() => { setDraft(empty('Client')); setError(''); setOpen(true); }}><Plus size={17} /> New invoice</button>
          </>
        )}
      />

      <section className="panel table-panel">
        <div className="table-toolbar split-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search bill, party, reference or status..." />
          <div className="segmented">{(['All', 'Purchase', 'Client'] as const).map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Bill</th><th>Type / date</th><th>Party</th><th>Reference</th><th>Total</th><th>Paid</th><th>Balance</th><th>Stock posting</th><th>Status</th><th /></tr></thead>
            <tbody>{filtered.map((bill) => {
              const balance = billBalance(data, bill);
              const total = billTotal(bill);
              return (
                <tr key={bill.id}>
                  <td><strong>{bill.billNo}</strong><span>Due {formatDate(bill.dueDate)}</span></td>
                  <td><span className={`soft-badge ${bill.type === 'Purchase' ? 'warning-badge' : ''}`}>{bill.type}</span><span>{formatDate(bill.date)}</span></td>
                  <td><strong>{bill.partyName}</strong><span>{bill.partyGstin ? `GSTIN ${bill.partyGstin}` : bill.type === 'Purchase' ? 'Supplier payable' : 'Client receivable'}</span></td>
                  <td>{bill.referenceNo || '—'}</td>
                  <td><strong>{currency(total)}</strong></td>
                  <td>{currency(total - balance)}</td>
                  <td><strong className={balance > 0 ? 'negative-text' : 'positive-text'}>{currency(balance)}</strong></td>
                  <td><span className={`soft-badge ${bill.inventoryPosting === 'Auto Post' ? '' : 'warning-badge'}`}>{bill.inventoryPosting}</span></td>
                  <td><span className={`status-pill status-${bill.status.toLowerCase().replaceAll(' ', '-')}`}>{bill.status}</span></td>
                  <td><div className="row-actions"><button className="icon-button" onClick={() => setView(bill)}><Eye size={16} /></button><button className="icon-button" onClick={() => printBill(bill)}><Printer size={16} /></button><button className="icon-button danger" onClick={() => confirm(`Delete ${bill.billNo}?`) && deleteBill(bill.id)}><Trash2 size={16} /></button></div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </section>

      <Modal open={open} title="Create bill / invoice" subtitle="Choose purchase for supplier bills or client for GST invoice print." onClose={() => setOpen(false)} wide>
        <form className="form-stack" onSubmit={submit}>
          {error && <div className="alert danger-alert">{error}</div>}
          <div className="segmented form-segmented">
            <button type="button" className={draft.type === 'Purchase' ? 'active' : ''} onClick={() => changeType('Purchase')}>Purchase bill</button>
            <button type="button" className={draft.type === 'Client' ? 'active' : ''} onClick={() => changeType('Client')}>Client invoice</button>
          </div>

          <div className="form-grid three">
            <label><span>Invoice / bill number *</span><input required value={draft.billNo} onChange={(event) => setDraft({ ...draft, billNo: event.target.value })} /></label>
            <label><span>Invoice date *</span><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
            <label><span>Due date *</span><input required type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label>
            {draft.type === 'Purchase' ? (
              <label className="span-2"><span>Supplier *</span><select required value={draft.supplierId ?? ''} onChange={(event) => { const supplier = data.suppliers.find((item) => item.id === event.target.value); setDraft({ ...draft, supplierId: event.target.value, partyName: supplier?.name ?? '', partyAddress: supplier?.address ?? '', partyGstin: supplier?.gstin ?? '' }); }}><option value="">Select supplier</option>{data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            ) : (
              <label className="span-2"><span>Project / client *</span><select required value={draft.siteId ?? ''} onChange={(event) => { const site = data.sites.find((item) => item.id === event.target.value); setDraft({ ...draft, siteId: event.target.value, partyName: site?.clientName || site?.name || '', partyAddress: site?.location ?? '', deliveryAddress: site?.location ?? '' }); }}><option value="">Select project</option>{data.sites.map((site) => <option key={site.id} value={site.id}>{site.name} — {site.clientName}</option>)}</select></label>
            )}
            <label><span>Reference / PO no. *</span><input required value={draft.referenceNo} onChange={(event) => setDraft({ ...draft, referenceNo: event.target.value })} placeholder="Invoice / PO / RA bill" /></label>
            <label className="span-2"><span>Party address *</span><textarea required rows={3} value={draft.partyAddress ?? ''} onChange={(event) => setDraft({ ...draft, partyAddress: event.target.value })} /></label>
            <label><span>Party GSTIN / URP *</span><input required maxLength={15} value={draft.partyGstin ?? ''} onChange={(event) => setDraft({ ...draft, partyGstin: event.target.value.toUpperCase() })} placeholder="GSTIN or URP" /></label>
            <label><span>State *</span><input required value={draft.state ?? ''} onChange={(event) => setDraft({ ...draft, state: event.target.value.toUpperCase() })} placeholder="TAMIL NADU" /></label>
            <label><span>E-way bill no.</span><input value={draft.ewayBillNo ?? ''} onChange={(event) => setDraft({ ...draft, ewayBillNo: event.target.value })} /></label>
            <label><span>Vehicle number</span><input value={draft.vehicleNo ?? ''} onChange={(event) => setDraft({ ...draft, vehicleNo: event.target.value.toUpperCase() })} /></label>
            <label className="span-2"><span>Delivered to {draft.type === 'Client' ? '*' : ''}</span><input required={draft.type === 'Client'} value={draft.deliveryAddress ?? ''} onChange={(event) => setDraft({ ...draft, deliveryAddress: event.target.value })} /></label>
          </div>

          <TransactionItemsEditor materials={data.materials} items={draft.items} onChange={(items) => setDraft({ ...draft, items })} />
          <div className="form-grid three">
            <label><span>Discount</span><input type="number" min="0" step="0.01" value={draft.discount} onChange={(event) => setDraft({ ...draft, discount: Number(event.target.value) })} /></label>
            <label><span>Other charges</span><input type="number" min="0" step="0.01" value={draft.otherCharges} onChange={(event) => setDraft({ ...draft, otherCharges: Number(event.target.value) })} /></label>
            <label><span>Stock posting</span><select value={draft.inventoryPosting} onChange={(event) => setDraft({ ...draft, inventoryPosting: event.target.value as Bill['inventoryPosting'] })}><option>Auto Post</option><option>Accounting Only</option></select><small>{draft.type === 'Purchase' ? 'Auto Post adds invoice quantities to central stock.' : 'Auto Post deducts invoice quantities from central stock.'}</small></label>
          </div>
          <div className="document-total"><span>Subtotal {currency(itemsSubtotal(draft.items))}</span><span>Tax {currency(itemsTax(draft.items))}</span><span>Charges {currency(draft.otherCharges)}</span><span>Discount -{currency(draft.discount)}</span><strong>Grand total {currency(billTotal(draft))}</strong></div>
          <label><span>Notes / terms</span><textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
          <div className="form-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button primary">Save bill</button></div>
        </form>
      </Modal>

      <Modal open={Boolean(view)} title={view?.billNo ?? 'Bill'} subtitle="Print-ready invoice view" onClose={() => setView(null)} wide>
        {view && (() => {
          const subtotal = itemsSubtotal(view.items);
          const tax = itemsTax(view.items);
          const rate = view.items[0]?.taxRate ?? data.settings.defaultTaxRate;
          const halfRate = rate / 2;
          const grandTotal = billTotal(view);
          return (
            <div className="vmv-invoice">
              <div className="vmv-company-box">
                <h1>{data.settings.companyName}</h1>
                <p>{data.settings.address}</p>
                <div><strong>GST NO :</strong><span>{data.settings.gstin || '—'}</span><strong>PH NO –</strong><span>{data.settings.phone || '—'}</span></div>
              </div>
              <div className="vmv-title">INVOICE</div>
              <div className="vmv-party-grid">
                <div className="vmv-party-left">
                  <strong>TO,</strong>
                  <h3>{view.partyName}</h3>
                  <p>{view.partyAddress || '—'}</p>
                  {view.deliveryAddress && <p><strong>Delivered to</strong> {view.deliveryAddress}</p>}
                </div>
                <div className="vmv-party-right">
                  <p><strong>COMPANY PAN NO</strong><span>: {data.settings.panNo || '—'}</span></p>
                  <p><strong>GST NO</strong><span>: {data.settings.gstin || '—'}</span></p>
                  <p><strong>GST INVOICE NO</strong><span>: {view.billNo}</span></p>
                  <p><strong>E-WAY BILL NO</strong><span>: {view.ewayBillNo || '—'}</span></p>
                  <p><strong>GST INVOICE DATE</strong><span>: {formatDate(view.date)}</span></p>
                  <p><strong>VEHICLE NUMBER</strong><span>: {view.vehicleNo || '—'}</span></p>
                </div>
                <div className="vmv-state"><strong>STATE: {view.state || '—'}</strong><span><strong>PARTY-GSTIN :</strong> {view.partyGstin || '—'}</span></div>
              </div>
              <table className="vmv-items">
                <thead><tr><th>SI.No</th><th>Particular</th><th>HSN CODE</th><th>Qty</th><th>Rate</th><th>Total<br />Amount</th></tr></thead>
                <tbody>
                  {view.items.map((item, index) => {
                    const material = data.materials.find((candidate) => candidate.id === item.materialId);
                    return (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td><strong>{material?.name ?? 'Material'}</strong>{item.note && <span>{item.note}</span>}</td>
                        <td>{material?.hsnCode || '-'}</td>
                        <td>{numberForInvoice(item.quantity)} {material?.unit ?? ''}</td>
                        <td>{numberForInvoice(item.rate)}</td>
                        <td>{numberForInvoice(item.quantity * item.rate)}</td>
                      </tr>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 6 - view.items.length) }, (_, index) => <tr key={`blank-${index}`}><td>&nbsp;</td><td /><td /><td /><td /><td /></tr>)}
                </tbody>
                <tfoot>
                  <tr><td colSpan={2} rowSpan={6} className="vmv-words"><strong>Amount in word Rupees:</strong> {amountInIndianWords(grandTotal)}</td><td /><td colSpan={2}><strong>Item Amount</strong></td><td><strong>{numberForInvoice(subtotal)}</strong></td></tr>
                  <tr><td /><td colSpan={2}><strong>Other Charges</strong></td><td><strong>{numberForInvoice(view.otherCharges)}</strong></td></tr>
                  <tr><td /><td colSpan={2}><strong>Discount</strong></td><td><strong>-{numberForInvoice(view.discount)}</strong></td></tr>
                  <tr><td /><td colSpan={2}><strong>CGST@{numberForInvoice(halfRate)}%</strong></td><td><strong>{numberForInvoice(tax / 2)}</strong></td></tr>
                  <tr><td /><td colSpan={2}><strong>SGST@{numberForInvoice(halfRate)}%</strong></td><td><strong>{numberForInvoice(tax / 2)}</strong></td></tr>
                  <tr><td /><td colSpan={2} className="vmv-grand"><strong>GRAND TOTAL</strong></td><td className="vmv-grand"><strong>{numberForInvoice(grandTotal)}</strong></td></tr>
                </tfoot>
              </table>
              <div className="vmv-footer">
                <div>
                  <h3>Bank Details</h3>
                  <p><strong>{data.settings.companyName}</strong></p>
                  <p>Our Bank Name: {data.settings.bankName || '—'}</p>
                  <p>Branch Name : {data.settings.bankBranch || '—'}</p>
                  <p>A/C No : {data.settings.bankAccountNo || '—'}</p>
                  <p>IFSC CODE : {data.settings.bankIfsc || '—'}</p>
                </div>
                <div className="vmv-sign"><strong>FOR {data.settings.companyName}</strong><span>Authorized Signatory</span></div>
              </div>
              <div className="form-actions no-print"><button className="button primary" onClick={() => window.print()}><Printer size={17} /> Print invoice</button></div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function numberForInvoice(value: number) {
  return (value || 0).toLocaleString('en-IN', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
