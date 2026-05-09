export enum OrderStatus {
  PLACED = 'PLACED',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  ON_THE_WAY = 'ON_THE_WAY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export type UserRole = 'STUDENT' | 'STAFF' | 'VENDOR' | 'ADMIN';

export type PaymentMethod = 'MTN_MOMO' | 'VODAFONE_CASH' | 'AIRTELTIGO_MONEY';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  isOpen: boolean;
  rating: number;
  reviewCount: number;
  tags: string[];
  ownerId: string;
  owner?: User;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  category: string;
  isAvailable: boolean;
  vendorId: string;
  vendor?: Vendor;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem: MenuItem;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  customerId: string;
  customer?: User;
  vendorId: string;
  vendor?: Vendor;
  items: OrderItem[];
  status: OrderStatus;
  deliveryLocation: string;
  deliveryFee: number;
  subtotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  notes?: string;
  placedAt: string;
  updatedAt: string;
}
