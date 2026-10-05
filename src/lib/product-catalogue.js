export function createCatalogue(products) {
  const byId = new Map(products.map(product => [product.id, product]));
  return { products, getById: id => byId.get(id) };
}
