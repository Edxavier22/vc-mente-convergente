const ROOT = Deno.env.get("SUPABASE_URL") ?? "https://ctzgsxxbyvruzmfqibnl.supabase.co";
const KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_rF60SyuGpNstim9MqFvqmQ_sSm78z1b";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OWNER_ID = "70aa4d75-bbb9-4839-aad8-670b7654664d";
const OWNER_EMAIL = "vcmenteconvergente@gmail.com";
const COURSE_ID = "lideranca-estrategica-aplicada";
const PROD = "https://vc-mente-convergente.vercel.app";

function trustedOrigin(origin) {
 return origin === PROD ||
  /^https:\/\/vc-mente-convergente-git-feature-universidade-[a-z0-9-]+-life-os22\.vercel\.app$/.test(origin) ||
  ["http://localhost:4173", "http://127.0.0.1:4173"].includes(origin);
}

function reply(status, body, origin) {
 return new Response(status === 204 ? null : JSON.stringify(body), {status, headers: {
  "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store",
  "x-content-type-options": "nosniff", "vary": "Origin, Authorization",
  "access-control-allow-origin": trustedOrigin(origin) ? origin : PROD,
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS"
 }});
}
async function db(table, query = "", options = {}) {
 if (!SERVICE) throw new Error("server_configuration_missing");
 const response = await fetch(ROOT + "/rest/v1/" + table + query, {
  ...options, headers: {apikey: SERVICE, authorization: "Bearer " + SERVICE, accept: "application/json",
   ...(options.body ? {"content-type": "application/json"} : {}), ...(options.headers ?? {})},
  signal: AbortSignal.timeout(10000), cache: "no-store"
 });
 if (!response.ok) throw new Error("database_error:" + response.status);
 const text = await response.text();
 return text ? JSON.parse(text) : null;
}
async function assertReviewer(bearer) {
 const headers = {apikey: KEY, authorization: bearer};
 const [identity, scope] = await Promise.all([
  fetch(ROOT + "/auth/v1/user", {headers, signal: AbortSignal.timeout(8000)}),
  fetch(ROOT + "/functions/v1/vc-core-private-api/v1/admin/scope", {headers, signal: AbortSignal.timeout(8000)})
 ]);
 if (identity.status === 401 || scope.status === 401) return {error: 401};
 if (!identity.ok || !scope.ok) return {error: 503};
 const user = await identity.json();
 const access = (await scope.json())?.data;
 if (!user.email_confirmed_at) return {error: 403};
 const platformAdmin = user.id === OWNER_ID && user.email?.toLowerCase() === OWNER_EMAIL &&
  access?.platform_admin === true;
 if (platformAdmin) return {user, platformAdmin, cohortIds: [] as string[]};
 const assignments = await db("vc_university_teachers",
  "?select=cohort_id&user_id=eq." + user.id + "&limit=1000");
 const cohortIds = assignments.map((row: {cohort_id: string}) => row.cohort_id);
 if (!cohortIds.length) return {error: 403};
 return {user, platformAdmin: false, cohortIds};
}

