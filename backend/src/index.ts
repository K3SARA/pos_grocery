import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options(/.*/, cors());
app.use(express.json());

// ------------------- DEBUG ROUTES (TEMP) -------------------
app.get("/debug-env", (req, res) => {
  res.json({
    JWT_SECRET_exists: !!process.env.JWT_SECRET,
    JWT_SECRET_length: process.env.JWT_SECRET?.length ?? 0,
  });
});

app.get("/debug-db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ db: "ok" });
  } catch (e: any) {
    res.status(500).json({ db: "fail", message: e.message });
  }
});

// ------------------- AUTH MIDDLEWARE -------------------
function auth(req: any, res: any, next: any) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(role: "admin" | "cashier") {
  return (req: any, res: any, next: any) => {
    if (!req.user?.role) return res.status(401).json({ error: "No user" });
    if (req.user.role !== role) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

// ------------------- ROOT -------------------
app.get("/", (req, res) => {
  res.send("POS Backend Running");
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
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "username and password required" });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "Invalid username/password" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid username/password" });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "JWT_SECRET missing" });

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn: "12h" }
    );

    return res.json({ token, role: user.role });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: "Login failed", details: e.message });
  }
});

// Create cashier/admin user (admin only)
app.post("/users", auth, requireRole("admin"), async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "username and password required" });
    }

    if (role && role !== "admin" && role !== "cashier") {
      return res.status(400).json({ error: "invalid role" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hash, role: role || "cashier" },
    });

    return res.status(201).json({ id: user.id, username: user.username, role: user.role });
  } catch (e: any) {
    return res.status(400).json({ error: "Username already exists or invalid" });
  }
});

// List users (admin only)
app.get("/users", auth, requireRole("admin"), async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true },
    orderBy: { id: "desc" },
  });
  res.json(users);
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
      where: {
        OR: [
          { barcode: { contains: q } },
          { name: { contains: q } },
        ],
      },
      take: 20,
      orderBy: { name: "asc" },
    });

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

// Get product by barcode
app.get("/products/:barcode", async (req, res) => {
  const { barcode } = req.params;
  try {
    const product = await prisma.product.findUnique({ where: { barcode } });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Add product (admin only)
app.post("/products", auth, requireRole("admin"), async (req, res) => {
  const { barcode, name, price, stock } = req.body;
  try {
    const newProduct = await prisma.product.create({
      data: {
        barcode,
        name,
        price: Number(price),
        stock: Number(stock) || 0,
      },
    });
    res.status(201).json(newProduct);
  } catch (err: any) {
    console.error(err);
    if (err.code === "P2002") return res.status(400).json({ error: "Product barcode already exists" });
    res.status(500).json({ error: "Failed to create product" });
  }
});

// Update product (admin only)
app.put("/products/:barcode", auth, requireRole("admin"), async (req, res) => {
  const { barcode } = req.params;
  const { name, price, stock } = req.body;
  try {
    const updated = await prisma.product.update({
      where: { barcode },
      data: { name, price: Number(price), stock: Number(stock) },
    });
    res.json(updated);
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ error: "Product not found" });
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// Delete product (admin only)
app.delete("/products/:barcode", auth, requireRole("admin"), async (req, res) => {
  const { barcode } = req.params;
  try {
    await prisma.product.delete({ where: { barcode } });
    res.json({ message: "Product deleted successfully" });
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ error: "Product not found" });
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// ------------------- SALES API -------------------
// Create a sale (cashier/admin)
app.post("/sales", auth, async (req, res) => {
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "No items provided" });
  }

  try {
    let total = 0;

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({ data: { total: 0 } });

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { barcode: item.barcode } });
        if (!product) throw new Error(`Product not found: ${item.barcode}`);
        if (product.stock < item.qty) throw new Error(`Insufficient stock for ${product.name}`);

        total += Number(product.price) * item.qty;


        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: product.id,
            qty: item.qty,
            price: product.price,
          },
        });

        await tx.product.update({
          where: { id: product.id },
          data: { stock: product.stock - item.qty },
        });
      }

      return tx.sale.update({ where: { id: newSale.id }, data: { total } });
    });

    res.status(201).json({ message: "Sale completed", sale });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// Get sales history
