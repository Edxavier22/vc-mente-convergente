const ROOT="https://ctzgsxxbyvruzmfqibnl.supabase.co";
const KEY="sb_publishable_rF60SyuGpNstim9MqFvqmQ_sSm78z1b";
const SESSION="vc_portal_session_v1";
const panel=document.querySelector("#professor-panel");
const summary=document.querySelector("#professor-summary");
const refresh=document.querySelector("#refresh-professor");
let dashboardData=null;

function node(tag,text,klass){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(klass)element.className=klass;return element}
function formatDate(value){if(!value)return "—";return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value))}
function latest(values){return values.filter(Boolean).sort((a,b)=>new Date(b)-new Date(a))[0]||null}

async function token(){
 let session;try{session=JSON.parse(sessionStorage.getItem(SESSION)||"null")}catch{return null}
 if(!session?.access_token)return null;
 if(Number(session.expires_at||0)>Date.now()/1000+30)return session.access_token;
 if(!session.refresh_token)return null;
 const response=await fetch(ROOT+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:KEY,"content-type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});
 if(!response.ok){sessionStorage.removeItem(SESSION);return null}
 const next=await response.json();sessionStorage.setItem(SESSION,JSON.stringify({access_token:next.access_token,refresh_token:next.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(next.expires_in||3600),user:next.user}));return next.access_token
}

async function request(method="GET",payload){
 const access=await token();if(!access)throw new Error("Entre em Meus Acessos para abrir o painel.");
 const response=await fetch(ROOT+"/functions/v1/vc-universidade-professor",{method,headers:{apikey:KEY,authorization:"Bearer "+access,"content-type":"application/json"},body:payload?JSON.stringify(payload):undefined,cache:"no-store"});
 const data=await response.json().catch(()=>({}));
 if(response.status===403)throw new Error("Sua conta não possui turma atribuída neste curso.");
 if(!response.ok)throw new Error(data.error==="invalid_review"?"Preencha um parecer objetivo com pelo menos três caracteres.":"Não foi possível consultar o painel. Tente novamente.");
 return data
}

function buildStudents(data){
 const totalModules=Number(data.course?.module_count)||10;
 const progressByEnrollment={};
 for(const row of data.evidence||[])(progressByEnrollment[row.enrollment_id]??=[]).push(row);
 const attemptsByEnrollment={};
 for(const row of data.attempts||[])(attemptsByEnrollment[row.enrollment_id]??=[]).push(row);
 return (data.enrollments||[]).map(enrollment=>{
  const progress=(progressByEnrollment[enrollment.enrollment_id]||[]).sort((a,b)=>a.module_no-b.module_no);
  const attempts=(attemptsByEnrollment[enrollment.enrollment_id]||[]).sort((a,b)=>new Date(b.submitted_at)-new Date(a.submitted_at));
  const completed=progress.filter(row=>row.completed_at).length;
  const pending=progress.filter(row=>row.submitted_at&&(!row.review_status||row.review_status==="pending")).length;
  const revise=progress.filter(row=>row.review_status==="revise").length;
  const lastActivity=latest([...progress.flatMap(row=>[row.submitted_at,row.completed_at,row.reviewed_at]),...attempts.map(row=>row.submitted_at),enrollment.enrolled_at]);
  const best=attempts.length?Math.max(...attempts.map(row=>Math.round(row.score/(row.question_count||20)*100))):null;
  return {...enrollment,email:data.students?.[enrollment.user_id]||data.students?.[enrollment.subject_id]||"Aluno matriculado",progress,attempts,completed,pending,revise,lastActivity,best,totalModules};
 });
}

function metric(label,value,detail,tone=""){const card=node("article",undefined,"teacher-metric "+tone);card.append(node("p",label),node("strong",String(value)),node("span",detail));return card}
function statusChip(student){
 if(student.status==="completed"||student.completed===student.totalModules)return node("span","Concluído","teacher-chip success");
 if(student.revise)return node("span","Revisão solicitada","teacher-chip warning");
 if(student.pending)return node("span","Aguardando correção","teacher-chip attention");
 return node("span",student.completed?"Em andamento":"Não iniciado","teacher-chip");
}

function renderOverview(students){
 const attempts=students.flatMap(student=>student.attempts);
 const average=attempts.length?Math.round(attempts.reduce((sum,item)=>sum+(item.score/(item.question_count||20)*100),0)/attempts.length):0;
 const waiting=students.reduce((sum,student)=>sum+student.pending,0);
 const projects=students.reduce((sum,student)=>sum+student.progress.filter(row=>row.module_no===10&&row.submitted_at&&row.review_status!=="approved").length,0);
 const section=node("section",undefined,"teacher-section");section.id="visao-geral";
 const heading=node("div",undefined,"teacher-section-heading");const copy=node("div");copy.append(node("p","VISÃO GERAL","teacher-kicker"),node("h2","Pulso da turma"));heading.append(copy,node("p","Indicadores acadêmicos calculados a partir da trilha persistente dos alunos."));section.append(heading);
 const moduleLabel=students[0]?.totalModules?`${students[0].totalModules} módulos concluídos`:"Percurso integral concluído";const grid=node("div",undefined,"teacher-metrics");grid.append(metric("Alunos matriculados",students.length,"Contas com matrícula na turma"),metric("Em andamento",students.filter(item=>item.completed>0&&item.completed<item.totalModules).length,"Percurso iniciado"),metric("Aguardando correção",waiting,"Evidências sem parecer",waiting?"attention":""),metric("Concluídos",students.filter(item=>item.status==="completed"||item.completed===item.totalModules).length,moduleLabel,"success"),metric("Média das avaliações",attempts.length?average+"%":"—",attempts.length?`${attempts.length} tentativa(s) registrada(s)`:"Ainda sem tentativas"),metric("Projetos em revisão",projects,"Evidências do projeto final",projects?"attention":""));section.append(grid);return section
}

function reviewCard(student,row){
 const card=node("article",undefined,"review-card");
 const top=node("div",undefined,"review-card-head");const identity=node("div");identity.append(node("span",`Módulo ${String(row.module_no).padStart(2,"0")}`,"teacher-chip"),node("h3",student.email),node("p",`Entregue em ${formatDate(row.submitted_at)}`));top.append(identity,node("span",row.module_no===10?"Projeto final":"Evidência","review-type"));
 const evidence=node("div",undefined,"review-evidence");evidence.append(node("p","EVIDÊNCIA DO ALUNO","teacher-kicker"),node("p",row.evidence||"Sem conteúdo registrado."));
 const form=node("form",undefined,"review-form");const controls=node("div",undefined,"review-controls");
 const decisionLabel=node("label","Decisão pedagógica");const select=node("select");[["approved","Aprovar"],["revise","Solicitar revisão"]].forEach(([value,text])=>{const option=node("option",text);option.value=value;select.append(option)});select.value=row.review_status==="approved"?"approved":"revise";decisionLabel.append(select);
 const feedbackLabel=node("label","Parecer ao aluno");const feedback=node("textarea");feedback.placeholder="Registre o que foi demonstrado e o próximo passo esperado.";feedback.maxLength=2000;feedback.value=row.review_feedback||"";feedbackLabel.append(feedback);controls.append(decisionLabel,feedbackLabel);
 const actions=node("div",undefined,"review-actions");const button=node("button","Registrar parecer","teacher-primary");button.type="submit";const status=node("p","","teacher-form-status");status.setAttribute("role","status");actions.append(button,status);form.append(controls,actions);
 form.onsubmit=async event=>{event.preventDefault();button.disabled=true;status.textContent="Registrando parecer…";try{const result=await request("POST",{user_id:student.user_id||student.subject_id,module_no:row.module_no,status:select.value,feedback:feedback.value});row.review_status=result.review?.review_status||select.value;row.review_feedback=result.review?.review_feedback||feedback.value.trim();row.reviewed_at=result.review?.reviewed_at||new Date().toISOString();status.textContent="Parecer registrado na trilha do aluno.";status.className="teacher-form-status success";setTimeout(()=>render(dashboardData),800)}catch(error){status.textContent=error.message;status.className="teacher-form-status error"}finally{button.disabled=false}};
 card.append(top,evidence,form);return card
}

function renderQueue(students){
 const pending=students.flatMap(student=>student.progress.filter(row=>row.submitted_at&&(!row.review_status||row.review_status==="pending"||row.review_status==="revise")).map(row=>({student,row}))).sort((a,b)=>new Date(a.row.submitted_at)-new Date(b.row.submitted_at));
 const section=node("section",undefined,"teacher-section");section.id="fila-revisao";const heading=node("div",undefined,"teacher-section-heading");const copy=node("div");copy.append(node("p","FILA DE REVISÃO","teacher-kicker"),node("h2",`${pending.length} ${pending.length===1?"atividade aguarda":"atividades aguardam"} parecer`));heading.append(copy,node("p","A fila centraliza evidências pendentes e revisões solicitadas, sem abrir aluno por aluno."));section.append(heading);
 const list=node("div",undefined,"review-queue");if(!pending.length){const empty=node("div",undefined,"teacher-empty");empty.append(node("strong","Fila em dia"),node("p","Nenhuma atividade aguarda correção neste momento."));list.append(empty)}else pending.forEach(item=>list.append(reviewCard(item.student,item.row)));section.append(list);return section
}

function studentDetail(student,holder){
 holder.replaceChildren();const detail=node("article",undefined,"student-detail");
 const top=node("div",undefined,"student-detail-head");const copy=node("div");copy.append(node("p","PERFIL DO ALUNO","teacher-kicker"),node("h2",student.email),node("p",`${student.cohort_label||"Turma de Liderança"} · matrícula em ${formatDate(student.enrolled_at)}`));const close=node("button","Fechar detalhes","teacher-secondary");close.type="button";close.onclick=()=>holder.replaceChildren();top.append(copy,close);detail.append(top);
 const stats=node("div",undefined,"student-detail-stats");stats.append(metric("Progresso",`${student.completed}/${student.totalModules}`,"Módulos concluídos"),metric("Evidências",student.progress.length,"Entregas registradas"),metric("Avaliação",student.best===null?"—":student.best+"%",`${student.attempts.length} tentativa(s)`));detail.append(stats);
 const modules=node("div",undefined,"student-modules");for(let number=1;number<=student.totalModules;number++){const row=student.progress.find(item=>item.module_no===number);const item=node("div",undefined,"student-module-row");item.append(node("span",String(number).padStart(2,"0")),node("strong",row?.completed_at?"Concluído":row?.submitted_at?"Evidência entregue":"Pendente"),node("small",row?.review_status==="approved"?"Aprovada":row?.review_status==="revise"?"Revisão solicitada":row?.submitted_at?"Aguardando parecer":"Sem entrega"));modules.append(item)}detail.append(node("h3","Percurso por módulo"),modules);
 if(student.attempts.length){const attempts=node("div",undefined,"attempt-history");student.attempts.forEach((item,index)=>attempts.append(node("p",`Tentativa ${student.attempts.length-index} · ${item.score}/${item.question_count||20} · ${formatDate(item.submitted_at)}`)));detail.append(node("h3","Histórico de avaliações"),attempts)}holder.append(detail);holder.scrollIntoView({behavior:"smooth",block:"start"})
}

function renderStudents(students){
 const section=node("section",undefined,"teacher-section");section.id="alunos";const heading=node("div",undefined,"teacher-section-heading");const copy=node("div");copy.append(node("p","ALUNOS","teacher-kicker"),node("h2","Acompanhamento individual"));heading.append(copy,node("p","Progresso, última atividade, avaliação e situação em uma visão única."));section.append(heading);
 const tools=node("div",undefined,"teacher-table-tools");const search=node("input");search.type="search";search.placeholder="Buscar aluno";search.setAttribute("aria-label","Buscar aluno");const filter=node("select");filter.setAttribute("aria-label","Filtrar por situação");[["all","Todas as situações"],["waiting","Aguardando correção"],["progress","Em andamento"],["completed","Concluídos"]].forEach(([value,text])=>{const option=node("option",text);option.value=value;filter.append(option)});tools.append(search,filter);section.append(tools);
 const tableWrap=node("div",undefined,"teacher-table-wrap");const table=node("table",undefined,"teacher-table");const head=node("thead");const headRow=node("tr");["Aluno","Curso / turma","Progresso","Última atividade","Avaliação","Situação",""] .forEach(text=>headRow.append(node("th",text)));head.append(headRow);const body=node("tbody");table.append(head,body);tableWrap.append(table);section.append(tableWrap);const detail=node("div");section.append(detail);
 function fill(){const term=search.value.trim().toLowerCase();const mode=filter.value;const visible=students.filter(student=>student.email.toLowerCase().includes(term)&&(mode==="all"||(mode==="waiting"&&student.pending)||(mode==="progress"&&student.completed>0&&student.completed<student.totalModules)||(mode==="completed"&&(student.status==="completed"||student.completed===student.totalModules))));body.replaceChildren();if(!visible.length){const row=node("tr");const cell=node("td","Nenhum aluno encontrado com estes filtros.");cell.colSpan=7;cell.className="teacher-table-empty";row.append(cell);body.append(row);return}visible.forEach(student=>{const row=node("tr");row.append(node("td",student.email),node("td",`${dashboardData.course?.title||"Formação V&C"} · ${student.cohort_label||"Turma V&C"}`));const progress=node("td");const bar=node("progress");bar.max=student.totalModules;bar.value=student.completed;progress.append(bar,node("span",`${student.completed}/${student.totalModules}`));row.append(progress,node("td",formatDate(student.lastActivity)),node("td",student.best===null?"—":student.best+"%"));const status=node("td");status.append(statusChip(student));row.append(status);const action=node("td");const open=node("button","Abrir aluno","teacher-link");open.type="button";open.onclick=()=>studentDetail(student,detail);action.append(open);row.append(action);body.append(row)})}
 search.addEventListener("input",fill);filter.addEventListener("change",fill);fill();return section
}

function render(data){
 dashboardData=data;const students=buildStudents(data);const evidence=students.reduce((sum,student)=>sum+student.progress.length,0);summary.textContent=`${students.length} ${students.length===1?"aluno matriculado":"alunos matriculados"} · ${evidence} ${evidence===1?"evidência registrada":"evidências registradas"}`;
 panel.setAttribute("aria-busy","false");panel.replaceChildren(renderOverview(students),renderQueue(students),renderStudents(students));panel.focus()
}

async function load(){
 refresh.disabled=true;panel.setAttribute("aria-busy","true");panel.replaceChildren();const loading=node("div",undefined,"teacher-loading");loading.append(node("span"),node("h2","Atualizando o painel"),node("p","Consolidando a trilha acadêmica da turma."));panel.append(loading);
 try{render(await request())}catch(error){panel.setAttribute("aria-busy","false");const state=node("div",undefined,"teacher-error");state.append(node("p","ACESSO AO PAINEL","teacher-kicker"),node("h1","Painel indisponível"),node("p",error.message));const link=node("a","Ir para Meus Acessos","teacher-primary");link.href="entrar.html";state.append(link);panel.replaceChildren(state)}finally{refresh.disabled=false}
}

refresh.addEventListener("click",load);
load();
