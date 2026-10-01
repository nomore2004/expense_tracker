import { getCurrentUser } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { getHouseholdMembersAction } from "@/lib/actions/auth";
import SettlementForm from "@/components/SettlementForm";

export default async function NewSettlementPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const membersRes = await getHouseholdMembersAction();
  const members = membersRes.success ? membersRes.data.members : [];

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Record a Settlement
        </h1>
        <p className="text-sm text-gray-600">
          Record an actual money payment transferred to a roommate
        </p>
      </div>

      <div className="bg-white p-6 sm:p-8 border border-gray-200 rounded-xl shadow-sm">
        <SettlementForm members={members} currentUserId={user.userId} />
      </div>
    </div>
  );
}
