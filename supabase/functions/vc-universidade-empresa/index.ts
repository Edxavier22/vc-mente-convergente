const ROOT = Deno.env.get("SUPABASE_URL") ?? "https://ctzgsxxbyvruzmfqibnl.supabase.co";
const KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_rF60SyuGpNstim9MqFvqmQ_sSm78z1b";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PROD = "https://vc-mente-convergente.vercel.app";

function trustedOrigin(origin: string) {
  return origin === PROD ||
    /^https:\/\/vc-mente-convergente-git-feature-universidade-[a-z0-9-]+-life-os22\.vercel\.app$/.test(origin) ||
    ["http://localhost:4173", "http://127.0.0.1:4173"].includes(origin);
}
function reply(status: number, body: unknown, origin: string) {
  return new Response(status === 204 ? null : JSON.stringify(body), {status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store",
    "x-content-type-options": "nosniff", "vary": "Origin, Authorization",
    "access-control-allow-origin": trustedOrigin(origin) ? origin : PROD,
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-allow-methods": "GET, OPTIONS"
  }});
}
async function db(table: string, query = "") {
  if (!SERVICE) throw new Error("server_configuration_missing");
  const response = await fetch(`${ROOT}/rest/v1/${table}${query}`, {headers: {
    apikey: SERVICE, authorization: `Bearer ${SERVICE}`, accept: "application/json"
  }, signal: AbortSignal.timeout(10000), cache: "no-store"});
  if (!response.ok) throw new Error(`database_error:${table}:${response.status}`);
  return response.json();
}
async function identity(bearer: string) {
  const response = await fetch(`${ROOT}/auth/v1/user`, {headers: {apikey: KEY, authorization: bearer},
    signal: AbortSignal.timeout(8000), cache: "no-store"});
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("identity_unavailable");
  return response.json();
}
const list = (values: string[]) => `(${values.join(",")})`;

