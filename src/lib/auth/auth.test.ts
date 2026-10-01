import { describe, it, expect } from "vitest";
import { RegisterSchema, LoginSchema } from "@/lib/validations/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSession, verifySession } from "@/lib/auth/session";
import { assertHouseholdAccess } from "@/lib/auth/context";

describe("Phase 2 — Authentication & Household Access Unit Tests", () => {
  // 1. Password Hashing & Verification
  describe("Password Hashing & Plaintext Avoidance", () => {
    it("should never store password as plaintext and verify correct hash", async () => {
      const plaintextPassword = "SuperSecretPassword123!";
      const hashedPassword = await hashPassword(plaintextPassword);

      // Verify it's hashed and not plaintext
      expect(hashedPassword).not.toBe(plaintextPassword);
      expect(hashedPassword.startsWith("$2a$") || hashedPassword.startsWith("$2b$")).toBe(true);

      // Verify correct password matches
      const isMatch = await verifyPassword(plaintextPassword, hashedPassword);
      expect(isMatch).toBe(true);

      // Verify incorrect password fails
      const isBadMatch = await verifyPassword("WrongPassword123!", hashedPassword);
      expect(isBadMatch).toBe(false);
    });
  });

  // 2. Validation Rules (Valid, Invalid, Boundaries)
  describe("Validation Rules (Zod)", () => {
    it("should validate a correct registration input for new household", () => {
      const input = {
        name: "Alex Johnson",
        email: "alex@example.com",
        password: "securePassword123",
        householdName: "Flat 101",
      };
      const result = RegisterSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should validate a correct registration input joining an existing household", () => {
      const input = {
        name: "Brian Miller",
        email: "brian@example.com",
        password: "securePassword123",
        joinHouseholdId: "hh_existing_123",
      };
      const result = RegisterSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject registration with invalid email", () => {
      const input = {
        name: "Charlie",
        email: "not-an-email",
        password: "password123",
        householdName: "Flat 101",
      };
      const result = RegisterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email).toBeDefined();
      }
    });

    it("should reject registration with short password (< 8 chars)", () => {
      const input = {
        name: "Charlie",
        email: "charlie@example.com",
        password: "short",
        householdName: "Flat 101",
      };
      const result = RegisterSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toBeDefined();
      }
    });

    it("should reject registration if neither householdName nor joinHouseholdId is provided", () => {
      const input = {
        name: "Charlie",
        email: "charlie@example.com",
        password: "validPassword123",
      };
      const result = RegisterSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should validate login input and reject empty credentials", () => {
      const valid = LoginSchema.safeParse({
        email: "user@example.com",
        password: "password123",
      });
      expect(valid.success).toBe(true);

      const invalid = LoginSchema.safeParse({
        email: "",
        password: "",
      });
      expect(invalid.success).toBe(false);
    });
  });

  // 3. Stateless Session Integrity
  describe("Stateless JWT Sessions", () => {
    it("should sign and verify valid session token", async () => {
      const sessionData = {
        userId: "user_123",
        householdId: "hh_456",
        email: "alex@example.com",
        name: "Alex",
      };

      const token = await signSession(sessionData);
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // Standard JWT header.payload.sig

      const decoded = await verifySession(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(sessionData.userId);
      expect(decoded?.householdId).toBe(sessionData.householdId);
      expect(decoded?.email).toBe(sessionData.email);
    });

    it("should return null for tampered or invalid token", async () => {
      const tamperedToken = "header.tamperedPayload.invalidSignature";
      const decoded = await verifySession(tamperedToken);
      expect(decoded).toBeNull();
    });
  });

  // 4. Household Isolation & Cross-Household Access Checks
  describe("Household Isolation & Authorization", () => {
    it("should permit access when user household matches resource household", () => {
      const userHousehold = "hh_apartment_4b";
      const resourceHousehold = "hh_apartment_4b";

      expect(() => {
        assertHouseholdAccess(userHousehold, resourceHousehold);
      }).not.toThrow();
    });

    it("should throw FORBIDDEN error on cross-household access attempt", () => {
      const userHousehold = "hh_apartment_4b";
      const targetAnotherHousehold = "hh_apartment_other_tenant";

      expect(() => {
        assertHouseholdAccess(userHousehold, targetAnotherHousehold);
      }).toThrow(/FORBIDDEN: Access denied/);
    });

    it("should reject access when user has empty or null household ID", () => {
      expect(() => {
        assertHouseholdAccess("", "hh_apartment_4b");
      }).toThrow(/FORBIDDEN: Access denied/);
    });
  });
});
