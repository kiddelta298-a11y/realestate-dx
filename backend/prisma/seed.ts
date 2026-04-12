import { PrismaClient } from "@prisma/client";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function main() {
  console.log("Seeding database...");

  // Company
  const company = await prisma.company.upsert({
    where: { slug: "demo-agency" },
    update: {},
    create: {
      id: "d2a99d6c-729c-4726-b880-c82dff485561",
      name: "デモ不動産",
      slug: "demo-agency",
      plan: "standard",
    },
  });
  console.log("Company:", company.name);

  // Admin user
  const adminHash = await hashPassword("admin1234");
  const admin = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: "admin@demo.jp" } },
    update: { passwordHash: adminHash },
    create: {
      companyId: company.id,
      email: "admin@demo.jp",
      name: "管理者",
      role: "admin",
      passwordHash: adminHash,
    },
  });
  console.log("Admin user:", admin.email, "(password: admin1234)");

  // Agent user
  const agentHash = await hashPassword("agent1234");
  const agent = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: "agent@demo.jp" } },
    update: { passwordHash: agentHash },
    create: {
      companyId: company.id,
      email: "agent@demo.jp",
      name: "田中 太郎",
      role: "agent",
      passwordHash: agentHash,
    },
  });
  console.log("Agent user:", agent.email, "(password: agent1234)");

  // Sample properties
  const properties = await Promise.all([
    prisma.property.upsert({
      where: { id: "a1000000-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "a1000000-0000-4000-8000-000000000001",
        companyId: company.id,
        name: "グランドパレス渋谷",
        propertyType: "apartment",
        address: "東京都渋谷区渋谷1-1-1",
        nearestStation: "渋谷",
        walkMinutes: 5,
        rent: 120000,
        managementFee: 8000,
        deposit: 240000,
        keyMoney: 120000,
        roomLayout: "1LDK",
        floorArea: 45.5,
        floor: 8,
        totalFloors: 15,
        builtYear: 2018,
        features: ["オートロック", "宅配ボックス", "システムキッチン", "浴室乾燥機"],
        status: "available",
      },
    }),
    prisma.property.upsert({
      where: { id: "a1000000-0000-4000-8000-000000000002" },
      update: {},
      create: {
        id: "a1000000-0000-4000-8000-000000000002",
        companyId: company.id,
        name: "ライオンズマンション新宿",
        propertyType: "apartment",
        address: "東京都新宿区新宿2-2-2",
        nearestStation: "新宿三丁目",
        walkMinutes: 3,
        rent: 95000,
        managementFee: 5000,
        deposit: 190000,
        keyMoney: 95000,
        roomLayout: "1K",
        floorArea: 28.0,
        floor: 4,
        totalFloors: 10,
        builtYear: 2015,
        features: ["バストイレ別", "エアコン", "インターネット無料"],
        status: "available",
      },
    }),
    prisma.property.upsert({
      where: { id: "a1000000-0000-4000-8000-000000000003" },
      update: {},
      create: {
        id: "a1000000-0000-4000-8000-000000000003",
        companyId: company.id,
        name: "コスモス池袋",
        propertyType: "apartment",
        address: "東京都豊島区池袋3-3-3",
        nearestStation: "池袋",
        walkMinutes: 8,
        rent: 150000,
        managementFee: 10000,
        deposit: 300000,
        keyMoney: 0,
        roomLayout: "2LDK",
        floorArea: 62.3,
        floor: 12,
        totalFloors: 20,
        builtYear: 2020,
        features: ["ペット相談可", "駐車場あり", "システムキッチン", "ウォークインクローゼット"],
        status: "rented",
      },
    }),
  ]);
  console.log("Properties:", properties.length);

  // Sample customers
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: "b2000000-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "b2000000-0000-4000-8000-000000000001",
        companyId: company.id,
        assignedUserId: agent.id,
        name: "山田 花子",
        email: "yamada@example.com",
        phone: "090-1234-5678",
        source: "web",
        status: "active",
        notes: "2LDKを希望。ペット可物件を探している。",
      },
    }),
    prisma.customer.upsert({
      where: { id: "b2000000-0000-4000-8000-000000000002" },
      update: {},
      create: {
        id: "b2000000-0000-4000-8000-000000000002",
        companyId: company.id,
        assignedUserId: agent.id,
        name: "佐藤 次郎",
        email: "sato@example.com",
        phone: "080-9876-5432",
        source: "suumo",
        status: "contracted",
        notes: "新宿エリア希望。予算10万円以内。",
      },
    }),
    prisma.customer.upsert({
      where: { id: "b2000000-0000-4000-8000-000000000003" },
      update: {},
      create: {
        id: "b2000000-0000-4000-8000-000000000003",
        companyId: company.id,
        name: "鈴木 美咲",
        email: "suzuki@example.com",
        source: "line",
        status: "active",
      },
    }),
  ]);
  console.log("Customers:", customers.length);

  // Sample tasks
  await Promise.all([
    prisma.task.upsert({
      where: { id: "c3000000-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "c3000000-0000-4000-8000-000000000001",
        companyId: company.id,
        assignedUserId: agent.id,
        customerId: customers[0].id,
        title: "山田様へ物件提案メール送付",
        taskType: "email",
        priority: "high",
        status: "pending",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }),
    prisma.task.upsert({
      where: { id: "c3000000-0000-4000-8000-000000000002" },
      update: {},
      create: {
        id: "c3000000-0000-4000-8000-000000000002",
        companyId: company.id,
        assignedUserId: agent.id,
        customerId: customers[1].id,
        title: "佐藤様 契約書類確認",
        taskType: "document",
        priority: "medium",
        status: "completed",
        completedAt: new Date(),
      },
    }),
  ]);
  console.log("Tasks seeded");

  // Sample tenants (using property 3 which has status "rented")
  const tenants = await Promise.all([
    prisma.tenant.upsert({
      where: { id: "d4000000-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "d4000000-0000-4000-8000-000000000001",
        companyId: company.id,
        customerId: customers[1].id,
        contractId: "e5000000-0000-4000-8000-000000000001",
        propertyId: properties[2].id,
        name: "佐藤 次郎",
        email: "sato@example.com",
        phone: "080-9876-5432",
        leaseStartDate: new Date("2024-04-01"),
        leaseEndDate: new Date("2026-03-31"),
        rentAmount: 150000,
        managementFee: 10000,
        status: "active",
        moveInDate: new Date("2024-04-01"),
      },
    }),
    prisma.tenant.upsert({
      where: { id: "d4000000-0000-4000-8000-000000000002" },
      update: {},
      create: {
        id: "d4000000-0000-4000-8000-000000000002",
        companyId: company.id,
        customerId: customers[2].id,
        contractId: "e5000000-0000-4000-8000-000000000002",
        propertyId: properties[0].id,
        name: "鈴木 美咲",
        email: "suzuki@example.com",
        phone: "090-1111-2222",
        leaseStartDate: new Date("2025-01-01"),
        leaseEndDate: new Date("2027-12-31"),
        rentAmount: 120000,
        managementFee: 8000,
        status: "active",
        moveInDate: new Date("2025-01-01"),
      },
    }),
  ]);
  console.log("Tenants:", tenants.length);

  // Sample renewal
  await prisma.renewal.upsert({
    where: { id: "f6000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "f6000000-0000-4000-8000-000000000001",
      companyId: company.id,
      tenantId: tenants[0].id,
      currentEndDate: new Date("2026-03-31"),
      renewalFee: 150000,
      status: "pending",
    },
  });
  console.log("Renewal seeded");

  console.log("\n=== Seed complete ===");
  console.log("Login credentials:");
  console.log("  Admin: admin@demo.jp / admin1234");
  console.log("  Agent: agent@demo.jp / agent1234");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
