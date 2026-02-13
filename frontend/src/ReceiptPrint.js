import React from "react";

export default function ReceiptPrint(props) {
  const {
    layout = {},
    companyName = layout.companyName || "Apex Logistics",
    layoutMode = "3inch", // "3inch" | "a4"
    headerLines = Array.isArray(layout.headerLines) ? layout.headerLines : [],
    footerLines = Array.isArray(layout.footerLines) ? layout.footerLines : [],
    showItemsHeading = layout.showItemsHeading ?? true,
    showCustomer = layout.showCustomer ?? true,
    showTotals = layout.showTotals ?? true,
    showPayment = layout.showPayment ?? true,
    saleId = "",
    dateText = "",
    items = [],
    subtotal = 0,
    discount = 0,
    grandTotal = 0,
    customerName = "",
    customerPhone = "",
    customerAddress = "",
    paymentMethod = "cash",
    cashReceived = "",
    balance = 0,
  } = props;

  const freeItems = (items || [])
    .map((i) => ({
      name: i.name,
      qty: Number(i.freeIssue ? i.qty : i.freeQty || 0) || 0,
    }))
    .filter((i) => i.qty > 0);
  const freeItemsText = freeItems.map((i) => `${i.name} x${i.qty}`).join(", ");

  if (layoutMode === "a4") {
    return (
      <div className="receipt a4" style={{ color: "#000", fontSize: 12 }}>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 18 }}>{companyName}</div>
        {headerLines.map((line, idx) => (
          <div key={`hdr-${idx}`} style={{ textAlign: "center", fontSize: 12 }}>
            {line}
          </div>
        ))}

        <div style={{ borderTop: "1px solid #000", margin: "10px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <div>Sale: #{saleId || "-"}</div>
          <div>Date: {dateText || new Date().toLocaleString()}</div>
        </div>

        {showCustomer && (customerName || customerPhone || customerAddress) && (
          <div style={{ marginTop: 6, fontSize: 12 }}>
            <div>Customer: {customerName || "-"}</div>
            <div>Phone: {customerPhone || "-"}</div>
            <div>Address: {customerAddress || "-"}</div>
          </div>
        )}

        <div style={{ borderTop: "1px solid #000", margin: "10px 0" }} />

        {showItemsHeading && <div style={{ fontWeight: 700, marginBottom: 6 }}>Items</div>}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #000", paddingBottom: 4 }}>Item</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #000", paddingBottom: 4 }}>Qty</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #000", paddingBottom: 4 }}>Price</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #000", paddingBottom: 4 }}>Disc</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #000", paddingBottom: 4 }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const price = Number(i.price) || 0;
              const qty = Number(i.qty) || 0;
              const base = price * qty;
              const t = i.itemDiscountType || "none";
              const v = Number(i.itemDiscountValue || 0);
              let itemDiscount = 0;
              if (t === "amount") {
                itemDiscount = Math.max(0, Math.min(v, base));
              } else if (t === "percent") {
                const pct = Math.max(0, Math.min(v, 100));
                itemDiscount = Math.round((base * pct) / 100);
              }
              const lineTotal = Math.max(0, base - itemDiscount);
              return (
                <tr key={`${i.barcode}-${i.name}`}>
                  <td style={{ padding: "6px 0" }}>{i.name}</td>
                  <td style={{ textAlign: "right" }}>{qty}</td>
                  <td style={{ textAlign: "right" }}>{price.toFixed(2)}</td>
                  <td style={{ textAlign: "right" }}>{itemDiscount ? itemDiscount.toFixed(2) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {freeItems.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <span style={{ fontWeight: 700 }}>Free Items:</span>{" "}
            <span>{freeItemsText}</span>
          </div>
        )}

        <div style={{ borderTop: "1px solid #000", margin: "10px 0" }} />

        {showTotals && (
          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Subtotal</span><span>{Number(subtotal).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Discount</span><span>{Number(discount).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Total</span><span>{Number(grandTotal).toFixed(2)}</span>
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px solid #000", margin: "10px 0" }} />

        {showPayment && (
          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Payment</span><span>{paymentMethod}</span>
            </div>
            {paymentMethod === "cash" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Cash</span><span>{Number(cashReceived || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Change</span><span>{Number(balance || 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ borderTop: "1px solid #000", margin: "10px 0" }} />
        {footerLines.map((line, idx) => (
          <div key={`ftr-${idx}`} style={{ textAlign: "center", fontSize: 11 }}>
            {line}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="receipt">
      <div className="center bold title">{companyName}</div>
      {headerLines.map((line, idx) => (
        <div key={`hdr-${idx}`} className="center small">
          {line}
        </div>
      ))}

      <div className="hr" />

      <div className="row">
        <span>Sale:</span><span>#{saleId || "-"}</span>
      </div>
      <div className="row">
        <span>Date:</span><span>{dateText || new Date().toLocaleString()}</span>
      </div>
      {showCustomer && (customerName || customerPhone || customerAddress) && (
        <>
          <div className="row">
            <span>Customer:</span><span>{customerName || "-"}</span>
          </div>
          <div className="row">
            <span>Phone:</span><span>{customerPhone || "-"}</span>
          </div>
          <div className="row">
            <span>Address:</span><span>{customerAddress || "-"}</span>
          </div>
        </>
      )}

      <div className="hr" />

      {showItemsHeading && <div className="bold">Items</div>}
      {items.map((i) => {
        const price = Number(i.price) || 0;
        const qty = Number(i.qty) || 0;
        const base = price * qty;
        const t = i.itemDiscountType || "none";
        const v = Number(i.itemDiscountValue || 0);
        let itemDiscount = 0;
        if (t === "amount") {
          itemDiscount = Math.max(0, Math.min(v, base));
        } else if (t === "percent") {
          const pct = Math.max(0, Math.min(v, 100));
          itemDiscount = Math.round((base * pct) / 100);
        }
        const lineTotal = Math.max(0, base - itemDiscount);

        return (
          <div key={`${i.barcode}-${i.name}`} className="item">
            <div className="itemName">{i.name}</div>
            <div className="row">
              <span>{qty} x {price.toFixed(2)}</span>
              <span>{lineTotal.toFixed(2)}</span>
            </div>
            {itemDiscount > 0 && (
              <div className="row small">
                <span>Item Discount</span>
                <span>-{itemDiscount.toFixed(2)}</span>
              </div>
            )}
          </div>
        );
      })}

      {freeItems.length > 0 && (
        <div className="row small" style={{ marginTop: 4 }}>
          <span>Free Items</span>
          <span>{freeItemsText}</span>
        </div>
      )}

      <div className="hr" />

      {showTotals && (
        <>
          <div className="row"><span>Subtotal</span><span>{Number(subtotal).toFixed(2)}</span></div>
          <div className="row"><span>Discount</span><span>{Number(discount).toFixed(2)}</span></div>
          <div className="row bold"><span>Total</span><span>{Number(grandTotal).toFixed(2)}</span></div>
        </>
      )}

      <div className="hr" />

      {showPayment && (
        <>
          <div className="row"><span>Payment</span><span>{paymentMethod}</span></div>
          {paymentMethod === "cash" && (
            <>
              <div className="row"><span>Cash</span><span>{Number(cashReceived || 0).toFixed(2)}</span></div>
              <div className="row"><span>Change</span><span>{Number(balance || 0).toFixed(2)}</span></div>
            </>
          )}
        </>
      )}

      <div className="hr" />
      {footerLines.map((line, idx) => (
        <div key={`ftr-${idx}`} className="center small">
          {line}
        </div>
      ))}
    </div>
  );
}
