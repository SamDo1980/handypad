/* V64 — Configure & Order logic.
   Keeps the existing configurator/payment flow and adds first-party draft persistence
   for cart, configurator and customer/shipping data. Card credentials are never stored. */
const HANDYPAD_PRODUCTS = Object.freeze({
  single: Object.freeze({
    sku: 'single', sizeKey: 'single', size: 'Single', dimension: '24 × 10 × 5 cm', color: 'Orange',
    basePriceVnd: 550000, basePriceUsd: 21.15,
    addOns: Object.freeze({
      reflective: Object.freeze({priceVnd: 50000, priceUsd: 1.92}),
      fireproof: Object.freeze({priceVnd: 100000, priceUsd: 3.85})
    })
  }),
  double: Object.freeze({
    sku: 'double', sizeKey: 'double', size: 'Double', dimension: '24 × 20 × 5 cm', color: 'Orange',
    basePriceVnd: 1050000, basePriceUsd: 40.38,
    addOns: Object.freeze({
      reflective: Object.freeze({priceVnd: 50000, priceUsd: 2.00}),
      fireproof: Object.freeze({priceVnd: 250000, priceUsd: 9.62})
    })
  }),
  one_metre: Object.freeze({
    sku: 'one_metre', sizeKey: 'one_metre', size: '1 Metre', dimension: '100 × 24 × 5 cm', color: 'Orange',
    basePriceVnd: 4650000, basePriceUsd: 179.00,
    addOns: Object.freeze({
      reflective: Object.freeze({priceVnd: 425000, priceUsd: 16.35}),
      fireproof: Object.freeze({priceVnd: 1250000, priceUsd: 48.08})
    })
  })
});

const HANDYPAD_ADDON_KEYS = Object.freeze(['reflective', 'fireproof']);
const HANDYPAD_ORDER_THUMBNAILS = Object.freeze({
  single: Object.freeze({
    standard: 'assets/order-thumbnails/single-standard.png',
    reflective: 'assets/order-thumbnails/single-reflective.png'
  }),
  double: Object.freeze({
    standard: 'assets/order-thumbnails/double-standard.png',
    reflective: 'assets/order-thumbnails/double-reflective.png'
  }),
  one_metre: Object.freeze({
    standard: 'assets/order-thumbnails/one-metre-standard.png',
    reflective: 'assets/order-thumbnails/one-metre-reflective.png'
  })
});

const HANDYPAD_DEPOSIT_USD = 5;

const HANDYPAD_PAYMENT_METHODS = Object.freeze({
  card: Object.freeze({key: 'card', labelKey: 'paymentCard', brand: 'card'}),
  zalopay: Object.freeze({key: 'zalopay', labelKey: 'paymentZaloPay', brand: 'zalopay'}),
  bank_transfer: Object.freeze({key: 'bank_transfer', labelKey: 'paymentBankTransfer', brand: 'vietqr'})
});


const HANDYPAD_DRAFT_STORAGE = Object.freeze({
  version: 1,
  localKey: 'handypad-order-draft-v1',
  sessionKey: 'handypad-order-session-v1',
  cookieName: 'handypad_order_draft',
  maxAgeSeconds: 60 * 60 * 24 * 30
});

