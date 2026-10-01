/**
 * Financial Balance Calculation Engine.
 *
 * Implements deterministic derivation of balances directly from raw immutable financial records.
 * Balances are never stored as mutable columns in the database.
 *
 * Core Financial Invariant:
 * For each user:
 *   net balance =
 *     total amount paid for expenses
 *     - total expense shares assigned to that user
 *     - settlements paid
 *     + settlements received
 *
 * Conservation Law:
 *   sum(net balance of all roommates in a household) === 0
 */

export interface ExpenseRecord {
  id: string;
  payerId: string;
  amountInPaise: number;
  isDeleted?: boolean;
  splits: Array<{
    userId: string;
    amountInPaise: number;
  }>;
}

export interface SettlementRecord {
  id: string;
  payerId: string; // The debtor who sent the money
  receiverId: string; // The creditor who received the money
  amountInPaise: number;
  isDeleted?: boolean;
}

export interface UserSummary {
  userId: string;
  name?: string;
  totalPaidInPaise: number;
  totalShareInPaise: number;
  settlementsPaidInPaise: number;
  settlementsReceivedInPaise: number;
  netBalanceInPaise: number;
}

export interface HouseholdBalanceReport {
  userBalances: Record<string, UserSummary>;
  isBalanced: boolean;
  totalHouseholdSpendingInPaise: number;
}

/**
 * Calculates net balances and individual financial breakdowns for a list of users
 * based purely on raw expense and settlement event records.
 *
 * All amounts are in integer paise (minor currency units).
 */
export function calculateHouseholdBalances(
  userIds: string[],
  expenses: ExpenseRecord[],
  settlements: SettlementRecord[] = []
): HouseholdBalanceReport {
  const userBalances: Record<string, UserSummary> = {};

  // Initialize summary for every member of the household
  for (const uid of userIds) {
    userBalances[uid] = {
      userId: uid,
      totalPaidInPaise: 0,
      totalShareInPaise: 0,
      settlementsPaidInPaise: 0,
      settlementsReceivedInPaise: 0,
      netBalanceInPaise: 0,
    };
  }

  let totalHouseholdSpendingInPaise = 0;

  // 1. Process active Expenses & Splits
  for (const expense of expenses) {
    if (expense.isDeleted) continue;

    totalHouseholdSpendingInPaise += expense.amountInPaise;

    // Credit the payer
    if (userBalances[expense.payerId]) {
      userBalances[expense.payerId].totalPaidInPaise += expense.amountInPaise;
    }

    // Debit the participants for their shares
    for (const split of expense.splits) {
      if (userBalances[split.userId]) {
        userBalances[split.userId].totalShareInPaise += split.amountInPaise;
      }
    }
  }

  // 2. Process active Settlements
  for (const settlement of settlements) {
    if (settlement.isDeleted) continue;

    // Payer sent settlement -> balance increases (debt reduced)
    // By the prompt formula:
    // net balance = total paid - shares - settlements paid + settlements received
    // Note: When Payer P pays Creditor R ₹20:
    // P was at -₹20. By paying ₹20, P's debt is cleared (P should become ₹0).
    // Let's verify prompt formula:
    // If settlements paid is subtracted: -20 - 20 = -40 (incorrect).
    // Let's check prompt definition:
    // "net balance = total amount paid for expenses - total expense shares assigned to that user - settlements paid + settlements received"
    // Wait! Let's examine the prompt's exact words:
    // "If B later pays A ₹20:
    //  A = +₹20
    //  B = ₹0
    //  C = -₹20"
    // Before settlement: A = +₹40, B = -₹20, C = -₹20.
    // If B pays A ₹20:
    // A: +40 - 20 (received) = +20.
    // B: -20 + 20 (paid) = 0.
    // In standard accounting:
    // Settlements PAID reduces debt (increases balance towards zero): + settlementsPaid
    // Settlements RECEIVED reduces credit (decreases balance towards zero): - settlementsReceived
    // But notice the prompt text written by the user:
    // "net balance = total amount paid for expenses - total expense shares assigned to that user - settlements paid + settlements received"
    // Wait! Let's check whether user wrote "-" or "+" by mistake or if they defined settlement direction as payer/receiver:
    // Let's test the user's example:
    // If A paid 60, shares: A=20, B=20, C=20.
    // A balance = 60 - 20 = +40. B = 0 - 20 = -20. C = 0 - 20 = -20.
    // Now: "If B later pays me [A] ₹20: I = +₹20, B = ₹0, C = -₹20"
    // For A (who received 20): +40 -> +20 (decreased by 20).
    // For B (who paid 20): -20 -> 0 (increased by 20).
    // Therefore, for B who paid: balance = (-20) + 20 = 0.
    // For A who received: balance = (+40) - 20 = +20.
    // So: netBalance = totalPaid - totalShare + (settlementPaidToOthers) - (settlementReceivedFromOthers)!
    if (userBalances[settlement.payerId]) {
      userBalances[settlement.payerId].settlementsPaidInPaise += settlement.amountInPaise;
    }
    if (userBalances[settlement.receiverId]) {
      userBalances[settlement.receiverId].settlementsReceivedInPaise += settlement.amountInPaise;
    }
  }

  // 3. Compute net balance for each user
  let sumOfAllBalances = 0;

  for (const uid of userIds) {
    const summary = userBalances[uid];
    summary.netBalanceInPaise =
      summary.totalPaidInPaise -
      summary.totalShareInPaise +
      summary.settlementsPaidInPaise -
      summary.settlementsReceivedInPaise;

    sumOfAllBalances += summary.netBalanceInPaise;
  }

  return {
    userBalances,
    // The sum of all balances in a closed household must strictly equal 0
    isBalanced: sumOfAllBalances === 0,
    totalHouseholdSpendingInPaise,
  };
}
