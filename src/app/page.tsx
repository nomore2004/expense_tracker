import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { getHouseholdBalancesAction } from "@/lib/finance/balances";
import { listExpensesAction } from "@/lib/actions/expenses";
import { listSettlementsAction } from "@/lib/actions/settlements";
import { formatRupees } from "@/lib/finance/money";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // If user is not logged in, show the clean landing hero
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 mb-6">
          Simple &bull; Transparent &bull; Exact
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          Roommate Expense Tracker
        </h1>
        <p className="mt-4 text-base text-gray-600 sm:text-lg">
          Accurately track shared groceries, bills, personal expenses, and settlements for exactly 3 roommates with zero penny loss.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <Link
            href="/login"
            className="w-full sm:w-auto rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Log In to Your Household
          </Link>
          <Link
            href="/register"
            className="w-full sm:w-auto rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Create / Join Household
          </Link>
        </div>
      </div>
    );
  }

  // Fetch dashboard data in parallel
  const [balanceRes, expenseRes, settlementRes] = await Promise.all([
    getHouseholdBalancesAction(),
    listExpensesAction(),
    listSettlementsAction(),
  ]);

  const balances = balanceRes.success && balanceRes.data ? balanceRes.data.balances : [];
  const totalSpending = balanceRes.success && balanceRes.data ? balanceRes.data.totalHouseholdSpendingInPaise : 0;
  const recentExpenses = expenseRes.success ? expenseRes.data.slice(0, 5) : [];
  const recentSettlements = settlementRes.success ? settlementRes.data.slice(0, 5) : [];

  // Current user's individual financial breakdown
  const mySummary = balances.find((b) => b.userId === user.userId);
  const myNetBalance = mySummary ? mySummary.netBalanceInPaise : 0;
  const myTotalPaid = mySummary ? mySummary.totalPaidInPaise : 0;
  const myTotalShare = mySummary ? mySummary.totalShareInPaise : 0;

  // Debt/Credit Status
  const isPositive = myNetBalance > 0;
  const isNegative = myNetBalance < 0;
  const isZero = myNetBalance === 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Welcome back, {user.name}!
          </h1>
          <p className="text-sm text-gray-600">
            Here is your live household financial overview
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/expenses/new"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
          >
            + Add Expense
          </Link>
          <Link
            href="/settlements/new"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg shadow-sm hover:bg-emerald-700 transition-colors"
          >
            + Settle Debt
          </Link>
        </div>
      </div>

      {/* Main Net Balance Hero Card */}
      <div
        className={`p-6 sm:p-8 rounded-2xl border shadow-sm transition-all ${
          isPositive
            ? "bg-emerald-50/60 border-emerald-200"
            : isNegative
            ? "bg-rose-50/60 border-rose-200"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Your Current Balance
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-3xl sm:text-4xl font-extrabold ${
                  isPositive
                    ? "text-emerald-700"
                    : isNegative
                    ? "text-rose-700"
                    : "text-gray-900"
                }`}
              >
                {formatRupees(myNetBalance)}
              </span>
              <span className="text-sm font-medium text-gray-600">
                {isPositive
                  ? "(You are owed money)"
                  : isNegative
                  ? "(You owe money)"
                  : "(All settled up! 🎉)"}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              {isPositive && "Other roommates will pay you to clear this balance."}
              {isNegative && "Make a settlement payment to your roommates to clear this debt."}
              {isZero && "You do not owe or have to receive any money."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t sm:border-t-0 sm:border-l border-gray-200 pt-4 sm:pt-0 sm:pl-8">
            <div>
              <span className="text-xs font-semibold text-gray-500 block">Total You Paid</span>
              <span className="text-lg font-bold text-gray-900">{formatRupees(myTotalPaid)}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500 block">Your Share</span>
              <span className="text-lg font-bold text-gray-900">{formatRupees(myTotalShare)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Household Roommates Balances Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Roommate Balances</h2>
          <span className="text-xs text-gray-500 font-medium">
            Total Household Spent: {formatRupees(totalSpending)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {balances.map((roommate) => {
            const isMe = roommate.userId === user.userId;
            const rPositive = roommate.netBalanceInPaise > 0;
            const rNegative = roommate.netBalanceInPaise < 0;

            return (
              <div
                key={roommate.userId}
                className={`p-5 rounded-xl border bg-white shadow-xs space-y-3 ${
                  isMe ? "ring-2 ring-blue-500/20 border-blue-300" : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900 text-sm">
                    {roommate.name} {isMe && <span className="text-xs text-blue-600 font-normal">(You)</span>}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      rPositive
                        ? "bg-emerald-100 text-emerald-800"
                        : rNegative
                        ? "bg-rose-100 text-rose-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {rPositive ? "Owed" : rNegative ? "Owes" : "Settled"}
                  </span>
                </div>

                <div className="text-2xl font-bold text-gray-900">
                  {formatRupees(roommate.netBalanceInPaise)}
                </div>

                <div className="pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Paid for expenses:</span>
                    <span className="font-medium text-gray-700">{formatRupees(roommate.totalPaidInPaise)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Personal share:</span>
                    <span className="font-medium text-gray-700">{formatRupees(roommate.totalShareInPaise)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Expenses */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">Recent Expenses</h3>
            <Link href="/expenses" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
              View all &rarr;
            </Link>
          </div>

          {recentExpenses.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No expenses recorded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentExpenses.map((exp) => (
                <li key={exp.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-900 block">{exp.description}</span>
                    <span className="text-xs text-gray-500">
                      Paid by {exp.payer.name} on{" "}
                      {new Date(exp.expenseDate).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <span className="font-bold text-gray-900">{formatRupees(exp.amountInPaise)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Settlements */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">Recent Settlements</h3>
            <Link href="/settlements" className="text-xs font-semibold text-emerald-600 hover:text-emerald-800">
              View all &rarr;
            </Link>
          </div>

          {recentSettlements.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No settlements recorded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentSettlements.map((st) => (
                <li key={st.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-900 block">
                      {st.payer.name} &rarr; {st.receiver.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(st.settlementDate).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      })}
                      {st.note ? ` &bull; ${st.note}` : ""}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-600">{formatRupees(st.amountInPaise)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
