"use client";

import { useTransition } from "react";
import { deleteExpenseAction } from "@/lib/actions/expenses";

export default function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this expense?")) {
      startTransition(async () => {
        const res = await deleteExpenseAction(expenseId);
        if (!res.success) {
          alert(res.error);
        }
      });
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50 cursor-pointer"
    >
      {isPending ? "Deleting..." : "Delete"}
    </button>
  );
}