Deno.serve(async request => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return reply(204, null, origin);
  if (request.method !== "GET") return reply(405, {error: "method_not_allowed"}, origin);
  const bearer = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(bearer)) return reply(401, {error: "sign_in_required"}, origin);
  try {
    const user = await identity(bearer);
    if (!user?.id || !user.email_confirmed_at) return reply(401, {error: "sign_in_required"}, origin);
    const memberships = await db("vc_memberships", `?select=organization_id,member_role,status&user_id=eq.${user.id}&status=eq.active&member_role=in.(owner,admin,manager)&limit=100`);
    const coreIds = memberships.map((row: any) => row.organization_id);
    if (!coreIds.length) return reply(403, {error: "corporate_manager_required"}, origin);
    const [coreOrganizations, universityOrganizations] = await Promise.all([
      db("vc_organizations", `?select=organization_id,name,status&organization_id=in.${list(coreIds)}&status=eq.active`),
      db("vc_university_organizations", `?select=organization_id,core_organization_id,legal_name,status,privacy_mode,minimum_report_group_size&core_organization_id=in.${list(coreIds)}&status=eq.active`)
    ]);
    const universityIds = universityOrganizations.map((row: any) => row.organization_id);
    if (!universityIds.length) return reply(200, {organizations: [], cohorts: [], privacy: {
      mode: "aggregated_only", message: "Nenhuma turma empresarial da Universidade está vinculada à sua organização."
    }}, origin);
    const cohorts = await db("vc_university_cohorts", `?select=cohort_id,course_id,organization_id,label,capacity,status,delivery_mode,starts_at,ends_at&organization_id=in.${list(universityIds)}&market_segment=eq.b2b&reporting_enabled=eq.true&limit=1000`);
    const cohortIds = cohorts.map((row: any) => row.cohort_id);
    const courseIds = [...new Set(cohorts.map((row: any) => row.course_id))];
    const empty = {organizations: universityOrganizations.map((row: any) => ({
      organization_id: row.organization_id, name: row.legal_name, privacy_mode: row.privacy_mode
    })), cohorts: [], privacy: {mode: "aggregated_only", message: "Somente indicadores consolidados são compartilhados. Evidências, respostas e reflexões permanecem privadas."}};
    if (!cohortIds.length) return reply(200, empty, origin);
    const [courses, modules, enrollments] = await Promise.all([
      db("vc_university_courses", `?select=course_id,title&course_id=in.${list(courseIds)}`),
      db("vc_university_modules", `?select=course_id,module_no&course_id=in.${list(courseIds)}&limit=2000`),
      db("vc_university_enrollments", `?select=enrollment_id,cohort_id,course_id,status,enrolled_at,completed_at&cohort_id=in.${list(cohortIds)}&status=neq.cancelled&limit=10000`)
    ]);
    const enrollmentIds = enrollments.map((row: any) => row.enrollment_id);
    const [progress, finals, certificates] = enrollmentIds.length ? await Promise.all([
      db("vc_university_module_progress", `?select=enrollment_id,module_no,opened_at,submitted_at,completed_at&enrollment_id=in.${list(enrollmentIds)}&limit=50000`),
      db("vc_university_final_attempts", `?select=enrollment_id,score,question_count,submitted_at&enrollment_id=in.${list(enrollmentIds)}&order=submitted_at.desc&limit=20000`),
      db("vc_university_certificates", `?select=enrollment_id,revoked_at&enrollment_id=in.${list(enrollmentIds)}&limit=10000`)
    ]) : [[], [], []];
    const courseMap = Object.fromEntries(courses.map((row: any) => [row.course_id, row]));
    const organizationMap = Object.fromEntries(universityOrganizations.map((row: any) => [row.organization_id, row]));
    const moduleTotals: Record<string, number> = {};
    modules.forEach((row: any) => moduleTotals[row.course_id] = (moduleTotals[row.course_id] ?? 0) + 1);
    const progressBy: Record<string, any[]> = {};
    progress.forEach((row: any) => (progressBy[row.enrollment_id] ??= []).push(row));
    const latestFinal: Record<string, any> = {};
    finals.forEach((row: any) => { if (!latestFinal[row.enrollment_id]) latestFinal[row.enrollment_id] = row; });
    const certified = new Set(certificates.filter((row: any) => !row.revoked_at).map((row: any) => row.enrollment_id));
    const reports = cohorts.map((cohort: any) => {
      const rows = enrollments.filter((row: any) => row.cohort_id === cohort.cohort_id);
      const minimum = organizationMap[cohort.organization_id]?.minimum_report_group_size ?? 5;
      const suppressed = rows.length < minimum;
      const details = rows.map((row: any) => {
        const items = progressBy[row.enrollment_id] ?? [];
        const total = moduleTotals[row.course_id] ?? 0;
        const complete = items.filter(item => item.completed_at).length;
        return {started: items.some(item => item.opened_at || item.submitted_at || item.completed_at),
          complete, progress: total ? complete / total * 100 : 0, final: latestFinal[row.enrollment_id]};
      });
      const evaluated = details.filter(item => item.final);
      const average = (values: number[]) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
      return {cohort_id: cohort.cohort_id, label: cohort.label, course: courseMap[cohort.course_id]?.title ?? cohort.course_id,
        status: cohort.status, delivery_mode: cohort.delivery_mode, capacity: cohort.capacity, participants: rows.length,
        starts_at: cohort.starts_at, ends_at: cohort.ends_at, privacy_suppressed: suppressed,
        minimum_group_size: minimum,
        started: suppressed ? null : details.filter(item => item.started).length,
        completed: suppressed ? null : rows.filter((row: any) => row.status === "completed").length,
        certified: suppressed ? null : rows.filter((row: any) => certified.has(row.enrollment_id)).length,
        average_progress: suppressed ? null : average(details.map(item => item.progress)),
        average_assessment: suppressed || evaluated.length < minimum ? null : average(evaluated.map(item => item.final.score / item.final.question_count * 100)),
        assessment_sample_size: suppressed ? null : evaluated.length};
    });
    const coreMap = Object.fromEntries(coreOrganizations.map((row: any) => [row.organization_id, row.name]));
    return reply(200, {organizations: universityOrganizations.map((row: any) => ({
      organization_id: row.organization_id, name: row.legal_name || coreMap[row.core_organization_id], privacy_mode: row.privacy_mode
    })), cohorts: reports, privacy: {mode: "aggregated_only",
      message: "A empresa recebe somente indicadores consolidados. Evidências, respostas, comentários, reflexões e histórico individual não são compartilhados."
    }}, origin);
  } catch (error) {
    console.error("University corporate API failed", error instanceof Error ? error.message : "unknown");
    return reply(503, {error: "service_unavailable"}, origin);
  }
});
