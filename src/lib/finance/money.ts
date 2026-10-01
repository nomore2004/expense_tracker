/**
 * Utilities for integer-based currency (Paise / Cents) calculations.
 * Avoids all binary floating-point representation errors.
 */

/**
 * Converts a decimal string or number (e.g. "100.50" or 100.5) to integer paise (10050).
 */
export function toPaise(amount: number | string): number {
  if (typeof amount === "string") {
    const trimmed = amount.trim();
    if (!trimmed || isNaN(Number(trimmed))) {
      throw new Error(`Invalid monetary amount string: "${amount}"`);
    }
    const parsed = parseFloat(trimmed);
    return Math.round(parsed * 100);
  }
  return Math.round(amount * 100);
}

/**
 * Formats integer paise into a standard decimal currency string (e.g. 10050 -> "₹100.50").
 */
export function formatRupees(paise: number): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;
  const formatted = `₹${rupees}.${remainingPaise.toString().padStart(2, "0")}`;
  return isNegative ? `-${formatted}` : formatted;
}

export interface SplitResult {
  userId: string;
  amountInPaise: number;
}

/**
 * Divides an amount in paise equally among selected participants.
 * Deterministically distributes any indivisible remainder paise (e.g. ₹100 / 3 = ₹33.34, ₹33.33, ₹33.33).
 *
 * Remainder distribution priority:
 * 1. Payer (if among participants) receives the extra paise.
 * 2. Otherwise deterministic sorted order by userId.
 *
 * Invariant guarantee: sum(splits.amountInPaise) === totalAmountInPaise.
 */
export function calculateEqualSplits(
  totalAmountInPaise: number,
  participantUserIds: string[],
  payerId?: string
): SplitResult[] {
  if (!participantUserIds || participantUserIds.length === 0) {
    throw new Error("Cannot split among zero participants");
  }

  if (totalAmountInPaise <= 0) {
    throw new Error("Total amount must be greater than zero");
  }

  const n = participantUserIds.length;
  const baseShare = Math.floor(totalAmountInPaise / n);
  const remainder = totalAmountInPaise % n;

  // Sort participant IDs deterministically so identical inputs always produce identical outputs
  const sortedParticipants = [...participantUserIds].sort();

  // If payer is a participant, prioritize them for remainder distribution
  if (payerId && sortedParticipants.includes(payerId)) {
    const payerIndex = sortedParticipants.indexOf(payerId);
    sortedParticipants.splice(payerIndex, 1);
    sortedParticipants.unshift(payerId);
  }

  let remainingPaiseToDistribute = remainder;

  const splits: SplitResult[] = sortedParticipants.map((userId) => {
    let share = baseShare;
    if (remainingPaiseToDistribute > 0) {
      share += 1;
      remainingPaiseToDistribute -= 1;
    }
    return {
      userId,
      amountInPaise: share,
    };
  });

  // Strict Invariant Check
  const sumOfShares = splits.reduce((sum, s) => sum + s.amountInPaise, 0);
  if (sumOfShares !== totalAmountInPaise) {
    throw new Error(
      `Financial Invariant Violation: Split sum (${sumOfShares}) does not equal total amount (${totalAmountInPaise})`
    );
  }

  return splits;
}

/**
 * Creates a personal expense split where 100% of the expense amount is assigned to one roommate.
 */
export function calculatePersonalSplit(
  totalAmountInPaise: number,
  targetUserId: string
): SplitResult[] {
  if (totalAmountInPaise <= 0) {
    throw new Error("Total amount must be greater than zero");
  }
  if (!targetUserId) {
    throw new Error("Target user ID is required for personal expense");
  }

  return [
    {
      userId: targetUserId,
      amountInPaise: totalAmountInPaise,
    },
  ];
}
