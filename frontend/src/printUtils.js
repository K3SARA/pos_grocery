export function applyReceiptPrint() {
  if (typeof document === "undefined") return;

  document.body.classList.add("receipt-print");

  let style = document.getElementById("receipt-print-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "receipt-print-style";
    style.textContent = "@media print { @page { size: 104mm 300mm; margin: 0; } }";
    document.head.appendChild(style);
  }
}

export function cleanupReceiptPrint() {
  if (typeof document === "undefined") return;

  document.body.classList.remove("receipt-print");

  const style = document.getElementById("receipt-print-style");
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
  }
}
