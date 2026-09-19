const SESSION_KEY = "vc_portal_session_v1";
const SUPABASE_URL = "https://ctzgsxxbyvruzmfqibnl.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_rF60SyuGpNstim9MqFvqmQ_sSm78z1b";
const STORAGE_KEY = "vc_lideranca_20h_draft_v1";
const panel = document.querySelector("#aula");
const menu = document.querySelector("#module-list");
let course = null;
let studentId = null;
let accessTokenForEvidence = null;
let reviews = {};
let draft = { notes: {}, completed: [], answers: {} };
try { const previous = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); if (previous && typeof previous === "object") draft = { ...draft, ...previous }; } catch { /* Fresh local draft. */ }
function node(tag, value, className) { const element = document.createElement(tag); if (value !== undefined) element.textContent = value; if (className) element.className = className; return element; }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); updateProgress(); }
function updateProgress() { document.querySelector("#progress-copy").textContent = `${draft.completed.length} de ${course?.modules.length || 10} módulos marcados neste dispositivo`; document.querySelector("#progress").value = draft.completed.length; }
function showState(title, description, link) { panel.replaceChildren(node("h1", title), node("p", description)); if (link) { const a=node("a", "Ir para Meus Acessos"); a.href="entrar.html"; panel.append(a); } }
async function token() {
  let session; try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  if (!session?.access_token || !session?.refresh_token) return null;
  if (Number(session.expires_at || 0) > Math.floor(Date.now()/1000)+30) return session.access_token;
  const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:"POST",headers:{apikey:PUBLISHABLE_KEY,"content-type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});
  if (!response.ok) {sessionStorage.removeItem(SESSION_KEY);return null;}
  const renewed=await response.json();
  sessionStorage.setItem(SESSION_KEY,JSON.stringify({access_token:renewed.access_token,refresh_token:renewed.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(renewed.expires_in || 3600),user:renewed.user}));
  return renewed.access_token;
}
function section(title, contents, ordered=false) { const wrapper=node("section"); wrapper.append(node("h2",title)); const list=node(ordered?"ol":"ul"); for(const item of contents) list.append(node("li",item)); wrapper.append(list); return wrapper; }
async function persistEvidence(index, evidence, completed) {
 if (!studentId || !accessTokenForEvidence) throw new Error("identity_unavailable");
 const response=await fetch(`${SUPABASE_URL}/rest/v1/vc_course_evidence?on_conflict=user_id,product_id,module_no`,{
  method:"POST",headers:{apikey:PUBLISHABLE_KEY,authorization:`Bearer ${accessTokenForEvidence}`,"content-type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
  body:JSON.stringify({user_id:studentId,product_id:course.productId,module_no:index+1,evidence,completed_at:completed?new Date().toISOString():null,updated_at:new Date().toISOString()})
 });
 if (!response.ok) throw new Error("save_failed");
}
async function loadEvidence() {
 const response=await fetch(`${SUPABASE_URL}/rest/v1/vc_course_evidence?product_id=eq.${course.productId}&select=module_no,evidence,completed_at`,{headers:{apikey:PUBLISHABLE_KEY,authorization:`Bearer ${accessTokenForEvidence}`},cache:"no-store"});
 if (!response.ok) throw new Error("load_failed");
 const rows=await response.json();
 draft.notes={};draft.completed=[];
 for(const row of rows){const index=row.module_no-1;if(index>=0&&index<10){draft.notes[index]=row.evidence;if(row.completed_at)draft.completed.push(index)}}
 const reviewed=await fetch(`${SUPABASE_URL}/rest/v1/vc_course_reviews?product_id=eq.${course.productId}&select=module_no,status,feedback,reviewed_at`,{headers:{apikey:PUBLISHABLE_KEY,authorization:`Bearer ${accessTokenForEvidence}`},cache:"no-store"});
 if(reviewed.ok) reviews=Object.fromEntries((await reviewed.json()).map(item=>[item.module_no,item]));
 save();
}
function renderModule(index) {
 const lesson=course.modules[index]; panel.replaceChildren(node("p",`Módulo ${lesson.number} de 10 · 2 horas orientadas`,"course-eyebrow"),node("h1",lesson.title),node("p",lesson.outcome));
 panel.append(node("h2","Estudo e caso")); for(const paragraph of lesson.study) panel.append(node("p",paragraph));
 panel.append(section("Estudo guiado · 45 minutos",lesson.guidedStudy.map((part,i)=>`${i+1}. ${part.minutes} minutos — ${part.instruction}`),true));
 panel.append(section("Oficina aplicada · 75 minutos",lesson.workshop,true));
 const task=node("div",undefined,"course-task"); task.append(node("h2","Evidência da oficina"),node("p",lesson.evidence),node("p",`Critério de revisão: ${lesson.rubric}`));
 if(reviews[lesson.number])task.append(node("p",`Parecer do professor: ${reviews[lesson.number].status==="approved"?"Aprovada":"Revisar"}. ${reviews[lesson.number].feedback || ""}`,"course-status"));
 const textarea=node("textarea");textarea.setAttribute("aria-label",`Sua evidência do módulo ${lesson.number}`);textarea.placeholder="Escreva sem dados pessoais de colegas ou clientes.";textarea.value=draft.notes[index] || "";
 const status=node("p","Rascunho salvo apenas neste dispositivo.","course-status"); const saveButton=node("button","Salvar minha evidência");saveButton.type="button";saveButton.onclick=async()=>{try{await persistEvidence(index,textarea.value,draft.completed.includes(index));draft.notes[index]=textarea.value;save();status.textContent="Evidência salva na sua conta V&C."}catch{draft.notes[index]=textarea.value;save();status.textContent="Não foi possível salvar na conta. O rascunho ficou apenas neste dispositivo; tente novamente."}};
 const done=node("button",draft.completed.includes(index)?"Reabrir módulo":"Marcar módulo como estudado");done.type="button";done.onclick=async()=>{if(!textarea.value.trim()){status.textContent="Escreva sua evidência antes de marcar a conclusão.";return;}const completed=!draft.completed.includes(index);try{await persistEvidence(index,textarea.value,completed);draft.notes[index]=textarea.value;draft.completed=completed?[...draft.completed,index].sort((a,b)=>a-b):draft.completed.filter(n=>n!==index);save();renderModule(index)}catch{status.textContent="Não foi possível registrar a conclusão. Sua resposta continua neste campo; tente novamente."}};
 task.append(textarea,saveButton,done,status);panel.append(task);highlight(index);panel.focus();
}
function highlight(index) { [...menu.children].forEach((button,i)=>button.classList.toggle("current",index===i)); }
function assessment() {
 panel.replaceChildren(node("p","Avaliação formativa · 10 questões","course-eyebrow"),node("h1","Avaliação final"),node("p","Responda as dez questões. A referência de domínio é sete acertos. O resultado local não emite certificado nem comprova identidade."));
 const form=node("form");course.assessment.forEach((question,i)=>{const field=node("fieldset");field.append(node("legend",`${i+1}. ${question.question}`));question.choices.forEach((choice,j)=>{const label=node("label");const radio=node("input");radio.type="radio";radio.name=`q${i}`;radio.value=String(j);if(draft.answers[i]===j)radio.checked=true;label.append(radio,document.createTextNode(choice));field.append(label)});form.append(field)});
 const submit=node("button","Enviar avaliação");submit.type="submit";const result=node("p",undefined,"course-status");form.append(submit,result);form.onsubmit=async(event)=>{event.preventDefault();const answers=course.assessment.map((_,i)=>form.querySelector(`input[name=q${i}]:checked`));if(answers.some(value=>!value)){result.textContent="Responda às dez questões antes de enviar.";return;}submit.disabled=true;try{const values=answers.map(value=>Number(value.value));const response=await fetch(`${SUPABASE_URL}/functions/v1/vc-universidade-course`,{method:"POST",headers:{apikey:PUBLISHABLE_KEY,authorization:`Bearer ${accessTokenForEvidence}`,"content-type":"application/json"},body:JSON.stringify({answers:values})});if(!response.ok)throw new Error("assessment_failed");const grade=await response.json();values.forEach((value,i)=>draft.answers[i]=value);save();result.textContent=`Resultado registrado: ${grade.score}/10. ${grade.passed?"Referência de domínio atingida; aguarde a revisão das oficinas pelo professor.":"Revise os módulos "+[...new Set(grade.reviewModules)].join(", ")+" e tente novamente."}`}catch{result.textContent="Não foi possível registrar a avaliação. Tente novamente."}finally{submit.disabled=false}};panel.append(form);highlight(-1);panel.focus();
}
function exportWork(){const content=JSON.stringify({course:course.id,version:course.version,exportedAt:new Date().toISOString(),notes:draft.notes,completed:draft.completed,answers:draft.answers},null,2);const url=URL.createObjectURL(new Blob([content],{type:"application/json"}));const a=node("a");a.href=url;a.download="vc-lideranca-minhas-atividades.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function start(){ try {const accessToken=await token();if(!accessToken){showState("Entre na sua conta","Use o mesmo acesso de Meus Acessos. Somente alunos matriculados poderão abrir a formação.",true);return;}const response=await fetch(`${SUPABASE_URL}/functions/v1/vc-universidade-course`,{headers:{authorization:`Bearer ${accessToken}`,apikey:PUBLISHABLE_KEY,accept:"application/json"},cache:"no-store"});if(response.status===401){showState("Sua sessão expirou","Entre novamente na sua conta para abrir o curso.",true);return;}if(response.status===403){showState("Matrícula não encontrada","Sua conta está ativa, mas ainda não tem acesso a esta formação. Se você já pagou, contate o suporte da V&C e informe o e-mail usado na compra.",true);return;}if(!response.ok)throw new Error("service_unavailable");course=await response.json();accessTokenForEvidence=accessToken;const identity=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:PUBLISHABLE_KEY,authorization:`Bearer ${accessToken}`},cache:"no-store"});if(!identity.ok)throw new Error("identity_unavailable");studentId=(await identity.json()).id;if(!studentId)throw new Error("identity_unavailable");await loadEvidence();menu.replaceChildren(...course.modules.map((lesson,i)=>{const button=node("button",`${i+1}. ${lesson.title}`);button.type="button";button.onclick=()=>renderModule(i);return button}));document.querySelector("#show-assessment").hidden=false;document.querySelector("#export-work").hidden=false;document.querySelector("#show-assessment").onclick=assessment;document.querySelector("#export-work").onclick=exportWork;updateProgress();renderModule(0)}catch{showState("Acesso indisponível","Não foi possível verificar sua matrícula agora. Tente novamente em instantes.",false)}}
start();
