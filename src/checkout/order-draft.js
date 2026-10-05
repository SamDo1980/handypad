import { countryByCode, countryByName } from './countries.js';
import { subdivisionsFor } from './subdivisions.js';
export const DRAFT_KEY = 'handypad.order-draft.v1';
export const CUSTOMER_FIELDS = ['fullName', 'company', 'email', 'phone', 'taxCode'];
// Company and tax code are needed only when the customer asks for a VAT invoice (optional checkbox).
const INVOICE_FIELDS = ['company', 'taxCode'];
export const SHIPPING_FIELDS = ['address', 'cityProvince', 'country', 'countryCode'];
// Orders are always paid in full (the deposit option was removed 2026-10-01). The payload keeps
// `amountOption: 'full'` so the payment service receives the same order shape as before.
export const AMOUNT_OPTION = 'full';
export const PAYMENT_METHODS = ['card', 'paypal', 'zalopay', 'bank_transfer'];
// PayPal cannot charge in VND, so it is offered on the USD (English) page only.
const METHOD_CURRENCIES = { paypal: ['USD'] };
export const methodOffered = (method, currency) => METHOD_CURRENCIES[method]?.includes(currency) ?? true;
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
    wantsInvoice: saved?.wantsInvoice === true,
    method: PAYMENT_METHODS.includes(saved?.method) ? saved.method : null,
  };
}

export function validateContact(customer, shipping, wantsInvoice = false) {
  const errors = {};
  for (const key of [...CUSTOMER_FIELDS.filter(key => wantsInvoice || !INVOICE_FIELDS.includes(key)), ...SHIPPING_FIELDS.filter(key => key !== 'countryCode')]) {
    if (!(customer[key] ?? shipping[key] ?? '').trim()) errors[key] = 'Required field';
  }
  if (wantsInvoice) {
    if (customer.company?.trim() && !/[\p{L}\p{N}]/u.test(customer.company)) errors.company = 'Enter a valid value';
    // Vietnamese tax codes (MST) are 10 digits, or 10 + 3 for a branch; other countries vary, so
    // there only something that looks like a registration number (4–20 letters / digits) is required.
    const taxCode = customer.taxCode?.trim() ?? '';
    const valid = shipping.countryCode === 'VN' ? /^\d{10}(-?\d{3})?$/.test(taxCode) : /^[\p{L}\p{N}][\p{L}\p{N} ./-]{3,19}$/u.test(taxCode);
    if (taxCode && !valid) errors.taxCode = shipping.countryCode === 'VN' ? 'Enter a valid tax code (10 or 13 digits)' : 'Enter a valid tax code';
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

export function buildOrderDraft(items, fields, currency, session = {}) {
  const factor = currency === 'VND' ? 1 : 100;
  const orderItems = items.map(item => ({
    sku: item.id, displayName: item.display_name, size: item.dimensions,
    addOns: { reflective: item.reflective, fireproof: item.fireproof }, quantity: item.quantity,
    unitPrice: item.prices[currency], lineSubtotal: Math.round(item.prices[currency] * factor) * item.quantity / factor,
  }));
  const merchandiseSubtotal = orderItems.reduce((sum, item) => sum + Math.round(item.lineSubtotal * factor), 0) / factor;
  return {
    orderId: session.orderId ?? null, currency, items: orderItems,
    // The tax code is sent only with an invoice request (it stays in the form if the box is unticked).
    customer: { ...cleanFields(fields.customer, CUSTOMER_FIELDS), ...(fields.wantsInvoice ? {} : { taxCode: '' }) },
    shipping: { ...cleanFields(fields.shipping, SHIPPING_FIELDS), feeStatus: 'to_be_confirmed' },
    vatInvoice: fields.wantsInvoice === true,
    merchandiseSubtotal,
    payment: {
      amountOption: AMOUNT_OPTION, amountDueNow: merchandiseSubtotal,
      method: fields.method, status: session.status ?? 'idle',
      transactionId: session.transactionId ?? null, amountPaid: session.amountPaid ?? null,
    },
  };
}
