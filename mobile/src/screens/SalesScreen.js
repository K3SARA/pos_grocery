import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { apiFetch } from "../api/client";

const SaleCard = React.memo(function SaleCard({ sale, onPress }) {
  const totalItems = (sale.saleItems || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const customer = sale.customer?.name || "-";
  const paymentMethod = sale.paymentMethod || "cash";
  const billTotal = Number(sale.total || 0);
  const cashReceived = Number(sale.cashReceived ?? (paymentMethod === "credit" ? 0 : billTotal));
  const outstanding = Number(sale.outstanding ?? (paymentMethod === "credit" ? billTotal : 0));

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.line}><Text style={styles.label}>Sale ID:</Text> {sale.id}</Text>
      <Text style={styles.line}><Text style={styles.label}>Date&time:</Text> {new Date(sale.createdAt).toLocaleString()}</Text>
      <Text style={styles.line}><Text style={styles.label}>Customer:</Text> {customer}</Text>
      <Text style={styles.line}><Text style={styles.label}>Payment:</Text> {paymentMethod}</Text>
      <Text style={styles.line}><Text style={styles.label}>Items:</Text> {totalItems}</Text>
      <Text style={styles.line}><Text style={styles.label}>Bill total:</Text> {Math.round(billTotal)}</Text>
      <Text style={styles.line}><Text style={styles.label}>Cash received:</Text> {Math.round(cashReceived)}</Text>
      <Text style={styles.line}><Text style={styles.label}>Outstanding:</Text> {Math.round(outstanding)}</Text>
    </Pressable>
  );
});

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildSaleDetailText(sale) {
  if (!sale) return "";
  const lines = [
    "SALE DETAILS",
    `Route: ${sale.route || "-"}`,
    `Sale ID: ${sale.id}`,
    `Date: ${new Date(sale.createdAt).toLocaleString()}`,
    "------------------------",
  ];
  (sale.saleItems || []).forEach((item) => {
    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);
    const lineBase = qty * price;
    const discountType = item.itemDiscountType || "none";
    const discountValue = Number(item.itemDiscountValue || 0);
    const lineNet = Math.max(0, lineBase - discountValue);
    lines.push(`${item.product?.name || item.barcode || "-"}`);
    lines.push(`  ${qty} x ${Math.round(price)} = ${Math.round(lineBase)}`);
    lines.push(`  Discount: ${discountType}${discountType !== "none" ? ` (${Math.round(discountValue)})` : ""}`);
    lines.push(`  Line Total: ${Math.round(lineNet)}`);
  });
  lines.push("------------------------");
  lines.push(`Bill Total: ${Math.round(Number(sale.total || 0))}`);
  lines.push(`Cash Received: ${Math.round(Number(sale.cashReceived || 0))}`);
  lines.push(`Outstanding: ${Math.round(Number(sale.outstanding || 0))}`);
  return lines.join("\n");
}

export default function SalesScreen() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const loadSales = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/sales");
      setSales(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load sales");
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSales();
    setRefreshing(false);
  }, [loadSales]);

  React.useEffect(() => {
    loadSales();
  }, [loadSales]);

  const sortedSales = useMemo(() => {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    return [...sales]
      .filter((s) => {
        const created = new Date(s.createdAt);
        return created >= from && created <= to;
      })
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  }, [sales, fromDate, toDate]);

  const keyExtractor = useCallback((item) => String(item.id), []);
  const renderSaleItem = useCallback(
    ({ item }) => <SaleCard sale={item} onPress={() => setSelectedSale(item)} />,
    []
  );

  function onFromDateChange(event, selected) {
    if (Platform.OS === "android") setShowFromPicker(false);
    if (selected) setFromDate(selected);
  }

  function onToDateChange(event, selected) {
    if (Platform.OS === "android") setShowToPicker(false);
    if (selected) setToDate(selected);
  }

  async function onPrintSaleDetails() {
    if (!selectedSale) return;
    try {
      await Share.share({ message: buildSaleDetailText(selectedSale) });
    } catch {
      // ignore share errors
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sales History</Text>
      <Text style={styles.subhead}>Sale ID | Date&time | Customer | Payment | Items | Bill total | Cash received | Outstanding</Text>
      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.filterLabel}>From Date</Text>
          <Pressable style={styles.filterInputBtn} onPress={() => setShowFromPicker(true)}>
            <Text style={styles.filterInputText}>{formatDateInput(fromDate)}</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.filterLabel}>To Date</Text>
          <Pressable style={styles.filterInputBtn} onPress={() => setShowToPicker(true)}>
            <Text style={styles.filterInputText}>{formatDateInput(toDate)}</Text>
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

      <FlatList
        data={sortedSales}
        keyExtractor={keyExtractor}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={renderSaleItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No sales yet</Text> : null}
      />

      <Pressable style={styles.button} onPress={loadSales}>
        <Text style={styles.buttonText}>Reload</Text>
      </Pressable>

      <Modal visible={Boolean(selectedSale)} transparent animationType="fade" onRequestClose={() => setSelectedSale(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sale Details</Text>
            {selectedSale ? (
              <>
                <Text style={styles.line}>
                  <Text style={styles.label}>Route:</Text> {selectedSale.route || "-"}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.label}>Sale ID:</Text> {selectedSale.id}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.label}>Date&time:</Text> {new Date(selectedSale.createdAt).toLocaleString()}
                </Text>
                <ScrollView style={styles.itemsBox}>
                  {(selectedSale.saleItems || []).map((item) => {
                    const qty = Number(item.qty || 0);
                    const price = Number(item.price || 0);
                    const lineBase = qty * price;
                    const discountType = item.itemDiscountType || "none";
                    const discountValue = Number(item.itemDiscountValue || 0);
                    const lineNet = Math.max(0, lineBase - discountValue);
                    return (
                      <View key={String(item.id)} style={styles.itemRow}>
                        <Text style={styles.itemName}>{item.product?.name || item.barcode || "-"}</Text>
                        <Text style={styles.itemMeta}>Barcode: {item.barcode || "-"}</Text>
                        <Text style={styles.itemMeta}>Qty: {qty} x Price: {Math.round(price)}</Text>
                        <Text style={styles.itemMeta}>
                          Discount: {discountType} {discountType !== "none" ? `(${Math.round(discountValue)})` : ""}
                        </Text>
                        <Text style={styles.itemMeta}>Line Total: {Math.round(lineNet)}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}
            <Pressable style={styles.button} onPress={() => setSelectedSale(null)}>
              <Text style={styles.buttonText}>Close</Text>
            </Pressable>
            <Pressable style={[styles.button, { marginTop: 8 }]} onPress={onPrintSaleDetails}>
              <Text style={styles.buttonText}>Print</Text>
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
    padding: 14,
    backgroundColor: "#f5f7fb",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subhead: {
    color: "#4b5563",
    marginBottom: 10,
    fontSize: 12,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  filterLabel: {
    color: "#4b5563",
    marginBottom: 4,
    fontSize: 12,
  },
  filterInputBtn: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  filterInputText: {
    color: "#111827",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 8,
  },
  line: {
    color: "#374151",
    marginBottom: 2,
  },
  label: {
    color: "#111827",
    fontWeight: "700",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
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
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  itemsBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 8,
    marginVertical: 8,
    maxHeight: 340,
  },
  itemRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 8,
  },
  itemName: {
    fontWeight: "700",
    color: "#111827",
  },
  itemMeta: {
    color: "#374151",
    fontSize: 12,
  },
});
