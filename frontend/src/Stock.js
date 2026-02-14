import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";

export default function Stock() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState([]);
  const [productsTotal, setProductsTotal] = useState(0);

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [editingBarcode, setEditingBarcode] = useState(null);
  const [editValues, setEditValues] = useState({ name: "", price: "", billingPrice: "", stock: "" });
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [previewImage, setPreviewImage] = useState("");

  const normalizeInvoicePhoto = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("data:image/")) return raw;
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("file://")) return raw;
    return `data:image/jpeg;base64,${raw}`;
  };

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
      if (productsLoaded) {
        await loadProducts(page);
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  return (
    <div className="admin-shell">
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

        .banner {
          background: var(--panel);
          color: var(--text);
          border: 1px solid var(--border);
          padding: 10px 14px;
          border-radius: 10px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .panel {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
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

        @media (max-width: 640px) {
          .title h2 { font-size: 22px; }
        }
      `}</style>

      <div className="admin-content">
        <div className="topbar">
          <div className="title">
            <h2>Stock</h2>
            <span>Search, edit, and delete items</span>
          </div>
          <div className="actions">
            <button className="btn ghost" onClick={() => navigate("/admin")}>Back</button>
          </div>
        </div>

        {msg && <div className="banner">{msg}</div>}

        <div className="panel">
          <div className="table-tools">
            <div>
              <h3 style={{ margin: 0 }}>Products</h3>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Search, edit, and delete items</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input placeholder="Search by name or barcode" value={query} onChange={(e) => setQuery(e.target.value)} />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">Sort by name</option>
                <option value="price">Sort by price</option>
                <option value="stock">Sort by stock</option>
              </select>
              <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
              {!productsLoaded && (
                <button className="btn secondary" type="button" onClick={() => loadProducts(0)} disabled={loading}>
                  Load Products
                </button>
              )}
              {productsLoaded && (
                <button className="btn secondary" type="button" onClick={() => loadProducts(page)} disabled={loading}>
                  Refresh
                </button>
              )}
            </div>
          </div>

          {!productsLoaded ? (
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              Products are paused to keep startup fast. Click ???Load Products??? when needed.
            </div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Barcode</th>
                    <th>Name</th>
                    <th>Invoice Price</th>
                    <th>Billing Price</th>
                    <th>Stock</th>
                    <th>Total Value</th>
                    <th>Supplier</th>
                    <th>Invoice No</th>
                    <th>Received</th>
                    <th>Photo</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((p) => {
                    const isEditing = editingBarcode === p.barcode;
                    return (
                      <tr key={p.barcode}>
                        <td>{p.barcode}</td>
                        <td>
                          {isEditing ? (
                            <input
                              value={editValues.name}
                              onChange={(e) => setEditValues((prev) => ({ ...prev, name: e.target.value }))}
                            />
                          ) : (
                            p.name
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editValues.price}
                              onChange={(e) => setEditValues((prev) => ({ ...prev, price: e.target.value }))}
                            />
                          ) : (
                            p.price
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editValues.billingPrice}
                              onChange={(e) => setEditValues((prev) => ({ ...prev, billingPrice: e.target.value }))}
                            />
                          ) : (
                            p.billingPrice
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editValues.stock}
                              onChange={(e) => setEditValues((prev) => ({ ...prev, stock: e.target.value }))}
                            />
                          ) : (
                            p.stock
                          )}
                        </td>
                        <td>{Number(p.price || 0) * Number(p.stock || 0)}</td>
                        <td>{p.supplierName || "-"}</td>
                        <td>{p.supplierInvoiceNo || "-"}</td>
                        <td>{p.receivedDate ? new Date(p.receivedDate).toLocaleDateString() : "-"}</td>
                        <td>
                          {p.invoicePhoto ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button
                                className="btn ghost"
                                type="button"
                                onClick={() => setPreviewImage(normalizeInvoicePhoto(p.invoicePhoto))}
                              >
                                View
                              </button>
                              <button
                                className="btn ghost"
                                type="button"
                                onClick={() => window.open(normalizeInvoicePhoto(p.invoicePhoto), "_blank")}
                              >
                                Open
                              </button>
                            </div>
                          ) : "-"}
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button className="btn" type="button" onClick={() => saveEdit(p.barcode)}>
                                Save
                              </button>
                              <button className="btn secondary" type="button" onClick={cancelEdit}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button className="btn secondary" type="button" onClick={() => startEdit(p)}>
                                Edit
                              </button>
                              <button className="btn ghost" type="button" onClick={() => deleteProduct(p.barcode)}>
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {visibleProducts.length === 0 && (
                    <tr>
                      <td colSpan="11" style={{ textAlign: "center", padding: 16 }}>
                        No products match your filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 12 }}>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={loading || page === 0}
                  onClick={() => loadProducts(page - 1)}
                >
                  Prev
                </button>
                <span>
                  Page {page + 1} of {Math.max(1, Math.ceil(productsTotal / pageSize))}
                </span>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={loading || (page + 1) * pageSize >= productsTotal}
                  onClick={() => loadProducts(page + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {previewImage ? (
        <div className="overlay" onClick={() => setPreviewImage("")}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Invoice Photo</h3>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <img
                src={previewImage}
                alt="Invoice"
                style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: 8, border: "1px solid var(--border)" }}
              />
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn secondary" type="button" onClick={() => window.open(previewImage, "_blank")}>
                Open in New Tab
              </button>
              <button className="btn" type="button" onClick={() => setPreviewImage("")}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

