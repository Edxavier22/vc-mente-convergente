import test from "node:test";
import assert from "node:assert/strict";

let handler;
globalThis.Deno = {
  env: {get: key => key === "SUPABASE_SERVICE_ROLE_KEY" ? "test-secret" : undefined},
  serve: callback => { handler = callback; }
};
await import("../supabase/functions/vc-universidade-admin/index.ts");

const owner = {
  id: "70aa4d75-bbb9-4839-aad8-670b7654664d",
  email: "vcmenteconvergente@gmail.com",
  email_confirmed_at: "2026-09-19T00:00:00Z"
};
let identity = owner;
let platformAdmin = true;
let databaseReads = 0;

globalThis.fetch = async input => {
  const url = new URL(input);
  if (url.pathname === "/auth/v1/user") return Response.json(identity);
  if (url.pathname.endsWith("/v1/admin/scope")) return Response.json({data: {platform_admin: platformAdmin}});
  databaseReads++;
  if (url.pathname.endsWith("/vc_university_courses")) return Response.json([{
    course_id: "lideranca-estrategica-aplicada", title: "Liderança Estratégica Aplicada",
    version: "1.1", status: "published", hours_minutes: 2000
  }]);
  if (url.pathname.endsWith("/vc_university_course_content")) return Response.json([{
    course_id: "lideranca-estrategica-aplicada", course_version: "1.1", imported_at: "2026-09-28T00:00:00Z",
    content: {id: "lideranca-estrategica-aplicada", version: "1.1", modules: [{number: 1, title: "Diagnóstico", study: ["Conteúdo integral"]}]}
  }]);
  if (url.pathname.endsWith("/vc_university_modules")) return Response.json([{
    module_no: 1, title: "Diagnóstico", estimated_minutes: 180, evidence_required: true, checkpoint_pass_count: 4
  }]);
  if (url.pathname.endsWith("/vc_university_questions")) return Response.json([
    {question_id: "checkpoint-1", purpose: "checkpoint", module_no: 1, kind: "concept", prompt: "Questão do módulo", choices: ["A", "B"], correct_index: 1, review_concept: "Diagnóstico"},
    {question_id: "final-1", purpose: "final", module_no: null, kind: "application", prompt: "Questão final", choices: ["C", "D"], correct_index: 0, review_concept: "Aplicação"}
  ]);
  throw new Error("unexpected request: " + url.pathname);
};

function request(path = "?view=curriculum", auth = true) {
  return new Request("https://example.invalid/" + path, {
    headers: auth ? {authorization: "Bearer " + "x".repeat(50)} : {}
  });
}

test("espelho integral exige credencial antes de qualquer consulta", async () => {
  databaseReads = 0;
  const response = await handler(request("?view=curriculum", false));
  assert.equal(response.status, 401);
  assert.equal(databaseReads, 0);
});

test("conta administrativa que não é a proprietária não recebe conteúdo", async () => {
  databaseReads = 0;
  identity = {...owner, id: "00000000-0000-4000-8000-000000000000"};
  const response = await handler(request());
  assert.equal(response.status, 403);
  assert.equal(databaseReads, 0);
  identity = owner;
});

test("proprietário recebe aulas, provas e gabaritos completos", async () => {
  databaseReads = 0;
  platformAdmin = true;
  const response = await handler(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.scope.access, "owner_full_curriculum");
  assert.equal(data.scope.includes_answer_keys, true);
  assert.equal(data.course.content.modules[0].study[0], "Conteúdo integral");
  assert.equal(data.checkpoints[0].correct_index, 1);
  assert.equal(data.checkpoints[0].correct_choice, "B");
  assert.equal(data.final_exam[0].correct_choice, "C");
  assert.equal(databaseReads, 4);
});

test("permissão de plataforma continua obrigatória para o proprietário", async () => {
  databaseReads = 0;
  platformAdmin = false;
  const response = await handler(request());
  assert.equal(response.status, 403);
  assert.equal(databaseReads, 0);
  platformAdmin = true;
});
