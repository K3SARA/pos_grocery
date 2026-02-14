import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";

const OUT_PREFIX = "OUTSTANDING:";

function normalizeBarcode(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

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

function upsertOutstanding(notes, value) {
  const safe = Math.max(0, Number(value || 0));
  const text = String(notes || "");
  const lines = text
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => v && !v.toUpperCase().startsWith(OUT_PREFIX));
  return [`${OUT_PREFIX}${Math.round(safe)}`, ...lines].join("\n");
}

function buildReceiptText(receipt) {
  if (!receipt) return "";
  const lines = [
    "POS RECEIPT",
    `Date: ${receipt.date}`,
    `Customer: ${receipt.customerName || "-"}`,
    `Payment: ${receipt.paymentMethod}`,
    "------------------------",
  ];
  (receipt.items || []).forEach((item) => {
    const lineTotal = Number(item.qty || 0) * Number(item.price || 0);
    lines.push(`${item.name} (${item.barcode})`);
    lines.push(`  ${item.qty} x ${Math.round(Number(item.price || 0))} = ${Math.round(lineTotal)}`);
  });
  lines.push("------------------------");
  lines.push(`Subtotal: ${Math.round(receipt.subtotal)}`);
  lines.push(`Discount: ${Math.round(receipt.discount)}`);
  lines.push(`Bill Total: ${Math.round(receipt.total)}`);
  lines.push(`Cash Received: ${Math.round(receipt.cashReceived)}`);
  lines.push(`Outstanding: ${Math.round(receipt.outstanding)}`);
  lines.push(`Customer Outstanding Now: ${Math.round(receipt.customerOutstandingNow)}`);
  return lines.join("\n");
}

