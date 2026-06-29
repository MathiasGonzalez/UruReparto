import * as SecureStore from "expo-secure-store";
import type {
  LoginRequest,
  LoginResponse,
  Delivery,
  PaginatedResponse,
  DeliveryStatusUpdate,
  ApiResponse,
} from "@urureparto/shared";
import { API_URL } from "../constants";

const TOKEN_KEY = "urureparto_token";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as ApiResponse<LoginResponse> & { success: boolean };

  if (!res.ok || !json.success) {
    throw new Error((json as { message?: string }).message ?? "Login failed");
  }

  await SecureStore.setItemAsync(TOKEN_KEY, json.data.accessToken);
  return json.data;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

// ─── Deliveries ───────────────────────────────────────────────────────────────

export async function getMyDeliveries(
  status?: string
): Promise<PaginatedResponse<Delivery>> {
  const token = await getStoredToken();
  const params = new URLSearchParams({ pageSize: "50" });
  if (status) params.set("status", status);

  const res = await fetch(`${API_URL}/deliveries?${params}`, {
    headers: { Authorization: `****** },
  });

  const json = (await res.json()) as PaginatedResponse<Delivery> & { success: boolean };

  if (!res.ok || !json.success) {
    throw new Error("Failed to fetch deliveries");
  }

  return json;
}

export async function getDelivery(id: string): Promise<Delivery> {
  const token = await getStoredToken();

  const res = await fetch(`${API_URL}/deliveries/${id}`, {
    headers: { Authorization: `****** },
  });

  const json = (await res.json()) as ApiResponse<Delivery> & { success: boolean };

  if (!res.ok || !json.success) {
    throw new Error("Failed to fetch delivery");
  }

  return json.data;
}

export async function updateDeliveryStatus(
  update: DeliveryStatusUpdate
): Promise<Delivery> {
  const token = await getStoredToken();

  const res = await fetch(`${API_URL}/deliveries/${update.deliveryId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `******
    },
    body: JSON.stringify({
      status: update.status,
      notes: update.notes,
      lat: update.lat,
      lng: update.lng,
    }),
  });

  const json = (await res.json()) as ApiResponse<Delivery> & { success: boolean };

  if (!res.ok || !json.success) {
    throw new Error("Failed to update delivery status");
  }

  return json.data;
}
