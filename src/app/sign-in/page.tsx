import Link from "next/link";
import { AuthShell } from "../_components/AuthShell";
import { SignInForm } from "./_form";

export const metadata = { title: "Sign in — Pointy Points" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; confirm?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell showSignInLink={false}>
      <div className="w-full max-w-md rounded-3xl bg-white/70 backdrop-blur-md p-7">
        <h1 className="text-2xl font-extrabold text-orange-700">
          Welcome back
        </h1>
        <p className="text-sm text-slate-700 mt-1">
          Sign in to manage your family&apos;s tasks and points.
        </p>
        {params.confirm && (
          <p className="mt-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-sm text-amber-900">
            Family created! Check your inbox to confirm your email, then sign
            in here.
          </p>
        )}
        <SignInForm next={params.next ?? ""} />
        <p className="text-sm text-slate-600 mt-4 text-center">
          New here?{" "}
          <Link
            href="/sign-up"
            className="font-semibold text-orange-700 hover:underline"
          >
            Create a family
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
