import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";
import { useNavigate } from "react-router-dom";

function toDateInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ItemWiseReport() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(toDateInputValue(today));
  const [to, setTo] = useState(toDateInputValue(today));

  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setMsg("");
    setLoading(true);
    try {
      const data = await apiFetch(`/reports/items?from=${from}&to=${to}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg("Error: " + e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalQty = rows.reduce((a, r) => a + Number(r.qty || 0), 0);
  const totalSales = rows.reduce((a, r) => a + Number(r.total || 0), 0);

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Item-wise Report</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" type="button" onClick={() => navigate("/admin")}>
            Back
          </button>
          <button className="btn secondary" type="button" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Date Range</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn" type="button" onClick={load} disabled={loading}>
            Load
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Summary</h3>
        <div style={{ lineHeight: 1.9 }}>
          <div>Total items sold (qty): <b>{totalQty}</b></div>
          <div>Total sales: <b>Rs {Math.round(totalSales)}</b></div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Items</h3>
        {msg ? <div style={{ color: "crimson", marginBottom: 10 }}>{msg}</div> : null}

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 10 }}>Barcode</th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 10 }}>Item</th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "right", padding: 10 }}>Qty</th>
              <th style={{ borderBottom: "1px solid #ddd", textAlign: "right", padding: 10 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10 }}>{r.barcode || "-"}</td>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10 }}>{r.name || "-"}</td>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10, textAlign: "right" }}>
                  {Number(r.qty || 0)}
                </td>
                <td style={{ borderBottom: "1px solid #f1f1f1", padding: 10, textAlign: "right" }}>
                  Rs {Math.round(Number(r.total || 0))}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="4" style={{ padding: 16, textAlign: "center" }}>
                  No data for selected range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
