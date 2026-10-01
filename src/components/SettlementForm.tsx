"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordSettlementAction } from "@/lib/actions/settlements";
import { toPaise } from "@/lib/finance/money";

interface Member {
  id: string;
  name: string;
  email: string;
}

interface SettlementFormProps {
  members: Member[];
  currentUserId: string;
}

export default function SettlementForm({ members, currentUserId }: SettlementFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // "I paid" defaults to the logged-in user
  const [payerId, setPayerId] = useState(currentUserId || members[0]?.id || "");
  // "Paid to" defaults to another roommate
  const [receiverId, setReceiverId] = useState(
    members.find((m) => m.id !== currentUserId)?.id || members[1]?.id || ""
  );
  const [amountRupees, setAmountRupees] = useState("");
  const [settlementDate, setSettlementDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (payerId === receiverId) {
      setErrorMessage("Payer and receiver cannot be the same person");
      return;
    }

    let amountInPaise: number;
    try {
      amountInPaise = toPaise(amountRupees);
      if (amountInPaise <= 0) {
        setErrorMessage("Amount must be greater than ₹0");
        return;
      }
    } catch {
      setErrorMessage("Please enter a valid monetary amount");
      return;
    }

    startTransition(async () => {
      const res = await recordSettlementAction({
        payerId,
        receiverId,
        amountInPaise,
        settlementDate: new Date(settlementDate),
        note: note.trim() || undefined,
        idempotencyKey: `settle-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      });

      if (res.success) {
        router.push("/settlements");
        router.refresh();
      } else {
        setErrorMessage(res.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Payer and Receiver Selection with exact UX labels ("I paid", "Paid to") */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
            I Paid (Payer)
          </label>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-xs sm:text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.id === currentUserId ? "(You)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
            Paid To (Receiver)
          </label>
          <select
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-xs sm:text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id} disabled={m.id === payerId}>
                {m.name} {m.id === payerId ? "(Cannot pay yourself)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Amount and Payment Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
            Amount (₹)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amountRupees}
            onChange={(e) => setAmountRupees(e.target.value)}
            placeholder="e.g. 500.00"
            className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-xs sm:text-sm font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
            Payment Date
          </label>
          <input
            type="date"
            required
            value={settlementDate}
            onChange={(e) => setSettlementDate(e.target.value)}
            className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-xs sm:text-sm text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Payment Note */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
          Payment Note (Optional)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Google Pay / UPI transfer, Cash"
          className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-xs sm:text-sm text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {/* Submission Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-lg shadow-xs text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {isPending ? "Recording Settlement..." : "Record Settlement"}
        </button>
      </div>
    </form>
  );
}
