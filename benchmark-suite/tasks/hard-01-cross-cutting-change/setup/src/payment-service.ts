import { log, error } from './logger';

interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: 'credit_card' | 'bank_transfer' | 'wallet';
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';
  createdAt: Date;
}

const payments = new Map<string, Payment>();

export function initiatePayment(
  orderId: string,
  amount: number,
  method: Payment['method']
): Payment {
  const id = `PAY-${Date.now()}`;
  const payment: Payment = {
    id,
    orderId,
    amount,
    method,
    status: 'pending',
    createdAt: new Date(),
  };
  payments.set(id, payment);
  console.log(`Payment initiated: ${id} for order ${orderId}, $${amount.toFixed(2)} via ${method}`);  // call 1 (direct console)
  return payment;
}

export function authorizePayment(paymentId: string): boolean {
  const payment = payments.get(paymentId);
  if (!payment) {
    error(`Payment ${paymentId} not found`);                                    // call 2 (via imported error)
    return false;
  }
  if (payment.status !== 'pending') {
    console.warn(`Payment ${paymentId} cannot be authorized - status: ${payment.status}`);  // call 3 (direct console)
    return false;
  }

  // Simulate authorization with external payment provider
  const authorized = Math.random() > 0.1; // 90% success rate
  if (authorized) {
    payment.status = 'authorized';
    log(`Payment ${paymentId} authorized successfully`);                        // call 4 (via imported log)
  } else {
    payment.status = 'failed';
    console.error(`Payment ${paymentId} authorization failed`);                 // call 5 (direct console)
  }
  return authorized;
}

export function refundPayment(paymentId: string): boolean {
  const payment = payments.get(paymentId);
  if (!payment || payment.status !== 'captured') {
    return false;
  }
  payment.status = 'refunded';
  return true;
}
