import test from "node:test";
import assert from "node:assert/strict";

let handler;
globalThis.Deno = {
 env: {get: key => key === "SUPABASE_SERVICE_ROLE_KEY" ? "test-secret" : undefined},
 serve: callback => { handler = callback; }
};
await import("../supabase/functions/vc-universidade-learner-v2/index.ts");

const lesson = number => ({number, title: `Módulo ${number}`, study: [`Estudo ${number}`]});
let progress = [];
let databaseWrites = 0;
let attemptWrites = 0;
let finalWrites = 0;
let finalAttempts = [];
let allowed = true;
let rightsProducts = ["P-021"];
let enrolled = true;
let sourceAvailable = true;
let contentReads = 0;
let identity = {id: "u-1"};
let isAdmin = false;
globalThis.fetch = async (input, options = {}) => {
 const url = new URL(input);
 if (url.pathname === "/auth/v1/user") return Response.json(identity);
 if (url.pathname.endsWith("/v1/admin/scope")) return Response.json({data: {platform_admin: isAdmin}});
 if (url.pathname.includes("/vc-core-private-api/")) return Response.json({data: {accesses: allowed ? rightsProducts.map(product_id => ({product_id})) : []}});
 const secondCourse = url.searchParams.get("course_id") === "eq.inteligencia-emocional";
 if (url.pathname.endsWith("/vc_university_courses")) return Response.json(
  secondCourse ? [{course_id: "inteligencia-emocional", product_id: "P-022", version: "1.0", final_pass_percent: 70}]
   : url.searchParams.get("course_id") === "eq.lideranca-estrategica-aplicada"
    ? [{course_id: "lideranca-estrategica-aplicada", product_id: "P-021", version: "1.0", final_pass_percent: 70}] : []);
 if (url.pathname.endsWith("/vc_university_course_content")) {contentReads++; return Response.json(sourceAvailable ? [{content: {
  id: secondCourse ? "inteligencia-emocional" : "lideranca-estrategica-aplicada", version: "1.0", title: "Liderança",
  modules: [lesson(1), lesson(2)]
 }}] : []);}
 if (url.pathname.endsWith("/vc_university_enrollments"))
  return Response.json(enrolled ? [{enrollment_id: "e-1", course_id: secondCourse ? "inteligencia-emocional" : "lideranca-estrategica-aplicada", status: "active", cohort_id: "c-1"}] : []);
 if (url.pathname.endsWith("/vc_university_modules")) return Response.json([{checkpoint_pass_count: 4}]);
 if (url.pathname.endsWith("/vc_university_module_progress")) {
  if (options.method === "POST") {databaseWrites++; return Response.json([{enrollment_id: "e-1"}]);}
  return Response.json(progress);
 }
 if (url.pathname.endsWith("/vc_university_questions")) return Response.json(
  Array.from({length: url.searchParams.get("purpose") === "eq.final" ? 20 : 5}, (_, i) => ({question_id: `q-${i}`, prompt: "Qual decisão?", choices: ["A","B","C","D"],
   correct_index: 2, review_concept: "Revisar diagnóstico", kind: "concept"}))
 );
 if (url.pathname.endsWith("/vc_university_final_attempts")) {
  if (options.method === "POST") {finalWrites++; return new Response(null, {status: 201});}
  return Response.json(finalAttempts);
 }
 if (url.pathname.endsWith("/vc_university_checkpoint_attempts")) {
  if (options.method === "POST") {attemptWrites++; return new Response(null, {status: 201});}
  return Response.json([]);
 }
 throw new Error("unexpected request: " + url.pathname);
};
const request = (path, method = "GET", body, auth = true) => new Request("https://example.invalid/" + path, {
 method, headers: auth ? {authorization: "Bearer " + "x".repeat(50), "content-type": "application/json"} : {},
 body: body ? JSON.stringify(body) : undefined
});
test("sem credencial não consulta matrícula", async () => {
 const response = await handler(request("", "GET", null, false));
 assert.equal(response.status, 401);
});
test("prévia fixa recebe CORS e outra origem não recebe acesso", async () => {
 const preview = "https://vc-mente-convergente-git-feature-universidade-4ebcec-life-os22.vercel.app";
 const allowed = await handler(new Request("https://example.invalid/", {headers: {origin: preview}}));
 assert.equal(allowed.headers.get("access-control-allow-origin"), preview);
 const rejected = await handler(new Request("https://example.invalid/", {headers: {origin: "https://outra-origem.vercel.app"}}));
 assert.notEqual(rejected.headers.get("access-control-allow-origin"), "https://outra-origem.vercel.app");
});
test("fonte privada ausente não revela o conteúdo", async () => {
 sourceAvailable = false;
 assert.equal((await handler(request("?module=1"))).status, 503);
 sourceAvailable = true;
});
test("direito revogado e matrícula ausente não entregam conteúdo", async () => {
 allowed = false;
 assert.equal((await handler(request("?module=1"))).status, 403);
 allowed = true; enrolled = false;
 assert.equal((await handler(request("?module=1"))).status, 409);
 enrolled = true;
});
test("curso adicional exige produto e matrícula correspondentes", async () => {
 contentReads = 0;
 assert.equal((await handler(request("?course=inteligencia-emocional&module=1"))).status, 403);
 assert.equal(contentReads, 0);
 rightsProducts = ["P-022"];
 enrolled = false;
 assert.equal((await handler(request("?course=inteligencia-emocional&module=1"))).status, 409);
 assert.equal(contentReads, 0);
 enrolled = true;
 const response = await handler(request("?course=inteligencia-emocional&module=1"));
 assert.equal(response.status, 200);
 assert.equal((await response.json()).lesson.number, 1);
 rightsProducts = ["P-021"];
});
test("identificador inválido e curso desconhecido não consultam o conteúdo", async () => {
 contentReads = 0;
 assert.equal((await handler(request("?course=../lideranca"))).status, 400);
 assert.equal((await handler(request("?course=nao-existe"))).status, 404);
 assert.equal(contentReads, 0);
});
test("exceção proprietária exige ID, e-mail confirmado, administração e matrícula", async () => {
 allowed = false;
 isAdmin = true;
 identity = {id: "70aa4d75-bbb9-4839-aad8-670b7654664d", email: "vcmenteconvergente@gmail.com", email_confirmed_at: "2026-09-19T00:00:00Z"};
 assert.equal((await handler(request("?module=1"))).status, 200);
 enrolled = false;
 assert.equal((await handler(request("?module=1"))).status, 409);
 enrolled = true;
 isAdmin = false;
 assert.equal((await handler(request("?module=1"))).status, 403);
 isAdmin = true;
 identity = {...identity, email: "outro@example.com"};
 assert.equal((await handler(request("?module=1"))).status, 403);
 identity = {id: "u-1"};
 allowed = true;
 isAdmin = false;
});
test("M2 exige a conclusão persistida de M1 e não recebe conteúdo", async () => {
 progress = [];
 const response = await handler(request("?module=2"));
 assert.equal(response.status, 423);
 assert.deepEqual(await response.json(), {error: "previous_module_required"});
});
test("índice indica bloqueio e módulo liberado devolve somente sua aula", async () => {
 progress = [];
 const index = await (await handler(request(""))).json();
 assert.deepEqual(index.modules.map(m => m.unlocked), [true, false]);
 const first = await (await handler(request("?module=1"))).json();
 assert.equal(first.lesson.number, 1);
 assert.equal(first.lesson.study[0], "Estudo 1");
 assert.equal(JSON.stringify(first).includes("Estudo 2"), false);
});
test("checkpoint não expõe o gabarito e não aceita evidência vazia", async () => {
 progress = [];
 const response = await handler(request("?module=1&view=checkpoint"));
 const data = await response.json();
 assert.equal(data.questions.length, 5);
 assert.equal(data.minimum, 4);
 assert.equal(JSON.stringify(data).includes("correct_index"), false);
 assert.equal(JSON.stringify(data).includes("review_concept"), false);
 databaseWrites = 0;
 const invalid = await handler(request("?module=1", "POST", {action: "evidence", evidence: " "}));
 assert.equal(invalid.status, 400);
 assert.equal(databaseWrites, 0);
});
test("conclusão oficial de M1 libera M2", async () => {
 progress = [{module_no: 1, evidence: "Evidência de diagnóstico registrada", submitted_at: "2026-09-19T00:00:00Z",
  checkpoint_passed_at: "2026-09-19T00:01:00Z", completed_at: "2026-09-19T00:02:00Z"}];
 const response = await handler(request("?module=2"));
 assert.equal(response.status, 200);
 assert.equal((await response.json()).lesson.number, 2);
});
test("checkpoint exige evidência antes de consumir tentativa e concluir", async () => {
 progress = []; databaseWrites = 0; attemptWrites = 0;
 const payload = {action: "checkpoint", answers: [2,2,2,2,2]};
 const withoutEvidence = await handler(request("?module=1", "POST", payload));
 assert.equal(withoutEvidence.status, 409);
 assert.equal((await withoutEvidence.json()).error, "evidence_required");
 assert.equal(attemptWrites, 0);
 assert.equal(databaseWrites, 0);
 progress = [{module_no: 1, evidence: "Diagnóstico escrito com fonte e período", submitted_at: "2026-09-19T00:00:00Z"}];
 const withEvidence = await handler(request("?module=1", "POST", payload));
 assert.equal(withEvidence.status, 200);
 assert.equal((await withEvidence.json()).passed, true);
 assert.equal(attemptWrites, 1);
 assert.equal(databaseWrites, 1);
});
test("avaliação final permanece bloqueada até todos os módulos", async () => {
 progress = [{module_no: 1, completed_at: "2026-09-19T00:00:00Z"}]; finalWrites = 0;
 assert.equal((await handler(request("?view=final"))).status, 423);
 assert.equal((await handler(request("", "POST", {action: "final", answers: Array(20).fill(2)}))).status, 423);
 assert.equal(finalWrites, 0);
});
test("avaliação corrige no servidor, oculta gabarito e registra tentativas", async () => {
 progress = [1,2].map(module_no => ({module_no, completed_at: "2026-09-19T00:00:00Z"}));
 finalAttempts = []; finalWrites = 0;
 const view = await handler(request("?view=final"));
 assert.equal(view.status, 200);
 const data = await view.json();
 assert.equal(data.questions.length, 20);
 assert.equal(data.minimum, 70);
 assert.equal(JSON.stringify(data).includes("correct_index"), false);
 assert.equal(JSON.stringify(data).includes("review_concept"), false);
 assert.equal((await handler(request("", "POST", {action: "final", answers: Array(19).fill(2)}))).status, 400);
 assert.equal(finalWrites, 0);
 const low = await (await handler(request("", "POST", {action: "final", answers: Array(20).fill(1)}))).json();
 assert.equal(low.passed, false);
 assert.deepEqual(low.review, ["Revisar diagnóstico"]);
 const high = await (await handler(request("", "POST", {action: "final", answers: [...Array(14).fill(2),...Array(6).fill(1)]}))).json();
 assert.equal(high.score, 14);
 assert.equal(high.passed, true);
 assert.equal(finalWrites, 2);
 finalAttempts = [1,2,3].map(attempt_id => ({attempt_id}));
 assert.equal((await handler(request("", "POST", {action: "final", answers: Array(20).fill(2)}))).status, 429);
 assert.equal(finalWrites, 2);
 finalAttempts = [];
});
