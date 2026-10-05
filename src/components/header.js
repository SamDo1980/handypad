import { element } from '../lib/dom.js';
import { language, t } from '../lib/locale.js';
import { createContactOptions } from './contact-options.js';
import { scrollToElement } from '../lib/scroll.js';
import { linkToSpecs } from '../lib/specs.js';

function scrollToSection(href) {
  scrollToElement(document.querySelector(href));
}

export function createHeader() {
  const baseURL = import.meta.env?.BASE_URL ?? './';
  const header = element('header', 'site-header');
  const inner = element('div', 'container header-inner');
  const brand = element('a', 'brand');
  brand.href = './';
  brand.setAttribute('aria-label', 'Handyman home');

  const logo = element('img', 'brand-logo');
  logo.src = `${baseURL}assets/handyman-logo.png`;
  logo.alt = 'Handyman — Where jobs get done';
  logo.width = 584;
  logo.height = 143;
  brand.append(logo);

  const nav = element('nav', 'header-actions');
  nav.setAttribute('aria-label', t('Menu'));

  const links = element('div', 'header-nav-links');
  links.id = 'header-section-links';

  const sectionLinks = [
    ['PRODUCT RANGE', '#product-range'],
    ['ORDER', '#configure-order'],
  ];

  for (const [label, href] of sectionLinks) {
    const link = element('a', 'header-section-link', t(label));
    link.href = href;
    link.addEventListener('click', event => {
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      close();
      scrollToSection(href);
      history.replaceState(null, '', href);
    });
    links.append(link);
  }

  links.append(linkToSpecs(element('a', 'header-section-link header-catalogue-link', t('SPECS'))));

  // Phone menu: the contact channels sit directly in the menu.
  const menuContact = element('div', 'header-contact-menu');
  menuContact.append(element('p', 'header-contact-menu-title', t('CONTACT SALES')), createContactOptions());
  links.append(menuContact);

  const locales = element('div', 'language-switch');
  locales.setAttribute('aria-label', 'Language / Ngôn ngữ');
  locales.setAttribute('role', 'group');

  for (const code of ['en', 'vi']) {
    const button = element('button', 'language-option', code.toUpperCase());
    button.type = 'button';
    button.dataset.locale = code;
    button.setAttribute('aria-label', code === 'en' ? 'English' : 'Tiếng Việt');
    button.setAttribute('aria-pressed', String(code === language));
    button.addEventListener('click', () => {
      if (code === language) return;
      const url = new URL(location.href);
      url.searchParams.set('lang', code);
      // Configurator and checkout drafts live in storage, so they survive the reload.
      location.assign(url);
    });
    locales.append(button);
  }

  // Desktop: CONTACT SALES opens a small panel with the three channels.
  const salesWrap = element('div', 'header-contact header-contact-sales--desktop');
  const desktopSales = element('button', 'header-contact-sales', t('CONTACT SALES'));
  desktopSales.type = 'button';
  const salesPanel = element('div', 'header-contact-panel');
  salesPanel.id = 'header-contact-panel';
  salesPanel.hidden = true;
  salesPanel.append(createContactOptions());
  desktopSales.setAttribute('aria-controls', salesPanel.id);
  desktopSales.setAttribute('aria-expanded', 'false');
  salesWrap.append(desktopSales, salesPanel);
  function setSalesOpen(open) {
    salesPanel.hidden = !open;
    desktopSales.setAttribute('aria-expanded', String(open));
  }
  desktopSales.addEventListener('click', () => setSalesOpen(salesPanel.hidden));
  salesPanel.addEventListener('click', event => { if (event.target.closest('a')) setSalesOpen(false); });
  document.addEventListener('pointerdown', event => { if (!salesWrap.contains(event.target)) setSalesOpen(false); });
  salesWrap.addEventListener('focusout', event => { if (event.relatedTarget && !salesWrap.contains(event.relatedTarget)) setSalesOpen(false); });

  const toggle = element('button', 'header-menu', t('Menu'));
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', links.id);
  toggle.setAttribute('aria-expanded', 'false');

  const narrow = matchMedia('(max-width: 999px)');

  function close() {
    links.hidden = narrow.matches;
    toggle.hidden = !narrow.matches;
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    links.hidden = !links.hidden;
    toggle.setAttribute('aria-expanded', String(!links.hidden));
  });

  links.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });

  header.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!salesPanel.hidden) {
      setSalesOpen(false);
      desktopSales.focus();
    } else if (narrow.matches) {
      close();
      toggle.focus();
    }
  });

  narrow.addEventListener('change', close);
  close();

  nav.append(links, locales, salesWrap, toggle);
  inner.append(brand, nav);
  header.append(inner);
  return header;
}
