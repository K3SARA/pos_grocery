import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";


import { PrismaClient, Prisma } from "@prisma/client";


dotenv.config();

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// ------------------- TYPES -------------------
type AuthedRequest = express.Request & { user?: any };

// ------------------- AUTH MIDDLEWARE -------------------


const auth = (req: any, res: any, next: any) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET as string);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

function requireRole(role: "admin" | "cashier") {
  return (req: any, res: any, next: any) => {
    if (!req.user?.role) return res.status(401).json({ error: "No user" });
    if (req.user.role !== role) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

function adminOnly(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}
const requireAnyRole = (...roles: Array<"admin" | "cashier">) => {
  return (req: any, res: any, next: any) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
};


// ------------------- ROOT -------------------
app.get("/", (req, res) => {
  res.send("POS Backend Running");
});

// DB check (kept)
app.get("/health/db", async (req, res) => {
  try {
    // Works on ALL DBs
    await prisma.user.findFirst();
    res.json({ db: "ok" });
  } catch (e: any) {
    res.status(500).json({ db: "fail", message: e.message });
  }
});

// ------------------- AUTH ROUTES -------------------

// Create first admin ONLY if no users exist
app.post("/auth/setup-admin", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "username and password required" });
    }

    const existing = await prisma.user.findFirst();
    if (existing) {
      return res.status(200).json({
        message: "Setup already done",
        firstUser: { id: existing.id, username: existing.username, role: existing.role },
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hash, role: "admin" },
    });

    return res.status(201).json({
      message: "Admin created",
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: "setup-admin failed", details: e.message });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const u = String(username || "").trim();
    const p = String(password || "");

    if (!u || !p) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const user = await prisma.user.findUnique({ where: { username: u } });
    console.log("LOGIN ATTEMPT:", { u, p });
console.log("DB USER FOUND:", user?.username);
console.log("DB PASSWORD HASH:", user?.password);
    if (!user) {
      return res.status(401).json({ error: "Invalid username/password" });
    }

    // ✅ Cashiers are bcrypt-hashed; admin may be plain (for now)
    let ok = false;
    if (typeof user.password === "string" && user.password.startsWith("$2")) {
      ok = await bcrypt.compare(p, user.password);
    } else {
      ok = user.password === p; // legacy plain-text fallback
    }

    if (!ok) {
      return res.status(401).json({ error: "Invalid username/password" });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ error: "JWT_SECRET is not set" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Login failed" });
  }
});



// ------------------- USERS (admin) -------------------

// List users (admin only)
app.get("/users", auth, requireRole("admin"), async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true },
    orderBy: { id: "desc" },
  });
  res.json(users);
});

// Create user (admin only)
app.post("/users", auth, requireRole("admin"), async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "username/password required" });

    const safeRole = role === "admin" ? "admin" : "cashier";
    const hash = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
      data: { username: String(username), password: hash, role: safeRole },
      select: { id: true, username: true, role: true },
    });

    res.status(201).json(user);
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "Username already exists" });
    res.status(500).json({ error: "Failed to create user" });
  }
});
// Reset user password (admin only)
app.put("/users/:id/password", auth, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { password } = req.body || {};

    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid user id" });
    if (!password || String(password).trim().length < 4) {
      return res.status(400).json({ error: "password must be at least 4 characters" });
    }

    const hash = await bcrypt.hash(String(password), 10);

    const updated = await prisma.user.update({
      where: { id },
      data: { password: hash },
      select: { id: true, username: true, role: true },
    });

    res.json({ message: "Password reset", user: updated });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to reset password" });
  }
});


// Update user role (admin only)
app.put("/users/:id/role", auth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body || {};

  if (!id) return res.status(400).json({ error: "invalid user id" });
  if (role !== "admin" && role !== "cashier") {
    return res.status(400).json({ error: "invalid role" });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, username: true, role: true },
    });
    res.json(user);
  } catch (e: any) {
    return res.status(404).json({ error: "User not found" });
  }
});

// Delete user (admin only)
app.delete("/users/:id", auth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid user id" });
  if ((req as any).user?.userId === id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  try {
    await prisma.user.delete({ where: { id } });
    res.json({ message: "User deleted" });
  } catch (e: any) {
    return res.status(404).json({ error: "User not found" });
  }
});

// ------------------- CUSTOMER API -------------------

// Create customer (admin OR cashier)
app.post("/customers", auth, async (req, res) => {
  try {
    const { name, phone, address } = req.body || {};

    const safeName = String(name || "").trim();
    const safePhone = phone ? String(phone).trim() : null;
    const safeAddress = address ? String(address).trim() : null;

    if (!safeName) {
      return res.status(400).json({ error: "Customer name is required" });
    }

    const customer = await prisma.customer.create({
      data: {
        name: safeName,
        phone: safePhone && safePhone.length ? safePhone : null,
        address: safeAddress && safeAddress.length ? safeAddress : null,
      },
    });

    return res.status(201).json(customer);
  } catch (e: any) {
    console.error("Create customer error:", e);
    if (e?.code === "P2002") {
      return res.status(400).json({ error: "Phone number already exists" });
    }
    return res.status(500).json({ error: "Failed to create customer" });
  }
});

