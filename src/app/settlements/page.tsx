import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { listSettlementsAction } from "@/lib/actions/settlements";
import { formatRupees } from "@/lib/finance/money";
import DeleteSettlementButton from "./DeleteSettlementButton";

export default async function SettlementsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const response = await listSettlementsAction();
  const settlements = response.success ? response.data : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Settlement History
          </h1>
          <p className="text-sm text-gray-600">
            Payments and debt settlements recorded between roommates
          </p>
        </div>
        <Link
          href="/settlements/new"
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
        >
          + Record Settlement
        </Link>
      </div>

      {settlements.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl shadow-sm">
          <p className="text-gray-500 text-base">No settlements recorded yet.</p>
          <Link
            href="/settlements/new"
            className="mt-3 inline-block text-sm font-semibold text-emerald-600 hover:text-emerald-500"
          >
            Record a payment between roommates
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {settlements.map((settlement) => (
              <li
                key={settlement.id}
                className="p-4 sm:p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <span className="text-blue-600 font-bold">
                        {settlement.payer.name}
                      </span>
                      <span className="text-gray-400 font-normal">paid</span>
                      <span className="text-emerald-600 font-bold">
                        {settlement.receiver.name}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500">
                      {new Date(settlement.settlementDate).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {settlement.note && (
                        <span className="ml-2 italic text-gray-600">
                          &mdash; &ldquo;{settlement.note}&rdquo;
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-emerald-600">
                      {formatRupees(settlement.amountInPaise)}
                    </span>
                    <DeleteSettlementButton settlementId={settlement.id} />
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
