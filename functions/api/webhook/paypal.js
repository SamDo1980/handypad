import { payments } from "../../_lib/payments.js";

export const onRequestPost = payments.webhook("paypal");
