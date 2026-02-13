-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "stock" INTEGER NOT NULL,
    "damagedStock" INTEGER NOT NULL DEFAULT 0,
    "supplierName" TEXT,
    "supplierInvoiceNo" TEXT,
    "supplierPaymentMethod" TEXT,
    "receivedDate" DATETIME,
    "invoicePhoto" TEXT
);
INSERT INTO "new_Product" ("barcode", "id", "invoicePhoto", "name", "price", "receivedDate", "stock", "supplierInvoiceNo", "supplierName", "supplierPaymentMethod") SELECT "barcode", "id", "invoicePhoto", "name", "price", "receivedDate", "stock", "supplierInvoiceNo", "supplierName", "supplierPaymentMethod" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
