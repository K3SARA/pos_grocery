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
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const ProductCard = React.memo(function ProductCard({ item }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.meta}>Barcode: {item.barcode}</Text>
      <Text style={styles.meta}>Price: {Number(item.price || 0)}</Text>
      <Text style={styles.meta}>Stock: {Number(item.stock || 0)}</Text>
    </View>
  );
});

export default function ProductsScreen() {
  const { role } = useAuth();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [invoicePrice, setInvoicePrice] = useState("");
  const [stock, setStock] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [supplierPaymentMethod, setSupplierPaymentMethod] = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date());
  const [showReceivedDatePicker, setShowReceivedDatePicker] = useState(false);
  const [invoicePhoto, setInvoicePhoto] = useState("");

  const loadProducts = useCallback(async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const data = await apiFetch("/products");
      const list = Array.isArray(data) ? data : data?.items || [];
      setProducts(list);
    } catch (e) {
      setError(e.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  }, [loadProducts]);

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const barcode = String(item.barcode || "").toLowerCase();
      return name.includes(q) || barcode.includes(q);
    });
  }, [products, query]);

  const keyExtractor = useCallback((item) => String(item.id || item.barcode), []);
  const renderProductItem = useCallback(({ item }) => <ProductCard item={item} />, []);

  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function resetProductForm() {
    setBarcode("");
    setName("");
    setPrice("");
    setInvoicePrice("");
    setStock("");
    setSupplierName("");
    setSupplierInvoiceNo("");
    setSupplierPaymentMethod("");
    setReceivedDate(new Date());
    setInvoicePhoto("");
  }

  async function onAddProduct() {
    const safeBarcode = String(barcode || "").trim();
    const safeName = String(name || "").trim();
    if (!safeBarcode || !safeName) {
      setError("Barcode and name are required");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify({
          barcode: safeBarcode,
          name: safeName,
          price: Number(price || 0),
          invoicePrice: invoicePrice !== "" ? Number(invoicePrice || 0) : null,
          stock: Number(stock || 0),
          supplierName: supplierName ? String(supplierName).trim() : null,
          supplierInvoiceNo: supplierInvoiceNo ? String(supplierInvoiceNo).trim() : null,
          supplierPaymentMethod: supplierPaymentMethod ? String(supplierPaymentMethod).trim() : null,
          receivedDate: receivedDate ? formatDateInput(receivedDate) : null,
          invoicePhoto: invoicePhoto ? String(invoicePhoto).trim() : null,
        }),
      });
      setMessage("Product added");
      setShowAddModal(false);
      resetProductForm();
      await loadProducts();
    } catch (e) {
      setError(e.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  }

  function onReceivedDateChange(event, selected) {
    if (Platform.OS === "android") setShowReceivedDatePicker(false);
    if (selected) setReceivedDate(selected);
  }

  async function pickInvoicePhotoFromCamera() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError("Camera permission is required");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return;
      const base64 = result.assets?.[0]?.base64 || "";
      const uri = result.assets?.[0]?.uri || "";
      if (base64) {
        setInvoicePhoto(`data:image/jpeg;base64,${base64}`);
      } else if (uri) {
        // Fallback if base64 is unavailable on some devices.
        setInvoicePhoto(uri);
      }
    } catch (e) {
      setError("Failed to open camera");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Products</Text>
      {role === "admin" ? (
        <Pressable style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButtonText}>Add Product</Text>
        </Pressable>
      ) : null}
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or barcode"
      />

      {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <FlatList
        data={visibleProducts}
        keyExtractor={keyExtractor}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={renderProductItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No products found</Text> : null}
      />

      <Pressable style={styles.reloadButton} onPress={loadProducts}>
        <Text style={styles.reloadText}>Reload</Text>
      </Pressable>

      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Product</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              <TextInput style={styles.input} value={barcode} onChangeText={setBarcode} placeholder="Barcode *" />
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name *" />
              <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="Price" keyboardType="numeric" />
              <TextInput
                style={styles.input}
                value={invoicePrice}
                onChangeText={setInvoicePrice}
                placeholder="Invoice Price"
                keyboardType="numeric"
              />
              <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="Stock" keyboardType="numeric" />
              <TextInput style={styles.input} value={supplierName} onChangeText={setSupplierName} placeholder="Supplier Name" />
              <TextInput style={styles.input} value={supplierInvoiceNo} onChangeText={setSupplierInvoiceNo} placeholder="Supplier Invoice No" />
              <Text style={styles.filterLabel}>Supplier Payment Method</Text>
              <View style={styles.methodRow}>
                {["cash", "credit", "cheque"].map((method) => (
                  <Pressable
                    key={method}
                    style={[
                      styles.methodChip,
                      supplierPaymentMethod === method && styles.methodChipActive,
                    ]}
                    onPress={() => setSupplierPaymentMethod(method)}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        supplierPaymentMethod === method && styles.methodTextActive,
                      ]}
                    >
                      {method}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.filterLabel}>Received Date</Text>
              <Pressable style={styles.dateInputBtn} onPress={() => setShowReceivedDatePicker(true)}>
                <Text style={styles.dateInputText}>{formatDateInput(receivedDate)}</Text>
              </Pressable>
              {showReceivedDatePicker ? (
                <DateTimePicker
                  value={receivedDate}
                  mode="date"
                  display="default"
                  onChange={onReceivedDateChange}
                />
              ) : null}
              <View style={styles.cameraRow}>
                <Pressable style={styles.cameraBtn} onPress={pickInvoicePhotoFromCamera}>
                  <Ionicons name="camera-outline" size={18} color="#ffffff" />
                  <Text style={styles.cameraBtnText}>Add Invoice Photo</Text>
                </Pressable>
              </View>
              {invoicePhoto ? <Text style={styles.photoText}>Photo: Captured</Text> : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.addButton} onPress={onAddProduct}>
                <Text style={styles.addButtonText}>Save</Text>
              </Pressable>
              <Pressable
                style={[styles.addButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  resetProductForm();
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
    backgroundColor: "#f5f7fb",
    padding: 14,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
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
    marginBottom: 10,
  },
  dateInputText: {
    color: "#111827",
    fontWeight: "600",
  },
  methodRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  methodChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  methodChipActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  methodText: {
    color: "#374151",
    fontWeight: "600",
  },
  methodTextActive: {
    color: "#fff",
  },
  cameraRow: {
    marginBottom: 10,
  },
  cameraBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  cameraBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  photoText: {
    color: "#166534",
    fontWeight: "600",
    marginBottom: 10,
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
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
  },
  name: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  meta: {
    color: "#374151",
  },
  empty: {
    textAlign: "center",
    marginTop: 16,
    color: "#6b7280",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  reloadButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  reloadText: {
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
    flex: 1,
  },
});
