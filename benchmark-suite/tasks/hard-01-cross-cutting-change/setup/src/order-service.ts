import { log, warn } from './logger';

interface Order {
  id: string;
  userId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: Date;
}

const orders = new Map<string, Order>();

export function createOrder(
  userId: string,
  items: Order['items']
): Order {
  const id = `ORD-${Date.now()}`;
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const order: Order = {
    id,
    userId,
    items,
    total,
    status: 'pending',
    createdAt: new Date(),
  };
  orders.set(id, order);
  log(`Order created: ${id} for user ${userId}, total: $${total.toFixed(2)}`);  // call 1 (via imported log)
  return order;
}

export function processOrder(orderId: string): boolean {
  const order = orders.get(orderId);
  if (!order) {
    console.error(`Order ${orderId} not found`);                                // call 2 (direct console)
    return false;
  }
  if (order.status !== 'pending') {
    warn(`Order ${orderId} cannot be processed - status: ${order.status}`);     // call 3 (via imported warn)
    return false;
  }
  order.status = 'processing';
  console.log(`Order ${orderId} is now processing`);                            // call 4 (direct console)
  return true;
}

export function cancelOrder(orderId: string): boolean {
  const order = orders.get(orderId);
  if (!order || order.status === 'completed') {
    return false;
  }
  order.status = 'cancelled';
  return true;
}
