"use client";

import { useActionState, startTransition } from "react";
import { loginAction } from "@/lib/actions/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

      const res = await loginAction({ email, password });
      if (res.success) {
        router.push("/");
        router.refresh();
        return { success: true };
      }
      return { success: false, error: res.error };
    },
    null
  );

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-8 border border-gray-200 rounded-xl shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 text-center">Log In</h2>
      <p className="text-sm text-gray-600 text-center mt-1">
        Access your household expenses
      </p>

      {state && !state.success && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {state.error}
        </div>
      )}

      <form
        action={(formData) => {
          startTransition(() => {
            formAction(formData);
          });
        }}
        className="mt-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700">Email Address</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
            placeholder="roommate@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {isPending ? "Logging in..." : "Log In"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
          Register here
        </Link>
      </p>
    </div>
  );
}
