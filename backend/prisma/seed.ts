import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      password: "admin123",
      role: "admin",
    },
    create: {
      username: "admin",
      password: "admin123",
      role: "admin",
    },
  });

  console.log("✅ Admin user created:", admin.username);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
