import { describe, it, expect } from "vitest";
import {
  toPaise,
  formatRupees,
  calculateEqualSplits,
  calculatePersonalSplit,
} from "@/lib/finance/money";
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
} from "@/lib/validations/expense";

describe("Phase 3 — Expense Management & Money Logic Tests", () => {
  // 1. Money Conversions
  describe("Paise & Integer Conversions", () => {
    it("should accurately convert string and number amounts to integer paise", () => {
      expect(toPaise("60.00")).toBe(6000);
      expect(toPaise("100")).toBe(10000);
      expect(toPaise("33.33")).toBe(3333);
      expect(toPaise(100.5)).toBe(10050);
      expect(toPaise(0.01)).toBe(1);
    });

    it("should format integer paise into currency strings without float loss", () => {
      expect(formatRupees(6000)).toBe("₹60.00");
      expect(formatRupees(10000)).toBe("₹100.00");
      expect(formatRupees(3333)).toBe("₹33.33");
      expect(formatRupees(1)).toBe("₹0.01");
    });
  });

  // 2. Split Logic: Equal, Remainder Handling, and ₹100 / 3
  describe("Split Calculations", () => {
    it("should split ₹60 equally among 3 roommates (A, B, C)", () => {
      const splits = calculateEqualSplits(6000, ["user_a", "user_b", "user_c"]);
      expect(splits).toHaveLength(3);
      expect(splits.every((s) => s.amountInPaise === 2000)).toBe(true);

      const sum = splits.reduce((acc, curr) => acc + curr.amountInPaise, 0);
      expect(sum).toBe(6000);
    });

    it("should split ₹100 among 3 people with deterministic remainder distribution", () => {
      // ₹100.00 = 10000 paise. 10000 / 3 = 3333 with remainder 1.
      const splits = calculateEqualSplits(10000, ["user_a", "user_b", "user_c"], "user_a");

      // Payer (user_a) gets the extra 1 paise
      const payerSplit = splits.find((s) => s.userId === "user_a");
      const roommateBSplit = splits.find((s) => s.userId === "user_b");
      const roommateCSplit = splits.find((s) => s.userId === "user_c");

      expect(payerSplit?.amountInPaise).toBe(3334);
      expect(roommateBSplit?.amountInPaise).toBe(3333);
      expect(roommateCSplit?.amountInPaise).toBe(3333);

      // Invariant: sum of shares exactly equals 10000 paise
      const total = splits.reduce((acc, curr) => acc + curr.amountInPaise, 0);
      expect(total).toBe(10000);
    });

    it("should calculate personal expense split assigning 100% to one user", () => {
      const splits = calculatePersonalSplit(50000, "user_b"); // ₹500.00
      expect(splits).toHaveLength(1);
      expect(splits[0]).toEqual({
        userId: "user_b",
        amountInPaise: 50000,
      });
    });

    it("should throw error when splitting among zero participants", () => {
      expect(() => calculateEqualSplits(6000, [])).toThrow();
    });

    it("should throw error when splitting zero or negative amounts", () => {
      expect(() => calculateEqualSplits(0, ["user_a"])).toThrow();
      expect(() => calculateEqualSplits(-500, ["user_a"])).toThrow();
    });
  });

  // 3. Zod Validations for Create & Update
  describe("Expense Validation Schemas (Zod)", () => {
    it("should accept valid shared expense where sum(splits) === amountInPaise", () => {
      const valid = CreateExpenseSchema.safeParse({
        description: "Basmati Rice",
        amountInPaise: 6000,
        payerId: "user_a",
        expenseType: "SHARED",
        splits: [
          { userId: "user_a", amountInPaise: 2000 },
          { userId: "user_b", amountInPaise: 2000 },
          { userId: "user_c", amountInPaise: 2000 },
        ],
      });
      expect(valid.success).toBe(true);
    });

    it("should reject custom expense when split sum does not match total amount", () => {
      // Total = ₹100 (10000 paise), but splits sum to ₹90 (9000 paise)
      const invalid = CreateExpenseSchema.safeParse({
        description: "Custom Groceries",
        amountInPaise: 10000,
        payerId: "user_a",
        expenseType: "CUSTOM",
        splits: [
          { userId: "user_a", amountInPaise: 3000 },
          { userId: "user_b", amountInPaise: 4000 },
          { userId: "user_c", amountInPaise: 2000 },
        ],
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.flatten().fieldErrors.splits).toBeDefined();
      }
    });

    it("should reject zero and negative expense amounts", () => {
      const zeroAmount = CreateExpenseSchema.safeParse({
        description: "Zero item",
        amountInPaise: 0,
        payerId: "user_a",
        expenseType: "SHARED",
        splits: [{ userId: "user_a", amountInPaise: 0 }],
      });
      expect(zeroAmount.success).toBe(false);

      const negativeAmount = CreateExpenseSchema.safeParse({
        description: "Negative item",
        amountInPaise: -5000,
        payerId: "user_a",
        expenseType: "SHARED",
        splits: [{ userId: "user_a", amountInPaise: -5000 }],
      });
      expect(negativeAmount.success).toBe(false);
    });

    it("should reject duplicate participant in splits", () => {
      const duplicate = CreateExpenseSchema.safeParse({
        description: "Duplicate test",
        amountInPaise: 4000,
        payerId: "user_a",
        expenseType: "SHARED",
        splits: [
          { userId: "user_b", amountInPaise: 2000 },
          { userId: "user_b", amountInPaise: 2000 },
        ],
      });
      expect(duplicate.success).toBe(false);
    });

    it("should reject PERSONAL expense with multiple participants", () => {
      const invalidPersonal = CreateExpenseSchema.safeParse({
        description: "Medicine",
        amountInPaise: 1000,
        payerId: "user_a",
        expenseType: "PERSONAL",
        splits: [
          { userId: "user_b", amountInPaise: 500 },
          { userId: "user_c", amountInPaise: 500 },
        ],
      });
      expect(invalidPersonal.success).toBe(false);
    });

    it("should validate UpdateExpenseSchema and verify modified splits", () => {
      const updateValid = UpdateExpenseSchema.safeParse({
        id: "exp_123",
        description: "Basmati Rice 10kg",
        amountInPaise: 12000,
        payerId: "user_a",
        expenseType: "SHARED",
        expenseDate: new Date(),
        splits: [
          { userId: "user_a", amountInPaise: 4000 },
          { userId: "user_b", amountInPaise: 4000 },
          { userId: "user_c", amountInPaise: 4000 },
        ],
      });
      expect(updateValid.success).toBe(true);
    });
  });
});
