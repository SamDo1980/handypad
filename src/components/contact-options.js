import { element } from '../lib/dom.js';
import { t } from '../lib/locale.js';
import { corporate } from '../data/corporate.js';

// Direct sales channels shown by CONTACT SALES: call, WhatsApp message, Zalo message.
export function createContactOptions() {
  const digits = corporate.phone_href.replace(/\D/g, '');
  const channels = [
    { icon: 'phone', title: t('Call'), detail: corporate.phone, href: corporate.phone_href },
    { icon: 'whatsapp', title: 'WhatsApp', detail: t('Send a message'), href: `https://wa.me/${digits}` },
    { icon: 'zalo', title: 'Zalo', detail: t('Send a message'), href: corporate.zalo_href },
  ];
  const list = element('ul', 'contact-options');
  for (const channel of channels) {
    const item = element('li');
    const link = element('a', 'contact-option');
    link.href = channel.href;
    if (channel.href.startsWith('https:')) { link.target = '_blank'; link.rel = 'noopener'; }
    const image = element('img', 'contact-option-icon');
    image.src = `./assets/contact/${channel.icon}.png`;
    image.alt = '';
    image.width = 40;
    image.height = 40;
    const copy = element('span', 'contact-option-copy');
    copy.append(element('span', 'contact-option-title', channel.title), element('span', 'contact-option-detail', channel.detail));
    link.append(image, copy);
    link.setAttribute('aria-label', `${channel.title}: ${channel.detail}`);
    item.append(link);
    list.append(item);
  }
  return list;
}
