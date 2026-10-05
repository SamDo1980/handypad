import { ADD_ONS } from '../data/products.js';
export function getProductPrice(product, language = 'en') {
  const currency = language === 'vi' ? 'VND' : 'USD';
  return { currency, amount: product.prices[currency] };
}
export const getProductName = (product, language = 'en') => product[`display_name_${language === 'vi' ? 'vi' : 'en'}`];
export function formatPrice(amount, currency = 'USD') {
  return new Intl.NumberFormat(currency === 'VND' ? 'vi-VN' : 'en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(amount);
}
// "Reflective tape · Fireproof canvas" / "No add-ons" in the current language.
export function describeAddOns(product, language = 'en') {
  const chosen = ADD_ONS.filter(addOn => product[addOn.id]).map(addOn => addOn[`label_${language === 'vi' ? 'vi' : 'en'}`]);
  return chosen.length ? chosen.join(' · ') : language === 'vi' ? 'Không có phụ kiện' : 'No add-ons';
}
