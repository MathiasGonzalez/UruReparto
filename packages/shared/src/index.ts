export type UserRole = "admin" | "manager" | "driver";

export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "in_transit"
  | "delivered"
  | "failed"
  | "cancelled";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode?: string;
  lat?: number;
  lng?: number;
}

export interface DeliveryCustomer {
  name: string;
  phone: string;
  email?: string;
}

export interface Delivery {
  id: string;
  tenantId: string;
  trackingCode: string;
  status: DeliveryStatus;
  assignedTo?: string;
  customer: DeliveryCustomer;
  address: DeliveryAddress;
  notes?: string;
  scheduledAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryStatusUpdate {
  deliveryId: string;
  status: DeliveryStatus;
  notes?: string;
  lat?: number;
  lng?: number;
}

export interface StockItem {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}
