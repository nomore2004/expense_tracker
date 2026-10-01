"use server";

import { prisma } from "@/lib/db";
import { requireAuth, assertHouseholdAccess } from "@/lib/auth/context";
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  CreateExpenseInput,
  UpdateExpenseInput,
} from "@/lib/validations/expense";
import { revalidatePath } from "next/cache";

export type ActionResponse<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export interface ExpenseDetail {
  id: string;
  householdId: string;
  payerId: string;
  description: string;
  amountInPaise: number;
  expenseType: "SHARED" | "PERSONAL" | "CUSTOM";
  expenseDate: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  payer: {
    id: string;
    name: string;
    email: string;
  };
  splits: Array<{
    id: string;
    userId: string;
    amountInPaise: number;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

/**
 * Creates an expense and its splits inside an atomic database transaction.
 * Strictly verifies household isolation: payer and all participants must belong to the caller's household.
 */
export async function createExpenseAction(
  rawInput: CreateExpenseInput
): Promise<ActionResponse<{ id: string }>> {
  const session = await requireAuth();

  const validation = CreateExpenseSchema.safeParse(rawInput);
  if (!validation.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { description, amountInPaise, payerId, expenseType, expenseDate, splits } =
    validation.data;

  // 1. Verify payer and all split participants belong to the caller's household
  const involvedUserIds = Array.from(new Set([payerId, ...splits.map((s) => s.userId)]));
  const verifiedUsers = await prisma.user.findMany({
    where: {
      id: { in: involvedUserIds },
      householdId: session.householdId,
      isActive: true,
    },
    select: { id: true },
  });

  if (verifiedUsers.length !== involvedUserIds.length) {
    return {
      success: false,
      error: "All participants and the payer must be active members of your household",
    };
  }

  try {
    // 2. Atomic Database Transaction Boundary
    const newExpense = await prisma.$transaction(async (tx) => {
      // Create expense header
      const expense = await tx.expense.create({
        data: {
          householdId: session.householdId,
          payerId,
          description,
          amountInPaise,
          expenseType,
          expenseDate,
        },
      });

      // Create splits
      await tx.expenseSplit.createMany({
        data: splits.map((s) => ({
          expenseId: expense.id,
          userId: s.userId,
          amountInPaise: s.amountInPaise,
        })),
      });

      return expense;
    });

    revalidatePath("/expenses");
    return { success: true, data: { id: newExpense.id } };
  } catch (error) {
    console.error("Failed to create expense:", error);
    return {
      success: false,
      error: "An unexpected database error occurred while creating the expense",
    };
  }
}

/**
 * List all non-deleted expenses for the caller's household.
 */
export async function listExpensesAction(): Promise<ActionResponse<ExpenseDetail[]>> {
  try {
    const session = await requireAuth();

    const expenses = await prisma.expense.findMany({
      where: {
        householdId: session.householdId,
        isDeleted: false,
      },
      include: {
        payer: {
          select: { id: true, name: true, email: true },
        },
        splits: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { expenseDate: "desc" },
    });

    return { success: true, data: expenses as ExpenseDetail[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load expenses",
    };
  }
}

/**
 * Retrieve a single expense with full splits.
 * Rejects with FORBIDDEN if the expense belongs to another household.
 */
export async function getExpenseAction(
  expenseId: string
): Promise<ActionResponse<ExpenseDetail>> {
  try {
    const session = await requireAuth();

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        payer: {
          select: { id: true, name: true, email: true },
        },
        splits: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!expense || expense.isDeleted) {
      return { success: false, error: "Expense not found" };
    }

    assertHouseholdAccess(session.householdId, expense.householdId);

    return { success: true, data: expense as ExpenseDetail };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Access denied",
    };
  }
}

/**
 * Updates an expense and replaces its splits inside an atomic database transaction.
 * Performs optimistic concurrency check and revalidates splits.
 */
export async function updateExpenseAction(
  rawInput: UpdateExpenseInput
): Promise<ActionResponse<void>> {
  const session = await requireAuth();

  const validation = UpdateExpenseSchema.safeParse(rawInput);
  if (!validation.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { id, description, amountInPaise, payerId, expenseType, expenseDate, splits } =
    validation.data;

  // 1. Verify existence and household ownership
  const existingExpense = await prisma.expense.findUnique({
    where: { id },
  });

  if (!existingExpense || existingExpense.isDeleted) {
    return { success: false, error: "Expense not found or already deleted" };
  }

  assertHouseholdAccess(session.householdId, existingExpense.householdId);

  // 2. Verify all participants belong to household
  const involvedUserIds = Array.from(new Set([payerId, ...splits.map((s) => s.userId)]));
  const verifiedUsers = await prisma.user.findMany({
    where: {
      id: { in: involvedUserIds },
      householdId: session.householdId,
      isActive: true,
    },
    select: { id: true },
  });

  if (verifiedUsers.length !== involvedUserIds.length) {
    return {
      success: false,
      error: "All participants and the payer must be active members of your household",
    };
  }

  try {
    // 3. Atomic Database Transaction: Update header, delete old splits, insert new splits
    await prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: {
          description,
          amountInPaise,
          payerId,
          expenseType,
          expenseDate,
          version: { increment: 1 },
        },
      });

      // Remove existing splits
      await tx.expenseSplit.deleteMany({
        where: { expenseId: id },
      });

      // Re-insert updated splits
      await tx.expenseSplit.createMany({
        data: splits.map((s) => ({
          expenseId: id,
          userId: s.userId,
          amountInPaise: s.amountInPaise,
        })),
      });
    });

    revalidatePath("/expenses");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to update expense:", error);
    return {
      success: false,
      error: "An unexpected error occurred while updating the expense",
    };
  }
}

/**
 * Soft deletes an expense.
 * Enforces household authorization guard.
 */
export async function deleteExpenseAction(
  expenseId: string
): Promise<ActionResponse<void>> {
  try {
    const session = await requireAuth();

    const existingExpense = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existingExpense || existingExpense.isDeleted) {
      return { success: false, error: "Expense not found or already deleted" };
    }

    assertHouseholdAccess(session.householdId, existingExpense.householdId);

    // Soft delete to maintain accounting consistency
    await prisma.expense.update({
      where: { id: expenseId },
      data: {
        isDeleted: true,
        version: { increment: 1 },
      },
    });

    revalidatePath("/expenses");
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete expense",
    };
  }
}
