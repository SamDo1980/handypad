async function odooCall(env, service, method, args) {
  const res = await fetch(`${env.ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Date.now(),
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Odoo lỗi: ${data.error.data?.message || JSON.stringify(data.error)}`);
  }
  return data.result;
}

async function odooLogin(env) {
  const uid = await odooCall(env, "common", "login", [
    env.ODOO_DB,
    env.ODOO_USERNAME,
    env.ODOO_API_KEY,
  ]);
  if (!uid) throw new Error("Odoo login thất bại — kiểm tra ODOO_DB/USERNAME/API_KEY");
  return uid;
}

function execute(env, uid, model, method, args, kwargs = {}) {
  return odooCall(env, "object", "execute_kw", [env.ODOO_DB, uid, env.ODOO_API_KEY, model, method, args, kwargs]);
}

const firstId = (result) => (Array.isArray(result) ? result[0] : result) || null;

async function findCountryId(env, uid, countryName) {
  if (!countryName) return false;
  const ids = await execute(env, uid, "res.country", "search", [[["name", "=ilike", countryName]]], { limit: 1 });
  return ids?.[0] || false;
}

async function findOrCreatePartner(env, uid, customer, reference) {
  if (customer.email) {
    const ids = await execute(env, uid, "res.partner", "search", [[["email", "=ilike", customer.email]]], {
      limit: 1,
      order: "id desc",
    });
    if (ids?.[0]) return ids[0];
  }

  const values = {
    name: customer.name || customer.email || `Customer ${reference}`,
    email: customer.email || false,
    phone: customer.phone || false,
    street: customer.street || false,
    city: customer.city || false,
    country_id: await findCountryId(env, uid, customer.country),
  };
  if (customer.company) values.company_name = customer.company;

  return firstId(await execute(env, uid, "res.partner", "create", [values]));
}

async function findOrCreateProduct(env, uid, line) {
  const domain = line.sku ? [["default_code", "=", line.sku]] : [["name", "=", line.productName]];
  const ids = await execute(env, uid, "product.product", "search", [domain], { limit: 1 });
  if (ids?.[0]) return ids[0];

  const values = {
    name: line.productName,
    list_price: line.unitPrice,
    sale_ok: true,
    type: "consu"
  };
  if (line.sku) values.default_code = line.sku;
  return firstId(await execute(env, uid, "product.product", "create", [values]));
}

async function sendSaleOrderEmail(env, uid, saleOrderId) {
  const action = await execute(env, uid, "sale.order", "action_quotation_send", [[saleOrderId]]);
  const context = action?.context || {};
  const wizardId = firstId(await execute(env, uid, "mail.compose.message", "create", [{}], { context }));
  await execute(env, uid, "mail.compose.message", "action_send_mail", [[wizardId]], { context });
}

export async function createOdooSaleOrder(env, sale, { confirm = true, sendEmail = true } = {}) {
  const lines = Array.isArray(sale.lines) ? sale.lines : [];
  if (!lines.length) throw new Error(`Đơn ${sale.reference} không có sản phẩm để tạo Sales Order`);
  const customer = sale.customer || {};

  const uid = await odooLogin(env);
  const partnerId = await findOrCreatePartner(env, uid, customer, sale.reference);

  const orderLines = [];
  for (const line of lines) {
    const productId = await findOrCreateProduct(env, uid, line);
    orderLines.push([0, 0, {
      product_id: productId,
      name: line.description || line.productName,
      product_uom_qty: line.quantity,
      price_unit: line.unitPrice
    }]);
  }

  const saleOrderId = firstId(await execute(env, uid, "sale.order", "create", [{
    partner_id: partnerId,
    client_order_ref: sale.reference,
    origin: sale.origin || sale.reference,
    order_line: orderLines
  }]));

  if (confirm) await execute(env, uid, "sale.order", "action_confirm", [[saleOrderId]]);

  let emailSent = false;
  if (sendEmail && customer.email) {
    try {
      await sendSaleOrderEmail(env, uid, saleOrderId);
      emailSent = true;
    } catch (err) {
      console.error(`Odoo gửi email Sales Order ${saleOrderId} lỗi:`, err.message);
    }
  }

  return { saleOrderId, emailSent };
}

export function odooSaleOrderStep({ toSaleOrder, confirm = true, sendEmail = true }) {
  return {
    name: "odoo-sale-order",
    enabled: (env) => Boolean(env.ODOO_URL),
    async run(env, order) {
      const { saleOrderId, emailSent } = await createOdooSaleOrder(env, toSaleOrder(order), { confirm, sendEmail });
      console.log(`Odoo Sales Order ${saleOrderId} cho ${order.id} (email khách hàng: ${emailSent ? "đã gửi" : "chưa gửi"})`);
    }
  };
}
