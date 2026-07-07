import { Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PageHeader } from '../components/PageHeader';
import { cleanText, compactPhone, isFilled, isValidGstin, isValidIndianPhone, isZeroOrPositive } from '../lib/validation';
import { useApp } from '../store/AppContext';
import type { AppSettings } from '../types';

const isValidPan = (value?: string) => !value || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
const isValidIfsc = (value?: string) => !value || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);

export function Settings() {
  const { data, setData } = useApp();
  const [draft, setDraft] = useState(data.settings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: AppSettings = {
      ...draft,
      companyName: cleanText(draft.companyName),
      gstin: cleanText(draft.gstin).toUpperCase(),
      panNo: cleanText(draft.panNo).toUpperCase(),
      phone: compactPhone(draft.phone),
      email: cleanText(draft.email).toLowerCase(),
      address: cleanText(draft.address),
      bankName: cleanText(draft.bankName),
      bankBranch: cleanText(draft.bankBranch),
      bankAccountNo: cleanText(draft.bankAccountNo),
      bankIfsc: cleanText(draft.bankIfsc).toUpperCase(),
      invoicePrefix: cleanText(draft.invoicePrefix).toUpperCase(),
    };

    if (!isFilled(next.companyName) || !isFilled(next.gstin) || !isFilled(next.phone) || !isFilled(next.email) || !isFilled(next.address) || !isFilled(next.financialYearStart) || !isFilled(next.invoicePrefix)) {
      setError('Company name, GSTIN, phone, email, address, financial year and invoice prefix are mandatory.');
      return;
    }
    if (!isValidGstin(next.gstin)) {
      setError('Enter a valid company GSTIN.');
      return;
    }
    if (!isValidPan(next.panNo)) {
      setError('Enter a valid company PAN number.');
      return;
    }
    if (!isValidIndianPhone(next.phone)) {
      setError('Enter a valid 10-digit company phone number.');
      return;
    }
    if (!isZeroOrPositive(next.defaultTaxRate)) {
      setError('Default tax rate cannot be negative.');
      return;
    }
    if (!isFilled(next.bankName) || !isFilled(next.bankBranch) || !isFilled(next.bankAccountNo) || !isFilled(next.bankIfsc)) {
      setError('Bank name, branch, account number and IFSC are mandatory for invoices.');
      return;
    }
    if (!isValidIfsc(next.bankIfsc)) {
      setError('Enter a valid IFSC code.');
      return;
    }

    setData((current) => ({ ...current, settings: next }));
    setError('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Configuration" title="Company & system settings" description="Control invoice identity, tax defaults and stock controls." />
      <section className="settings-grid">
        <article className="panel">
          <div className="panel-header"><div><span className="eyebrow">Business profile</span><h2>Company information</h2></div></div>
          <form className="form-stack" onSubmit={submit}>
            {error && <div className="alert danger-alert">{error}</div>}
            <div className="form-grid two">
              <label className="span-2"><span>Company name *</span><input required value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} /></label>
              <label><span>GSTIN *</span><input required maxLength={15} value={draft.gstin} onChange={(event) => setDraft({ ...draft, gstin: event.target.value.toUpperCase() })} /></label>
              <label><span>Company PAN No.</span><input maxLength={10} value={draft.panNo ?? ''} onChange={(event) => setDraft({ ...draft, panNo: event.target.value.toUpperCase() })} /></label>
              <label><span>Phone *</span><input required inputMode="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
              <label><span>Email *</span><input required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
              <label><span>Currency *</span><select required value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}><option value="INR">INR - Indian Rupee</option><option value="USD">USD - US Dollar</option><option value="AED">AED - UAE Dirham</option></select></label>
              <label><span>Default tax rate % *</span><input required type="number" min="0" step="0.01" value={draft.defaultTaxRate} onChange={(event) => setDraft({ ...draft, defaultTaxRate: Number(event.target.value) })} /></label>
              <label><span>Financial year starts *</span><input required type="date" value={draft.financialYearStart} onChange={(event) => setDraft({ ...draft, financialYearStart: event.target.value })} /></label>
              <label><span>Invoice prefix *</span><input required value={draft.invoicePrefix} onChange={(event) => setDraft({ ...draft, invoicePrefix: event.target.value.toUpperCase() })} /></label>
              <label className="span-2"><span>Registered address *</span><textarea required rows={4} value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
              <label><span>Bank name *</span><input required value={draft.bankName ?? ''} onChange={(event) => setDraft({ ...draft, bankName: event.target.value })} /></label>
              <label><span>Bank branch *</span><input required value={draft.bankBranch ?? ''} onChange={(event) => setDraft({ ...draft, bankBranch: event.target.value })} /></label>
              <label><span>Bank A/C No. *</span><input required value={draft.bankAccountNo ?? ''} onChange={(event) => setDraft({ ...draft, bankAccountNo: event.target.value })} /></label>
              <label><span>Bank IFSC *</span><input required maxLength={11} value={draft.bankIfsc ?? ''} onChange={(event) => setDraft({ ...draft, bankIfsc: event.target.value.toUpperCase() })} /></label>
              <label className="toggle-label span-2"><input type="checkbox" checked={draft.lowStockAlerts} onChange={(event) => setDraft({ ...draft, lowStockAlerts: event.target.checked })} /><span><strong>Low-stock alerts</strong><small>Show warnings when available quantity reaches the material reorder level.</small></span></label>
              <label className="toggle-label span-2"><input type="checkbox" checked={draft.strictStockControl} onChange={(event) => setDraft({ ...draft, strictStockControl: event.target.checked })} /><span><strong>Strict stock control</strong><small>Prevent material issues and auto-posting client invoices from creating negative stock.</small></span></label>
            </div>
            <div className="form-actions"><span className={saved ? 'save-message visible' : 'save-message'}>Settings saved</span><button className="button primary"><Save size={17} /> Save settings</button></div>
          </form>
        </article>
      </section>
    </div>
  );
}
