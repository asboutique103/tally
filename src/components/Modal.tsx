import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Modal({ open, title, subtitle, onClose, children, wide = false, extraWide = false }: { open: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean; extraWide?: boolean }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`modal-card ${wide ? 'modal-wide' : ''} ${extraWide ? 'modal-extra-wide' : ''}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  );
}
