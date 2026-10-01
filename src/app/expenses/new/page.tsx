import { getCurrentUser } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { getHouseholdMembersAction } from "@/lib/actions/auth";
import ExpenseForm from "@/components/ExpenseForm";

export default async function NewExpensePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const membersRes = await getHouseholdMembersAction();
  const members = membersRes.success ? membersRes.data.members : [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Add an Expense
        </h1>
        <p className="text-sm text-gray-600">
          Record a shared, personal, or custom split expense
        </p>
      </div>

      <div className="bg-white p-6 sm:p-8 border border-gray-200 rounded-xl shadow-sm">
        <ExpenseForm members={members} currentUserId={user.userId} mode="create" />
      </div>
    </div>
  );
}
