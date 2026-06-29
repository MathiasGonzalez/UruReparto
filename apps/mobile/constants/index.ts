const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export const API_URL = API_BASE_URL;

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  assigned: "Asignado",
  in_transit: "En camino",
  delivered: "Entregado",
  failed: "Fallido",
  cancelled: "Cancelado",
};

export const DELIVERY_STATUS_COLORS: Record<string, string> = {
  pending: "#ca8a04",
  assigned: "#2563eb",
  in_transit: "#7c3aed",
  delivered: "#16a34a",
  failed: "#dc2626",
  cancelled: "#6b7280",
};
