import { z } from "zod";

export const ExpenseTypeEnum = z.enum(["SHARED", "PERSONAL", "CUSTOM"]);

export const ExpenseSplitItemSchema = z.object({
  userId: z.string().trim().min(1, "User ID is required"),
  amountInPaise: z.number().int("Split amount must be an integer").nonnegative("Split amount must be non-negative"),
});

export const CreateExpenseSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(255, "Description must not exceed 255 characters"),
    amountInPaise: z
      .number()
      .int("Amount must be an integer (in paise)")
      .positive("Expense amount must be greater than zero")
      .max(100_000_000, "Expense amount exceeds maximum permitted limit"), // ₹10,00,000 max
    payerId: z.string().trim().min(1, "Payer ID is required"),
    expenseType: ExpenseTypeEnum,
    expenseDate: z.coerce.date().default(() => new Date()),
    splits: z
      .array(ExpenseSplitItemSchema)
      .min(1, "At least one participant share is required"),
  })
  .superRefine((data, ctx) => {
    // 1. Enforce that sum of splits equals total amount
    const totalSplit = data.splits.reduce((acc, curr) => acc + curr.amountInPaise, 0);
    if (totalSplit !== data.amountInPaise) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sum of splits (₹${(totalSplit / 100).toFixed(2)}) must exactly equal expense total (₹${(data.amountInPaise / 100).toFixed(2)})`,
        path: ["splits"],
      });
    }

    // 2. Enforce unique participants in split list
    const userIds = data.splits.map((s) => s.userId);
    const uniqueUserIds = new Set(userIds);
    if (uniqueUserIds.size !== userIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate participant found in splits",
        path: ["splits"],
      });
    }

    // 3. For PERSONAL expenses, ensure exactly one participant
    if (data.expenseType === "PERSONAL" && data.splits.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Personal expense must be assigned to exactly one roommate",
        path: ["splits"],
      });
    }
  });

export const UpdateExpenseSchema = z
  .object({
    id: z.string().trim().min(1, "Expense ID is required"),
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(255, "Description must not exceed 255 characters"),
    amountInPaise: z
      .number()
      .int("Amount must be an integer (in paise)")
      .positive("Expense amount must be greater than zero")
      .max(100_000_000, "Expense amount exceeds maximum permitted limit"),
    payerId: z.string().trim().min(1, "Payer ID is required"),
    expenseType: ExpenseTypeEnum,
    expenseDate: z.coerce.date(),
    splits: z
      .array(ExpenseSplitItemSchema)
      .min(1, "At least one participant share is required"),
  })
  .superRefine((data, ctx) => {
    const totalSplit = data.splits.reduce((acc, curr) => acc + curr.amountInPaise, 0);
    if (totalSplit !== data.amountInPaise) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sum of splits (₹${(totalSplit / 100).toFixed(2)}) must exactly equal expense total (₹${(data.amountInPaise / 100).toFixed(2)})`,
        path: ["splits"],
      });
    }

    const userIds = data.splits.map((s) => s.userId);
    const uniqueUserIds = new Set(userIds);
    if (uniqueUserIds.size !== userIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate participant found in splits",
        path: ["splits"],
      });
    }

    if (data.expenseType === "PERSONAL" && data.splits.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Personal expense must be assigned to exactly one roommate",
        path: ["splits"],
      });
    }
  });

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;
