import { PAYMENT_METHODS, methodOffered, CUSTOMER_FIELDS, SHIPPING_FIELDS, DRAFT_KEY, restoreDraft, validateContact, buildOrderDraft } from './order-draft.js';
import { PaymentServiceError, validatePaymentResponse } from './payment-service.js';
import { countryByCode } from './countries.js';

const ATTEMPT_KEY = 'handypad.payment-attempt.v1';
export function createCheckoutStore({ cart, storage, currency = 'USD', config = {}, service, onEvent = () => {} }) {
  const fields = restoreDraft(storage);
  let provinceCountry = fields.shipping.countryCode;
  const paymentMode = config.paymentMode === 'simulation' ? 'simulation' : 'live';
  let simulationStatus = 'idle';
  const methodAvailability = Object.fromEntries(PAYMENT_METHODS.map(method => [method, methodOffered(method, currency) && (paymentMode === 'simulation' || (Boolean(service.configured) && service.capabilities?.[method] === true))]));
  // Restore contact data, but never restore a payment method that is unavailable now.
  if (!methodAvailability[fields.method]) fields.method = null;
  const listeners = new Set();
  let session = {}, revision = 0, busy = false, error = null;
  let attemptKey = null;
  const draft = () => buildOrderDraft(cart.getItems(), fields, currency, session);
  const fingerprint = () => JSON.stringify(buildOrderDraft(cart.getItems(), fields, currency));
  try {
    const attempt = JSON.parse(storage?.getItem(ATTEMPT_KEY));
    if (paymentMode === 'live' && attempt?.fingerprint === fingerprint() && typeof attempt.key === 'string') {
      attemptKey = attempt.key;
      if (typeof attempt.orderId === 'string') session.orderId = attempt.orderId;
      if (typeof attempt.transactionId === 'string' && session.orderId) {
        session.transactionId = attempt.transactionId;
        // Stored status is never evidence of payment. Recheck with the service.
        session.status = 'pending';
      }
    }
  } catch { /* Invalid storage is ignored. */ }

  function snapshot() {
    const order = draft();
    const errors = validateContact(order.customer, order.shipping, order.vatInvoice);
    const shippingUnlocked = order.items.length > 0;
    const paymentUnlocked = shippingUnlocked && Object.keys(errors).length === 0;
    return { order, errors, shippingUnlocked, paymentUnlocked, busy, error, paymentMode, simulationStatus, configured: service.configured, methodAvailability,
      canPay: paymentUnlocked && methodAvailability[fields.method] === true,
      checkoutURL: session.checkoutURL ?? null, bank: session.bank ?? null };
  }
  function publish() {
    try {
      storage?.setItem(DRAFT_KEY, JSON.stringify({ version: 1, ...fields }));
      if (paymentMode === 'live') {
        if (attemptKey) storage?.setItem(ATTEMPT_KEY, JSON.stringify({ key: attemptKey, fingerprint: fingerprint(), orderId: session.orderId, transactionId: session.transactionId }));
        else storage?.removeItem(ATTEMPT_KEY);
      }
    } catch { /* Keep the session usable when browser storage is unavailable. */ }
    listeners.forEach(listener => listener(snapshot()));
    schedulePoll();
  }
  // Live payments are confirmed by provider webhooks; poll quietly until the order is PAID.
  let pollTimer = null;
  function schedulePoll() {
    const waiting = paymentMode === 'live' && session.transactionId && session.status === 'pending';
    if (!waiting) { clearTimeout(pollTimer); pollTimer = null; return; }
    if (pollTimer) return;
    pollTimer = setTimeout(async () => {
      pollTimer = null;
      if (busy || !session.transactionId) { schedulePoll(); return; }
      const currentRevision = revision;
      try {
        const response = await service.getPaymentStatus(session.orderId, session.transactionId);
        if (revision === currentRevision && !busy) accept(response);
      } catch { /* Keep waiting; a failed status check is not a failed payment. */ }
      schedulePoll();
    }, 4000);
  }
  function invalidate() { revision++; session = {}; simulationStatus = 'idle'; busy = false; error = null; attemptKey = null; publish(); }
  let firstCartEvent = true;
  cart.subscribe(() => { if (firstCartEvent) { firstCartEvent = false; return; } invalidate(); });
  function emit(type) { onEvent(type, structuredClone(draft())); }
  async function run(action) {
    if (busy) return;
    const currentRevision = revision;
    busy = true; error = null; publish();
    const isCurrent = () => revision === currentRevision;
    try { await action(isCurrent); }
    catch (failure) {
      if (isCurrent()) {
        error = failure instanceof PaymentServiceError ? failure.code : 'service_error';
        // The order behind a restored attempt is no longer known in this browser; start a fresh one.
        if (error === 'order_expired') { session = {}; attemptKey = null; }
        // A network error is not proof that the provider failed a transaction.
        session.status = session.transactionId ? 'pending' : 'idle';
      }
    } finally { if (isCurrent()) { busy = false; publish(); } }
  }
  function accept(response) {
    validatePaymentResponse(response, draft(), session.transactionId);
    const wasConfirmed = session.status === 'confirmed';
    session = { ...session, status: response.status, transactionId: response.transactionId,
      amountPaid: response.status === 'confirmed' ? response.amountPaid : null,
      checkoutURL: response.checkoutURL ?? null, bank: response.bank ?? null };
    publish();
    if (response.status === 'confirmed' && !wasConfirmed) emit('payment-confirmed');
  }
  schedulePoll();
  return {
    getState: snapshot,
    subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
    selectCountry(code) {
      const country = countryByCode(code);
      fields.shipping.countryCode = country?.code ?? ''; fields.shipping.country = country?.name ?? '';
      // A province picked for another country no longer applies (re-picking the same country keeps it).
      if (country && country.code !== provinceCountry) fields.shipping.cityProvince = '';
      if (country) provinceCountry = country.code;
      invalidate();
    },
    setField(group, key, value) {
      if (!(group === 'customer' ? CUSTOMER_FIELDS : group === 'shipping' ? SHIPPING_FIELDS : []).includes(key)) return;
      fields[group][key] = String(value).slice(0, 500);
      if (group === 'shipping' && key === 'country') fields.shipping.countryCode = '';
      invalidate();
    },
    // Optional VAT invoice: when on, Company and Tax code become required (see validateContact).
    setInvoice(value) { if (fields.wantsInvoice !== Boolean(value)) { fields.wantsInvoice = Boolean(value); invalidate(); } },
    selectMethod(value) { if (PAYMENT_METHODS.includes(value) && methodAvailability[value] && fields.method !== value) { fields.method = value; invalidate(); } },
    startPayment() {
      if (!snapshot().canPay || busy || (session.transactionId && session.status !== 'failed')) return Promise.resolve();
      if (paymentMode === 'simulation') return run(async isCurrent => {
        simulationStatus = 'loading'; publish();
        await new Promise(resolve => setTimeout(resolve, 300));
        if (isCurrent()) simulationStatus = fields.method === 'bank_transfer' ? 'awaiting_confirmation' : 'pending';
      });
      if (session.status === 'failed') { session = {}; attemptKey = null; }
      return run(async isCurrent => {
        if (!service.configured) throw new PaymentServiceError('not_configured');
        attemptKey ??= globalThis.crypto.randomUUID();
        publish();
        if (!session.orderId) {
          const result = await service.createOrderDraft(draft(), attemptKey);
          if (!isCurrent()) return;
          if (!result || typeof result.orderId !== 'string' || !result.orderId) throw new PaymentServiceError('invalid_response');
          session.orderId = result.orderId; publish(); emit('order-captured');
        }
        const response = await service.createPayment(session.orderId, draft().payment, attemptKey);
        if (isCurrent()) accept(response);
      });
    },
    checkStatus() {
      if (!session.transactionId || session.status === 'confirmed') return Promise.resolve();
      return run(async isCurrent => {
        const response = await service.getPaymentStatus(session.orderId, session.transactionId);
        if (isCurrent()) accept(response);
      });
    },
    submitReference(reference) {
      if (!session.transactionId || fields.method !== 'bank_transfer' || !reference.trim() || session.status === 'confirmed') return Promise.resolve();
      return run(async isCurrent => {
        const response = await service.submitBankTransferReference(session.orderId, session.transactionId, reference.trim());
        if (isCurrent()) accept(response);
      });
    },
  };
}
