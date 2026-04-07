import type { Product } from './localDB';
import type { CartExtra, CartItem } from '../types/cart';

export const MENU_ADD_ONS: CartExtra[] = [
  { id: 'addon-papas', name: 'Papas trufadas', price: 28000 },
  { id: 'addon-ensalada', name: 'Ensalada César', price: 32000 },
  { id: 'addon-esparragos', name: 'Espárragos a la parrilla', price: 35000 },
  { id: 'addon-champinones', name: 'Champiñones salteados', price: 22000 },
  { id: 'addon-pure', name: 'Puré de papa y trufa', price: 26000 },
];

export const MENU_DRINKS: CartExtra[] = [
  { id: 'drink-agua', name: 'Agua mineral', price: 12000 },
  { id: 'drink-gaseosa', name: 'Gaseosa', price: 14000 },
  { id: 'drink-jugo', name: 'Jugo natural', price: 16000 },
  { id: 'drink-cerveza', name: 'Cerveza artesanal', price: 22000 },
  { id: 'drink-vino-copa', name: 'Copa de vino de la casa', price: 45000 },
  { id: 'drink-cafe', name: 'Café espresso', price: 10000 },
];

export function buildCartLineId(
  productId: string,
  addOns: CartExtra[],
  drinks: CartExtra[]
): string {
  const a = [...addOns]
    .sort((x, y) => x.id.localeCompare(y.id))
    .map(x => x.id)
    .join('|');
  const d = [...drinks]
    .sort((x, y) => x.id.localeCompare(y.id))
    .map(x => x.id)
    .join('|');
  return `${productId}::${a}::${d}`;
}

export function computeUnitPrice(
  basePrice: number,
  addOns: CartExtra[],
  drinks: CartExtra[]
): number {
  return (
    basePrice +
    addOns.reduce((s, x) => s + x.price, 0) +
    drinks.reduce((s, x) => s + x.price, 0)
  );
}

export function buildCartItemFromProduct(
  p: Product,
  addOns: CartExtra[],
  drinks: CartExtra[]
): Omit<CartItem, 'quantity'> {
  const id = buildCartLineId(p.id, addOns, drinks);
  const unit = computeUnitPrice(p.price, addOns, drinks);
  return {
    id,
    productId: p.id,
    name: p.name,
    price: unit,
    basePrice: p.price,
    addOns,
    drinks,
    imageUrl: p.imageUrl,
    weight: p.weight,
  };
}