(() => {
  const root = document.getElementById('configure-order');
  if (!root) return;

  const cart = new Map();
  const state = {
    size: null,
    addOns: {reflective: false, fireproof: false},
    quantity: 1,
    modifyMode: false,
    paymentType: null,
    paymentMethod: null,
    paymentStatus: 'pending',
    contactConfirmed: false,
    language: document.documentElement.lang === 'vi' ? 'vi' : 'en'
  };

  const translations = {
    en: {
      heading: 'CONFIGURE & ORDER', step1: 'Choose size', step2: 'Add-ons', step3: 'Quantity', step4: 'Contact & shipping',
      fullName: 'Full Name', company: 'Company', email: 'Email', phone: 'Phone / WhatsApp', address: 'Shipping Address', city: 'City', country: 'Country', fullNameError: 'Please enter first and last name (at least 2 words).', emailError: 'Enter a valid email address.', phoneError: 'Enter a valid phone / WhatsApp number.', addressError: 'Enter a valid shipping address.', cityError: 'Enter a valid city name.', countryError: 'Enter a valid country name.',
      add: 'ADD TO CART', summaryTitle: 'ORDER SUMMARY', empty: 'Your selected items will appear here.', estimatedTotal: 'ESTIMATED TOTAL',
      modify: 'Modify', done: 'Done', unitPrice: 'Unit Price', quantity: 'Quantity', subtotal: 'Item Subtotal',
      standard: 'Standard', reflective: 'Reflective tape', fireproof: 'Fireproof canvas', single: 'Single', double: 'Double', oneMetre: '1 Metre', noAddOns: 'No add-ons', added: 'added to cart.', removed: 'Item removed from cart.',
      decrease: 'Decrease quantity', increase: 'Increase quantity', remove: 'Remove item',
      payment: 'Payment', paymentChoiceTitle: 'Choose payment option', paymentChoiceHint: 'Choose how much you want to pay now.', payFull: 'Pay in full', payFullCopy: 'Pay the full order total now.', payDeposit: 'Pay deposit', payDepositCopy: 'Pay a fixed $5.00 deposit now.', salesContactBeforeDelivery: 'Our sales team will contact you before delivery.', paymentMethodTitle: 'Payment method', paymentMethodHint: 'Card, ZaloPay or Bank Transfer.', paymentOptionNotSelected: 'Payment option', amountDueNow: 'Amount due now', fullPaymentDueNow: 'Full payment due now', depositDueNow: 'Deposit due now', remainingBalance: 'Remaining balance', notSelected: 'Not selected',
      paymentCard: 'Card', paymentZaloPay: 'ZaloPay', paymentBankTransfer: 'Bank Transfer',
      cardNumber: 'Card number', cardExpiry: 'Expiry', cardCvv: 'CVV/CVC', cardNumberError: 'Enter a valid Visa or Mastercard number.', cardExpiryError: 'Enter a valid future expiry date.', cardCvvError: 'Enter a valid 3–4 digit CVV/CVC.', payButton: 'PAY', paymentSuccessTitle: 'PAYMENT SUCCESSFUL', paymentSuccessClose: 'CLOSE', paymentProcessingTitle: 'PAYMENT PROCESSING', paymentProcessingCopy: 'We are verifying your payment. This may take a moment.', amountReceived: 'Amount received', confirmedMethod: 'Payment method', orderId: 'Order ID',
      paymentSuccessFull: 'Your payment of {amount} has been confirmed and your order has been submitted successfully.', paymentSuccessDeposit: 'Your $5.00 deposit has been confirmed and your order has been submitted successfully.',
      cardDialogTitle: 'Card payment', zaloDialogTitle: 'Pay with ZaloPay', bankDialogTitle: 'Bank Transfer (VietQR)',
      zaloStep1Title: 'Open ZaloPay', zaloStep1Copy: 'Open the ZaloPay app on your phone.', zaloStep2Title: 'Open QR scanner', zaloStep2Copy: 'Choose the QR scan function in ZaloPay.', zaloStep3Title: 'Scan and confirm', zaloStep3Copy: 'Scan the QR provided by the payment system and confirm the payment in the app.',
      accountName: 'Account name', accountNumber: 'Account number', bankName: 'Bank', transferMethod: 'Transfer method', transferContent: 'Transfer content',
      zaloOpenButton: 'OPEN ZALOPAY', zaloReopenButton: 'REOPEN PAYMENT WINDOW', zaloWaitingNote: 'Waiting for confirmation from ZaloPay...', zaloPreparing: 'Preparing your ZaloPay payment...',
      bankPreparing: 'Generating your payment QR code...', bankWaitingNote: 'Waiting for your transfer — this updates automatically once it is received.',
      secureCardNote: 'Payments are processed securely by Stripe — your card details are sent directly to Stripe and never touch our servers.', cardGenericError: 'Something went wrong, please try again.',
      finalDetailsNote: '*Our sales team will contact you before delivery to confirm the order details.',
      continueToPayment: 'CONTINUE TO PAYMENT'
    },
    vi: {
      heading: 'CẤU HÌNH & ĐẶT HÀNG', step1: 'Chọn kích thước', step2: 'Phụ kiện bổ sung', step3: 'Số lượng', step4: 'Thông tin liên hệ & giao hàng',
      fullName: 'Họ và tên', company: 'Công ty', email: 'Email', phone: 'Điện thoại / WhatsApp', address: 'Địa chỉ giao hàng', city: 'Thành phố', country: 'Quốc gia', fullNameError: 'Vui lòng nhập họ và tên gồm ít nhất 2 từ.', emailError: 'Vui lòng nhập địa chỉ email hợp lệ.', phoneError: 'Vui lòng nhập số điện thoại / WhatsApp hợp lệ.', addressError: 'Vui lòng nhập địa chỉ giao hàng hợp lệ.', cityError: 'Vui lòng nhập tên thành phố hợp lệ.', countryError: 'Vui lòng nhập tên quốc gia hợp lệ.',
      add: 'THÊM VÀO GIỎ', summaryTitle: 'TÓM TẮT ĐƠN HÀNG', empty: 'Các sản phẩm đã chọn sẽ hiển thị tại đây.', estimatedTotal: 'TỔNG TẠM TÍNH',
      modify: 'Chỉnh sửa', done: 'Xong', unitPrice: 'Đơn giá', quantity: 'Số lượng', subtotal: 'Thành tiền',
      standard: 'Tiêu chuẩn', reflective: 'Băng phản quang', fireproof: 'Vải bạt chống cháy', single: 'Single', double: 'Double', oneMetre: '1 Mét', noAddOns: 'Không chọn phụ kiện', added: 'đã được thêm vào giỏ.', removed: 'Đã xóa sản phẩm khỏi giỏ.',
      decrease: 'Giảm số lượng', increase: 'Tăng số lượng', remove: 'Xóa sản phẩm',
      payment: 'Thanh toán', paymentChoiceTitle: 'Chọn hình thức thanh toán', paymentChoiceHint: 'Chọn số tiền bạn muốn thanh toán ngay.', payFull: 'Thanh toán toàn bộ', payFullCopy: 'Thanh toán toàn bộ giá trị đơn hàng ngay bây giờ.', payDeposit: 'Đặt cọc', payDepositCopy: 'Thanh toán khoản đặt cọc cố định $5.00 ngay bây giờ.', salesContactBeforeDelivery: 'Đội ngũ sales của chúng tôi sẽ liên hệ với bạn trước khi giao hàng.', paymentMethodTitle: 'Phương thức thanh toán', paymentMethodHint: 'Thẻ, ZaloPay hoặc chuyển khoản ngân hàng.', paymentOptionNotSelected: 'Hình thức thanh toán', amountDueNow: 'Số tiền thanh toán ngay', fullPaymentDueNow: 'Thanh toán toàn bộ ngay', depositDueNow: 'Đặt cọc thanh toán ngay', remainingBalance: 'Số dư còn lại', notSelected: 'Chưa chọn',
      paymentCard: 'Thẻ', paymentZaloPay: 'ZaloPay', paymentBankTransfer: 'Chuyển khoản ngân hàng',
      cardNumber: 'Số thẻ', cardExpiry: 'Tháng/Năm hết hạn', cardCvv: 'CVV/CVC', cardNumberError: 'Số thẻ Visa hoặc Mastercard không đúng định dạng.', cardExpiryError: 'Ngày hết hạn không hợp lệ hoặc đã hết hạn.', cardCvvError: 'Mã CVV/CVC phải gồm 3–4 chữ số.', payButton: 'THANH TOÁN', paymentSuccessTitle: 'THANH TOÁN THÀNH CÔNG', paymentSuccessClose: 'ĐÓNG', paymentProcessingTitle: 'ĐANG XỬ LÝ THANH TOÁN', paymentProcessingCopy: 'Hệ thống đang xác nhận thanh toán của bạn. Quá trình này có thể mất một chút thời gian.', amountReceived: 'Số tiền đã nhận', confirmedMethod: 'Phương thức thanh toán', orderId: 'Mã đơn hàng',
      paymentSuccessFull: 'Khoản thanh toán {amount} đã được xác nhận và đơn hàng đã được gửi thành công.', paymentSuccessDeposit: 'Khoản đặt cọc $5.00 đã được xác nhận và đơn hàng đã được gửi thành công.',
      cardDialogTitle: 'Thanh toán bằng thẻ', zaloDialogTitle: 'Thanh toán bằng ZaloPay', bankDialogTitle: 'Chuyển khoản ngân hàng (VietQR)',
      zaloStep1Title: 'Mở ZaloPay', zaloStep1Copy: 'Mở ứng dụng ZaloPay trên điện thoại.', zaloStep2Title: 'Mở trình quét QR', zaloStep2Copy: 'Chọn chức năng quét mã QR trong ZaloPay.', zaloStep3Title: 'Quét và xác nhận', zaloStep3Copy: 'Quét mã QR do hệ thống thanh toán cung cấp và xác nhận thanh toán trong ứng dụng.',
      accountName: 'Tên tài khoản', accountNumber: 'Số tài khoản', bankName: 'Ngân hàng', transferMethod: 'Phương thức', transferContent: 'Nội dung chuyển khoản',
      zaloOpenButton: 'MỞ ZALOPAY', zaloReopenButton: 'MỞ LẠI CỬA SỔ THANH TOÁN', zaloWaitingNote: 'Đang chờ xác nhận từ ZaloPay...', zaloPreparing: 'Đang chuẩn bị thanh toán ZaloPay...',
      bankPreparing: 'Đang tạo mã QR thanh toán...', bankWaitingNote: 'Đang chờ chuyển khoản — trang sẽ tự cập nhật khi hệ thống nhận được tiền.',
      secureCardNote: 'Thanh toán được xử lý bảo mật bởi Stripe — thông tin thẻ đi thẳng tới Stripe, không đi qua máy chủ của chúng tôi.', cardGenericError: 'Có lỗi xảy ra, vui lòng thử lại.',
      finalDetailsNote: '*Đội ngũ sales sẽ liên hệ với bạn trước khi giao hàng để xác nhận chi tiết đơn hàng.',
      continueToPayment: 'TIẾP TỤC THANH TOÁN'
    }
  };

  const sizeGrid = root.querySelector('#order-size-grid');
  const addonGrid = root.querySelector('#order-addon-grid');
  const qtyValue = root.querySelector('#order-qty-value');
  const qtyMinus = root.querySelector('#order-qty-minus');
  const qtyPlus = root.querySelector('#order-qty-plus');
  const currentVariantNode = root.querySelector('#order-current-variant');
  const addButton = root.querySelector('#order-add-cart');
  const summary = root.querySelector('#order-summary');
  const summaryEmpty = root.querySelector('#order-summary-empty');
  const cartList = root.querySelector('#order-cart-list');
  const totalNode = root.querySelector('#order-estimated-total');
  const depositWrap = root.querySelector('#order-summary-deposit');
  const dueLabelNode = root.querySelector('#order-due-label');
  const depositDueNode = root.querySelector('#order-deposit-due');
  const remainingBalanceNode = root.querySelector('#order-remaining-balance-display');
  const modifyButton = root.querySelector('#order-modify');
  const toast = root.querySelector('#order-toast');
  const paymentBlock = root.querySelector('#order-payment-block');
  const paymentChoiceGrid = root.querySelector('#order-payment-choice-grid');
  const paymentMethodBlock = root.querySelector('#order-payment-method-block');
  const paymentGrid = root.querySelector('#order-payment-grid');
  const paymentTypeInput = root.querySelector('#order-payment-type');
  const paymentInput = root.querySelector('#order-payment-method');
  const paymentAmountInput = root.querySelector('#order-payment-amount');
  const paymentCurrencyInput = root.querySelector('#order-payment-currency');
  const orderTotalVndInput = root.querySelector('#order-order-total-vnd');
  const orderTotalUsdInput = root.querySelector('#order-order-total-usd');
  const remainingBalanceInput = root.querySelector('#order-remaining-balance');
  const remainingCurrencyInput = root.querySelector('#order-remaining-currency');
  const paymentStatusInput = root.querySelector('#order-payment-status');
  const paymentModal = root.querySelector('#order-payment-modal');
  const paymentDialog = root.querySelector('.order-payment-dialog');
  const paymentDialogTitle = root.querySelector('#order-payment-dialog-title');
  const paymentClose = root.querySelector('#order-payment-close');
  const paymentPanels = [...root.querySelectorAll('[data-payment-panel]')];
  const continuePaymentButton = root.querySelector('#order-continue-payment');
  const paymentStateScreen = root.querySelector('#order-payment-state-screen');
  const paymentStateCard = root.querySelector('#order-payment-state-card');
  const paymentStateClose = root.querySelector('#order-payment-state-close');
  const paymentStateTitle = root.querySelector('#order-payment-state-title');
  const paymentStateCopy = root.querySelector('#order-payment-state-copy');
  const paymentStateDetails = root.querySelector('#order-payment-state-details');
  const paymentStateOrderIdRow = root.querySelector('#order-payment-state-order-id-row');
  const paymentStateOrderId = root.querySelector('#order-payment-state-order-id');
  const paymentStateAmount = root.querySelector('#order-payment-state-amount');
  const paymentStateMethod = root.querySelector('#order-payment-state-method');
  const paymentStateRemaining = root.querySelector('#order-payment-state-remaining');
  const paymentStateSales = root.querySelector('#order-payment-state-sales');
  const paymentDueLabels = [...root.querySelectorAll('.order-payment-due-label')];
  const paymentDueAmounts = [...root.querySelectorAll('.order-payment-due-amount')];
  const cardNumberField = root.querySelector('#order-card-number');
  const cardExpiryField = root.querySelector('#order-card-expiry');
  const cardCvvField = root.querySelector('#order-card-cvv');
  const contactTouched = new Set();
  const requiredContactFields = [
    root.querySelector('#order-full-name'),
    root.querySelector('#order-email'),
    root.querySelector('#order-phone'),
    root.querySelector('#order-address'),
    root.querySelector('#order-city'),
    root.querySelector('#order-country')
  ].filter(Boolean);

  const contactValidation = new Map([
    ['order-full-name', { error: root.querySelector('#order-full-name-error'), test: value => value.length >= 3 && /^[\p{L}\p{M}.'’\-]+(?:\s+[\p{L}\p{M}.'’\-]+)+$/u.test(value) }],
    ['order-email', { error: root.querySelector('#order-email-error'), test: value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value) }],
    ['order-phone', { error: root.querySelector('#order-phone-error'), test: value => {
      if (!/^[+()\d\s.-]+$/.test(value)) return false;
      const digits = value.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    }}],
    ['order-address', { error: root.querySelector('#order-address-error'), test: value => value.length >= 5 && /[\p{L}\p{N}]/u.test(value) }],
    ['order-city', { error: root.querySelector('#order-city-error'), test: value => value.length >= 3 && /^[\p{L}\p{M}\s.'’\-]+$/u.test(value) }],
    ['order-country', { error: root.querySelector('#order-country-error'), test: value => value.length >= 2 && /^[\p{L}\p{M}\s.'’\-]+$/u.test(value) }]
  ]);
  const steps = [1, 2, 3, 4].map(n => root.querySelector(`#order-step-${n}`));
  let toastTimer = 0;
  const orderTotals = {vnd: 0, usd: 0};
  let persistenceTimer = 0;
  let persistenceReady = false;
  let restoringDraft = false;
  let orderCompleted = false;
  // Only carts explicitly created by an ADD TO CART action may be restored.
  // This prevents legacy/demo drafts from pre-populating a fresh cart.
  let cartWasAddedByUser = false;
  let paymentConfirmationData = {};
  let paymentReceiptSnapshot = null;

  const t = () => translations[state.language];
  const money = value => state.language === 'vi'
    ? `${Number(value).toLocaleString('vi-VN')} ₫`
    : `$${Number(value).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  const moneyUsd = value => `$${Number(value).toFixed(2)}`;
  const formatCurrencyAmount = (amount, currency) => currency === 'VND'
    ? `${Math.round(Number(amount) || 0).toLocaleString('vi-VN')} ₫`
    : moneyUsd(amount);
  const normalizeQty = value => Math.max(1, Math.min(9999, Number.parseInt(value, 10) || 1));
  const sanitizeQuantityText = value => String(value ?? '').replace(/\D/g, '').slice(0, 4);

  const currentPaymentPlan = () => {
    if (!state.paymentType || !cart.size) return null;
    if (state.paymentType === 'deposit') {
      return {
        type: 'deposit',
        amount: HANDYPAD_DEPOSIT_USD,
        currency: 'USD',
        remainingAmount: Math.max(0, orderTotals.usd - HANDYPAD_DEPOSIT_USD),
        remainingCurrency: 'USD'
      };
    }
    if (state.paymentType === 'full') {
      const currency = state.language === 'vi' ? 'VND' : 'USD';
      const amount = currency === 'VND' ? orderTotals.vnd : orderTotals.usd;
      return {type: 'full', amount, currency, remainingAmount: 0, remainingCurrency: currency};
    }
    return null;
  };
  const sizeKeys = () => Object.keys(HANDYPAD_PRODUCTS);
  const productForSize = sizeKey => HANDYPAD_PRODUCTS[sizeKey] || null;
  const selectedAddOnKeys = () => HANDYPAD_ADDON_KEYS.filter(key => Boolean(state.addOns[key]));
  const localizedSize = sizeKey => sizeKey === 'single' ? t().single : sizeKey === 'double' ? t().double : t().oneMetre;
  const localizedAddOn = key => key === 'reflective' ? t().reflective : t().fireproof;
  const productTitle = sizeKey => `HANDYPAD ${t().standard} ${localizedSize(sizeKey)}`;
  const priceForLanguage = configuration => state.language === 'vi' ? configuration.priceVnd : configuration.priceUsd;
  const variantUsdPrice = configuration => configuration.priceUsd;
  const addOnPriceForLanguage = (product, key) => state.language === 'vi' ? product.addOns[key].priceVnd : product.addOns[key].priceUsd;

  const configurationFromSelection = (sizeKey, rawAddOnKeys = []) => {
    const product = productForSize(sizeKey);
    if (!product) return null;
    const addOnKeys = HANDYPAD_ADDON_KEYS.filter(key => rawAddOnKeys.includes(key));
    const priceVnd = product.basePriceVnd + addOnKeys.reduce((sum, key) => sum + product.addOns[key].priceVnd, 0);
    const priceUsd = product.basePriceUsd + addOnKeys.reduce((sum, key) => sum + product.addOns[key].priceUsd, 0);
    const sku = `${product.sku}__${addOnKeys.length ? addOnKeys.join('_') : 'standard'}`;
    return Object.freeze({
      sku,
      sizeKey: product.sizeKey,
      dimension: product.dimension,
      color: product.color,
      addonKeys: Object.freeze([...addOnKeys]),
      priceVnd,
      priceUsd
    });
  };

  const currentConfiguration = () => configurationFromSelection(state.size, selectedAddOnKeys());

  const thumbnailForConfiguration = configuration => {
    const sizeThumbs = HANDYPAD_ORDER_THUMBNAILS[configuration.sizeKey];
    if (!sizeThumbs) return '';
    return configuration.addonKeys.includes('reflective') ? sizeThumbs.reflective : sizeThumbs.standard;
  };

  const configurationMeta = configuration => {
    const addOnText = configuration.addonKeys.length
      ? configuration.addonKeys.map(localizedAddOn).join(' + ')
      : t().noAddOns;
    return `${configuration.dimension} · ${addOnText}`;
  };

  const setStep = (index, {locked = false, complete = false} = {}) => {
    const step = steps[index - 1];
    if (!step) return;
    step.classList.toggle('is-locked', locked);
    step.classList.toggle('is-complete', complete);
    step.setAttribute('aria-disabled', locked ? 'true' : 'false');
  };

  const paymentCardFields = [cardNumberField, cardExpiryField, cardCvvField].filter(Boolean);
  const paymentCardTouched = new Set();
  const cardErrorMap = new Map([
    ['order-card-number', root.querySelector('#order-card-number-error')],
    ['order-card-expiry', root.querySelector('#order-card-expiry-error')],
    ['order-card-cvv', root.querySelector('#order-card-cvv-error')]
  ]);

  const luhnValid = digits => {
    let sum = 0;
    let doubleDigit = false;
    for (let i = digits.length - 1; i >= 0; i -= 1) {
      let digit = Number(digits[i]);
      if (doubleDigit) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      doubleDigit = !doubleDigit;
    }
    return sum % 10 === 0;
  };

  const isVisaOrMastercard = digits => {
    const visa = /^4\d{12}(?:\d{3})?(?:\d{3})?$/.test(digits);
    const mastercardClassic = /^5[1-5]\d{14}$/.test(digits);
    const firstFour = Number(digits.slice(0, 4));
    const mastercard2Series = digits.length === 16 && firstFour >= 2221 && firstFour <= 2720;
    return visa || mastercardClassic || mastercard2Series;
  };

  const cardFieldValid = field => {
    const value = field.value.trim();
    if (field === cardNumberField) {
      const digits = value.replace(/\D/g, '');
      return digits.length >= 13 && digits.length <= 19 && isVisaOrMastercard(digits) && luhnValid(digits);
    }
    if (field === cardExpiryField) {
      const match = value.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
      if (!match) return false;
      const month = Number(match[1]);
      const year = 2000 + Number(match[2]);
      const now = new Date();
      return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
    }
    if (field === cardCvvField) return /^\d{3,4}$/.test(value);
    return false;
  };

  const validateCardField = (field, showError = paymentCardTouched.has(field.id)) => {
    const valid = cardFieldValid(field);
    const error = cardErrorMap.get(field.id);
    field.classList.toggle('is-invalid', Boolean(showError && !valid));
    field.setAttribute('aria-invalid', valid ? 'false' : 'true');
    if (error) error.hidden = !(showError && !valid);
    return valid;
  };

  const resetCardForm = () => {
    paymentCardFields.forEach(field => {
      field.value = '';
      field.classList.remove('is-invalid');
      field.setAttribute('aria-invalid', 'false');
      const error = cardErrorMap.get(field.id);
      if (error) error.hidden = true;
    });
    paymentCardTouched.clear();
  };

  const validateContactField = (field, showError = contactTouched.has(field.id)) => {
    const config = contactValidation.get(field.id);
    if (!config) return field.checkValidity();

    const value = field.value.trim();

    // Clear any previous custom error before evaluating the field again.
    // Otherwise field.validity/checkValidity can stay false after an earlier invalid entry.
    field.setCustomValidity('');
    const nativeValid = field.checkValidity();
    const valid = Boolean(value) && nativeValid && config.test(value, field);

    field.setCustomValidity(valid ? '' : 'invalid');
    field.setAttribute('aria-invalid', valid ? 'false' : 'true');

    const shouldShowError = Boolean(showError && !valid);
    field.classList.toggle('is-invalid', shouldShowError);
    if (config.error) config.error.hidden = !shouldShowError;
    return valid;
  };

  const contactIsReady = () => {
    if (requiredContactFields.length !== 6) return false;
    return requiredContactFields.every(field => validateContactField(field, contactTouched.has(field.id)));
  };

  const syncProgress = () => {
    const hasSize = Boolean(state.size && productForSize(state.size));
    const hasCart = cart.size > 0;
    const contactReady = hasCart && contactIsReady();
    const paymentReady = Boolean(contactReady && state.contactConfirmed);

    setStep(1, {complete: hasSize});
    setStep(2, {locked: !hasSize, complete: hasSize});
    setStep(3, {locked: !hasSize, complete: hasCart});
    setStep(4, {locked: !hasCart, complete: paymentReady});

    paymentBlock?.classList.toggle('is-locked', !paymentReady);
    paymentBlock?.classList.toggle('is-complete', state.paymentStatus === 'paid');
    paymentBlock?.setAttribute('aria-disabled', paymentReady ? 'false' : 'true');
    paymentChoiceGrid?.querySelectorAll('[data-order-payment-type]').forEach(button => { button.disabled = !paymentReady; });
    const paymentMethodLocked = !paymentReady || !state.paymentType;
    paymentMethodBlock?.classList.toggle('is-locked', paymentMethodLocked);
    paymentMethodBlock?.setAttribute('aria-disabled', paymentMethodLocked ? 'true' : 'false');
    paymentGrid?.querySelectorAll('[data-order-payment]').forEach(button => { button.disabled = paymentMethodLocked; });
    if (continuePaymentButton) continuePaymentButton.disabled = !hasCart;
    addButton.disabled = !hasSize;
  };

  const renderSizes = () => {
    sizeGrid.innerHTML = '';
    sizeKeys().forEach(sizeKey => {
      const product = productForSize(sizeKey);
      if (!product) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'order-choice-card';
      button.dataset.orderSize = sizeKey;
      const active = state.size === sizeKey;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      const basePrice = state.language === 'vi' ? product.basePriceVnd : product.basePriceUsd;
      button.innerHTML = `
        <span class="order-choice-name">${localizedSize(sizeKey)}</span>
        <span class="order-choice-meta">${product.dimension}</span>
        <span class="order-choice-price">${money(basePrice)}</span>`;
      sizeGrid.appendChild(button);
    });
  };

  const renderAddOns = () => {
    addonGrid.innerHTML = '';
    const product = productForSize(state.size);
    HANDYPAD_ADDON_KEYS.forEach(addOnKey => {
      const active = Boolean(state.addOns[addOnKey]);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'order-addon-card';
      button.dataset.orderAddon = addOnKey;
      button.setAttribute('role', 'switch');
      button.setAttribute('aria-checked', active ? 'true' : 'false');
      button.disabled = !product;
      button.classList.toggle('is-active', active);
      const price = product ? addOnPriceForLanguage(product, addOnKey) : 0;
      button.innerHTML = `
        <span class="order-addon-copy">
          <span class="order-choice-name">${localizedAddOn(addOnKey)}</span>
          <span class="order-choice-price">+${money(price)}</span>
        </span>
        <span class="order-addon-switch" aria-hidden="true"><span class="order-addon-switch-knob"></span></span>`;
      addonGrid.appendChild(button);
    });
  };

  const renderCurrentVariant = () => {
    const configuration = currentConfiguration();
    qtyValue.value = String(state.quantity);
    qtyValue.setAttribute('aria-label', t().quantity);
    qtyMinus.setAttribute('aria-label', t().decrease);
    qtyPlus.setAttribute('aria-label', t().increase);
    if (!configuration) {
      currentVariantNode.innerHTML = '';
      return;
    }
    currentVariantNode.innerHTML = `<strong>${productTitle(configuration.sizeKey)}</strong><span>${configurationMeta(configuration)} · ${money(priceForLanguage(configuration))}</span>`;
  };

  const draftFieldMap = Object.freeze({
    fullName: '#order-full-name',
    company: '#order-company',
    email: '#order-email',
    phone: '#order-phone',
    address: '#order-address',
    city: '#order-city',
    country: '#order-country'
  });

  const draftFieldNodes = Object.fromEntries(
    Object.entries(draftFieldMap).map(([key, selector]) => [key, root.querySelector(selector)])
  );

  const safeStorageGet = (storage, key) => {
    try { return storage?.getItem(key) || ''; } catch (_) { return ''; }
  };

  const safeStorageSet = (storage, key, value) => {
    try { storage?.setItem(key, value); return true; } catch (_) { return false; }
  };

  const safeStorageRemove = (storage, key) => {
    try { storage?.removeItem(key); } catch (_) {}
  };

  const setDraftCookie = enabled => {
    try {
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      if (!enabled) {
        document.cookie = `${HANDYPAD_DRAFT_STORAGE.cookieName}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
        return;
      }
      document.cookie = `${HANDYPAD_DRAFT_STORAGE.cookieName}=1; Max-Age=${HANDYPAD_DRAFT_STORAGE.maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
    } catch (_) {}
  };

  const buildDraftSnapshot = () => ({
    version: HANDYPAD_DRAFT_STORAGE.version,
    savedAt: Date.now(),
    configurator: {
      size: state.size,
      addOns: {...state.addOns},
      quantity: state.quantity
    },
    cartUserAdded: cartWasAddedByUser,
    cart: [...cart.values()].map(item => ({
      sizeKey: item.variant.sizeKey,
      addOnKeys: [...item.variant.addonKeys],
      quantity: item.quantity
    })),
    customer: Object.fromEntries(
      Object.entries(draftFieldNodes).map(([key, field]) => [key, field?.value || ''])
    ),
    payment: {
      type: state.paymentType,
      method: state.paymentMethod,
      contactConfirmed: state.contactConfirmed
    }
  });

  const saveDraft = () => {
    if (!persistenceReady || restoringDraft || orderCompleted) return;
    const snapshot = buildDraftSnapshot();
    const serialized = JSON.stringify(snapshot);
    safeStorageSet(window.localStorage, HANDYPAD_DRAFT_STORAGE.localKey, serialized);
    safeStorageSet(window.sessionStorage, HANDYPAD_DRAFT_STORAGE.sessionKey, serialized);
    setDraftCookie(true);
  };

  const scheduleDraftSave = () => {
    if (!persistenceReady || restoringDraft || orderCompleted) return;
    window.clearTimeout(persistenceTimer);
    persistenceTimer = window.setTimeout(saveDraft, 140);
  };

  const clearDraft = () => {
    window.clearTimeout(persistenceTimer);
    safeStorageRemove(window.localStorage, HANDYPAD_DRAFT_STORAGE.localKey);
    safeStorageRemove(window.sessionStorage, HANDYPAD_DRAFT_STORAGE.sessionKey);
    setDraftCookie(false);
  };

  // Clear the completed order from the live page without touching the success receipt.
  // This prevents Back/bfcache navigation from reopening a paid order with the old cart
  // and customer data. Browser-native autocomplete can still suggest customer details.
  const clearCompletedOrderData = () => {
    cart.clear();
    cartWasAddedByUser = false;
    state.modifyMode = false;
    state.size = null;
    HANDYPAD_ADDON_KEYS.forEach(key => { state.addOns[key] = false; });
    state.quantity = 1;
    state.contactConfirmed = false;
    contactTouched.clear();

    Object.values(draftFieldNodes).forEach(field => {
      if (!field) return;
      field.value = '';
      field.setCustomValidity('');
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
    });
    contactValidation.forEach(({error}) => {
      if (error) error.hidden = true;
    });
    resetCardForm();
  };

  const parseDraft = raw => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.version === HANDYPAD_DRAFT_STORAGE.version ? parsed : null;
    } catch (_) {
      return null;
    }
  };

  const readLatestDraft = () => {
    const candidates = [
      parseDraft(safeStorageGet(window.localStorage, HANDYPAD_DRAFT_STORAGE.localKey)),
      parseDraft(safeStorageGet(window.sessionStorage, HANDYPAD_DRAFT_STORAGE.sessionKey))
    ].filter(Boolean);
    if (!candidates.length) return null;
    return candidates.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
  };

  const restoreDraft = () => {
    const draft = readLatestDraft();
    if (!draft) return false;
    restoringDraft = true;

    const config = draft.configurator || {};
    state.size = productForSize(config.size) ? config.size : null;
    HANDYPAD_ADDON_KEYS.forEach(key => {
      state.addOns[key] = Boolean(state.size && config.addOns?.[key]);
    });
    state.quantity = normalizeQty(config.quantity || 1);

    cart.clear();
    cartWasAddedByUser = draft.cartUserAdded === true;
    if (cartWasAddedByUser && Array.isArray(draft.cart)) {
      draft.cart.forEach(item => {
        const variant = configurationFromSelection(item?.sizeKey, Array.isArray(item?.addOnKeys) ? item.addOnKeys : []);
        if (!variant) return;
        const quantity = normalizeQty(item?.quantity || 1);
        const existing = cart.get(variant.sku);
        cart.set(variant.sku, {variant, quantity: existing ? existing.quantity + quantity : quantity});
      });
    }

    const customer = draft.customer || {};
    Object.entries(draftFieldNodes).forEach(([key, field]) => {
      if (field) field.value = typeof customer[key] === 'string' ? customer[key] : '';
    });

    const payment = draft.payment || {};
    state.paymentType = ['full', 'deposit'].includes(payment.type) ? payment.type : null;
    state.paymentMethod = HANDYPAD_PAYMENT_METHODS[payment.method] ? payment.method : null;
    state.paymentStatus = 'pending';
    state.contactConfirmed = Boolean(payment.contactConfirmed && cart.size && contactIsReady());
    if (!state.contactConfirmed) state.paymentMethod = null;

    restoringDraft = false;
    return true;
  };

  /* Functional draft storage contract for future backend/IT integration.
     Customer/shipping and cart data are persisted; card number/expiry/CVV are never stored. */
  window.HandyPadDraftStorage = Object.freeze({
    save: () => saveDraft(),
    clear: () => clearDraft(),
    getSnapshot: () => buildDraftSnapshot()
  });

  const paymentBrandMarkup = method => {
    if (method.brand !== 'card') return '';
    return '<span class="order-payment-brand-row"><img class="order-payment-brand-logo" src="assets/payment-visa.png" alt="Visa"><img class="order-payment-brand-logo order-payment-brand-logo--mastercard" src="assets/payment-mastercard.png" alt="Mastercard"></span>';
  };

  const syncPaymentContractFields = () => {
    const plan = currentPaymentPlan();
    if (paymentTypeInput) paymentTypeInput.value = state.paymentType || '';
    if (paymentInput) paymentInput.value = state.paymentMethod || '';
    if (paymentStatusInput) paymentStatusInput.value = state.paymentStatus || 'pending';
    if (orderTotalVndInput) orderTotalVndInput.value = String(Math.round(orderTotals.vnd));
    if (orderTotalUsdInput) orderTotalUsdInput.value = Number(orderTotals.usd).toFixed(2);
    if (paymentAmountInput) paymentAmountInput.value = plan ? String(plan.amount) : '';
    if (paymentCurrencyInput) paymentCurrencyInput.value = plan?.currency || '';
    if (remainingBalanceInput) remainingBalanceInput.value = plan ? String(plan.remainingAmount) : '';
    if (remainingCurrencyInput) remainingCurrencyInput.value = plan?.remainingCurrency || '';
  };

  const updatePaymentPresentation = () => {
    const plan = currentPaymentPlan();
    if (!plan) {
      if (dueLabelNode) dueLabelNode.textContent = t().paymentOptionNotSelected;
      if (depositDueNode) depositDueNode.textContent = t().notSelected;
      if (remainingBalanceNode) remainingBalanceNode.textContent = '—';
      paymentDueLabels.forEach(node => { node.textContent = t().amountDueNow; });
      paymentDueAmounts.forEach(node => { node.textContent = '—'; });
      syncPaymentContractFields();
      return;
    }

    const dueLabel = plan.type === 'deposit' ? t().depositDueNow : t().fullPaymentDueNow;
    const dueAmount = formatCurrencyAmount(plan.amount, plan.currency);
    const remaining = formatCurrencyAmount(plan.remainingAmount, plan.remainingCurrency);
    if (dueLabelNode) dueLabelNode.textContent = dueLabel;
    if (depositDueNode) depositDueNode.textContent = dueAmount;
    if (remainingBalanceNode) remainingBalanceNode.textContent = remaining;
    paymentDueLabels.forEach(node => { node.textContent = dueLabel; });
    paymentDueAmounts.forEach(node => { node.textContent = dueAmount; });
    syncPaymentContractFields();
  };

  const paymentCanInteract = () => Boolean(cart.size && state.contactConfirmed && contactIsReady());

  const renderPaymentChoices = () => {
    if (!paymentChoiceGrid) return;
    paymentChoiceGrid.innerHTML = '';
    const ready = paymentCanInteract();
    const fullAmount = state.language === 'vi'
      ? formatCurrencyAmount(orderTotals.vnd, 'VND')
      : formatCurrencyAmount(orderTotals.usd, 'USD');
    const choices = [
      {key: 'full', label: t().payFull, copy: t().payFullCopy, amount: fullAmount},
      {key: 'deposit', label: t().payDeposit, copy: t().payDepositCopy, amount: moneyUsd(HANDYPAD_DEPOSIT_USD)}
    ];

    choices.forEach(choice => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'order-payment-choice';
      button.dataset.orderPaymentType = choice.key;
      const active = state.paymentType === choice.key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.disabled = !ready;
      button.innerHTML = `
        <span class="order-payment-choice-copy"><strong>${choice.label}</strong><span>${choice.copy}</span></span>
        <b class="order-payment-choice-amount">${choice.amount}</b>`;
      paymentChoiceGrid.appendChild(button);
    });

    const methodLocked = !ready || !state.paymentType;
    paymentMethodBlock?.classList.toggle('is-locked', methodLocked);
    paymentMethodBlock?.setAttribute('aria-disabled', methodLocked ? 'true' : 'false');
    updatePaymentPresentation();
  };

  const renderPayments = () => {
    if (!paymentGrid) return;
    const methodReady = paymentCanInteract() && Boolean(state.paymentType);
    paymentGrid.innerHTML = '';
    Object.values(HANDYPAD_PAYMENT_METHODS).forEach(method => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'order-payment-card';
      button.dataset.orderPayment = method.key;
      const active = state.paymentMethod === method.key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.disabled = !methodReady;
      button.innerHTML = `<span class="order-payment-name">${t()[method.labelKey]}</span>${paymentBrandMarkup(method)}`;
      paymentGrid.appendChild(button);
    });
    syncPaymentContractFields();
  };

  const paymentDialogTitleKey = method => method === 'card' ? 'cardDialogTitle' : method === 'zalopay' ? 'zaloDialogTitle' : 'bankDialogTitle';

  const openPaymentModal = method => {
    if (!paymentModal || !state.paymentType || !HANDYPAD_PAYMENT_METHODS[method]) return;
    updatePaymentPresentation();
    paymentPanels.forEach(panel => { panel.hidden = panel.dataset.paymentPanel !== method; });
    if (paymentDialogTitle) paymentDialogTitle.textContent = t()[paymentDialogTitleKey(method)];
    paymentModal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => paymentModal.classList.add('is-visible'));
    window.setTimeout(() => paymentClose?.focus(), 80);
  };

  const closePaymentModal = (unlockBody = true) => {
    if (!paymentModal || paymentModal.hidden) {
      if (unlockBody) document.body.style.overflow = '';
      return;
    }
    paymentModal.classList.remove('is-visible');
    window.setTimeout(() => {
      paymentModal.hidden = true;
      if (unlockBody) document.body.style.overflow = '';
    }, 180);
  };


  const buildPaymentPayload = () => {
    const plan = currentPaymentPlan();
    return {
      orderId: paymentConfirmationData.orderId || null,
      paymentType: state.paymentType,
      paymentMethod: state.paymentMethod,
      paymentStatus: state.paymentStatus,
      paymentAmount: plan?.amount ?? null,
      paymentCurrency: plan?.currency ?? null,
      orderTotalVnd: Math.round(orderTotals.vnd),
      orderTotalUsd: Number(orderTotals.usd.toFixed(2)),
      depositAmountUsd: HANDYPAD_DEPOSIT_USD,
      remainingBalance: plan?.remainingAmount ?? null,
      remainingCurrency: plan?.remainingCurrency ?? null,
      customer: {
        fullName: root.querySelector('#order-full-name')?.value.trim() || '',
        company: root.querySelector('#order-company')?.value.trim() || '',
        email: root.querySelector('#order-email')?.value.trim() || '',
        phone: root.querySelector('#order-phone')?.value.trim() || ''
      },
      shipping: {
        address: root.querySelector('#order-address')?.value.trim() || '',
        city: root.querySelector('#order-city')?.value.trim() || '',
        country: root.querySelector('#order-country')?.value.trim() || ''
      },
      items: [...cart.values()].map(item => ({
        sku: item.variant.sku,
        size: item.variant.sizeKey,
        dimension: item.variant.dimension,
        addOns: [...item.variant.addonKeys],
        quantity: item.quantity,
        unitPriceVnd: item.variant.priceVnd,
        unitPriceUsd: item.variant.priceUsd
      }))
    };
  };

  const emitPaymentEvent = (name, detail = null) => {
    root.dispatchEvent(new CustomEvent(name, {detail: detail || buildPaymentPayload()}));
  };

  const paymentMethodLabel = method => {
    const config = HANDYPAD_PAYMENT_METHODS[method];
    return config ? t()[config.labelKey] : t().notSelected;
  };

  const syncPaymentStateTranslations = () => {
    root.querySelectorAll('[data-order-state-i18n]').forEach(node => {
      const key = node.dataset.orderStateI18n;
      if (t()[key] !== undefined) node.textContent = t()[key];
    });
  };

  const receiptPlan = () => paymentReceiptSnapshot ? {
    type: paymentReceiptSnapshot.paymentType,
    amount: paymentReceiptSnapshot.paymentAmount,
    currency: paymentReceiptSnapshot.paymentCurrency,
    remainingAmount: paymentReceiptSnapshot.remainingBalance,
    remainingCurrency: paymentReceiptSnapshot.remainingCurrency
  } : null;

  const showPaymentStateScreen = status => {
    if (!paymentStateScreen || !paymentStateCard) return;
    const active = status === 'processing' || status === 'paid';
    paymentStateScreen.hidden = !active;
    if (!active) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    syncPaymentStateTranslations();
    paymentStateCard.classList.toggle('is-processing', status === 'processing');
    paymentStateCard.classList.toggle('is-success', status === 'paid');
    if (paymentStateDetails) paymentStateDetails.hidden = status !== 'paid';
    if (paymentStateClose) paymentStateClose.hidden = status !== 'paid';

    if (status === 'processing') {
      if (paymentStateTitle) paymentStateTitle.textContent = t().paymentProcessingTitle;
      if (paymentStateCopy) paymentStateCopy.textContent = t().paymentProcessingCopy;
      if (paymentStateSales) paymentStateSales.textContent = t().salesContactBeforeDelivery;
      return;
    }

    const plan = receiptPlan();
    const template = plan?.type === 'full' ? t().paymentSuccessFull : t().paymentSuccessDeposit;
    if (paymentStateTitle) paymentStateTitle.textContent = t().paymentSuccessTitle;
    if (paymentStateCopy) paymentStateCopy.textContent = plan
      ? template.replace('{amount}', formatCurrencyAmount(plan.amount, plan.currency))
      : t().salesContactBeforeDelivery;
    if (paymentStateSales) paymentStateSales.textContent = t().salesContactBeforeDelivery;
    if (paymentStateAmount) paymentStateAmount.textContent = plan ? formatCurrencyAmount(plan.amount, plan.currency) : '—';
    const method = paymentReceiptSnapshot?.paymentMethod || null;
    if (paymentStateMethod) paymentStateMethod.textContent = paymentMethodLabel(method);
    if (paymentStateRemaining) paymentStateRemaining.textContent = plan ? formatCurrencyAmount(plan.remainingAmount, plan.remainingCurrency) : '—';
    const orderId = paymentConfirmationData.orderId || paymentReceiptSnapshot?.orderId || '';
    if (paymentStateOrderIdRow) paymentStateOrderIdRow.hidden = !orderId;
    if (paymentStateOrderId) paymentStateOrderId.textContent = orderId || '—';
  };

  const resetLiveOrderAfterPaymentDetected = () => {
    clearDraft();
    clearCompletedOrderData();
    state.paymentType = null;
    state.paymentMethod = null;
    state.contactConfirmed = false;
    renderSizes();
    renderAddOns();
    renderCurrentVariant();
    renderCart();
    renderPaymentChoices();
    renderPayments();
    syncProgress();
  };

  const beginPaymentProcessing = (method, confirmation = {}) => {
    if (!state.paymentType || !cart.size || !HANDYPAD_PAYMENT_METHODS[method]) return false;
    state.paymentMethod = method;
    state.paymentStatus = 'processing';
    paymentConfirmationData = confirmation && typeof confirmation === 'object' ? {...confirmation} : {};
    paymentReceiptSnapshot = {...buildPaymentPayload(), paymentStatus: 'processing'};
    orderCompleted = true;

    // Preserve the submitted order for the backend event before resetting the live form.
    emitPaymentEvent('handypad:payment-processing', paymentReceiptSnapshot);
    closePaymentModal(false);
    resetLiveOrderAfterPaymentDetected();
    state.paymentStatus = 'processing';
    syncPaymentContractFields();
    showPaymentStateScreen('processing');
    return true;
  };

  const showPaymentSuccess = (method, confirmation = {}) => {
    const resolvedMethod = method || paymentReceiptSnapshot?.paymentMethod;
    if (!paymentReceiptSnapshot || !HANDYPAD_PAYMENT_METHODS[resolvedMethod]) return false;
    paymentConfirmationData = confirmation && typeof confirmation === 'object' ? {...confirmation} : {};
    paymentReceiptSnapshot = {
      ...paymentReceiptSnapshot,
      paymentMethod: resolvedMethod,
      paymentStatus: 'paid',
      orderId: paymentConfirmationData.orderId || paymentReceiptSnapshot.orderId || null
    };
    state.paymentStatus = 'paid';
    resetCardForm();
    syncPaymentContractFields();
    showPaymentStateScreen('paid');
    emitPaymentEvent('handypad:payment-success', paymentReceiptSnapshot);
    return true;
  };

  const dismissPaymentStatePopup = () => {
    if (paymentStateScreen) paymentStateScreen.hidden = true;
    document.body.style.overflow = '';
    paymentReceiptSnapshot = null;
    paymentConfirmationData = {};
    orderCompleted = false;
    state.paymentStatus = 'pending';
    syncPaymentContractFields();
  };

  const restorePaymentForm = () => {
    dismissPaymentStatePopup();
    state.paymentType = null;
    state.paymentMethod = null;
    renderPaymentChoices();
    renderPayments();
    syncProgress();
  };

  /* Backend/payment-provider handoff. ZaloPay and VietQR have no customer-side
     confirmation button: a trusted callback should drive processing/success. */
  window.HandyPadPaymentUI = Object.freeze({
    getPayload: () => paymentReceiptSnapshot || buildPaymentPayload(),
    setStatus: (status, data = {}) => {
      const normalized = String(status || '').toLowerCase();
      const method = data.method || paymentReceiptSnapshot?.paymentMethod || state.paymentMethod;
      if (normalized === 'processing') return beginPaymentProcessing(method, data);
      if (normalized === 'paid' || normalized === 'success') {
        if (!paymentReceiptSnapshot) {
          const started = beginPaymentProcessing(method, data);
          if (!started) return false;
          window.setTimeout(() => showPaymentSuccess(method, data), 650);
          return true;
        }
        return showPaymentSuccess(method, data);
      }
      if (normalized === 'pending') return restorePaymentForm();
      if (normalized === 'failed' || normalized === 'cancelled') {
        dismissPaymentStatePopup();
        showToast(data.message || (state.language === 'vi' ? 'Thanh toán chưa được xác nhận. Vui lòng thử lại.' : 'Payment was not confirmed. Please try again.'));
      }
      return false;
    },
    markProcessing: (method, data = {}) => beginPaymentProcessing(method || state.paymentMethod, data),
    markSuccess: (method, data = {}) => {
      const resolvedMethod = method || paymentReceiptSnapshot?.paymentMethod || state.paymentMethod;
      if (!paymentReceiptSnapshot) {
        const started = beginPaymentProcessing(resolvedMethod, data);
        if (!started) return false;
        window.setTimeout(() => showPaymentSuccess(resolvedMethod, data), 650);
        return true;
      }
      return showPaymentSuccess(resolvedMethod, data);
    }
  });

  const showToast = (message, variant = 'default') => {
    window.clearTimeout(toastTimer);
    toast.classList.remove('is-visible', 'is-success');
    if (variant === 'success') toast.classList.add('is-success');
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => {
        toast.hidden = true;
        toast.classList.remove('is-success');
      }, 180);
    }, 2400);
  };

  const renderCart = () => {
    const hasItems = cart.size > 0;
    summary.classList.toggle('has-scroll', cart.size >= 4);
    if (!hasItems) {
      state.paymentType = null;
      state.paymentMethod = null;
      state.paymentStatus = 'pending';
      state.contactConfirmed = false;
    }
    summaryEmpty.hidden = hasItems;
    cartList.hidden = !hasItems;
    modifyButton.hidden = !hasItems;
    modifyButton.textContent = state.modifyMode ? t().done : t().modify;
    modifyButton.setAttribute('aria-pressed', state.modifyMode ? 'true' : 'false');
    summary.classList.toggle('is-modifying', hasItems && state.modifyMode);
    cartList.innerHTML = '';

    let totalVnd = 0;
    let totalUsd = 0;
    cart.forEach((item, key) => {
      const itemSubtotal = priceForLanguage(item.variant) * item.quantity;
      totalVnd += item.variant.priceVnd * item.quantity;
      totalUsd += variantUsdPrice(item.variant) * item.quantity;
      const row = document.createElement('article');
      row.className = 'order-cart-item';
      row.dataset.cartKey = key;
      const thumbnailSrc = thumbnailForConfiguration(item.variant);
      row.innerHTML = `
        <div class="order-cart-item-head">
          ${thumbnailSrc ? `<span class="order-cart-thumb"><img src="${thumbnailSrc}" alt="" loading="lazy" decoding="async"></span>` : ''}
          <div class="order-cart-item-copy"><strong>${productTitle(item.variant.sizeKey)}</strong><span class="order-cart-item-meta">${configurationMeta(item.variant)}</span></div>
          <button class="order-cart-remove" type="button" data-cart-action="remove" data-cart-key="${key}" aria-label="${t().remove}">×</button>
        </div>
        <div class="order-cart-line"><span>${t().unitPrice}</span><b>${money(priceForLanguage(item.variant))}</b></div>
        <div class="order-cart-line">
          <span>${t().quantity}</span>
          <span class="order-cart-qty" role="group" aria-label="${t().quantity}">
            <button type="button" data-cart-action="decrease" data-cart-key="${key}" aria-label="${t().decrease}" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
            <input class="order-cart-qty-value" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" value="${item.quantity}" data-cart-qty-input data-cart-key="${key}" aria-label="${t().quantity}" autocomplete="off">
            <button type="button" data-cart-action="increase" data-cart-key="${key}" aria-label="${t().increase}">+</button>
          </span>
        </div>
        <div class="order-cart-line is-subtotal"><span>${t().subtotal}</span><b>${money(itemSubtotal)}</b></div>`;
      cartList.appendChild(row);
    });

    orderTotals.vnd = totalVnd;
    orderTotals.usd = totalUsd;
    totalNode.textContent = state.language === 'vi' ? money(totalVnd) : money(totalUsd);
    if (depositWrap) depositWrap.hidden = !hasItems;
    renderPaymentChoices();
    renderPayments();
    updatePaymentPresentation();
    syncProgress();
  };

  const setQuantity = value => {
    state.quantity = normalizeQty(value);
    renderCurrentVariant();
    scheduleDraftSave();
  };

  const enforceNeutralConfiguratorUI = () => {
    sizeGrid.querySelectorAll('[data-order-size]').forEach(button => {
      button.classList.remove('is-active');
      button.setAttribute('aria-pressed', 'false');
    });
    addonGrid.querySelectorAll('[data-order-addon]').forEach(button => {
      button.classList.remove('is-active');
      button.setAttribute('aria-checked', 'false');
    });
  };

  const resetConfiguratorSelection = () => {
    // Reset source-of-truth state first.
    state.size = null;
    HANDYPAD_ADDON_KEYS.forEach(key => { state.addOns[key] = false; });
    state.quantity = 1;

    // Rebuild the controls from the neutral state.
    renderSizes();
    renderAddOns();
    renderCurrentVariant();
    enforceNeutralConfiguratorUI();

    // Remove any lingering keyboard/mouse focus styling from a previous choice.
    if (root.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    syncProgress();

    // Re-enforce after paint in case a browser preserves transient button UI state.
    requestAnimationFrame(() => {
      enforceNeutralConfiguratorUI();
      window.setTimeout(enforceNeutralConfiguratorUI, 0);
    });
    scheduleDraftSave();
  };

  const invalidatePaymentConfirmation = () => {
    state.paymentMethod = null;
    state.paymentStatus = 'pending';
  };

  const addCurrentToCart = () => {
    const configuration = currentConfiguration();
    if (!configuration) return;

    const key = configuration.sku;
    const existing = cart.get(key);
    cartWasAddedByUser = true;
    cart.set(key, {
      variant: configuration,
      quantity: existing ? existing.quantity + state.quantity : state.quantity
    });
    invalidatePaymentConfirmation();

    const message = `${productTitle(configuration.sizeKey)} ${t().added}`;

    // Reset configurator before rendering cart-dependent progress so no selected
    // size/add-on state can be carried into the next configuration.
    resetConfiguratorSelection();
    renderCart();
    showToast(message, 'success');
    scheduleDraftSave();
  };

  const setOrderLanguage = lang => {
    state.language = lang === 'vi' ? 'vi' : 'en';
    root.querySelectorAll('[data-order-i18n]').forEach(node => {
      const key = node.dataset.orderI18n;
      if (t()[key] !== undefined) node.textContent = t()[key];
    });
    renderSizes();
    renderAddOns();
    renderCurrentVariant();
    renderPaymentChoices();
    renderPayments();
    renderCart();
    if (paymentModal && !paymentModal.hidden && state.paymentMethod && paymentDialogTitle) {
      paymentDialogTitle.textContent = t()[paymentDialogTitleKey(state.paymentMethod)];
    }
    if (!paymentStateScreen?.hidden && (state.paymentStatus === 'processing' || state.paymentStatus === 'paid')) showPaymentStateScreen(state.paymentStatus);
    scheduleDraftSave();
  };

  sizeGrid.addEventListener('click', event => {
    const button = event.target.closest('[data-order-size]');
    if (!button) return;
    state.size = button.dataset.orderSize;
    renderSizes();
    renderAddOns();
    renderCurrentVariant();
    syncProgress();
    scheduleDraftSave();
  });

  addonGrid.addEventListener('click', event => {
    const button = event.target.closest('[data-order-addon]');
    if (!button || !state.size) return;
    const key = button.dataset.orderAddon;
    if (!HANDYPAD_ADDON_KEYS.includes(key)) return;
    state.addOns[key] = !state.addOns[key];
    renderAddOns();
    renderCurrentVariant();
    syncProgress();
    scheduleDraftSave();
  });

  qtyMinus.addEventListener('click', () => setQuantity(state.quantity - 1));
  qtyPlus.addEventListener('click', () => setQuantity(state.quantity + 1));

  const commitConfiguratorQuantity = () => {
    const clean = sanitizeQuantityText(qtyValue.value);
    setQuantity(clean || 1);
  };

  qtyValue.addEventListener('input', () => {
    const clean = sanitizeQuantityText(qtyValue.value);
    if (qtyValue.value !== clean) qtyValue.value = clean;
    if (clean) state.quantity = normalizeQty(clean);
    scheduleDraftSave();
  });
  qtyValue.addEventListener('blur', commitConfiguratorQuantity);
  qtyValue.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      qtyValue.blur();
    }
  });

  addButton.addEventListener('click', () => {
    commitConfiguratorQuantity();
    addCurrentToCart();
  });

  modifyButton.addEventListener('click', () => {
    if (!cart.size) return;
    state.modifyMode = !state.modifyMode;
    renderCart();
  });

  cartList.addEventListener('click', event => {
    const button = event.target.closest('[data-cart-action][data-cart-key]');
    if (!button) return;
    const key = button.dataset.cartKey;
    const item = cart.get(key);
    if (!item) return;

    if (button.dataset.cartAction === 'increase') item.quantity += 1;
    if (button.dataset.cartAction === 'decrease' && item.quantity > 1) item.quantity -= 1;
    if (button.dataset.cartAction === 'remove' && state.modifyMode) {
      cart.delete(key);
      if (!cart.size) state.modifyMode = false;
      showToast(t().removed);
    }
    invalidatePaymentConfirmation();
    renderCart();
    renderPayments();
    scheduleDraftSave();
  });

  const commitCartQuantityInput = input => {
    if (!input?.matches('[data-cart-qty-input][data-cart-key]')) return;
    const item = cart.get(input.dataset.cartKey);
    if (!item) return;
    const clean = sanitizeQuantityText(input.value);
    item.quantity = normalizeQty(clean || 1);
    input.value = String(item.quantity);
    invalidatePaymentConfirmation();
    renderCart();
    renderPayments();
    scheduleDraftSave();
  };

  cartList.addEventListener('input', event => {
    const input = event.target.closest('[data-cart-qty-input][data-cart-key]');
    if (!input) return;
    const clean = sanitizeQuantityText(input.value);
    if (input.value !== clean) input.value = clean;
    const item = cart.get(input.dataset.cartKey);
    if (item && clean) item.quantity = normalizeQty(clean);
  });

  cartList.addEventListener('change', event => {
    const input = event.target.closest('[data-cart-qty-input][data-cart-key]');
    if (input) commitCartQuantityInput(input);
  });

  cartList.addEventListener('keydown', event => {
    const input = event.target.closest('[data-cart-qty-input][data-cart-key]');
    if (input && event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    }
  });

  requiredContactFields.forEach(field => {
    field.addEventListener('change', () => {
      syncProgress();
      scheduleDraftSave();
    });
  });

  contactValidation.forEach((_, id) => {
    const field = root.querySelector(`#${id}`);
    if (!field) return;

    field.addEventListener('blur', () => {
      contactTouched.add(field.id);
      validateContactField(field, true);
      if (state.contactConfirmed && !field.checkValidity()) state.contactConfirmed = false;
      syncProgress();
      scheduleDraftSave();
    });

    field.addEventListener('input', () => {
      if (state.contactConfirmed) state.contactConfirmed = false;
      validateContactField(field, contactTouched.has(field.id));
      syncProgress();
      scheduleDraftSave();
    });
  });

  draftFieldNodes.company?.addEventListener('input', scheduleDraftSave);
  draftFieldNodes.company?.addEventListener('change', scheduleDraftSave);

  continuePaymentButton?.addEventListener('click', () => {
    if (!cart.size) return;

    const invalidFields = requiredContactFields.filter(field => {
      contactTouched.add(field.id);
      return !validateContactField(field, true);
    });

    if (invalidFields.length) {
      state.contactConfirmed = false;
      syncProgress();
      invalidFields[0].focus();
      invalidFields[0].scrollIntoView({behavior: 'smooth', block: 'center'});
      scheduleDraftSave();
      return;
    }

    state.contactConfirmed = true;
    renderPaymentChoices();
    renderPayments();
    syncProgress();
    scheduleDraftSave();
    paymentBlock?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  });

  cardNumberField?.addEventListener('input', () => {
    const digits = cardNumberField.value.replace(/\D/g, '').slice(0, 19);
    cardNumberField.value = digits.replace(/(.{4})/g, '$1 ').trim();
    validateCardField(cardNumberField, paymentCardTouched.has(cardNumberField.id));
  });
  cardExpiryField?.addEventListener('input', () => {
    const digits = cardExpiryField.value.replace(/\D/g, '').slice(0, 4);
    cardExpiryField.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    validateCardField(cardExpiryField, paymentCardTouched.has(cardExpiryField.id));
  });
  cardCvvField?.addEventListener('input', () => {
    cardCvvField.value = cardCvvField.value.replace(/\D/g, '').slice(0, 4);
    validateCardField(cardCvvField, paymentCardTouched.has(cardCvvField.id));
  });
  paymentCardFields.forEach(field => field.addEventListener('blur', () => {
    paymentCardTouched.add(field.id);
    validateCardField(field, true);
  }));

  paymentChoiceGrid?.addEventListener('click', event => {
    const button = event.target.closest('[data-order-payment-type]');
    if (!button || !paymentCanInteract()) return;
    const type = button.dataset.orderPaymentType;
    if (!['full', 'deposit'].includes(type)) return;
    state.paymentType = type;
    state.paymentMethod = null;
    state.paymentStatus = 'pending';
    resetCardForm();
    renderPaymentChoices();
    renderPayments();
    updatePaymentPresentation();
    syncProgress();
    scheduleDraftSave();
    emitPaymentEvent('handypad:payment-option-change');
  });

  paymentGrid?.addEventListener('click', event => {
    const button = event.target.closest('[data-order-payment]');
    if (!button || !state.paymentType || !cart.size || !state.contactConfirmed || !contactIsReady()) return;
    const key = button.dataset.orderPayment;
    if (!HANDYPAD_PAYMENT_METHODS[key]) return;
    state.paymentMethod = key;
    state.paymentStatus = 'pending';
    renderPayments();
    updatePaymentPresentation();
    syncProgress();
    scheduleDraftSave();
    emitPaymentEvent('handypad:payment-method-change');
    openPaymentModal(key);
  });

  paymentClose?.addEventListener('click', closePaymentModal);
  paymentStateClose?.addEventListener('click', dismissPaymentStatePopup);
  paymentModal?.addEventListener('click', event => { if (event.target === paymentModal) closePaymentModal(); });
  paymentDialog?.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (paymentModal && !paymentModal.hidden) closePaymentModal();
  });

  root.querySelectorAll('[data-payment-preview-submit="card"]').forEach(button => {
    button.addEventListener('click', () => {
      const invalid = paymentCardFields.filter(field => {
        paymentCardTouched.add(field.id);
        return !validateCardField(field, true);
      });
      if (invalid.length) {
        invalid[0].focus();
        return;
      }
      beginPaymentProcessing('card');
    });
  });

  document.querySelectorAll('.language-option').forEach(button => {
    button.addEventListener('click', () => requestAnimationFrame(() => setOrderLanguage(button.dataset.lang)));
  });

  window.addEventListener('pagehide', saveDraft);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveDraft();
  });

  restoreDraft();
  renderSizes();
  renderAddOns();
  renderCurrentVariant();
  renderPaymentChoices();
  renderPayments();
  renderCart();
  syncProgress();
  setOrderLanguage(document.documentElement.lang || 'en');
  persistenceReady = true;
  saveDraft();
})();
