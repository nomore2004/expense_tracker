import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import { logoutAction } from "@/lib/actions/auth";

export default async function Navbar() {
  const user = await getCurrentUser();

  const handleLogout = async () => {
    "use server";
    await logoutAction();
  };

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-blue-600 flex items-center gap-2">
            <span>🏠</span>
            <span>Roommate Tracker</span>
          </Link>
          {user && (
            <nav className="flex space-x-4 text-sm font-semibold text-gray-600">
              <Link href="/" className="text-gray-900 hover:text-blue-600 transition-colors">
                Dashboard
              </Link>
              <Link href="/expenses" className="hover:text-blue-600 transition-colors">
                Expenses
              </Link>
              <Link href="/settlements" className="hover:text-emerald-600 transition-colors">
                Settlements
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-3 text-sm">
              <span className="text-gray-800 font-semibold bg-gray-100 px-2.5 py-1 rounded-full text-xs">
                👤 {user.name}
              </span>
              <form action={handleLogout}>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Log out
                </button>
              </form>
            </div>
          ) : (
            <div className="space-x-3 text-sm font-medium">
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
