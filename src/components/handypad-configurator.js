import { element, icon, productImage } from '../lib/dom.js';
import { language, t } from '../lib/locale.js';
import { formatPrice, getProductName, getProductPrice, describeAddOns } from '../lib/storefront.js';
import { scrollToElement } from '../lib/scroll.js';
import { SIZES, ADD_ONS, findProduct } from '../data/products.js';
import { createQuantityStepper } from './quantity-stepper.js';
import { createOrderCompletion } from './order-completion.js';

const STATE_KEY = 'handypad.configurator-state.v1';
const label = item => item[`label_${language === 'vi' ? 'vi' : 'en'}`];

// Same numbered-step component as Hyperion: each step is a <fieldset> with a
// data-state of current / complete / locked, so marine-theme.css styles it unchanged.
function createStep(field, number, title) {
  const root = element('fieldset', 'configuration-step');
  root.dataset.field = field;
  const legend = element('legend');
  legend.tabIndex = -1;
  legend.append(element('span', 'step-number', String(number)), element('span', '', t(title)));
  const message = element('p', 'locked-message');
  message.id = `locked-${field}`;
  root.append(legend);
  return { root, legend, message };
}

function setStepState(step, state, lockedText = '') {
  step.root.dataset.state = state;
  const locked = state === 'locked';
  step.root.disabled = locked;
  step.root.setAttribute('aria-disabled', String(locked));
  step.message.textContent = locked ? t(lockedText) : '';
  step.message.hidden = !locked;
  if (locked) step.root.setAttribute('aria-describedby', step.message.id);
  else step.root.removeAttribute('aria-describedby');
  if (state === 'current') step.legend.setAttribute('aria-current', 'step');
  else step.legend.removeAttribute('aria-current');
}

