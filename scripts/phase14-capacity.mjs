const baseUrl = process.env.CAPACITY_BASE_URL;
const proposalUrl = process.env.CAPACITY_PROPOSAL_URL;
const publishableKey = process.env.CAPACITY_PUBLISHABLE_KEY;
const requests = bounded("CAPACITY_REQUESTS", 20, 1, 100);
const concurrency = bounded("CAPACITY_CONCURRENCY", 5, 1, 10);
const p95Limit = bounded("CAPACITY_P95_MS", 2500, 100, 15000);

if (!baseUrl) {
  console.error("Defina CAPACITY_BASE_URL com a URL exata do preview da Fase 14.");
  process.exit(2);
}

const base = new URL(baseUrl);
const local = ["localhost", "127.0.0.1"].includes(base.hostname);
if (base.protocol !== "https:" && !local) {
  throw new Error("CAPACITY_BASE_URL deve usar HTTPS ou apontar para o servidor local.");
}

const scenarios = [
  {name: "home", url: new URL("/", base), method: "GET", expected: [200]},
  {name: "catalogo", url: new URL(local ? "/universidade-vc.html" : "/universidade-vc", base), method: "GET", expected: [200]},
  {name: "empresas", url: new URL(local ? "/formacao-empresas.html" : "/universidade/empresas", base), method: "GET", expected: [200]},
  {name: "portal", url: new URL(local ? "/entrar.html" : "/entrar", base), method: "GET", expected: [200]}
];

if (proposalUrl || publishableKey) {
  if (!proposalUrl || !publishableKey) throw new Error("Informe CAPACITY_PROPOSAL_URL e CAPACITY_PUBLISHABLE_KEY juntos.");
  const target = new URL(proposalUrl);
  if (target.protocol !== "https:") throw new Error("CAPACITY_PROPOSAL_URL deve usar HTTPS.");
  scenarios.push({
    name: "proposta-honeypot-sem-gravacao",
    url: target,
    method: "POST",
    expected: [202],
    headers: {apikey: publishableKey, origin: base.origin, "content-type": "application/json"},
    body: JSON.stringify({website: "phase-14-capacity-check"})
  });
}

const report = [];
for (const scenario of scenarios) {
  const results = await runScenario(scenario);
  const durations = results.map(result => result.duration).sort((a, b) => a - b);
  const failures = results.filter(result => !scenario.expected.includes(result.status));
  const row = {
    scenario: scenario.name,
    requests,
    concurrency,
    failures: failures.length,
    p50_ms: percentile(durations, 0.50),
    p95_ms: percentile(durations, 0.95),
    max_ms: Math.round(durations.at(-1))
  };
  report.push(row);
  if (failures.length || row.p95_ms > p95Limit) process.exitCode = 1;
}

console.table(report);
console.log(`Gate: zero falhas e p95 <= ${p95Limit} ms. O POST opcional usa honeypot e não persiste propostas.`);

function bounded(name, fallback, minimum, maximum) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} deve ser inteiro entre ${minimum} e ${maximum}.`);
  }
  return value;
}

async function runScenario(scenario) {
  let cursor = 0;
  const results = [];
  const workers = Array.from({length: Math.min(concurrency, requests)}, async () => {
    while (cursor < requests) {
      cursor += 1;
      const started = performance.now();
      try {
        const response = await fetch(scenario.url, {
          method: scenario.method,
          headers: scenario.headers,
          body: scenario.body,
          redirect: "follow",
          signal: AbortSignal.timeout(15000)
        });
        await response.arrayBuffer();
        results.push({status: response.status, duration: performance.now() - started});
      } catch {
        results.push({status: 0, duration: performance.now() - started});
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function percentile(values, ratio) {
  return Math.round(values[Math.ceil(values.length * ratio) - 1]);
}
