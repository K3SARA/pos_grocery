import React, { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";
import { apiFetch, getRole } from "./api";
import ReceiptPrint from "./ReceiptPrint";


function formatDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export default function Reports() {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [outstandingLoading, setOutstandingLoading] = useState(false);
  const role = getRole();

const [editOpen, setEditOpen] = useState(false);
const [editSale, setEditSale] = useState(null); // loaded sale
const [editMap, setEditMap] = useState({});     // { saleItemId: { qty, itemDiscountType, itemDiscountValue } }
const [editErr, setEditErr] = useState("");
const [editDiscountType, setEditDiscountType] = useState("none");
const [editDiscountValue, setEditDiscountValue] = useState("");
const [editPaymentMethod, setEditPaymentMethod] = useState("cash");
const [viewOpen, setViewOpen] = useState(false);
const [viewSale, setViewSale] = useState(null);
const [viewErr, setViewErr] = useState("");
const [viewPrintPrompt, setViewPrintPrompt] = useState(false);
const [viewPrintLayoutMode, setViewPrintLayoutMode] = useState("3inch");
const [selectedSales, setSelectedSales] = useState({});
const [printStockOnly, setPrintStockOnly] = useState(false);
  const [printPanelId, setPrintPanelId] = useState("");

  const [stockReport, setStockReport] = useState({ totalStock: 0, totalValue: 0, rows: [] });
  const [customerOutstanding, setCustomerOutstanding] = useState([]);
const [saving, setSaving] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [showOutstanding, setShowOutstanding] = useState(false);
  const [showCashSales, setShowCashSales] = useState(false);
  const [showCreditSales, setShowCreditSales] = useState(false);
const openEdit = async (saleId) => {
  setEditErr("");
  setEditOpen(true);
  setEditSale(null);
  setEditMap({});

  try {
    const sale = await apiFetch(`/sales/${saleId}`);
    setEditSale(sale);
    setEditDiscountType(sale.discountType || "none");
    setEditDiscountValue(sale.discountValue ?? "");
    setEditPaymentMethod(sale.paymentMethod || "cash");

    const map = {};
    (sale.saleItems || []).forEach((si) => {
      map[si.id] = {
        qty: si.qty,
        itemDiscountType: si.itemDiscountType || "none",
        itemDiscountValue: si.itemDiscountValue ?? "",
      };
    });
    setEditMap(map);
  } catch (e) {
    setEditErr("??? " + e.message);
  }
};
const deleteSale = async (saleId) => {
  const ok = window.confirm(
    `Are you sure you want to DELETE sale #${saleId}?\\n\\nThis will restore stock and cannot be undone.`
  );

  if (!ok) return;

  try {
    await apiFetch(`/sales/${saleId}`, {
      method: "DELETE",
    });

    await loadSales(); // refresh reports list
    alert("??? Sale deleted successfully");
  } catch (e) {
    alert("??? " + e.message);
  }
};

const openView = async (saleId) => {
  setViewErr("");
  setViewOpen(true);
  setViewSale(null);

  try {
    const sale = await apiFetch(`/sales/${saleId}`);
    setViewSale(sale);
  } catch (e) {
    setViewErr("??? " + e.message);
  }
};

const closeView = () => {
  setViewOpen(false);
  setViewSale(null);
  setViewErr("");
  setViewPrintPrompt(false);
};

const getBillLayoutFromStorage = () => {
  const DEFAULT_BILL_LAYOUT = {
    companyName: "Plus Vision",
    headerText: "Aluviharaya, Matale\\nMobile: +94770654279\\nThank you! Visit again",
    footerText: "Powered by POS",
    showItemsHeading: true,
    showCustomer: true,
    showTotals: true,
    showPayment: true,
  };

  try {
    const raw = localStorage.getItem("billLayout");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_BILL_LAYOUT, ...parsed };
    }
  } catch {
    // ignore bad layout
  }
  return DEFAULT_BILL_LAYOUT;
};

