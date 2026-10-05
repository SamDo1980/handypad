import { element } from '../lib/dom.js';
import { t } from '../lib/locale.js';
import { formatPrice } from '../lib/storefront.js';
import { paymentErrorMessage } from '../checkout/payment-errors.js';
import { secureURL } from '../checkout/payment-service.js';

// Both methods are hosted gateways: the customer pays in a separate window and the page
// waits for the backend to confirm. `currency` is what the gateway bills in.
const GATEWAYS = {
  zalopay: { title: 'Pay with ZaloPay', steps: ['Open ZaloPay', 'Open QR scanner', 'Scan and confirm'], currency: 'VND', currencyNote: 'ZaloPay payments are charged in VND.' },
  paypal: { title: 'Pay with PayPal', steps: ['Open the PayPal window', 'Log in to PayPal', 'Review and confirm'], currency: 'USD', currencyNote: 'PayPal payments are charged in USD.' },
};

export function paymentLogo(method) {
  const frame = element('span', `payment-logo payment-logo-${method}`);
  if (method === 'paypal') {
    frame.setAttribute('role', 'img'); frame.setAttribute('aria-label', 'PayPal');
    frame.append(element('span', '', 'Pay'), element('span', '', 'Pal'));
  } else {
    const image = element('img'); image.src = './assets/Zalopay-logo.png'; image.alt = 'ZaloPay'; frame.append(image);
  }
  return frame;
}

export function createPaymentModal(checkout) {
  const dialog = element('dialog', 'payment-modal'); dialog.setAttribute('aria-labelledby', 'payment-modal-title');
  let opener, previousOverflow, method, update = () => {}, gatewayWindow = null, gatewayTimer;
  function cleanup() { dialog.replaceChildren(); clearInterval(gatewayTimer); gatewayWindow = null; document.body.style.overflow = previousOverflow; }
  function close() { if (dialog.open) { dialog.close(); cleanup(); } }
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
  // The close event arrives a little after the dialog closes (Esc closes it without close()),
  // so it must not wipe a dialog that has been reopened in the meantime.
  dialog.addEventListener('close', () => { if (dialog.open) return; cleanup(); if (opener?.isConnected && !opener.disabled) opener.focus(); });
  checkout.subscribe(state => { if (!dialog.open) return; if (!state.canPay || state.order.payment.method !== method) close(); else update(state); });
  function open(trigger) {
    const state = checkout.getState(); if (!state.canPay) return;
    if (dialog.open) return;
    opener = trigger; method = state.order.payment.method; dialog.dataset.paymentMethod = method;
    const gatewayInfo = GATEWAYS[method];
    const simulation = state.paymentMode === 'simulation';
    const header = element('div', 'payment-modal-header');
    const title = element('h2', '', t(gatewayInfo.title)); title.id = 'payment-modal-title';
    const dismiss = element('button', 'payment-modal-close', '×'); dismiss.type = 'button'; dismiss.setAttribute('aria-label', t('Close')); dismiss.addEventListener('click', close);
    const heading = element('div', 'payment-modal-heading'); heading.append(title);
    header.append(heading, dismiss); dialog.append(header);
    const due = element('div', 'payment-modal-due'), dueLabel = element('span'), dueValue = element('strong'); due.append(dueLabel, dueValue); dialog.append(due);
    const formError = element('p', 'payment-form-error'); formError.setAttribute('role', 'alert'); formError.hidden = true;
    const status = element('p', 'payment-modal-status'); status.setAttribute('role', 'status');
    const action = element('button', 'button button-primary modal-pay'); action.type = 'button';
    const content = element('div', 'payment-modal-content'); dialog.append(content, formError, status, action);
    const steps = element('ol', 'gateway-steps'); for (const text of gatewayInfo.steps) steps.append(element('li', '', t(text)));
    const chargeNote = element('p', 'payment-charge-note');
    content.append(steps, chargeNote);
    const gateway = element('div', 'simulation-gateway'); gateway.hidden = true;
    const back = element('button', 'button', t('Return to checkout')); back.type = 'button'; gateway.append(paymentLogo(method), back); content.append(gateway);
    back.addEventListener('click', () => { gateway.hidden = true; action.hidden = false; update(checkout.getState()); action.focus(); });
    action.addEventListener('click', async () => {
      if (simulation) { gateway.hidden = false; action.hidden = true; back.focus(); if (checkout.getState().simulationStatus === 'idle') await checkout.startPayment(); }
      else {
        // Open the window during the click so popup blockers allow it, then point it at the gateway.
        const existing = secureURL(checkout.getState().checkoutURL);
        gatewayWindow = window.open(existing ?? 'about:blank', '_blank');
        if (!existing) await checkout.startPayment();
        const url = secureURL(checkout.getState().checkoutURL);
        if (!url) { gatewayWindow?.close(); gatewayWindow = null; }
        if (url) { if (gatewayWindow) { gatewayWindow.opener = null; if (!existing) gatewayWindow.location.href = url; } else gatewayWindow = null;
          clearInterval(gatewayTimer); gatewayTimer = setInterval(() => { if (gatewayWindow?.closed) { clearInterval(gatewayTimer); update(checkout.getState()); } }, 500); }
      }
    });
    update = current => {
      const p = current.order.payment, pending = simulation ? current.simulationStatus === 'pending' : p.status === 'pending';
      dueLabel.textContent = t('Full product payment due now'); dueValue.textContent = formatPrice(p.amountDueNow, current.order.currency);
      // The gateway may bill in another currency than the storefront shows; say so before the customer leaves.
      const differs = gatewayInfo.currency !== current.order.currency;
      chargeNote.textContent = !differs ? '' : current.charge ? `${t(gatewayInfo.currencyNote)} ${t('Amount charged')}: ${formatPrice(current.charge.amount, current.charge.currency)}` : t(gatewayInfo.currencyNote);
      chargeNote.hidden = !differs;
      formError.textContent = current.error ? t(paymentErrorMessage(current.error)) : ''; formError.hidden = !current.error;
      status.textContent = current.busy ? t('Processing…') : p.status === 'confirmed' ? t('Payment confirmed') : pending ? t('Waiting for payment confirmation') : '';
      action.textContent = t(current.busy ? 'Processing…' : pending ? 'Reopen payment window' : 'Open payment window');
      action.disabled = current.busy || p.status === 'confirmed';
    };
    previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.showModal(); update(state);
    dismiss.focus();
  }
  return { element: dialog, open };
}