/**
 * ✅ CASHIER + ADMIN customer dropdown/search (WORKS ALL DBs)
 * Fixes:
 * - no ILIKE
 * - no queryRaw
 * - no where: undefined (exactOptionalPropertyTypes safe)
 */
app.get("/customers", auth, async (req, res) => {
  const q = String(req.query.q || "").trim();

  try {
    const args: Prisma.CustomerFindManyArgs = {
      orderBy: { id: "desc" },
      take: 20,
    };

    if (q) {
      args.where = {
        OR: [{ name: { contains: q } }, { phone: { contains: q } }],
      };
    }

    const customers = await prisma.customer.findMany(args);
    return res.json(customers);
  } catch (e: any) {
    console.error("GET /customers error:", e);
    return res.status(500).json({ error: "Failed to load customers" });
  }
});

// ✅ ADMIN only: load all customers for admin dashboard table
app.get("/customers/all", auth, requireRole("admin"), async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { id: "desc" },
    });
    return res.json(customers);
  } catch (e: any) {
    console.error("GET /customers/all error:", e);
    return res.status(500).json({ error: "Failed to load customers" });
  }
});

// ------------------- PRODUCT API -------------------

// Get products (optionally paginated)
app.get("/products", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : null;
    const offset = req.query.offset ? Number(req.query.offset) : null;

    if (limit && Number.isFinite(limit)) {
      const take = Math.max(1, Math.min(limit, 200));
      const skip = offset && Number.isFinite(offset) ? Math.max(0, offset) : 0;

      const [items, total] = await Promise.all([
        prisma.product.findMany({ take, skip, orderBy: { name: "asc" } }),
        prisma.product.count(),
      ]);

      return res.json({ items, total, limit: take, offset: skip });
    }

    const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Search products by name or barcode
app.get("/products/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);

  try {
    const products = await prisma.product.findMany({
      where: { OR: [{ barcode: { contains: q } }, { name: { contains: q } }] },
      take: 20,
      orderBy: { name: "asc" },
    });

    res.json(products);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Search failed" });
  }
});

// Get product by barcode
app.get("/products/:barcode", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { barcode: String(req.params.barcode) },
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Create product (admin only)
// Create product (admin only)
app.post("/products", auth, requireRole("admin"), async (req, res) => {
  try {
    const {
      barcode,
      name,
      price,
      stock,
      supplierName,
      supplierInvoiceNo,
      supplierPaymentMethod,
      receivedDate,     // "YYYY-MM-DD" from frontend
      invoicePhoto,     // base64 data URL (optional)
    } = req.body || {};

    if (!barcode || !name) {
      return res.status(400).json({ error: "barcode and name required" });
    }

    // default receive date = today if not provided
    const rd = receivedDate ? new Date(String(receivedDate)) : new Date();

    const p = await prisma.product.create({
      data: {
        barcode: String(barcode),
        name: String(name),
        price: new Prisma.Decimal(Number(price || 0)),
        stock: Number(stock || 0),

        // ✅ new optional fields
        supplierName: supplierName ? String(supplierName) : null,
        supplierInvoiceNo: supplierInvoiceNo ? String(supplierInvoiceNo) : null,
        supplierPaymentMethod: supplierPaymentMethod ? String(supplierPaymentMethod) : null,
        receivedDate: rd,
        invoicePhoto: invoicePhoto ? String(invoicePhoto) : null,
      },
    });

    res.status(201).json(p);
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "Barcode already exists" });
    res.status(500).json({ error: "Failed to create product" });
  }
});


// Update product (admin only)
app.put("/products/:barcode", auth, requireRole("admin"), async (req, res) => {
  try {
    const { name, price, stock } = req.body || {};
    const barcode = String(req.params.barcode);

    const updated = await prisma.product.update({
      where: { barcode },
      data: {
        ...(name !== undefined ? { name: String(name) } : {}),
        ...(price !== undefined ? { price: new Prisma.Decimal(Number(price)) } : {}),
        ...(stock !== undefined ? { stock: Number(stock) } : {}),
      },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to update product" });
  }
});


// Delete product (admin only)
app.delete("/products/:barcode", auth, requireRole("admin"), async (req, res) => {
  try {
    await prisma.product.delete({ where: { barcode: String(req.params.barcode) } });
    res.json({ message: "Product deleted" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to delete product" });
  }
});
// Customers: admin + cashier can read/write
app.get("/customers", auth, requireAnyRole("admin", "cashier"), async (req, res) => {
  const q = String(req.query.q ?? "").trim();

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      }
    : null;

  const customers = await prisma.customer.findMany({
    ...(where ? { where } : {}),
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json(customers);
});

app.get("/customers/:id", auth, requireAnyRole("admin", "cashier"), async (req, res) => {
  const id = String(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid customer id" });
  }

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  res.json(customer);
});


app.post("/customers", auth, requireAnyRole("admin", "cashier"), async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body || {};
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: "Customer name is required" });
    }

    const created = await prisma.customer.create({
  data: {
    name: String(name).trim(),
    phone: phone ? String(phone).trim() : null,
    address: address ? String(address).trim() : null,
  },
});


    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to create customer" });
  }
});

