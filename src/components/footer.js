import { element } from '../lib/dom.js';
import { t } from '../lib/locale.js';
import { corporate } from '../data/corporate.js';

// Same footer as the specs catalogue (handypad-catalogue/catalogue.html), without its tagline:
// one navy ocean band with a single row of contact links. The filled icons are the
// catalogue's own; Zalo uses its app icon.
const ICONS = {
  mail: '<path fill="currentColor" d="M3.5 4.5h17A1.5 1.5 0 0 1 22 6v12a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18V6a1.5 1.5 0 0 1 1.5-1.5zm.8 2.2v.4l7.7 5.4 7.7-5.4v-.4zm15.4 2.8-7.1 5a1 1 0 0 1-1.2 0l-7.1-5v7.8h15.4z"/>',
  globe: '<g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9.2"/><ellipse cx="12" cy="12" rx="4" ry="9.2"/><path d="M2.8 12h18.4M4.5 7h15M4.5 17h15"/></g>',
  facebook: '<path fill="currentColor" d="M12 2a10 10 0 0 0-1.6 19.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 12 2z"/>',
  whatsapp: '<path fill="currentColor" d="M12 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.2-1.4A9.9 9.9 0 1 0 12 2zm0 18.1a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.1zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.1-1.2l-.4-.3z"/>',
};

function contactLink(label, href, iconName) {
  const link = element('a', 'footer-link');
  link.href = href;
  if (href.startsWith('https:')) { link.target = '_blank'; link.rel = 'noopener'; }
  if (iconName === 'zalo') {
    const image = element('img', 'footer-link-icon');
    image.src = './assets/contact/zalo.png';
    image.alt = '';
    image.width = 24;
    image.height = 24;
    link.append(image);
  } else {
    const holder = element('span', 'footer-link-icon');
    // Only the static paths above are used.
    holder.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[iconName]}</svg>`;
    link.append(holder);
  }
  link.append(element('span', '', label));
  return link;
}

export function createFooter() {
  const footer = element('footer', 'site-footer');

  const band = element('nav', 'footer-band');
  band.id = 'contact';
  band.setAttribute('aria-label', t('Contact'));
  const links = element('div', 'container footer-links');
  // "Contact:" leads the row of links on wide screens; the nav's aria-label already says it.
  const heading = element('span', 'footer-title', `${t('Contact')}:`);
  heading.setAttribute('aria-hidden', 'true');
  const digits = corporate.phone_href.replace(/\D/g, '');
  links.append(
    heading,
    contactLink(corporate.email, `mailto:${corporate.email}`, 'mail'),
    contactLink(corporate.website, corporate.website_href, 'globe'),
    contactLink('Facebook', corporate.facebook_href, 'facebook'),
    contactLink('WhatsApp', `https://wa.me/${digits}`, 'whatsapp'),
    contactLink(corporate.zalo_label, corporate.zalo_href, 'zalo'),
  );
  band.append(links);

  footer.append(band);
  return footer;
}
