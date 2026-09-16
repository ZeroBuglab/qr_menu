import type { OrderStatus } from "@qr-menu/types";

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["COOKING", "CANCELLED"],
  COOKING: ["READY", "CANCELLED"],
  READY: ["DELIVERING", "CANCELLED"],
  DELIVERING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return from === to || transitions[from].includes(to);
}
