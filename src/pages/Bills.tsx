import { Download, Eye, Plus, Printer, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { NumberField } from '../components/NumberField';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { TransactionItemsEditor } from '../components/TransactionItemsEditor';
import {
  amountInIndianWords, billBalance, billTotal, currency, downloadCsv, gstAmount, inventoryRows,
  nextDocumentNo, stockShortage, taxableAmount, today, uid,
} from '../lib/helpers';
import { directCustomerPhone, directCustomerReference, isDirectCustomerBill } from '../lib/directCustomers';
import { printInvoiceWhenReady } from '../lib/print';
import { cleanText, hasValidItems, hasDuplicate, isFilled, isSameOrAfter, isValidGstin } from '../lib/validation';
import { useApp } from '../store/AppContext';
import type { Bill, BillType, Payment } from '../types';

const formatDate = (value: string) => value ? new Date(value).toLocaleDateString('en-IN') : '—';
type InvoiceKind = BillType | 'Direct Customer';
type BillFilter = 'All' | 'Purchase' | 'Client' | 'Direct Customers';
type DirectPaymentChoice = 'Full payment' | 'Partial payment' | 'Credit sale';

export function Bills() {
  const { data, addBill, addPayment, deleteBill } = useApp();
  const first = data.materials[0];

  const empty = (kind: InvoiceKind = 'Purchase'): Bill => {
    const type: BillType = kind === 'Purchase' ? 'Purchase' : 'Client';
    const direct = kind === 'Direct Customer';
    const supplier = data.suppliers[0];
    const site = data.sites[0];
    return {
      id: uid('bill'),
      billNo: nextDocumentNo(type === 'Purchase' ? 'PB' : direct ? 'DC' : data.settings.invoicePrefix || 'INV', data.bills.map((bill) => bill.billNo)),
      type,
      date: today(),
      dueDate: today(),
      supplierId: type === 'Purchase' ? supplier?.id : undefined,
      siteId: type === 'Client' && !direct ? site?.id : undefined,
      partyName: type === 'Purchase' ? supplier?.name ?? '' : direct ? '' : site?.clientName || site?.name || '',
      partyAddress: type === 'Purchase' ? supplier?.address ?? '' : direct ? '' : site?.location ?? '',
      partyGstin: type === 'Purchase' ? supplier?.gstin ?? '' : '',
      state: 'TAMIL NADU',
      deliveryAddress: type === 'Client' && !direct ? site?.location ?? '' : '',
      ewayBillNo: '',
      vehicleNo: '',
      referenceNo: direct ? directCustomerReference('') : '',
      items: [{ id: uid('bi'), materialId: first?.id ?? '', quantity: 1, rate: first?.standardRate ?? 0, taxRate: 0 }],
      discount: 0,
      otherCharges: 0,
      gstEnabled: false,
      gstRate: data.settings.defaultTaxRate || 18,
      gstType: 'CGST_SGST',
      notes: '',
      status: 'Unpaid',
      inventoryPosting: 'Auto Post',
      createdAt: new Date().toISOString(),
    };
  };

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BillFilter>('All');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Bill | null>(null);
  const [draft, setDraft] = useState<Bill>(empty());
  const [draftKind, setDraftKind] = useState<InvoiceKind>('Purchase');
  const [directPhone, setDirectPhone] = useState('');
  const [paymentChoice, setPaymentChoice] = useState<DirectPaymentChoice>('Full payment');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<Payment['mode']>('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [error, setError] = useState('');

  const filtered = useMemo(
    () => data.bills.filter((bill) => {
      const direct = isDirectCustomerBill(bill);
      const matchesFilter = filter === 'All'
        || (filter === 'Purchase' && bill.type === 'Purchase')
        || (filter === 'Client' && bill.type === 'Client' && !direct)
        || (filter === 'Direct Customers' && direct);
      return matchesFilter && `${bill.billNo} ${bill.partyName} ${directCustomerPhone(bill)} ${bill.status}`.toLowerCase().includes(query.toLowerCase());
    }),
    [data.bills, filter, query],
  );

  const submit = async (event: FormEvent) => {
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
      referenceNo: draftKind === 'Direct Customer' ? directCustomerReference(directPhone) : cleanText(draft.referenceNo).toUpperCase(),
      notes: cleanText(draft.notes),
      discount: draft.discount || 0,
      otherCharges: draft.otherCharges || 0,
      gstRate: draft.gstEnabled ? (draft.gstRate || 0) : 0,
      gstType: draft.gstEnabled ? (draft.gstType || 'CGST_SGST') : 'CGST_SGST',
    };

    if (!isFilled(next.billNo) || !isFilled(next.date) || !isFilled(next.dueDate) || !isFilled(next.partyName) || !isFilled(next.partyAddress) || !isFilled(next.state)) {
      setError('Bill number, dates, party name, party address and state are mandatory.');
      return;
    }
    if (!isSameOrAfter(next.dueDate, next.date)) {
      setError('Due date cannot be before the invoice date.');
      return;
    }
    const normalizedPhone = directPhone.replace(/\D/g, '');
    if (draftKind === 'Direct Customer' && (normalizedPhone.length < 7 || normalizedPhone.length > 15)) {
      setError('Enter a valid customer phone number with 7 to 15 digits.');
      return;
    }
    const partyGstin = next.partyGstin ?? '';
    if (isFilled(partyGstin) && !isValidGstin(partyGstin, true)) {
      setError('Enter a valid party GSTIN, or use URP for an unregistered party.');
      return;
    }
    if (!hasValidItems(next.items)) {
      setError('Add at least one material line with material, quantity and rate.');
      return;
    }
    if (next.discount > taxableAmount(next.items) + next.otherCharges) {
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
    const total = billTotal(next);
    const amountToRecord = draftKind !== 'Direct Customer' || paymentChoice === 'Credit sale'
      ? 0
      : paymentChoice === 'Full payment' ? total : paymentAmount;
    if (draftKind === 'Direct Customer' && paymentChoice === 'Partial payment' && (amountToRecord <= 0 || amountToRecord >= total)) {
      setError(`Partial payment must be more than zero and less than the invoice total of ${currency(total)}.`);
      return;
    }
    if (draftKind === 'Direct Customer' && amountToRecord > 0 && paymentMode !== 'Cash' && !isFilled(paymentReference)) {
      setError('Transaction reference is mandatory for bank transfer, cheque, UPI and card payments.');
      return;
    }
    try {
      await addBill(next);
      if (amountToRecord > 0) {
        const payment: Payment = {
          id: uid('pay'),
          paymentNo: nextDocumentNo('RCPT', data.payments.map((entry) => entry.paymentNo)),
          date: next.date,
          category: 'Bill',
          targetId: next.id,
          billId: next.id,
          partyName: next.partyName,
          direction: 'Received',
          amount: amountToRecord,
          mode: paymentMode,
          reference: cleanText(paymentReference).toUpperCase(),
          notes: `${paymentChoice} received with direct customer invoice ${next.billNo}.`,
          createdAt: new Date().toISOString(),
        };
        try {
          await addPayment(payment);
        } catch (paymentError) {
          setOpen(false);
          window.alert(`Invoice ${next.billNo} was saved, but its payment could not be recorded. Open Payments and record ${currency(amountToRecord)} against this invoice. ${paymentError instanceof Error ? paymentError.message : ''}`);
          return;
        }
      }
      setOpen(false);
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Bill could not be saved.');
    }
  };

  const changeType = (kind: InvoiceKind) => {
    setError('');
    setDraftKind(kind);
    setDirectPhone('');
    setPaymentChoice('Full payment');
    setPaymentAmount(0);
    setPaymentMode('Cash');
    setPaymentReference('');
    setDraft({ ...empty(kind), items: draft.items });
  };

  const openCreate = (kind: InvoiceKind = 'Client') => {
    setDraftKind(kind);
    setDraft(empty(kind));
    setDirectPhone('');
    setPaymentChoice('Full payment');
    setPaymentAmount(0);
    setPaymentMode('Cash');
    setPaymentReference('');
    setError('');
    setOpen(true);
  };

  const printBill = (bill: Bill) => {
    setView(bill);
    printInvoiceWhenReady();
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Accounts receivable & payable"
        title="Bills & invoices"
        description="Create supplier bills, project invoices and direct customer sales with GST, IGST, instant payment or credit tracking."
        actions={(
          <>
            <button className="button secondary" onClick={() => downloadCsv('bills.csv', filtered.map((bill) => ({
              Bill: bill.billNo,
              Type: isDirectCustomerBill(bill) ? 'Direct Customer' : bill.type,
              Date: bill.date,
              DueDate: bill.dueDate,
              Party: bill.partyName,
              PartyGSTIN: bill.partyGstin ?? '',
              GST: bill.gstEnabled ? `${bill.gstRate}%` : 'No GST',
              Total: billTotal(bill),
              Balance: billBalance(data, bill),
              Status: bill.status,
            })))}><Download size={17} /> Export</button>
            <button className="button primary" disabled={!data.materials.length} onClick={() => openCreate('Client')}><Plus size={17} /> New invoice</button>
          </>
        )}
      />

      <section className="panel table-panel">
        <div className="table-toolbar split-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search bill, party or status..." />
          <div className="segmented">{(['All', 'Purchase', 'Client', 'Direct Customers'] as const).map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Bill</th><th>Type / date</th><th>Party</th><th>GST</th><th>Total</th><th>Paid</th><th>Balance</th><th>Stock posting</th><th>Status</th><th /></tr></thead>
            <tbody>{filtered.map((bill) => {
              const balance = billBalance(data, bill);
              const total = billTotal(bill);
              return (
                <tr key={bill.id}>
                  <td><strong>{bill.billNo}</strong><span>Due {formatDate(bill.dueDate)}</span></td>
                  <td><span className={`soft-badge ${bill.type === 'Purchase' ? 'warning-badge' : ''}`}>{isDirectCustomerBill(bill) ? 'Direct Customer' : bill.type}</span><span>{formatDate(bill.date)}</span></td>
                  <td><strong>{bill.partyName}</strong><span>{bill.partyGstin ? `GSTIN ${bill.partyGstin}` : bill.type === 'Purchase' ? 'Supplier payable' : isDirectCustomerBill(bill) ? `${directCustomerPhone(bill)} · Store customer` : 'Client receivable'}</span></td>
                  <td><span className={`soft-badge ${bill.gstEnabled ? '' : 'warning-badge'}`}>{bill.gstEnabled ? `${bill.gstRate}% ${bill.gstType === 'IGST' ? 'IGST' : 'GST'}` : 'No GST'}</span></td>
                  <td><strong>{currency(total)}</strong></td>
                  <td>{currency(total - balance)}</td>
                  <td><strong className={balance > 0 ? 'negative-text' : 'positive-text'}>{currency(balance)}</strong></td>
                  <td><span className={`soft-badge ${bill.inventoryPosting === 'Auto Post' ? '' : 'warning-badge'}`}>{bill.inventoryPosting}</span></td>
                  <td><span className={`status-pill status-${bill.status.toLowerCase().replaceAll(' ', '-')}`}>{bill.status}</span></td>
                  <td><div className="row-actions"><button className="icon-button" onClick={() => setView(bill)}><Eye size={16} /></button><button className="icon-button" onClick={() => printBill(bill)}><Printer size={16} /></button><button className="icon-button danger" onClick={() => { if (confirm(`Delete ${bill.billNo}?`)) void deleteBill(bill.id).catch(() => undefined); }}><Trash2 size={16} /></button></div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </section>

      <Modal open={open} title="Create bill / invoice" subtitle="Choose supplier purchase, project client or a direct store customer." onClose={() => setOpen(false)} wide>
        <form className="form-stack" onSubmit={submit}>
          {error && <div className="alert danger-alert">{error}</div>}
          <div className="segmented form-segmented">
            <button type="button" className={draftKind === 'Purchase' ? 'active' : ''} onClick={() => changeType('Purchase')}>Purchase bill</button>
            <button type="button" className={draftKind === 'Client' ? 'active' : ''} onClick={() => changeType('Client')}>Project client</button>
            <button type="button" className={draftKind === 'Direct Customer' ? 'active' : ''} onClick={() => changeType('Direct Customer')}>Direct customer</button>
          </div>

          <div className="form-grid three">
            <label><span>Invoice / bill number *</span><input required value={draft.billNo} onChange={(event) => setDraft({ ...draft, billNo: event.target.value })} /></label>
            <label><span>Invoice date *</span><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
            <label><span>Due date *</span><input required type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label>
            {draftKind === 'Purchase' ? (
              <label className="span-2"><span>Supplier (optional — pick to auto-fill, or type party name manually below)</span><select value={draft.supplierId ?? ''} onChange={(event) => { const supplier = data.suppliers.find((item) => item.id === event.target.value); setDraft({ ...draft, supplierId: event.target.value || undefined, partyName: supplier?.name ?? draft.partyName, partyAddress: supplier?.address ?? draft.partyAddress, partyGstin: supplier?.gstin ?? draft.partyGstin }); }}><option value="">Manual entry — no saved supplier</option>{data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            ) : draftKind === 'Client' ? (
              <label className="span-2"><span>Project / client (optional — pick to auto-fill, or type party name manually below)</span><select value={draft.siteId ?? ''} onChange={(event) => { const site = data.sites.find((item) => item.id === event.target.value); setDraft({ ...draft, siteId: event.target.value || undefined, partyName: site?.clientName || site?.name || draft.partyName, partyAddress: site?.location ?? draft.partyAddress, deliveryAddress: site?.location ?? draft.deliveryAddress }); }}><option value="">Manual entry — no saved site</option>{data.sites.map((site) => <option key={site.id} value={site.id}>{site.name} — {site.clientName}</option>)}</select></label>
            ) : (
              <div className="alert info-alert span-2">This sale will deduct stock and any amount received now will be added automatically to Payments. Unpaid balance will appear in Credit.</div>
            )}
            <label className="span-2"><span>{draftKind === 'Direct Customer' ? 'Customer name' : 'Party / client name'} *</span><input required value={draft.partyName} onChange={(event) => setDraft({ ...draft, partyName: event.target.value })} placeholder={draftKind === 'Direct Customer' ? 'Customer full name' : "Type or edit the billed party's name"} /></label>
            {draftKind === 'Direct Customer' && <label><span>Customer phone *</span><input required inputMode="tel" value={directPhone} onChange={(event) => setDirectPhone(event.target.value)} placeholder="10-digit mobile number" /></label>}
            <label className="span-2"><span>Party address *</span><textarea required rows={3} value={draft.partyAddress ?? ''} onChange={(event) => setDraft({ ...draft, partyAddress: event.target.value })} /></label>
            <label><span>Party GSTIN / URP</span><input maxLength={15} value={draft.partyGstin ?? ''} onChange={(event) => setDraft({ ...draft, partyGstin: event.target.value.toUpperCase() })} placeholder="GSTIN, URP, or leave blank" /></label>
            <label><span>State *</span><input required value={draft.state ?? ''} onChange={(event) => setDraft({ ...draft, state: event.target.value.toUpperCase() })} placeholder="TAMIL NADU" /></label>
            <label><span>E-way bill no.</span><input value={draft.ewayBillNo ?? ''} onChange={(event) => setDraft({ ...draft, ewayBillNo: event.target.value })} /></label>
            <label><span>Vehicle number</span><input value={draft.vehicleNo ?? ''} onChange={(event) => setDraft({ ...draft, vehicleNo: event.target.value.toUpperCase() })} /></label>
            <label className="span-2"><span>Delivered to {draftKind === 'Client' ? '*' : ''}</span><input required={draftKind === 'Client'} value={draft.deliveryAddress ?? ''} onChange={(event) => setDraft({ ...draft, deliveryAddress: event.target.value })} placeholder={draftKind === 'Direct Customer' ? 'Optional delivery address / pickup note' : ''} /></label>
          </div>

          <TransactionItemsEditor materials={data.materials} items={draft.items} onChange={(items) => setDraft({ ...draft, items })} showTax={false} />
          <div className="form-grid three">
            <label><span>Discount</span><NumberField value={draft.discount} onChange={(value) => setDraft({ ...draft, discount: value ?? 0 })} min="0" step="0.01" /></label>
            <label><span>Other charges</span><NumberField value={draft.otherCharges} onChange={(value) => setDraft({ ...draft, otherCharges: value ?? 0 })} min="0" step="0.01" /></label>
            <label><span>Stock posting</span><select value={draft.inventoryPosting} onChange={(event) => setDraft({ ...draft, inventoryPosting: event.target.value as Bill['inventoryPosting'] })}><option>Auto Post</option><option>Accounting Only</option></select><small>{draft.type === 'Purchase' ? 'Auto Post adds invoice quantities to central stock.' : 'Auto Post deducts invoice quantities from central stock.'}</small></label>
          </div>
          <div className="form-grid three">
            <label className="toggle-label span-2"><input type="checkbox" checked={draft.gstEnabled} onChange={(event) => setDraft({ ...draft, gstEnabled: event.target.checked })} /><span><strong>Include GST on this bill</strong><small>Turn on to charge GST. Taxable amount and GST auto-calculate below.</small></span></label>
            {draft.gstEnabled && <label><span>GST % *</span><NumberField required value={draft.gstRate} onChange={(value) => setDraft({ ...draft, gstRate: value ?? 0 })} min="0" step="0.01" /></label>}
            {draft.gstEnabled && (
              <label className="toggle-label">
                <input type="checkbox" checked={draft.gstType === 'IGST'} onChange={(event) => setDraft({ ...draft, gstType: event.target.checked ? 'IGST' : 'CGST_SGST' })} />
                <span><strong>Inter-state (IGST)</strong><small>When on, GST prints as a single IGST line instead of split CGST/SGST.</small></span>
              </label>
            )}
          </div>
          <div className="document-total">
            <span>Taxable amount {currency(taxableAmount(draft.items))}</span>
            {draft.gstEnabled && <span>GST {currency(gstAmount(draft.items, draft.gstEnabled, draft.gstRate))}</span>}
            <span>Charges {currency(draft.otherCharges)}</span>
            <span>Discount -{currency(draft.discount)}</span>
            <strong>Grand total {currency(billTotal(draft))}</strong>
          </div>
          {draftKind === 'Direct Customer' && (
            <section className="direct-payment-box">
              <div>
                <strong>Payment at billing</strong>
                <span>Choose how much the customer is paying now. The receipt is saved automatically in Payments.</span>
              </div>
              <div className="segmented form-segmented">
                {(['Full payment', 'Partial payment', 'Credit sale'] as const).map((choice) => (
                  <button type="button" key={choice} className={paymentChoice === choice ? 'active' : ''} onClick={() => setPaymentChoice(choice)}>{choice}</button>
                ))}
              </div>
              {paymentChoice === 'Credit sale' ? (
                <div className="alert info-alert">No payment will be recorded now. The full amount of <strong>{currency(billTotal(draft))}</strong> will appear in the Credit tracker.</div>
              ) : (
                <div className="form-grid three">
                  <label><span>Amount received *</span>{paymentChoice === 'Full payment' ? <input readOnly value={currency(billTotal(draft))} /> : <NumberField required value={paymentAmount} onChange={(value) => setPaymentAmount(value ?? 0)} min="0.01" step="0.01" />}</label>
                  <label><span>Payment mode *</span><select required value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as Payment['mode'])}><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option></select></label>
                  <label><span>Transaction reference {paymentMode !== 'Cash' ? '*' : ''}</span><input required={paymentMode !== 'Cash'} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="UTR / cheque / transaction ID" /></label>
                </div>
              )}
            </section>
          )}
          <label><span>Notes / terms</span><textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
          <div className="form-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button primary">{draftKind === 'Direct Customer' ? 'Save invoice & payment' : 'Save bill'}</button></div>
        </form>
      </Modal>

      <Modal open={Boolean(view)} title={view?.billNo ?? 'Bill'} subtitle="Print-ready invoice view" onClose={() => setView(null)} wide>
        {view && (() => {
          const subtotal = taxableAmount(view.items);
          const tax = gstAmount(view.items, view.gstEnabled, view.gstRate);
          const halfRate = view.gstRate / 2;
          const grandTotal = billTotal(view);
          return (
            <div className="vmv-invoice">
              <div className="vmv-company-box">
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Company logo" className="vmv-logo" />
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
                  {isDirectCustomerBill(view) && directCustomerPhone(view) && <p><strong>Phone</strong> {directCustomerPhone(view)}</p>}
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
                <div className="vmv-state"><strong>STATE: {view.state || '—'}</strong><span><strong>PARTY-GSTIN :</strong> {view.partyGstin || 'URP'}</span></div>
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
                  <tr><td colSpan={2} rowSpan={view.gstEnabled ? (view.gstType === 'IGST' ? 5 : 6) : 4} className="vmv-words"><strong>Amount in word Rupees:</strong> {amountInIndianWords(grandTotal)}</td><td /><td colSpan={2}><strong>Taxable Amount</strong></td><td><strong>{numberForInvoice(subtotal)}</strong></td></tr>
                  <tr><td /><td colSpan={2}><strong>Other Charges</strong></td><td><strong>{numberForInvoice(view.otherCharges)}</strong></td></tr>
                  <tr><td /><td colSpan={2}><strong>Discount</strong></td><td><strong>-{numberForInvoice(view.discount)}</strong></td></tr>
                  {view.gstEnabled && view.gstType === 'IGST' && <tr><td /><td colSpan={2}><strong>IGST@{numberForInvoice(view.gstRate)}%</strong></td><td><strong>{numberForInvoice(tax)}</strong></td></tr>}
                  {view.gstEnabled && view.gstType !== 'IGST' && <tr><td /><td colSpan={2}><strong>CGST@{numberForInvoice(halfRate)}%</strong></td><td><strong>{numberForInvoice(tax / 2)}</strong></td></tr>}
                  {view.gstEnabled && view.gstType !== 'IGST' && <tr><td /><td colSpan={2}><strong>SGST@{numberForInvoice(halfRate)}%</strong></td><td><strong>{numberForInvoice(tax / 2)}</strong></td></tr>}
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
              <div className="form-actions no-print"><button className="button primary" onClick={printInvoiceWhenReady}><Printer size={17} /> Print invoice</button></div>
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