app.put("/customers/:id", auth, requireAnyRole("admin", "cashier"), async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid customer id" });
    }

    const { name, phone, address, notes, isActive } = req.body || {};

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
        ...(address !== undefined ? { address: address ? String(address).trim() : null } : {}),
        ...(notes !== undefined ? { notes: notes ? String(notes).trim() : null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to update customer" });
  }
});


app.delete("/customers/:id", auth, requireAnyRole("admin", "cashier"), async (req, res) => {
  try {
    const id = String(req.params.id).trim();
    if (!id) return res.status(400).json({ error: "Invalid customer id" });

    const updated = await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to deactivate customer" });
  }
});



// ------------------- SALES API -------------------

// Create a sale (cashier/admin)
app.post("/sales", auth, async (req: AuthedRequest, res) => {
  const { items, customer, paymentMethod, discountType, discountValue } = req.body || {};

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No items provided" });
  }

  try {
    let total = 0;

    const sale = await prisma.$transaction(async (tx) => {
      // customer optional
      // customer optional
let customerId: string | null = null;

if (customer && typeof customer === "object") {
  const name = String(customer.name || "").trim();
  const phone = String(customer.phone || "").trim();
  const address = String(customer.address || "").trim();

  if (name) {
    const existing = phone
      ? await tx.customer.findFirst({ where: { phone } })
      : null;

    const cust = existing
      ? existing
      : await tx.customer.create({
          data: {
            name,
            phone: phone || null,
            address: address || null,
          },
        });

    // ✅ IMPORTANT: assign the customerId for the sale
    customerId = cust.id;
  }
}

      const pmRaw = String(paymentMethod || "cash").toLowerCase();
      const pm =
        pmRaw === "cash" || pmRaw === "card" || pmRaw === "credit" || pmRaw === "check"
          ? pmRaw
          : "cash";

      const dtRaw = String(discountType || "none").toLowerCase();
      const dt = dtRaw === "amount" || dtRaw === "percent" || dtRaw === "none" ? dtRaw : "none";
      const dv = Number(discountValue || 0);
      const safeDv = Number.isFinite(dv) ? dv : 0;

      const newSale = await tx.sale.create({
        data: {
          total: new Prisma.Decimal(0),
          ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
          paymentMethod: pm,
          discountType: dt,
          discountValue: new Prisma.Decimal(safeDv),
        },
      });

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { barcode: String(item.barcode) },
        });

        if (!product) throw new Error(`Product not found: ${item.barcode}`);

        const qty = Number(item.qty);
        const freeQty = Number(item.freeQty || 0);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("Invalid qty");
        if (!Number.isFinite(freeQty) || freeQty < 0) throw new Error("Invalid free qty");

        const requiredQty = qty + freeQty;
        if (product.stock < requiredQty) throw new Error(`Insufficient stock for ${product.name}`);

                const unitPrice = Number(product.price);
        const lineBase = unitPrice * qty;

        // ✅ item-wise discount from frontend (optional)
        const dtRaw = String(item.itemDiscountType || "none");
        const dt =
          dtRaw === "amount" || dtRaw === "percent" || dtRaw === "none" ? dtRaw : "none";

        const dv = Number(item.itemDiscountValue || 0);

        let lineDisc = 0;
        if (dt === "amount") {
          lineDisc = Number.isFinite(dv) ? dv : 0;
        } else if (dt === "percent") {
          const pct = Number.isFinite(dv) ? Math.max(0, Math.min(dv, 100)) : 0;
          lineDisc = (lineBase * pct) / 100;
        }

        // clamp discount to lineBase
        lineDisc = Math.max(0, Math.min(lineBase, lineDisc));

        const lineNet = lineBase - lineDisc;
        total += lineNet;

        await tx.saleItem.create({
          data: {
            sale: { connect: { id: newSale.id } },
            product: { connect: { id: product.id } },
            qty,
            freeQty,
            price: product.price,

            // ✅ save discount info in SaleItem (new columns)
            itemDiscountType: dt === "none" ? null : dt,
            itemDiscountValue: dt === "none" ? null : new Prisma.Decimal(lineDisc),
            barcode: product.barcode ?? String(item.barcode),

            // ❌ remove barcode from saleItem (recommended)
            // If your SaleItem still has barcode in schema, keep this line:
            // barcode: product.barcode ?? String(item.barcode),
          },
        });


        await tx.product.update({
          where: { id: product.id },
          data: { stock: product.stock - requiredQty },
        });
      }

      const subtotal = total;
      let saleDisc = 0;
      if (dt === "amount") {
        saleDisc = Math.max(0, Math.min(safeDv, subtotal));
      } else if (dt === "percent") {
        const pct = Math.max(0, Math.min(safeDv, 100));
        saleDisc = Math.round((subtotal * pct) / 100);
      }
      const finalTotal = Math.max(0, subtotal - saleDisc);

      return tx.sale.update({
        where: { id: newSale.id },
        data: {
          total: new Prisma.Decimal(finalTotal),
          discountType: dt,
          discountValue: new Prisma.Decimal(safeDv),
        },
      });
    });

    return res.status(201).json({ message: "Sale completed", sale });
  } catch (e: any) {
    console.error(e);
    return res.status(400).json({ error: e.message || "Sale failed" });
  }
});

