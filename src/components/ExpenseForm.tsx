"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createExpenseAction,
  updateExpenseAction,
  ExpenseDetail,
} from "@/lib/actions/expenses";
import {
  toPaise,
  formatRupees,
  calculateEqualSplits,
  calculatePersonalSplit,
} from "@/lib/finance/money";

interface Member {
  id: string;
  name: string;
  email: string;
}

interface ExpenseFormProps {
  members: Member[];
  currentUserId: string;
  initialExpense?: ExpenseDetail;
  mode: "create" | "edit";
}

export default function ExpenseForm({
  members,
  currentUserId,
  initialExpense,
  mode,
}: ExpenseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [description, setDescription] = useState(initialExpense?.description || "");
  const [amountRupees, setAmountRupees] = useState(
    initialExpense ? (initialExpense.amountInPaise / 100).toString() : ""
  );
  const [payerId, setPayerId] = useState(
    initialExpense?.payerId || currentUserId || (members[0]?.id ?? "")
  );
  const [expenseType, setExpenseType] = useState<"SHARED" | "PERSONAL" | "CUSTOM">(
    initialExpense?.expenseType || "SHARED"
  );
  const [expenseDate, setExpenseDate] = useState(
    initialExpense
      ? new Date(initialExpense.expenseDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );

  // Participant selections for SHARED
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    initialExpense?.splits.map((s) => s.userId) || members.map((m) => m.id)
  );

  // Target roommate for PERSONAL
  const [personalTargetId, setPersonalTargetId] = useState<string>(
    initialExpense?.expenseType === "PERSONAL"
      ? initialExpense.splits[0]?.userId || members[0]?.id || ""
      : members[0]?.id || ""
  );

  // Custom amounts for CUSTOM (stored as rupees string for editing)
  const [customShares, setCustomShares] = useState<Record<string, string>>(() => {
    if (initialExpense?.expenseType === "CUSTOM") {
      const map: Record<string, string> = {};
      initialExpense.splits.forEach((s) => {
        map[s.userId] = (s.amountInPaise / 100).toString();
      });
      return map;
    }
    const initialMap: Record<string, string> = {};
    members.forEach((m) => {
      initialMap[m.id] = "0";
    });
    return initialMap;
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleParticipant = (userId: string) => {
    if (selectedParticipants.includes(userId)) {
      if (selectedParticipants.length <= 1) {
        alert("At least one roommate must be selected");
        return;
      }
      setSelectedParticipants(selectedParticipants.filter((id) => id !== userId));
    } else {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

  const handleCustomShareChange = (userId: string, value: string) => {
    setCustomShares((prev) => ({
      ...prev,
      [userId]: value,
    }));
  };

  // Preview split calculations
  const parsedTotalPaise = (() => {
    try {
      const num = parseFloat(amountRupees);
      return !isNaN(num) && num > 0 ? toPaise(num) : 0;
    } catch {
      return 0;
    }
  })();

  const previewSplits = (() => {
    if (parsedTotalPaise <= 0) return [];
    try {
      if (expenseType === "SHARED") {
        return calculateEqualSplits(parsedTotalPaise, selectedParticipants, payerId);
      }
      if (expenseType === "PERSONAL") {
        return calculatePersonalSplit(parsedTotalPaise, personalTargetId);
      }
      if (expenseType === "CUSTOM") {
        return members
          .map((m) => {
            const raw = customShares[m.id] || "0";
            const val = parseFloat(raw);
            return {
              userId: m.id,
              amountInPaise: !isNaN(val) && val > 0 ? toPaise(val) : 0,
            };
          })
          .filter((s) => s.amountInPaise > 0);
      }
    } catch {
      return [];
    }
    return [];
  })();

  const customTotalPaise =
    expenseType === "CUSTOM"
      ? previewSplits.reduce((acc, curr) => acc + curr.amountInPaise, 0)
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let amountInPaise: number;
    try {
      amountInPaise = toPaise(amountRupees);
      if (amountInPaise <= 0) {
        setErrorMessage("Please enter an amount greater than ₹0");
        return;
      }
    } catch {
      setErrorMessage("Please enter a valid amount");
      return;
    }

    let calculatedSplits: Array<{ userId: string; amountInPaise: number }>;

    try {
      if (expenseType === "SHARED") {
        if (selectedParticipants.length === 0) {
          setErrorMessage("Please select at least one roommate to split with");
          return;
        }
        calculatedSplits = calculateEqualSplits(
          amountInPaise,
          selectedParticipants,
          payerId
        );
      } else if (expenseType === "PERSONAL") {
        if (!personalTargetId) {
          setErrorMessage("Please select the roommate this expense is for");
          return;
        }
        calculatedSplits = calculatePersonalSplit(amountInPaise, personalTargetId);
      } else {
        // CUSTOM
        calculatedSplits = members
          .map((m) => {
            const share = parseFloat(customShares[m.id] || "0");
            return {
              userId: m.id,
              amountInPaise: !isNaN(share) && share > 0 ? toPaise(share) : 0,
            };
          })
          .filter((s) => s.amountInPaise > 0);

        const customSum = calculatedSplits.reduce((a, b) => a + b.amountInPaise, 0);
        if (customSum !== amountInPaise) {
          setErrorMessage(
            `Sum of custom shares (${formatRupees(customSum)}) must exactly equal total amount (${formatRupees(amountInPaise)})`
          );
          return;
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error calculating splits");
      return;
    }

    startTransition(async () => {
      if (mode === "create") {
        const res = await createExpenseAction({
          description,
          amountInPaise,
          payerId,
          expenseType,
          expenseDate: new Date(expenseDate),
          splits: calculatedSplits,
        });

        if (res.success) {
          router.push("/expenses");
          router.refresh();
        } else {
          setErrorMessage(res.error);
        }
      } else if (mode === "edit" && initialExpense) {
        const res = await updateExpenseAction({
          id: initialExpense.id,
          description,
          amountInPaise,
          payerId,
          expenseType,
          expenseDate: new Date(expenseDate),
          splits: calculatedSplits,
        });

        if (res.success) {
          router.push("/expenses");
          router.refresh();
        } else {
          setErrorMessage(res.error);
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <input
          type="text"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Basmati Rice, Wifi Bill, Milk"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      {/* Amount & Date Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amountRupees}
            onChange={(e) => setAmountRupees(e.target.value)}
            placeholder="0.00"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-semibold"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            required
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Who Paid */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Who Paid?</label>
        <select
          value={payerId}
          onChange={(e) => setPayerId(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.id === currentUserId ? "(You)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Expense Type Tabs */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Split Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(["SHARED", "PERSONAL", "CUSTOM"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setExpenseType(type)}
              className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center cursor-pointer transition-colors ${
                expenseType === type
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Split Details Section */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
        {expenseType === "SHARED" && (
          <div>
            <span className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Split Equally Among
            </span>
            <div className="space-y-2">
              {members.map((m) => {
                const isChecked = selectedParticipants.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex items-center space-x-3 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleParticipant(m.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-900 font-medium">{m.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {expenseType === "PERSONAL" && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Assign 100% of Expense To
            </label>
            <select
              value={personalTargetId}
              onChange={(e) => setPersonalTargetId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white sm:text-sm"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {expenseType === "CUSTOM" && (
          <div className="space-y-3">
            <span className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Manually Specify Each Roommate&apos;s Share (₹)
            </span>
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-900">{m.name}</span>
                <div className="w-32">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customShares[m.id] || ""}
                    onChange={(e) => handleCustomShareChange(m.id, e.target.value)}
                    placeholder="0.00"
                    className="block w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm text-right font-medium"
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-200 flex justify-between text-xs font-semibold">
              <span className="text-gray-600">Total Custom Shares:</span>
              <span
                className={
                  customTotalPaise === parsedTotalPaise && parsedTotalPaise > 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }
              >
                {formatRupees(customTotalPaise)} / {formatRupees(parsedTotalPaise)}
              </span>
            </div>
          </div>
        )}

        {/* Calculated Splits Breakdown Preview */}
        {previewSplits.length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <span className="block text-xs font-medium text-gray-500 mb-1">
              Calculated Split Preview:
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              {previewSplits.map((s) => {
                const member = members.find((m) => m.id === s.userId);
                return (
                  <span
                    key={s.userId}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-gray-300 text-gray-800"
                  >
                    {member?.name}: {formatRupees(s.amountInPaise)}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {isPending
            ? mode === "create"
              ? "Saving..."
              : "Updating..."
            : mode === "create"
            ? "Record Expense"
            : "Update Expense"}
        </button>
      </div>
    </form>
  );
}
