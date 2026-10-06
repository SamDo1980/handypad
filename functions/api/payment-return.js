import { payments } from "../_lib/payments.js";

// Gateways send the payment popup here; the page notifies the shop tab and closes itself.
export const onRequestGet = payments.returnPage;