const setEditQty = (saleItemId, qty) => {
  const q = Number(qty);
  if (!Number.isFinite(q) || q < 0) return;
  setEditMap((prev) => ({
    ...prev,
    [saleItemId]: { ...(prev[saleItemId] || {}), qty: q },
  }));
};

const setEditItemDiscountType = (saleItemId, t) => {
  setEditMap((prev) => ({
    ...prev,
    [saleItemId]: {
      ...(prev[saleItemId] || {}),
      itemDiscountType: t,
      itemDiscountValue: t === "none" ? "" : prev[saleItemId]?.itemDiscountValue ?? "",
    },
  }));
};

const setEditItemDiscountValue = (saleItemId, v) => {
  setEditMap((prev) => ({
    ...prev,
    [saleItemId]: { ...(prev[saleItemId] || {}), itemDiscountValue: v },
  }));
};

const saveEdit = async () => {
  if (!editSale) return;

  setEditErr("");
  setSaving(true);
  try {
    const items = Object.entries(editMap).map(([saleItemId, data]) => ({
      saleItemId: Number(saleItemId),
      qty: Number(data?.qty),
      itemDiscountType: data?.itemDiscountType || "none",
      itemDiscountValue: Number(data?.itemDiscountValue || 0),
    }));

    const res = await apiFetch(`/sales/${editSale.id}`, {
      method: "PUT",
      body: JSON.stringify({
        items,
        discountType: editDiscountType,
        discountValue: editDiscountValue,
        paymentMethod: editPaymentMethod,
      }),
    });

    // Update modal with returned sale
    setEditSale(res.sale);
    setEditDiscountType(res.sale?.discountType || "none");
    setEditDiscountValue(res.sale?.discountValue ?? "");
    setEditPaymentMethod(res.sale?.paymentMethod || "cash");

    // Refresh reports list (table + totals)
    await loadSales();

    setEditErr("??? Sale updated");
  } catch (e) {
    setEditErr("??? " + e.message);
  } finally {
    setSaving(false);
  }
};

