import { element } from '../lib/dom.js';
import { t } from '../lib/locale.js';
import { formatPrice } from '../lib/storefront.js';
import { formatCardNumber, formatExpiry, validateCard, paymentErrorMessage } from '../checkout/card-validation.js';
import { secureURL, openPaymentPopup, onPaymentReturn } from '../checkout/payment-service.js';
import { bankTransferConfig } from '../checkout/bank-transfer-config.js';

export function createPaymentModal(checkout) {
  const dialog = element('dialog', 'payment-modal'); dialog.setAttribute('aria-labelledby', 'payment-modal-title');
  let opener, previousOverflow, method, update = () => {}, clear = () => {}, gatewayWindow = null, gatewayTimer, returnFailed = false;
  function close() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
  dialog.addEventListener('close', () => { clear(); dialog.replaceChildren(); clearInterval(gatewayTimer); gatewayWindow = null; document.body.style.overflow = previousOverflow; if (opener?.isConnected && !opener.disabled) opener.focus(); });
  // The payment popup came back from the gateway (and closes itself): recheck the order right away.
  onPaymentReturn(outcome => {
    gatewayWindow?.close(); gatewayWindow = null; clearInterval(gatewayTimer);
    returnFailed = outcome === 'failed';
    checkout.checkStatus().then(() => update(checkout.getState()));
  });
  checkout.subscribe(state => { if (!dialog.open) return; if (!state.canPay || state.order.payment.method !== method) close(); else update(state); });
  function open(trigger) {
    const state = checkout.getState(); if (!state.canPay) return;
    if (dialog.open) return;
    opener = trigger; method = state.order.payment.method; dialog.dataset.paymentMethod = method;
    const simulation = state.paymentMode === 'simulation';
    const titles = { card: 'Card payment', paypal: 'Pay with PayPal', zalopay: 'Pay with ZaloPay', bank_transfer: 'Bank transfer (VietQR)' };
    const header = element('div', 'payment-modal-header');
    const title = element('h2', '', t(titles[method])); title.id = 'payment-modal-title';
    const dismiss = element('button', 'payment-modal-close', '×'); dismiss.type = 'button'; dismiss.setAttribute('aria-label', t('Close')); dismiss.addEventListener('click', close);
    const heading = element('div', 'payment-modal-heading'); heading.append(title);
    header.append(heading, dismiss); dialog.append(header);
    const due = element('div', 'payment-modal-due'), dueLabel = element('span'), dueValue = element('strong'); due.append(dueLabel, dueValue); dialog.append(due);
    const formError = element('p', 'payment-form-error'); formError.setAttribute('role', 'alert'); formError.hidden = true;
    const status = element('p', 'payment-modal-status'); status.setAttribute('role', 'status');
    const action = element('button', 'button button-primary modal-pay'); action.type = 'button';
    const content = element('div', 'payment-modal-content'); dialog.append(content, formError, status, action);
    let draw = () => {}, values = {}, touched = new Set(), fields = new Map();
    clear = () => { for (const field of fields.values()) field.input.value = ''; values = {}; fields.clear(); touched.clear(); };
    function validate(all = false) {
      const errors = validateCard(values);
      for (const [key, field] of fields) {
        const message = (all || touched.has(key)) ? errors[key] : null;
        field.error.textContent = message ? t(message) : ''; field.error.hidden = !message;
        field.input.setAttribute('aria-invalid', String(Boolean(message)));
        field.wrapper?.classList.toggle('is-invalid', Boolean(message));
      }
      return errors;
    }
    // Open the popup during the click so popup blockers allow it, then point it at the gateway.
    async function openGateway() {
      const existing = secureURL(checkout.getState().checkoutURL);
      returnFailed = false;
      gatewayWindow = openPaymentPopup(existing ?? 'about:blank');
      if (!existing) await checkout.startPayment();
      const url = secureURL(checkout.getState().checkoutURL);
      if (!url) { gatewayWindow?.close(); gatewayWindow = null; return; }
      if (gatewayWindow) { gatewayWindow.opener = null; if (!existing) gatewayWindow.location.href = url; }
      clearInterval(gatewayTimer); gatewayTimer = setInterval(() => { if (gatewayWindow?.closed) { clearInterval(gatewayTimer); gatewayWindow = null; checkout.checkStatus().then(() => update(checkout.getState())); } }, 500);
    }
    if (method === 'card' && simulation) {
      const brands = element('div', 'payment-card-logos');
      for (const brand of ['visa','mastercard']) { const frame = element('span', `payment-logo payment-logo-${brand}`), img = element('img'); img.src = `${'./'}assets/${brand}.png`; img.alt = brand === 'visa' ? 'Visa' : 'Mastercard'; frame.append(img); brands.append(frame); } content.append(brands);
      const form = element('form', 'card-fields'); form.id = 'payment-card-form'; form.noValidate = true; form.autocomplete = 'off';
      action.type = 'submit'; action.setAttribute('form', form.id);
      for (const [key, label, placeholder, max] of [['number','Card number','1234 1234 1234 1234',23],['expiry','Expiry','MM / YY',7],['cvv','CVV / CVC','CVC',4]]) {
        values[key] = '';
        const wrapper = element('div', `card-field card-field-${key}`), caption = element('label', '', t(label)), control = element('div', 'card-input-control'), input = element('input'), error = element('span', 'field-error');
        input.id = `payment-card-${key}`;
        input.type = key === 'cvv' ? 'password' : 'text';
        input.inputMode = 'numeric';
        input.autocomplete = key === 'number' ? 'cc-number' : key === 'expiry' ? 'cc-exp' : 'cc-csc';
        input.maxLength = max;
        input.placeholder = placeholder;
        caption.htmlFor = input.id;
        if (key === 'number') { const icon = element('span', 'card-number-icon'); icon.setAttribute('aria-hidden', 'true'); control.append(icon); }
        control.append(input);
        error.id = `${input.id}-error`; error.hidden = true; input.setAttribute('aria-describedby', error.id);
        input.addEventListener('blur', () => { touched.add(key); validate(); });
        input.addEventListener('input', () => {
          if (key === 'number') input.value = formatCardNumber(input.value);
          if (key === 'expiry') input.value = formatExpiry(input.value);
          values[key] = input.value;
          if (touched.has(key)) validate();
        });
        fields.set(key, { input, error, wrapper }); wrapper.append(caption,control,error); form.append(wrapper);
      }
      async function submit(event) {
        event.preventDefault();
        // Guard Enter/programmatic submit while the existing attempt is pending, too.
        if (action.disabled) return;
        for (const key of fields.keys()) touched.add(key);
        const errors = validate(true); if (Object.keys(errors).length) { fields.get(Object.keys(errors)[0]).input.focus(); return; }
        // Raw fields never cross into checkout state, service calls, persistence or events.
        await checkout.startPayment();
        // Keep the form stable while waiting; closing the modal clears sensitive fields.
      }
      form.addEventListener('submit', submit); content.append(form);
    } else if (method === 'bank_transfer') {
      const layout = element('div', 'bank-modal-layout'), qr = element('div', 'bank-modal-qr'), details = element('dl', 'payment-summary bank-payment-details');
      const copyStatus = element('p', 'bank-copy-status'); copyStatus.setAttribute('role', 'status'); copyStatus.setAttribute('aria-live', 'polite');
      layout.append(qr, details); content.append(layout, copyStatus);
      let copyTimer;
      async function copyText(value, label) {
        let copied = false;
        try { await navigator.clipboard.writeText(value); copied = true; }
        catch {
          try {
            const helper = element('textarea'); helper.value = value; helper.setAttribute('readonly', ''); helper.style.position = 'fixed'; helper.style.opacity = '0';
            document.body.append(helper); helper.select(); copied = document.execCommand('copy'); helper.remove();
          } catch { copied = false; }
        }
        clearTimeout(copyTimer);
        copyStatus.textContent = t(copied ? 'Copied' : 'Unable to copy');
        copyStatus.dataset.copy = label;
        copyTimer = setTimeout(() => { copyStatus.textContent = ''; copyStatus.removeAttribute('data-copy'); }, 1800);
      }
      function detailRow(label, value, copyLabel = null) {
        const row = element('div');
        const term = element('dt', '', t(label));
        const valueWrap = element('dd', copyLabel ? 'bank-copy-value' : '');
        valueWrap.append(element('span', '', value || '—'));
        if (copyLabel && value) {
          const copy = element('button', 'bank-copy-button', '⧉'); copy.type = 'button'; copy.setAttribute('aria-label', t(copyLabel)); copy.title = t(copyLabel);
          copy.addEventListener('click', () => copyText(value, copyLabel)); valueWrap.append(copy);
        }
        row.append(term, valueWrap); return row;
      }
      draw = current => {
        const bank = simulation ? bankTransferConfig : current.bank; qr.replaceChildren(); details.replaceChildren();
        const url = secureURL(bank?.vietQRImageURL);
        if (url) { const img = element('img'); img.src = url; img.alt = t('Bank Transfer / VietQR'); qr.append(img); }
        else { qr.hidden = true; layout.classList.add('bank-modal-no-qr'); }
        details.append(
          detailRow('Account name', bank?.accountName),
          detailRow('Account number', bank?.accountNumber, 'Copy account number'),
          detailRow('Bank', bank?.bankName),
          detailRow('Transfer method', bank?.method),
          detailRow('Transfer content', bank?.transferContent, 'Copy transfer content'),
        );
      };
      action.remove();
    } else if (method === 'paypal') {
      // Redirect method: the customer approves the payment on PayPal's own page (new tab).
      const brand = element('img', 'paypal-modal-logo'); brand.src = `${'./'}assets/paypal.png`; brand.alt = 'PayPal'; brand.width = 360; brand.height = 91;
      content.append(brand, element('p', 'paypal-modal-note', t('You will finish the payment securely on PayPal.')));
      action.addEventListener('click', async () => {
        await openGateway();
      });
    } else if (method === 'zalopay') {
      const steps = element('ol', 'zalopay-steps'); for (const text of ['Open ZaloPay','Open QR scanner','Scan and confirm']) steps.append(element('li','',t(text))); content.append(steps);
      const gateway = element('div', 'simulation-gateway'); gateway.hidden = true;
      const gatewayBrand = element('img', 'zalopay-gateway-logo'); gatewayBrand.src = `${'./'}assets/Zalopay-logo.png`; gatewayBrand.alt = 'ZaloPay';
      const back = element('button','button',t('Return to checkout')); back.type = 'button'; gateway.append(gatewayBrand, back); content.append(gateway);
      back.addEventListener('click', () => { gateway.hidden = true; action.hidden = false; update(checkout.getState()); action.focus(); });
      action.addEventListener('click', async () => {
        if (simulation) { gateway.hidden = false; action.hidden = true; back.focus(); if (checkout.getState().simulationStatus === 'idle') await checkout.startPayment(); }
        else {
          await openGateway();
        }
      });
    } else {
      action.addEventListener('click', async () => { await checkout.startPayment(); const url = secureURL(checkout.getState().checkoutURL); if (url) { const tab = window.open(url,'_blank'); if(tab) tab.opener = null; } });
    }
    update = current => {
      const p = current.order.payment, pending = simulation ? ['pending','awaiting_confirmation'].includes(current.simulationStatus) : ['pending','awaiting_confirmation'].includes(p.status);
      dueLabel.textContent = t('Amount due now'); dueValue.textContent = formatPrice(p.amountDueNow,current.order.currency);
      formError.textContent = current.error ? t(paymentErrorMessage(current.error)) : ''; formError.hidden = !current.error;
      status.textContent = current.busy ? t('Processing…') : p.status === 'confirmed' ? t('Payment confirmed') : method === 'bank_transfer' && pending ? t('Waiting for transfer confirmation') : pending && returnFailed ? t('Payment was not completed. You can try again.') : pending ? t('Waiting for payment confirmation') : '';
      action.textContent = t(current.busy ? 'Processing…' : method === 'zalopay' ? pending ? 'Reopen payment window' : 'Open payment window' : method === 'paypal' ? pending && !simulation ? 'Reopen payment window' : 'Continue to PayPal' : method === 'bank_transfer' ? 'View bank transfer details' : 'Pay');
      action.disabled = current.busy || p.status === 'confirmed' || (method !== 'zalopay' && !(method === 'paypal' && !simulation) && pending);
      for (const field of fields.values()) field.input.readOnly = current.busy || pending || p.status === 'confirmed';
      draw(current);
    };
    previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.showModal(); update(state);
    if (fields.size) fields.get('number').input.focus(); else dismiss.focus();
    if (method === 'bank_transfer' && !(simulation && state.simulationStatus === 'awaiting_confirmation')) checkout.startPayment();
  }
  return { element: dialog, open };
}
