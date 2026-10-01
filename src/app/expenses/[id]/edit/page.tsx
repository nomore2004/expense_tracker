import { getCurrentUser } from "@/lib/auth/context";
import { redirect, notFound } from "next/navigation";
import { getHouseholdMembersAction } from "@/lib/actions/auth";
import { getExpenseAction } from "@/lib/actions/expenses";
import ExpenseForm from "@/components/ExpenseForm";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const [membersRes, expenseRes] = await Promise.all([
    getHouseholdMembersAction(),
    getExpenseAction(id),
  ]);

  if (!expenseRes.success || !expenseRes.data) {
    notFound();
  }

  const members = membersRes.success ? membersRes.data.members : [];
  const expense = expenseRes.data;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Edit Expense
        </h1>
        <p className="text-sm text-gray-600">
          Modify description, amount, payer, or split distribution
        </p>
      </div>

      <div className="bg-white p-6 sm:p-8 border border-gray-200 rounded-xl shadow-sm">
        <ExpenseForm
          members={members}
          currentUserId={user.userId}
          initialExpense={expense}
          mode="edit"
        />
      </div>
    </div>
  );
}
