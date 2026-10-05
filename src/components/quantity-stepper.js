import { element } from '../lib/dom.js';
import { t } from '../lib/locale.js';

export function createQuantityStepper(productId, { value = 1, onChange = () => {} } = {}) {
  const root = element('div', 'quantity-stepper');
  const input = element('input');
  input.type = 'number';
  input.inputMode = 'numeric';
  input.min = '1';
  input.max = String(Number.MAX_SAFE_INTEGER);
  input.step = '1';
  input.required = true;
  input.value = String(value);
  input.setAttribute('aria-label', `${t('Quantity for')} ${productId}`);
  const decrease = element('button', '', '−');
  decrease.type = 'button';
  decrease.setAttribute('aria-label', `${t('Decrease quantity for')} ${productId}`);
  const increase = element('button', '', '+');
  increase.type = 'button';
  increase.setAttribute('aria-label', `${t('Increase quantity for')} ${productId}`);
  function sync() {
    const value = input.valueAsNumber;
    input.setCustomValidity(Number.isSafeInteger(value) && value >= 1 ? '' : t('Enter a whole-number quantity of at least 1.'));
    decrease.disabled = !input.validity.valid || value <= 1;
    increase.disabled = !input.validity.valid || value >= Number.MAX_SAFE_INTEGER;
  }
  function changed() { sync(); onChange(input.valueAsNumber, input.validity.valid); }
  decrease.addEventListener('click', () => { input.stepDown(); changed(); });
  increase.addEventListener('click', () => { input.stepUp(); changed(); });
  input.addEventListener('input', changed);
  sync();
  root.append(decrease, input, increase);
  return { element: root, getValue: () => input.valueAsNumber,
    setValue(value) { if (input.valueAsNumber !== value) input.value = String(value); sync(); } };
}
