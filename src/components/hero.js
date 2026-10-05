import { element } from '../lib/dom.js';
import { t } from '../lib/locale.js';
import { scrollToElement } from '../lib/scroll.js';
import { linkToSpecs } from '../lib/specs.js';

const GALLERY = ['single', 'double', 'pair', 'reflective', 'one-metre'];
const STATS = [['3', 'sizes'], ['2', 'add-ons'], ['3M-grade', 'reflective strip'], ['15 min', 'quick response']];
const GALLERY_INTERVAL = 3500;

function createGallery() {
  const gallery = element('div', 'hero-gallery');
  gallery.setAttribute('role', 'img');
  gallery.setAttribute('aria-label', t('HANDYPAD product showcase'));
  const images = GALLERY.map((name, index) => {
    const img = element('img', 'hero-gallery-image');
    img.src = `./src/assets/products/handypad/hero-gallery/${name}.png`;
    img.alt = '';
    img.width = 640;
    img.height = name === 'pair' ? 514 : 640;
    img.decoding = 'async';
    img.loading = index ? 'lazy' : 'eager';
    img.classList.toggle('is-active', index === 0);
    gallery.append(img);
    return img;
  });

  // Crossfade the product shots; pause while hovered (keeps running with OS reduced motion,
  // where base.css turns the fade into a plain swap).
  let active = 0, timer = 0, paused = false;
  const show = index => {
    images[active].classList.remove('is-active');
    active = index;
    images[active].classList.add('is-active');
  };
  const stop = () => { clearInterval(timer); timer = 0; };
  const start = () => {
    stop();
    if (paused || document.hidden) return;
    timer = setInterval(() => show((active + 1) % images.length), GALLERY_INTERVAL);
  };
  gallery.addEventListener('mouseenter', () => { paused = true; stop(); });
  gallery.addEventListener('mouseleave', () => { paused = false; start(); });
  document.addEventListener('visibilitychange', start);
  start();
  return gallery;
}

export function createHero() {
  const hero = element('section', 'hero');
  hero.id = 'hero';
  hero.setAttribute('aria-labelledby', 'hero-title');
  const inner = element('div', 'container hero-inner');
  const copy = element('div', 'hero-copy');
  const eyebrow = element('p', 'eyebrow', t('HANDYPAD BY HANDYMAN'));
  const title = element('h1', '', t('Simple impact protection'));
  title.id = 'hero-title';
  title.append(element('span', 'hero-title-second', t('for demanding worksites.')));
  const intro = element('p', 'hero-intro', t("Protect exposed structures, equipment and people with a durable, reusable pad that's quick to install and easy to maintain."));

  const actions = element('div', 'hero-actions');
  const order = element('a', 'button button-primary hero-action', t('BUY NOW'));
  order.href = '#configure-order';
  order.addEventListener('click', event => {
    const target = document.querySelector('#configure-order');
    if (!target) return;
    event.preventDefault();
    scrollToElement(target, { onDone: () => target.querySelector('h2')?.focus({ preventScroll: true }) });
    history.replaceState(null, '', '#configure-order');
  });
  const specs = linkToSpecs(element('a', 'button hero-action hero-action-secondary', t('VIEW SPECS')));
  actions.append(order, specs);

  const stats = element('dl', 'hero-stats');
  stats.setAttribute('aria-label', t('Product features'));
  for (const [value, label] of STATS) {
    const item = element('div', 'hero-stat');
    item.append(element('dt', '', t(label)), element('dd', '', t(value)));
    stats.append(item);
  }

  copy.append(eyebrow, title, intro, actions, stats);
  inner.append(copy, createGallery());
  hero.append(inner);
  return hero;
}
