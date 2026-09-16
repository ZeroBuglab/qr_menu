export type Locale = "ru" | "kk" | "en";
export type Role = "OWNER" | "MANAGER" | "KITCHEN" | "WAITER";
export type OrderStatus = "NEW" | "COOKING" | "READY" | "DELIVERING" | "COMPLETED" | "CANCELLED";
export type FulfillmentType = "DINE_IN" | "PICKUP";
export interface Product {
    id: string;
    name: Record<Locale, string>;
    description: Record<Locale, string>;
    price: number;
    category: string;
    image: string;
    tags: string[];
    prepMinutes: number;
    available: boolean;
}
export interface CartLine extends Product {
    quantity: number;
    modifiers: string[];
}
export interface OrderSummary {
    id: string;
    displayNumber: string;
    status: OrderStatus;
    total: number;
    tableNumber?: string;
    fulfillment: FulfillmentType;
}
