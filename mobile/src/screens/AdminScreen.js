import React, { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "../api/client";

function Metric({ label, value, onPress }) {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap style={styles.metricCard} onPress={onPress}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </Wrap>
  );
}

export default function AdminScreen() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [creditAlerts, setCreditAlerts] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [lowStockLoading, setLowStockLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, usersData, salesData] = await Promise.all([
        apiFetch("/reports/summary"),
        apiFetch("/users"),
        apiFetch("/sales"),
      ]);
      setSummary(summaryData);
      setUsers(Array.isArray(usersData) ? usersData : []);

      const sales = Array.isArray(salesData) ? salesData : [];
      const nowMs = Date.now();
      const byCustomer = new Map();
      for (const s of sales) {
        const customerId = s?.customerId || s?.customer?.id;
        if (!customerId) continue;
        const outstanding = Number(s?.outstanding || 0);
        if (outstanding <= 0) continue;
        const createdAt = new Date(s.createdAt || 0);
        const days = Math.floor((nowMs - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (!Number.isFinite(days) || days < 15) continue;

        const key = String(customerId);
        const prev = byCustomer.get(key) || {
          customerId: key,
          name: s?.customer?.name || "Unknown",
          outstanding: 0,
          days: 0,
        };
        prev.outstanding += outstanding;
        prev.days = Math.max(prev.days, days);
        byCustomer.set(key, prev);
      }
      const alerts = Array.from(byCustomer.values()).sort((a, b) => b.days - a.days);
      setCreditAlerts(alerts);
    } catch (e) {
      setError(e.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const openLowStock = useCallback(async () => {
    setShowLowStockModal(true);
    setLowStockLoading(true);
    try {
      const data = await apiFetch("/products");
      const list = Array.isArray(data) ? data : data?.items || [];
      const rows = list
        .filter((p) => Number(p.stock || 0) <= 5)
        .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
      setLowStockItems(rows);
    } catch (e) {
      setError(e.message || "Failed to load low stock items");
    } finally {
      setLowStockLoading(false);
    }
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 16 }}>
        <Text style={styles.heading}>Admin Dashboard</Text>
        {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.metricsGrid}>
          <Metric label="Total Products" value={summary?.totalProducts ?? "-"} />
          <Metric label="Low Stock" value={summary?.lowStock ?? "-"} onPress={() => void openLowStock()} />
          <Metric label="Today Bills" value={summary?.todayBills ?? "-"} />
          <Metric label="Today Revenue" value={Math.round(Number(summary?.todayRevenue || 0))} />
          <Metric label="Users" value={summary?.totalUsers ?? "-"} />
        </View>

        <Text style={styles.sectionTitle}>Users</Text>
        {users.map((item) => (
          <View key={String(item.id)} style={styles.userCard}>
            <Text style={styles.userName}>{item.username}</Text>
            <Text style={styles.userMeta}>Role: {item.role}</Text>
            <Text style={styles.userMeta}>
              Created: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
            </Text>
          </View>
        ))}
        {!loading && users.length === 0 ? <Text style={styles.empty}>No users found</Text> : null}

        <Text style={styles.sectionTitle}>Credit Alerts (15+ Days)</Text>
        {creditAlerts.map((row) => (
          <View key={row.customerId} style={styles.alertCard}>
            <Text style={styles.userName}>{row.name}</Text>
            <Text style={styles.alertMeta}>Outstanding: {Math.round(Number(row.outstanding || 0))}</Text>
            <Text style={styles.alertMeta}>Days: {Number(row.days || 0)}</Text>
          </View>
        ))}
        {!loading && creditAlerts.length === 0 ? (
          <Text style={styles.empty}>No overdue customer credits above 15 days.</Text>
        ) : null}

        <Pressable style={styles.button} onPress={loadAdminData}>
          <Text style={styles.buttonText}>Reload</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showLowStockModal} transparent animationType="fade" onRequestClose={() => setShowLowStockModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Low Stock Items</Text>
            {lowStockLoading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
            <ScrollView style={styles.modalList}>
              {lowStockItems.map((item) => (
                <View key={String(item.id || item.barcode)} style={styles.lowStockRow}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userMeta}>Barcode: {item.barcode || "-"}</Text>
                  <Text style={styles.lowStockText}>Stock: {Number(item.stock || 0)}</Text>
                </View>
              ))}
              {!lowStockLoading && lowStockItems.length === 0 ? (
                <Text style={styles.empty}>No low stock items</Text>
              ) : null}
            </ScrollView>
            <Pressable style={styles.button} onPress={() => setShowLowStockModal(false)}>
              <Text style={styles.buttonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
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
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  userCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  alertCard: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  alertMeta: {
    color: "#9a3412",
    fontWeight: "700",
  },
  userName: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  userMeta: {
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  modalList: {
    marginBottom: 8,
  },
  lowStockRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 8,
  },
  lowStockText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
});
