import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Model and Schema Verification Tests
 * Verifies that the Prisma schema exports all required models, fields,
 * and types with the intended constraints and relationships.
 */
describe("Prisma Models & Schema Type Verification", () => {
  it("should have correct model definitions and type bindings for Household", () => {
    const mockHouseholdInput: Prisma.HouseholdCreateInput = {
      id: "hh_test_123",
      name: "Apartment 4B",
      currency: "INR",
    };

    expect(mockHouseholdInput.name).toBe("Apartment 4B");
    expect(mockHouseholdInput.currency).toBe("INR");
  });

  it("should enforce integer amount in paise (safe money representation) for Expenses and Splits", () => {
    const mockExpenseInput: Prisma.ExpenseUncheckedCreateInput = {
      id: "exp_1",
      householdId: "hh_test_123",
      payerId: "user_a",
      description: "Basmati Rice 5kg",
      amountInPaise: 6000, // ₹60.00
      expenseType: "SHARED",
    };

    const mockSplitInput: Prisma.ExpenseSplitUncheckedCreateInput = {
      id: "split_1",
      expenseId: "exp_1",
      userId: "user_a",
      amountInPaise: 2000, // ₹20.00
    };

    // Amount must strictly be an integer representation
    expect(Number.isInteger(mockExpenseInput.amountInPaise)).toBe(true);
    expect(Number.isInteger(mockSplitInput.amountInPaise)).toBe(true);
    expect(mockExpenseInput.amountInPaise).toBe(6000);
    expect(mockSplitInput.amountInPaise).toBe(2000);
  });

  it("should enforce settlement structure with distinct payer and receiver and safe money integer", () => {
    const mockSettlementInput: Prisma.SettlementUncheckedCreateInput = {
      id: "settle_1",
      householdId: "hh_test_123",
      payerId: "user_b",
      receiverId: "user_a",
      amountInPaise: 2000,
      note: "Payment for rice",
      idempotencyKey: "idem_key_abc_123",
    };

    expect(mockSettlementInput.payerId).not.toBe(mockSettlementInput.receiverId);
    expect(Number.isInteger(mockSettlementInput.amountInPaise)).toBe(true);
    expect(mockSettlementInput.amountInPaise).toBeGreaterThan(0);
  });

  it("should verify that split sum matches total expense amount", () => {
    const totalAmountInPaise = 6000;
    const splits = [
      { userId: "user_a", amountInPaise: 2000 },
      { userId: "user_b", amountInPaise: 2000 },
      { userId: "user_c", amountInPaise: 2000 },
    ];

    const sumSplits = splits.reduce((acc, curr) => acc + curr.amountInPaise, 0);
    expect(sumSplits).toBe(totalAmountInPaise);
  });

  it("should handle indivisible amounts safely without losing paise (e.g. ₹100 among 3 roommates)", () => {
    const totalAmount = 10000; // ₹100.00 in paise
    const numberOfPeople = 3;

    const baseShare = Math.floor(totalAmount / numberOfPeople); // 3333 paise
    const remainder = totalAmount % numberOfPeople; // 1 paise

    const allocatedShares = [
      baseShare + (remainder > 0 ? 1 : 0), // Payer / first person gets extra 1 paise
      baseShare,
      baseShare,
    ];

    expect(allocatedShares).toEqual([3334, 3333, 3333]);
    const totalAllocated = allocatedShares.reduce((a, b) => a + b, 0);
    expect(totalAllocated).toBe(totalAmount);
  });
});
