import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { login, requestOtp, verifyOtp } from "../services/api";

type LoginMode = "otp" | "password";
type OtpStep = "request" | "verify";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<LoginMode>("otp");
  const [otpStep, setOtpStep] = useState<OtpStep>("request");

  // ─── Password login ──────────────────────────────────────────────────────

  async function handlePasswordLogin() {
    if (!email || !password || !tenantSlug) {
      Alert.alert("Error", "Por favor completá todos los campos.");
      return;
    }

    setLoading(true);
    try {
      await login({ email, password, tenantSlug });
      router.replace("/(tabs)/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  // ─── OTP: step 1 — request code ─────────────────────────────────────────

  async function handleRequestOtp() {
    if (!email || !tenantSlug) {
      Alert.alert("Error", "Por favor ingresá tu email y empresa.");
      return;
    }

    setLoading(true);
    try {
      await requestOtp({ email, tenantSlug });
      setOtpStep("verify");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al solicitar el código.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  // ─── OTP: step 2 — verify code ──────────────────────────────────────────

  async function handleVerifyOtp() {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert("Error", "Ingresá el código de 6 dígitos.");
      return;
    }

    setLoading(true);
    try {
      await verifyOtp({ email, tenantSlug, code: otpCode });
      router.replace("/(tabs)/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Código inválido o expirado.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  function switchToOtp() {
    setMode("otp");
    setOtpStep("request");
    setPassword("");
    setOtpCode("");
  }

  function switchToPassword() {
    setMode("password");
    setOtpCode("");
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>📦</Text>
        <Text style={styles.title}>UruReparto</Text>
        <Text style={styles.subtitle}>App de Repartidor</Text>

        {/* Common fields */}
        <TextInput
          style={styles.input}
          placeholder="Empresa (slug)"
          placeholderTextColor="#9ca3af"
          value={tenantSlug}
          onChangeText={setTenantSlug}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* OTP flow — step 1: request */}
        {mode === "otp" && otpStep === "request" && (
          <>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRequestOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Solicitar código</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.switchBtn}
              onPress={switchToPassword}
              accessibilityLabel="Ingresar con contraseña"
              accessibilityRole="button"
            >
              <Text style={styles.switchText}>Ingresar con contraseña</Text>
            </TouchableOpacity>
          </>
        )}

        {/* OTP flow — step 2: verify */}
        {mode === "otp" && otpStep === "verify" && (
          <>
            <Text style={styles.hint}>
              Revisá tu bandeja de entrada y escribí el código de 6 dígitos.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Código (6 dígitos)"
              placeholderTextColor="#9ca3af"
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verificar código</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.switchBtn}
              onPress={switchToOtp}
              accessibilityLabel="Volver a solicitar código"
              accessibilityRole="button"
            >
              <Text style={styles.switchText}>Volver a solicitar código</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Password flow */}
        {mode === "password" && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handlePasswordLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Iniciar sesión</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.switchBtn}
              onPress={switchToOtp}
              accessibilityLabel="Ingresar con código por email"
              accessibilityRole="button"
            >
              <Text style={styles.switchText}>Ingresar con código por email</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  logo: { fontSize: 48, textAlign: "center", marginBottom: 8 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e40af",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 28,
  },
  hint: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
    marginBottom: 12,
    backgroundColor: "#f9fafb",
  },
  button: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: "#93c5fd" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  switchBtn: { marginTop: 16, alignItems: "center" },
  switchText: { color: "#1d4ed8", fontSize: 14 },
});