// Get sales history
app.get("/sales", auth, async (req, res) => {
  const sales = await prisma.sale.findMany({
    include: {
      customer: true,
      saleItems: { include: { product: true } },
    },
    orderBy: { id: "desc" },
  });
  res.json(sales);
});

// Get one sale by id (for Returns screen)
app.get("/sales/:id", auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid sale id" });

  try {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        saleItems: { include: { product: true } },
      },
    });

    if (!sale) return res.status(404).json({ error: "Sale not found" });
    return res.json(sale);
  } catch (e: any) {
    console.error("GET /sales/:id error:", e);
    return res.status(500).json({ error: "Failed to load sale" });
  }
});

// Admin: Update a sale (edit bill)
app.put("/sales/:id", auth, adminOnly, async (req: AuthedRequest, res) => {
  const saleId = Number(req.params.id);
  if (!Number.isFinite(saleId)) return res.status(400).json({ error: "Invalid sale id" });

  const { items, paymentMethod, discountType, discountValue } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array is required" });
  }

  // normalize
  const normalized = items
    .map((it: any) => ({
      saleItemId: Number(it.saleItemId),
      qty: Number(it.qty),
      freeQty: Number(it.freeQty || 0),
      itemDiscountType: String(it.itemDiscountType || "none"),
      itemDiscountValue: Number(it.itemDiscountValue || 0),
    }))
    .filter(
      (x: any) =>
        Number.isFinite(x.saleItemId) &&
        Number.isFinite(x.qty) &&
        x.qty >= 0 &&
        Number.isFinite(x.freeQty) &&
        x.freeQty >= 0
    );

  if (normalized.length === 0) return res.status(400).json({ error: "invalid items" });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { saleItems: { include: { product: true } } },
      });
      if (!sale) throw new Error("Sale not found");

      const pmRaw = String(paymentMethod || sale.paymentMethod || "cash").toLowerCase();
      const pm =
        pmRaw === "cash" || pmRaw === "card" || pmRaw === "credit" || pmRaw === "check"
          ? pmRaw
          : "cash";

      const dtRaw = String(discountType || sale.discountType || "none").toLowerCase();
      const dt = dtRaw === "amount" || dtRaw === "percent" || dtRaw === "none" ? dtRaw : "none";
      const dv = Number(discountValue ?? sale.discountValue ?? 0);
      const safeDv = Number.isFinite(dv) ? dv : 0;

      const existingById = new Map<number, any>();
      for (const si of sale.saleItems) existingById.set(si.id, si);

      for (const it of normalized) {
        if (!existingById.has(it.saleItemId)) {
          throw new Error(`saleItemId ${it.saleItemId} not found in sale ${saleId}`);
        }
      }

      for (const it of normalized) {
        const oldItem = existingById.get(it.saleItemId);
        const oldQty = Number(oldItem.qty);
        const oldFreeQty = Number(oldItem.freeQty || 0);
        const newQty = it.qty;
        const newFreeQty = it.freeQty || 0;

        const diff = (newQty + newFreeQty) - (oldQty + oldFreeQty);

        if (diff > 0) {
          if (oldItem.product.stock < diff) {
            throw new Error(`Insufficient stock for ${oldItem.product.name}`);
          }
          await tx.product.update({
            where: { id: oldItem.productId },
            data: { stock: oldItem.product.stock - diff },
          });
        }

        if (diff < 0) {
          await tx.product.update({
            where: { id: oldItem.productId },
            data: { stock: oldItem.product.stock + Math.abs(diff) },
          });
        }

        const dtRaw = String(it.itemDiscountType || "none").toLowerCase();
        const dt = dtRaw === "amount" || dtRaw === "percent" || dtRaw === "none" ? dtRaw : "none";
        const dv = Number(it.itemDiscountValue || 0);
        const safeDv = Number.isFinite(dv) ? dv : 0;

        const lineBase = Number(oldItem.price) * newQty;
        let lineDisc = 0;
        if (dt === "amount") {
          lineDisc = Math.max(0, Math.min(safeDv, lineBase));
        } else if (dt === "percent") {
          const pct = Math.max(0, Math.min(safeDv, 100));
          lineDisc = (lineBase * pct) / 100;
        }

        if (newQty === 0) {
          await tx.saleItem.delete({ where: { id: oldItem.id } });
        } else {
          await tx.saleItem.update({
            where: { id: oldItem.id },
            data: {
              qty: newQty,
              freeQty: newFreeQty,
              itemDiscountType: dt === "none" ? null : dt,
              itemDiscountValue: dt === "none" ? null : new Prisma.Decimal(lineDisc),
            },
          });
        }
      }

      const refreshed = await tx.sale.findUnique({
        where: { id: saleId },
        include: { saleItems: true },
      });

      const subtotal = (refreshed?.saleItems || []).reduce((sum, si) => {
        const base = Number(si.price) * Number(si.qty);
        const disc = si.itemDiscountValue ? Number(si.itemDiscountValue) : 0;
        return sum + Math.max(0, base - disc);
      }, 0);

      let saleDisc = 0;
      if (dt === "amount") {
        saleDisc = Math.max(0, Math.min(safeDv, subtotal));
      } else if (dt === "percent") {
        const pct = Math.max(0, Math.min(safeDv, 100));
        saleDisc = Math.round((subtotal * pct) / 100);
      }
      const newTotalNum = Math.max(0, subtotal - saleDisc);


      const finalSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          total: new Prisma.Decimal(newTotalNum),
          paymentMethod: pm,
          discountType: dt,
          discountValue: new Prisma.Decimal(safeDv),
        },
        include: { saleItems: { include: { product: true } }, customer: true },
      });

      return finalSale;
    });

    return res.json({ message: "Sale updated", sale: updated });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || "Failed to update sale" });
  }
});

