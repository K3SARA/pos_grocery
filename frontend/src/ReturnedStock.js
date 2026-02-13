import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";

export default function ReturnedStock() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [returnsList, setReturnsList] = useState([]);
  const [msg, setMsg] = useState("");

  const loadReturns = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/returns");
      setReturnsList(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg("Error: " + e.message);
      setReturnsList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, []);

  const rows = useMemo(() => {
    return (returnsList || []).flatMap((r) =>
      (r.items || []).map((it) => ({
        returnId: r.id,
        saleId: r.saleId,
        reason: r.reason,
        returnToStock: r.returnToStock,
        createdAt: r.createdAt,
        qty: it.qty,
        price: it.price,
        productName: it.product?.name || "Item",
        barcode: it.product?.barcode || it.saleItem?.barcode || "-",
      }))
    );
  }, [returnsList]);

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
      `}</style>

      <div className="admin-content">
        <div className="topbar">
          <div className="title">
            <h2>Returned Stock</h2>
            <span>Items returned from sales</span>
          </div>
          <div className="actions">
            <button className="btn ghost" onClick={() => navigate("/admin")}>Back</button>
          </div>
        </div>

        {msg && <div className="banner">{msg}</div>}

        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Returned Items</h3>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Return details by item</span>
            </div>
            <button className="btn secondary" type="button" onClick={loadReturns} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th>Return #</th>
                <th>Sale #</th>
                <th>Item</th>
                <th>Barcode</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.returnId}-${r.barcode}-${idx}`}>
                  <td>#{r.returnId}</td>
                  <td>#{r.saleId}</td>
                  <td>{r.productName}</td>
                  <td>{r.barcode}</td>
                  <td>{r.qty}</td>
                  <td>{r.price}</td>
                  <td>{r.reason}</td>
                  <td>{r.returnToStock ? "Restocked" : "Damaged/Expired"}</td>
                  <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: 16 }}>
                    No returned items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
