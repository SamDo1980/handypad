// HANDYPAD catalogue. Prices are copied from V70 (base price + add-on prices per size);
// every size × add-on combination becomes one exact SKU so the cart, order summary and
// checkout work on fixed products exactly like Hyperion.
// Reflective photos are WebP (replaced 2026-09-29); standard photos are still JPG.
const itemImage = (size, finish) =>
  `./src/assets/products/handypad/items/${size.replace('_', '-')}-${finish}.${finish === 'reflective' ? 'webp' : 'jpg'}`;

// Original list prices (V70). Every price shown — on the site, in the specs catalogue and in the
// Odoo export, which all read SIZES — is PRICE_FACTOR × these, applied to each part (base and each
// add-on) so the "+add-on" amounts shown in the order steps still add up exactly to the SKU price.
const PRICE_FACTOR = 0.9; // 10% off, from 2026-10-01
const LIST_SIZES = [
  { id: 'single', code: 'SGL', label_en: 'Single', label_vi: 'Single', dimensions: '24 × 10 × 5 cm', base: { VND: 550000, USD: 21.15 },
    addOns: { reflective: { VND: 50000, USD: 1.92 }, fireproof: { VND: 100000, USD: 3.85 } } },
  { id: 'double', code: 'DBL', label_en: 'Double', label_vi: 'Double', dimensions: '24 × 20 × 5 cm', base: { VND: 1050000, USD: 40.38 },
    addOns: { reflective: { VND: 50000, USD: 2.00 }, fireproof: { VND: 250000, USD: 9.62 } } },
  { id: 'one_metre', code: '1M', label_en: '1 Metre', label_vi: '1 Mét', dimensions: '100 × 24 × 5 cm', base: { VND: 4650000, USD: 179.00 },
    addOns: { reflective: { VND: 425000, USD: 16.35 }, fireproof: { VND: 1250000, USD: 48.08 } } },
];
// VND to the whole đồng, USD to the cent. Integer maths (× percent ÷ 100) so a half rounds up
// reliably: 3.85 → 346.5¢ → 3.47.
const percent = Math.round(PRICE_FACTOR * 100);
const discount = ({ VND, USD }) => ({
  VND: Math.round(VND * percent / 100),
  USD: Math.round(Math.round(USD * 100) * percent / 100) / 100,
});

export const SIZES = Object.freeze(LIST_SIZES.map(size => ({
  ...size,
  base: discount(size.base),
  addOns: { reflective: discount(size.addOns.reflective), fireproof: discount(size.addOns.fireproof) },
})));

export const ADD_ONS = Object.freeze([
  { id: 'reflective', label_en: 'Reflective tape', label_vi: 'Băng phản quang' },
  { id: 'fireproof', label_en: 'Fireproof canvas', label_vi: 'Vải chống cháy' },
]);

const cents = value => Math.round(value * 100);

export const products = SIZES.flatMap(size => [false, true].flatMap(reflective => [false, true].map(fireproof => {
  const finish = reflective ? 'reflective' : 'standard';
  const price = currency => {
    const minor = currency === 'VND' ? 1 : 100;
    const parts = [size.base[currency], reflective ? size.addOns.reflective[currency] : 0, fireproof ? size.addOns.fireproof[currency] : 0];
    return parts.reduce((sum, value) => sum + (minor === 1 ? value : cents(value)), 0) / minor;
  };
  return Object.freeze({
    id: `HP-${size.code}-${reflective ? 'REF' : 'STD'}${fireproof ? '-FR' : ''}`,
    size: size.id,
    reflective,
    fireproof,
    dimensions_display: size.dimensions,
    display_name_en: `HANDYPAD ${size.label_en} ${reflective ? 'Reflective' : 'Standard'}`,
    display_name_vi: `HANDYPAD ${size.label_vi} ${reflective ? 'Phản quang' : 'Tiêu chuẩn'}`,
    prices: Object.freeze({ VND: price('VND'), USD: price('USD') }),
    image_url: itemImage(size.id, finish),
  });
})));

// Product Range gallery: the six looks customers recognise (fireproof is an option, not a look).
export const RANGE = SIZES.flatMap(size => [false, true].map(reflective => products.find(product =>
  product.size === size.id && product.reflective === reflective && !product.fireproof)));

export const findProduct = (size, { reflective = false, fireproof = false } = {}) =>
  products.find(product => product.size === size && product.reflective === reflective && product.fireproof === fireproof) ?? null;
