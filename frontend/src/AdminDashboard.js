import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard({ onLogout }) {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const role = localStorage.getItem("role");
  const [newSupplierName, setNewSupplierName] = useState("");
const [newSupplierInvoiceNo, setNewSupplierInvoiceNo] = useState("");
const [newReceivedDate, setNewReceivedDate] = useState(() => {
  const d = new Date();
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
});
const [newInvoicePhoto, setNewInvoicePhoto] = useState("");



  

  const [products, setProducts] = useState([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerOutstanding, setCustomerOutstanding] = useState({});
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalStock: 0,
    lowStock: 0,
    totalUsers: 0,
    todayBills: 0,
    todayRevenue: 0,
  });

  // Product form
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [billingPrice, setBillingPrice] = useState("");
  const [stock, setStock] = useState("");

  // Product list controls
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [editingBarcode, setEditingBarcode] = useState(null);
  const [editValues, setEditValues] = useState({ name: "", price: "", billingPrice: "", stock: "" });
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Customer form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const [showReportsPopup, setShowReportsPopup] = useState(false);
  const [showStockMenu, setShowStockMenu] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);

  // User form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("cashier");
  const [roleEdits, setRoleEdits] = useState({});
  const [fastMode, setFastMode] = useState(true);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [salesLoaded, setSalesLoaded] = useState(false);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [printPanelId, setPrintPanelId] = useState("");

  

  const loadSummary = useCallback(async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch("/reports/summary");
      setSummary(data);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async (nextPage = 0) => {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch(`/products?limit=${pageSize}&offset=${nextPage * pageSize}`);
      setProducts(data.items || []);
      setProductsTotal(data.total || 0);
      setPage(nextPage);
      setProductsLoaded(true);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  const loadUsers = useCallback(async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch("/users");
      setUsers(data);
      setUsersLoaded(true);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

 const loadCustomers = async () => {
  try {
    const [data, outstanding] = await Promise.all([
      apiFetch("/customers/all"),
      apiFetch("/reports/customer-outstanding"),
    ]);

    setCustomers(Array.isArray(data) ? data : []);
    const map = {};
    (outstanding?.rows || []).forEach((row) => {
      if (row?.customerId) {
        map[row.customerId] = Number(row.outstanding || 0);
      }
    });
    setCustomerOutstanding(map);
  } catch (e) {
    console.error(e);
    setCustomers([]);
    setCustomerOutstanding({});
  }
};


  const loadAnalytics = useCallback(async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch("/reports/analytics?days=30");
      setAnalytics(data);
      setAnalyticsLoaded(true);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSales = useCallback(async () => {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch("/sales");
      setSales(data);
      setSalesLoaded(true);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const openLowStock = async () => {
    try {
      setLowStockLoading(true);
      const data = await apiFetch("/products");
      const list = Array.isArray(data) ? data : (data?.items || []);
      const filtered = list.filter((p) => Number(p.stock || 0) <= 5);
      setLowStockItems(filtered);
      setShowLowStock(true);
    } catch (e) {
      setLowStockItems([]);
      setShowLowStock(true);
    } finally {
      setLowStockLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!fastMode) {
      if (!productsLoaded) loadProducts(0);
      if (!usersLoaded) loadUsers();
      if (!analyticsLoaded) loadAnalytics();
      if (!salesLoaded) loadSales();
      if (!customersLoaded) loadCustomers();
    }
  }, [fastMode, productsLoaded, usersLoaded, analyticsLoaded, salesLoaded, customersLoaded, loadProducts, loadUsers, loadAnalytics, loadSales, loadCustomers]);

  const visibleProducts = useMemo(() => {
    const normalize = (v) => String(v ?? "").toLowerCase();
    const q = normalize(query);
    const filtered = products.filter((p) => {
      if (!q) return true;
      return normalize(p.name).includes(q) || normalize(p.barcode).includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "name") {
        return normalize(a.name).localeCompare(normalize(b.name)) * dir;
      }
      const aNum = Number(String(a[sortBy] ?? "").replace(/,/g, "")) || 0;
      const bNum = Number(String(b[sortBy] ?? "").replace(/,/g, "")) || 0;
      return (aNum - bNum) * dir;
    });

    return sorted;
  }, [products, query, sortBy, sortDir]);

  const createProduct = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify({
          barcode,
          name,
          price: Number(price),
          billingPrice: Number(billingPrice),
          stock: Number(stock || 0),
          supplierName: newSupplierName || null,
supplierInvoiceNo: newSupplierInvoiceNo || null,
receivedDate: newReceivedDate ? newReceivedDate : null,
invoicePhoto: newInvoicePhoto || null,

        }),
      });

      setMsg("Product created");
      setBarcode("");
      setName("");
      setPrice("");
      setBillingPrice("");
      setStock("");
      await loadSummary();
      if (productsLoaded) {
        await loadProducts(page);
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const startEdit = (product) => {
    setEditingBarcode(product.barcode);
    setEditValues({
      name: product.name,
      price: product.price,
      billingPrice: product.billingPrice,
      stock: product.stock,
    });
  };

  const cancelEdit = () => {
    setEditingBarcode(null);
    setEditValues({ name: "", price: "", billingPrice: "", stock: "" });
  };

  const saveEdit = async (barcodeValue) => {
    try {
      await apiFetch(`/products/${barcodeValue}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editValues.name,
          price: Number(editValues.price),
          billingPrice: Number(editValues.billingPrice),
          stock: Number(editValues.stock),
        }),
      });
      setMsg("Product updated");
      cancelEdit();
      await loadSummary();
      if (productsLoaded) {
        await loadProducts(page);
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const deleteProduct = async (barcodeValue) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await apiFetch(`/products/${barcodeValue}`, { method: "DELETE" });
      setMsg("Product deleted");
      await loadSummary();
      if (productsLoaded) {
        await loadProducts(page);
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      });
      setMsg("User created");
      setNewUsername("");
      setNewPassword("");
      setNewRole("cashier");
      await loadSummary();
      if (usersLoaded) {
        await loadUsers();
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const nameRegex = /^[A-Za-z\s]+$/;
  const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

  const createCustomer = async (e) => {
    e.preventDefault();
    setMsg("");
    const name = customerName.trim();
    if (!name) {
      setMsg("Customer name is required");
      return;
    }
    if (!nameRegex.test(name)) {
      setMsg("Customer name must contain only letters and spaces");
      return;
    }
    const phoneDigits = digitsOnly(customerPhone);
    if (phoneDigits.length !== 10) {
      setMsg("Customer phone must be exactly 10 digits");
      return;
    }
    try {
      await apiFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone: phoneDigits,
          address: customerAddress,
        }),
      });
      setMsg("Customer created");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      if (customersLoaded) {
        await loadCustomers();
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };
  const updateRole = async (userId) => {
    console.log("updateRole clicked", userId, roleEdits[userId]);

  // ✅ get the current shown value (edited or existing)
  const currentRole = users.find((x) => x.id === userId)?.role;
  const role = roleEdits[userId] ?? currentRole;

  if (!role) {
    setMsg("No role selected");
    return;
  }

  try {
    await apiFetch(`/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });

    setMsg("Role updated");

    // ✅ clear edit state properly
    setRoleEdits((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });

    await loadUsers(); // refresh list to see change
  } catch (e) {
    setMsg("Error: " + e.message);
  }
};


  const deleteUser = async (userId) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await apiFetch(`/users/${userId}`, { method: "DELETE" });
      setMsg("User deleted");
      await loadSummary();
      if (usersLoaded) {
        await loadUsers();
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const handlePrintPanel = (id) => {
    setPrintPanelId(id);
    const cleanup = () => setPrintPanelId("");
    window.onafterprint = cleanup;
    setTimeout(() => {
      window.print();
    }, 50);
  };

  return (
    <div className={printPanelId ? "admin-shell print-panel-mode" : "admin-shell"}>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap");

        .admin-shell {
          font-family: "Space Grotesk", sans-serif;
          color: var(--text);
          background:
            radial-gradient(1200px 500px at 10% -10%, rgba(34, 193, 181, 0.15) 0%, rgba(34, 193, 181, 0) 60%),
            radial-gradient(900px 400px at 90% -20%, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0) 55%),
            var(--bg);
          min-height: 100vh;
          padding: 24px 20px 40px;
        }

        .admin-content {
          max-width: 1200px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .title h2 {
          margin: 0;
          font-size: 26px;
        }

        .title span {
          font-size: 13px;
          color: var(--muted);
        }

        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .menu-wrap {
          position: relative;
        }

        .menu-panel {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          display: grid;
          gap: 6px;
          padding: 8px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: var(--shadow);
          z-index: 20;
          min-width: 170px;
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 9999;
        }

        .modal {
          background: var(--panel);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          width: min(720px, 100%);
          max-height: 80vh;
          overflow: auto;
        }

        .btn {
          border: none;
          border-radius: 10px;
          padding: 9px 14px;
          font-weight: 600;
          cursor: pointer;
          background: var(--accent);
          color: var(--bg);
          transition: transform 120ms ease, box-shadow 120ms ease;
        }

        .btn.secondary {
          background: var(--panel);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .btn.ghost {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .banner {
          background: var(--panel);
          color: var(--text);
          border: 1px solid var(--border);
          padding: 10px 14px;
          border-radius: 10px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px;
          color: var(--text);
        }

        .card .label {
          color: var(--muted);
          font-size: 12px;
          margin-bottom: 8px;
        }

        .card .value {
          font-size: 18px;
          font-weight: 700;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .panel {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
        }

        .panel h3 {
          margin: 0 0 12px;
        }

        .form {
          display: grid;
          gap: 10px;
        }

        .input-group label {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
        }

        .input-group input,
        .input-group select {
          width: 100%;
          padding: 9px 10px;
          margin-top: 6px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: #0f172a;
          color: var(--text);
          font-size: 14px;
        }

        .panel-wide {
          grid-column: 1 / -1;
        }

        .table-tools {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .table-tools input,
        .table-tools select {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: #0f172a;
          color: var(--text);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        thead th {
          text-align: left;
          padding: 10px;
          background: rgba(255, 255, 255, 0.04);
          border-bottom: 1px solid var(--border);
        }

        tbody td {
          padding: 10px;
          border-bottom: 1px solid var(--border);
        }

        tbody tr:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .reports-wrap {
          position: relative;
          display: inline-block;
        }

        .reports-menu {
          position: absolute;
          top: 42px;
          left: 0;
          z-index: 10;
          min-width: 180px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: var(--shadow);
          padding: 6px;
        }

        .reports-menu button {
          width: 100%;
          text-align: left;
          padding: 8px 10px;
          border-radius: 8px;
        }

        @media (max-width: 640px) {
          .title h2 { font-size: 22px; }
          .panel-wide { grid-column: auto; }
        }
        @media print {
          .print-panel-mode * { visibility: hidden !important; }
          .print-panel-mode .print-panel-area,
          .print-panel-mode .print-panel-area * {
            visibility: visible !important;
          }
          .print-panel-mode .print-panel-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff;
            color: #000;
            border: none !important;
            box-shadow: none !important;
          }
          .print-hide {
            display: none !important;
          }
        }
      `}</style>
      <div className="admin-content">
        <div className="topbar">
          <div className="title">
            <h2>Admin Dashboard | Apex Logistics</h2>
            <span>Minimal control center for your POS</span>
          </div>
          <div className="actions">
            <div className="menu-wrap">
              <button
                className="btn ghost"
                onClick={() => setShowReportsPopup((v) => !v)}
              >
                Reports
              </button>
              {showReportsPopup && (
                <div className="menu-panel">
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setShowReportsPopup(false);
                      navigate("/reports");
                    }}
                  >
                    Sales Reports
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setShowReportsPopup(false);
                      navigate("/reports/items");
                    }}
                  >
                    Item-wise Report
                  </button>
                </div>
              )}
            </div>

            <button className="btn ghost" onClick={() => navigate("/returns")}>Returns</button>
            <div className="menu-wrap">
              <button
                className="btn ghost"
                onClick={() => setShowStockMenu((v) => !v)}
              >
                Stock
              </button>
              {showStockMenu && (
                <div className="menu-panel">
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setShowStockMenu(false);
                      navigate("/stock");
                    }}
                  >
                    Current Stock
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setShowStockMenu(false);
                      navigate("/stock/returned");
                    }}
                  >
                    Returned Stock
                  </button>
                </div>
              )}
            </div>
            <button className="btn secondary" onClick={() => navigate("/end-day")}>End Day</button>
            <button className="btn ghost" onClick={() => navigate("/billing")}>Billing</button>
            <button className="btn" onClick={onLogout}>Logout</button>
          </div>
        </div>


        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input
            id="fast-mode"
            type="checkbox"
            checked={fastMode}
            onChange={(e) => setFastMode(e.target.checked)}
          />
          <label htmlFor="fast-mode" style={{ fontSize: 12, color: "var(--muted)" }}>
            Fast Mode (load heavy data only when needed)
          </label>
        </div>
      

        {msg && <div className="banner">{msg}</div>}

        {showLowStock && (
          <div className="overlay" onClick={() => setShowLowStock(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Low Stock Items (≤ 5)</h3>
                <button className="btn ghost" onClick={() => setShowLowStock(false)}>Close</button>
              </div>

              {lowStockLoading ? (
                <p style={{ color: "var(--muted)" }}>Loading...</p>
              ) : lowStockItems.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>No low stock items.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Name</th>
                      <th>Stock</th>
                      <th>Billing Price</th>
                      <th>Supplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map((p) => (
                      <tr key={p.barcode}>
                        <td>{p.barcode}</td>
                        <td>{p.name}</td>
                        <td>{p.stock}</td>
                        <td>{p.billingPrice ?? p.price}</td>
                        <td>{p.supplierName || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <div className="cards">
          <div className="card">
            <div className="label">Total Products</div>
            <div className="value">{summary.totalProducts}</div>
          </div>
          <div className="card">
            <div className="label">Total Stock Units</div>
            <div className="value">{summary.totalStock}</div>
          </div>
          <div className="card" style={{ cursor: "pointer" }} onClick={openLowStock}>
            <div className="label">Low Stock Items</div>
            <div className="value">{summary.lowStock}</div>
          </div>
          <div className="card">
            <div className="label">Today Bills</div>
            <div className="value">{summary.todayBills}</div>
          </div>
          <div className="card">
            <div className="label">Today Revenue</div>
            <div className="value">{Math.round(summary.todayRevenue)}</div>
          </div>
          <div className="card">
            <div className="label">Total Users</div>
            <div className="value">{summary.totalUsers}</div>
          </div>
        </div>

        <div className="grid">
          <div className={`panel panel-wide ${printPanelId === "analytics" ? "print-panel-area" : ""}`}>
            <div className="table-tools">
              <div>
                <h3 style={{ margin: 0 }}>Sales Analytics (30 days)</h3>
                <span style={{ color: "var(--text)", fontSize: 12 }}>
                  Revenue trend + top selling products
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn secondary print-hide" type="button" onClick={() => handlePrintPanel("analytics")}>
                  Print
                </button>
                {!analyticsLoaded && (
                  <button className="btn secondary print-hide" type="button" onClick={loadAnalytics} disabled={loading}>
                    Load Analytics
                  </button>
                )}
                {analyticsLoaded && (
                  <button className="btn secondary print-hide" type="button" onClick={loadAnalytics} disabled={loading}>
                    Refresh Analytics
                  </button>
                )}
              </div>
            </div>

            {!analyticsLoaded && fastMode ? (
              <div style={{ color: "var(--text)", fontSize: 12 }}>
                Analytics is paused to keep startup fast. Click “Load Analytics” when needed.
              </div>
            ) : (
              <>
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                  <div className="card">
                    <div className="label">Total Revenue</div>
                    <div className="value">{Math.round(analytics?.totalRevenue || 0)}</div>
                  </div>
                  <div className="card">
                    <div className="label">Total Bills</div>
                    <div className="value">{analytics?.totalBills || 0}</div>
                  </div>
                  <div className="card">
                    <div className="label">Avg Ticket</div>
                    <div className="value">{Math.round(analytics?.avgTicket || 0)}</div>
                  </div>
                  <div className="card">
                    <div className="label">Avg Items/Bill</div>
                    <div className="value">{Number(analytics?.avgItemsPerBill || 0).toFixed(1)}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginTop: 12 }}>
                  <div className="panel" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Daily Revenue</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {(analytics?.daily || []).map((row) => (
                        <div key={row.date} style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>{row.date}</span>
                          <div style={{ height: 8, background: "var(--border)", borderRadius: 999 }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${analytics?.totalRevenue ? Math.round((row.total / analytics.totalRevenue) * 100) : 0}%`,
                                background: "var(--accent)",
                                borderRadius: 999,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 12, textAlign: "right" }}>{Math.round(row.total)}</span>
                        </div>
                      ))}
                      {(!analytics || analytics.daily?.length === 0) && (
                        <div style={{ color: "var(--muted)", fontSize: 12 }}>No sales in the selected range.</div>
                      )}
                    </div>
                  </div>

                  <div className="panel" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Top Products</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {(analytics?.topProducts || []).map((p) => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 13 }}>{p.name}</span>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>{p.qty} sold</span>
                        </div>
                      ))}
                      {(!analytics || analytics.topProducts?.length === 0) && (
                        <div style={{ color: "var(--muted)", fontSize: 12 }}>No products yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className={`panel panel-wide ${printPanelId === "recent-sales" ? "print-panel-area" : ""}`}>
            <div className="table-tools">
              <div>
                <h3 style={{ margin: 0 }}>Recent Sales (Customer Details)</h3>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  Latest sales with customer name, phone, and address
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn secondary print-hide" type="button" onClick={() => handlePrintPanel("recent-sales")}>
                  Print
                </button>
                {!salesLoaded && (
                  <button className="btn secondary print-hide" type="button" onClick={loadSales} disabled={loading}>
                    Load Sales
                  </button>
                )}
                {salesLoaded && (
                  <button className="btn secondary print-hide" type="button" onClick={loadSales} disabled={loading}>
                    Refresh Sales
                  </button>
                )}
              </div>
            </div>

            {!salesLoaded && fastMode ? (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                Sales are paused to keep startup fast. Click "Load Sales" when needed.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Sale #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(sales || []).slice(0, 12).map((s) => {
                    const customerName = s.customer?.name || s.customerName || "-";
                    const customerPhone = s.customer?.phone || s.customerPhone || "-";
                    const customerAddress = s.customer?.address || s.customerAddress || "-";
                    return (
                      <tr key={s.id}>
                        <td>#{s.id}</td>
                        <td>{s.createdAt ? new Date(s.createdAt).toLocaleString() : "-"}</td>
                        <td>{customerName}</td>
                        <td>{customerPhone}</td>
                        <td>{customerAddress}</td>
                        <td>{Math.round(Number(s.total || 0))}</td>
                      </tr>
                    );
                  })}
                  {(!sales || sales.length === 0) && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: 16 }}>
                        No sales found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className={`panel ${printPanelId === "add-product" ? "print-panel-area" : ""}`}>
            <h3>Add Product</h3>
            <div style={{ marginBottom: 8 }}>
              <button className="btn secondary print-hide" type="button" onClick={() => handlePrintPanel("add-product")}>
                Print
              </button>
            </div>
            <form className="form" onSubmit={createProduct}>
              <div className="input-group">
                <label>Barcode</label>
                <input value={barcode} onChange={(e) => setBarcode(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Invoice price</label>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Billing price</label>
                <input type="number" value={billingPrice} onChange={(e) => setBillingPrice(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Stock</label>
                <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
              </div>
              <input
  value={newSupplierName}
  onChange={(e) => setNewSupplierName(e.target.value)}
  placeholder="Supplier name"
/>

<input
  value={newSupplierInvoiceNo}
  onChange={(e) => setNewSupplierInvoiceNo(e.target.value)}
  placeholder="Supplier invoice no"
/>

<input
  type="date"
  value={newReceivedDate}
  onChange={(e) => setNewReceivedDate(e.target.value)}
/>

<label className="btn ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
  📷 Invoice Photo
  <input
    type="file"
    accept="image/*"
    capture="environment"
    style={{ display: "none" }}
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => setNewInvoicePhoto(String(reader.result || ""));
      reader.readAsDataURL(file);
    }}
  />
</label>

{newInvoicePhoto ? (
  <div style={{ marginTop: 8 }}>
    <img src={newInvoicePhoto} alt="Invoice preview" style={{ maxWidth: 240, borderRadius: 8 }} />
  </div>
) : null}

              <button className="btn" type="submit" disabled={loading}>Save Product</button>
            </form>
          </div>

          <div className={`panel ${printPanelId === "create-user" ? "print-panel-area" : ""}`}>
            <h3>Create User</h3>
            <div style={{ marginBottom: 8 }}>
              <button className="btn secondary print-hide" type="button" onClick={() => handlePrintPanel("create-user")}>
                Print
              </button>
            </div>
            <form className="form" onSubmit={createUser}>
              <div className="input-group">
                <label>Username</label>
                <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button className="btn" type="submit" disabled={loading}>Create User</button>
            </form>
          </div>

          <div className={`panel ${printPanelId === "add-customer" ? "print-panel-area" : ""}`}>
            <h3>Add Customer</h3>
            <div style={{ marginBottom: 8 }}>
              <button className="btn secondary print-hide" type="button" onClick={() => handlePrintPanel("add-customer")}>
                Print
              </button>
            </div>
            <form className="form" onSubmit={createCustomer}>
              <div className="input-group">
                <label>Name</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value.replace(/[^A-Za-z\s]/g, ""))}
                  required
                />
              </div>
              <div className="input-group">
                <label>Phone</label>
                <input
                  value={customerPhone}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  onChange={(e) => setCustomerPhone(digitsOnly(e.target.value).slice(0, 10))}
                  required
                />
              </div>
              <div className="input-group">
                <label>Address</label>
                <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} required />
              </div>
              <button
                className="btn"
                type="submit"
                disabled={loading || digitsOnly(customerPhone).length !== 10 || !nameRegex.test(customerName.trim())}
              >
                Save Customer
              </button>
            </form>
          </div>

          <div className={`panel panel-wide ${printPanelId === "customers" ? "print-panel-area" : ""}`}>
            <div className="table-tools">
              <div>
                <h3 style={{ margin: 0 }}>Customers</h3>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>Saved customer details</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn secondary print-hide" type="button" onClick={() => handlePrintPanel("customers")}>
                  Print
                </button>
                {!customersLoaded && (
                  <button className="btn secondary print-hide" type="button" onClick={loadCustomers} disabled={loading}>
                    Load Customers
                  </button>
                )}
                {customersLoaded && (
                  <button className="btn secondary print-hide" type="button" onClick={loadCustomers} disabled={loading}>
                    Refresh Customers
                  </button>
                )}
              </div>
            </div>

            {!customersLoaded && fastMode ? (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                Customers are paused to keep startup fast. Click "Load Customers" when needed.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Outstanding</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(customers || []).map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.phone}</td>
                      <td>{c.address}</td>
                      <td>{Number(customerOutstanding?.[c.id] || 0) > 0 ? Math.round(Number(customerOutstanding[c.id])) : "-"}</td>
                      <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                  {(!customers || customers.length === 0) && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: 16 }}>
                        No customers found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className={`panel panel-wide ${printPanelId === "users" ? "print-panel-area" : ""}`}>
            <div className="table-tools">
              <div>
                <h3 style={{ margin: 0 }}>Users</h3>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>Manage access roles</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn secondary print-hide" type="button" onClick={() => handlePrintPanel("users")}>
                  Print
                </button>
                {!usersLoaded && (
                  <button className="btn secondary print-hide" type="button" onClick={loadUsers} disabled={loading}>
                    Load Users
                  </button>
                )}
                {usersLoaded && (
                  <button className="btn secondary print-hide" type="button" onClick={loadUsers} disabled={loading}>
                    Refresh Users
                  </button>
                )}
              </div>
            </div>

            {!usersLoaded && fastMode ? (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                Users are paused to keep startup fast. Click “Load Users” when needed.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>
                        <select
                          value={roleEdits[u.id] ?? u.role}
                          onChange={(e) => setRoleEdits((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        >
                          <option value="admin">Admin</option>
                          <option value="cashier">Cashier</option>
                        </select>
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button className="btn secondary" type="button" onClick={() => updateRole(u.id)}>
                            Update Role
                          </button>
                          <button className="btn ghost" type="button" onClick={() => deleteUser(u.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", padding: 16 }}>
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );


}
