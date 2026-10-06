import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {checkpointSnapshot,gradeStableCheckpoint,resolveModuleStates} from
  "../supabase/functions/_shared/academic-engine.ts";

const root=new URL("..",import.meta.url).pathname;
const read=path=>readFileSync(join(root,path),"utf8");
const migration=read("supabase/migrations/20261005141004_universidade_content_progression_engine.sql");
const api=read("supabase/functions/vc-universidade-learner-v2/index.ts");
await import("../assets/js/universidade-content.js");

test("renderer de blocos preserva texto e rejeita URLs executáveis",()=>{
 const previousDocument=globalThis.document,previousLocation=globalThis.location;
 globalThis.document={createElement:tag=>({tag,textContent:"",children:[],dataset:{},append(...nodes){this.children.push(...nodes)}})};
 globalThis.location={origin:"https://vc.example"};
 try {
  const block=VCAcademicContent.renderBlock({block_type:"download",content:{text:"<script>alert(1)</script>",url:"javascript:alert(1)"}});
  assert.equal(block.children[0].textContent,"<script>alert(1)</script>");
  assert.equal(block.children.some(node=>node.tag==="a"),false);
  const resource=VCAcademicContent.renderBlock({block_type:"reference",content:{url:"https://example.com/source"}});
  assert.equal(resource.children[0].href,"https://example.com/source");
 } finally {globalThis.document=previousDocument;globalThis.location=previousLocation}
});
const modules=[
 {module_version_id:"m1-v1",module_no:1,title:"M1"},
 {module_version_id:"m2-v1",module_no:2,title:"M2"}
];
const dependencies=[{module_version_id:"m2-v1",depends_on_module_version_id:"m1-v1",status:"published"}];
const requirements=[
 {requirement_id:"e1",module_version_id:"m1-v1",requirement_key:"evidence",requirement_type:"evidence_completed",required:true,position:1,status:"published"},
 {requirement_id:"c1",module_version_id:"m1-v1",requirement_key:"checkpoint",requirement_type:"checkpoint_passed",required:true,position:2,status:"published"}
];
const question=(id="q1")=>({question_id:id,question_key:`key-${id}`,question_version:3,prompt:"Fixture acadêmica de teste",
 correct_option_id:`${id}-correct`,correct_feedback:"Conceito aplicado corretamente.",review_concept:"Revise a fixture",
 options:[{option_id:`${id}-wrong`,option_text:"Distrator",feedback:"Revise o conceito da fixture."},
  {option_id:`${id}-correct`,option_text:"Correta",feedback:null},
  {option_id:`${id}-other-1`,option_text:"Distrator 2",feedback:"Compare as evidências."},
  {option_id:`${id}-other-2`,option_text:"Distrator 3",feedback:"Releia o caso."}]});

test("matrícula fixa a versão e o resolver não usa a versão corrente do curso",()=>{
 assert.match(api,/const enrollmentVersion = access\.enrollment\.course_version/);
 assert.match(api,/courseContent\(courseId, version\)/);
 assert.doesNotMatch(api,/courseRecord\.version[^\n]+courseAndProgress/);
});

test("conteúdo estruturado percorre curso, módulo, aula e bloco versionados",()=>{
 for(const table of ["vc_university_course_versions","vc_university_module_versions","vc_university_lesson_versions","vc_university_content_blocks"])
  assert.match(api,new RegExp(table));
 assert.match(migration,/structured_blocks/);
});

test("módulo dependente permanece bloqueado sem conclusão anterior",()=>{
 const state=resolveModuleStates(modules,[],dependencies,requirements,[]);
 assert.equal(state[0].unlocked,true);assert.equal(state[1].unlocked,false);
 assert.equal(state[1].nextAction,"locked");
});

test("requisito obrigatório pendente impede conclusão conceitual",()=>{
 const state=resolveModuleStates(modules,[{module_no:1,module_version_id:"m1-v1",started_at:"2026-10-05T00:00:00Z"}],dependencies,requirements,[]);
 assert.equal(state[0].status,"requirements_pending");
 assert.equal(state[0].pendingRequirements,2);
 assert.equal(state[0].nextAction,"submit_evidence");
});

test("requisitos satisfeitos permitem conclusão e desbloqueiam M2",()=>{
 const requirementRows=requirements.map(item=>({requirement_id:item.requirement_id,status:"completed",satisfied_at:"2026-10-05T00:00:00Z"}));
 const before=resolveModuleStates(modules,[{module_no:1,module_version_id:"m1-v1",started_at:"2026-10-05T00:00:00Z"}],dependencies,requirements,requirementRows);
 assert.equal(before[0].pendingRequirements,0);
 const after=resolveModuleStates(modules,[{module_no:1,module_version_id:"m1-v1",completed_at:"2026-10-05T00:01:00Z"}],dependencies,requirements,requirementRows);
 assert.equal(after[0].completed,true);assert.equal(after[1].unlocked,true);
 assert.equal(after[1].nextAction,"start_module");
});

