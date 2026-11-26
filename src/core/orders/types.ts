/**
 * Order domain types. Storage-agnostic: the same shapes are persisted by the
 * in-memory server store, the browser one-device store, and (later) a DB adapter.
 */
export type OrderStatus = "accepted" | "ready" | "closed" | "expired";
export type CloseReason = "user_closed" | "expired";

export interface OrderItem {
  menuId: string;
  name: string;
  qty: number;
  unitPriceKrw: number | null;
}

/** Prep-time estimate captured at acceptance time (seconds). Never used to mark ready. */
export interface PrepEstimate {
  p50: number;
  p80: number;
  method: string;
  dataMode: "simulated";
}

export interface Order {
  id: string;
  sessionId: string;
  batchId: string;
  brandId: string;
  displayNumber: number;
  kioskId: string;
  items: OrderItem[];
  status: OrderStatus;
  acceptedAt: number;
  readyAt: number | null;
  closedAt: number | null;
  closeReason: CloseReason | null;
  prepEstimate: PrepEstimate | null;
  tokenHash: string;
  tokenExpiresAt: number;
  /** increments on every state change; clients use it to skip stale updates */
  version: number;
}

export interface OrderBatch {
  id: string;
  sessionId: string;
  kioskId: string;
  createdAt: number;
  orderIds: string[];
  totalKrw: number;
  payment: "mock";
}

export interface OrderEvent {
  seq: number;
  sessionId: string;
  orderId: string;
  type: "accepted" | "ready" | "closed" | "expired";
  at: number;
  idempotencyKey: string;
}

/** What a student device / QR page may see. No token hash, no session internals. */
export interface OrderView {
  id: string;
  brandId: string;
  displayNumber: number;
  items: OrderItem[];
  status: OrderStatus;
  acceptedAt: number;
  readyAt: number | null;
  closedAt: number | null;
  prepEstimate: PrepEstimate | null;
  expiresAt: number;
  version: number;
}

export interface Ticket {
  order: OrderView;
  /** raw QR token — only ever returned once, to the kiosk that printed it */
  token: string;
}

export interface CartLine {
  menuId: string;
  qty: number;
}

export interface PlaceOrderInput {
  sessionId: string;
  kioskId: string;
  lines: CartLine[];
}

export interface PlaceOrderResult {
  batch: OrderBatch;
  tickets: Ticket[];
}

export interface SessionOrders {
  orders: Order[];
  seq: number;
}

export function toView(o: Order): OrderView {
  return {
    id: o.id,
    brandId: o.brandId,
    displayNumber: o.displayNumber,
    items: o.items,
    status: o.status,
    acceptedAt: o.acceptedAt,
    readyAt: o.readyAt,
    closedAt: o.closedAt,
    prepEstimate: o.prepEstimate,
    expiresAt: o.tokenExpiresAt,
    version: o.version,
  };
}

/** Staff and monitor views carry the session-internal id but never token data. */
export type StaffOrder = Omit<Order, "tokenHash" | "tokenExpiresAt">;
export function toStaff(o: Order): StaffOrder {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tokenHash, tokenExpiresAt, ...rest } = o;
  return rest;
}