export function createHandypadConfigurator({ cart, announce, checkout }) {
  let session;
  try { session = window.sessionStorage; } catch { /* Selection stays in memory only. */ }
  const saved = (() => { try { return JSON.parse(session?.getItem(STATE_KEY)) ?? {}; } catch { return {}; } })();
  const selection = {
    size: SIZES.some(size => size.id === saved.size) ? saved.size : null,
    reflective: saved.reflective === true,
    fireproof: saved.fireproof === true,
  };

  const section = element('section', 'configurator');
  section.id = 'configure-order';
  section.setAttribute('aria-labelledby', 'configurator-title');
  const heading = element('div', 'configurator-heading');
  const title = element('h2', '', t('CONFIGURE & ORDER'));
  title.id = 'configurator-title';
  title.tabIndex = -1;
  const reset = element('button', 'configurator-reset', t('Reset selection'));
  reset.type = 'button';
  heading.append(title, reset);

  // Step 1 — size.
  const sizeStep = createStep('size', 1, 'Choose size');
  const sizeGrid = element('div', 'sign-option-grid size-option-grid');
  const sizeButtons = new Map(SIZES.map(size => {
    const product = findProduct(size.id);
    const button = element('button', 'sign-option size-option');
    button.type = 'button';
    const check = element('span', 'option-check', '✓');
    check.setAttribute('aria-hidden', 'true');
    const price = getProductPrice(product, language);
    button.append(check, productImage(product), element('span', 'option-label', label(size)),
      element('span', 'option-detail', size.dimensions),
      element('span', 'option-price', `${t('from')} ${formatPrice(price.amount, price.currency)}`));
    button.addEventListener('click', () => select({ size: size.id }, { guide: true }));
    sizeGrid.append(button);
    return [size.id, button];
  }));
  const sizeChoices = element('div', 'step-choices');
  sizeChoices.append(sizeGrid);
  sizeStep.root.append(sizeChoices, sizeStep.message);

  // Step 2 — optional add-ons (toggles; the price shown is for the chosen size).
  const addOnStep = createStep('addons', 2, 'Add-ons');
  addOnStep.legend.append(element('span', 'step-optional', t('Optional')));
  const addOnGrid = element('div', 'attribute-options addon-options');
  const addOnButtons = new Map(ADD_ONS.map(addOn => {
    const button = element('button', 'attribute-option addon-option');
    button.type = 'button';
    const check = element('span', 'option-check', '✓');
    check.setAttribute('aria-hidden', 'true');
    const price = element('span', 'option-price');
    button.append(check, element('span', 'option-label', label(addOn)), price);
    button.addEventListener('click', () => select({ [addOn.id]: !selection[addOn.id] }));
    addOnGrid.append(button);
    return [addOn.id, { button, price }];
  }));
  addOnStep.root.append(addOnGrid, addOnStep.message);

  // Step 3 — the exact SKU, its price, quantity and Add to cart.
  const purchaseStep = createStep('purchase', 3, 'Quantity & add to cart');
  purchaseStep.root.classList.add('edition-purchase');
  const identity = element('div', 'edition-identity');
  const preview = element('div', 'edition-preview');
  const details = element('div', 'edition-details');
  const copy = element('div', 'result-copy');
  const name = element('h3', 'result-title');
  const size = element('p', 'dimensions');
  const addOnsText = element('p', 'result-reference');
  copy.append(name, size, addOnsText);
  const form = element('form', 'edition-controls');
  const unitPrice = element('div', 'result-price');
  const unitValue = element('strong');
  unitPrice.append(element('span', 'price-label', t('Unit price')), unitValue);
  const quantity = createQuantityStepper('', { onChange() { clearFeedback(); updatePurchase(); } });
  const quantityGroup = element('div', 'edition-quantity');
  quantityGroup.append(element('span', 'price-label', t('Quantity')), quantity.element);
  const add = element('button', 'button button-primary add-to-cart', t('Add to cart'));
  add.type = 'submit';
  const feedback = element('p', 'edition-feedback');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  let feedbackTimer;
  function clearFeedback() { clearTimeout(feedbackTimer); feedback.replaceChildren(); }
  form.append(unitPrice, quantityGroup, add, feedback);
  details.append(copy, form);
  identity.append(preview, details);
  purchaseStep.root.append(identity, purchaseStep.message);

  const completion = createOrderCompletion(checkout);
  completion.setStartNumber(4);
  const main = element('div', 'configurator-main');
  const steps = element('div', 'configuration-steps');
  steps.append(sizeStep.root, addOnStep.root, purchaseStep.root);
  main.append(steps, completion.element);
  section.append(heading, main);

  let product = null, imageKey = null;
  function updatePurchase() {
    const valid = quantity.element.querySelector('input').validity.valid;
    const price = product && getProductPrice(product, language);
    unitValue.textContent = price ? formatPrice(price.amount, price.currency) : '—';
    add.disabled = !product || !valid;
  }

  function render() {
    try { session?.setItem(STATE_KEY, JSON.stringify(selection)); } catch { /* Storage is optional. */ }
    const chosenSize = SIZES.find(item => item.id === selection.size);
    product = chosenSize ? findProduct(chosenSize.id, selection) : null;
    reset.disabled = !chosenSize && !selection.reflective && !selection.fireproof;

    for (const [id, button] of sizeButtons) {
      const pressed = id === selection.size;
      button.setAttribute('aria-pressed', String(pressed));
      button.querySelector('.option-check').hidden = !pressed;
    }
    setStepState(sizeStep, chosenSize ? 'complete' : 'current');

    for (const [id, { button, price }] of addOnButtons) {
      const pressed = Boolean(chosenSize && selection[id]);
      button.setAttribute('aria-pressed', String(pressed));
      button.querySelector('.option-check').style.visibility = pressed ? 'visible' : 'hidden';
      const amount = chosenSize?.addOns[id][language === 'vi' ? 'VND' : 'USD'];
      price.textContent = amount === undefined ? '' : `+${formatPrice(amount, language === 'vi' ? 'VND' : 'USD')}`;
    }
    setStepState(addOnStep, chosenSize ? 'complete' : 'locked', 'Select a size first');

    setStepState(purchaseStep, !product ? 'locked' : cart.getItems().length ? 'complete' : 'current', 'Select a size first');
    if (product) {
      name.textContent = getProductName(product, language);
      size.textContent = product.dimensions_display;
      addOnsText.textContent = describeAddOns(product, language);
      if (imageKey !== product.image_url) { preview.replaceChildren(productImage(product, { eager: true })); imageKey = product.image_url; }
      const controls = quantity.element.querySelectorAll('button, input');
      controls[0].setAttribute('aria-label', `${t('Decrease quantity for')} ${name.textContent}`);
      controls[1].setAttribute('aria-label', `${t('Quantity for')} ${name.textContent}`);
      controls[2].setAttribute('aria-label', `${t('Increase quantity for')} ${name.textContent}`);
      add.setAttribute('aria-label', `${t('Add to cart')}: ${name.textContent} · ${addOnsText.textContent}`);
    }
    updatePurchase();
  }

  function select(changes, { guide = false } = {}) {
    const firstSize = !selection.size && changes.size;
    Object.assign(selection, changes);
    clearFeedback();
    render();
    // Like Hyperion: when the next decision is off-screen, glide to it.
    if (guide && firstSize) {
      const bounds = addOnStep.root.getBoundingClientRect();
      if (bounds.top < 110 || bounds.bottom > innerHeight - 100) scrollToElement(addOnStep.root);
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    clearFeedback();
    if (!product) return;
    try {
      cart.add(product.id, quantity.getValue());
      quantity.setValue(1);
      updatePurchase();
      feedback.append(icon('check'), element('span', '', t('Added to cart')));
      feedbackTimer = setTimeout(clearFeedback, 1600);
    } catch (error) { announce(t(error.message)); }
  });

  reset.addEventListener('click', () => {
    selection.size = null; selection.reflective = false; selection.fireproof = false;
    quantity.setValue(1);
    clearFeedback();
    render();
    sizeButtons.values().next().value?.focus();
  });

  // Product Range cards pre-select a look and glide to the add-ons step.
  window.addEventListener('handypad:configure', event => {
    const { size: sizeId, reflective } = event.detail ?? {};
    if (!SIZES.some(item => item.id === sizeId)) return;
    select({ size: sizeId, reflective: Boolean(reflective), fireproof: false });
    scrollToElement(addOnStep.root, { onDone: () => addOnStep.legend.focus({ preventScroll: true }) });
    history.replaceState(null, '', '#configure-order');
  });

  cart.subscribe(() => render());
  return section;
}
