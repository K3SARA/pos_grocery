import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";
import { useNavigate } from "react-router-dom";
import { applyReceiptPrint, cleanupReceiptPrint } from "./printUtils";

export default function Returns({ onLogout }) {
  const [filterReason, setFilterReason] = useState("ALL"); // ALL | GOOD | DAMAGED | EXPIRED
  const navigate = useNavigate();

  const [saleId, setSaleId] = useState("");
  const [sale, setSale] = useState(null);

  const [reasonType, setReasonType] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewReturn, setViewReturn] = useState(null);
  const [viewErr, setViewErr] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editReturn, setEditReturn] = useState(null);
  const [editErr, setEditErr] = useState("");
  const [editType, setEditType] = useState("");
  const [editReason, setEditReason] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [salesList, setSalesList] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [showSalesDropdown, setShowSalesDropdown] = useState(false);
  const [saleSearch, setSaleSearch] = useState("");
  const [saleFrom, setSaleFrom] = useState("");
  const [saleTo, setSaleTo] = useState("");

  // Exchange flow
  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeItems, setExchangeItems] = useState([]);
  const [exchangeBarcode, setExchangeBarcode] = useState("");
  const [exchangeQty, setExchangeQty] = useState(1);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [exchangeResults, setExchangeResults] = useState([]);
  const [showExchangeDropdown, setShowExchangeDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [selected, setSelected] = useState({}); // { saleItemId: qty }
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [exchangeMsg, setExchangeMsg] = useState("");


  // ✅ returns list state MUST be here (top-level), not inside submitReturn
  const [returnsList, setReturnsList] = useState([]);

  const saleItems = sale?.saleItems || [];

  const styles = {
    page: {
      padding: 24,
      color: "var(--text)",
      background: "transparent",
      minHeight: "100vh",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    title: { margin: 0, fontSize: 22, fontWeight: 700 },
    row: { display: "flex", gap: 8, alignItems: "center" },
    btn: {
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid var(--border)",
      background: "var(--panel)",
      fontWeight: 600,
      cursor: "pointer",
    },
    btnPrimary: {
      padding: "10px 14px",
      borderRadius: 10,
      border: "1px solid var(--accent)",
      background: "var(--accent)",
      color: "#fff",
      fontWeight: 700,
      cursor: "pointer",
    },
    btnGhost: {
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid var(--border)",
      background: "transparent",
      fontWeight: 600,
      cursor: "pointer",
    },
    filters: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" },
    chip: (active) => ({
      padding: "6px 10px",
      borderRadius: 999,
      border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
      background: active ? "var(--accent)" : "var(--panel)",
      color: active ? "#fff" : "var(--text)",
      fontWeight: 600,
      cursor: "pointer",
    }),
    card: {
      padding: 12,
      border: "1px solid var(--border)",
      borderRadius: 12,
      background: "var(--panel)",
      marginBottom: 8,
      boxShadow: "var(--shadow)",
    },
    meta: { color: "var(--muted)", fontSize: 12 },
    input: {
      padding: 10,
      width: "100%",
      borderRadius: 10,
      border: "1px solid var(--border)",
      outline: "none",
      background: "var(--panel)",
      color: "#fff",
      height: 40,
    },
    sectionRow: {
      marginTop: 12,
      display: "grid",
      gridTemplateColumns: "minmax(240px, 1.6fr) 150px 150px auto auto",
      gap: 10,
      alignItems: "end",
    },
    dateInput: {
      padding: 8,
      height: 40,
      borderRadius: 8,
      border: "1px solid var(--border)",
    },
    panel: {
      marginTop: 16,
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: 14,
      background: "var(--panel)",
      boxShadow: "var(--shadow)",
    },
    subtleBox: {
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: 12,
      background: "#fbfaf7",
    },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      textAlign: "left",
      padding: 10,
      borderBottom: "1px solid #444",
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: "#000",
    },
    td: { padding: 10, borderBottom: "1px solid #444", color: "#000" },
    qtyInput: {
      width: 120,
      padding: 8,
      borderRadius: 8,
      border: "1px solid #e5e7eb",
    },
    reasonBtn: (active, tone) => ({
      padding: 10,
      borderRadius: 10,
      border: active ? "1px solid #111827" : "1px solid #e5e7eb",
      background: active ? tone : "#fff",
      fontWeight: 700,
      cursor: "pointer",
      flex: 1,
    }),
  };

  // Keep your current behavior: if GOOD -> restock true (auto)
  useEffect(() => {
    if (reasonType !== "OTHER") {
      setCustomReason("");
    }
  }, [reasonType]);

  // ✅ Load returns list
  const loadReturns = async () => {
    try {
      const data = await apiFetch("/returns");
      setReturnsList(Array.isArray(data) ? data : []);
    } catch (e) {
      // optional: keep silent
      // setMsg("❌ " + e.message);
    }
  };

  const loadSalesList = async () => {
    try {
      setSalesLoading(true);
      const data = await apiFetch("/sales");
      setSalesList(Array.isArray(data) ? data : []);
    } catch {
      setSalesList([]);
    } finally {
      setSalesLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setProductsLoading(true);
      const data = await apiFetch("/products");
      const list = Array.isArray(data) ? data : (data?.items || []);
      setProducts(list);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  // load once when page opens
  useEffect(() => {
    loadReturns();
  }, []);

  const runReceiptPrint = () => {
    applyReceiptPrint();
    const cleanup = () => {
      cleanupReceiptPrint();
      window.onafterprint = null;
    };
    window.onafterprint = cleanup;
    setTimeout(() => window.print(), 100);
  };

  // ✅ Filter buttons use this
  const filteredReturns = useMemo(() => {
    if (filterReason === "ALL") return returnsList;

    const key = String(filterReason).toUpperCase();

    // smart filter: matches "Damage" when filter is "DAMAGED"
    return returnsList.filter((r) => {
      const rr = String(r?.reason || "").toUpperCase();

      if (key === "DAMAGED") return rr.includes("DAMAGE") || rr.includes("DAMAGED");
      if (key === "EXPIRED") return rr.includes("EXPIRE") || rr.includes("EXPIRED");
      if (key === "GOOD") return rr.includes("GOOD");
      return rr === key;
    });
  }, [returnsList, filterReason]);

  const filteredReturnsByDate = useMemo(() => {
    const fromD = saleFrom ? new Date(saleFrom + "T00:00:00") : null;
    const toD = saleTo ? new Date(saleTo + "T23:59:59") : null;
    return filteredReturns.filter((r) => {
      if (!fromD && !toD) return true;
      if (!r.createdAt) return true;
      const d = new Date(r.createdAt);
      if (fromD && d < fromD) return false;
      if (toD && d > toD) return false;
      return true;
    });
  }, [filteredReturns, saleFrom, saleTo]);

  const filteredSales = useMemo(() => {
    const q = String(saleSearch || "").trim().toLowerCase();
    const fromD = saleFrom ? new Date(saleFrom + "T00:00:00") : null;
    const toD = saleTo ? new Date(saleTo + "T23:59:59") : null;

    return (salesList || []).filter((s) => {
      const idMatch = q ? String(s.id).includes(q) : true;
      const customerName = String(s.customer?.name || s.customerName || "").toLowerCase();
      const customerPhone = String(s.customer?.phone || s.customerPhone || "").toLowerCase();
      const customerMatch = q ? (customerName.includes(q) || customerPhone.includes(q)) : true;

      const itemMatch = q
        ? (s.saleItems || []).some((si) => {
            const name = String(si.product?.name || si.name || "").toLowerCase();
            const barcode = String(si.product?.barcode || si.barcode || "").toLowerCase();
            return name.includes(q) || barcode.includes(q);
          })
        : true;

      const dateOk = (() => {
        if (!fromD && !toD) return true;
        if (!s.createdAt) return true;
        const d = new Date(s.createdAt);
        if (fromD && d < fromD) return false;
        if (toD && d > toD) return false;
        return true;
      })();

      if (!q) return dateOk;
      return (idMatch || customerMatch || itemMatch) && dateOk;
    });
  }, [salesList, saleSearch, saleFrom, saleTo]);

  const exchangeTotal = useMemo(() => {
    return exchangeItems.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.qty || 0), 0);
  }, [exchangeItems]);

  const totalRefund = useMemo(() => {
    return saleItems.reduce((sum, si) => {
      const q = Number(selected[si.id] || 0);
      const price = Number(si.price || 0);
      return sum + q * price;
    }, 0);
  }, [saleItems, selected]);

  const netAmount = useMemo(() => {
    return exchangeTotal - totalRefund;
  }, [exchangeTotal, totalRefund]);

  const returnedByItem = useMemo(() => {
    const map = {};
    if (!sale?.id) return map;
    (returnsList || [])
      .filter((r) => Number(r.saleId) === Number(sale.id))
      .forEach((r) => {
        (r.items || []).forEach((it) => {
          const id = Number(it.saleItemId);
          if (!Number.isFinite(id)) return;
          map[id] = (map[id] || 0) + Number(it.qty || 0);
        });
      });
    return map;
  }, [returnsList, sale?.id]);

  const loadSale = async (overrideId) => {
    setMsg("");
    setSale(null);
    setSelected({});
    setReasonType("");
    setCustomReason("");

    const sid = Number(String((overrideId ?? saleId) || "").trim());
    if (!sid || sid < 1) {
      await loadReturns();
      setMsg("");
      return;
    }

    try {
      setLoading(true);
      const data = await apiFetch(`/sales/${sid}`);
      setSale(data);
      setMsg("✅ Sale loaded. Select items to return.");
    } catch (e) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const openView = async (returnId) => {
    setViewErr("");
    setViewOpen(true);
    setViewReturn(null);
    try {
      const data = await apiFetch(`/returns/${returnId}`);
      setViewReturn(data);
    } catch (e) {
      setViewErr("❌ " + e.message);
    }
  };

  const closeView = () => {
    setViewOpen(false);
    setViewReturn(null);
    setViewErr("");
  };

  const openEditReturn = async (returnId) => {
    setEditErr("");
    setEditOpen(true);
    setEditReturn(null);
    setEditType("");
    setEditReason("");
    try {
      const data = await apiFetch(`/returns/${returnId}`);
      setEditReturn(data);
      const reasonText = String(data?.reason || "");
      const rr = reasonText.toUpperCase();
      let type = "OTHER";
      if (rr.includes("DAMAGED") || rr.includes("DAMAGE") || rr.includes("EXPIRE") || rr.includes("EXPIRED")) {
        type = "DAMAGED_EXPIRED";
      } else if (rr.includes("GOOD")) {
        type = "GOOD";
      }
      setEditType(type);
      setEditReason(type === "OTHER" ? reasonText : "");
    } catch (e) {
      setEditErr("❌ " + e.message);
    }
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditReturn(null);
    setEditErr("");
    setEditType("");
    setEditReason("");
  };

  const saveEditReturn = async () => {
    if (!editReturn) return;
    if (!editType) {
      setEditErr("❌ Select a return type");
      return;
    }
    if (editType === "OTHER" && !String(editReason || "").trim()) {
      setEditErr("❌ Reason is required");
      return;
    }
    try {
      setSavingEdit(true);
      const res = await apiFetch(`/returns/${editReturn.id}`, {
        method: "PUT",
        body: JSON.stringify({
          returnType: editType,
          reason: editType === "OTHER" ? String(editReason).trim() : editType,
        }),
      });
      setEditReturn(res);
      await loadReturns();
      setEditErr("✅ Return updated");
    } catch (e) {
      setEditErr("❌ " + e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteReturn = async (returnId) => {
    const ok = window.confirm(`Delete return #${returnId}? This will revert stock changes.`);
    if (!ok) return;
    try {
      await apiFetch(`/returns/${returnId}`, { method: "DELETE" });
      await loadReturns();
      setMsg("✅ Return deleted");
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  const setQty = (saleItemId, qty) => {
    const q = Number(qty);
    if (!Number.isFinite(q) || q < 0) return;

    // limit to max sold qty
    const item = saleItems.find((x) => x.id === saleItemId);
    const returned = Number(returnedByItem[saleItemId] || 0);
    const max = Math.max(0, Number(item?.qty || 0) - returned);
    const safe = Math.min(q, max);

    setSelected((prev) => {
      const next = { ...prev }; // ✅ fixed typo
      if (!safe) delete next[saleItemId];
      else next[saleItemId] = safe;
      return next;
    });
  };

  const submitReturn = async () => {
    setMsg("");

    const sid = Number(String(saleId || "").trim());
    if (!sid || sid < 1) {
      setMsg("❌ Enter a valid Sale ID");
      return;
    }

    const items = Object.entries(selected)
      .map(([saleItemId, qty]) => ({ saleItemId: Number(saleItemId), qty: Number(qty) }))
      .filter((x) => x.qty > 0);

    if (items.length === 0) {
      setMsg("❌ Select at least 1 item to return");
      return;
    }

    for (const it of items) {
      const item = saleItems.find((x) => x.id === it.saleItemId);
      const returned = Number(returnedByItem[it.saleItemId] || 0);
      const max = Math.max(0, Number(item?.qty || 0) - returned);
      if (it.qty > max) {
        setMsg("❌ Return qty exceeds remaining qty");
        return;
      }
    }

    if (!reasonType) {
      setMsg("❌ Select a return type");
      return;
    }
    if (reasonType === "OTHER" && !String(customReason || "").trim()) {
      setMsg("❌ Reason is required");
      return;
    }

    try {
      setLoading(true);

      const res = await apiFetch("/returns", {
        method: "POST",
        body: JSON.stringify({
          saleId: sid,
          reason: reasonType === "OTHER" ? String(customReason).trim() : reasonType,
          returnType: reasonType,
          items,
        }),
      });

      setMsg(`✅ Return saved. Refund: Rs ${res?.totalRefund ?? totalRefund}`);

      // reload sale after return (optional)
      await loadSale();

      // ✅ refresh returns list so filters show new return instantly
      await loadReturns();
    } catch (e) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const addExchangeItem = async () => {
    const code = String(exchangeBarcode || "").trim();
    const q = Number(exchangeQty);
    if (!code || !Number.isFinite(q) || q <= 0) return;

    try {
      const product = await apiFetch(`/products/${code}`);
      setExchangeItems((prev) => {
        const existing = prev.find((p) => p.barcode === product.barcode);
        if (existing) {
          return prev.map((p) =>
            p.barcode === product.barcode ? { ...p, qty: p.qty + q } : p
          );
        }
        return [
          ...prev,
          {
            barcode: product.barcode,
            name: product.name,
            price: Number(product.price || 0),
            qty: q,
          },
        ];
      });
      setExchangeBarcode("");
      setExchangeQty(1);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
  };

  const filterExchangeItems = (text) => {
    const q = String(text || "").trim().toLowerCase();
    const available = (products || []).filter((p) => Number(p.stock || 0) > 0);
    if (!q) {
      setExchangeResults(available);
      setShowExchangeDropdown(true);
      return;
    }
    const filtered = available.filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const barcode = String(p.barcode || "").toLowerCase();
      return name.includes(q) || barcode.includes(q);
    });
    setExchangeResults(filtered);
    setShowExchangeDropdown(true);
  };

  const chooseExchangeItem = (p) => {
    setExchangeBarcode(p.barcode || "");
    setShowExchangeDropdown(false);
  };

  const removeExchangeItem = (code) => {
    setExchangeItems((prev) => prev.filter((p) => p.barcode !== code));
  };

  const changeExchangeQty = (code, newQty) => {
    const q = Number(newQty);
    if (!Number.isFinite(q) || q <= 0) return;
    setExchangeItems((prev) =>
      prev.map((p) => (p.barcode === code ? { ...p, qty: q } : p))
    );
  };

  const submitExchange = async () => {
    setExchangeMsg("");
    if (!reasonType) {
      setExchangeMsg("❌ Select a return type");
      return;
    }
    if (reasonType === "OTHER" && !String(customReason || "").trim()) {
      setExchangeMsg("❌ Reason is required");
      return;
    }
    if (!sale?.id) {
      setExchangeMsg("❌ Load a sale first");
      return;
    }
    if (exchangeItems.length === 0) {
      setExchangeMsg("❌ Add at least one exchange item");
      return;
    }

    try {
      setLoading(true);
      setMsg("");

      // 1) Save return
      await submitReturn();

      // 2) Create new sale for exchange items
      const customer = sale.customer
        ? { name: sale.customer.name, phone: sale.customer.phone, address: sale.customer.address }
        : sale.customerName
          ? { name: sale.customerName, phone: sale.customerPhone, address: sale.customerAddress }
          : null;

      const payload = {
        items: exchangeItems.map((i) => ({
          barcode: i.barcode,
          qty: i.qty,
          freeQty: 0,
          itemDiscountType: "none",
          itemDiscountValue: 0,
        })),
        paymentMethod,
        discountType: "none",
        discountValue: 0,
        ...(customer ? { customer } : {}),
      };

      await apiFetch("/sales", { method: "POST", body: JSON.stringify(payload) });

      setExchangeMsg(`✅ Exchange completed. Net: Rs ${netAmount}`);
      setExchangeItems([]);
      setExchangeBarcode("");
      setExchangeQty(1);
    } catch (e) {
      setExchangeMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>↩️ Returns</h2>
        <div style={styles.row}>
          <button onClick={() => navigate(-1)} style={styles.btnGhost}>Back</button>
          <button onClick={onLogout} style={styles.btn}>Logout</button>
        </div>
      </div>

      {/* ✅ Filter buttons */}
      <div style={styles.filters}>
        <button type="button" onClick={() => setFilterReason("ALL")} style={styles.chip(filterReason === "ALL")}>All</button>
        <button type="button" onClick={() => setFilterReason("GOOD")} style={styles.chip(filterReason === "GOOD")}>Good</button>
        <button type="button" onClick={() => setFilterReason("DAMAGED")} style={styles.chip(filterReason === "DAMAGED")}>Damaged</button>
        <button type="button" onClick={() => setFilterReason("EXPIRED")} style={styles.chip(filterReason === "EXPIRED")}>Expired</button>
      </div>

      <div style={styles.sectionRow}>
        <div style={{ position: "relative" }}>
          <input
            value={saleSearch}
            onChange={(e) => {
              setSaleSearch(e.target.value);
              if (!showSalesDropdown) setShowSalesDropdown(true);
            }}
            onFocus={() => {
              setShowSalesDropdown(true);
              if (salesList.length === 0) loadSalesList();
            }}
            onBlur={() => setTimeout(() => setShowSalesDropdown(false), 120)}
            placeholder="Search: ID, name, phone, item"
            style={styles.input}
          />
          {showSalesDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "#fff",
                color: "#000",
                border: "1px solid #ccc",
                borderTop: "none",
                maxHeight: 260,
                overflowY: "auto",
                zIndex: 9999,
                borderBottomLeftRadius: 10,
                borderBottomRightRadius: 10,
              }}
            >
              {salesLoading && (
                <div style={{ padding: 8, fontSize: 13, color: "#000" }}>Loading sales...</div>
              )}
              {!salesLoading && filteredSales.length === 0 && (
                <div style={{ padding: 8, fontSize: 13, color: "#000" }}>No sales found</div>
              )}
              {!salesLoading &&
                filteredSales.map((s) => (
                  <div
                    key={s.id}
                    onMouseDown={() => {
                      setSaleId(String(s.id));
                      setSaleSearch(String(s.id));
                      setShowSalesDropdown(false);
                      loadSale(s.id);
                    }}
                    style={{
                      padding: 10,
                      cursor: "pointer",
                      borderTop: "1px solid #eee",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>Sale #{s.id}</div>
                    <div style={{ fontSize: 12, color: "#000" }}>
                      {new Date(s.createdAt).toLocaleString()} • {s.customer?.name || s.customerName || "Walk-in"} • Rs {s.total}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#555" }}>From</div>
          <input
            type="date"
            value={saleFrom}
            onChange={(e) => setSaleFrom(e.target.value)}
            style={styles.dateInput}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#555" }}>To</div>
          <input
            type="date"
            value={saleTo}
            onChange={(e) => setSaleTo(e.target.value)}
            style={styles.dateInput}
          />
        </div>
        <button onClick={loadSale} disabled={loading} style={styles.btnPrimary}>
          Load Sale
        </button>

        <div style={{ fontWeight: 700, paddingBottom: 6 }}>Return Type</div>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      {sale && (
        <div style={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div><b>Sale ID:</b> {sale.id}</div>
              <div>
                <b>Customer:</b>{" "}
                {sale.customer?.name || sale.customerName || "Walk-in"}
              </div>
              <div>
                <b>Phone:</b>{" "}
                {sale.customer?.phone || sale.customerPhone || "-"}
              </div>
              <div>
                <b>Address:</b>{" "}
                {sale.customer?.address || sale.customerAddress || "-"}
              </div>
              <div><b>Date:</b> {new Date(sale.createdAt).toLocaleString()}</div>
              <div><b>Total:</b> Rs {sale.total}</div>
            </div>
            <div style={{ minWidth: 260 }}>
              <div style={{ marginBottom: 8 }}>
                <label><b>Reason</b></label>
                <input
                  value={reasonType === "OTHER" ? customReason : reasonType}
                  onChange={(e) => setCustomReason(e.target.value)}
                  disabled={reasonType !== "OTHER"}
                  placeholder={reasonType === "OTHER" ? "Enter reason" : "Select Other to type"}
                  style={{ width: "100%", padding: 10, marginTop: 5, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: 16 }}>Select items to return</h3>

          <div style={styles.subtleBox}>
            <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Item</th>
                <th style={{ ...styles.th, width: 120 }}>Sold Qty</th>
                <th style={{ ...styles.th, width: 140 }}>Returned Qty</th>
                <th style={{ ...styles.th, width: 140 }}>Price</th>
                <th style={{ ...styles.th, width: 160 }}>Return Qty</th>
              </tr>
            </thead>
            <tbody>
              {saleItems.map((si) => (
                <tr key={si.id}>
                  <td style={styles.td}>
                    <div><b>{si.product?.name || "Item"}</b></div>
                    <div style={styles.meta}>Barcode: {si.product?.barcode}</div>
                  </td>
                  <td style={styles.td}>{si.qty}</td>
                  <td style={styles.td}>{returnedByItem[si.id] || 0}</td>
                  <td style={styles.td}>{si.price}</td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      min="0"
                      max={Math.max(0, Number(si.qty || 0) - Number(returnedByItem[si.id] || 0))}
                      value={selected[si.id] || ""}
                      onChange={(e) => setQty(si.id, e.target.value)}
                      placeholder="0"
                      style={styles.qtyInput}
                    />
                    <div style={styles.meta}>
                      Max: {Math.max(0, Number(si.qty || 0) - Number(returnedByItem[si.id] || 0))}
                    </div>
                  </td>
                </tr>
              ))}

              {saleItems.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: 12 }}>No items found</td>
                </tr>
              )}
            </tbody>
            </table>
          </div>

          <h3>Return Reason</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              marginBottom: 12,
            }}
          >
            {[
              { label: "Good", type: "GOOD", color: "#e2e8f0" },
              { label: "Damaged / Expired", type: "DAMAGED_EXPIRED", color: "#fee2e2" },
              { label: "Other", type: "OTHER", color: "#ffedd5" },
            ].map((r) => (
              <button
                key={r.type}
                type="button"
                onClick={() => setReasonType(r.type)}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: reasonType === r.type ? "1px solid #111827" : "1px solid #e5e7eb",
                  background: reasonType === r.type ? "#111827" : "#fff",
                  color: reasonType === r.type ? "#fff" : "#111827",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16 }}>
            <b>Refund Total:</b> Rs {totalRefund}
          </div>

          {!exchangeMode && (
            <button onClick={submitReturn} disabled={loading} style={styles.btnPrimary}>
              Save Return
            </button>
          )}
        </div>

        <div style={{ marginTop: 16, borderTop: "1px dashed #ddd", paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={exchangeMode}
                onChange={(e) => {
                  setExchangeMode(e.target.checked);
                  if (e.target.checked && products.length === 0) loadProducts();
                }}
              />
              Exchange (return + buy another item)
            </label>
            {exchangeMode && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit</option>
                  <option value="check">Check</option>
                </select>
              </div>
            )}
          </div>

          {exchangeMode && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: "1 1 220px" }}>
                  <input
                    value={exchangeBarcode}
                    placeholder="Exchange item barcode"
                    style={styles.input}
                    onFocus={() => {
                      if (products.length === 0) loadProducts();
                      filterExchangeItems(exchangeBarcode);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addExchangeItem();
                    }}
                    onChange={(e) => {
                      const v = e.target.value;
                      setExchangeBarcode(v);
                      if (products.length === 0) {
                        loadProducts();
                        setExchangeResults([]);
                        setShowExchangeDropdown(true);
                      } else {
                        filterExchangeItems(v);
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowExchangeDropdown(false), 120)}
                  />
                  {showExchangeDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: 44,
                        left: 0,
                        right: 0,
                        background: "#fff",
                        color: "#000",
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                        zIndex: 20,
                        maxHeight: 260,
                        overflowY: "auto",
                      }}
                    >
                      {productsLoading ? (
                        <div style={{ padding: 10 }}>Searching...</div>
                      ) : (exchangeResults || []).length === 0 ? (
                        <div style={{ padding: 10 }}>No items found</div>
                      ) : (
                        exchangeResults.map((p) => (
                          <div
                            key={`ex-${p.barcode}`}
                            onMouseDown={() => chooseExchangeItem(p)}
                            style={{
                              padding: 10,
                              cursor: "pointer",
                              borderTop: "1px solid #eee",
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>{p.name}</div>
                            <div style={{ fontSize: 12 }}>
                              {p.barcode} • Price: {p.price} • Stock: {p.stock}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  value={exchangeQty}
                  onChange={(e) => setExchangeQty(e.target.value)}
                  style={{ padding: 8, width: 90, borderRadius: 8, border: "1px solid var(--border)" }}
                />
                <button onClick={addExchangeItem} style={styles.btnPrimary} disabled={productsLoading}>
                  Add Item
                </button>
              </div>

              {exchangeItems.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Item</th>
                        <th style={{ ...styles.th, width: 120 }}>Qty</th>
                        <th style={{ ...styles.th, width: 140 }}>Price</th>
                        <th style={{ ...styles.th, width: 140 }}>Total</th>
                        <th style={{ ...styles.th, width: 120 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exchangeItems.map((i) => (
                        <tr key={i.barcode}>
                          <td style={styles.td}>{i.name}</td>
                          <td style={styles.td}>
                            <input
                              type="number"
                              min="1"
                              value={i.qty}
                              onChange={(e) => changeExchangeQty(i.barcode, e.target.value)}
                              style={styles.qtyInput}
                            />
                          </td>
                          <td style={styles.td}>{i.price}</td>
                          <td style={styles.td}>{Number(i.price) * Number(i.qty)}</td>
                          <td style={styles.td}>
                            <button onClick={() => removeExchangeItem(i.barcode)} style={styles.btnGhost}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div><b>Exchange Total:</b> Rs {exchangeTotal}</div>
                <div><b>Refund:</b> Rs {totalRefund}</div>
                <div><b>Net:</b> Rs {netAmount}</div>
              </div>

              <div style={{ marginTop: 10 }}>
                <button onClick={submitExchange} disabled={loading} style={styles.btnPrimary}>
                  Complete Exchange
                </button>
                {exchangeMsg && (
                  <div style={{ marginTop: 8, color: exchangeMsg.startsWith("✅") ? "#16a34a" : "#ff6b6b" }}>
                    {exchangeMsg}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {viewOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={closeView}
        >
          <div
            style={{
              background: "var(--panel)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              width: "min(520px, 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Return Bill</h3>
              <button onClick={closeView} style={styles.btnGhost}>✕</button>
            </div>

            {viewErr && <p style={{ color: "#ff6b6b" }}>{viewErr}</p>}

            {!viewReturn ? (
              <p>Loading return...</p>
            ) : (
              <div id="print-area" className="receipt" style={{ background: "#fff", color: "#000", padding: 10, borderRadius: 8 }}>
                <div className="center bold title">Return Receipt</div>
                <div className="center small">Sale #{viewReturn.saleId}</div>
                <div className="hr" />
                <div className="row">
                  <span>Return:</span><span>#{viewReturn.id}</span>
                </div>
                <div className="row">
                  <span>Date:</span><span>{new Date(viewReturn.createdAt).toLocaleString()}</span>
                </div>
                {(viewReturn.sale?.customer || viewReturn.sale?.customerId) && (
                  <>
                    <div className="row">
                      <span>Customer:</span><span>{viewReturn.sale?.customer?.name || viewReturn.sale?.customerName || "-"}</span>
                    </div>
                    <div className="row">
                      <span>Phone:</span><span>{viewReturn.sale?.customer?.phone || viewReturn.sale?.customerPhone || "-"}</span>
                    </div>
                    <div className="row">
                      <span>Address:</span><span>{viewReturn.sale?.customer?.address || viewReturn.sale?.customerAddress || "-"}</span>
                    </div>
                  </>
                )}
                <div className="row">
                  <span>Reason:</span><span>{viewReturn.reason}</span>
                </div>
                <div className="hr" />
                <div className="bold">Items</div>
                {(viewReturn.items || []).map((it) => (
                  <div key={it.id} className="item">
                    <div className="itemName">{it.product?.name || "Item"}</div>
                    <div className="row">
                      <span>{it.qty} x {Number(it.price || 0).toFixed(2)}</span>
                      <span>{(Number(it.price || 0) * Number(it.qty || 0)).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                <div className="hr" />
                <div className="row bold">
                  <span>Refund</span>
                  <span>{Number(viewReturn.totalRefund || 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={runReceiptPrint} style={styles.btnPrimary}>Print Bill</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Returns list (filtered) */}
      {filteredReturnsByDate.map((r) => (
        <div key={r.id} style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div><b>Return #{r.id}</b> (Sale #{r.saleId})</div>
              <div style={styles.meta}>Reason: {r.reason}</div>
              <div style={styles.meta}>Refund: Rs {r.totalRefund}</div>
              <div style={styles.meta}>Date: {new Date(r.createdAt).toLocaleString()}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => openView(r.id)} style={styles.btn}>View</button>
              <button onClick={() => openEditReturn(r.id)} style={styles.btn}>Edit</button>
              <button
                onClick={() => deleteReturn(r.id)}
                style={{ ...styles.btn, background: "#fee2e2", color: "#991b1b", border: "1px solid #991b1b" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}

      {editOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={closeEdit}
        >
          <div
            style={{
              background: "var(--panel)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              width: "min(520px, 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Edit Return</h3>
              <button onClick={closeEdit} style={styles.btnGhost}>✕</button>
            </div>

            {editErr && <p style={{ color: editErr.startsWith("✅") ? "#16a34a" : "#ff6b6b" }}>{editErr}</p>}

            {!editReturn ? (
              <p>Loading return...</p>
            ) : (
              <>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Return #{editReturn.id}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Sale #{editReturn.saleId}</div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setEditType("GOOD")}
                    style={styles.reasonBtn(editType === "GOOD", "#e2e8f0")}
                  >
                    ✅ Good
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType("DAMAGED_EXPIRED")}
                    style={styles.reasonBtn(editType === "DAMAGED_EXPIRED", "#fee2e2")}
                  >
                    ⚠️ Damaged / Expired
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType("OTHER")}
                    style={styles.reasonBtn(editType === "OTHER", "#ffedd5")}
                  >
                    ✍️ Other
                  </button>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label><b>Reason</b></label>
                  <input
                    value={editType === "OTHER" ? editReason : editType}
                    onChange={(e) => setEditReason(e.target.value)}
                    disabled={editType !== "OTHER"}
                    placeholder={editType === "OTHER" ? "Enter reason" : "Select Other to type"}
                    style={{ width: "100%", padding: 10, marginTop: 5, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <button onClick={closeEdit} style={styles.btnGhost}>Cancel</button>
                  <button onClick={saveEditReturn} disabled={savingEdit} style={styles.btnPrimary}>
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

