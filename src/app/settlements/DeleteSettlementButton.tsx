"use client";

import { useTransition } from "react";
import { deleteSettlementAction } from "@/lib/actions/settlements";

export default function DeleteSettlementButton({ settlementId }: { settlementId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this settlement record?")) {
      startTransition(async () => {
        const res = await deleteSettlementAction(settlementId);
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
