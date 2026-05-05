import Link from "next/link";
import { AuthShell } from "../_components/AuthShell";
import { SignUpForm } from "./_form";

export const metadata = { title: "Sign up — Pointy Points" };

export default function SignUpPage() {
  return (
    <AuthShell showSignUpLink={false}>
      <div className="w-full max-w-md rounded-3xl bg-white/70 backdrop-blur-md p-7">
        <h1 className="text-2xl font-extrabold text-orange-700">
          Create your family
        </h1>
        <p className="text-sm text-slate-700 mt-1">
          You&apos;ll be the parent admin. You can add kids and set up tasks
          on the next screen.
        </p>
        <SignUpForm />
        <p className="text-sm text-slate-600 mt-4 text-center">
          Already have an account?{" "}
          <Link
            href="/v2/sign-in"
            className="font-semibold text-orange-700 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
