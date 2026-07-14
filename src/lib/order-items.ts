export interface OrderItemLike {
  quantity: number;
  seat: { row: string; number: number } | null;
  zone: { name: string } | null;
}

/** "Platea A3" for a numbered seat, "General × 4" for a free-capacity zone. */
export function orderItemLabel(item: OrderItemLike) {
  if (item.seat) {
    return `${item.zone?.name ?? ""} ${item.seat.row}${item.seat.number}`.trim();
  }
  return `${item.zone?.name ?? "Zona"} × ${item.quantity}`;
}

export function orderItemsSummary(items: OrderItemLike[]) {
  return items.map(orderItemLabel).join(", ");
}