// Admin: Delete a sale (restore stock)
app.delete("/sales/:id", auth, adminOnly, async (req: AuthedRequest, res) => {
  const saleId = Number(req.params.id);
  if (!Number.isFinite(saleId)) {
    return res.status(400).json({ error: "Invalid sale id" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { saleItems: true },
      });

      if (!sale) throw new Error("Sale not found");

      for (const si of sale.saleItems) {
        await tx.product.update({
          where: { id: si.productId },
          data: { stock: { increment: si.qty } },
        });
      }

      await tx.saleItem.deleteMany({ where: { saleId } });
      await tx.sale.delete({ where: { id: saleId } });
    });

    res.json({ message: "Sale deleted successfully" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to delete sale" });
  }
});

// ------------------- DRAFT SALES -------------------
// Save a draft bill (cashier/admin)
app.post("/drafts", auth, async (req: AuthedRequest, res) => {
  try {
    const payload = req.body || {};
    const name = payload.name ? String(payload.name).trim() : null;

    const draftData = {
      cart: Array.isArray(payload.cart) ? payload.cart : [],
      customerEnabled: Boolean(payload.customerEnabled),
      customerName: payload.customerName ? String(payload.customerName) : "",
      customerPhone: payload.customerPhone ? String(payload.customerPhone) : "",
      customerAddress: payload.customerAddress ? String(payload.customerAddress) : "",
      discountType: payload.discountType ? String(payload.discountType) : "none",
      discountValue: payload.discountValue ?? "",
      paymentMethod: payload.paymentMethod ? String(payload.paymentMethod) : "cash",
      cashReceived: payload.cashReceived ?? "",
    };

    const createdById =
      typeof req.user?.id === "number" ? req.user.id : Number(req.user?.id || 0) || null;

    const draft = await prisma.draftSale.create({
      data: {
        name,
        data: draftData,
        createdById,
      },
    });

    res.status(201).json(draft);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to save draft" });
  }
});

// List drafts (cashier sees own; admin sees all)
app.get("/drafts", auth, async (req: AuthedRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = typeof req.user?.id === "number" ? req.user.id : Number(req.user?.id || 0);

    const draftsArgs: Prisma.DraftSaleFindManyArgs = {
      orderBy: { updatedAt: "desc" },
      take: 50,
    };

    if (role !== "admin") {
      draftsArgs.where = Number.isFinite(userId)
        ? { OR: [{ createdById: userId }, { createdById: null }] }
        : { createdById: -1 };
    }

    const drafts = await prisma.draftSale.findMany(draftsArgs);

    res.json(drafts);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to load drafts" });
  }
});

