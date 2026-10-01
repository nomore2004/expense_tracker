"use server";

import { prisma } from "@/lib/db";
import { requireAuth, assertHouseholdAccess } from "@/lib/auth/context";
import {
  RecordSettlementSchema,
  RecordSettlementInput,
} from "@/lib/validations/settlement";
import { revalidatePath } from "next/cache";

export interface SettlementDetail {
  id: string;
  householdId: string;
  payerId: string;
  receiverId: string;
  amountInPaise: number;
  settlementDate: Date;
  note: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  payer: {
    id: string;
    name: string;
    email: string;
  };
  receiver: {
    id: string;
    name: string;
    email: string;
  };
}

export type SettlementActionResponse<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Record a new settlement between two roommates.
 * Strictly verifies that both payer and receiver exist, belong to caller's household,
 * and are distinct users.
 */
export async function recordSettlementAction(
  rawInput: RecordSettlementInput
): Promise<SettlementActionResponse<{ id: string }>> {
  const session = await requireAuth();

  const validation = RecordSettlementSchema.safeParse(rawInput);
  if (!validation.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { payerId, receiverId, amountInPaise, settlementDate, note, idempotencyKey } =
    validation.data;

  // 1. Verify payer and receiver both exist and belong to the authenticated household
  const roommates = await prisma.user.findMany({
    where: {
      id: { in: [payerId, receiverId] },
      householdId: session.householdId,
      isActive: true,
    },
    select: { id: true },
  });

  if (roommates.length !== 2) {
    return {
      success: false,
      error: "Both payer and receiver must be active members of your household",
    };
  }

  // 2. Prevent duplicate submissions using idempotency key if provided
  if (idempotencyKey) {
    const existing = await prisma.settlement.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return { success: true, data: { id: existing.id } };
    }
  }

  try {
    const settlement = await prisma.settlement.create({
      data: {
        householdId: session.householdId,
        payerId,
        receiverId,
        amountInPaise,
        settlementDate,
        note: note || null,
        idempotencyKey: idempotencyKey || null,
      },
    });

    revalidatePath("/settlements");
    revalidatePath("/expenses");
    return { success: true, data: { id: settlement.id } };
  } catch (error) {
    console.error("Failed to record settlement:", error);
    return {
      success: false,
      error: "An unexpected error occurred while recording the settlement",
    };
  }
}

/**
 * Retrieve settlement history for the caller's household.
 */
export async function listSettlementsAction(): Promise<
  SettlementActionResponse<SettlementDetail[]>
> {
  try {
    const session = await requireAuth();

    const settlements = await prisma.settlement.findMany({
      where: {
        householdId: session.householdId,
        isDeleted: false,
      },
      include: {
        payer: {
          select: { id: true, name: true, email: true },
        },
        receiver: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { settlementDate: "desc" },
    });

    return { success: true, data: settlements as SettlementDetail[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load settlements",
    };
  }
}

/**
 * Soft delete a settlement.
 */
export async function deleteSettlementAction(
  settlementId: string
): Promise<SettlementActionResponse<void>> {
  try {
    const session = await requireAuth();

    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement || settlement.isDeleted) {
      return { success: false, error: "Settlement not found or already deleted" };
    }

    assertHouseholdAccess(session.householdId, settlement.householdId);

    await prisma.settlement.update({
      where: { id: settlementId },
      data: { isDeleted: true },
    });

    revalidatePath("/settlements");
    revalidatePath("/expenses");
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete settlement",
    };
  }
}
