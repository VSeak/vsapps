// message-push: sends the push notifications for one new message (Supabase Edge Function).
// The page calls it right after sending a message (js/messages.js), with the sender's sign-in:
//   supabase.functions.invoke('message-push', { body: { id: '<message id>' } })
// push_targets() (the messages migration) checks the caller sent that message, hands it out only once, and returns the
// other side's devices with what the notification says. Each one is encrypted and signed here (Web Push, RFC 8291 and
// RFC 8292) with the standard Web Crypto, so there is nothing to install.
//
// Secrets (Edge Functions → Secrets; SETUP.md step 9):
//   VAPID_PUBLIC_KEY   the same key as CONFIG.vapidKey in js/core.js
//   VAPID_PRIVATE_KEY  its private half. Never put this one in the site or the repo.
//   VAPID_SUBJECT      optional: a web address or mailto: the push services can contact (defaults to the site).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are there already.

import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "https://vseak.github.io/vsapps/sitstart/";
// Only real push services: a saved address is never somewhere else we would be made to call.
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.apple\.com|notify\.windows\.com|push\.services\.mozilla\.com)$/;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

// The message, encrypted so only that browser can read it (aes128gcm, one record).
async function encrypt(p256dh: string, authKey: string, text: string) {
  const theirs = unb64u(p256dh), secret = unb64u(authKey);
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const ours = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const theirKey = await crypto.subtle.importKey("raw", theirs, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: theirKey }, pair.privateKey, 256));
  const ikm = await hkdf(secret, shared, concat(enc.encode("WebPush: info\0"), theirs, ours), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(enc.encode(text), new Uint8Array([2])));
  // Header: salt, record size (4096), our public key's length, our public key. Then the sealed record.
  return concat(salt, new Uint8Array([0, 0, 16, 0, ours.length]), ours, new Uint8Array(sealed));
}

// Proof to the push service that this server holds the key the browser subscribed with (a signed token, good for 12 hours).
async function vapid(endpoint: string) {
  const pub = unb64u(VAPID_PUBLIC);
  const key = await crypto.subtle.importKey("jwk",
    { kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: VAPID_PRIVATE },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const token = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" }))) + "." + b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(token));
  return `vapid t=${token}.${b64u(sig)}, k=${VAPID_PUBLIC}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: "The VAPID keys aren't set." }, 500);
    const { id } = await req.json().catch(() => ({}));
    if (typeof id !== "string") return json({ error: "Which message?" }, 400);
    const url = Deno.env.get("SUPABASE_URL")!;
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
    const { data: { user } } = await createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (!user) return json({ error: "Sign in first." }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: targets, error } = await admin.rpc("push_targets", { p_message: id, p_caller: user.id });
    if (error) throw error;

    let sent = 0;
    for (const t of targets ?? []) {
      try {
        if (!PUSH_HOSTS.test(new URL(t.endpoint).hostname)) continue;
        const body = await encrypt(t.p256dh, t.auth_key, JSON.stringify({ title: t.title, body: t.body, url: t.path }));
        const res = await fetch(t.endpoint, { method: "POST", body, headers: {
          Authorization: await vapid(t.endpoint), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
          TTL: "86400", Urgency: "high" } });
        if (res.ok) sent++;
        // Gone for good (the app was removed, or notifications turned off): forget the device.
        else if (res.status === 404 || res.status === 410) await admin.from("push_subscriptions").delete().eq("endpoint", t.endpoint);
        else console.error("push failed", res.status, new URL(t.endpoint).hostname, await res.text());
      } catch (e) { console.error("push error", e); }
    }
    return json({ sent });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
