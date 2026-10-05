import { products } from './data/products.js';
import { createCatalogue } from './lib/product-catalogue.js';
import { createCartStore } from './cart/cart-store.js';
import { checkoutConfig } from './checkout/config.js';
import { createPaymentService } from './checkout/payment-service.js';
import { createCheckoutStore } from './checkout/checkout-store.js';
import { createHeader } from './components/header.js';
import { createHero } from './components/hero.js';
import { createProductRange } from './components/product-range.js';
import { createWhyHandypad } from './components/why-handypad.js';
import { createHandypadConfigurator } from './components/handypad-configurator.js';
import { createOrderSummary } from './components/order-summary.js';
import { createFooter } from './components/footer.js';
import { language, t } from './lib/locale.js';
import { element } from './lib/dom.js';
import { scrollToElement } from './lib/scroll.js';

const feedback = document.querySelector('#cart-feedback');
let toastTimer;
function positionToast() {
  if (!feedback.classList.contains('is-visible')) return;
  feedback.classList.remove('toast-announcement-only');
  feedback.style.left = ''; feedback.style.top = ''; feedback.style.bottom = ''; feedback.style.right = '';
  const box = feedback.getBoundingClientRect();
  const obstacles = [...document.querySelectorAll('button,input,a,select,.site-header,.mobile-summary-bar')]
    .map(el => el.getBoundingClientRect()).filter(r => r.width && r.height && r.bottom > 0 && r.top < innerHeight);
  const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
  const candidates = [[box.left, box.top], [16, box.top], [innerWidth - box.width - 16, headerBottom + 8], [16, headerBottom + 8]];
  const safe = candidates.find(([x, y]) => y >= 0 && y + box.height <= innerHeight && !obstacles.some(r => x < r.right && x + box.width > r.left && y < r.bottom && y + box.height > r.top));
  if (safe) { feedback.style.left = `${safe[0]}px`; feedback.style.top = `${safe[1]}px`; feedback.style.bottom = 'auto'; feedback.style.right = 'auto'; }
  else feedback.classList.add('toast-announcement-only'); // Keep the live announcement; the shared summary remains visible feedback.
}
window.addEventListener('scroll', positionToast, { passive: true });
window.addEventListener('resize', positionToast);
function announce(message) {
  clearTimeout(toastTimer);
  feedback.textContent = '';
  requestAnimationFrame(() => {
    feedback.textContent = message;
    feedback.classList.add('is-visible');
    positionToast();
    toastTimer = setTimeout(() => feedback.classList.remove('is-visible'), 2200);
  });
}

function start() {
  const catalogue = createCatalogue(products);
  let storage;
  try { storage = window.localStorage; } catch { /* Session-only cart remains usable. */ }
  const cart = createCartStore(catalogue, storage, language);
  const checkout = createCheckoutStore({ cart, storage, currency: language === 'vi' ? 'VND' : 'USD', config: checkoutConfig,
    service: createPaymentService(checkoutConfig),
    onEvent: (type, order) => window.dispatchEvent(new CustomEvent(`handypad:${type}`, { detail: order })),
  });
  document.querySelector('.skip-link').textContent = t('Skip to order');
  document.querySelector('#site-header').replaceWith(createHeader());
  const shop = element('div', 'shop-section');
  const workflow = element('div', 'shopping-layout container');
  const shopping = element('div', 'shopping-main');
  shopping.append(createHandypadConfigurator({ cart, announce, checkout }));
  const summary = createOrderSummary({ catalogue, cart, announce, checkout });
  workflow.append(shopping, summary.element);
  shop.append(workflow);
  document.querySelector('#main').replaceChildren(createHero(), createProductRange(), createWhyHandypad(), shop);
  document.querySelector('#main').after(createFooter());
  // Deep links such as #configure-order land after the page is built.
  const target = /^#[\w-]+$/.test(location.hash) ? document.querySelector(location.hash) : null;
  if (target) requestAnimationFrame(() => scrollToElement(target));
}

try { start(); } catch {
  const message = document.createElement('p');
  message.className = 'container startup-message';
  message.textContent = 'The page could not be loaded. Reload this page to try again.';
  message.setAttribute('role', 'alert');
  document.querySelector('#main').replaceChildren(message);
}