const closeEdit = () => {
  setEditOpen(false);
  setEditSale(null);
  setEditMap({});
  setEditErr("");
  setEditDiscountType("none");
  setEditDiscountValue("");
  setEditPaymentMethod("cash");
};


  // default: today
  const [from, setFrom] = useState(formatDate(new Date()));
  const [to, setTo] = useState(formatDate(new Date()));

  const loadSales = async () => {
    setMsg("");
    try {
      setLoading(true);
      const data = await apiFetch("/sales");
      setSales(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg("??? " + e.message);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStockReport = async () => {
    try {
      setStockLoading(true);
      const data = await apiFetch("/reports/stock");
      setStockReport(data || { totalStock: 0, totalValue: 0, rows: [] });
    } catch (e) {
      setMsg("??? " + e.message);
      setStockReport({ totalStock: 0, totalValue: 0, rows: [] });
    } finally {
      setStockLoading(false);
    }
  };

  const loadCustomerOutstanding = async () => {
    try {
      setOutstandingLoading(true);
      const data = await apiFetch("/reports/customer-outstanding");
      setCustomerOutstanding(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setMsg("??? " + e.message);
      setCustomerOutstanding([]);
    } finally {
      setOutstandingLoading(false);
    }
  };

  const handlePrintStock = () => {
    setPrintStockOnly(true);
    const cleanup = () => setPrintStockOnly(false);
    window.onafterprint = cleanup;
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handlePrintPanel = (id) => {
    setPrintPanelId(id);
    const cleanup = () => setPrintPanelId("");
    window.onafterprint = cleanup;
    setTimeout(() => {
      window.print();
    }, 50);
  };

  useEffect(() => {
    loadSales();
    loadStockReport();
    loadCustomerOutstanding();
  }, []);

  // Filter by date range (uses createdAt if available)
  const filtered = useMemo(() => {
    const fromD = new Date(from + "T00:00:00");
    const toD = new Date(to + "T23:59:59");

    return sales.filter((s) => {
      if (!s.createdAt) return true; // if no createdAt, can't filter, include
      const d = new Date(s.createdAt);
      return d >= fromD && d <= toD;
    });
  }, [sales, from, to]);

  const totals = useMemo(() => {
    const billCount = filtered.length;
    const totalSales = filtered.reduce((sum, s) => sum + Number(s.total || 0), 0);

    const totalItems = filtered.reduce((sum, s) => {
      const items = s.saleItems || [];
      return sum + items.reduce((a, i) => a + Number(i.qty || 0), 0);
    }, 0);

    return { billCount, totalSales, totalItems };
  }, [filtered]);

  const selectedSalesList = useMemo(
    () => filtered.filter((s) => selectedSales[s.id]),
    [filtered, selectedSales]
  );

  const selectedItemsReport = useMemo(() => {
    const map = new Map();
    for (const s of selectedSalesList) {
      for (const si of s.saleItems || []) {
        const key = si.product?.barcode || si.barcode || si.productId || si.id;
        const name = si.product?.name || si.name || "Item";
        const barcode = si.product?.barcode || si.barcode || "-";
        const qty = Number(si.qty || 0);
        const freeQty = Number(si.freeQty || 0);
        const price = Number(si.price || 0);
        const disc = Number(si.itemDiscountValue || 0);
        const lineNet = Math.max(0, price * qty - disc);

        const existing = map.get(key) || {
          name,
          barcode,
          qty: 0,
          freeQty: 0,
          total: 0,
        };
        existing.qty += qty;
        existing.freeQty += freeQty;
        existing.total += lineNet;
        map.set(key, existing);
      }
    }
    return Array.from(map.values());
  }, [selectedSalesList]);

  const cashSales = useMemo(
    () => filtered.filter((s) => String(s.paymentMethod || "cash") === "cash"),
    [filtered]
  );

  const creditSales = useMemo(
    () => filtered.filter((s) => String(s.paymentMethod || "") === "credit"),
    [filtered]
  );

  const cashTotals = useMemo(() => {
    const billCount = cashSales.length;
    const totalSales = cashSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const totalItems = cashSales.reduce((sum, s) => {
      const items = s.saleItems || [];
      return sum + items.reduce((a, i) => a + Number(i.qty || 0), 0);
    }, 0);
    return { billCount, totalSales, totalItems };
  }, [cashSales]);

  const creditTotals = useMemo(() => {
    const billCount = creditSales.length;
    const totalSales = creditSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const totalItems = creditSales.reduce((sum, s) => {
      const items = s.saleItems || [];
      return sum + items.reduce((a, i) => a + Number(i.qty || 0), 0);
    }, 0);
    return { billCount, totalSales, totalItems };
  }, [creditSales]);

  return (
    <div className={printStockOnly || printPanelId ? "page print-stock-mode" : "page"}>
      <style>{`
        @media print {
          .print-stock-mode * { visibility: hidden !important; }
          .print-stock-mode .print-stock-area,
          .print-stock-mode .print-stock-area * {
            visibility: visible !important;
          }
          .print-stock-mode .print-stock-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff;
            color: #000;
          }
          .print-stock-mode .print-hide {
            display: none !important;
          }
          .print-stock-mode .print-panel-area,
          .print-stock-mode .print-panel-area * {
            visibility: visible !important;
          }
          .print-stock-mode .print-panel-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff;
            color: #000;
            border: none !important;
          }
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0 }}>???? Reports</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{ padding: 10 }}>
            Back
          </button>
          <button onClick={loadSales} disabled={loading} style={{ padding: 10 }}>
            Refresh
          </button>
        </div>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <div style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Date Range</h3>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#555" }}>From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: 8 }} />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#555" }}>To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: 8 }} />
          </div>

          {!sales.some((s) => s.createdAt) && (
            <div style={{ color: "#b45309", fontSize: 13 }}>
              Note: Your sales don???t have <b>createdAt</b> in DB yet, so date filtering may not work perfectly.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Summary</h3>
        <div style={{ lineHeight: 1.8 }}>
          <div>Bills count: <b>{totals.billCount}</b></div>
          <div>Total items sold: <b>{totals.totalItems}</b></div>
          <div>Total sales: <b>{totals.totalSales}</b></div>
          <div>Cash sales: <b>{cashTotals.totalSales}</b></div>
          <div>Credit sales: <b>{creditTotals.totalSales}</b></div>
        </div>
      </div>

      <div className={`print-panel-area ${printPanelId === "sales-list" ? "print-panel-area" : ""}`} style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ marginTop: 0 }}>Sales List</h3>
          <button onClick={() => handlePrintPanel("sales-list")} className="print-hide" style={{ padding: 8 }}>
            Print
          </button>
        </div>

        {filtered.length === 0 ? (
          <p style={{ color: "#666" }}>No sales in this range.</p>
        ) : (
          <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ color: "#000" }}>
              <tr>
                <th>Select</th>
                <th>Date</th>
                <th>Sale ID</th>
                <th>Customer name</th>
                <th>Address</th>
                <th>Bill value</th>
                {role === "admin" && <th>Action</th>}
              </tr>
            </thead>

            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedSales[s.id])}
                      onChange={(e) =>
                        setSelectedSales((prev) => ({ ...prev, [s.id]: e.target.checked }))
                      }
                    />
                  </td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{s.id}</td>
                  <td>{s.customerName || s.customer?.name || "Walk-in"}</td>
                  <td>{s.customerAddress || s.customer?.address || "-"}</td>
                  <td>Rs {s.total}</td>
                  {role === "admin" && (
                    <td style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(s.id)} style={{ padding: "6px 10px" }}>
                        Edit
                      </button>
                      <button onClick={() => openView(s.id)} style={{ padding: "6px 10px" }}>
                        View
                      </button>
                      <button
                        onClick={() => deleteSale(s.id)}
                        style={{
                          padding: "6px 10px",
                          background: "#fee2e2",
                          color: "#991b1b",
                          border: "1px solid #991b1b",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selectedSalesList.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ margin: 0 }}>Selected Sales - Item Wise Report</h4>
              <button onClick={() => setSelectedSales({})} style={{ padding: "6px 10px" }}>
                Clear Selection
              </button>
            </div>

            {selectedItemsReport.length === 0 ? (
              <p style={{ color: "#666" }}>No items found for selected bills.</p>
            ) : (
              <table
                border="1"
                cellPadding="8"
                style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}
              >
                <thead style={{ color: "#000" }}>
                  <tr>
                    <th>Barcode</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Free Qty</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItemsReport.map((row) => (
                    <tr key={`${row.barcode}-${row.name}`}>
                      <td>{row.barcode}</td>
                      <td>{row.name}</td>
                      <td>{row.qty}</td>
                      <td>{row.freeQty}</td>
                      <td>{Math.round(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div className={`print-stock-area ${printPanelId === "remaining-stock" ? "print-panel-area" : ""}`} style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ marginTop: 0 }}>Remaining Stock</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowStock((v) => !v)} style={{ padding: 8 }} className="print-hide">
              {showStock ? "Hide" : "View"}
            </button>
            <button
              onClick={handlePrintStock}
              disabled={!showStock || stockLoading || (stockReport.rows || []).length === 0}
              style={{ padding: 8 }}
              className="print-hide"
            >
              Print
            </button>
            <button
              onClick={() => handlePrintPanel("remaining-stock")}
              disabled={!showStock || stockLoading || (stockReport.rows || []).length === 0}
              style={{ padding: 8 }}
              className="print-hide"
            >
              Panel Print
            </button>
            <button onClick={loadStockReport} disabled={stockLoading} style={{ padding: 8 }} className="print-hide">
              Refresh Stock
            </button>
          </div>
        </div>
        {showStock && (
          <>
            <div style={{ lineHeight: 1.8, marginBottom: 10 }}>
              <div>Total stock units: <b>{stockReport.totalStock || 0}</b></div>
              <div>Total stock value: <b>{stockReport.totalValue || 0}</b></div>
            </div>

            {stockLoading ? (
              <p style={{ color: "#666" }}>Loading stock report...</p>
            ) : (stockReport.rows || []).length === 0 ? (
              <p style={{ color: "#666" }}>No stock data.</p>
            ) : (
              <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ color: "#000" }}>
                  <tr>
                    <th>Barcode</th>
                    <th>Item</th>
                    <th>Stock</th>
                    <th>Price</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(stockReport.rows || []).map((r) => (
                    <tr key={r.id}>
                      <td>{r.barcode}</td>
                      <td>{r.name}</td>
                      <td>{r.stock}</td>
                      <td>{r.price}</td>
                      <td>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <div className={`print-panel-area ${printPanelId === "customer-outstanding" ? "print-panel-area" : ""}`} style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ marginTop: 0 }}>Customer Outstanding (Credit)</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowOutstanding((v) => !v)} style={{ padding: 8 }}>
              {showOutstanding ? "Hide" : "View"}
            </button>
            <button onClick={() => handlePrintPanel("customer-outstanding")} className="print-hide" style={{ padding: 8 }}>
              Print
            </button>
            <button onClick={loadCustomerOutstanding} disabled={outstandingLoading} style={{ padding: 8 }}>
              Refresh Outstanding
            </button>
          </div>
        </div>

        {showOutstanding && (
          <>
            {outstandingLoading ? (
              <p style={{ color: "#666" }}>Loading outstanding...</p>
            ) : (customerOutstanding || []).length === 0 ? (
              <p style={{ color: "#666" }}>No credit outstanding.</p>
            ) : (
              <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ color: "#000" }}>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {(customerOutstanding || []).map((c) => (
                    <tr key={c.customerId}>
                      <td>{c.name}</td>
                      <td>{c.phone || "-"}</td>
                      <td>{c.address || "-"}</td>
                      <td>{c.outstanding}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <div className={`print-panel-area ${printPanelId === "cash-sales" ? "print-panel-area" : ""}`} style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ marginTop: 0 }}>Cash Sales Report</h3>
          <button onClick={() => setShowCashSales((v) => !v)} style={{ padding: 8 }}>
            {showCashSales ? "Hide" : "View"}
          </button>
          <button onClick={() => handlePrintPanel("cash-sales")} className="print-hide" style={{ padding: 8 }}>
            Print
          </button>
        </div>
        {showCashSales && (
          <>
            <div style={{ lineHeight: 1.8, marginBottom: 10 }}>
              <div>Bills count: <b>{cashTotals.billCount}</b></div>
              <div>Total items sold: <b>{cashTotals.totalItems}</b></div>
              <div>Total sales: <b>{cashTotals.totalSales}</b></div>
            </div>
            {cashSales.length === 0 ? (
              <p style={{ color: "#666" }}>No cash sales in this range.</p>
            ) : (
              <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ color: "#000" }}>
                  <tr>
                    <th>Date</th>
                    <th>Sale ID</th>
                    <th>Customer name</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Bill value</th>
                    {role === "admin" && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {cashSales.map((s) => (
                    <tr key={`cash-${s.id}`}>
                      <td>{new Date(s.createdAt).toLocaleString()}</td>
                      <td>{s.id}</td>
                      <td>{s.customerName || s.customer?.name || "Walk-in"}</td>
                      <td>{s.customerPhone || s.customer?.phone || "-"}</td>
                      <td>{s.customerAddress || s.customer?.address || "-"}</td>
                      <td>Rs {s.total}</td>
                      {role === "admin" && (
                        <td style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEdit(s.id)} style={{ padding: "6px 10px" }}>
                            Edit
                          </button>
                          <button onClick={() => openView(s.id)} style={{ padding: "6px 10px" }}>
                            View
                          </button>
                          <button
                            onClick={() => deleteSale(s.id)}
                            style={{
                              padding: "6px 10px",
                              background: "#fee2e2",
                              color: "#991b1b",
                              border: "1px solid #991b1b",
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <div className={`print-panel-area ${printPanelId === "credit-sales" ? "print-panel-area" : ""}`} style={{ marginTop: 15, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h3 style={{ marginTop: 0 }}>Credit Sales Report</h3>
          <button onClick={() => setShowCreditSales((v) => !v)} style={{ padding: 8 }}>
            {showCreditSales ? "Hide" : "View"}
          </button>
          <button onClick={() => handlePrintPanel("credit-sales")} className="print-hide" style={{ padding: 8 }}>
            Print
          </button>
        </div>
        {showCreditSales && (
          <>
            <div style={{ lineHeight: 1.8, marginBottom: 10 }}>
              <div>Bills count: <b>{creditTotals.billCount}</b></div>
              <div>Total items sold: <b>{creditTotals.totalItems}</b></div>
              <div>Total sales: <b>{creditTotals.totalSales}</b></div>
            </div>
            {creditSales.length === 0 ? (
              <p style={{ color: "#666" }}>No credit sales in this range.</p>
            ) : (
              <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ color: "#000" }}>
                  <tr>
                    <th>Date</th>
                    <th>Sale ID</th>
                    <th>Customer name</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Bill value</th>
                    {role === "admin" && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {creditSales.map((s) => (
                    <tr key={`credit-${s.id}`}>
                      <td>{new Date(s.createdAt).toLocaleString()}</td>
                      <td>{s.id}</td>
                      <td>{s.customerName || s.customer?.name || "Walk-in"}</td>
                      <td>{s.customerPhone || s.customer?.phone || "-"}</td>
                      <td>{s.customerAddress || s.customer?.address || "-"}</td>
                      <td>Rs {s.total}</td>
                      {role === "admin" && (
                        <td style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEdit(s.id)} style={{ padding: "6px 10px" }}>
                            Edit
                          </button>
                          <button onClick={() => openView(s.id)} style={{ padding: "6px 10px" }}>
                            View
                          </button>
                          <button
                            onClick={() => deleteSale(s.id)}
                            style={{
                              padding: "6px 10px",
                              background: "#fee2e2",
                              color: "#991b1b",
                              border: "1px solid #991b1b",
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
      {viewOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={closeView}
        >
          <div
            style={{
              background: "var(--panel)",
              color: "var(--text)",
              width: "min(520px, 100%)",
              borderRadius: 10,
              padding: 16,
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h3 style={{ marginTop: 0 }}>View Bill</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setViewPrintPrompt(true)}>Print</button>
                <button onClick={closeView}>???</button>
              </div>
            </div>

            {viewPrintPrompt && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Print Size</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => {
                      setViewPrintLayoutMode("3inch");
                      setViewPrintPrompt(false);
                      setTimeout(() => window.print(), 100);
                    }}
                    style={{ padding: 10 }}
                  >
                    3 Inch
                  </button>
                  <button
                    onClick={() => {
                      setViewPrintLayoutMode("a4");
                      setViewPrintPrompt(false);
                      setTimeout(() => window.print(), 100);
                    }}
                    style={{ padding: 10 }}
                  >
                    A4
                  </button>
                  <button onClick={() => setViewPrintPrompt(false)} style={{ padding: 10 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
{viewErr && <p style={{ color: "#ff6b6b" }}>{viewErr}</p>}

            {!viewSale ? (
              <p>Loading sale...</p>
            ) : (
              <div id="print-area" style={{ background: "#fff", padding: 10, borderRadius: 8 }}>
                <ReceiptPrint
                  layout={(() => {
                    const layout = getBillLayoutFromStorage();
                    return {
                      ...layout,
                      headerLines: String(layout.headerText || "")
                        .split("\\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                      footerLines: String(layout.footerText || "")
                        .split("\\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                    };
                  })()}
                  layoutMode={viewPrintLayoutMode}
                  saleId={viewSale.id}
                  dateText={new Date(viewSale.createdAt).toLocaleString()}
                  customerName={viewSale.customerName || viewSale.customer?.name || ""}
                  customerPhone={viewSale.customerPhone || viewSale.customer?.phone || ""}
                  customerAddress={viewSale.customerAddress || viewSale.customer?.address || ""}
                    items={(viewSale.saleItems || []).map((si) => ({
                      barcode: si.product?.barcode || si.barcode || "",
                      name: si.product?.name || si.name || "Item",
                      qty: si.qty,
                      freeQty: si.freeQty ?? 0,
                      price: si.price ?? si.product?.price ?? 0,
                      itemDiscountType: si.itemDiscountType || "none",
                      itemDiscountValue: si.itemDiscountValue ?? 0,
                    }))}
                  subtotal={Number(
                    viewSale.subtotal ??
                      (Number(viewSale.total ?? viewSale.grandTotal ?? 0) +
                        Number(viewSale.discountAmount ?? viewSale.discount ?? 0))
                  )}
                  discount={Number(viewSale.discountAmount ?? viewSale.discount ?? 0)}
                  grandTotal={Number(viewSale.total ?? viewSale.grandTotal ?? 0)}
                  paymentMethod={viewSale.paymentMethod || "cash"}
                  cashReceived={viewSale.cashReceived ?? 0}
                  balance={viewSale.balance ?? 0}
                />
              </div>
            )}
          </div>
        </div>
      )}
      {editOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}
    onClick={closeEdit}
  >
    <div
      style={{
        background: "#fff",
        width: "min(900px, 100%)",
        borderRadius: 10,
        padding: 16,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3>Edit Sale {editSale ? `#${editSale.id}` : ""}</h3>
        <button onClick={closeEdit}>???</button>
      </div>

      {editErr && <p style={{ color: "red" }}>{editErr}</p>}

      {!editSale ? (
        <p>Loading sale...</p>
      ) : (
        <>
          <p style={{ textAlign: "left" }}>
            Date: {new Date(editSale.createdAt).toLocaleString()} <br />
            Current Total: <b>{editSale.total}</b>
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#555" }}>Discount Type</div>
              <select
                value={editDiscountType}
                onChange={(e) => {
                  setEditDiscountType(e.target.value);
                  if (e.target.value === "none") setEditDiscountValue("");
                }}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              >
                <option value="none">None</option>
                <option value="amount">Amount</option>
                <option value="percent">Percent</option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, color: "#555" }}>Discount Value</div>
              <input
                type="number"
                value={editDiscountValue}
                onChange={(e) => setEditDiscountValue(e.target.value)}
                disabled={editDiscountType === "none"}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, color: "#555" }}>Payment Method</div>
              <select
                value={editPaymentMethod}
                onChange={(e) => setEditPaymentMethod(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              >
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
                <option value="check">Check</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
            <thead style={{ color: "#000" }}>
              <tr>
                <th>Item</th>
                <th>Barcode</th>
                <th>Price</th>
                <th>Qty (0 = remove)</th>
                <th>Item Disc Type</th>
                <th>Item Disc Value</th>
              </tr>
            </thead>
            <tbody>
              {editSale.saleItems.map((si) => (
                <tr key={si.id}>
                  <td>{si.product?.name}</td>
                  <td>{si.product?.barcode}</td>
                  <td>{si.price}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={editMap[si.id]?.qty ?? 0}
                      onChange={(e) =>
                        setEditQty(si.id, e.target.value)
                      }
                      style={{ width: 80 }}
                    />
                  </td>
                  <td>
                    <select
                      value={editMap[si.id]?.itemDiscountType || "none"}
                      onChange={(e) => setEditItemDiscountType(si.id, e.target.value)}
                    >
                      <option value="none">None</option>
                      <option value="amount">Amount</option>
                      <option value="percent">Percent</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={editMap[si.id]?.itemDiscountValue ?? ""}
                      onChange={(e) => setEditItemDiscountValue(si.id, e.target.value)}
                      disabled={(editMap[si.id]?.itemDiscountType || "none") === "none"}
                      style={{ width: 90 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
           <p style={{ textAlign: "right" }}>
              Current Total: <b>{editSale.total}</b></p>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
           
            <button onClick={closeEdit}>Cancel</button>
            <button onClick={saveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
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





