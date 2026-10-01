"use server";

import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  setSessionCookie,
  clearSessionCookie,
  getCurrentUser,
  requireAuth,
  assertHouseholdAccess,
} from "@/lib/auth/context";
import {
  RegisterSchema,
  LoginSchema,
  RegisterInput,
  LoginInput,
} from "@/lib/validations/auth";

export type AuthActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Register a user either by creating a new household or joining an existing one.
 * Max 3 active roommates allowed per household.
 */
export async function registerAction(
  rawInput: RegisterInput
): Promise<AuthActionResult<{ userId: string; householdId: string }>> {
  const validation = RegisterSchema.safeParse(rawInput);
  if (!validation.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { name, email, password, householdName, joinHouseholdId } = validation.data;

  try {
    // 1. Check if email already registered
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        success: false,
        error: "An account with this email address already exists",
      };
    }

    let targetHouseholdId = joinHouseholdId;

    // 2. Either join existing household or create a new one
    if (targetHouseholdId) {
      const existingHousehold = await prisma.household.findUnique({
        where: { id: targetHouseholdId },
        include: {
          users: {
            where: { isActive: true },
          },
        },
      });

      if (!existingHousehold) {
        return {
          success: false,
          error: "The specified household does not exist",
        };
      }

      // Enforce the 3 roommates maximum requirement
      if (existingHousehold.users.length >= 3) {
        return {
          success: false,
          error: "Household already has the maximum allowed roommates (3)",
        };
      }
    } else if (householdName) {
      const newHousehold = await prisma.household.create({
        data: {
          name: householdName,
          currency: "INR",
        },
      });
      targetHouseholdId = newHousehold.id;
    } else {
      return {
        success: false,
        error: "Either household name or join household ID must be provided",
      };
    }

    // 3. Hash password with bcrypt (12 rounds)
    const passwordHash = await hashPassword(password);

    // 4. Create user
    const newUser = await prisma.user.create({
      data: {
        householdId: targetHouseholdId,
        name,
        email,
        passwordHash,
      },
    });

    // 5. Establish secure session cookie
    await setSessionCookie({
      userId: newUser.id,
      householdId: targetHouseholdId,
      email: newUser.email,
      name: newUser.name,
    });

    return {
      success: true,
      data: {
        userId: newUser.id,
        householdId: targetHouseholdId,
      },
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error: "A system error occurred during registration. Please try again.",
    };
  }
}

/**
 * Log in with email and password
 */
export async function loginAction(
  rawInput: LoginInput
): Promise<AuthActionResult<{ userId: string; householdId: string }>> {
  const validation = LoginSchema.safeParse(rawInput);
  if (!validation.success) {
    return {
      success: false,
      error: "Invalid input",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validation.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      // Intentionally generic error message to prevent account enumeration
      return {
        success: false,
        error: "Invalid email or password",
      };
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        success: false,
        error: "Invalid email or password",
      };
    }

    await setSessionCookie({
      userId: user.id,
      householdId: user.householdId,
      email: user.email,
      name: user.name,
    });

    return {
      success: true,
      data: {
        userId: user.id,
        householdId: user.householdId,
      },
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: "A system error occurred during login. Please try again.",
    };
  }
}

/**
 * Log out and clear session cookie
 */
export async function logoutAction(): Promise<AuthActionResult<void>> {
  try {
    await clearSessionCookie();
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Logout error:", error);
    return {
      success: false,
      error: "An error occurred while logging out",
    };
  }
}

/**
 * Get the current authenticated user and household members
 * Strictly enforces household isolation.
 */
export async function getHouseholdMembersAction(): Promise<
  AuthActionResult<{
    currentUserId: string;
    householdId: string;
    members: Array<{ id: string; name: string; email: string }>;
  }>
> {
  try {
    const session = await requireAuth();

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

    return {
      success: true,
      data: {
        currentUserId: session.userId,
        householdId: session.householdId,
        members,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Authentication required",
    };
  }
}

/**
 * Access a specific household by ID.
 * Strict authorization check: rejects if user attempts to access any household other than their own.
 */
export async function getHouseholdDataAction(
  targetHouseholdId: string
): Promise<AuthActionResult<{ id: string; name: string; currency: string }>> {
  try {
    const session = await requireAuth();
    assertHouseholdAccess(session.householdId, targetHouseholdId);

    const household = await prisma.household.findUnique({
      where: { id: targetHouseholdId },
      select: { id: true, name: true, currency: true },
    });

    if (!household) {
      return { success: false, error: "Household not found" };
    }

    return { success: true, data: household };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Access denied",
    };
  }
}
