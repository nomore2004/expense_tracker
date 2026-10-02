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
          Track shared expenses between roommates. When someone buys something, it automatically splits equally and shows who owes whom.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <Link
            href="/login"
            className="w-full sm:w-auto rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Log In
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
  const recentExpenses = expenseRes.success ? expenseRes.data.slice(0, 10) : [];
  const recentSettlements = settlementRes.success ? settlementRes.data.slice(0, 5) : [];

  // Current user's balance
  const mySummary = balances.find((b) => b.userId === user.userId);
  const myNetBalance = mySummary ? mySummary.netBalanceInPaise : 0;

  // Calculate "who owes whom" - the part user really cares about
  // People with negative balance owe money to people with positive balance
  const creditors = balances.filter((b) => b.netBalanceInPaise > 0).sort((a, b) => b.netBalanceInPaise - a.netBalanceInPaise);
  const debtors = balances.filter((b) => b.netBalanceInPaise < 0).sort((a, b) => a.netBalanceInPaise - b.netBalanceInPaise);

  // Calculate simplified debts (who should pay whom)
  const debts: Array<{ from: string; fromName: string; to: string; toName: string; amount: number }> = [];
  const debtorsCopy = debtors.map((d) => ({ ...d, remaining: Math.abs(d.netBalanceInPaise) }));
  const creditorsCopy = creditors.map((c) => ({ ...c, remaining: c.netBalanceInPaise }));

  for (const debtor of debtorsCopy) {
    for (const creditor of creditorsCopy) {
      if (debtor.remaining <= 0 || creditor.remaining <= 0) continue;
      const payment = Math.min(debtor.remaining, creditor.remaining);
      if (payment > 0) {
        debts.push({
          from: debtor.userId,
          fromName: debtor.name,
          to: creditor.userId,
          toName: creditor.name,
          amount: payment,
        });
        debtor.remaining -= payment;
        creditor.remaining -= payment;
      }
    }
  }

  // What does the current user owe or is owed?
  const myDebts = debts.filter((d) => d.from === user.userId);
  const myCredits = debts.filter((d) => d.to === user.userId);

  const isPositive = myNetBalance > 0;
  const isNegative = myNetBalance < 0;
  const isZero = myNetBalance === 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Hi, {user.name}!
          </h1>
          <p className="text-sm text-gray-600">
            Total household spending: {formatRupees(totalSpending)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/expenses/new"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
          >
            + I Bought Something
          </Link>
          <Link
            href="/settlements/new"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg shadow-sm hover:bg-emerald-700 transition-colors"
          >
            + I Paid Someone Back
          </Link>
        </div>
      </div>

      {/* YOUR STATUS - Big clear card */}
      <div
        className={`p-6 sm:p-8 rounded-2xl border-2 shadow-sm ${
          isPositive
            ? "bg-emerald-50 border-emerald-300"
            : isNegative
            ? "bg-rose-50 border-rose-300"
            : "bg-gray-50 border-gray-300"
        }`}
      >
        <div className="text-center">
          <span
            className={`text-4xl sm:text-5xl font-extrabold ${
              isPositive
                ? "text-emerald-700"
                : isNegative
                ? "text-rose-700"
                : "text-gray-700"
            }`}
          >
            {formatRupees(myNetBalance)}
          </span>
          <p className="mt-2 text-lg font-semibold text-gray-800">
            {isPositive
              ? "💰 Others owe you money"
              : isNegative
              ? "📋 You owe money"
              : "✅ All settled up!"}
          </p>
        </div>

        {/* What YOU specifically owe */}
        {myDebts.length > 0 && (
          <div className="mt-4 space-y-2">
            {myDebts.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-rose-200"
              >
                <span className="text-sm font-medium text-gray-800">
                  You owe <span className="font-bold">{d.toName}</span>
                </span>
                <span className="text-lg font-bold text-rose-600">
                  {formatRupees(d.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* What others owe YOU */}
        {myCredits.length > 0 && (
          <div className="mt-4 space-y-2">
            {myCredits.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-emerald-200"
              >
                <span className="text-sm font-medium text-gray-800">
                  <span className="font-bold">{d.fromName}</span> owes you
                </span>
                <span className="text-lg font-bold text-emerald-600">
                  {formatRupees(d.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WHO OWES WHOM - The complete picture */}
      {debts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">💸 Who Owes Whom</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {debts.map((d, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-rose-600">{d.fromName}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-bold text-emerald-600">{d.toName}</span>
                </div>
                <span className="text-base font-bold text-gray-900">
                  {formatRupees(d.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EVERYONE'S BALANCE - Simple cards */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">👥 Everyone&apos;s Balance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {balances.map((roommate) => {
            const isMe = roommate.userId === user.userId;
            const rPositive = roommate.netBalanceInPaise > 0;
            const rNegative = roommate.netBalanceInPaise < 0;

            return (
              <div
                key={roommate.userId}
                className={`p-5 rounded-xl border bg-white shadow-xs text-center ${
                  isMe ? "ring-2 ring-blue-500/30 border-blue-300" : "border-gray-200"
                }`}
              >
                <div className="font-semibold text-gray-900 text-base">
                  {roommate.name} {isMe && <span className="text-xs text-blue-600 font-normal">(You)</span>}
                </div>
                <div
                  className={`text-2xl font-bold mt-1 ${
                    rPositive
                      ? "text-emerald-600"
                      : rNegative
                      ? "text-rose-600"
                      : "text-gray-600"
                  }`}
                >
                  {formatRupees(roommate.netBalanceInPaise)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {rPositive
                    ? "is owed money"
                    : rNegative
                    ? "owes money"
                    : "all settled ✅"}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-0.5">
                  <div>Paid: {formatRupees(roommate.totalPaidInPaise)}</div>
                  <div>Share: {formatRupees(roommate.totalShareInPaise)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RECENT EXPENSES */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">🧾 Recent Expenses</h3>
          <Link href="/expenses" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
            View all &rarr;
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No expenses recorded yet. Click &quot;I Bought Something&quot; to add one!</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentExpenses.map((exp) => {
              // Show how this expense affects the current user
              const mySplit = exp.splits.find((s) => s.userId === user.userId);
              const iPaid = exp.payerId === user.userId;

              return (
                <li key={exp.id} className="py-3">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900 block">{exp.description}</span>
                      <span className="text-xs text-gray-500">
                        {iPaid ? "You paid" : `${exp.payer.name} paid`}{" "}
                        {formatRupees(exp.amountInPaise)} &bull;{" "}
                        {new Date(exp.expenseDate).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="text-right">
                      {mySplit && (
                        <span className="text-xs text-gray-500 block">
                          Your share: {formatRupees(mySplit.amountInPaise)}
                        </span>
                      )}
                      {iPaid && mySplit && (
                        <span className="text-xs font-semibold text-emerald-600">
                          Others owe you {formatRupees(exp.amountInPaise - mySplit.amountInPaise)}
                        </span>
                      )}
                      {!iPaid && mySplit && (
                        <span className="text-xs font-semibold text-rose-600">
                          You owe {formatRupees(mySplit.amountInPaise)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* RECENT SETTLEMENTS */}
      {recentSettlements.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">🤝 Recent Payments</h3>
            <Link href="/settlements" className="text-xs font-semibold text-emerald-600 hover:text-emerald-800">
              View all &rarr;
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {recentSettlements.map((st) => (
              <li key={st.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-900 block">
                    {st.payer.name} paid {st.receiver.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(st.settlementDate).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}
                    {st.note ? ` • ${st.note}` : ""}
                  </span>
                </div>
                <span className="font-bold text-emerald-600">{formatRupees(st.amountInPaise)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
