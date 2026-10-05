import { countryByCode, countryByName } from './countries.js';
import { subdivisionsFor } from './subdivisions.js';
export const DRAFT_KEY = 'handypad.order-draft.v1';
export const CUSTOMER_FIELDS = ['fullName', 'company', 'email', 'phone'];
export const SHIPPING_FIELDS = ['address', 'cityProvince', 'country', 'countryCode'];
export const PAYMENT_METHODS = ['zalopay', 'paypal'];
const cleanFields = (value, fields) => Object.fromEntries(fields.map(key => [key, typeof value?.[key] === 'string' ? value[key].slice(0, 500) : '']));

export function restoreDraft(storage) {
  let saved;
  try { saved = JSON.parse(storage?.getItem(DRAFT_KEY)); } catch { /* Session-only draft. */ }
  const shipping = cleanFields(saved?.shipping, SHIPPING_FIELDS);
  const country = countryByCode(shipping.countryCode) || (!shipping.countryCode && countryByName(shipping.country));
  if (country) { shipping.countryCode = country.code; shipping.country = country.name; }
  return {
    customer: cleanFields(saved?.customer, CUSTOMER_FIELDS),
    shipping,
    method: PAYMENT_METHODS.includes(saved?.method) ? saved.method : null,
  };
}

export function validateContact(customer, shipping) {
  const errors = {};
  for (const key of [...CUSTOMER_FIELDS.filter(key => key !== 'company'), ...SHIPPING_FIELDS.filter(key => key !== 'countryCode')]) {
    if (!(customer[key] ?? shipping[key] ?? '').trim()) errors[key] = 'Required field';
  }
  if (customer.email?.trim() && !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(customer.email.trim())) errors.email = 'Enter a valid email address';
  const phone = customer.phone?.trim() ?? '';
  const digits = phone.replace(/\D/g, '');
  if (phone && (!/^\+?[\d\s().-]+$/.test(phone) || digits.length < 7 || digits.length > 15)) errors.phone = 'Enter a valid international phone number';
  for (const [key, value] of [['fullName', customer.fullName], ['address', shipping.address], ['cityProvince', shipping.cityProvince]]) {
    if (value?.trim() && !/[\p{L}\p{N}]/u.test(value)) errors[key] = 'Enter a valid value';
  }
  if (!countryByCode(shipping.countryCode) || countryByCode(shipping.countryCode)?.name !== shipping.country) errors.country = 'Select a country from the list';
  const provinces = subdivisionsFor(shipping.countryCode);
  if (!errors.cityProvince && provinces.length && !provinces.some(option => option.name === shipping.cityProvince)) errors.cityProvince = 'Select a city / province from the list';
  return errors;
}

export function buildOrderDraft(items, fields, currency, config = {}, session = {}) {
  const factor = currency === 'VND' ? 1 : 100;
  const orderItems = items.map(item => ({
    sku: item.id, displayName: item.display_name, size: item.dimensions,
    addOns: { reflective: item.reflective, fireproof: item.fireproof }, quantity: item.quantity,
    unitPrice: item.prices[currency], lineSubtotal: Math.round(item.prices[currency] * factor) * item.quantity / factor,
  }));
  const merchandiseSubtotal = orderItems.reduce((sum, item) => sum + Math.round(item.lineSubtotal * factor), 0) / factor;
  return {
    orderId: session.orderId ?? null, currency, items: orderItems,
    customer: cleanFields(fields.customer, CUSTOMER_FIELDS),
    shipping: { ...cleanFields(fields.shipping, SHIPPING_FIELDS), feeStatus: 'to_be_confirmed' },
    merchandiseSubtotal,
    payment: {
      // Orders are always paid in full; shipping is confirmed separately.
      amountOption: 'full',
      amountDueNow: Math.max(0, merchandiseSubtotal),
      method: fields.method, status: session.status ?? 'idle',
      transactionId: session.transactionId ?? null, amountPaid: session.amountPaid ?? null,
    },
  };
}
