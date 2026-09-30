import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Bearer tokens for native (iOS) kid sessions. The web kid view uses an
// httpOnly cookie instead; native clients can't share that, so after a PIN
// check they get an HMAC-signed token pinning { household_id, kid_profile_id }.
//
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
// Signed with KID_TOKEN_SECRET, so unlike the cookie it can't be forged by
// editing it on the device.

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days — a kid's own phone

type TokenPayload = {
  h: string; // household_id
  k: string; // kid_profile_id
  exp: number; // unix seconds
};

export type KidTokenSession = {
  householdId: string;
  kidProfileId: string;
};

function secret(): Buffer {
  const s = process.env.KID_TOKEN_SECRET;
  if (!s || s.length < 32) {
    throw new Error("KID_TOKEN_SECRET must be set (32+ characters).");
  }
  return Buffer.from(s, "utf-8");
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function issueKidToken(session: KidTokenSession): {
  token: string;
  expiresAt: string;
} {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload: TokenPayload = {
    h: session.householdId,
    k: session.kidProfileId,
    exp,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    token: `${body}.${sign(body)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyKidToken(token: string): KidTokenSession | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const p = JSON.parse(
      Buffer.from(body, "base64url").toString("utf-8"),
    ) as Partial<TokenPayload>;
    if (
      typeof p.h !== "string" ||
      typeof p.k !== "string" ||
      typeof p.exp !== "number"
    ) {
      return null;
    }
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return { householdId: p.h, kidProfileId: p.k };
  } catch {
    return null;
  }
}
