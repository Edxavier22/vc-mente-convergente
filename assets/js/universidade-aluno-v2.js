const ROOT="https://ctzgsxxbyvruzmfqibnl.supabase.co";
const KEY="sb_publishable_rF60SyuGpNstim9MqFvqmQ_sSm78z1b";
const API=ROOT+"/functions/v1/vc-universidade-learner-v2";
const SESSION="vc_portal_session_v1";
const panel=document.querySelector("#aula");
const menu=document.querySelector("#module-list");
let catalog;
let current=1;
function el(tag,text,klass){const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(klass)x.className=klass;return x}
function message(title,detail,link=false){panel.replaceChildren(el("h1",title),el("p",detail));if(link){const a=el("a","Ir para Meus Acessos");a.href="entrar.html";panel.append(a)}}
async function token(){
 let s;try{s=JSON.parse(sessionStorage.getItem(SESSION)||"null")}catch{return null}
 if(!s?.access_token||!s?.refresh_token)return null;
 if(Number(s.expires_at||0)>Date.now()/1000+30)return s.access_token;
 const r=await fetch(ROOT+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:KEY,"content-type":"application/json"},body:JSON.stringify({refresh_token:s.refresh_token})});
 if(!r.ok){sessionStorage.removeItem(SESSION);return null}
 const n=await r.json();sessionStorage.setItem(SESSION,JSON.stringify({access_token:n.access_token,refresh_token:n.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(n.expires_in||3600),user:n.user}));return n.access_token
}
async function call(path="",body){
 const access=await token();if(!access)throw Error("sign_in_required");
 const r=await fetch(API+path,{method:body?"POST":"GET",cache:"no-store",headers:{apikey:KEY,authorization:"Bearer "+access,accept:"application/json",...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||"service_unavailable");return data
}
function update(){
 const done=catalog.modules.filter(m=>m.completed).length;
 document.querySelector("#progress-copy").textContent=`${done} de ${catalog.modules.length} módulos concluídos na sua conta`;
 const bar=document.querySelector("#progress");bar.max=catalog.modules.length;bar.value=done;
 menu.replaceChildren(...catalog.modules.map(m=>{const b=el("button",`${m.completed?"✓":m.unlocked?"●":"🔒"} ${String(m.number).padStart(2,"0")} ${m.title}`);b.type="button";b.disabled=!m.unlocked;b.classList.toggle("current",m.number===current);if(!m.unlocked)b.setAttribute("aria-label",`${m.title} bloqueado. Conclua o Módulo ${m.number-1} para liberar.`);b.onclick=()=>openModule(m.number);return b}));
 const locked=catalog.modules.find(m=>!m.unlocked);
 if(locked)menu.append(el("p",`Conclua o Módulo ${locked.number-1} para liberar o próximo.`,"course-status"))
}
async function reload(){catalog=await call();update()}
function steps(title,items){const section=el("section");section.append(el("h2",title));const list=el("ol");items.forEach(item=>list.append(el("li",item)));section.append(list);return section}
async function checkpoint(number,holder){
 try{
  const data=await call(`?module=${number}&view=checkpoint`);
  const form=el("form");form.append(el("h2","Checkpoint V&C"),el("p",`Responda às cinco questões. São necessários ${data.minimum} acertos para avançar.`));
  data.questions.forEach((q,i)=>{const field=el("fieldset");field.append(el("legend",`${i+1}. ${q.prompt}`));q.choices.forEach((choice,j)=>{const label=el("label"),input=el("input");input.type="radio";input.name=`q${i}`;input.value=String(j);label.append(input,document.createTextNode(choice));field.append(label)});form.append(field)});
  const submit=el("button","Enviar checkpoint"),result=el("p","","course-status");submit.type="submit";result.setAttribute("role","status");form.append(submit,result);
  form.onsubmit=async event=>{event.preventDefault();const selected=data.questions.map((_,i)=>form.querySelector(`input[name="q${i}"]:checked`));if(selected.some(x=>!x)){result.textContent="Responda às cinco questões.";return}submit.disabled=true;try{
   const grade=await call(`?module=${number}`,{action:"checkpoint",answers:selected.map(x=>Number(x.value))});
   result.textContent=grade.passed?`${grade.score}/5 — domínio demonstrado. Módulo concluído.`:`${grade.score}/5 — revise: ${grade.review.join("; ")}.`;
   if(grade.passed)await reload();
   else if(grade.review.length){const review=el("button","Revisar conceito");review.type="button";review.onclick=()=>panel.querySelector("h2")?.scrollIntoView({behavior:"smooth"});result.append(" ",review)}
  }catch(error){result.textContent=error.message==="attempt_limit"?"Limite de três tentativas nas últimas 24 horas. Revise e tente amanhã.":error.message==="evidence_required"?"Entregue sua evidência antes do checkpoint.":"Não foi possível registrar o checkpoint."}finally{submit.disabled=false}};
  holder.replaceWith(form)
 }catch{holder.textContent="Checkpoint indisponível. Sua evidência continua salva na sua conta; tente novamente mais tarde."}
}
async function openModule(number){
 current=number;update();message("Abrindo o módulo","Consultando sua matrícula e seu progresso…");
 try{
  const {lesson,progress}=await call(`?module=${number}`);
  panel.replaceChildren(el("p",`Módulo ${number} de ${catalog.modules.length} · carga horária pedagógica estimada`,"course-eyebrow"),el("h1",lesson.title),el("p",lesson.outcome),el("h2","Estudo e caso"));
  lesson.study.forEach(text=>panel.append(el("p",text)));
  panel.append(steps("Estudo guiado",lesson.guidedStudy.map(x=>x.instruction)),steps("Oficina aplicada",lesson.workshop));
  const task=el("section",undefined,"course-task");task.append(el("h2","Evidência da oficina"),el("p",lesson.evidence),el("p",`Critério de revisão: ${lesson.rubric}`));
  if(progress?.review_feedback)task.append(el("p",`Parecer do professor: ${progress.review_feedback}`,"course-status"));
  const label=el("label","Sua evidência"),area=el("textarea");area.value=progress?.evidence||"";area.maxLength=12000;area.placeholder="Descreva sua aplicação sem dados pessoais de colegas ou clientes.";label.append(area);
  const save=el("button",progress?.submitted_at?"Atualizar evidência":"Entregar evidência"),status=el("p",progress?.submitted_at?"Evidência registrada na sua conta.":"Escreva ao menos 20 caracteres relevantes.","course-status");status.setAttribute("role","status");
  save.type="button";save.disabled=!!progress?.completed_at;
  const next=el("button","Abrir Checkpoint V&C");next.type="button";next.disabled=!progress?.submitted_at;
  save.onclick=async()=>{save.disabled=true;try{await call(`?module=${number}`,{action:"evidence",evidence:area.value});status.textContent="Evidência registrada na sua conta. Agora realize o Checkpoint V&C.";next.disabled=false}catch(error){status.textContent=error.message==="evidence_invalid"?"Escreva ao menos 20 caracteres relevantes.":"Não foi possível salvar. A resposta permanece neste campo."}finally{save.disabled=false}};
  next.onclick=()=>{next.disabled=true;const holder=el("p","Carregando checkpoint…","course-status");task.append(holder);checkpoint(number,holder)};
  task.append(label,save,status,next);panel.append(task);panel.focus()
 }catch(error){message("Módulo indisponível",error.message==="previous_module_required"?`Conclua o Módulo ${number-1} para liberar o próximo.`:"Não foi possível abrir este módulo. Tente novamente.")}
}
async function start(){
 try{await reload();document.querySelector("#show-assessment").hidden=true;document.querySelector("#export-work").hidden=true;const active=catalog.modules.find(m=>m.unlocked&&!m.completed)||catalog.modules.find(m=>m.unlocked);if(active)await openModule(active.number);else message("Formação indisponível","Nenhum módulo liberado nesta matrícula.")}
 catch(error){const states={sign_in_required:["Entre na sua conta","Use o mesmo acesso de Meus Acessos.",true],access_denied:["Matrícula não encontrada","Esta conta ainda não tem acesso a esta formação.",true],enrollment_sync_required:["Matrícula em conferência","Seu direito foi localizado, mas a turma ainda não foi vinculada. Contate o suporte V&C.",false]};message(...(states[error.message]||["Acesso indisponível","Não foi possível consultar sua matrícula. Tente novamente mais tarde.",false]))}
}
start();
