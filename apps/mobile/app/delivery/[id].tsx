import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { getDelivery, updateDeliveryStatus } from "../../services/api";
import type { Delivery, DeliveryStatus } from "@urureparto/shared";
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from "../../constants";

const NEXT_STATUS: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  assigned: "in_transit",
  in_transit: "delivered",
};

const NEXT_STATUS_LABEL: Partial<Record<DeliveryStatus, string>> = {
  assigned: "Iniciar entrega",
  in_transit: "Confirmar entrega",
};

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id) {
      getDelivery(id)
        .then(setDelivery)
        .catch(() => Alert.alert("Error", "No se pudo cargar el envío"))
        .finally(() => setLoading(false));
    }
  }, [id]);

  async function handleStatusUpdate() {
    if (!delivery) return;
    const nextStatus = NEXT_STATUS[delivery.status as DeliveryStatus];
    if (!nextStatus) return;

    setUpdating(true);
    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      let lat: number | undefined;
      let lng: number | undefined;

      if (locStatus === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const updated = await updateDeliveryStatus({
        deliveryId: delivery.id,
        status: nextStatus,
        lat,
        lng,
      });
      setDelivery(updated);
      Alert.alert("✓ Listo", `Estado actualizado a: ${DELIVERY_STATUS_LABELS[nextStatus]}`);
    } catch {
      Alert.alert("Error", "No se pudo actualizar el estado.");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No se encontró el envío</Text>
      </View>
    );
  }

  const nextStatus = NEXT_STATUS[delivery.status as DeliveryStatus];
  const color = DELIVERY_STATUS_COLORS[delivery.status] ?? "#6b7280";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.statusBadge, { backgroundColor: color + "22" }]}>
        <Text style={[styles.statusText, { color }]}>
          {DELIVERY_STATUS_LABELS[delivery.status] ?? delivery.status}
        </Text>
      </View>

      <Text style={styles.trackingCode}>{delivery.trackingCode}</Text>

      <Section title="Cliente">
        <InfoRow label="Nombre" value={delivery.customer.name} />
        <InfoRow label="Teléfono" value={delivery.customer.phone} />
        {delivery.customer.email && (
          <InfoRow label="Email" value={delivery.customer.email} />
        )}
      </Section>

      <Section title="Dirección de entrega">
        <InfoRow label="Calle" value={delivery.address.street} />
        <InfoRow label="Ciudad" value={delivery.address.city} />
        <InfoRow label="Departamento" value={delivery.address.state} />
        {delivery.address.zipCode && (
          <InfoRow label="CP" value={delivery.address.zipCode} />
        )}
      </Section>

      {delivery.notes && (
        <Section title="Notas">
          <Text style={styles.notes}>{delivery.notes}</Text>
        </Section>
      )}

      {nextStatus && (
        <TouchableOpacity
          style={[styles.actionButton, updating && styles.actionButtonDisabled]}
          onPress={handleStatusUpdate}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>
              {NEXT_STATUS_LABEL[delivery.status as DeliveryStatus]}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {delivery.status === "in_transit" && (
        <TouchableOpacity
          style={styles.failedButton}
          onPress={() =>
            Alert.alert("Marcar como fallido", "¿Confirmás que no se pudo entregar?", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Sí, marcar fallido",
                style: "destructive",
                onPress: async () => {
                  setUpdating(true);
                  try {
                    const updated = await updateDeliveryStatus({
                      deliveryId: delivery.id,
                      status: "failed",
                    });
                    setDelivery(updated);
                  } finally {
                    setUpdating(false);
                  }
                },
              },
            ])
          }
        >
          <Text style={styles.failedButtonText}>No se pudo entregar</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, gap: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#6b7280", fontSize: 16 },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
  },
  statusText: { fontWeight: "700", fontSize: 14 },
  trackingCode: {
    fontFamily: "monospace",
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  sectionContent: { padding: 16, gap: 10 },
  infoRow: { flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { fontSize: 14, color: "#6b7280" },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    maxWidth: "60%",
    textAlign: "right",
  },
  notes: { fontSize: 14, color: "#374151", lineHeight: 22 },
  actionButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
  },
  actionButtonDisabled: { backgroundColor: "#93c5fd" },
  actionButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  failedButton: {
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  failedButtonText: { color: "#dc2626", fontWeight: "600", fontSize: 15 },
});
