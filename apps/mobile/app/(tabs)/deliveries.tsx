import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { router } from "expo-router";
import { getMyDeliveries } from "../../services/api";
import type { Delivery } from "@urureparto/shared";
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from "../../constants";

export default function DeliveriesScreen() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const loadDeliveries = useCallback(async () => {
    try {
      const res = await getMyDeliveries(statusFilter || undefined);
      setDeliveries(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    loadDeliveries().finally(() => setLoading(false));
  }, [loadDeliveries]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDeliveries();
    setRefreshing(false);
  }, [loadDeliveries]);

  const filters = [
    { key: "", label: "Todos" },
    { key: "assigned", label: "Asignados" },
    { key: "in_transit", label: "En camino" },
    { key: "delivered", label: "Entregados" },
    { key: "failed", label: "Fallidos" },
  ];

  return (
    <View style={styles.container}>
      {/* Status filter chips */}
      <View style={styles.filters}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.chip,
              statusFilter === f.key && styles.chipActive,
            ]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text
              style={[
                styles.chipText,
                statusFilter === f.key && styles.chipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#1d4ed8"
          style={{ flex: 1, marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={deliveries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No hay envíos para mostrar</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/delivery/${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.trackingCode}>{item.trackingCode}</Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: DELIVERY_STATUS_COLORS[item.status] + "22" },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: DELIVERY_STATUS_COLORS[item.status] },
                    ]}
                  >
                    {DELIVERY_STATUS_LABELS[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.customerName}>{item.customer.name}</Text>
              <Text style={styles.address}>
                {item.address.street}, {item.address.city}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  filters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexWrap: "wrap",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipActive: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" },
  chipText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  list: { padding: 16, gap: 12 },
  empty: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trackingCode: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  badgeText: { fontSize: 12, fontWeight: "600" },
  customerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  address: { fontSize: 14, color: "#6b7280" },
});
