import { describe, it, expect } from "vitest";
import {
  calculateHouseholdBalances,
  ExpenseRecord,
  SettlementRecord,
} from "./balanceEngine";
import { calculateEqualSplits } from "./money";

describe("Phase 4 — Balance Engine Comprehensive Test Scenarios", () => {
  const USER_A = "user_a";
  const USER_B = "user_b";
  const USER_C = "user_c";
  const THREE_ROOMMATES = [USER_A, USER_B, USER_C];

  // Scenario 1: One ₹60 shared expense paid by A, split equally A/B/C (₹20 each)
  // Expected: A = +₹40, B = -₹20, C = -₹20
  it("Scenario 1: One ₹60 shared expense paid by A, split equally among A, B, C", () => {
    const expenses: ExpenseRecord[] = [
      {
        id: "exp_1",
        payerId: USER_A,
        amountInPaise: 6000, // ₹60.00
        splits: [
          { userId: USER_A, amountInPaise: 2000 },
          { userId: USER_B, amountInPaise: 2000 },
          { userId: USER_C, amountInPaise: 2000 },
        ],
      },
    ];

    const report = calculateHouseholdBalances(THREE_ROOMMATES, expenses);

    expect(report.userBalances[USER_A].netBalanceInPaise).toBe(4000); // +₹40.00
    expect(report.userBalances[USER_B].netBalanceInPaise).toBe(-2000); // -₹20.00
    expect(report.userBalances[USER_C].netBalanceInPaise).toBe(-2000); // -₹20.00
    expect(report.isBalanced).toBe(true);
    expect(report.totalHouseholdSpendingInPaise).toBe(6000);
  });

  // Scenario 2: Three roommates with different payer (B pays ₹90, split equally ₹30 each)
  it("Scenario 2: Different payer (B pays ₹90 shared expense)", () => {
    const expenses: ExpenseRecord[] = [
      {
        id: "exp_2",
        payerId: USER_B,
        amountInPaise: 9000,
        splits: [
          { userId: USER_A, amountInPaise: 3000 },
          { userId: USER_B, amountInPaise: 3000 },
          { userId: USER_C, amountInPaise: 3000 },
        ],
      },
    ];

    const report = calculateHouseholdBalances(THREE_ROOMMATES, expenses);

    expect(report.userBalances[USER_A].netBalanceInPaise).toBe(-3000); // -₹30.00
    expect(report.userBalances[USER_B].netBalanceInPaise).toBe(6000); // +₹60.00
    expect(report.userBalances[USER_C].netBalanceInPaise).toBe(-3000); // -₹30.00
    expect(report.isBalanced).toBe(true);
  });

  // Scenario 3: Multiple expenses with multiple payers
  // Exp 1: A pays ₹60 (splits A: 20, B: 20, C: 20) -> A: +40, B: -20, C: -20
  // Exp 2: B pays ₹30 (splits A: 10, B: 10, C: 10) -> A: -10, B: +20, C: -10
  // Net:
  // A: +40 - 10 = +30 (+₹30)
  // B: -20 + 20 = 0 (₹0)
  // C: -20 - 10 = -30 (-₹30)
  it("Scenario 3 & 8: Multiple expenses and multiple people paying", () => {
    const expenses: ExpenseRecord[] = [
      {
        id: "exp_1",
        payerId: USER_A,
        amountInPaise: 6000,
        splits: [
          { userId: USER_A, amountInPaise: 2000 },
          { userId: USER_B, amountInPaise: 2000 },
          { userId: USER_C, amountInPaise: 2000 },
        ],
      },
      {
        id: "exp_2",
        payerId: USER_B,
        amountInPaise: 3000,
        splits: [
          { userId: USER_A, amountInPaise: 1000 },
          { userId: USER_B, amountInPaise: 1000 },
          { userId: USER_C, amountInPaise: 1000 },
        ],
      },
    ];

    const report = calculateHouseholdBalances(THREE_ROOMMATES, expenses);

    expect(report.userBalances[USER_A].netBalanceInPaise).toBe(3000);
    expect(report.userBalances[USER_B].netBalanceInPaise).toBe(0);
    expect(report.userBalances[USER_C].netBalanceInPaise).toBe(-3000);
    expect(report.isBalanced).toBe(true);
  });

  // Scenario 4: Personal expense (A pays ₹500 for B's medicine)
  // Expected: A = +₹500, B = -₹500, C = ₹0
  it("Scenario 4: Personal expense (A pays ₹500 for B)", () => {
    const expenses: ExpenseRecord[] = [
      {
        id: "exp_personal",
        payerId: USER_A,
        amountInPaise: 50000, // ₹500.00
        splits: [{ userId: USER_B, amountInPaise: 50000 }],
      },
    ];

    const report = calculateHouseholdBalances(THREE_ROOMMATES, expenses);

    expect(report.userBalances[USER_A].netBalanceInPaise).toBe(50000);
    expect(report.userBalances[USER_B].netBalanceInPaise).toBe(-50000);
    expect(report.userBalances[USER_C].netBalanceInPaise).toBe(0);
    expect(report.isBalanced).toBe(true);
  });

  // Scenario 5: Custom split (A pays ₹100; A: ₹30, B: ₹40, C: ₹30)
  // Expected:
  // A: paid 100 - share 30 = +₹70
  // B: paid 0 - share 40 = -₹40
  // C: paid 0 - share 30 = -₹30
  it("Scenario 5: Custom split (A=30, B=40, C=30 on ₹100 bill)", () => {
    const expenses: ExpenseRecord[] = [
      {
        id: "exp_custom",
        payerId: USER_A,
        amountInPaise: 10000,
        splits: [
          { userId: USER_A, amountInPaise: 3000 },
          { userId: USER_B, amountInPaise: 4000 },
          { userId: USER_C, amountInPaise: 3000 },
        ],
      },
    ];

    const report = calculateHouseholdBalances(THREE_ROOMMATES, expenses);

    expect(report.userBalances[USER_A].netBalanceInPaise).toBe(7000);
    expect(report.userBalances[USER_B].netBalanceInPaise).toBe(-4000);
    expect(report.userBalances[USER_C].netBalanceInPaise).toBe(-3000);
    expect(report.isBalanced).toBe(true);
  });

  // Scenario 6: Indivisible amount: ₹100 split among 3 people
  // Splits: A (payer) = 3334 paise, B = 3333 paise, C = 3333 paise
  // Net:
  // A: paid 10000 - 3334 = +6666 paise (+₹66.66)
  // B: paid 0 - 3333 = -3333 paise (-₹33.33)
  // C: paid 0 - 3333 = -3333 paise (-₹33.33)
  // Sum = 6666 - 3333 - 3333 = 0
  it("Scenario 6: ₹100 split among 3 people with remainder 1 paise to payer", () => {
    const splits = calculateEqualSplits(10000, THREE_ROOMMATES, USER_A);
    const expenses: ExpenseRecord[] = [
      {
        id: "exp_hundred",
        payerId: USER_A,
        amountInPaise: 10000,
        splits,
      },
    ];

    const report = calculateHouseholdBalances(THREE_ROOMMATES, expenses);

    expect(report.userBalances[USER_A].netBalanceInPaise).toBe(6666);
    expect(report.userBalances[USER_B].netBalanceInPaise).toBe(-3333);
    expect(report.userBalances[USER_C].netBalanceInPaise).toBe(-3333);
    expect(report.isBalanced).toBe(true);
  });

  // Scenario 7: Fully balanced household (net balances all 0)
  // A pays ₹30 (A: 10, B: 10, C: 10)
  // B pays ₹30 (A: 10, B: 10, C: 10)
  // C pays ₹30 (A: 10, B: 10, C: 10)
  // Everyone paid ₹30, everyone's share is ₹30. Net = 0 for all.
  it("Scenario 7: Fully balanced household", () => {
    const expenses: ExpenseRecord[] = [
      {
        id: "exp_a",
        payerId: USER_A,
        amountInPaise: 3000,
        splits: [
          { userId: USER_A, amountInPaise: 1000 },
          { userId: USER_B, amountInPaise: 1000 },
          { userId: USER_C, amountInPaise: 1000 },
        ],
      },
      {
        id: "exp_b",
        payerId: USER_B,
        amountInPaise: 3000,
        splits: [
          { userId: USER_A, amountInPaise: 1000 },
          { userId: USER_B, amountInPaise: 1000 },
          { userId: USER_C, amountInPaise: 1000 },
        ],
      },
      {
        id: "exp_c",
        payerId: USER_C,
        amountInPaise: 3000,
        splits: [
          { userId: USER_A, amountInPaise: 1000 },
          { userId: USER_B, amountInPaise: 1000 },
          { userId: USER_C, amountInPaise: 1000 },
        ],
      },
    ];

    const report = calculateHouseholdBalances(THREE_ROOMMATES, expenses);

    expect(report.userBalances[USER_A].netBalanceInPaise).toBe(0);
    expect(report.userBalances[USER_B].netBalanceInPaise).toBe(0);
    expect(report.userBalances[USER_C].netBalanceInPaise).toBe(0);
    expect(report.isBalanced).toBe(true);
  });

  // Scenario 8: Complex chain with settlement integration
  // Exp: A pays ₹60 (A: 20, B: 20, C: 20) -> A: +40, B: -20, C: -20
  // Settlement: B pays A ₹20
  // Expected:
  // A: +40 - 20 (received) = +20 (+₹20)
  // B: -20 + 20 (paid) = 0 (₹0)
  // C: -20 (-₹20)
  it("Scenario 8: Settlement clears debt (B pays A ₹20 after ₹60 expense)", () => {
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
        payerId: USER_B, // B paid
        receiverId: USER_A, // A received
        amountInPaise: 2000,
      },
    ];

    const report = calculateHouseholdBalances(THREE_ROOMMATES, expenses, settlements);

    expect(report.userBalances[USER_A].netBalanceInPaise).toBe(2000); // +₹20.00
    expect(report.userBalances[USER_B].netBalanceInPaise).toBe(0); // ₹0.00 (settled!)
    expect(report.userBalances[USER_C].netBalanceInPaise).toBe(-2000); // -₹20.00
    expect(report.isBalanced).toBe(true);
  });

  // Scenario 9: Soft-deleted expenses and settlements are completely ignored
  it("Scenario 9: Soft-deleted expenses and settlements are excluded from calculation", () => {
    const expenses: ExpenseRecord[] = [
      {
        id: "exp_active",
        payerId: USER_A,
        amountInPaise: 6000,
        isDeleted: false,
        splits: [
          { userId: USER_A, amountInPaise: 2000 },
          { userId: USER_B, amountInPaise: 2000 },
          { userId: USER_C, amountInPaise: 2000 },
        ],
      },
      {
        id: "exp_deleted",
        payerId: USER_A,
        amountInPaise: 9000,
        isDeleted: true, // DELETED
        splits: [
          { userId: USER_A, amountInPaise: 3000 },
          { userId: USER_B, amountInPaise: 3000 },
          { userId: USER_C, amountInPaise: 3000 },
        ],
      },
    ];

    const report = calculateHouseholdBalances(THREE_ROOMMATES, expenses);

    expect(report.userBalances[USER_A].netBalanceInPaise).toBe(4000);
    expect(report.userBalances[USER_B].netBalanceInPaise).toBe(-2000);
    expect(report.userBalances[USER_C].netBalanceInPaise).toBe(-2000);
    expect(report.totalHouseholdSpendingInPaise).toBe(6000);
  });
});
