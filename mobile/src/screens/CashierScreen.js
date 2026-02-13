import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch } from "../api/client";

function CartRow({ item, onQtyChange, onRemove }) {
  const qty = Number(item.qty || 0);
  const price = Number(item.price || 0);
  const total = qty * price;

  return (
    <View style={styles.cartRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cartName}>{item.name}</Text>
        <Text style={styles.cartMeta}>Barcode: {item.barcode}</Text>
        <Text style={styles.cartMeta}>Price: {price}</Text>
      </View>
      <View style={styles.qtyBox}>
        <Pressable style={styles.qtyButton} onPress={() => onQtyChange(item.barcode, Math.max(1, qty - 1))}>
          <Text style={styles.qtyButtonText}>-</Text>
        </Pressable>
        <Text style={styles.qtyValue}>{qty}</Text>
        <Pressable style={styles.qtyButton} onPress={() => onQtyChange(item.barcode, qty + 1)}>
          <Text style={styles.qtyButtonText}>+</Text>
        </Pressable>
      </View>
      <View style={{ alignItems: "flex-end", width: 84 }}>
        <Text style={styles.rowTotal}>{Math.round(total)}</Text>
        <Pressable onPress={() => onRemove(item.barcode)}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CashierScreen() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [query, setQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productsData, customersData] = await Promise.all([
        apiFetch("/products"),
        apiFetch("/customers"),
      ]);
      const productList = Array.isArray(productsData) ? productsData : productsData?.items || [];
      setProducts(productList);
      setCustomers(Array.isArray(customersData) ? customersData : []);
    } catch (e) {
      setError(e.message || "Failed to load cashier data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 25);
    return products
      .filter((p) => {
        const name = String(p.name || "").toLowerCase();
        const code = String(p.barcode || "").toLowerCase();
        return name.includes(q) || code.includes(q);
      })
      .slice(0, 25);
  }, [products, query]);

  const barcodeSuggestions = useMemo(() => {
    const q = barcode.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => {
        const name = String(p.name || "").toLowerCase();
        const code = String(p.barcode || "").toLowerCase();
        return code.includes(q) || name.includes(q);
      })
      .slice(0, 8);
  }, [products, barcode]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const value = Number(discountValue || 0);
    if (discountType === "amount") {
      return Math.max(0, Math.min(value, subtotal));
    }
    if (discountType === "percent") {
      const pct = Math.max(0, Math.min(value, 100));
      return (subtotal * pct) / 100;
    }
    return 0;
  }, [discountType, discountValue, subtotal]);

  const total = Math.max(0, subtotal - discountAmount);

  function normalizeBarcode(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function getCartQty(code) {
    return cart.reduce((sum, item) => {
      if (item.barcode === code) return sum + Number(item.qty || 0);
      return sum;
    }, 0);
  }

  async function addToCartByBarcode(code) {
    const clean = normalizeBarcode(code);
    if (!clean) return;

    let product = products.find((p) => normalizeBarcode(p.barcode) === clean);

    // Fallback: fetch directly from backend in case local list is stale.
    if (!product) {
      try {
        const exactCode = String(code || "").trim().replace(/\s+/g, "");
        const fetched = await apiFetch(`/products/${encodeURIComponent(exactCode)}`);
        if (fetched?.barcode) {
          product = fetched;
          setProducts((prev) => {
            const exists = prev.some((p) => normalizeBarcode(p.barcode) === normalizeBarcode(fetched.barcode));
            return exists ? prev : [fetched, ...prev];
          });
        }
      } catch {
        // keep default not-found error below
      }
    }

    if (!product) {
      setError("Product not found");
      return;
    }

    const inCartQty = getCartQty(product.barcode);
    if (Number(product.stock || 0) <= inCartQty) {
      setError("Out of stock");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.barcode === product.barcode);
      if (existing) {
        return prev.map((item) =>
          item.barcode === product.barcode ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
    setBarcode("");
    setError("");
  }

  function changeQty(code, nextQty) {
    const qty = Number(nextQty || 1);
    if (!Number.isFinite(qty) || qty < 1) return;
    const product = products.find((p) => p.barcode === code);
    const stock = Number(product?.stock || 0);
    if (qty > stock) {
      setError(`Only ${stock} available for ${code}`);
      return;
    }
    setCart((prev) => prev.map((item) => (item.barcode === code ? { ...item, qty } : item)));
  }

  function removeItem(code) {
    setCart((prev) => prev.filter((item) => item.barcode !== code));
  }

  function useCustomer(customer) {
    setCustomerName(customer.name || "");
    setCustomerPhone(customer.phone || "");
    setCustomerAddress(customer.address || "");
  }

  async function completeSale() {
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        items: cart.map((item) => ({
          barcode: item.barcode,
          qty: Number(item.qty || 0),
        })),
        paymentMethod,
        discountType,
        discountValue: Number(discountValue || 0),
      };

      if (customerName.trim()) {
        payload.customer = {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: customerAddress.trim(),
        };
      }

      await apiFetch("/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCart([]);
      setDiscountType("none");
      setDiscountValue("");
      setPaymentMethod("cash");
      setMessage("Sale completed");
      await loadData();
    } catch (e) {
      setError(e.message || "Failed to complete sale");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 16 }}>
      <Text style={styles.heading}>Cashier</Text>
      {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Add Item</Text>
        <View style={styles.inline}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={barcode}
            onChangeText={setBarcode}
            placeholder="Barcode"
          />
          <Pressable style={styles.action} onPress={() => void addToCartByBarcode(barcode)}>
            <Text style={styles.actionText}>Add</Text>
          </Pressable>
        </View>
        {barcodeSuggestions.length > 0 ? (
          <View style={styles.suggestBox}>
            {barcodeSuggestions.map((item) => {
              const inCartQty = getCartQty(item.barcode);
              return (
                <Pressable
                  key={String(item.id || item.barcode)}
                  style={styles.suggestRow}
                  onPress={() => void addToCartByBarcode(item.barcode)}
                >
                  <Text style={styles.listName}>{item.name}</Text>
                  <Text style={styles.listMeta}>
                    {item.barcode} | Stock: {Number(item.stock || 0)} | Price: {Number(item.price || 0)}
                    {inCartQty > 0 ? ` | In cart: ${inCartQty}` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search product"
        />
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => String(item.id || item.barcode)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Pressable style={styles.listRow} onPress={() => void addToCartByBarcode(item.barcode)}>
              <View>
                <Text style={styles.listName}>{item.name}</Text>
                <Text style={styles.listMeta}>
                  {item.barcode} | Stock: {Number(item.stock || 0)} | Price: {Number(item.price || 0)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Customer</Text>
        <TextInput style={styles.input} value={customerName} onChangeText={setCustomerName} placeholder="Name (optional)" />
        <TextInput style={styles.input} value={customerPhone} onChangeText={setCustomerPhone} placeholder="Phone" />
        <TextInput style={styles.input} value={customerAddress} onChangeText={setCustomerAddress} placeholder="Address" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.customerStrip}>
            {customers.slice(0, 12).map((customer) => (
              <Pressable key={customer.id} style={styles.customerChip} onPress={() => useCustomer(customer)}>
                <Text style={styles.customerChipText}>{customer.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Cart</Text>
        <FlatList
          data={cart}
          keyExtractor={(item) => String(item.barcode)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <CartRow item={item} onQtyChange={changeQty} onRemove={removeItem} />
          )}
          ListEmptyComponent={<Text style={styles.empty}>Cart is empty</Text>}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Payment</Text>
        <Text style={styles.meta}>Payment method</Text>
        <View style={styles.inline}>
          {["cash", "card", "credit", "check"].map((method) => (
            <Pressable
              key={method}
              style={[styles.methodChip, paymentMethod === method && styles.methodChipActive]}
              onPress={() => setPaymentMethod(method)}
            >
              <Text style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}>{method}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.meta, { marginTop: 8 }]}>Discount</Text>
        <View style={styles.inline}>
          {["none", "amount", "percent"].map((type) => (
            <Pressable
              key={type}
              style={[styles.methodChip, discountType === type && styles.methodChipActive]}
              onPress={() => setDiscountType(type)}
            >
              <Text style={[styles.methodText, discountType === type && styles.methodTextActive]}>{type}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={discountValue}
          onChangeText={setDiscountValue}
          editable={discountType !== "none"}
          placeholder={discountType === "percent" ? "Percent" : "Amount"}
          keyboardType="numeric"
        />

        <Text style={styles.total}>Subtotal: {Math.round(subtotal)}</Text>
        <Text style={styles.total}>Discount: {Math.round(discountAmount)}</Text>
        <Text style={styles.grandTotal}>Grand Total: {Math.round(total)}</Text>
        <Pressable style={styles.completeButton} onPress={completeSale}>
          <Text style={styles.completeText}>Complete Sale</Text>
        </Pressable>
      </View>
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
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  panelTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: "#111827",
    marginBottom: 8,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
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
  action: {
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: {
    color: "#fff",
    fontWeight: "700",
  },
  suggestBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 8,
    overflow: "hidden",
  },
  suggestRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
  },
  listRow: {
    paddingVertical: 8,
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
  },
  listName: {
    fontWeight: "600",
    color: "#111827",
  },
  listMeta: {
    color: "#4b5563",
    fontSize: 12,
  },
  customerStrip: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  customerChip: {
    backgroundColor: "#eef2ff",
    borderColor: "#c7d2fe",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  customerChipText: {
    color: "#3730a3",
    fontWeight: "600",
  },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cartName: {
    fontWeight: "700",
    color: "#111827",
  },
  cartMeta: {
    color: "#4b5563",
    fontSize: 12,
  },
  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
  },
  qtyButtonText: {
    fontWeight: "700",
    color: "#111827",
  },
  qtyValue: {
    minWidth: 20,
    textAlign: "center",
    fontWeight: "700",
  },
  rowTotal: {
    fontWeight: "700",
    color: "#111827",
  },
  remove: {
    color: "#b91c1c",
    fontSize: 12,
    marginTop: 2,
  },
  methodChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  meta: {
    color: "#4b5563",
    marginBottom: 6,
  },
  total: {
    color: "#111827",
    fontWeight: "600",
  },
  grandTotal: {
    marginTop: 4,
    color: "#111827",
    fontWeight: "700",
    fontSize: 17,
  },
  completeButton: {
    marginTop: 10,
    backgroundColor: "#15803d",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  completeText: {
    color: "#fff",
    fontWeight: "700",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  success: {
    color: "#166534",
    marginBottom: 8,
  },
  empty: {
    color: "#6b7280",
  },
});
