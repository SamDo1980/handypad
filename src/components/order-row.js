import { element, productImage } from '../lib/dom.js';
import { language, t } from '../lib/locale.js';
import { getProductName, formatPrice, describeAddOns } from '../lib/storefront.js';
import { createQuantityStepper } from './quantity-stepper.js';

export function createOrderRow(product, item, cart, announce, onRemove) {
  const root = element('li', 'order-row');
  root.dataset.cartSku = product.id;
  const identity = element('div', 'order-row-identity');
  const copy = element('div', 'order-row-copy');
  const name = getProductName(product, language);
  const addOns = describeAddOns(product, language);
  copy.append(element('strong', 'order-row-name', name),
    element('span', 'order-row-metadata', product.dimensions_display),
    element('span', 'order-row-impa', addOns));
  identity.append(productImage(product), copy);
  const controls = element('div', 'order-row-controls');
  const quantity = createQuantityStepper(getProductName(product, language), { value: item.quantity, onChange(value, valid) {
    if (!valid) return;
    try { cart.setQuantity(product.id, value); }
    catch (error) { announce(t(error.message)); quantity.setValue(cart.getItems().find(line => line.id === product.id).quantity); }
  } });
  quantity.element.querySelector('input').addEventListener('blur', () => {
    const stored = cart.getItems().find(line => line.id === product.id);
    if (stored) quantity.setValue(stored.quantity);
  });
  const subtotal = element('strong', 'order-line-subtotal');
  const remove = element('button', 'order-remove', t('Remove'));
  remove.type = 'button';
  remove.setAttribute('aria-label', `${t('Remove')}: ${name} · ${product.dimensions_display} · ${addOns}`);
  remove.addEventListener('click', () => {
    cart.remove(product.id);
    announce(`${t('Removed from order')}: ${name}`);
    onRemove();
  });
  controls.append(quantity.element, subtotal, remove);
  root.append(identity, controls);
  return { element: root, update(line) {
    quantity.setValue(line.quantity);
    subtotal.textContent = formatPrice(line.unit_price * line.quantity, line.currency);
  } };
}
