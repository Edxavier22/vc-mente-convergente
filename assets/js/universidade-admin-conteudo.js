const ROOT="https://ctzgsxxbyvruzmfqibnl.supabase.co";
const KEY="sb_publishable_rF60SyuGpNstim9MqFvqmQ_sSm78z1b";
const API=ROOT+"/functions/v1/vc-universidade-admin";
const SESSION="vc_portal_session_v1";
const status=document.querySelector("#owner-content-status");
const content=document.querySelector("#owner-content");
const summary=document.querySelector("#owner-content-summary");
const navigation=document.querySelector("#owner-content-navigation");
const panel=document.querySelector("#owner-content-panel");
let payload;

function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(className)node.className=className;return node}
function append(parent,...nodes){nodes.filter(Boolean).forEach(node=>parent.append(node));return parent}
function session(){try{return JSON.parse(localStorage.getItem(SESSION)||"null")}catch{return null}}
async function token(){
 const current=session();if(!current?.access_token||!current?.refresh_token)return null;
 if(Number(current.expires_at||0)>Date.now()/1000+30)return current.access_token;
 const response=await fetch(ROOT+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:KEY,"content-type":"application/json"},body:JSON.stringify({refresh_token:current.refresh_token}),cache:"no-store"});
 if(!response.ok){localStorage.removeItem(SESSION);return null}
 const next=await response.json();localStorage.setItem(SESSION,JSON.stringify({access_token:next.access_token,refresh_token:next.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(next.expires_in||3600),user:next.user}));return next.access_token
}
async function request(){
 const access=await token();if(!access)throw new Error("sign_in_required");
 const course=new URLSearchParams(location.search).get("course")||"lideranca-estrategica-aplicada";
 const response=await fetch(API+"?view=curriculum&course="+encodeURIComponent(course),{headers:{apikey:KEY,authorization:"Bearer "+access,accept:"application/json"},cache:"no-store"});
 const data=await response.json().catch(()=>({}));
 if(response.status===401)throw new Error("sign_in_required");
 if(response.status===403)throw new Error("owner_required");
 if(!response.ok)throw new Error(data.error||"service_unavailable");
 return data
}
function metric(label,value,detail){const card=el("article",undefined,"vc-owner-metric");append(card,el("span",label),el("strong",value),el("small",detail));return card}
function listSection(label,title,items,className=""){
 if(!Array.isArray(items)||!items.length)return null;
 const section=el("section",undefined,"vc-owner-section "+className);append(section,el("p",label,"vc-admin-kicker"),el("h2",title));
 const list=el("ul");items.forEach(item=>list.append(el("li",typeof item==="string"?item:item?.instruction||JSON.stringify(item))));section.append(list);return section
}
function narrative(label,title,body,className=""){
 if(!body)return null;const section=el("section",undefined,"vc-owner-section "+className);append(section,el("p",label,"vc-admin-kicker"),el("h2",title),el("p",body));return section
}
function concepts(items){
 if(!Array.isArray(items)||!items.length)return null;const section=el("section",undefined,"vc-owner-section");append(section,el("p","CONCEITOS-CHAVE","vc-admin-kicker"),el("h2","Fundamentos do módulo"));
 const grid=el("div",undefined,"vc-owner-concepts");items.forEach((item,index)=>{const card=el("article");append(card,el("span",String(index+1).padStart(2,"0")),el("h3",item.title),el("p",item.body));grid.append(card)});section.append(grid);return section
}
function caseStudy(item){
 if(!item?.scenario)return null;const section=el("section",undefined,"vc-owner-section vc-owner-case");append(section,el("p","ESTUDO DE CASO","vc-admin-kicker"),el("h2",item.title||"Caso para análise"),el("p",item.scenario));
 if(Array.isArray(item.analysisQuestions)){const list=el("ol");item.analysisQuestions.forEach(question=>list.append(el("li",question)));append(section,el("h3","Decisões para analisar"),list)}return section
}
function references(items){
 if(!Array.isArray(items)||!items.length)return null;const section=el("section",undefined,"vc-owner-section");append(section,el("p","REFERÊNCIAS","vc-admin-kicker"),el("h2","Fontes do módulo"));const list=el("ol");
 items.forEach(item=>{const row=el("li");append(row,el("strong",item.title));const detail=[item.authors,item.source,item.year].filter(Boolean).join(" · ");if(detail)row.append(el("span",detail));if(item.doi)row.append(el("span","DOI: "+item.doi));if(item.url){const link=el("a","Consultar fonte");link.href=item.url;link.target="_blank";link.rel="noopener noreferrer";row.append(link)}list.append(row)});section.append(list);return section
}
function questionCard(question,index){
 const card=el("article",undefined,"vc-owner-question");const head=el("div",undefined,"vc-owner-question-head");append(head,el("span",String(index+1).padStart(2,"0")),el("strong",question.kind));append(card,head,el("h3",question.prompt));
 const choices=el("ol",undefined,"vc-owner-choices");question.choices.forEach((choice,choiceIndex)=>{const item=el("li",choice,choiceIndex===question.correct_index?"is-correct":"");if(choiceIndex===question.correct_index)item.append(el("strong","Resposta correta"));choices.append(item)});card.append(choices);
 append(card,append(el("p",undefined,"vc-owner-review-concept"),el("strong","Conceito de revisão: "),document.createTextNode(question.review_concept||"Não informado.")));return card
}
function questionsSection(title,questions){
 const section=el("section",undefined,"vc-owner-section vc-owner-questions");append(section,el("p","AVALIAÇÃO E GABARITO","vc-admin-kicker"),el("h2",title),el("p",questions.length+" questões ativas"));
 const list=el("div",undefined,"vc-owner-question-list");questions.forEach((question,index)=>list.append(questionCard(question,index)));section.append(list);return section
}
function renderModule(module){
 const number=Number(module.number);const metadata=payload.modules.find(item=>Number(item.module_no)===number);const questions=payload.checkpoints.filter(item=>Number(item.module_no)===number);
 const header=el("header",undefined,"vc-owner-module-header");append(header,el("p","MÓDULO "+String(number).padStart(2,"0")+" DE "+String(payload.summary.modules).padStart(2,"0"),"vc-admin-kicker"),el("h1",module.title),el("p",module.outcome));
 const facts=el("div",undefined,"vc-owner-module-facts");[["Carga estimada",metadata?Math.round(metadata.estimated_minutes/60*10)/10+"h":"—"],["Evidência",metadata?.evidence_required?"Obrigatória":"Não obrigatória"],["Checkpoint",metadata?.checkpoint_pass_count+" de 5 acertos"]].forEach(([label,value])=>facts.append(metric(label,value,"Configuração acadêmica")));header.append(facts);
 const body=el("div",undefined,"vc-owner-module-body");body.append(header);
 append(body,
  narrative("ABERTURA","Por que este módulo importa",module.opening,"is-opening"),
  listSection("OBJETIVOS","Ao final, o aluno será capaz de",module.objectives),
  (()=>{const section=el("section",undefined,"vc-owner-section");append(section,el("p","ESTUDO ORIENTADO","vc-admin-kicker"),el("h2","Conteúdo aprofundado"));(module.study||[]).forEach((text,index)=>{const block=el("article",undefined,"vc-owner-reading");append(block,el("span","Leitura "+(index+1)),el("p",text));section.append(block)});return section})(),
  concepts(module.concepts),
  narrative("PRINCÍPIO V&C",module.principle?.title||"Princípio de aplicação",module.principle?.body,"is-principle"),
  narrative("EXEMPLO",module.example?.title||"Exemplo aplicado",module.example?.body),
  caseStudy(module.caseStudy),
  listSection("ATENÇÃO","Erros comuns",module.commonErrors,"is-attention"),
  listSection("NA PRÁTICA","Aplicação no cotidiano",module.application),
  listSection("ESTUDO GUIADO","Passos orientados",module.guidedStudy),
  listSection("PARA REFLETIR","Perguntas de reflexão",module.reflection),
  listSection("OFICINA","Atividade aplicada",module.workshop),
  listSection("SÍNTESE","O essencial para levar",module.synthesis),
  listSection("PREPARAÇÃO","Revisão para o checkpoint",module.checkpointReview),
  narrative("PORTFÓLIO PROFISSIONAL","Evidência solicitada",module.evidence,"is-evidence"),
  narrative("CRITÉRIO DE QUALIDADE","Rubrica de avaliação",module.rubric,"is-rubric"),
  questionsSection("Checkpoint do módulo",questions),
  references(module.references)
 );
 panel.replaceChildren(body);panel.focus();window.scrollTo({top:0,behavior:"smooth"});selectNavigation("module-"+number)
}
function renderFinal(){
 const header=el("header",undefined,"vc-owner-module-header");append(header,el("p","BANCO PRIVADO DO PROPRIETÁRIO","vc-admin-kicker"),el("h1","Prova final e gabaritos"),el("p","O aluno recebe uma sessão de 20 questões selecionadas deste banco, sem acesso às respostas corretas."));
 const groups=["concept","application","case","decision"];const body=el("div",undefined,"vc-owner-module-body");body.append(header);
 groups.forEach(kind=>{const rows=payload.final_exam.filter(item=>item.kind===kind);if(rows.length)body.append(questionsSection(({concept:"Conceitos",application:"Aplicação",case:"Estudos de caso",decision:"Tomada de decisão"})[kind],rows))});
 panel.replaceChildren(body);panel.focus();window.scrollTo({top:0,behavior:"smooth"});selectNavigation("final")
}
function selectNavigation(key){navigation.querySelectorAll("button").forEach(button=>button.classList.toggle("is-current",button.dataset.view===key))}
function render(data){
 payload=data;const course=data.course;summary.replaceChildren(
  metric("Curso",course.title,"Versão "+course.version),
  metric("Módulos",data.summary.modules,"Conteúdo integral"),
  metric("Checkpoints",data.summary.checkpoint_questions,"Perguntas com gabarito"),
  metric("Prova final",data.summary.final_questions,"Banco ativo completo")
 );
 navigation.replaceChildren();course.content.modules.forEach(module=>{const button=el("button",String(module.number).padStart(2,"0")+" · "+module.title);button.type="button";button.dataset.view="module-"+module.number;button.onclick=()=>renderModule(module);navigation.append(button)});
 const final=el("button","Prova final · banco completo");final.type="button";final.dataset.view="final";final.onclick=renderFinal;navigation.append(final);
 content.hidden=false;status.hidden=true;renderModule(course.content.modules[0])
}
function failure(error){
 content.hidden=true;status.hidden=false;status.className="vc-admin-status is-error";const title=error.message==="sign_in_required"?"Sessão necessária":error.message==="owner_required"?"Acesso exclusivo do proprietário":"Conteúdo indisponível";const copy=error.message==="sign_in_required"?"Entre em Meus Acessos com a conta proprietária.":error.message==="owner_required"?"Esta área contém conteúdo e gabaritos reservados ao proprietário da Universidade.":"Tente novamente em instantes.";status.replaceChildren(el("strong",title),el("span",copy));const link=el("a","Ir para Meus Acessos");link.href="/entrar";status.append(link)
}
request().then(render).catch(failure);
