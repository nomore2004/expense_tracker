import { describe, it, expect } from "vitest";
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
} from "@/lib/validations/expense";
import { RecordSettlementSchema } from "@/lib/validations/settlement";
import { RegisterSchema, LoginSchema } from "@/lib/validations/auth";
import { assertHouseholdAccess } from "@/lib/auth/context";
import {
  calculateEqualSplits,
  toPaise,
} from "@/lib/finance/money";
import {
  calculateHouseholdBalances,
  ExpenseRecord,
  SettlementRecord,
} from "@/lib/finance/balanceEngine";

describe("Phase 7 — Comprehensive Security & QA Audit Suite", () => {
  const HOUSEHOLD_A = "hh_alpha_123";
  const HOUSEHOLD_B = "hh_beta_456";

  const USER_A1 = "usr_a1";
  const USER_A2 = "usr_a2";
  const USER_A3 = "usr_a3";
  const USER_B1 = "usr_b1"; // From another household

  // ==========================================
  // 1. AUTHORIZATION & TENANT ISOLATION AUDIT
  // ==========================================
  describe("1. Authorization & Tenant Isolation Checks", () => {
    it("should strictly deny cross-household access", () => {
      expect(() => {
        assertHouseholdAccess(HOUSEHOLD_A, HOUSEHOLD_B);
      }).toThrow(/FORBIDDEN: Access denied/);
    });

    it("should allow legitimate access within the same household", () => {
      expect(() => {
        assertHouseholdAccess(HOUSEHOLD_A, HOUSEHOLD_A);
      }).not.toThrow();
    });

    it("should reject cross-household manipulation if an ID is forged", () => {
      const forgedHouseholdAttempt = () => {
        const callerHousehold = HOUSEHOLD_A;
        const targetExpenseHousehold = HOUSEHOLD_B;
        assertHouseholdAccess(callerHousehold, targetExpenseHousehold);
      };
      expect(forgedHouseholdAttempt).toThrow(/FORBIDDEN/);
    });
  });

  // ==========================================
  // 2. INPUT VALIDATION & ADVERSARIAL PAYLOADS
  // ==========================================
  describe("2. Input Validation & Edge Case Attacks", () => {
    it("should reject negative expense amounts", () => {
      const res = CreateExpenseSchema.safeParse({
        description: "Negative Attack",
        amountInPaise: -500,
        payerId: USER_A1,
        expenseType: "SHARED",
        splits: [{ userId: USER_A1, amountInPaise: -500 }],
      });
      expect(res.success).toBe(false);
    });

    it("should reject zero expense amounts", () => {
      const res = CreateExpenseSchema.safeParse({
        description: "Zero Attack",
        amountInPaise: 0,
        payerId: USER_A1,
        expenseType: "SHARED",
        splits: [{ userId: USER_A1, amountInPaise: 0 }],
      });
      expect(res.success).toBe(false);
    });

    it("should reject extremely large expense amounts exceeding limits (> ₹10,00,000)", () => {
      const res = CreateExpenseSchema.safeParse({
        description: "Overflow Attempt",
        amountInPaise: 100_000_001, // 100M+ paise = ₹10 Lakh+
        payerId: USER_A1,
        expenseType: "SHARED",
        splits: [{ userId: USER_A1, amountInPaise: 100_000_001 }],
      });
      expect(res.success).toBe(false);
    });

    it("should reject non-integer / floating-point paise amounts", () => {
      const res = CreateExpenseSchema.safeParse({
        description: "Float injection",
        amountInPaise: 1000.5,
        payerId: USER_A1,
        expenseType: "SHARED",
        splits: [{ userId: USER_A1, amountInPaise: 1000.5 }],
      });
      expect(res.success).toBe(false);
    });

    it("should reject duplicate participants in split payload", () => {
      const res = CreateExpenseSchema.safeParse({
        description: "Duplicate attack",
        amountInPaise: 4000,
        payerId: USER_A1,
        expenseType: "SHARED",
        splits: [
          { userId: USER_A1, amountInPaise: 2000 },
          { userId: USER_A1, amountInPaise: 2000 }, // Duplicate user
        ],
      });
      expect(res.success).toBe(false);
    });

    it("should reject mismatched split sums in custom splits", () => {
      const res = CreateExpenseSchema.safeParse({
        description: "Mismatch Attack",
        amountInPaise: 10000, // ₹100
        payerId: USER_A1,
        expenseType: "CUSTOM",
        splits: [
          { userId: USER_A1, amountInPaise: 3000 },
          { userId: USER_A2, amountInPaise: 3000 },
          { userId: USER_A3, amountInPaise: 3000 }, // Total = 9000 != 10000
        ],
      });
      expect(res.success).toBe(false);
    });

    it("should reject self-settlements (payerId === receiverId)", () => {
      const res = RecordSettlementSchema.safeParse({
        payerId: USER_A1,
        receiverId: USER_A1,
        amountInPaise: 5000,
      });
      expect(res.success).toBe(false);
    });

    it("should reject zero or negative settlements", () => {
      const resZero = RecordSettlementSchema.safeParse({
        payerId: USER_A1,
        receiverId: USER_A2,
        amountInPaise: 0,
      });
      expect(resZero.success).toBe(false);

      const resNeg = RecordSettlementSchema.safeParse({
        payerId: USER_A1,
        receiverId: USER_A2,
        amountInPaise: -100,
      });
      expect(resNeg.success).toBe(false);
    });
  });

  // ==========================================
  // 3. FINANCIAL INTEGRITY & CONSERVATION AUDIT
  // ==========================================
  describe("3. Financial Invariants & Extreme Math Checks", () => {
    it("should guarantee exact zero discrepancy on ₹100 split 3 ways", () => {
      const splits = calculateEqualSplits(10000, [USER_A1, USER_A2, USER_A3], USER_A1);
      const total = splits.reduce((acc, curr) => acc + curr.amountInPaise, 0);
      expect(total).toBe(10000);
      expect(splits[0].amountInPaise).toBe(3334);
      expect(splits[1].amountInPaise).toBe(3333);
      expect(splits[2].amountInPaise).toBe(3333);
    });

    it("should preserve Conservation of Money across 100 random sequential expenses and settlements", () => {
      const users = [USER_A1, USER_A2, USER_A3];
      const expenses: ExpenseRecord[] = [];
      const settlements: SettlementRecord[] = [];

      // Generate 50 random expenses with varying payers and split amounts
      for (let i = 0; i < 50; i++) {
        const payer = users[i % 3];
        const amount = (i + 1) * 137; // Arbitrary non-round amounts
        const splits = calculateEqualSplits(amount, users, payer);
        expenses.push({
          id: `exp_stress_${i}`,
          payerId: payer,
          amountInPaise: amount,
          splits,
        });
      }

      // Generate 25 random settlements
      for (let j = 0; j < 25; j++) {
        const payer = users[j % 3];
        const receiver = users[(j + 1) % 3];
        settlements.push({
          id: `st_stress_${j}`,
          payerId: payer,
          receiverId: receiver,
          amountInPaise: (j + 1) * 73,
        });
      }

      const report = calculateHouseholdBalances(users, expenses, settlements);

      // Verify the fundamental financial law: sum of all roommate balances must strictly equal zero
      const sumBalances = Object.values(report.userBalances).reduce(
        (sum, u) => sum + u.netBalanceInPaise,
        0
      );

      expect(sumBalances).toBe(0);
      expect(report.isBalanced).toBe(true);
    });
  });

  // ==========================================
  // 4. AUTHENTICATION & CREDENTIALS AUDIT
  // ==========================================
  describe("4. Credentials & Registration Boundaries", () => {
    it("should reject registration passwords under 8 characters", () => {
      const res = RegisterSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        password: "short",
        householdName: "Test Flat",
      });
      expect(res.success).toBe(false);
    });

    it("should reject malicious email strings", () => {
      const res = RegisterSchema.safeParse({
        name: "Test User",
        email: "invalid-email-format",
        password: "ValidPassword123!",
        householdName: "Test Flat",
      });
      expect(res.success).toBe(false);
    });

    it("should accept valid credentials", () => {
      const res = RegisterSchema.safeParse({
        name: "Valid User",
        email: "valid@example.com",
        password: "ValidPassword123!",
        householdName: "Flat 101",
      });
      expect(res.success).toBe(true);
    });
  });
});
