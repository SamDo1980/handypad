import { element } from '../lib/dom.js';
import { t } from '../lib/locale.js';
import { formatPrice } from '../lib/storefront.js';
import { secureURL } from '../checkout/payment-service.js';
import { methodOffered } from '../checkout/order-draft.js';
import { createCountrySelect } from './country-select.js';
import { createListSelect } from './list-select.js';
import { subdivisionsFor } from '../checkout/subdivisions.js';
import { createPaymentModal } from './payment-modal.js';
import { paymentErrorMessage } from '../checkout/card-validation.js';

export function createPaymentSummary(order, compact = false) {
  const list = element('dl', compact ? 'payment-summary summary-payment' : 'payment-summary');
  const rows = [
    ['Merchandise subtotal', formatPrice(order.merchandiseSubtotal, order.currency)],
    ['Shipping fee', t('To be confirmed')],
  ];
  for (const [label, value] of rows) {
    const row = element('div'); row.append(element('dt', '', t(label)), element('dd', label === 'Shipping fee' ? 'shipping-status' : '', value)); list.append(row);
  }
  return list;
}

export function createOrderCompletion(checkout) {
  const root = element('div', 'order-completion');
  function step(id, title, number, lockedText) {
    const fieldset = element('fieldset', 'configuration-step completion-step'); fieldset.id = id;
    const legend = element('legend');
    const counter = element('span', 'step-number', String(number));
    legend.append(counter, element('span', '', t(title)));
    const placeholder = element('p', 'locked-message', t(lockedText)); placeholder.id = `${id}-locked`;
    const content = element('div', 'completion-content');
    fieldset.append(legend, placeholder, content); root.append(fieldset);
    return { fieldset, counter, placeholder, content };
  }
  const shipping = step('contact-shipping', 'Contact & Shipping', 6, 'Add an item to your order first');
  const payment = step('order-payment', 'Payment', 7, 'Complete Contact & Shipping first');
  const modal = createPaymentModal(checkout); root.append(modal.element);
  const form = element('div', 'shipping-fields');
  const inputs = new Map(), touched = new Set();
  // Optional VAT invoice: ticking the box makes Company required and reveals a required Tax code.
  const invoiceOnly = ['company', 'taxCode'];
  const invoiceRow = element('div', 'shipping-field shipping-field-wide invoice-option');
  const invoiceLabel = element('label', 'invoice-check');
  const invoiceBox = element('input'); invoiceBox.type = 'checkbox'; invoiceBox.id = 'shipping-vat-invoice';
  const invoiceHint = element('span', 'invoice-hint', t('Uses the details above. Company and tax code are required.')); invoiceHint.id = 'shipping-vat-invoice-hint';
  invoiceBox.setAttribute('aria-describedby', invoiceHint.id);
  invoiceLabel.append(invoiceBox, element('span', '', t('I need a VAT invoice')));
  invoiceRow.append(invoiceLabel, invoiceHint);
  for (const [group, key, label, autocomplete, type] of [
    ['customer', 'fullName', 'Full Name', 'name', 'text'], ['customer', 'company', 'Company', 'organization', 'text'],
    ['customer', 'email', 'Email', 'email', 'email'], ['customer', 'phone', 'Phone / WhatsApp', 'tel', 'tel'],
    // Country comes first so City / Province can offer that country's list.
    ['shipping', 'country', 'Country', 'country-name', 'text'], ['shipping', 'cityProvince', 'City / Province', 'address-level1', 'text'],
    ['shipping', 'address', 'Shipping Address', 'street-address', 'text'],
    // Shown (and required, with Company) only when the VAT invoice box below the address is ticked.
    ['customer', 'taxCode', 'Tax code', 'off', 'text'],
  ]) {
    const field = element('div', `shipping-field${key === 'address' ? ' shipping-field-wide' : ''}`);
    const caption = element('label', '', t(label) + (invoiceOnly.includes(key) ? '' : ' *'));
    const blur = () => { touched.add(key); render(checkout.getState()); };
    const picker = key === 'country'
      ? createCountrySelect({ onInput: value => checkout.setField(group, key, value), onSelect: code => checkout.selectCountry(code), onBlur: blur })
      : key === 'cityProvince'
        ? createListSelect({ id: 'province', label: 'City / Province', emptyText: 'No matching city / province', autocomplete,
          getOptions: () => subdivisionsFor(checkout.getState().order.shipping.countryCode),
          onInput: value => checkout.setField(group, key, value), onSelect: (code, name) => checkout.setField(group, key, name), onBlur: blur })
        : null;
    const input = picker?.input ?? element('input'); input.id = `shipping-${key}`; input.name = key; input.type = type;
    input.autocomplete = autocomplete; input.required = !invoiceOnly.includes(key); input.maxLength = key === 'taxCode' ? 24 : 500;
    caption.htmlFor = input.id;
    const error = element('span', 'field-error'); error.id = `${input.id}-error`;
    input.setAttribute('aria-describedby', error.id);
    if (!picker) {
      input.addEventListener('input', () => checkout.setField(group, key, input.value));
      input.addEventListener('blur', blur);
    }
    field.append(caption, picker?.root ?? input, error);
    if (key === 'taxCode') form.append(invoiceRow);
    form.append(field); inputs.set(key, { group, input, error, field, caption, label });
  }
  shipping.content.append(form);
  invoiceBox.addEventListener('change', () => {
    // Ticking with an empty Company shows straight away what is now missing.
    if (invoiceBox.checked && !checkout.getState().order.customer.company.trim()) touched.add('company');
    if (!invoiceBox.checked) invoiceOnly.forEach(key => touched.delete(key));
    checkout.setInvoice(invoiceBox.checked);
  });

  // Payment rows: radio · square app-style icon (assets/pay/) · name.
  const METHODS = [
    { value: 'card', label: 'Card (Visa, Mastercard)', logo: 'card.png' },
    { value: 'paypal', label: 'PayPal', logo: 'paypal.png' },
    { value: 'zalopay', label: 'ZaloPay', logo: 'zalopay.png' },
    { value: 'bank_transfer', label: 'Bank Transfer', logo: 'vietqr.png' },
  ];
  function choices(title, options, onSelect) {
    const group = element('fieldset', 'payment-choice-group payment-methods');
    const legend = element('legend');
    legend.append(element('span', 'payment-group-title', t(title)));
    group.append(legend);
    const cards = element('div', 'payment-choices'); const buttons = new Map();
    for (const { value, label, logo } of options) {
      const button = element('button', 'payment-choice'); button.type = 'button'; button.dataset.value = value;
      const radio = element('span', 'payment-method-indicator'); radio.setAttribute('aria-hidden', 'true');
      const tile = element('span', `payment-method-logo payment-method-logo-${value}`);
      tile.setAttribute('aria-hidden', 'true'); // the row's name already says the brand
      const image = element('img'); image.src = `${'./'}assets/pay/${logo}`; image.alt = ''; image.width = 48; image.height = 48; tile.append(image);
      const copy = element('span', 'payment-choice-copy');
      const availability = element('span', 'method-availability'); availability.id = `availability-${value}`;
      copy.append(element('strong', 'payment-choice-title', t(label)), availability);
      button.append(radio, tile, copy); button.setAttribute('aria-describedby', availability.id);
      button.setAttribute('aria-pressed', 'false'); button.addEventListener('click', () => onSelect(value));
      cards.append(button); buttons.set(value, button);
    }
    group.append(cards); payment.content.append(group); return buttons;
  }
  // Orders are paid in full: the step goes straight to the payment method and its pay button.
  // Methods a currency cannot use are left out (PayPal has no VND, so it shows on the USD page only),
  // and so are methods that are switched off in checkout/config.js.
  const currency = checkout.getState().order.currency;
  const methods = choices('Payment method', METHODS.filter(({ value }) => methodOffered(value, currency) && checkout.getState().methodAvailability[value]), checkout.selectMethod);
  const cta = element('button', 'button button-primary payment-cta'); cta.type = 'button';
  cta.addEventListener('click', () => modal.open(cta));
  const status = element('p', 'payment-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const hosted = element('a', 'button payment-hosted', t('Open secure checkout')); hosted.rel = 'noopener';
  const check = element('button', 'button payment-check', t('Check payment status')); check.type = 'button'; check.addEventListener('click', () => checkout.checkStatus());
  const bank = element('div', 'bank-details');
  const referenceRow = element('div', 'transfer-reference');
  const referenceLabel = element('label', '', t('Transfer reference')); referenceLabel.htmlFor = 'transfer-reference';
  const reference = element('input'); reference.id = 'transfer-reference'; reference.maxLength = 200;
  const submitReference = element('button', 'button', t('Submit transfer reference')); submitReference.type = 'button';
  reference.addEventListener('input', () => { submitReference.disabled = !reference.value.trim(); });
  submitReference.addEventListener('click', () => checkout.submitReference(reference.value));
  referenceRow.append(referenceLabel, reference, submitReference);
  const confirmation = element('div', 'payment-confirmation'); confirmation.setAttribute('role', 'status');
  payment.content.append(cta, status, hosted, bank, referenceRow, check, confirmation);

  function setState(step, unlocked, complete) {
    step.fieldset.disabled = !unlocked;
    step.fieldset.dataset.state = !unlocked ? 'locked' : complete ? 'complete' : 'current';
    step.fieldset.setAttribute('aria-disabled', String(!unlocked));
    if (!unlocked) step.fieldset.setAttribute('aria-describedby', step.placeholder.id);
    else step.fieldset.removeAttribute('aria-describedby');
    step.placeholder.hidden = unlocked;
  }
  function render(state) {
    const { order, busy } = state, p = order.payment;
    shipping.placeholder.textContent = t('Add an item to your order first');
    payment.placeholder.textContent = t(state.shippingUnlocked ? 'Complete Contact & Shipping first' : 'Add an item to your order first');
    setState(shipping, state.shippingUnlocked, state.paymentUnlocked);
    setState(payment, state.paymentUnlocked, p.status === 'confirmed');
    for (const [key, { group, input, error }] of inputs) {
      if (input.value !== order[group][key]) input.value = order[group][key];
      const invalid = touched.has(key) && Boolean(state.errors[key]);
      input.setAttribute('aria-invalid', String(invalid)); input.setCustomValidity(state.errors[key] ? t(state.errors[key]) : '');
      error.textContent = invalid ? t(state.errors[key]) : ''; error.hidden = !invalid;
    }
    // VAT invoice: Company gains its asterisk and the Tax code field appears only while the box is ticked.
    invoiceBox.checked = order.vatInvoice;
    for (const key of invoiceOnly) {
      const { input, caption, label } = inputs.get(key);
      input.required = order.vatInvoice;
      caption.textContent = t(label) + (order.vatInvoice ? ' *' : '');
    }
    inputs.get('taxCode').field.hidden = !order.vatInvoice;
    // City / Province depends on the country, so it opens once a country is chosen.
    inputs.get('cityProvince').input.disabled = !order.shipping.countryCode && !order.shipping.cityProvince;
    for (const [value, button] of methods) {
      button.disabled = !state.methodAvailability[value];
      button.setAttribute('aria-pressed', String(!button.disabled && value === p.method));
      const availability = button.querySelector('.method-availability');
      availability.textContent = button.disabled ? t('Currently unavailable') : '';
      availability.hidden = !button.disabled;
    }
    cta.textContent = t(busy ? 'Processing…' : p.method ? 'Pay' : 'Select a payment method');
    cta.disabled = !state.canPay || busy;
    // Backend integration enables the method action; the current storefront only captures the choice.
    cta.hidden = !state.methodAvailability[p.method];
    const statuses = { idle: '', pending: 'Waiting for payment confirmation', confirmed: 'Payment confirmed', failed: 'Payment failed', awaiting_confirmation: 'Waiting for transfer confirmation' };
    status.textContent = state.error ? t(paymentErrorMessage(state.error)) : state.paymentMode === 'simulation' && state.simulationStatus !== 'idle' ? t(state.busy ? 'Processing…' : state.simulationStatus === 'awaiting_confirmation' ? 'Waiting for transfer confirmation' : 'Waiting for payment confirmation') : t(statuses[p.status]);
    status.dataset.status = p.status;
    const checkoutURL = secureURL(state.checkoutURL);
    hosted.hidden = !checkoutURL || p.status === 'confirmed' || p.status === 'failed';
    if (checkoutURL) hosted.href = checkoutURL; else hosted.removeAttribute('href');
    check.hidden = !p.transactionId || p.status === 'confirmed'; check.disabled = busy;
    bank.replaceChildren();
    const bankData = p.method === 'bank_transfer' ? state.bank : null;
    bank.hidden = !bankData;
    if (bankData) {
      const details = element('dl', 'payment-summary');
      for (const [label, value] of [['Account name', bankData.accountName], ['Bank name', bankData.bankName], ['Account number', bankData.accountNumber], ['Transfer content', bankData.transferContent], ['Amount due now', formatPrice(p.amountDueNow, order.currency)]]) {
        const row = element('div'); row.append(element('dt', '', t(label)), element('dd', '', typeof value === 'string' && value ? value : t('Currently unavailable'))); details.append(row);
      }
      bank.append(details);
      const qrURL = secureURL(bankData.vietQRImageURL);
      if (qrURL) { const img = element('img', 'bank-qr'); img.src = qrURL; img.alt = t('Bank Transfer / VietQR'); bank.append(img); }
    }
    referenceRow.hidden = p.method !== 'bank_transfer' || !p.transactionId || ['confirmed', 'failed'].includes(p.status);
    submitReference.disabled = busy || !reference.value.trim();
    confirmation.hidden = p.status !== 'confirmed'; confirmation.replaceChildren();
    if (p.status === 'confirmed') {
      confirmation.append(element('h3', '', t('Payment received')));
      const details = element('dl', 'payment-summary');
      const methodLabel = methods.get(p.method).getAttribute('aria-label') || methods.get(p.method).querySelector('.payment-choice-title').textContent;
      for (const [label, value] of [['Order reference', order.orderId], ['Amount paid', formatPrice(p.amountPaid, order.currency)], ['Payment method', methodLabel], ['Shipping fee', t('To be confirmed')]]) {
        const row = element('div'); row.append(element('dt', '', t(label)), element('dd', '', value)); details.append(row);
      }
      confirmation.append(details, element('p', '', t('Shipping fee will be confirmed separately')));
    }
  }
  checkout.subscribe(render);
  return { element: root, setStartNumber(number) { shipping.counter.textContent = String(number); payment.counter.textContent = String(number + 1); } };
}
