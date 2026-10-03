const ROOT = Deno.env.get("SUPABASE_URL") ?? "https://ctzgsxxbyvruzmfqibnl.supabase.co";
const SERVICE = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PROD = "https://vc-mente-convergente.vercel.app";
const allowedTeamSizes = new Set(["up_to_10", "11_to_30", "31_to_100", "101_to_300", "over_300", "not_defined"]);
const allowedDeliveryModes = new Set(["online", "in_person", "hybrid", "to_define"]);

function trustedOrigin(origin: string) {
  return origin === PROD ||
    /^https:\/\/vc-mente-convergente-[a-z0-9-]+-life-os22\.vercel\.app$/.test(origin) ||
    ["http://localhost:4173", "http://127.0.0.1:4173"].includes(origin);
}
function reply(status: number, body: unknown, origin: string) {
  return new Response(status === 204 ? null : JSON.stringify(body), {status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "x-content-type-options": "nosniff", "vary": "Origin",
    "access-control-allow-origin": trustedOrigin(origin) ? origin : PROD,
    "access-control-allow-headers": "apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS"
  }});
}
const clean = (value: unknown, maximum: number) => String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, maximum);
const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
async function fingerprint(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const agent = request.headers.get("user-agent") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const source = `${address}|${agent}|${day}|${SERVICE ?? "missing"}`;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async request => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return reply(204, null, origin);
  if (request.method !== "POST") return reply(405, {error: "method_not_allowed"}, origin);
  if (!trustedOrigin(origin)) return reply(403, {error: "origin_not_allowed"}, origin);
  if (!SERVICE) return reply(503, {error: "service_unavailable"}, origin);
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 12000) return reply(413, {error: "payload_too_large"}, origin);

  try {
    const raw = await request.text();
    if (raw.length > 12000) return reply(413, {error: "payload_too_large"}, origin);
    const input = JSON.parse(raw || "{}");
    if (clean(input.website, 200)) return reply(202, {received: true}, origin);

    const requestId = clean(input.request_id, 36);
    const contactName = clean(input.contact_name, 100);
    const organizationName = clean(input.organization_name, 160);
    const contactRole = clean(input.contact_role, 120);
    const email = clean(input.email, 254).toLowerCase();
    const phone = clean(input.phone, 24);
    const teamSize = clean(input.team_size, 30);
    const deliveryMode = clean(input.delivery_mode, 30);
    const courseInterest = clean(input.course_interest, 120) || "lideranca-estrategica-aplicada";
    const goals = clean(input.goals, 2000);
    const sourcePath = clean(input.source_path, 240) || "/universidade/empresas";
    const valid = /^[0-9a-f-]{36}$/i.test(requestId) && contactName.length >= 2 && organizationName.length >= 2 &&
      emailValid(email) && phone.length >= 8 && allowedTeamSizes.has(teamSize) &&
      allowedDeliveryModes.has(deliveryMode) && goals.length >= 20 && input.consent === true;
    if (!valid) return reply(422, {error: "invalid_request"}, origin);

    const response = await fetch(`${ROOT}/rest/v1/rpc/vc_university_submit_proposal_request`, {
      method: "POST", headers: {apikey: SERVICE, authorization: `Bearer ${SERVICE}`,
        "content-type": "application/json", accept: "application/json"},
      body: JSON.stringify({p_idempotency_key: requestId, p_contact_name: contactName,
        p_organization_name: organizationName, p_contact_role: contactRole || null,
        p_email: email, p_phone: phone, p_team_size: teamSize, p_delivery_mode: deliveryMode,
        p_course_interest: courseInterest, p_goals: goals, p_consent_at: new Date().toISOString(),
        p_source_path: sourcePath, p_submission_fingerprint: await fingerprint(request)}),
      signal: AbortSignal.timeout(10000)
    });
    const payload = await response.text();
    if (!response.ok) {
      if (payload.includes("proposal_rate_limited")) return reply(429, {error: "rate_limited"}, origin);
      console.error("Proposal RPC failed", response.status);
      return reply(503, {error: "service_unavailable"}, origin);
    }
    const reference = JSON.parse(payload);
    return reply(201, {received: true, reference,
      message: "Solicitação recebida. A equipe V&C analisará o contexto informado."}, origin);
  } catch (error) {
    console.error("University proposal API failed", error instanceof Error ? error.message : "unknown");
    return reply(400, {error: "invalid_request"}, origin);
  }
});
