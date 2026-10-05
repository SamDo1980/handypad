import { element, icon } from '../lib/dom.js';
import { t } from '../lib/locale.js';
import { corporate } from '../data/corporate.js';

export function createFooter() {
  const footer = element('footer', 'site-footer');
  const inner = element('div', 'container footer-inner');
  const columns = element('div', 'footer-columns');

  const brand = element('div', 'footer-brand');
  const title = element('h2', 'footer-brand-title', 'HANDYPAD ');
  title.append(element('span', 'footer-brand-secondary', `by ${corporate.legal_en}`));
  const tax = element('p', 'footer-tax');
  tax.append(
    element('span', 'tax-label', `${t('Tax code')}:`),
    document.createTextNode(' '),
    element('span', 'tax-value', corporate.tax_code),
  );
  brand.append(title, tax);

  const contact = element('section', 'footer-contact');
  contact.id = 'contact';
  contact.setAttribute('aria-labelledby', 'footer-contact-title');

  const heading = element('h3', 'footer-heading', t('Contact'));
  heading.id = 'footer-contact-title';

  const digits = corporate.phone_href.replace(/\D/g, '');
  const address = element('address', 'footer-contact-groups');
  for (const [name, label, value, href] of [
    ['pin', t('Address'), corporate.address, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(corporate.address)}`],
    ['phone', t('Phone / WhatsApp / Zalo'), corporate.phone, corporate.phone_href],
    ['mail', t('Email'), corporate.email, `mailto:${corporate.email}`],
  ]) {
    const row = element('div', 'contact-group');
    const body = element('div', 'contact-body');
    body.append(element('span', 'sr-only', `${label}: `));
    const detail = element('a', 'contact-value', value);
    detail.href = href;
    if (href.startsWith('https:')) { detail.target = '_blank'; detail.rel = 'noopener'; }
    body.append(detail);
    if (name === 'phone') {
      const chats = element('span', 'contact-chat-links');
      for (const [text, url] of [['WhatsApp', `https://wa.me/${digits}`], ['Zalo', corporate.zalo_href]]) {
        const chat = element('a', 'contact-chat-link', text);
        chat.href = url; chat.target = '_blank'; chat.rel = 'noopener';
        chat.setAttribute('aria-label', t(`Chat on ${text}`));
        chats.append(chat);
      }
      body.append(chats);
    }
    row.append(icon(name), body);
    address.append(row);
  }

  contact.append(heading, address);
  columns.append(brand, contact);

  inner.append(
    columns,
    element('p', 'footer-copyright', `© ${new Date().getFullYear()} DLV Corporation. ${t('All rights reserved.')}`),
  );
  footer.append(inner);
  return footer;
}
