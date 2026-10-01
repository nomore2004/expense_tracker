import { z } from "zod";

export const RecordSettlementSchema = z
  .object({
    payerId: z.string().trim().min(1, "Payer is required"),
    receiverId: z.string().trim().min(1, "Receiver is required"),
    amountInPaise: z
      .number()
      .int("Amount must be an integer (in paise)")
      .positive("Settlement amount must be greater than zero")
      .max(100_000_000, "Settlement amount exceeds maximum permitted limit"),
    settlementDate: z.coerce.date().default(() => new Date()),
    note: z
      .string()
      .trim()
      .max(255, "Note must not exceed 255 characters")
      .optional()
      .nullable(),
    idempotencyKey: z
      .string()
      .trim()
      .max(64)
      .optional()
      .nullable(),
  })
  .refine((data) => data.payerId !== data.receiverId, {
    message: "Payer and receiver cannot be the same person",
    path: ["receiverId"],
  });

export type RecordSettlementInput = z.infer<typeof RecordSettlementSchema>;
