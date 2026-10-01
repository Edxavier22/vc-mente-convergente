import test from "node:test";
import assert from "node:assert/strict";

let handler;
globalThis.Deno = {
  env: {get: key => key === "SUPABASE_SERVICE_ROLE_KEY" ? "test-service-key" : undefined},
  serve: callback => { handler = callback; }
};

let backendMode = "ok";
let rpcCalls = [];
let activeRequests = 0;
let peakRequests = 0;
globalThis.fetch = async (_input, options = {}) => {
  activeRequests += 1;
  peakRequests = Math.max(peakRequests, activeRequests);
  try {
    await new Promise(resolve => setTimeout(resolve, 2));
    rpcCalls.push({headers: options.headers, body: JSON.parse(options.body)});
    if (backendMode === "rate_limited") {
      return new Response("proposal_rate_limited", {status: 409});
    }
    if (backendMode === "unavailable") {
      return new Response("database unavailable", {status: 503});
    }
    return Response.json(`VC-PROP-2026-${String(rpcCalls.length).padStart(6, "0")}`);
  } finally {
    activeRequests -= 1;
  }
};

await import("../supabase/functions/vc-universidade-propostas/index.ts");

const ORIGIN = "https://vc-mente-convergente.vercel.app";
const validPayload = sequence => ({
  request_id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
  contact_name: "Carla Souza",
  organization_name: "Empresa Exemplo",
  contact_role: "Diretora de Pessoas",
  email: "CARLA@EXAMPLE.COM",
  phone: "+55 11 99999-0000",
  team_size: "11_to_30",
  delivery_mode: "hybrid",
  course_interest: "lideranca-estrategica-aplicada",
  goals: "Desenvolver decisões melhores e uma rotina segura para as lideranças.",
  consent: true,
  source_path: "/universidade/empresas"
});
const request = (payload, options = {}) => new Request("https://example.invalid/", {
  method: options.method ?? "POST",
  headers: {
    origin: options.origin ?? ORIGIN,
    "user-agent": "phase-14-test",
    "x-forwarded-for": "192.0.2.10",
    "content-type": "application/json",
    ...(options.headers ?? {})
  },
  body: options.method === "GET" ? undefined : JSON.stringify(payload)
});

test.beforeEach(() => {
  backendMode = "ok";
  rpcCalls = [];
  activeRequests = 0;
  peakRequests = 0;
});

test("pré-flight aceita somente a origem oficial e não consulta o banco", async () => {
  const response = await handler(request({}, {method: "OPTIONS"}));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(rpcCalls.length, 0);
});

test("método e origem não autorizados são bloqueados antes do banco", async () => {
  assert.equal((await handler(request({}, {method: "GET"}))).status, 405);
  const rejected = await handler(request(validPayload(1), {origin: "https://example.net"}));
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(rpcCalls.length, 0);
});

test("payload inválido, excessivo e honeypot não geram proposta", async () => {
  assert.equal((await handler(request({...validPayload(2), consent: false}))).status, 422);
  const oversized = request(validPayload(3), {headers: {"content-length": "12001"}});
  assert.equal((await handler(oversized)).status, 413);
  const bot = await handler(request({...validPayload(4), website: "https://spam.example"}));
  assert.equal(bot.status, 202);
  assert.deepEqual(await bot.json(), {received: true});
  assert.equal(rpcCalls.length, 0);
});

test("solicitação válida normaliza os dados e devolve somente o protocolo", async () => {
  const response = await handler(request({...validPayload(5), contact_name: "  Carla\u0000 Souza  "}));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const output = await response.json();
  assert.match(output.reference, /^VC-PROP-2026-/);
  assert.equal(JSON.stringify(output).includes("test-service-key"), false);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].body.p_contact_name, "Carla  Souza");
  assert.equal(rpcCalls[0].body.p_email, "carla@example.com");
  assert.match(rpcCalls[0].body.p_submission_fingerprint, /^[a-f0-9]{64}$/);
});

test("limite de frequência e indisponibilidade retornam respostas estáveis", async () => {
  backendMode = "rate_limited";
  assert.equal((await handler(request(validPayload(6)))).status, 429);
  backendMode = "unavailable";
  assert.equal((await handler(request(validPayload(7)))).status, 503);
});

test("capacidade local: 80 solicitações concorrentes preservam contrato e isolamento", async () => {
  const started = performance.now();
  const results = await Promise.all(Array.from({length: 80}, async (_, index) => {
    const begin = performance.now();
    const response = await handler(request(validPayload(index + 100)));
    return {status: response.status, duration: performance.now() - begin};
  }));
  const durations = results.map(result => result.duration).sort((a, b) => a - b);
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
  assert.deepEqual([...new Set(results.map(result => result.status))], [201]);
  assert.equal(rpcCalls.length, 80);
  assert.ok(peakRequests > 1, `concorrência não exercitada: pico ${peakRequests}`);
  assert.ok(p95 < 1000, `p95 local acima do limite: ${p95.toFixed(1)} ms`);
  assert.ok(performance.now() - started < 5000, "ensaio local excedeu cinco segundos");
});
