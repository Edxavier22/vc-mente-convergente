import QRCode from "qrcode";

const ROOT = Deno.env.get("SUPABASE_URL") ?? "https://ctzgsxxbyvruzmfqibnl.supabase.co";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PROD = "https://vc-mente-convergente.vercel.app";

function trustedOrigin(origin: string) {
  return origin === PROD ||
    /^https:\/\/vc-mente-convergente-[a-z0-9-]+-life-os22\.vercel\.app$/.test(origin) ||
    ["http://localhost:4173", "http://127.0.0.1:4173"].includes(origin);
}
function headers(origin: string, contentType = "application/json; charset=utf-8") {
  return {
    "content-type": contentType,
    "cache-control": "public, max-age=60, s-maxage=300",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "vary": "Origin",
    "access-control-allow-origin": trustedOrigin(origin) ? origin : PROD,
    "access-control-allow-headers": "apikey, content-type",
    "access-control-allow-methods": "GET, OPTIONS"
  };
}
function json(status: number, body: unknown, origin: string) {
  return new Response(status === 204 ? null : JSON.stringify(body), {status, headers: headers(origin)});
}
async function db(code: string) {
  if (!SERVICE) throw new Error("server_configuration_missing");
  const fields = [
    "public_code", "learner_name_snapshot", "course_title_snapshot", "hours_minutes_snapshot",
    "completion_date_snapshot", "issuer_snapshot", "validation_url_snapshot", "revoked_at"
  ].join(",");
  const response = await fetch(`${ROOT}/rest/v1/vc_university_certificates?select=${fields}&public_code=eq.${encodeURIComponent(code)}&limit=1`, {
    headers: {apikey: SERVICE, authorization: `Bearer ${SERVICE}`, accept: "application/json"},
    signal: AbortSignal.timeout(8000), cache: "no-store"
  });
  if (!response.ok) throw new Error(`database_error:${response.status}`);
  return response.json();
}

Deno.serve(async request => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return json(204, null, origin);
  if (request.method !== "GET") return json(405, {error: "method_not_allowed"}, origin);
  const url = new URL(request.url);
  const code = (url.searchParams.get("codigo") ?? "").trim().toUpperCase();
  if (!/^VC-[A-Z0-9]{2,8}-\d{4}-\d{6}$/.test(code))
    return json(404, {valid: false, error: "certificate_not_found"}, origin);
  try {
    const certificate = (await db(code))[0];
    if (!certificate) return json(404, {valid: false, error: "certificate_not_found"}, origin);
    const payload = {
      valid: certificate.revoked_at === null,
      status: certificate.revoked_at === null ? "authentic" : "revoked",
      code: certificate.public_code,
      learnerName: certificate.learner_name_snapshot,
      course: certificate.course_title_snapshot,
      hours: Math.round(certificate.hours_minutes_snapshot / 60),
      completionDate: certificate.completion_date_snapshot,
      issuer: certificate.issuer_snapshot
    };
    if (url.searchParams.get("formato") === "qr") {
      const target = certificate.validation_url_snapshot;
      const svg = await QRCode.toString(target, {type: "svg", errorCorrectionLevel: "M", margin: 1,
        color: {dark: "#071827", light: "#ffffff"}, width: 320});
      return new Response(svg, {status: 200, headers: headers(origin, "image/svg+xml; charset=utf-8")});
    }
    return json(200, payload, origin);
  } catch (error) {
    console.error("Public certificate validation failed", error instanceof Error ? error.message : "unknown");
    return json(503, {valid: false, error: "service_unavailable"}, origin);
  }
});
