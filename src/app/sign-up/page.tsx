import Link from "next/link";
import { findValidInvite } from "@/lib/v2/invites";
import { AuthShell } from "../_components/AuthShell";
import { SignUpForm } from "./_form";

export const metadata = { title: "Sign up — Pointy Points" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const params = await searchParams;
  const inviteCode = params.invite ?? "";
  const invite = inviteCode ? await findValidInvite(inviteCode) : null;
  const inviteValid = Boolean(invite);
  const inviteExpired = inviteCode && !invite;

  return (
    <AuthShell showSignUpLink={false}>
      <div className="w-full max-w-md rounded-3xl bg-white/70 backdrop-blur-md p-7">
        {inviteValid && invite ? (
          <>
            <h1 className="text-2xl font-extrabold text-orange-700">
              Join the {invite.household_name} family
            </h1>
            <p className="text-sm text-slate-700 mt-1">
              You&apos;ve been invited as a co-parent. Set up a password to
              get started.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-orange-700">
              Create your family
            </h1>
            <p className="text-sm text-slate-700 mt-1">
              You&apos;ll be the parent admin. You can add kids and set up
              tasks on the next screen.
            </p>
          </>
        )}

        {inviteExpired && (
          <p className="mt-3 rounded-xl bg-rose-50 ring-1 ring-rose-200 px-3 py-2 text-sm text-rose-800">
            This invite link is invalid or has expired. Ask the parent who
            sent it to generate a new one.
          </p>
        )}

        <SignUpForm
          inviteCode={inviteValid ? inviteCode : ""}
          showHouseholdName={!inviteValid}
        />

        <p className="text-sm text-slate-600 mt-4 text-center">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-orange-700 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