app.get("/sales", auth, async (req, res) => {
  const sales = await prisma.sale.findMany({
    include: {
      saleItems: { include: { product: true } },
    },
    orderBy: { id: "desc" },
  });
  res.json(sales);
});
// Get EndDay summary for a date (YYYY-MM-DD)
app.get("/reports/end-day", auth, async (req, res) => {
  const dateStr = String(req.query.date || "");
  if (!dateStr) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const start = new Date(dateStr + "T00:00:00");
  const end = new Date(dateStr + "T23:59:59");

  // Pull sales for that day
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { saleItems: true },
  });

  const billCount = sales.length;
  const totalItems = sales.reduce((sum, s) => sum + s.saleItems.reduce((a, i) => a + i.qty, 0), 0);

  // Prisma Decimal safe sum
  const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);

  // Check if already closed
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

// Close EndDay (save record). Call once per date.
app.post("/reports/end-day/close", auth, async (req, res) => {
  const { date } = req.body || {};
  if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const start = new Date(date + "T00:00:00");
  const end = new Date(date + "T23:59:59");

  const existing = await prisma.endDay.findUnique({ where: { date: start } });
  if (existing) return res.status(400).json({ error: "Day already closed" });

  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { saleItems: true },
  });
// ------------------- END DAY API -------------------
  const billCount = sales.length;
  const totalItems = sales.reduce((sum, s) => sum + s.saleItems.reduce((a, i) => a + i.qty, 0), 0);
  const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);

  const record = await prisma.endDay.create({
    data: {
      date: start,
      billCount,
      totalItems,
      totalSales: totalSales.toFixed(2), // Decimal field accepts string
    },
  });

  res.json({ message: "Day closed", record });
});

// List closed days
app.get("/reports/end-day/list", auth, async (req, res) => {
  const rows = await prisma.endDay.findMany({
    orderBy: { date: "desc" },
  });
  res.json(rows);
});
// ------------------- END END DAY API -------------------

// ------------------- SUMMARY API -------------------
// Quick summary stats for fast dashboard load
app.get("/reports/summary", auth, requireRole("admin"), async (req, res) => {
  try {
    const [productCount, totalStockAgg, lowStockCount, userCount] = await Promise.all([
      prisma.product.count(),
      prisma.product.aggregate({ _sum: { stock: true } }),
      prisma.product.count({ where: { stock: { lte: 5 } } }),
      prisma.user.count(),
    ]);

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const [todayBills, todayRevenueAgg] = await Promise.all([
      prisma.sale.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: start, lt: end } },
        _sum: { total: true },
      }),
    ]);

    res.json({
      totalProducts: productCount,
      totalStock: Number(totalStockAgg._sum.stock || 0),
      lowStock: lowStockCount,
      totalUsers: userCount,
      todayBills,
      todayRevenue: Number(todayRevenueAgg._sum.total || 0),
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Summary failed" });
  }
});
// ------------------- END SUMMARY API -------------------

// ------------------- ANALYTICS API -------------------
// Summary analytics for last N days (default 30)
app.get("/reports/analytics", auth, requireRole("admin"), async (req, res) => {
  const days = Number(req.query.days || 30);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - safeDays + 1);
  start.setHours(0, 0, 0, 0);

  try {
    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: start } },
      include: {
        saleItems: { include: { product: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const totalsByDay = new Map();
    const productMap = new Map();
    let totalRevenue = 0;
    let totalBills = 0;
    let totalItems = 0;

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
// ------------------- END ANALYTICS API -------------------
// ------------------- GLOBAL ERROR HANDLER -------------------
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(500).json({ error: "Server error", details: err.message });
});

// ------------------- START SERVER (LAST) -------------------
const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});