test("checkpoint abaixo de 70% não aprova e 70% ou mais aprova",()=>{
 const questions=[1,2,3,4,5,6,7,8,9,10].map(value=>question(`q${value}`));
 const six=questions.map((item,index)=>index<6?item.correct_option_id:item.options[0].option_id);
 const seven=questions.map((item,index)=>index<7?item.correct_option_id:item.options[0].option_id);
 assert.equal(gradeStableCheckpoint(questions,six,70).passed,false);
 assert.equal(gradeStableCheckpoint(questions,seven,70).passed,true);
});

test("cinco questões aplicam o limiar de 70% sem arredondar aprovação para três",()=>{
 const questions=[1,2,3,4,5].map(value=>question(`q${value}`));
 const three=questions.map((item,index)=>index<3?item.correct_option_id:item.options[0].option_id);
 const four=questions.map((item,index)=>index<4?item.correct_option_id:item.options[0].option_id);
 assert.equal(gradeStableCheckpoint(questions,three,70).scorePercent,60);
 assert.equal(gradeStableCheckpoint(questions,three,70).passed,false);
 assert.equal(gradeStableCheckpoint(questions,four,70).scorePercent,80);
 assert.equal(gradeStableCheckpoint(questions,four,70).passed,true);
});

test("correct_option_id independe da posição visual randomizada",()=>{
 const original=question();
 const shuffled={...original,options:[...original.options].reverse()};
 assert.equal(gradeStableCheckpoint([original],[original.correct_option_id],70).passed,true);
 assert.equal(gradeStableCheckpoint([shuffled],[shuffled.correct_option_id],70).passed,true);
});

test("feedback usa distrator específico e snapshot preserva versão",()=>{
 const item=question();const grade=gradeStableCheckpoint([item],[item.options[0].option_id],70);
 assert.equal(grade.details[0].feedback,"Revise o conceito da fixture.");
 assert.deepEqual(checkpointSnapshot([item])[0].question_version,3);
});

test("tentativas persistem retry, respostas por option_id e snapshot histórico",()=>{
 for(const fragment of ["attempt_no","course_version","module_version_id","question_snapshot","answers","score_percent","passed"])
  assert.match(migration,new RegExp(fragment));
 assert.match(api,/selected_option_id/);
 assert.match(api,/checkpointSnapshot\(questions\)/);
});

test("conclusão e dependência são validadas no banco e RPC é apenas service_role",()=>{
 assert.match(migration,/required_module_requirements_pending/);
 assert.match(migration,/module_dependency_pending/);
 assert.match(migration,/revoke all on function public\.vc_university_complete_module_if_ready\(uuid,uuid\)[\s\S]+grant execute[\s\S]+to service_role/);
});

test("preview é somente leitura e declara todos os efeitos acadêmicos como falsos",()=>{
 assert.match(api,/preview_read_only/);
 assert.match(api,/writes:\{enrollment:false,progress:false,attempt:false,certificate:false,analytics:false\}/);
 assert.doesNotMatch(read("assets/js/universidade-preview.js"),/method:\s*["']POST/);
});

test("RLS nega acesso browser e aluno não recebe escrita direta",()=>{
 for(const table of ["module_requirements","module_dependencies","lesson_progress","requirement_progress"]){
  assert.match(migration,new RegExp(`vc_university_${table}_browser_deny`));
 }
 assert.match(migration,/revoke all[\s\S]+from public,anon,authenticated/);
 assert.doesNotMatch(migration,/grant (?:insert|update|delete)[^;]+to authenticated/is);
});

test("Liderança mantém JSON e correct_index como adaptadores sem novo acoplamento IE",()=>{
 assert.match(api,/content_model === "legacy_json"/);
 assert.match(api,/Adaptador exclusivo para clientes v1\.1/);
 assert.match(migration,/Campo legado|correct_index|compatibilidade/i);
 assert.doesNotMatch(api,/const DEFAULT_COURSE_ID = "inteligencia-emocional-aplicada"/);
});

test("estrutura IE usa título oficial e não cria aulas nem questões",()=>{
 assert.match(migration,/Da reação automática à decisão consciente/);
 assert.doesNotMatch(migration,/Da reação consciente à decisão inteligente/);
 assert.match(migration,/ie_lessons_must_be_imported_only_from_approved_content/);
 assert.match(migration,/ie_questions_must_be_imported_only_from_approved_bank/);
 for(const title of ["Emoções: Entender Antes de Controlar","PAUSA: O Espaço Entre Impulso e Resposta","Integração e Desenvolvimento"])
  assert.match(migration,new RegExp(title));
});

test("fluxo integrado de fixture leva aluno de M1 ao próximo passo M2",()=>{
 const started=resolveModuleStates(modules,[{module_no:1,module_version_id:"m1-v1",started_at:"2026-10-05T00:00:00Z"}],dependencies,requirements,[]);
 assert.equal(started[0].nextAction,"submit_evidence");
 const satisfied=requirements.map(item=>({requirement_id:item.requirement_id,status:"completed",satisfied_at:"2026-10-05T00:02:00Z"}));
 const completed=resolveModuleStates(modules,[{module_no:1,module_version_id:"m1-v1",completed_at:"2026-10-05T00:03:00Z"}],dependencies,requirements,satisfied);
 assert.equal(completed[0].status,"completed");
 assert.equal(completed[1].unlocked,true);
 assert.equal(completed[1].nextAction,"start_module");
});
