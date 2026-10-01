import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { listExpensesAction } from "@/lib/actions/expenses";
import { formatRupees } from "@/lib/finance/money";
import DeleteExpenseButton from "./DeleteExpenseButton";

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const response = await listExpensesAction();
  const expenses = response.success ? response.data : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Household Expenses
          </h1>
          <p className="text-sm text-gray-600">
            All shared and personal expenses recorded in your household
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
        >
          + Add New Expense
        </Link>
      </div>

      {expenses.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl shadow-sm">
          <p className="text-gray-500 text-base">No expenses recorded yet.</p>
          <Link
            href="/expenses/new"
            className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-500"
          >
            Record your first expense
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {expenses.map((expense) => (
              <li key={expense.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-base">
                        {expense.description}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          expense.expenseType === "SHARED"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : expense.expenseType === "PERSONAL"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {expense.expenseType}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500">
                      Paid by <strong className="text-gray-700">{expense.payer.name}</strong> on{" "}
                      {new Date(expense.expenseDate).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-700">Splits:</span>
                      {expense.splits.map((s) => (
                        <span
                          key={s.id}
                          className="bg-gray-100 px-2 py-0.5 rounded text-gray-700"
                        >
                          {s.user.name}: {formatRupees(s.amountInPaise)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <span className="text-lg font-bold text-gray-900">
                      {formatRupees(expense.amountInPaise)}
                    </span>

                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/expenses/${expense.id}/edit`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </Link>
                      <span className="text-gray-300">|</span>
                      <DeleteExpenseButton expenseId={expense.id} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
