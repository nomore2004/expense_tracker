import { describe, it, expect } from "vitest";
import { RecordSettlementSchema } from "@/lib/validations/settlement";
import {
  calculateHouseholdBalances,
  ExpenseRecord,
  SettlementRecord,
} from "@/lib/finance/balanceEngine";

describe("Phase 5 — Settlements & Balance Integration Tests", () => {
  const USER_A = "user_a";
  const USER_B = "user_b";
  const USER_C = "user_c";
  const THREE_ROOMMATES = [USER_A, USER_B, USER_C];

  // 1. Zod Validation Rules for Settlements
  describe("Settlement Validation", () => {
    it("should accept valid settlement input", () => {
      const valid = RecordSettlementSchema.safeParse({
        payerId: USER_B,
        receiverId: USER_A,
        amountInPaise: 2000, // ₹20.00
        settlementDate: new Date(),
        note: "Settling rice share via UPI",
      });
      expect(valid.success).toBe(true);
    });

    it("should reject self settlement (payerId === receiverId)", () => {
      const selfSettlement = RecordSettlementSchema.safeParse({
        payerId: USER_A,
        receiverId: USER_A,
        amountInPaise: 2000,
      });
      expect(selfSettlement.success).toBe(false);
      if (!selfSettlement.success) {
        expect(selfSettlement.error.flatten().fieldErrors.receiverId).toBeDefined();
      }
    });

    it("should reject zero amount settlement", () => {
      const zeroSettlement = RecordSettlementSchema.safeParse({
        payerId: USER_B,
        receiverId: USER_A,
        amountInPaise: 0,
      });
      expect(zeroSettlement.success).toBe(false);
    });

    it("should reject negative amount settlement", () => {
      const negSettlement = RecordSettlementSchema.safeParse({
        payerId: USER_B,
        receiverId: USER_A,
        amountInPaise: -2000,
      });
      expect(negSettlement.success).toBe(false);
    });
  });

  // 2. Integration with Balance Engine: Core User Scenario
  describe("Settlement Financial Integration with Balance Engine", () => {
    // Initial: ₹60 rice paid by A, split A/B/C = ₹20 each.
    // Balances: A = +₹40, B = -₹20, C = -₹20.
    // Settlement: B pays A ₹20.
    // Expected: A = +₹20, B = ₹0, C = -₹20.
    it("should automatically update balances when B pays A ₹20", () => {
      const expenses: ExpenseRecord[] = [
        {
          id: "exp_rice",
          payerId: USER_A,
          amountInPaise: 6000, // ₹60.00
          splits: [
            { userId: USER_A, amountInPaise: 2000 },
            { userId: USER_B, amountInPaise: 2000 },
            { userId: USER_C, amountInPaise: 2000 },
          ],
        },
      ];

      // Initial state check
      const initialReport = calculateHouseholdBalances(THREE_ROOMMATES, expenses);
      expect(initialReport.userBalances[USER_A].netBalanceInPaise).toBe(4000); // +₹40.00
      expect(initialReport.userBalances[USER_B].netBalanceInPaise).toBe(-2000); // -₹20.00
      expect(initialReport.userBalances[USER_C].netBalanceInPaise).toBe(-2000); // -₹20.00

      // B records settlement paying A ₹20
      const settlements: SettlementRecord[] = [
        {
          id: "settle_1",
          payerId: USER_B,
          receiverId: USER_A,
          amountInPaise: 2000, // ₹20.00
        },
      ];

      const updatedReport = calculateHouseholdBalances(
        THREE_ROOMMATES,
        expenses,
        settlements
      );

      // Verify the exact expected balances:
      expect(updatedReport.userBalances[USER_A].netBalanceInPaise).toBe(2000); // +₹20.00
      expect(updatedReport.userBalances[USER_B].netBalanceInPaise).toBe(0); // ₹0.00 (settled)
      expect(updatedReport.userBalances[USER_C].netBalanceInPaise).toBe(-2000); // -₹20.00
      expect(updatedReport.isBalanced).toBe(true);
    });

    // Multiple settlements leading to complete household settlement:
    // Continuing above: C pays A ₹20.
    // Expected: A = ₹0, B = ₹0, C = ₹0. All settled!
    it("should achieve complete household settlement across multiple payments", () => {
      const expenses: ExpenseRecord[] = [
        {
          id: "exp_rice",
          payerId: USER_A,
          amountInPaise: 6000,
          splits: [
            { userId: USER_A, amountInPaise: 2000 },
            { userId: USER_B, amountInPaise: 2000 },
            { userId: USER_C, amountInPaise: 2000 },
          ],
        },
      ];

      const settlements: SettlementRecord[] = [
        {
          id: "settle_1",
          payerId: USER_B,
          receiverId: USER_A,
          amountInPaise: 2000, // B pays A ₹20
        },
        {
          id: "settle_2",
          payerId: USER_C,
          receiverId: USER_A,
          amountInPaise: 2000, // C pays A ₹20
        },
      ];

      const completeReport = calculateHouseholdBalances(
        THREE_ROOMMATES,
        expenses,
        settlements
      );

      expect(completeReport.userBalances[USER_A].netBalanceInPaise).toBe(0);
      expect(completeReport.userBalances[USER_B].netBalanceInPaise).toBe(0);
      expect(completeReport.userBalances[USER_C].netBalanceInPaise).toBe(0);
      expect(completeReport.isBalanced).toBe(true);
    });
  });
});
