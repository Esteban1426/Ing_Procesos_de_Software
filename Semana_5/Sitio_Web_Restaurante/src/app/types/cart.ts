export interface CartExtra {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  /** Precio unitario (producto + acompañamientos + bebidas). */
  price: number;
  basePrice: number;
  addOns: CartExtra[];
  drinks: CartExtra[];
  imageUrl: string;
  quantity: number;
  weight?: string;
}
