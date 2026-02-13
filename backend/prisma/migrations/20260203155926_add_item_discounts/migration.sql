/*
  Warnings:

  - Made the column `barcode` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "SaleItem_barcode_key";

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN "itemDiscountType" TEXT;
ALTER TABLE "SaleItem" ADD COLUMN "itemDiscountValue" DECIMAL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "stock" INTEGER NOT NULL,
    "supplierName" TEXT,
    "supplierInvoiceNo" TEXT,
    "receivedDate" DATETIME,
    "invoicePhoto" TEXT
);
INSERT INTO "new_Product" ("barcode", "id", "invoicePhoto", "name", "price", "receivedDate", "stock", "supplierInvoiceNo", "supplierName") SELECT "barcode", "id", "invoicePhoto", "name", "price", "receivedDate", "stock", "supplierInvoiceNo", "supplierName" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
