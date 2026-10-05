export function formatCardNumber(value) {
  return value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
}
export function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}
export function validateCard(values, now = new Date()) {
  const errors = {}, number = (values.number ?? '').trim(), digits = number.replace(/\s/g, '');
  if (!number) errors.number = 'Card number is required.';
  else {
    let sum = 0, double = false;
    for (let i = digits.length - 1; i >= 0; i--) { let digit = Number(digits[i]); if (double) { digit *= 2; if (digit > 9) digit -= 9; } sum += digit; double = !double; }
    if (!/^\d{12,19}$/.test(digits) || /^0+$/.test(digits) || sum % 10 !== 0) errors.number = 'Enter a valid card number.';
  }
  const expiry = (values.expiry ?? '').trim(), match = expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!expiry) errors.expiry = 'Expiry date is required.';
  else if (!match || +match[1] < 1 || +match[1] > 12) errors.expiry = 'Enter a valid expiry date.';
  else if (2000 + +match[2] < now.getFullYear() || (2000 + +match[2] === now.getFullYear() && +match[1] < now.getMonth() + 1)) errors.expiry = 'This card has expired.';
  if (!values.cvv?.trim()) errors.cvv = 'Security code is required.';
  else if (!/^\d{3,4}$/.test(values.cvv)) errors.cvv = 'Enter a valid security code.';
  return errors;
}

// Only allowlisted customer copy crosses the UI boundary, never raw error messages.
export const paymentErrorMessage = code => code === 'invalid_response'
  ? 'Payment response could not be verified'
  : "We couldn't start the payment. Please try again.";
