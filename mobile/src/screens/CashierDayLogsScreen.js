import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch } from "../api/client";

function todayDateInput() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CashierDayLogsScreen() {
  const [fromDate, setFromDate] = useState(todayDateInput());
  const [toDate, setToDate] = useState(todayDateInput());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async (from, to) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await apiFetch(`/admin/cashier/day/logs?${params.toString()}`);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setError(e.message || "Failed to load day logs");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadLogs(fromDate, toDate);
  }, [loadLogs]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 16 }}>
      <Text style={styles.heading}>Cashier Day Logs</Text>
      {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.meta}>From (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={fromDate} onChangeText={setFromDate} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.meta}>To (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={toDate} onChangeText={setToDate} />
        </View>
      </View>

      <Pressable style={styles.button} onPress={() => loadLogs(fromDate, toDate)}>
        <Text style={styles.buttonText}>Apply Filter</Text>
      </Pressable>

      {rows.map((row) => (
        <View key={String(row.id)} style={styles.card}>
          <Text style={styles.name}>
            {row?.cashier?.username || "Cashier"} | {row.route || "-"}
          </Text>
          <Text style={styles.meta}>Started: {row.startedAt ? new Date(row.startedAt).toLocaleString() : "-"}</Text>
          <Text style={styles.meta}>Ended: {row.endedAt ? new Date(row.endedAt).toLocaleString() : "Active"}</Text>
          <Text style={styles.meta}>Auto Ended: {row.autoEnded ? "Yes" : "No"}</Text>
          <Text style={styles.meta}>Sales Count: {Number(row.salesCount || 0)}</Text>
          <Text style={styles.meta}>Sales Total: {Math.round(Number(row.salesTotal || 0))}</Text>
        </View>
      ))}
      {!loading && rows.length === 0 ? <Text style={styles.empty}>No logs found for selected dates</Text> : null}
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  name: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  meta: {
    color: "#374151",
    marginBottom: 2,
  },
  empty: {
    color: "#6b7280",
    marginTop: 8,
  },
  button: {
    marginTop: 2,
    marginBottom: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
