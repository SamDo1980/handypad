// Only allowlisted customer copy crosses the UI boundary, never raw error messages.
export const paymentErrorMessage = code => code === 'invalid_response'
  ? 'Payment response could not be verified'
  : "We couldn't start the payment. Please try again.";
