import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch } from "../api/client";

export default function RoutesScreen() {
  const [routes, setRoutes] = useState([]);
  const [newRouteName, setNewRouteName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const rows = await apiFetch("/routes");
      setRoutes(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e.message || "Failed to load routes");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  async function addRoute() {
    const name = String(newRouteName || "").trim();
    if (!name) {
      setError("Route name is required");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await apiFetch("/admin/routes", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setMessage("Route added");
      setNewRouteName("");
      await loadRoutes();
    } catch (e) {
      setError(e.message || "Failed to add route");
    } finally {
      setLoading(false);
    }
  }

  async function toggleRoute(route) {
    try {
      setLoading(true);
      setError("");
      await apiFetch(`/admin/routes/${route.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !route.isActive }),
      });
      setMessage("Route updated");
      await loadRoutes();
    } catch (e) {
      setError(e.message || "Failed to update route");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 16 }}>
      <Text style={styles.heading}>Routes</Text>
      {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <View style={styles.inline}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={newRouteName}
          onChangeText={setNewRouteName}
          placeholder="New route name"
        />
        <Pressable style={styles.smallBtn} onPress={addRoute}>
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
      </View>

      {routes.map((route) => (
        <View key={String(route.id)} style={styles.routeCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{route.name}</Text>
            <Text style={styles.meta}>Status: {route.isActive ? "Active" : "Inactive"}</Text>
          </View>
          <Pressable
            style={[styles.smallBtn, !route.isActive && styles.smallBtnWarn]}
            onPress={() => toggleRoute(route)}
          >
            <Text style={styles.buttonText}>{route.isActive ? "Disable" : "Enable"}</Text>
          </Pressable>
        </View>
      ))}
      {!loading && routes.length === 0 ? <Text style={styles.empty}>No routes added</Text> : null}

      <Pressable style={styles.button} onPress={loadRoutes}>
        <Text style={styles.buttonText}>Reload</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
    padding: 14,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  success: {
    color: "#166534",
    marginBottom: 8,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  routeCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  meta: {
    color: "#374151",
  },
  empty: {
    color: "#6b7280",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  smallBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallBtnWarn: {
    backgroundColor: "#b45309",
  },
});
