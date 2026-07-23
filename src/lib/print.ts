const INVOICE_LOGO_SELECTOR = '.vmv-invoice .vmv-logo';

/**
 * Opens the print dialog only after React has rendered the invoice and the
 * packaged logo has decoded. This prevents Electron from capturing an empty
 * image placeholder when an invoice is printed immediately from a list row.
 */
export function printInvoiceWhenReady() {
  const startedAt = Date.now();

  const printWhenLoaded = () => {
    const logo = document.querySelector<HTMLImageElement>(INVOICE_LOGO_SELECTOR);
    if (logo?.complete && logo.naturalWidth > 0) {
      window.print();
      return;
    }

    if (Date.now() - startedAt >= 5000) {
      window.alert('The invoice logo is still loading. Please try printing again.');
      return;
    }

    window.setTimeout(printWhenLoaded, 50);
  };

  window.requestAnimationFrame(printWhenLoaded);
}
