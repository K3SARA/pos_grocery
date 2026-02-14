import React, { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { useNavigate } from "react-router-dom";
import ReceiptPrint from "./ReceiptPrint";
import { applyReceiptPrint, cleanupReceiptPrint } from "./printUtils";

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [openSaleId, setOpenSaleId] = useState(null);
  const [printSale, setPrintSale] = useState(null);
  const [printPrompt, setPrintPrompt] = useState(false);
  const [printLayoutMode, setPrintLayoutMode] = useState("3inch");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadSales = async () => {
    setMsg("");
    try {
      setLoading(true);
      const data = await apiFetch("/sales");
      setSales(data);
    } catch (e) {
      setMsg("??? " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
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

  const getBillLayoutFromStorage = () => {
    const DEFAULT_BILL_LAYOUT = {
      companyName: "Plus Vision",
      headerText: "Aluviharaya, Matale\nMobile: +94770654279\nThank you! Visit again",
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

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>???? Sales History</h2>
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

      {sales.length === 0 ? (
        <p style={{ marginTop: 10, color: "#666" }}>No sales found.</p>
      ) : (
        <div style={{ marginTop: 10 }}>
          {sales.map((s) => (
            <div key={s.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <b>Sale #{s.id}</b>{" "}
                  {s.createdAt && (
                    <span style={{ color: "#666", fontSize: 12 }}>
                      ({new Date(s.createdAt).toLocaleString()})
                    </span>
                  )}
                  <div>Total: <b>{s.total}</b></div>
                </div>

                <button onClick={() => setOpenSaleId(openSaleId === s.id ? null : s.id)}>
                  {openSaleId === s.id ? "Hide" : "View"}
                </button>
                {openSaleId === s.id && (
                  <button onClick={() => setPrintSale(s)} style={{ marginLeft: 8 }}>
                    Print
                  </button>
                )}
              </div>

              {openSaleId === s.id && (
                <div style={{ marginTop: 10 }}>
                  {(s.customer?.name || s.customer?.phone || s.customer?.address) && (
                    <div style={{ marginBottom: 8, fontSize: 13 }}>
                      <div>Customer: <b>{s.customer?.name || "-"}</b></div>
                      <div>Phone: <b>{s.customer?.phone || "-"}</b></div>
                      <div>Address: <b>{s.customer?.address || "-"}</b></div>
                    </div>
                  )}
                  <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ color: "#000" }}>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Free Qty</th>
                        <th>Price</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(s.saleItems || []).map((si) => (
                        <tr key={si.id}>
                          <td>{si.product?.name || "Unknown"}</td>
                          <td>{si.qty}</td>
                          <td>{si.freeQty ?? 0}</td>
                          <td>{si.price}</td>
                          <td>{si.price * si.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {printSale && (
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
          onClick={() => {
            setPrintSale(null);
            setPrintPrompt(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              color: "#000",
              width: "min(520px, 100%)",
              borderRadius: 10,
              padding: 16,
              border: "1px solid #ddd",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ marginTop: 0 }}>Print Bill</h3>
              <button
                onClick={() => {
                  setPrintSale(null);
                  setPrintPrompt(false);
                }}
              >
                ???
              </button>
            </div>

            <div id="print-area" style={{ background: "#fff", padding: 10, borderRadius: 8 }}>
                <ReceiptPrint
                  layout={(() => {
                    const layout = getBillLayoutFromStorage();
                    return {
                    ...layout,
                    headerLines: String(layout.headerText || "")
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                      footerLines: String(layout.footerText || "")
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                    };
                  })()}
                  layoutMode={printLayoutMode}
                  saleId={printSale.id}
                dateText={printSale.createdAt ? new Date(printSale.createdAt).toLocaleString() : ""}
                customerName={printSale.customer?.name || ""}
                customerPhone={printSale.customer?.phone || ""}
                customerAddress={printSale.customer?.address || ""}
                items={(printSale.saleItems || []).map((si) => ({
                  barcode: si.product?.barcode || si.barcode || "",
                  name: si.product?.name || si.name || "Item",
                  qty: si.qty,
                  freeQty: si.freeQty ?? 0,
                  price: si.price ?? si.product?.price ?? 0,
                  itemDiscountType: si.itemDiscountType || "none",
                  itemDiscountValue: si.itemDiscountValue ?? 0,
                }))}
                subtotal={Number(
                  printSale.subtotal ??
                    (Number(printSale.total ?? printSale.grandTotal ?? 0) +
                      Number(printSale.discountAmount ?? printSale.discount ?? 0))
                )}
                discount={Number(printSale.discountAmount ?? printSale.discount ?? 0)}
                grandTotal={Number(printSale.total ?? printSale.grandTotal ?? 0)}
                paymentMethod={printSale.paymentMethod || "cash"}
                cashReceived={printSale.cashReceived ?? 0}
                balance={printSale.balance ?? 0}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={() => setPrintPrompt(true)} style={{ padding: 10 }}>
                Print
              </button>
              <button
                onClick={() => {
                  setPrintSale(null);
                  setPrintPrompt(false);
                }}
                style={{ padding: 10 }}
              >
                Close
              </button>
            </div>

            {printPrompt && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Print Size</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => {
                      setPrintLayoutMode("3inch");
                      setPrintPrompt(false);
                      runReceiptPrint();
                    }}
                    style={{ padding: 10 }}
                  >
                    3 Inch
                  </button>
                  <button
                    onClick={() => {
                      setPrintLayoutMode("a4");
                      setPrintPrompt(false);
                      runReceiptPrint();
                    }}
                    style={{ padding: 10 }}
                  >
                    A4
                  </button>
                  <button onClick={() => setPrintPrompt(false)} style={{ padding: 10 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}




