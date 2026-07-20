import { KeyRound, Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { NumberField } from '../components/NumberField';
import { PageHeader } from '../components/PageHeader';
import { cleanText, compactPhone, isFilled, isValidGstin, isValidIndianPhone, isZeroOrPositive } from '../lib/validation';
import { isSupabaseConfigured } from '../lib/supabase';
import { useApp } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import type { AppSettings } from '../types';

const isValidPan = (value?: string) => !value || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
const isValidIfsc = (value?: string) => !value || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);

export function Settings() {
  const { data, saving, updateSettings } = useApp();
  const { changePassword } = useAuth();
  const [draft, setDraft] = useState(data.settings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: AppSettings = {
      ...draft,
      currency: 'INR',
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

    try {
      await updateSettings(next);
      setError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Settings could not be saved.');
    }
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordStatus('');
    if (passwords.next !== passwords.confirm) {
      setPasswordError('The new password and confirmation do not match.');
      return;
    }
    setChangingPassword(true);
    const result = await changePassword(passwords.current, passwords.next);
    setChangingPassword(false);
    if (!result.ok) {
      setPasswordError(result.error ?? 'The password could not be changed.');
      return;
    }
    setPasswordError('');
    setPasswordStatus('Password changed successfully. Other sessions have been signed out.');
    setPasswords({ current: '', next: '', confirm: '' });
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
              <label><span>Currency</span><select value="INR" disabled aria-label="Currency"><option value="INR">INR - Indian Rupee</option></select><small>This GST build uses Indian currency and number formatting.</small></label>
              <label><span>Default tax rate % *</span><NumberField required value={draft.defaultTaxRate} onChange={(value) => setDraft({ ...draft, defaultTaxRate: value ?? 0 })} min="0" step="0.01" /></label>
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
              <div className="form-actions"><span className={saved ? 'save-message visible' : 'save-message'}>Settings saved</span><button className="button primary" disabled={saving}><Save size={17} /> {saving ? 'Saving…' : 'Save settings'}</button></div>
          </form>
        </article>
        {isSupabaseConfigured && (
          <article className="panel">
            <div className="panel-header"><div><span className="eyebrow">Account security</span><h2>Change password</h2></div><KeyRound size={20} /></div>
            <form className="form-stack" onSubmit={submitPassword}>
              {passwordError && <div className="alert danger-alert">{passwordError}</div>}
              {passwordStatus && <div className="alert">{passwordStatus}</div>}
              <div className="form-grid two">
                <label><span>Current password *</span><input required type="password" autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} /></label>
                <label><span>New password *</span><input required minLength={12} type="password" autoComplete="new-password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} /></label>
                <label><span>Confirm new password *</span><input required minLength={12} type="password" autoComplete="new-password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} /></label>
              </div>
              <div className="form-actions"><button className="button secondary" disabled={changingPassword}><KeyRound size={17} /> {changingPassword ? 'Changing…' : 'Change password'}</button></div>
            </form>
          </article>
        )}
      </section>
    </div>
  );
}