Deno.serve(async request => {
 const origin = request.headers.get("origin") ?? "";
 if (request.method === "OPTIONS") return reply(204, null, origin);
 if (!["GET", "POST"].includes(request.method)) return reply(405, {error: "method_not_allowed"}, origin);
 const bearer = request.headers.get("authorization") ?? "";
 if (!/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(bearer)) return reply(401, {error: "sign_in_required"}, origin);
 try {
  const reviewer = await assertReviewer(bearer);
  if (reviewer.error) return reply(reviewer.error, {error: reviewer.error === 403 ? "teacher_scope_required" : "session_unavailable"}, origin);
  if (request.method === "POST") {
   const input = await request.json().catch(() => null);
   if (!input || typeof input.user_id !== "string" || !/^[-0-9a-f]{36}$/.test(input.user_id) ||
       !Number.isInteger(input.module_no) || input.module_no < 1 || input.module_no > 100 ||
       !["approved", "revise"].includes(input.status) || typeof input.feedback !== "string" ||
       input.feedback.trim().length < 3 || input.feedback.length > 2000)
    return reply(400, {error: "invalid_review"}, origin);
   const scopeFilter = reviewer.platformAdmin ? "" : "&cohort_id=in.(" + reviewer.cohortIds.join(",") + ")";
   const enrollments = await db("vc_university_enrollments",
    "?select=enrollment_id,cohort_id&course_id=eq." + COURSE_ID + "&user_id=eq." + input.user_id +
    "&status=eq.active" + scopeFilter + "&limit=1");
   if (enrollments.length !== 1) return reply(404, {error: "enrollment_not_found"}, origin);
   const enrollmentId = enrollments[0].enrollment_id;
   const records = await db("vc_university_module_progress",
    "?select=enrollment_id,module_no,evidence,submitted_at&enrollment_id=eq." + enrollmentId +
    "&module_no=eq." + input.module_no + "&limit=1");
   if (records.length !== 1 || !records[0].evidence?.trim() || !records[0].submitted_at)
    return reply(404, {error: "evidence_not_found"}, origin);
   const now = new Date().toISOString();
   const saved = await db("vc_university_module_progress?enrollment_id=eq." + enrollmentId +
    "&module_no=eq." + input.module_no, "", {method: "PATCH", headers: {Prefer: "return=representation"},
    body: JSON.stringify({review_status: input.status, review_feedback: input.feedback.trim(),
     reviewer_id: reviewer.user.id, reviewed_at: now})});
   await db("vc_university_events", "", {method: "POST", headers: {Prefer: "return=minimal"},
    body: JSON.stringify({enrollment_id: enrollmentId, actor_id: reviewer.user.id,
     event_type: "evidence_reviewed", module_no: input.module_no,
     details: {course_id: COURSE_ID, status: input.status}})});
   return reply(200, {review: saved[0]}, origin);
  }

  const scopeFilter = reviewer.platformAdmin ? "" : "&cohort_id=in.(" + reviewer.cohortIds.join(",") + ")";
  const enrollments = await db("vc_university_enrollments",
   "?select=enrollment_id,user_id,course_id,course_version,cohort_id,status,enrolled_at&course_id=eq." + COURSE_ID +
   scopeFilter + "&order=enrolled_at.desc&limit=1000");
  const modules = await db("vc_university_modules",
   "?select=module_no&course_id=eq." + COURSE_ID + "&order=module_no.asc&limit=1000");
  const course = {id: COURSE_ID, title: "Liderança Estratégica Aplicada", module_count: modules.length};
  const enrollmentIds = enrollments.map(row => row.enrollment_id);
  if (!enrollmentIds.length) return reply(200, {enrollments: [], evidence: [], reviews: [], attempts: [],
   students: {}, course, scope: {platform_admin: reviewer.platformAdmin, cohort_count: 0}}, origin);
  const filter = "(" + enrollmentIds.join(",") + ")";
  const cohortIds = [...new Set(enrollments.map(row => row.cohort_id))];
  const [progress, attempts, cohorts] = await Promise.all([
   db("vc_university_module_progress", "?select=enrollment_id,module_no,evidence,submitted_at,completed_at,review_status,review_feedback,reviewer_id,reviewed_at" +
    "&enrollment_id=in." + filter + "&submitted_at=not.is.null&order=submitted_at.desc&limit=1000"),
   db("vc_university_final_attempts", "?select=enrollment_id,score,question_count,submitted_at" +
    "&enrollment_id=in." + filter + "&order=submitted_at.desc&limit=1000"),
   db("vc_university_cohorts", "?select=cohort_id,label&cohort_id=in.(" + cohortIds.join(",") + ")")
  ]);
  const byEnrollment = Object.fromEntries(enrollments.map(row => [row.enrollment_id, row.user_id]));
  const evidence = progress.map(row => ({...row, user_id: byEnrollment[row.enrollment_id]}));
  const reviews = evidence.filter(row => row.review_status).map(row => ({user_id: row.user_id,
   module_no: row.module_no, status: row.review_status, feedback: row.review_feedback,
   reviewer_id: row.reviewer_id, reviewed_at: row.reviewed_at}));
  const normalizedAttempts = attempts.map(row => ({...row, user_id: byEnrollment[row.enrollment_id]}));
  const students = {};
  await Promise.all([...new Set(enrollments.map(row => row.user_id))].slice(0, 100).map(async id => {
   try {
    const response = await fetch(ROOT + "/auth/v1/admin/users/" + id, {
     headers: {apikey: SERVICE, authorization: "Bearer " + SERVICE}, signal: AbortSignal.timeout(5000)
    });
    if (response.ok) students[id] = (await response.json()).email ?? id;
   } catch { /* UUID remains as a safe fallback. */ }
  }));
  const cohortLabels = Object.fromEntries(cohorts.map((row: {cohort_id: string, label: string}) => [row.cohort_id, row.label]));
  return reply(200, {enrollments: enrollments.map(row => ({...row, subject_id: row.user_id,
    cohort_label: cohortLabels[row.cohort_id] ?? "Turma V&C"})),
   evidence, reviews, attempts: normalizedAttempts, students,
   course, scope: {platform_admin: reviewer.platformAdmin, cohort_count: cohortIds.length}}, origin);
 } catch (error) {
  console.error("University professor API failed", error instanceof Error ? error.message : "unknown");
  return reply(503, {error: "service_unavailable"}, origin);
 }
});
