import { language, t } from './locale.js';
import { getProductName } from './storefront.js';
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function icon(name) {
  const paths = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    cart: '<path d="M3 3h2l3 12h11l2-8H6M9 19h.01M18 19h.01"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    box: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16M9 9v11"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 8V5a2 2 0 0 1 2-2h13v3M21 11h-6v5h6M17 13.5h.01"/>',
    bank: '<path d="m3 8 9-5 9 5H3ZM5 10v8m5-8v8m4-8v8m5-8v8M3 21h18M3 18h18"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  };
  const holder = element('span', 'icon');
  // Only the static paths above are used; product data is always assigned via textContent.
  holder.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`;
  return holder;
}

export function productImage(product, { eager = false } = {}) {
  const frame = element('div', 'product-image');
  const fallback = element('span', 'image-fallback', t('Image unavailable'));
  frame.append(fallback);
  if (product.image_url) {
    fallback.textContent = t('Loading image…');
    const img = element('img');
    img.alt = getProductName(product, language);
    img.width = 800;
    img.height = 800;
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', () => { fallback.hidden = true; });
    img.addEventListener('error', () => { img.remove(); fallback.textContent = t('Image unavailable'); fallback.hidden = false; }, { once: true });
    img.src = product.image_url;
    frame.append(img);
  }
  return frame;
}
