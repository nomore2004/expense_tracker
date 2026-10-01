import { z } from "zod";

export const RegisterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name must not exceed 100 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address")
    .max(191, "Email must not exceed 191 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(72, "Password must not exceed 72 characters"),
  householdName: z
    .string()
    .trim()
    .min(2, "Household name must be at least 2 characters long")
    .max(100, "Household name must not exceed 100 characters")
    .optional(),
  joinHouseholdId: z
    .string()
    .trim()
    .optional(),
}).refine(
  (data) => Boolean(data.householdName || data.joinHouseholdId),
  {
    message: "Either create a new household or provide an existing household ID to join",
    path: ["householdName"],
  }
);

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
  password: z
    .string()
    .min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
