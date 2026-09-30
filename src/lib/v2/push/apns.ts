import "server-only";
import http2 from "node:http2";
import { createPrivateKey, sign, type KeyObject } from "node:crypto";

// Apple Push Notification service (native iOS app). Token-based auth: a
// short-lived ES256 JWT signed with the team's .p8 key.
//
// Env:
//   APNS_KEY_ID     — 10-char key id from developer.apple.com → Keys
//   APNS_TEAM_ID    — 10-char team id
//   APNS_KEY        — contents of the .p8 file (PEM; "\n"-escaped or base64 ok)
//   APNS_BUNDLE_ID  — defaults to app.pointypoints.ios

export type ApnsEnv = "sandbox" | "production";

export type ApnsResult =
  | { ok: true }
  | { ok: false; status: number; reason: string; gone: boolean };

const HOSTS: Record<ApnsEnv, string> = {
  sandbox: "https://api.sandbox.push.apple.com",
  production: "https://api.push.apple.com",
};

type Config = { keyId: string; teamId: string; key: KeyObject; topic: string };
let config: Config | null | undefined;

function loadConfig(): Config | null {
  if (config !== undefined) return config;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  let pem = process.env.APNS_KEY;
  if (!keyId || !teamId || !pem) {
    console.warn("[push/apns] APNS_KEY_ID/APNS_TEAM_ID/APNS_KEY not set — iOS push disabled");
    return (config = null);
  }
  pem = pem.includes("BEGIN PRIVATE KEY")
    ? pem.replace(/\\n/g, "\n")
    : Buffer.from(pem, "base64").toString("utf-8");
  return (config = {
    keyId,
    teamId,
    key: createPrivateKey(pem),
    topic: process.env.APNS_BUNDLE_ID ?? "app.pointypoints.ios",
  });
}

export function apnsConfigured(): boolean {
  return loadConfig() !== null;
}

// Apple rejects tokens older than an hour and throttles ones refreshed more
// often than every 20 minutes, so cache for 50.
let jwtCache: { token: string; issuedAt: number } | null = null;

function providerToken(cfg: Config): string {
  const now = Math.floor(Date.now() / 1000);
  if (jwtCache && now - jwtCache.issuedAt < 50 * 60) return jwtCache.token;

  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "ES256", kid: cfg.keyId })}.${b64({ iss: cfg.teamId, iat: now })}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: cfg.key,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  jwtCache = { token: `${unsigned}.${signature}`, issuedAt: now };
  return jwtCache.token;
}

export async function sendApns(
  deviceToken: string,
  env: ApnsEnv,
  payload: { title: string; body?: string; tag?: string; url?: string },
): Promise<ApnsResult> {
  const cfg = loadConfig();
  if (!cfg) return { ok: false, status: 0, reason: "NotConfigured", gone: false };

  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body ?? "" },
      sound: "default",
      ...(payload.tag ? { "thread-id": payload.tag } : {}),
    },
    url: payload.url,
  });

  return new Promise((resolve) => {
    const client = http2.connect(HOSTS[env]);
    client.on("error", (e) => {
      resolve({ ok: false, status: 0, reason: e.message, gone: false });
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken(cfg)}`,
      "apns-topic": cfg.topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let status = 0;
    let data = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"]);
    });
    req.setEncoding("utf8");
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      client.close();
      if (status === 200) return resolve({ ok: true });
      let reason = "Unknown";
      try {
        reason = (JSON.parse(data) as { reason?: string }).reason ?? reason;
      } catch {}
      // 410 = app uninstalled / token expired. BadDeviceToken usually means a
      // sandbox token sent to production (or vice versa) — also unusable.
      const gone =
        status === 410 ||
        reason === "BadDeviceToken" ||
        reason === "DeviceTokenNotForTopic" ||
        reason === "Unregistered";
      resolve({ ok: false, status, reason, gone });
    });
    req.on("error", (e) => {
      client.close();
      resolve({ ok: false, status: 0, reason: e.message, gone: false });
    });

    req.end(body);
  });
}
