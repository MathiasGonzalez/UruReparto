import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useEffect, useState } from "react";
import { getMyDeliveries } from "../../services/api";
import type { Delivery } from "@urureparto/shared";

export default function HomeScreen() {
  const [stats, setStats] = useState({
    pending: 0,
    assigned: 0,
    in_transit: 0,
    delivered: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyDeliveries()
      .then((res) => {
        const counts = { pending: 0, assigned: 0, in_transit: 0, delivered: 0 };
        for (const d of res.data) {
          if (d.status in counts) {
            counts[d.status as keyof typeof counts]++;
          }
        }
        setStats(counts);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>¡Buen día, repartidor! 👋</Text>
      <Text style={styles.subtitle}>Resumen de hoy</Text>

      <View style={styles.grid}>
        <StatCard label="Pendientes" value={stats.pending} color="#ca8a04" />
        <StatCard label="Asignados" value={stats.assigned} color="#2563eb" />
        <StatCard label="En camino" value={stats.in_transit} color="#7c3aed" />
        <StatCard label="Entregados" value={stats.delivered} color="#16a34a" />
      </View>
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20 },
  greeting: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 20 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardValue: { fontSize: 32, fontWeight: "800" },
  cardLabel: { fontSize: 13, color: "#6b7280", marginTop: 4 },
});
