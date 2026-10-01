"use server";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/context";
import {
  calculateHouseholdBalances,
  HouseholdBalanceReport,
} from "./balanceEngine";

export interface EnrichedUserBalance {
  userId: string;
  name: string;
  email: string;
  totalPaidInPaise: number;
  totalShareInPaise: number;
  settlementsPaidInPaise: number;
  settlementsReceivedInPaise: number;
  netBalanceInPaise: number;
}

export interface HouseholdFinancialReport {
  balances: EnrichedUserBalance[];
  totalHouseholdSpendingInPaise: number;
  isBalanced: boolean;
}

/**
 * Derives the financial balances for the caller's household directly from
 * database records (expenses, splits, and settlements).
 * No mutable balances are stored in the database.
 */
export async function getHouseholdBalancesAction(): Promise<{
  success: boolean;
  data?: HouseholdFinancialReport;
  error?: string;
}> {
  try {
    const session = await requireAuth();

    // 1. Fetch active household members
    const members = await prisma.user.findMany({
      where: {
        householdId: session.householdId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const userIds = members.map((m) => m.id);

    // 2. Fetch all non-deleted expenses with splits for the household
    const expenses = await prisma.expense.findMany({
      where: {
        householdId: session.householdId,
        isDeleted: false,
      },
      select: {
        id: true,
        payerId: true,
        amountInPaise: true,
        splits: {
          select: {
            userId: true,
            amountInPaise: true,
          },
        },
      },
    });

    // 3. Fetch all non-deleted settlements for the household
    const settlements = await prisma.settlement.findMany({
      where: {
        householdId: session.householdId,
        isDeleted: false,
      },
      select: {
        id: true,
        payerId: true,
        receiverId: true,
        amountInPaise: true,
      },
    });

    // 4. Calculate pure balances using the deterministic engine
    const report: HouseholdBalanceReport = calculateHouseholdBalances(
      userIds,
      expenses,
      settlements
    );

    // 5. Enrich with member names and details
    const memberMap = new Map(members.map((m) => [m.id, m]));

    const enrichedBalances: EnrichedUserBalance[] = userIds.map((uid) => {
      const summary = report.userBalances[uid];
      const member = memberMap.get(uid);
      return {
        userId: uid,
        name: member?.name || "Unknown",
        email: member?.email || "",
        totalPaidInPaise: summary.totalPaidInPaise,
        totalShareInPaise: summary.totalShareInPaise,
        settlementsPaidInPaise: summary.settlementsPaidInPaise,
        settlementsReceivedInPaise: summary.settlementsReceivedInPaise,
        netBalanceInPaise: summary.netBalanceInPaise,
      };
    });

    return {
      success: true,
      data: {
        balances: enrichedBalances,
        totalHouseholdSpendingInPaise: report.totalHouseholdSpendingInPaise,
        isBalanced: report.isBalanced,
      },
    };
  } catch (error) {
    console.error("Error calculating household balances:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to calculate balances",
    };
  }
}
