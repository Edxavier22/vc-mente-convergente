// Private academic API. Versioned lesson content is read server-side from a restricted table.
// The static site must not contain answer keys or service credentials.
const ROOT = Deno.env.get("SUPABASE_URL") ?? "https://ctzgsxxbyvruzmfqibnl.supabase.co";
const KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_rF60SyuGpNstim9MqFvqmQ_sSm78z1b";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const DEFAULT_COURSE_ID = "lideranca-estrategica-aplicada";
const OWNER_PRODUCT_ID = "P-021";
const OWNER_ID = "70aa4d75-bbb9-4839-aad8-670b7654664d";
const OWNER_EMAIL = "vcmenteconvergente@gmail.com";
const ORIGINS = new Set([
 "https://vc-mente-convergente.vercel.app",
 "https://vc-mente-convergente-git-feature-universidade-4ebcec-life-os22.vercel.app",
 "http://localhost:4173", "http://127.0.0.1:4173"
]);
const FIELDS = "enrollment_id,course_id,status,cohort_id";

function reply(status, body, origin) {
 return new Response(status === 204 ? null : JSON.stringify(body), {
  status, headers: {
   "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store",
   "x-content-type-options": "nosniff", "vary": "Origin, Authorization",
   "access-control-allow-origin": ORIGINS.has(origin) ? origin : "https://vc-mente-convergente.vercel.app",
   "access-control-allow-headers": "authorization, apikey, content-type",
   "access-control-allow-methods": "GET, POST, OPTIONS"
  }
 });
}
async function core(path, bearer, options = {}) {
 const response = await fetch(ROOT + path, {
  ...options, headers: {apikey: KEY, authorization: bearer, accept: "application/json", ...(options.headers ?? {})},
  signal: AbortSignal.timeout(10000), cache: "no-store"
 });
 return response;
}
async function database(table, query = "", options = {}) {
 if (!SERVICE) throw new Error("server_configuration_missing");
 const response = await fetch(ROOT + "/rest/v1/" + table + query, {
  ...options,
  headers: {apikey: SERVICE, authorization: "Bearer " + SERVICE, accept: "application/json",
   ...(options.body ? {"content-type": "application/json"} : {}), ...(options.headers ?? {})},
  signal: AbortSignal.timeout(10000), cache: "no-store"
 });
 if (!response.ok) throw new Error("database_error:" + response.status);
 const body = await response.text();
 return body ? JSON.parse(body) : null;
}
function scoped(enrollmentId) { return "enrollment_id=eq." + encodeURIComponent(enrollmentId); }
function moduleState(modules, rows) {
 const completed = new Set(rows.filter(r => r.completed_at).map(r => r.module_no));
 return modules.map((m, index) => ({
  number: m.number, title: m.title, unlocked: index === 0 || completed.has(modules[index - 1].number),
  completed: completed.has(m.number), submitted: !!rows.find(r => r.module_no === m.number)?.submitted_at
 }));
}
async function context(bearer, courseId) {
 const identity = await core("/auth/v1/user", bearer);
 if (!identity.ok) return {error: 401};
 const user = await identity.json();
 if (!user?.id) return {error: 401};
 const metadata = await database("vc_university_courses",
  "?select=course_id,product_id,version&course_id=eq." + encodeURIComponent(courseId) + "&limit=1");
 const courseRecord = metadata[0];
 if (!courseRecord?.product_id || !courseRecord.version) return {error: 404};
 const rights = await core("/functions/v1/vc-core-private-api/v1/me/access?market=BR&locale=pt-BR", bearer);
 if (!rights.ok) return {error: rights.status === 401 ? 401 : 503};
 const accesses = (await rights.json())?.data?.accesses;
 if (!Array.isArray(accesses)) return {error: 503};
 if (!accesses.some(a => a.product_id === courseRecord.product_id)) {
  if (courseId !== DEFAULT_COURSE_ID || courseRecord.product_id !== OWNER_PRODUCT_ID ||
      user.id !== OWNER_ID || user.email?.toLowerCase() !== OWNER_EMAIL || !user.email_confirmed_at)
   return {error: 403};
  const scope = await core("/functions/v1/vc-core-private-api/v1/admin/scope", bearer);
  if (!scope.ok || (await scope.json())?.data?.platform_admin !== true) return {error: 403};
 }
 const enrollments = await database("vc_university_enrollments",
  "?select=" + FIELDS + "&course_id=eq." + encodeURIComponent(courseId) + "&user_id=eq." + user.id + "&status=eq.active&limit=1");
 if (!enrollments.length) return {error: 409, code: "enrollment_sync_required"};
 return {user, enrollment: enrollments[0], courseRecord};
}
async function courseAndProgress(courseId, version, enrollmentId) {
 const source = await database("vc_university_course_content",
  "?select=content&course_id=eq." + encodeURIComponent(courseId) + "&course_version=eq." + encodeURIComponent(version) + "&limit=1");
 const course = source[0]?.content;
 if (course?.id !== courseId || course.version !== version || !Array.isArray(course.modules))
  throw new Error("course_content_unavailable");
 const progress = await database("vc_university_module_progress",
  "?select=module_no,evidence,submitted_at,checkpoint_passed_at,completed_at,review_status,review_feedback&"
   + scoped(enrollmentId) + "&order=module_no.asc");
 return {course, progress, states: moduleState(course.modules, progress)};
}
async function checkpointQuestions(courseId, course, moduleNo) {
 return database("vc_university_questions",
  "?select=question_id,prompt,choices,correct_index,review_concept,kind"
   + "&course_id=eq." + encodeURIComponent(courseId) + "&course_version=eq." + encodeURIComponent(course.version)
   + "&purpose=eq.checkpoint&module_no=eq." + moduleNo + "&active=eq.true"
   + "&order=kind.asc,question_id.asc&limit=5");
}
async function checkpointMinimum(courseId, moduleNo) {
 const modules = await database("vc_university_modules",
  "?select=checkpoint_pass_count&course_id=eq." + encodeURIComponent(courseId) + "&module_no=eq." + moduleNo + "&limit=1");
 const minimum = modules[0]?.checkpoint_pass_count;
 if (!Number.isInteger(minimum) || minimum < 1 || minimum > 5) throw new Error("checkpoint_config_unavailable");
 return minimum;
}
Deno.serve(async request => {
 const origin = request.headers.get("origin") ?? "";
 if (request.method === "OPTIONS") return reply(204, null, origin);
 if (!["GET", "POST"].includes(request.method)) return reply(405, {error: "method_not_allowed"}, origin);
 const bearer = request.headers.get("authorization") ?? "";
 if (!/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(bearer)) return reply(401, {error: "sign_in_required"}, origin);
 try {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("course") ?? DEFAULT_COURSE_ID;
  if (courseId.length > 96 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseId))
   return reply(400, {error: "invalid_course"}, origin);
  const access = await context(bearer, courseId);
  if (access.error) return reply(access.error, {error: access.code ?? "access_denied"}, origin);
  const {course, progress, states} = await courseAndProgress(courseId, access.courseRecord.version, access.enrollment.enrollment_id);
  const moduleNo = Number(url.searchParams.get("module"));
  if (request.method === "GET" && !url.searchParams.has("module")) {
   return reply(200, {id: course.id, productId: access.courseRecord.product_id, title: course.title,
    version: course.version, hours: course.hours, modules: states}, origin);
  }
  if (!Number.isSafeInteger(moduleNo) || moduleNo < 1 || moduleNo > course.modules.length)
   return reply(400, {error: "invalid_module"}, origin);
  const state = states.find(s => s.number === moduleNo);
  if (!state?.unlocked) return reply(423, {error: "previous_module_required"}, origin);
  const lesson = course.modules.find(m => m.number === moduleNo);
  if (request.method === "GET") {
   if (url.searchParams.get("view") === "checkpoint") {
    const questions = await checkpointQuestions(courseId, course, moduleNo);
    if (questions.length !== 5) return reply(503, {error: "checkpoint_unavailable"}, origin);
    const minimum = await checkpointMinimum(courseId, moduleNo);
    return reply(200, {minimum, questions: questions.map(({correct_index: _answer, review_concept: _concept, ...q}) => q)}, origin);
   }
   return reply(200, {lesson, progress: progress.find(p => p.module_no === moduleNo) ?? null}, origin);
  }
  const input = await request.json().catch(() => null);
  if (input?.action === "evidence") {
   const evidence = input.evidence;
   if (typeof evidence !== "string" || evidence.trim().length < 20 || evidence.length > 12000)
    return reply(400, {error: "evidence_invalid"}, origin);
   if (state.completed) return reply(409, {error: "module_already_completed"}, origin);
   const result = await database("vc_university_module_progress?on_conflict=enrollment_id,module_no", "", {
    method: "POST", headers: {Prefer: "resolution=merge-duplicates,return=representation"},
    body: JSON.stringify({enrollment_id: access.enrollment.enrollment_id, course_id: courseId,
     module_no: moduleNo, evidence: evidence.trim(), submitted_at: new Date().toISOString()})
   });
   return reply(200, {submitted: !!result?.length}, origin);
  }
  if (input?.action === "checkpoint") {
   const submitted = progress.find(p => p.module_no === moduleNo);
   if (!submitted?.evidence?.trim() || !submitted.submitted_at)
    return reply(409, {error: "evidence_required"}, origin);
   const questions = await checkpointQuestions(courseId, course, moduleNo);
   if (questions.length !== 5) return reply(503, {error: "checkpoint_unavailable"}, origin);
   const minimum = await checkpointMinimum(courseId, moduleNo);
   if (!Array.isArray(input.answers) || input.answers.length !== 5 ||
     !input.answers.every(a => Number.isInteger(a) && a >= 0 && a <= 3))
    return reply(400, {error: "answers_invalid"}, origin);
   const attempts = await database("vc_university_checkpoint_attempts",
    "?select=attempt_id&" + scoped(access.enrollment.enrollment_id)
     + "&module_no=eq." + moduleNo + "&submitted_at=gte." + new Date(Date.now()-86400000).toISOString());
   if (attempts.length >= 3) return reply(429, {error: "attempt_limit", review: "Revise o módulo e tente amanhã."}, origin);
   const score = questions.reduce((n, q, i) => n + (input.answers[i] === q.correct_index ? 1 : 0), 0);
   const review = [...new Set(questions.filter((q, i) => input.answers[i] !== q.correct_index).map(q => q.review_concept))];
   await database("vc_university_checkpoint_attempts", "", {
    method: "POST", headers: {Prefer: "return=minimal"},
    body: JSON.stringify({enrollment_id: access.enrollment.enrollment_id, course_id: courseId,
     module_no: moduleNo, score, review_concepts: review})
   });
   if (score >= minimum) {
    // The trigger additionally verifies prior modules, a stored passing attempt and evidence.
    await database("vc_university_module_progress?on_conflict=enrollment_id,module_no", "", {
     method: "POST", headers: {Prefer: "resolution=merge-duplicates,return=minimal"},
     body: JSON.stringify({enrollment_id: access.enrollment.enrollment_id, course_id: courseId,
      module_no: moduleNo, evidence: submitted.evidence, submitted_at: submitted.submitted_at,
      checkpoint_passed_at: new Date().toISOString(), completed_at: new Date().toISOString()})
    });
   }
   return reply(200, {score, total: 5, passed: score >= minimum, review}, origin);
  }
  return reply(400, {error: "unknown_action"}, origin);
 } catch (error) {
  console.error("University learner API failed", error instanceof Error ? error.message : "unknown");
  return reply(503, {error: "service_unavailable"}, origin);
 }
});
