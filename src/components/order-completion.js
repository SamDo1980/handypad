import { element, icon } from '../lib/dom.js';
import { t } from '../lib/locale.js';
import { formatPrice } from '../lib/storefront.js';
import { secureURL } from '../checkout/payment-service.js';
import { createCountrySelect } from './country-select.js';
import { createListSelect } from './list-select.js';
import { subdivisionsFor } from '../checkout/subdivisions.js';
import { createPaymentModal, paymentLogo } from './payment-modal.js';
import { paymentErrorMessage } from '../checkout/payment-errors.js';

export function createPaymentSummary(order, compact = false) {
  const list = element('dl', compact ? 'payment-summary summary-payment' : 'payment-summary');
  const p = order.payment;
  const money = value => value === null ? t('Currently unavailable') : formatPrice(value, order.currency);
  const rows = [
    ['Merchandise subtotal', money(order.merchandiseSubtotal)],
    ['Shipping fee', t('To be confirmed')],
  ];
  for (const [label, value] of rows) {
    const row = element('div', label.endsWith('due now') ? 'payment-due-row' : ''); row.append(element('dt', '', t(label)), element('dd', label === 'Shipping fee' ? 'shipping-status' : '', value)); list.append(row);
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
  for (const [group, key, label, autocomplete, type] of [
    ['customer', 'fullName', 'Full Name', 'name', 'text'], ['customer', 'company', 'Company', 'organization', 'text'],
    ['customer', 'email', 'Email', 'email', 'email'], ['customer', 'phone', 'Phone / WhatsApp', 'tel', 'tel'],
    // Country comes first so City / Province can offer that country's list.
    ['shipping', 'country', 'Country', 'country-name', 'text'], ['shipping', 'cityProvince', 'City / Province', 'address-level1', 'text'],
    ['shipping', 'address', 'Shipping Address', 'street-address', 'text'],
  ]) {
    const field = element('div', `shipping-field${key === 'address' ? ' shipping-field-wide' : ''}`);
    const caption = element('label', '', t(label) + (key === 'company' ? '' : ' *'));
    const blur = () => { touched.add(key); render(checkout.getState()); };
    const picker = key === 'country'
      ? createCountrySelect({ onInput: value => checkout.setField(group, key, value), onSelect: code => checkout.selectCountry(code), onBlur: blur })
      : key === 'cityProvince'
        ? createListSelect({ id: 'province', label: 'City / Province', emptyText: 'No matching city / province', autocomplete,
          getOptions: () => subdivisionsFor(checkout.getState().order.shipping.countryCode),
          onInput: value => checkout.setField(group, key, value), onSelect: (code, name) => checkout.setField(group, key, name), onBlur: blur })
        : null;
    const input = picker?.input ?? element('input'); input.id = `shipping-${key}`; input.name = key; input.type = type;
    input.autocomplete = autocomplete; input.required = key !== 'company'; input.maxLength = 500;
    caption.htmlFor = input.id;
    const error = element('span', 'field-error'); error.id = `${input.id}-error`;
    input.setAttribute('aria-describedby', error.id);
    if (!picker) {
      input.addEventListener('input', () => checkout.setField(group, key, input.value));
      input.addEventListener('blur', blur);
    }
    field.append(caption, picker?.root ?? input, error); form.append(field); inputs.set(key, { group, input, error });
  }
  shipping.content.append(form);

  function choices(title, kind, options, onSelect) {
    const group = element('fieldset', `payment-choice-group payment-${kind}`);
    const legend = element('legend');
    legend.append(element('span', 'payment-group-title', t(title)));
    group.append(legend);
    const cards = element('div', 'payment-choices'); const buttons = new Map();
    for (const [value, label] of options) {
      const button = element('button', 'payment-choice'); button.type = 'button'; button.dataset.value = value;
      const copy = element('span', 'payment-choice-copy');
      copy.append(element('strong', 'payment-choice-title', t(label)));
      const radio = element('span', 'payment-method-indicator'); radio.setAttribute('aria-hidden', 'true');
      const tile = element('span', 'payment-method-icon'); tile.setAttribute('aria-hidden', 'true');
      tile.append(icon('wallet'));
      const availability = element('span', 'method-availability'); availability.id = `availability-${value}`; copy.append(availability);
      const brands = element('span', 'payment-method-brands'); brands.append(paymentLogo(value));
      button.append(radio, tile, copy, brands); button.setAttribute('aria-describedby', availability.id);
      button.setAttribute('aria-pressed', 'false'); button.addEventListener('click', () => onSelect(value));
      cards.append(button); buttons.set(value, button);
    }
    group.append(cards); payment.content.append(group); return buttons;
  }
  const methods = choices('Payment method', 'methods', [['zalopay', 'ZaloPay'], ['paypal', 'PayPal']], checkout.selectMethod);
  const cta = element('button', 'button button-primary payment-cta'); cta.type = 'button';
  cta.addEventListener('click', () => modal.open(cta));
  const status = element('p', 'payment-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const hosted = element('a', 'button payment-hosted', t('Open secure checkout')); hosted.rel = 'noopener';
  const check = element('button', 'button payment-check', t('Check payment status')); check.type = 'button'; check.addEventListener('click', () => checkout.checkStatus());
  const confirmation = element('div', 'payment-confirmation'); confirmation.setAttribute('role', 'status');
  payment.content.append(cta, status, hosted, check, confirmation);

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
    // City / Province depends on the country, so it opens once a country is chosen.
    inputs.get('cityProvince').input.disabled = !order.shipping.countryCode && !order.shipping.cityProvince;
    for (const [value, button] of methods) {
      button.disabled = !state.methodAvailability[value];
      button.setAttribute('aria-pressed', String(!button.disabled && value === p.method));
      const availability = button.querySelector('.method-availability');
      availability.textContent = button.disabled ? t('Currently unavailable') : '';
      availability.hidden = !button.disabled;
    }
    cta.textContent = t(busy ? 'Processing…' : p.method === 'zalopay' ? 'Pay with ZaloPay' : p.method === 'paypal' ? 'Pay with PayPal' : 'Select a payment method');
    cta.disabled = !state.canPay || busy;
    // Backend integration enables the method action; the current storefront only captures the choice.
    cta.hidden = !state.methodAvailability[p.method];
    const statuses = { idle: '', pending: 'Waiting for payment confirmation', confirmed: 'Payment confirmed', failed: 'Payment failed' };
    status.textContent = state.error ? t(paymentErrorMessage(state.error)) : state.paymentMode === 'simulation' && state.simulationStatus !== 'idle' ? t(state.busy ? 'Processing…' : 'Waiting for payment confirmation') : t(statuses[p.status]);
    status.dataset.status = p.status;
    const checkoutURL = secureURL(state.checkoutURL);
    hosted.hidden = !checkoutURL || p.status === 'confirmed' || p.status === 'failed';
    if (checkoutURL) hosted.href = checkoutURL; else hosted.removeAttribute('href');
    check.hidden = !p.transactionId || p.status === 'confirmed'; check.disabled = busy;
    confirmation.hidden = p.status !== 'confirmed'; confirmation.replaceChildren();
    if (p.status === 'confirmed') {
      confirmation.append(element('h3', '', t('Payment received')));
      const details = element('dl', 'payment-summary');
      const methodLabel = methods.get(p.method).querySelector('.payment-choice-title').textContent;
      for (const [label, value] of [['Order reference', order.orderId], ['Amount paid', formatPrice(p.amountPaid, order.currency)], ['Payment method', methodLabel], ['Shipping fee', t('To be confirmed')]]) {
        const row = element('div'); row.append(element('dt', '', t(label)), element('dd', '', value)); details.append(row);
      }
      confirmation.append(details, element('p', '', t('Shipping fee will be confirmed separately')));
    }
  }
  checkout.subscribe(render);
  return { element: root, setStartNumber(number) { shipping.counter.textContent = String(number); payment.counter.textContent = String(number + 1); } };
}
