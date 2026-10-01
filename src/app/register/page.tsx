"use client";

import { useActionState, useState, startTransition } from "react";
import { registerAction } from "@/lib/actions/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "join">("new");

  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const name = formData.get("name") as string;
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const householdName = formData.get("householdName") as string;
      const joinHouseholdId = formData.get("joinHouseholdId") as string;

      const res = await registerAction({
        name,
        email,
        password,
        householdName: mode === "new" ? householdName : undefined,
        joinHouseholdId: mode === "join" ? joinHouseholdId : undefined,
      });

      if (res.success) {
        router.push("/");
        router.refresh();
        return { success: true };
      }
      return { success: false, error: res.error, fieldErrors: res.fieldErrors };
    },
    null
  );

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-8 border border-gray-200 rounded-xl shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 text-center">Create an Account</h2>
      <p className="text-sm text-gray-600 text-center mt-1">
        Start tracking roommate expenses
      </p>

      {state && !state.success && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {state.error}
        </div>
      )}

      <div className="mt-6 flex border-b border-gray-200 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`flex-1 pb-2 text-center border-b-2 cursor-pointer ${
            mode === "new"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Create Household
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 pb-2 text-center border-b-2 cursor-pointer ${
            mode === "join"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Join Household
        </button>
      </div>

      <form
        action={(formData) => {
          startTransition(() => {
            formAction(formData);
          });
        }}
        className="mt-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name</label>
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
            placeholder="Alex Johnson"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Email Address</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
            placeholder="alex@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Password (min 8 chars)</label>
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
          />
        </div>

        {mode === "new" ? (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Household / Apartment Name
            </label>
            <input
              name="householdName"
              type="text"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
              placeholder="Apartment 4B"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Existing Household ID to Join
            </label>
            <input
              name="joinHouseholdId"
              type="text"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
              placeholder="Paste Household ID"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {isPending ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Log in here
        </Link>
      </p>
    </div>
  );
}
