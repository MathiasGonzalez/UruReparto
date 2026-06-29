import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { logout } from "../../services/api";

export default function ProfileScreen() {
  async function handleLogout() {
    Alert.alert("Cerrar sesión", "¿Estás seguro que querés cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>👤</Text>
      </View>
      <Text style={styles.name}>Repartidor</Text>
      <Text style={styles.role}>Driver</Text>

      <View style={styles.section}>
        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    paddingTop: 48,
    padding: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: { fontSize: 40 },
  name: { fontSize: 22, fontWeight: "bold", color: "#111827" },
  role: { fontSize: 14, color: "#6b7280", marginTop: 4, marginBottom: 32 },
  section: { width: "100%", gap: 12 },
  button: {
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#dc2626", fontWeight: "700", fontSize: 16 },
});
