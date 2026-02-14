import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";

const OUT_PREFIX = "OUTSTANDING:";

function parseOutstanding(notes) {
  const text = String(notes || "");
  const line = text
    .split("\n")
    .map((v) => v.trim())
    .find((v) => v.toUpperCase().startsWith(OUT_PREFIX));
  if (!line) return 0;
  const raw = line.slice(OUT_PREFIX.length).trim();
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCustomerOutstanding(customer, outstandingMap) {
  return Math.max(
    Number(outstandingMap[customer.id] || 0),
    parseOutstanding(customer.notes)
  );
}

const CustomerCard = React.memo(function CustomerCard({ item, outstanding }) {
  return (
    <View style={styles.card}>
      <View style={styles.topLine}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={[styles.outstanding, outstanding > 0 ? styles.outstandingWarn : null]}>
          Outstanding: {Math.round(outstanding)}
        </Text>
      </View>
      <Text style={styles.meta}>Phone: {item.phone || "-"}</Text>
      <Text style={styles.meta}>Address: {item.address || "-"}</Text>
      <Text style={styles.meta}>Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</Text>
    </View>
  );
});

export default function CustomersScreen() {
  const { role } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [outstandingMap, setOutstandingMap] = useState({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const [data, outstanding] = await Promise.all([
        apiFetch("/customers"),
        apiFetch("/reports/customer-outstanding"),
      ]);

      setCustomers(Array.isArray(data) ? data : []);
      const map = {};
      (outstanding?.rows || []).forEach((row) => {
        if (row?.customerId) {
          map[row.customerId] = Number(row.outstanding || 0);
        }
      });
      setOutstandingMap(map);
    } catch (e) {
      setError(e.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  function resetCustomerForm() {
    setNameInput("");
    setPhoneInput("");
    setAddressInput("");
  }

  async function onAddCustomer() {
    const name = String(nameInput || "").trim();
    if (!name) {
      setError("Customer name is required");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      await apiFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone: phoneInput ? String(phoneInput).trim() : null,
          address: addressInput ? String(addressInput).trim() : null,
        }),
      });
      setMessage("Customer added");
      setShowAddModal(false);
      resetCustomerForm();
      await loadCustomers();
    } catch (e) {
      setError(e.message || "Failed to add customer");
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCustomers();
    setRefreshing(false);
  }, [loadCustomers]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    return [...customers]
      .filter((c) => {
        const created = new Date(c.createdAt || 0);
        if (created < from || created > to) return false;
        if (!q) return true;
        const name = String(c.name || "").toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        const address = String(c.address || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || address.includes(q);
      })
      .sort(
        (a, b) =>
          getCustomerOutstanding(b, outstandingMap) - getCustomerOutstanding(a, outstandingMap)
      );
  }, [customers, outstandingMap, query, fromDate, toDate]);

  const keyExtractor = useCallback((item) => String(item.id), []);
  const renderCustomerItem = useCallback(
    ({ item }) => (
      <CustomerCard item={item} outstanding={getCustomerOutstanding(item, outstandingMap)} />
    ),
    [outstandingMap]
  );

  function onFromDateChange(event, selected) {
    if (Platform.OS === "android") setShowFromPicker(false);
    if (selected) setFromDate(selected);
  }

  function onToDateChange(event, selected) {
    if (Platform.OS === "android") setShowToPicker(false);
    if (selected) setToDate(selected);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Customers</Text>
      {role === "admin" ? (
        <Pressable style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButtonText}>Add Customer</Text>
        </Pressable>
      ) : null}
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search customer"
      />
      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.filterLabel}>From Date</Text>
          <Pressable style={styles.dateInputBtn} onPress={() => setShowFromPicker(true)}>
            <Text style={styles.dateInputText}>{formatDateInput(fromDate)}</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.filterLabel}>To Date</Text>
          <Pressable style={styles.dateInputBtn} onPress={() => setShowToPicker(true)}>
            <Text style={styles.dateInputText}>{formatDateInput(toDate)}</Text>
          </Pressable>
        </View>
      </View>
      {showFromPicker ? (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display="default"
          onChange={onFromDateChange}
        />
      ) : null}
      {showToPicker ? (
        <DateTimePicker
          value={toDate}
          mode="date"
          display="default"
          onChange={onToDateChange}
        />
      ) : null}
      {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <FlatList
        data={visible}
        keyExtractor={keyExtractor}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={renderCustomerItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No customers found</Text> : null}
      />

      <Pressable style={styles.button} onPress={loadCustomers}>
        <Text style={styles.buttonText}>Reload</Text>
      </Pressable>

      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Customer</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Name *"
              />
              <TextInput
                style={styles.input}
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder="Phone"
              />
              <TextInput
                style={styles.input}
                value={addressInput}
                onChangeText={setAddressInput}
                placeholder="Address"
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.addButton} onPress={onAddCustomer}>
                <Text style={styles.addButtonText}>Save</Text>
              </Pressable>
              <Pressable
                style={[styles.addButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  resetCustomerForm();
                }}
              >
                <Text style={styles.addButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
    backgroundColor: "#f5f7fb",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  filterLabel: {
    color: "#4b5563",
    marginBottom: 4,
    fontSize: 12,
  },
  dateInputBtn: {
    backgroundColor: "#fff",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInputText: {
    color: "#111827",
    fontWeight: "600",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  success: {
    color: "#166534",
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
    flex: 1,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 8,
  },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  name: {
    fontWeight: "700",
    color: "#111827",
  },
  outstanding: {
    color: "#1f2937",
    fontWeight: "700",
  },
  outstandingWarn: {
    color: "#b91c1c",
  },
  meta: {
    color: "#374151",
  },
  empty: {
    textAlign: "center",
    marginTop: 16,
    color: "#6b7280",
  },
  button: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
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
  },
  modalTitle: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  cancelButton: {
    backgroundColor: "#6b7280",
  },
});
