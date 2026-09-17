(() => {
  const root = document.getElementById('configure-order');
  if (!root) return;

  const isVi = () => document.documentElement.lang === 'vi';
  const L = {
    zaloPreparing: () => isVi() ? 'Đang chuẩn bị thanh toán ZaloPay...' : 'Preparing your ZaloPay payment...',
    zaloWaiting: () => isVi() ? 'Đang chờ xác nhận từ ZaloPay...' : 'Waiting for confirmation from ZaloPay...',
    bankPreparing: () => isVi() ? 'Đang tạo mã QR thanh toán...' : 'Generating your payment QR code...',
    bankWaiting: () => isVi() ? 'Đang chờ chuyển khoản — trang sẽ tự cập nhật khi hệ thống nhận được tiền.' : 'Waiting for your transfer — this updates automatically once it is received.',
    cardGenericError: () => isVi() ? 'Có lỗi xảy ra, vui lòng thử lại.' : 'Something went wrong, please try again.',
    stripeNotConfigured: () => isVi() ? 'Stripe chưa được cấu hình (thiếu STRIPE_PUBLISHABLE_KEY).' : 'Stripe is not configured (missing STRIPE_PUBLISHABLE_KEY).'
  };

  const cardErrorsNode = root.querySelector('#order-card-errors');
  const cardPayBtnOriginal = root.querySelector('#order-card-pay-btn');
  const zalopayNote = root.querySelector('#order-zalopay-note');
  const zalopayOpenBtn = root.querySelector('#order-zalopay-open-btn');
  const zalopayReopenBtn = root.querySelector('#order-zalopay-reopen-btn');
  const zalopayQrSlot = root.querySelector('#order-zalopay-qr-slot');
  const bankNote = root.querySelector('#order-bank-note');
  const vietqrSlot = root.querySelector('#order-vietqr-slot');
  const bankAccountNameNode = root.querySelector('#order-bank-account-name');
  const bankAccountNumberNode = root.querySelector('#order-bank-account-number');
  const bankBankNameNode = root.querySelector('#order-bank-bank-name');
  const bankTransferContentNode = root.querySelector('#order-bank-transfer-content');

  const backend = {
    startedKey: null,
    order: null,     
    popup: null,     
    pollTimer: 0,
    stripe: (window.Stripe && window.STRIPE_PUBLISHABLE_KEY) ? Stripe(window.STRIPE_PUBLISHABLE_KEY) : null,
    elements: null,
    cardNumberElement: null,
    cardExpiryElement: null,
    cardCvcElement: null,
    clientSecret: null
  };

  const vndAmountForPayload = payload => Math.max(1, Math.round(Number(payload.orderTotalVnd) || 0));

  const contactPayloadFor = payload => ({
    customerName: payload.customer?.fullName || '',
    customerEmail: payload.customer?.email || '',
    customerPhone: payload.customer?.phone || '',
    note: [
      payload.customer?.company,
      ...(payload.items || []).map(item => `${item.quantity}x ${item.sku}${item.addOns?.length ? ' +' + item.addOns.join('+') : ''}`),
      payload.shipping?.address,
      payload.shipping?.city,
      payload.shipping?.country
    ].filter(Boolean).join(' — ')
  });

  const createOrder = async (backendMethod, payload) => {
    const body = {
      method: backendMethod,
      paymentType: payload.paymentType === 'deposit' ? 'deposit' : 'full',
      ...contactPayloadFor(payload)
    };
    if (body.paymentType !== 'deposit') {
      body.amount = vndAmountForPayload(payload);
    }
    const res = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Order creation failed');
    return data;
  };

  const stopPolling = () => {
    if (backend.pollTimer) window.clearInterval(backend.pollTimer);
    backend.pollTimer = 0;
  };

  const pollOrderStatus = (orderId, onPaid) => {
    stopPolling();
    backend.pollTimer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/order-status/${orderId}`);
        const data = await res.json();
        if (data.status === 'PAID') {
          stopPolling();
          onPaid();
        }
      } catch (_) {}
    }, 4000);
  };

  const showCardError = message => {
    if (!cardErrorsNode) return;
    cardErrorsNode.textContent = message || '';
    cardErrorsNode.hidden = !message;
  };

  const setQrSlot = (slot, imgUrl) => {
    if (!slot) return;
    slot.innerHTML = '';
    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = 'Payment QR code';
    slot.appendChild(img);
    slot.hidden = false;
    slot.parentElement?.classList.remove('order-payment-qr-layout--no-preview');
  };

  const hideQrSlot = slot => {
    if (!slot) return;
    slot.hidden = true;
    slot.innerHTML = '';
    slot.parentElement?.classList.add('order-payment-qr-layout--no-preview');
  };

  const writeLoadingPopup = popup => {
    if (!popup) return;
    try {
      popup.document.write('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px;color:#555">Loading ZaloPay...</body>');
    } catch (_) {}
  };

  const openZaloPopup = url => {
    if (backend.popup && !backend.popup.closed) {
      backend.popup.location.href = url;
    } else {
      backend.popup = window.open(url, 'zalopay_payment', 'width=480,height=720');
    }
  };

  const resetBackend = () => {
    stopPolling();
    backend.startedKey = null;
    backend.order = null;
    backend.clientSecret = null;
    if (backend.popup && !backend.popup.closed) backend.popup.close();
    backend.popup = null;
    backend.cardNumberElement?.clear();
    backend.cardExpiryElement?.clear();
    backend.cardCvcElement?.clear();
    showCardError('');
    if (cardPayBtnOriginal) cardPayBtnOriginal.disabled = false;
    if (zalopayNote) zalopayNote.hidden = true;
    if (zalopayOpenBtn) { zalopayOpenBtn.hidden = false; zalopayOpenBtn.disabled = false; }
    if (zalopayReopenBtn) zalopayReopenBtn.hidden = true;
    hideQrSlot(zalopayQrSlot);
    hideQrSlot(vietqrSlot);
    if (bankNote) bankNote.hidden = true;
    if (bankTransferContentNode) bankTransferContentNode.textContent = '—';
  };

  const setupStripeElements = async orderId => {
    if (!backend.stripe) { showCardError(L.stripeNotConfigured()); return; }
    const res = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not start card payment');
    backend.clientSecret = data.clientSecret;

    if (!backend.cardNumberElement) {
      backend.elements = backend.stripe.elements();
      const style = {
        base: { fontSize: '15px', color: '#fff', fontFamily: 'inherit', '::placeholder': { color: 'rgba(255,255,255,.45)' } },
        invalid: { color: '#ff8a80' }
      };
      backend.cardNumberElement = backend.elements.create('cardNumber', { style, showIcon: true });
      backend.cardExpiryElement = backend.elements.create('cardExpiry', { style });
      backend.cardCvcElement = backend.elements.create('cardCvc', { style });
      backend.cardNumberElement.mount('#order-card-number-element');
      backend.cardExpiryElement.mount('#order-card-expiry-element');
      backend.cardCvcElement.mount('#order-card-cvc-element');
      [backend.cardNumberElement, backend.cardExpiryElement, backend.cardCvcElement].forEach(el => {
        el.on('change', event => showCardError(event.error ? event.error.message : ''));
      });
    }
  };

  const startCardFlow = async payload => {
    showCardError('');
    try {
      if (!backend.order) backend.order = { ...(await createOrder('card', payload)), method: 'card' };
      await setupStripeElements(backend.order.orderId);
    } catch (err) {
      showCardError(err.message);
    }
  };

  const onCardPayClick = async () => {
    if (!backend.stripe || !backend.clientSecret || !backend.cardNumberElement) return;
    showCardError('');
    if (cardPayBtnOriginal) cardPayBtnOriginal.disabled = true;
    try {
      const { error, paymentIntent } = await backend.stripe.confirmCardPayment(backend.clientSecret, {
        payment_method: { card: backend.cardNumberElement }
      });
      if (error) throw new Error(error.message);
      if (paymentIntent.status === 'succeeded') {
        const orderId = backend.order?.orderId;
        resetBackend();
        window.HandyPadPaymentUI?.markSuccess('card', { orderId });
        return;
      }
      throw new Error(L.cardGenericError());
    } catch (err) {
      showCardError(err.message);
    } finally {
      if (cardPayBtnOriginal) cardPayBtnOriginal.disabled = false;
    }
  };

  if (cardPayBtnOriginal) {
    const freshCardPayBtn = cardPayBtnOriginal.cloneNode(true);
    cardPayBtnOriginal.parentNode.replaceChild(freshCardPayBtn, cardPayBtnOriginal);
    freshCardPayBtn.addEventListener('click', onCardPayClick);
  }
  const cardPayBtn = root.querySelector('#order-card-pay-btn');

  const startBankFlow = async payload => {
    if (bankNote) { bankNote.hidden = false; bankNote.textContent = L.bankPreparing(); }
    try {
      const data = await createOrder('bank', payload);
      backend.order = { ...data, method: 'bank_transfer' };
      setQrSlot(vietqrSlot, data.qrImageUrl);
      if (bankAccountNameNode) bankAccountNameNode.textContent = data.bankAccountName || '—';
      if (bankAccountNumberNode) bankAccountNumberNode.textContent = data.bankAccount || '—';
      if (bankBankNameNode) bankBankNameNode.textContent = data.bankName || '—';
      if (bankTransferContentNode) bankTransferContentNode.textContent = data.orderId;
      if (bankNote) bankNote.textContent = L.bankWaiting();
      pollOrderStatus(data.orderId, () => {
        const orderId = data.orderId;
        resetBackend();
        window.HandyPadPaymentUI?.markSuccess('bank_transfer', { orderId });
      });
    } catch (err) {
      if (bankNote) { bankNote.hidden = false; bankNote.textContent = err.message; }
    }
  };

  const startZaloFlow = async (payload, triggeredPopup) => {
    if (zalopayNote) { zalopayNote.hidden = false; zalopayNote.textContent = L.zaloPreparing(); }
    if (zalopayOpenBtn) zalopayOpenBtn.disabled = true;
    try {
      const data = await createOrder('zalopay', payload);
      backend.order = { ...data, method: 'zalopay' };
      if (data.payUrl) {
        if (triggeredPopup && !triggeredPopup.closed) {
          triggeredPopup.location.href = data.payUrl;
          backend.popup = triggeredPopup;
        } else {
          openZaloPopup(data.payUrl);
        }
      }
      const popupOpen = Boolean(backend.popup && !backend.popup.closed);
      if (zalopayOpenBtn) { zalopayOpenBtn.hidden = popupOpen; zalopayOpenBtn.disabled = false; }
      if (zalopayReopenBtn) zalopayReopenBtn.hidden = !popupOpen;
      if (zalopayNote) zalopayNote.textContent = L.zaloWaiting();
      pollOrderStatus(data.orderId, () => {
        const orderId = data.orderId;
        if (backend.popup && !backend.popup.closed) backend.popup.close();
        resetBackend();
        window.HandyPadPaymentUI?.markSuccess('zalopay', { orderId });
      });
    } catch (err) {
      if (triggeredPopup && !triggeredPopup.closed) triggeredPopup.close();
      if (zalopayNote) { zalopayNote.hidden = false; zalopayNote.textContent = err.message; }
      if (zalopayOpenBtn) zalopayOpenBtn.disabled = false;
    }
  };

  zalopayOpenBtn?.addEventListener('click', () => {
    if (backend.order?.payUrl) { openZaloPopup(backend.order.payUrl); return; }
    const popup = window.open('', 'zalopay_payment', 'width=480,height=720');
    writeLoadingPopup(popup);
    startZaloFlow(window.HandyPadPaymentUI?.getPayload() || {}, popup);
  });

  zalopayReopenBtn?.addEventListener('click', () => {
    if (backend.order?.payUrl) openZaloPopup(backend.order.payUrl);
  });

  const startedKeyFor = payload => `${payload.paymentType}:${payload.paymentMethod}`;

  root.addEventListener('handypad:payment-option-change', () => {
    resetBackend();
  });

  root.addEventListener('handypad:payment-method-change', event => {
    const payload = event.detail || window.HandyPadPaymentUI?.getPayload();
    if (!payload || !payload.paymentMethod) return;
    const key = startedKeyFor(payload);
    if (backend.startedKey === key) return;

    if (payload.paymentMethod === 'zalopay') {
      const popup = window.open('', 'zalopay_payment', 'width=480,height=720');
      writeLoadingPopup(popup);
      resetBackend();
      backend.startedKey = key;
      startZaloFlow(payload, popup);
    } else {
      resetBackend();
      backend.startedKey = key;
      if (payload.paymentMethod === 'card') startCardFlow(payload);
      else if (payload.paymentMethod === 'bank_transfer') startBankFlow(payload);
    }
  });

  root.addEventListener('handypad:payment-success', () => {
    resetBackend();
  });
})();