// Get one draft
app.get("/drafts/:id", auth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid draft id" });

  try {
    const draft = await prisma.draftSale.findUnique({ where: { id } });
    if (!draft) return res.status(404).json({ error: "Draft not found" });

    // cashier can only access own drafts
    if (req.user?.role !== "admin") {
      const userId = typeof req.user?.id === "number" ? req.user.id : Number(req.user?.id || 0);
      if (draft.createdById && draft.createdById !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    res.json(draft);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to load draft" });
  }
});

// Update a draft
app.put("/drafts/:id", auth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid draft id" });

  try {
    const existing = await prisma.draftSale.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Draft not found" });

    if (req.user?.role !== "admin") {
      const userId = typeof req.user?.id === "number" ? req.user.id : Number(req.user?.id || 0);
      if (existing.createdById && existing.createdById !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const payload = req.body || {};
    const name = payload.name ? String(payload.name).trim() : existing.name ?? null;

    const draftData = {
      cart: Array.isArray(payload.cart) ? payload.cart : [],
      customerEnabled: Boolean(payload.customerEnabled),
      customerName: payload.customerName ? String(payload.customerName) : "",
      customerPhone: payload.customerPhone ? String(payload.customerPhone) : "",
      customerAddress: payload.customerAddress ? String(payload.customerAddress) : "",
      discountType: payload.discountType ? String(payload.discountType) : "none",
      discountValue: payload.discountValue ?? "",
      paymentMethod: payload.paymentMethod ? String(payload.paymentMethod) : "cash",
      cashReceived: payload.cashReceived ?? "",
    };

    const updated = await prisma.draftSale.update({
      where: { id },
      data: { name, data: draftData },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to update draft" });
  }
});

// Delete a draft
app.delete("/drafts/:id", auth, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid draft id" });

  try {
    const existing = await prisma.draftSale.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Draft not found" });

    if (req.user?.role !== "admin") {
      const userId = typeof req.user?.id === "number" ? req.user.id : Number(req.user?.id || 0);
      if (existing.createdById && existing.createdById !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    await prisma.draftSale.delete({ where: { id } });
    res.json({ message: "Draft deleted" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to delete draft" });
  }
});

// ------------------- REPORTS / END-DAY -------------------

// Summary cards for dashboard + reports
app.get("/reports/summary", auth, async (req, res) => {
  try {
    const totalProducts = await prisma.product.count();
    const totalUsers = await prisma.user.count();
    const lowStock = await prisma.product.count({ where: { stock: { lte: 5 } } });

    const products = await prisma.product.findMany({
      select: { stock: true, price: true },
    });

    const totalStock = products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    const stockValue = products.reduce(
      (sum, p) => sum + Number(p.stock || 0) * Number(p.price || 0),
      0
    );

    const now = new Date();
    const start = new Date(now.toISOString().slice(0, 10) + "T00:00:00");
    const end = new Date(now.toISOString().slice(0, 10) + "T23:59:59");

    const todaySales = await prisma.sale.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { total: true },
    });

    const todayBills = todaySales.length;
    const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);

    res.json({
      totalProducts,
      totalStock,
      stockValue,
      lowStock,
      todayBills,
      todayRevenue,
      totalUsers,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to load summary" });
  }
});

// Remaining stock report + value
app.get("/reports/stock", auth, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: { id: true, barcode: true, name: true, stock: true, price: true },
      orderBy: { name: "asc" },
    });

    const rows = products.map((p) => ({
      id: p.id,
      barcode: p.barcode,
      name: p.name,
      stock: Number(p.stock || 0),
      price: Number(p.price || 0),
      value: Number(p.stock || 0) * Number(p.price || 0),
    }));

    const totalStock = rows.reduce((sum, r) => sum + r.stock, 0);
    const totalValue = rows.reduce((sum, r) => sum + r.value, 0);

    res.json({ totalStock, totalValue, rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to load stock report" });
  }
});

// Customer outstanding (credit sales per customer)
app.get("/reports/customer-outstanding", auth, async (req, res) => {
  try {
    const creditSales = await prisma.sale.findMany({
      where: { paymentMethod: "credit", customerId: { not: null } },
      include: { customer: true },
    });

    const map = new Map<
      string,
      { customerId: string; name: string; phone: string; address: string; outstanding: number }
    >();

    for (const s of creditSales) {
      if (!s.customerId || !s.customer) continue;
      const key = s.customerId;
      const existing = map.get(key) || {
        customerId: s.customerId,
        name: s.customer.name || "Unknown",
        phone: s.customer.phone || "",
        address: s.customer.address || "",
        outstanding: 0,
      };
      existing.outstanding += Number(s.total || 0);
      map.set(key, existing);
    }

    const rows = Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
    res.json({ rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to load customer outstanding" });
  }
});

// Get EndDay summary for a date (YYYY-MM-DD)
app.get("/reports/end-day", auth, async (req, res) => {
  const dateStr = String(req.query.date || "");
  if (!dateStr) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const start = new Date(dateStr + "T00:00:00");
  const end = new Date(dateStr + "T23:59:59");

  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { saleItems: true },
  });

  const billCount = sales.length;
  const totalItems = sales.reduce((sum, s) => sum + s.saleItems.reduce((a, i) => a + i.qty, 0), 0);
  const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);

  const closed = await prisma.endDay.findUnique({ where: { date: start } });

  res.json({
    date: dateStr,
    billCount,
    totalItems,
    totalSales,
    alreadyClosed: !!closed,
    closedRecord: closed || null,
  });
});

// ------------------- ANALYTICS -------------------
// Item-wise sales report (admin only)
// GET /reports/items?from=YYYY-MM-DD&to=YYYY-MM-DD
// Item-wise sales report (admin only)
// GET /reports/items?from=YYYY-MM-DD&to=YYYY-MM-DD
app.get("/reports/items", auth, requireRole("admin"), async (req, res) => {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");

    if (!from || !to) {
      return res.status(400).json({ error: "from and to dates are required" });
    }

    const start = new Date(from + "T00:00:00.000Z");
    const end = new Date(to + "T23:59:59.999Z");

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        saleItems: { include: { product: true } },
      },
    });

    const map = new Map<
      string,
      { barcode: string; name: string; qty: number; total: number }
    >();

    for (const s of sales) {
      for (const it of s.saleItems) {
        const barcode = String(it.product?.barcode || "");
        const name = String(it.product?.name || "Unknown item");

        const qty = Number(it.qty || 0);
        const price = Number(it.price || 0);
        const lineTotal = price * qty;

        const key = barcode || name;

        const prev = map.get(key);
        if (!prev) {
          map.set(key, { barcode, name, qty, total: lineTotal });
        } else {
          prev.qty += qty;
          prev.total += lineTotal;
        }
      }
    }

    const rows = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return res.json(rows);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Failed to load item report" });
  }
});


