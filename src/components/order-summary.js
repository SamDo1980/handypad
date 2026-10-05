import { element, icon } from '../lib/dom.js';
import { language, t } from '../lib/locale.js';
import { formatPrice } from '../lib/storefront.js';
import { orderTotals } from '../cart/order-totals.js';
import { createOrderRow } from './order-row.js';
import { createPaymentSummary } from './order-completion.js';
import { scrollToElement } from '../lib/scroll.js';

export function createOrderSummary({ catalogue, cart, announce, checkout }) {
  const root = element('aside', 'order-summary');
  root.setAttribute('aria-label', t('Order summary'));
  const slot = element('div', 'summary-desktop-slot');
  const shell = element('div', 'summary-shell');
  const header = element('div', 'summary-header');
  const heading = element('h3', '', t('Order summary'));
  heading.id = 'order-summary-title'; heading.tabIndex = -1;
  const close = element('button', 'summary-close', t('Close'));
  close.type = 'button';
  const headerCopy = element('div');
  const counts = element('p', 'order-counts');
  counts.title = t('Distinct SKU rows · Total quantity');
  headerCopy.append(heading, counts);
  header.append(headerCopy, close);
  const content = element('div', 'summary-content');
  const order = element('section', 'saved-order');
  order.setAttribute('aria-label', t('Added to your order'));
  const empty = element('div', 'order-empty');
  empty.append(element('p', '', t('Your selected items will appear here.')));
  const list = element('ul', 'order-items');
  order.append(empty, list);
  content.append(order);
  const footer = element('div', 'order-totals');
  const totalRow = element('div', 'order-total-line');
  const total = element('strong', 'order-total-amount');
  const totalLabel = element('span', 'order-total-label', t('Estimated total'));
  totalRow.append(totalLabel, total);
  const feedback = element('p', 'sr-only');
  feedback.setAttribute('role', 'status');
  const paymentFooter = element('div');
  const nextAction = element('button', 'button button-primary summary-next-action');
  nextAction.type = 'button';
  nextAction.hidden = true;
  footer.append(totalRow, paymentFooter, nextAction, feedback);
  shell.append(header, content, footer);
  slot.append(shell);

  const dialog = element('dialog', 'mobile-order-dialog');
  dialog.setAttribute('aria-labelledby', heading.id);
  const bar = element('button', 'mobile-summary-bar');
  bar.type = 'button';
  bar.setAttribute('aria-expanded', 'false');
  bar.setAttribute('aria-controls', 'mobile-order-details');
  dialog.id = 'mobile-order-details';
  const barCopy = element('span', 'mobile-summary-copy');
  const barLabel = element('span');
  const barAmount = element('strong');
  const barAction = element('span', 'mobile-summary-action');
  barCopy.append(barLabel, barAmount);
  bar.append(icon('cart'), barCopy, barAction);
  root.append(slot, dialog, bar);
  const mobile = matchMedia('(max-width: 767px)');
  function placeSummary() {
    if (!mobile.matches && dialog.open) dialog.close();
    (mobile.matches ? dialog : slot).append(shell);
  }
  mobile.addEventListener('change', placeSummary);
  placeSummary();
  function open() {
    if (!mobile.matches) {
      heading.focus({ preventScroll: true });
      scrollToElement(shell);
      return;
    }
    if (!dialog.open) dialog.showModal();
    bar.setAttribute('aria-expanded', 'true');
    close.focus({ preventScroll: true });
  }
  bar.addEventListener('click', open);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    bar.setAttribute('aria-expanded', 'false');
    if (mobile.matches && !bar.hidden) bar.focus({ preventScroll: true });
  });

  let totals = orderTotals([], language === 'vi' ? 'VND' : 'USD');
  const rows = new Map();
  const countText = value => language === 'vi'
    ? `${value.lineCount} loại · ${value.quantity} tấm`
    : `${value.lineCount} ${value.lineCount === 1 ? 'product' : 'products'} · ${value.quantity} ${value.quantity === 1 ? 'unit' : 'units'}`;

  let actionTargetSelector = null;
  let actionVisible = false;
  let visibilityFrame = 0;
  function resolveActionTarget() {
    return actionTargetSelector ? document.querySelector(actionTargetSelector) : null;
  }
  function targetIsInWorkingView(target) {
    if (!target) return false;
    const rect = target.getBoundingClientRect();
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
    const viewportBottom = window.innerHeight;
    const visible = Math.max(0, Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, headerBottom));
    const threshold = Math.min(160, Math.max(88, rect.height * 0.22));
    return visible >= threshold;
  }
  function smoothScrollToTarget(target) {
    scrollToElement(target, { onDone: refreshNextActionVisibility });
  }
  function refreshNextActionVisibility() {
    if (visibilityFrame) cancelAnimationFrame(visibilityFrame);
    visibilityFrame = requestAnimationFrame(() => {
      visibilityFrame = 0;
      const state = checkout?.getState();
      const target = resolveActionTarget();
      if (!state?.order.items.length || !target) {
        nextAction.hidden = true;
        actionVisible = false;
        return;
      }
      actionVisible = !targetIsInWorkingView(target);
      nextAction.hidden = !actionVisible;
    });
  }
  function updateNextAction(state) {
    if (!state?.order.items.length) {
      actionTargetSelector = null;
      nextAction.hidden = true;
      return;
    }
    // Keep the destination as a selector rather than a detached DOM node.
    // Order Summary is created before the workflow is mounted, so resolving
    // the target lazily ensures the CTA also appears for carts restored on load.
    actionTargetSelector = state.paymentUnlocked ? '#order-payment' : '#contact-shipping';
    nextAction.textContent = t(state.paymentUnlocked ? 'PAY NOW' : 'ORDER');
    nextAction.setAttribute('aria-label', t(state.paymentUnlocked ? 'Go to payment' : 'Go to Contact & Shipping'));
    refreshNextActionVisibility();
  }
  nextAction.addEventListener('click', () => {
    const target = resolveActionTarget();
    if (!target) return;
    smoothScrollToTarget(target);
  });
  window.addEventListener('scroll', refreshNextActionVisibility, { passive: true });
  window.addEventListener('resize', refreshNextActionVisibility);

  function updateBar() {
    const order = checkout?.getState().order;
    const showDue = order?.items.length && order.payment.amountOption && order.payment.amountDueNow !== null;
    barLabel.textContent = showDue ? t('Amount due now') : countText(totals);
    barAmount.textContent = formatPrice(showDue ? order.payment.amountDueNow : totals.amount, totals.currency);
    barAction.textContent = t('View order');
    totalLabel.textContent = showDue ? t('Amount due now') : t('Estimated total');
    total.textContent = formatPrice(showDue ? order.payment.amountDueNow : totals.amount, totals.currency);
    shell.dataset.financialState = showDue ? 'payment' : 'estimate';
  }
  cart.subscribe(items => {
    const ids = new Set(items.map(item => item.id));
    for (const [id, row] of rows) if (!ids.has(id)) { row.element.remove(); rows.delete(id); }
    for (const item of items) {
      if (!rows.has(item.id)) {
        const row = createOrderRow(catalogue.getById(item.id), item, cart, announce, () => {
          (list.querySelector('input, button:not(:disabled)') ?? heading).focus({ preventScroll: true });
        });
        rows.set(item.id, row); list.append(row.element);
      }
      rows.get(item.id).update(item);
    }
    empty.hidden = items.length > 0;
    list.hidden = !items.length;
    bar.hidden = !items.length;
    totals = orderTotals(items, language === 'vi' ? 'VND' : 'USD');
    counts.replaceChildren(element('span', 'order-line-count', String(totals.lineCount)),
      document.createTextNode(language === 'vi' ? ' loại · ' : ` ${totals.lineCount === 1 ? 'product' : 'products'} · `),
      element('span', 'order-unit-count', String(totals.quantity)),
      document.createTextNode(language === 'vi' ? ' tấm' : ` ${totals.quantity === 1 ? 'unit' : 'units'}`));
    counts.hidden = !items.length;
    total.textContent = formatPrice(totals.amount, totals.currency);
    feedback.textContent = `${t('Order updated')}. ${countText(totals)}. ${t('Estimated total')}: ${total.textContent}`;
    updateBar();
    updateNextAction(checkout?.getState());
  });
  checkout?.subscribe(state => {
    const { order } = state;
    paymentFooter.replaceChildren(...(order.items.length && order.payment.amountOption ? [createPaymentSummary(order, true)] : []));
    updateBar();
    updateNextAction(state);
  });

  return { element: root, open };
}
