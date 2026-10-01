import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding development database with a 3-roommate household...");

  // Clean up any existing data in reverse dependency order
  await prisma.expenseSplit.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.user.deleteMany();
  await prisma.household.deleteMany();

  // 1. Create the Test Household
  const household = await prisma.household.create({
    data: {
      name: "Apartment 4B",
      currency: "INR",
    },
  });

  console.log(`Created Household: ${household.name} (ID: ${household.id})`);

  // 2. Hash standard development password: "password"
  const defaultPassword = "password";
  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  const userA = await prisma.user.create({
    data: {
      householdId: household.id,
      name: "Ansh",
      email: "ansh@example.com",
      passwordHash: hashedPassword,
    },
  });

  const userB = await prisma.user.create({
    data: {
      householdId: household.id,
      name: "Arif",
      email: "arif@example.com",
      passwordHash: hashedPassword,
    },
  });

  const userC = await prisma.user.create({
    data: {
      householdId: household.id,
      name: "Nikhil",
      email: "nikhil@example.com",
      passwordHash: hashedPassword,
    },
  });

  console.log("Created 3 Users (Password for all: password):");
  console.log(` - User A: ${userA.name} (${userA.email})`);
  console.log(` - User B: ${userB.name} (${userB.email})`);
  console.log(` - User C: ${userC.name} (${userC.email})`);

  // 3. Create Sample Shared Expense (Rice = ₹60.00 = 6000 paise paid by Alex, split equally ₹20.00 = 2000 paise each)
  const sharedExpense = await prisma.expense.create({
    data: {
      householdId: household.id,
      payerId: userA.id,
      description: "Basmati Rice 5kg",
      amountInPaise: 6000,
      expenseType: "SHARED",
      splits: {
        create: [
          { userId: userA.id, amountInPaise: 2000 },
          { userId: userB.id, amountInPaise: 2000 },
          { userId: userC.id, amountInPaise: 2000 },
        ],
      },
    },
    include: { splits: true },
  });

  console.log(`Created Shared Expense: "${sharedExpense.description}" for ₹${sharedExpense.amountInPaise / 100}`);

  // 4. Create Sample Settlement (Brian pays Alex ₹20.00 = 2000 paise)
  const sampleSettlement = await prisma.settlement.create({
    data: {
      householdId: household.id,
      payerId: userB.id,
      receiverId: userA.id,
      amountInPaise: 2000,
      note: "UPI transfer for rice share",
      idempotencyKey: "seed-settlement-brian-alex-001",
    },
  });

  console.log(`Created Sample Settlement: ${userB.name} -> ${userA.name} for ₹${sampleSettlement.amountInPaise / 100}`);
  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
