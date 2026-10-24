// Valid order-state transitions, enforced server-side.
// Order creation != payment received: COD orders start PENDING/UNPAID and only
// become PAID when authorized staff confirm collection (or a verified gateway
// callback arrives). DELIVERED is the only state that fulfills stock.
export const ORDER_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED', 'REFUNDED'],
  CANCELLED: [],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
};

export function canTransition(from, to) {
  return (ORDER_TRANSITIONS[from] || []).includes(to);
}

export function isTerminalStatus(status) {
  return ['CANCELLED', 'REFUNDED'].includes(status);
}