app.get("/reports/analytics", auth, requireRole("admin"), async (req, res) => {
  const days = Number(req.query.days || 7);
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(60, days)) : 7;

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - safeDays);

  try {
    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { saleItems: { include: { product: true } } },
      orderBy: { createdAt: "asc" },
    });

    let totalRevenue = 0;
    let totalBills = 0;
    let totalItems = 0;

    const totalsByDay = new Map<string, number>();
    const productMap = new Map<number, { id: number; name: string; qty: number; revenue: number }>();

    for (const sale of sales) {
      totalBills += 1;
      totalRevenue += Number(sale.total);

      const dayKey = sale.createdAt.toISOString().slice(0, 10);
      totalsByDay.set(dayKey, (totalsByDay.get(dayKey) || 0) + Number(sale.total));

      for (const item of sale.saleItems) {
        totalItems += item.qty;
        const key = item.productId;
        const existing = productMap.get(key) || {
          id: item.productId,
          name: item.product?.name || "Unknown",
          qty: 0,
          revenue: 0,
        };
        existing.qty += item.qty;
        existing.revenue += Number(item.price) * item.qty;
        productMap.set(key, existing);
      }
    }

    const avgTicket = totalBills ? totalRevenue / totalBills : 0;
    const avgItemsPerBill = totalBills ? totalItems / totalBills : 0;

    const daily = Array.from(totalsByDay.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    res.json({
      rangeDays: safeDays,
      totalRevenue,
      totalBills,
      totalItems,
      avgTicket,
      avgItemsPerBill,
      daily,
      topProducts,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Analytics failed" });
  }
});

// ------------------- RETURNS API -------------------

app.post("/returns", auth, async (req: AuthedRequest, res) => {
  try {
    const { saleId, reason, returnType, items } = req.body || {};

    if (!saleId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "saleId and items are required" });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: "reason is required" });
    }

    const reasonText = String(reason).trim();
    let type = String(returnType || "").trim().toUpperCase();
    if (!type) {
      const rr = reasonText.toUpperCase();
      if (rr.includes("DAMAGE") || rr.includes("DAMAGED") || rr.includes("EXPIRE") || rr.includes("EXPIRED")) {
        type = "DAMAGED_EXPIRED";
      } else if (rr.includes("GOOD")) {
        type = "GOOD";
      } else {
        type = "OTHER";
      }
    }
    const restock = type !== "DAMAGED_EXPIRED";

    // normalize items
    const normalized = items
      .map((it: any) => ({
        saleItemId: Number(it.saleItemId),
        qty: Number(it.qty),
      }))
      .filter((x: any) => Number.isFinite(x.saleItemId) && Number.isFinite(x.qty) && x.qty > 0);

    if (normalized.length === 0) return res.status(400).json({ error: "invalid items" });

    const created = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: Number(saleId) },
        include: { saleItems: true },
      });
      if (!sale) throw new Error("Sale not found");

      const r = await tx.saleReturn.create({
        data: {
          saleId: sale.id,
          reason: reasonText,
          returnToStock: restock,
          createdById: req.user?.userId ? Number(req.user.userId) : null,
          totalRefund: new Prisma.Decimal(0),
        },
      });

      let totalRefund = 0;

      for (const it of normalized) {
        const saleItem = await tx.saleItem.findUnique({
          where: { id: it.saleItemId },
          include: { product: true },
        });
        if (!saleItem) throw new Error("Sale item not found");

        if (saleItem.saleId !== sale.id) throw new Error("Sale item not belong to sale");

        const returnedAgg = await tx.returnItem.aggregate({
          where: { saleItemId: saleItem.id },
          _sum: { qty: true },
        });
        const alreadyReturned = Number(returnedAgg._sum.qty || 0);
        const remainingQty = Number(saleItem.qty) - alreadyReturned;

        if (remainingQty <= 0) {
          throw new Error("All quantity for this item has already been returned");
        }
        if (it.qty > remainingQty) {
          throw new Error("Return qty exceeds remaining qty");
        }

        const lineTotal = Number(saleItem.price) * it.qty;
        totalRefund += lineTotal;

        await tx.returnItem.create({
          data: {
            returnId: r.id,
            saleItemId: saleItem.id,
            productId: saleItem.productId,
            qty: it.qty,
            price: saleItem.price,
            lineTotal: new Prisma.Decimal(lineTotal),
          },
        });

        if (r.returnToStock) {
          await tx.product.update({
            where: { id: saleItem.productId },
            data: { stock: { increment: it.qty } },
          });
        } else {
          await tx.product.update({
            where: { id: saleItem.productId },
            data: { damagedStock: { increment: it.qty } },
          });
        }
      }

      const updatedReturn = await tx.saleReturn.update({
        where: { id: r.id },
        data: { totalRefund: new Prisma.Decimal(totalRefund) },
        include: {
          sale: true,
          createdBy: { select: { id: true, username: true, role: true } },
          items: {
            include: {
              product: true,
              saleItem: true,
            },
          },
        },
      });

      return updatedReturn;
    });

    return res.json(created);
  } catch (e: any) {
    console.error(e);
    return res.status(400).json({ error: e.message || "Return failed" });
  }
});