function CartRow({ item, onQtyChange, onRemove }) {
  const qty = Number(item.qty || 0);
  const price = Number(item.price || 0);
  const total = qty * price;

  return (
    <View style={styles.cartRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cartName}>{item.name}</Text>
        <Text style={styles.cartMeta}>Barcode: {item.barcode}</Text>
        <Text style={styles.cartMeta}>Price: {Math.round(price)}</Text>
      </View>
      <View style={styles.qtyBox}>
        <Pressable style={styles.qtyButton} onPress={() => onQtyChange(item.barcode, Math.max(1, qty - 1))}>
          <Text style={styles.qtyButtonText}>-</Text>
        </Pressable>
        <TextInput
          value={String(qty)}
          onChangeText={(v) => onQtyChange(item.barcode, Number(v || 0))}
          keyboardType="numeric"
          style={styles.qtyInput}
        />
        <Pressable style={styles.qtyButton} onPress={() => onQtyChange(item.barcode, qty + 1)}>
          <Text style={styles.qtyButtonText}>+</Text>
        </Pressable>
      </View>
      <View style={{ alignItems: "flex-end", width: 88 }}>
        <Text style={styles.rowTotal}>{Math.round(total)}</Text>
        <Pressable onPress={() => onRemove(item.barcode)}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CashierScreen() {
  const { username, role } = useAuth();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [outstandingMap, setOutstandingMap] = useState({});
  const [cart, setCart] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [query, setQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [showCustomerNameDropdown, setShowCustomerNameDropdown] = useState(false);
  const [showCustomerPhoneDropdown, setShowCustomerPhoneDropdown] = useState(false);
  const [selectedItemRow, setSelectedItemRow] = useState("");
  const [selectedCustomerRow, setSelectedCustomerRow] = useState("");
  const [selectedBrowseRow, setSelectedBrowseRow] = useState("");
  const [activeTouchRow, setActiveTouchRow] = useState("");
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [dayStarted, setDayStarted] = useState(false);
  const [dayRoute, setDayRoute] = useState("");
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeInput, setRouteInput] = useState("");
  const [routes, setRoutes] = useState([]);
  const [dayStatusLoading, setDayStatusLoading] = useState(true);
  const requiresStartDay = role === "cashier";
  const canUseCashierActions = !requiresStartDay || (dayStarted && !dayStatusLoading);


  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productsData, customersData, outstandingData] = await Promise.all([
        apiFetch("/products"),
        apiFetch("/customers"),
        apiFetch("/reports/customer-outstanding"),
      ]);
      const productList = Array.isArray(productsData) ? productsData : productsData?.items || [];
      setProducts(productList);
      setCustomers(Array.isArray(customersData) ? customersData : []);
      const map = {};
      (outstandingData?.rows || []).forEach((row) => {
        if (row?.customerId) {
          map[row.customerId] = Number(row.outstanding || 0);
        }
      });
      setOutstandingMap(map);
    } catch (e) {
      setError(e.message || "Failed to load cashier data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const loadDayStatus = useCallback(async () => {
    setDayStatusLoading(true);
    try {
      const [data, routeRows] = await Promise.all([
        apiFetch("/cashier/day/status"),
        apiFetch("/routes"),
      ]);
      setDayStarted(Boolean(data?.started));
      setDayRoute(String(data?.session?.route || ""));
      setRoutes(Array.isArray(routeRows) ? routeRows : []);
      setShowRouteModal(!Boolean(data?.started));
      if (data?.started) {
        setRouteInput(String(data?.session?.route || ""));
      } else {
        setRouteInput("");
      }
    } catch {
      setDayStarted(false);
      setDayRoute("");
      setRoutes([]);
      setShowRouteModal(true);
    } finally {
      setDayStatusLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!requiresStartDay) {
      setDayStarted(true);
      setShowRouteModal(false);
      setDayStatusLoading(false);
      return;
    }
    loadDayStatus();
  }, [loadDayStatus, requiresStartDay]);

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
    return products
      .filter((p) => Number(p.stock || 0) > 0)
      .filter((p) => {
        if (!q) return true;
        const name = String(p.name || "").toLowerCase();
        const code = String(p.barcode || "").toLowerCase();
        return code.includes(q) || name.includes(q);
      })
      .slice(0, 12);
  }, [products, barcode]);

  const customerNameSuggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (!q) return true;
        const name = String(c.name || "").toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 20);
  }, [customers, customerName]);

  const customerPhoneSuggestions = useMemo(() => {
    const q = customerPhone.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (!q) return true;
        const name = String(c.name || "").toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        return phone.includes(q) || name.includes(q);
      })
      .slice(0, 20);
  }, [customers, customerPhone]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const customerOutstandingNow = selectedCustomer
    ? Math.max(
        Number(outstandingMap[selectedCustomer.id] || 0),
        parseOutstanding(selectedCustomer.notes)
      )
    : 0;

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const value = Number(discountValue || 0);
    if (discountType === "amount") return Math.max(0, Math.min(value, subtotal));
    if (discountType === "percent") {
      const pct = Math.max(0, Math.min(value, 100));
      return (subtotal * pct) / 100;
    }
    return 0;
  }, [discountType, discountValue, subtotal]);

  const billTotal = Math.max(0, subtotal - discountAmount);
  const hasCashInput = String(cashReceived || "").trim().length > 0;
  const cashInputNumber = Number(cashReceived || 0);
  const normalizedCashReceived = Number.isFinite(cashInputNumber)
    ? Math.max(0, cashInputNumber)
    : paymentMethod === "cash" && !hasCashInput
      ? billTotal
      : 0;
  const saleOutstanding = paymentMethod === "credit" ? billTotal : Math.max(0, billTotal - normalizedCashReceived);
  const customerOutstandingAfterSale = Math.max(0, customerOutstandingNow + billTotal - normalizedCashReceived);

  function closeAllDropdowns() {
    setShowItemDropdown(false);
    setShowCustomerNameDropdown(false);
    setShowCustomerPhoneDropdown(false);
  }

  function getCartQty(code) {
    return cart.reduce((sum, item) => {
      if (item.barcode === code) return sum + Number(item.qty || 0);
      return sum;
    }, 0);
  }

  function ensureDayStartedForAction() {
    if (!requiresStartDay) return true;
    if (dayStarted) return true;
    setError("Tap Start Day and select route before billing.");
    setShowRouteModal(true);
    return false;
  }

  async function startDay() {
    const route = String(routeInput || "").trim();
    if (!route) {
      setError("Route is required");
      return;
    }
    const exists = routes.some((r) => String(r?.name || "") === route && Boolean(r?.isActive));
    if (!exists) {
      setError("Select a valid active route");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await apiFetch("/cashier/day/start", {
        method: "POST",
        body: JSON.stringify({ route }),
      });
      setDayStarted(true);
      setDayRoute(route);
      setShowRouteModal(false);
      setMessage(`Day started (${route})`);
    } catch (e) {
      setError(e.message || "Failed to start day");
    } finally {
      setLoading(false);
    }
  }

  async function endDay() {
    try {
      setLoading(true);
      setError("");
      await apiFetch("/cashier/day/end", { method: "POST" });
      setDayStarted(false);
      setDayRoute("");
      setRouteInput("");
      setShowRouteModal(true);
      setMessage("Day ended");
    } catch (e) {
      setError(e.message || "Failed to end day");
    } finally {
      setLoading(false);
    }
  }

  async function addToCartByBarcode(code) {
    if (!ensureDayStartedForAction()) return;
    const clean = normalizeBarcode(code);
    if (!clean) return;

    let product = products.find((p) => normalizeBarcode(p.barcode) === clean);
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
        // use not found error
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
    setShowItemDropdown(false);
  }

  function changeQty(code, nextQty) {
    if (!ensureDayStartedForAction()) return;
    const qty = Number(nextQty || 0);
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
    if (!ensureDayStartedForAction()) return;
    setCart((prev) => prev.filter((item) => item.barcode !== code));
  }

  function chooseCustomer(customer) {
    if (!ensureDayStartedForAction()) return;
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name || "");
    setCustomerPhone(customer.phone || "");
    setCustomerAddress(customer.address || "");
    setSelectedCustomerRow(String(customer.id));
    closeAllDropdowns();
  }

  async function updateCustomerOutstanding(newOutstanding) {
    if (!selectedCustomerId) return;
    const target = customers.find((c) => c.id === selectedCustomerId);
    if (!target) return;
    const nextNotes = upsertOutstanding(target.notes, newOutstanding);
    try {
      const updated = await apiFetch(`/customers/${selectedCustomerId}`, {
        method: "PUT",
        body: JSON.stringify({
          notes: nextNotes,
          name: target.name,
          phone: target.phone,
          address: target.address,
        }),
      });
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setOutstandingMap((prev) => ({ ...prev, [selectedCustomerId]: Number(newOutstanding || 0) }));
    } catch {
      // keep sale success even if notes update fails
    }
  }

  async function completeSale() {
    if (!ensureDayStartedForAction()) return;
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }

    if (paymentMethod === "cash" && normalizedCashReceived < billTotal && !selectedCustomerId && !customerName.trim()) {
      setError("Select customer for partial cash payments");
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
        cashReceived: paymentMethod === "cash" ? normalizedCashReceived : 0,
      };

      if (customerName.trim()) {
        payload.customer = {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: customerAddress.trim(),
        };
      }

      const saleResponse = await apiFetch("/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await updateCustomerOutstanding(customerOutstandingAfterSale);

      setLastReceipt({
        saleId: saleResponse?.sale?.id || "",
        date: new Date().toLocaleString(),
        items: cart,
        subtotal,
        discount: discountAmount,
        total: billTotal,
        paymentMethod,
        cashReceived: normalizedCashReceived,
        outstanding: saleOutstanding,
        customerOutstandingNow: customerOutstandingAfterSale,
        customerName,
      });
      setShowPrintPreview(true);

      setCart([]);
      setBarcode("");
      setQuery("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setSelectedCustomerId(null);
      setSelectedItemRow("");
      setSelectedCustomerRow("");
      setActiveTouchRow("");
      setShowItemDropdown(false);
      setShowCustomerNameDropdown(false);
      setShowCustomerPhoneDropdown(false);
      setDiscountType("none");
      setDiscountValue("");
      setPaymentMethod("cash");
      setCashReceived("");
      setMessage("Sale completed");
      await loadData();
    } catch (e) {
      setError(e.message || "Failed to complete sale");
    } finally {
      setLoading(false);
    }
  }

  async function onPrintReceipt() {
    try {
      await Share.share({ message: buildReceiptText(lastReceipt) });
    } catch {
      Alert.alert("Print", "Unable to open print/share dialog on this device.");
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Cashier | {username || "User"}</Text>
        {requiresStartDay ? (
          <View style={styles.dayBar}>
            <Text style={styles.dayStatusText}>
              {dayStatusLoading
                ? "Checking day status..."
                : dayStarted
                  ? `Day Started - Route: ${dayRoute || "-"}`
                  : "Day Not Started"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {!dayStarted ? (
                <Pressable style={styles.smallBtn} onPress={() => setShowRouteModal(true)}>
                  <Text style={styles.smallBtnText}>Start Day</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.smallBtn, styles.smallBtnDanger]}
                  onPress={endDay}
                >
                  <Text style={styles.smallBtnText}>End Day</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}
        {requiresStartDay && !dayStarted && !dayStatusLoading ? (
          <Text style={styles.dayWarn}>Cashier actions are locked until Start Day is completed.</Text>
        ) : null}
        {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <View style={[styles.panel, { zIndex: 20 }]}>
          <Text style={styles.panelTitle}>Add Item</Text>
          <View style={styles.inline}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={barcode}
              onChangeText={(v) => {
                setBarcode(v);
                setShowItemDropdown(true);
                setShowCustomerNameDropdown(false);
                setShowCustomerPhoneDropdown(false);
              }}
              onFocus={() => setShowItemDropdown(true)}
              onBlur={() => setTimeout(() => setShowItemDropdown(false), 120)}
              placeholder="Barcode"
              editable={canUseCashierActions}
            />
            <Pressable
              style={[styles.action, !canUseCashierActions && styles.btnDisabled]}
              onPress={() => void addToCartByBarcode(barcode)}
              disabled={!canUseCashierActions}
            >
              <Text style={styles.actionText}>Add</Text>
            </Pressable>
          </View>

          {showItemDropdown ? (
            <View style={styles.suggestBox}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="always"
                style={{ maxHeight: 240 }}
              >
                {barcodeSuggestions.length === 0 ? (
                  <Text style={styles.suggestEmpty}>No in-stock items found</Text>
                ) : (
                  barcodeSuggestions.map((item) => {
                    const key = String(item.id || item.barcode);
                    const inCartQty = getCartQty(item.barcode);
                    return (
                      <Pressable
                        key={key}
                        style={[
                          styles.suggestRow,
                          activeTouchRow === `item-${key}` && styles.suggestRowPressed,
                          selectedItemRow === key && styles.suggestRowSelected,
                        ]}
                        onPressIn={() => {
                          setActiveTouchRow(`item-${key}`);
                        }}
                        onPressOut={() => {
                          setActiveTouchRow("");
                        }}
                        onPress={() => {
                          setSelectedItemRow(key);
                          void addToCartByBarcode(item.barcode);
                        }}
                      >
                        <Text style={styles.listName}>{item.name}</Text>
                        <Text style={styles.listMeta}>
                          {item.barcode} | Stock: {Number(item.stock || 0)} | Price: {Number(item.price || 0)}
                          {inCartQty > 0 ? ` | In cart: ${inCartQty}` : ""}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search product"
            editable={canUseCashierActions}
          />
          <View style={styles.browseListWrap}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="always">
              {filteredProducts.map((item) => {
                const browseKey = `browse-${String(item.id || item.barcode)}`;
                return (
                  <Pressable
                    key={String(item.id || item.barcode)}
                    style={[
                      styles.listRow,
                      activeTouchRow === browseKey && styles.listRowPressed,
                      selectedBrowseRow === browseKey && styles.listRowSelected,
                    ]}
                    onPressIn={() => setActiveTouchRow(browseKey)}
                    onPressOut={() => setActiveTouchRow("")}
                    onPress={() => {
                      setSelectedBrowseRow(browseKey);
                      void addToCartByBarcode(item.barcode);
                    }}
                  >
                    <View>
                      <Text style={styles.listName}>{item.name}</Text>
                      <Text style={styles.listMeta}>
                        {item.barcode} | Stock: {Number(item.stock || 0)} | Price: {Number(item.price || 0)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={[styles.panel, { zIndex: 10 }]}>
          <Text style={styles.panelTitle}>Customer</Text>
          <TextInput
            style={styles.input}
            value={customerName}
            onChangeText={(v) => {
              setCustomerName(v);
              setSelectedCustomerId(null);
              setShowCustomerNameDropdown(true);
              setShowItemDropdown(false);
              setShowCustomerPhoneDropdown(false);
            }}
            onFocus={() => {
              setShowCustomerNameDropdown(true);
              setShowItemDropdown(false);
              setShowCustomerPhoneDropdown(false);
            }}
            onBlur={() => setTimeout(() => setShowCustomerNameDropdown(false), 120)}
            placeholder="Name (optional)"
            editable={canUseCashierActions}
          />
          {showCustomerNameDropdown ? (
            <View style={styles.suggestBox}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="always"
                style={{ maxHeight: 220 }}
              >
                {customerNameSuggestions.length === 0 ? (
                  <Text style={styles.suggestEmpty}>No customers found</Text>
                ) : (
                  customerNameSuggestions.map((customer) => (
                    <Pressable
                      key={customer.id}
                      style={[
                        styles.suggestRow,
                        activeTouchRow === `cname-${customer.id}` && styles.suggestRowPressed,
                        selectedCustomerRow === customer.id && styles.suggestRowSelected,
                      ]}
                      onPressIn={() => setActiveTouchRow(`cname-${customer.id}`)}
                      onPressOut={() => setActiveTouchRow("")}
                      onPress={() => chooseCustomer(customer)}
                    >
                      <Text style={styles.listName}>{customer.name}</Text>
                      <Text style={styles.listMeta}>{customer.phone || "-"} | {customer.address || "-"}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            value={customerPhone}
            onChangeText={(v) => {
              setCustomerPhone(v);
              setSelectedCustomerId(null);
              setShowCustomerPhoneDropdown(true);
              setShowItemDropdown(false);
              setShowCustomerNameDropdown(false);
            }}
            onFocus={() => {
              setShowCustomerPhoneDropdown(true);
              setShowItemDropdown(false);
              setShowCustomerNameDropdown(false);
            }}
            onBlur={() => setTimeout(() => setShowCustomerPhoneDropdown(false), 120)}
            placeholder="Phone"
            editable={canUseCashierActions}
          />
          {showCustomerPhoneDropdown ? (
            <View style={styles.suggestBox}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="always"
                style={{ maxHeight: 220 }}
              >
                {customerPhoneSuggestions.length === 0 ? (
                  <Text style={styles.suggestEmpty}>No customers found</Text>
                ) : (
                  customerPhoneSuggestions.map((customer) => (
                    <Pressable
                      key={customer.id}
                      style={[
                        styles.suggestRow,
                        activeTouchRow === `cphone-${customer.id}` && styles.suggestRowPressed,
                        selectedCustomerRow === customer.id && styles.suggestRowSelected,
                      ]}
                      onPressIn={() => setActiveTouchRow(`cphone-${customer.id}`)}
                      onPressOut={() => setActiveTouchRow("")}
                      onPress={() => chooseCustomer(customer)}
                    >
                      <Text style={styles.listName}>{customer.name}</Text>
                      <Text style={styles.listMeta}>{customer.phone || "-"} | {customer.address || "-"}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            value={customerAddress}
            onChangeText={setCustomerAddress}
            placeholder="Address"
            editable={canUseCashierActions}
          />
          <Text
            style={[
              styles.customerOutLine,
              customerOutstandingNow > 0 ? styles.customerOutLineWarn : null,
            ]}
          >
            Customer Outstanding: {Math.round(customerOutstandingNow)}
          </Text>
          <Text style={styles.customerOutLine}>After This Sale: {Math.round(customerOutstandingAfterSale)}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Cart</Text>
          {cart.length === 0 ? (
            <Text style={styles.empty}>Cart is empty</Text>
          ) : (
            cart.map((item) => (
              <CartRow
                key={String(item.barcode)}
                item={item}
                onQtyChange={changeQty}
                onRemove={removeItem}
              />
            ))
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Payment</Text>
          <Text style={styles.meta}>Payment method</Text>
          <View style={styles.inline}>
            {["cash", "card", "credit", "check"].map((method) => (
              <Pressable
                key={method}
                style={[
                  styles.methodChip,
                  paymentMethod === method && styles.methodChipActive,
                  !canUseCashierActions && styles.btnDisabled,
                ]}
                onPress={() => {
                  if (!ensureDayStartedForAction()) return;
                  setPaymentMethod(method);
                  if (method === "credit") setCashReceived("");
                }}
                disabled={!canUseCashierActions}
              >
                <Text style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}>{method}</Text>
              </Pressable>
            ))}
          </View>

          {paymentMethod !== "credit" ? (
            <>
              <Text style={[styles.meta, { marginTop: 8 }]}>Cash Received</Text>
              <TextInput
                style={styles.input}
                value={cashReceived}
                onChangeText={setCashReceived}
                placeholder="Enter received cash"
                keyboardType="numeric"
                editable={canUseCashierActions}
              />
            </>
          ) : null}

          <Text style={[styles.meta, { marginTop: 8 }]}>Discount</Text>
          <View style={styles.inline}>
            {["none", "amount", "percent"].map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.methodChip,
                  discountType === type && styles.methodChipActive,
                  !canUseCashierActions && styles.btnDisabled,
                ]}
                onPress={() => {
                  if (!ensureDayStartedForAction()) return;
                  setDiscountType(type);
                }}
                disabled={!canUseCashierActions}
              >
                <Text style={[styles.methodText, discountType === type && styles.methodTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={discountValue}
            onChangeText={setDiscountValue}
            editable={discountType !== "none" && canUseCashierActions}
            placeholder={discountType === "percent" ? "Percent" : "Amount"}
            keyboardType="numeric"
          />

          <Text style={styles.total}>Subtotal: {Math.round(subtotal)}</Text>
          <Text style={styles.total}>Discount: {Math.round(discountAmount)}</Text>
          <Text style={styles.grandTotal}>Bill Total: {Math.round(billTotal)}</Text>
          <Text style={styles.total}>Cash Received: {Math.round(normalizedCashReceived)}</Text>
          <Text style={styles.total}>This Sale Outstanding: {Math.round(saleOutstanding)}</Text>
          <Pressable
            style={[styles.completeButton, !canUseCashierActions && styles.btnDisabled]}
            onPress={completeSale}
            disabled={!canUseCashierActions}
          >
            <Text style={styles.completeText}>Complete Sale</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={requiresStartDay && showRouteModal} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Start Day</Text>
            <Text style={styles.meta}>Select Route (admin managed, required once per day)</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {routes.length === 0 ? (
                <Text style={styles.error}>No active routes. Ask admin to add routes.</Text>
              ) : (
                routes
                  .filter((r) => Boolean(r?.isActive))
                  .map((r) => {
                    const name = String(r?.name || "");
                    const active = routeInput === name;
                    return (
                      <Pressable
                        key={String(r?.id || name)}
                        style={[styles.methodChip, active && styles.methodChipActive]}
                        onPress={() => setRouteInput(name)}
                      >
                        <Text style={[styles.methodText, active && styles.methodTextActive]}>{name}</Text>
                      </Pressable>
                    );
                  })
              )}
            </View>
            {routeInput ? <Text style={styles.meta}>Selected Route: {routeInput}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.action, (!routeInput || routes.length === 0) && styles.btnDisabled]}
                onPress={startDay}
                disabled={!routeInput || routes.length === 0}
              >
                <Text style={styles.actionText}>Start Day</Text>
              </Pressable>
              <Pressable style={styles.closeBtn} onPress={() => setShowRouteModal(false)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </Pressable>
            </View>
            {!dayStarted ? (
              <Text style={[styles.meta, { marginTop: 8 }]}>Cashier actions stay locked until Start Day.</Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showPrintPreview} transparent animationType="fade" onRequestClose={() => setShowPrintPreview(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Print Preview</Text>
            <ScrollView style={styles.previewBox}>
              <Text style={styles.previewText}>{buildReceiptText(lastReceipt)}</Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.action} onPress={onPrintReceipt}>
                <Text style={styles.actionText}>Print</Text>
              </Pressable>
              <Pressable style={styles.closeBtn} onPress={() => setShowPrintPreview(false)}>
                <Text style={styles.closeBtnText}>Close</Text>
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
  dayBar: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  dayStatusText: {
    color: "#111827",
    fontWeight: "700",
    flexShrink: 1,
  },
  smallBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallBtnDanger: {
    backgroundColor: "#b91c1c",
  },
  smallBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  dayWarn: {
    color: "#b91c1c",
    marginBottom: 8,
    fontWeight: "600",
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
  btnDisabled: {
    opacity: 0.5,
  },
  suggestBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 8,
    overflow: "hidden",
    zIndex: 30,
  },
  suggestRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  suggestRowPressed: {
    backgroundColor: "#dbeafe",
    borderLeftColor: "#2563eb",
  },
  suggestRowSelected: {
    backgroundColor: "#bfdbfe",
    borderLeftColor: "#1d4ed8",
  },
  suggestEmpty: {
    padding: 10,
    color: "#6b7280",
  },
  listRow: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  listRowPressed: {
    backgroundColor: "#dbeafe",
    borderLeftColor: "#2563eb",
  },
  listRowSelected: {
    backgroundColor: "#bfdbfe",
    borderLeftColor: "#1d4ed8",
  },
  browseListWrap: {
    maxHeight: 260,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
  },
  listName: {
    fontWeight: "600",
    color: "#111827",
  },
  listMeta: {
    color: "#4b5563",
    fontSize: 12,
  },
  customerOutLine: {
    color: "#1f2937",
    fontWeight: "600",
    marginBottom: 4,
  },
  customerOutLineWarn: {
    color: "#b91c1c",
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
    gap: 6,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
  },
  qtyInput: {
    width: 44,
    height: 30,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    textAlign: "center",
    backgroundColor: "#fff",
    paddingVertical: 0,
  },
  qtyButtonText: {
    fontWeight: "700",
    color: "#111827",
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
    maxHeight: "80%",
  },
  modalTitle: {
    fontWeight: "700",
    fontSize: 18,
    color: "#111827",
    marginBottom: 8,
  },
  previewBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  previewText: {
    fontFamily: "monospace",
    color: "#111827",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  closeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  closeBtnText: {
    color: "#374151",
    fontWeight: "700",
  },
});