app.get("/returns", auth, async (req, res) => {
  try {
    const list = await prisma.saleReturn.findMany({
      orderBy: { id: "desc" },
      include: {
        sale: { include: { customer: true } },
        createdBy: { select: { id: true, username: true, role: true } },
        items: {
          include: {
            product: true,
            saleItem: true,
          },
        },
      },
    });
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load returns" });
  }
});

app.get("/returns/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid return id" });
    const ret = await prisma.saleReturn.findUnique({
      where: { id },
      include: {
        sale: { include: { customer: true } },
        createdBy: { select: { id: true, username: true, role: true } },
        items: {
          include: {
            product: true,
            saleItem: true,
          },
        },
      },
    });
    if (!ret) return res.status(404).json({ error: "Return not found" });
    return res.json(ret);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load return" });
  }
});

app.put("/returns/:id", auth, async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid return id" });

    const { reason, returnType } = req.body || {};
    const type = String(returnType || "").trim().toUpperCase();
    if (!["GOOD", "DAMAGED_EXPIRED", "OTHER"].includes(type)) {
      return res.status(400).json({ error: "Invalid return type" });
    }
    const reasonText = String(reason || "").trim();
    if (type === "OTHER" && !reasonText) {
      return res.status(400).json({ error: "Reason is required" });
    }
    const finalReason = reasonText || type;
    const restock = type !== "DAMAGED_EXPIRED";

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.saleReturn.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) throw new Error("Return not found");

      if (existing.returnToStock !== restock) {
        for (const it of existing.items) {
          if (existing.returnToStock) {
            await tx.product.update({
              where: { id: it.productId },
              data: {
                stock: { decrement: it.qty },
                damagedStock: { increment: it.qty },
              },
            });
          } else {
            await tx.product.update({
              where: { id: it.productId },
              data: {
                damagedStock: { decrement: it.qty },
                stock: { increment: it.qty },
              },
            });
          }
        }
      }

      return tx.saleReturn.update({
        where: { id },
        data: { reason: finalReason, returnToStock: restock },
        include: {
          sale: { include: { customer: true } },
          createdBy: { select: { id: true, username: true, role: true } },
          items: {
            include: {
              product: true,
              saleItem: true,
            },
          },
        },
      });
    });

    return res.json(updated);
  } catch (e: any) {
    return res.status(400).json({ error: e.message || "Failed to update return" });
  }
});

app.delete("/returns/:id", auth, async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid return id" });

    await prisma.$transaction(async (tx) => {
      const existing = await tx.saleReturn.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) throw new Error("Return not found");

      for (const it of existing.items) {
        if (existing.returnToStock) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { decrement: it.qty } },
          });
        } else {
          await tx.product.update({
            where: { id: it.productId },
            data: { damagedStock: { decrement: it.qty } },
          });
        }
      }

      await tx.returnItem.deleteMany({ where: { returnId: id } });
      await tx.saleReturn.delete({ where: { id } });
    });

    return res.json({ message: "Return deleted" });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || "Failed to delete return" });
  }
});

// ------------------- STATIC (React build) -------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT: adjust path if your folder structure differs
const buildPath = path.join(__dirname, "../../frontend/build");
app.use(express.static(buildPath));

/**
 * ✅ Fixes your crash: "Missing parameter name at index 1: *"
 * Use a safe wildcard that works cleanly.
 */
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// ------------------- GLOBAL ERROR HANDLER (LAST) -------------------
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(500).json({ error: "Server error", details: err?.message || String(err) });
});

// ------------------- START SERVER (LAST) -------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
