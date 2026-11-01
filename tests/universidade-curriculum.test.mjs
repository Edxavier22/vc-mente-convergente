import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validatePackage,hash,importSql,mapping,csvRows,stableId} from '../scripts/universidade-curriculum-import.mjs';
import {assessmentPreviewBank,assessmentPreviewGrade} from '../supabase/functions/_shared/assessment-api.ts';

function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'vc-curriculum-fixture-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 mkdirSync(join(root,'manifestos'));const entries=[];
 for(let m=1;m<=10;m++){mkdirSync(join(root,'aulas',`MODULO_${String(m).padStart(2,'0')}`),{recursive:true});for(let a=1;a<=5;a++){
  const code=`IE-M${String(m).padStart(2,'0')}-A${String(a).padStart(2,'0')}`,path=`aulas/MODULO_${String(m).padStart(2,'0')}/${code}.md`;
  const text=`# Aula ${a} — Fixture técnica ${m}/${a}\n\nConteúdo hipotético exclusivamente de teste ${code}.\n`;
  writeFileSync(join(root,path),text);entries.push({module_no:m,lesson_no:a,lesson_code:code,target_file:path,sha256:hash(text),bytes:Buffer.byteLength(text),risk_flags:0});
 }}
 const manifest=JSON.stringify(entries);writeFileSync(join(root,'manifestos/aulas.json'),manifest);
 writeFileSync(join(root,'manifestos/inventario_50_aulas.csv'),'lesson_code,module_no,lesson_no,target_file,sha256,bytes,risk_flags\n'+entries.map(e=>[e.lesson_code,e.module_no,e.lesson_no,e.target_file,e.sha256,e.bytes,0].join(',')).join('\n'));
 writeFileSync(join(root,'manifestos/alertas_editoriais.json'),'[]');
 writeFileSync(join(root,'manifestos/STAGING_NAO_EXECUTAVEL.json'),JSON.stringify({course_slug:'inteligencia-emocional-aplicada',course_version:'1.0',lessons:entries.map(e=>({editorial_id:e.lesson_code,sha256:e.sha256}))}));
 writeFileSync(join(root,'manifestos/referencias_a_verificar.csv'),'url,status\nhttps://example.invalid,unverified\n');
 return {root,entries,options:{manifestSha:hash(manifest)}};
}
test('importador reconhece 50 fontes distintas, 5 por módulo e IDs determinísticos',t=>{
 const f=fixture(t),a=validatePackage(f.root,f.options),b=validatePackage(f.root,f.options);
 assert.equal(a.lessons.length,50);assert.equal(a.summary.editorial_approval,false);assert.deepEqual(a,b);
 assert.equal(new Set(a.lessons.map(l=>l.lesson_version_id)).size,50);assert.equal(a.lessons.reduce((n,l)=>n+l.estimated_minutes,0),1200);
});
test('manifesto não reconhecido não pode atribuir proveniência ao pacote oficial',t=>{const f=fixture(t);assert.throws(()=>validatePackage(f.root),/manifest_not_recognized/);});
test('alteração de um byte no Markdown bloqueia toda importação',t=>{const f=fixture(t);writeFileSync(join(f.root,f.entries[0].target_file),'texto adulterado');assert.throws(()=>validatePackage(f.root,f.options),/hash_or_manifest_mismatch/);});
test('alerta editorial explícito impede importação automática',t=>{const f=fixture(t);writeFileSync(join(f.root,'manifestos/alertas_editoriais.json'),'["review_required"]');assert.throws(()=>validatePackage(f.root,f.options),/editorial_alerts/);});
test('CSV preserva vírgulas, aspas e BOM',()=>assert.deepEqual(csvRows('\uFEFFa,b\n"um, dois","aspas ""sim"""\n'),[{a:'um, dois',b:'aspas "sim"'}]));
test('relatório de mapeamento não inclui o texto das aulas nem gabaritos',t=>{const f=fixture(t),p=validatePackage(f.root,f.options);p.questions=[{editorial_id:'q',question_id:'id',correct_option_id:'secret',prompt:'private'}];const result=JSON.stringify(mapping(p));assert.doesNotMatch(result,/Conteúdo hipotético|correct_option|private/);});
test('SQL padrão termina em rollback e commit exige opção explícita',t=>{const f=fixture(t),p=validatePackage(f.root,f.options);assert.match(importSql(p),/rollback;\s*$/);assert.match(importSql(p,{commit:true}),/commit;\s*$/);assert.match(importSql(p),/set local role service_role/);assert.match(importSql(p),/curriculum_block_conflict/);assert.doesNotMatch(importSql(p),/disable trigger|truncate|delete from|update public\.vc_university_/i);});
test('delimitadores SQL no conteúdo são rejeitados antes de emitir script',t=>{const f=fixture(t),p=validatePackage(f.root,f.options);p.lessons[0].content.text='$import$';assert.throws(()=>importSql(p),/sql_delimiter/);});
test('IDs distintos de versão e opção não reaproveitam identidade histórica',()=>assert.notEqual(stableId('question-v2:IE-M02-Q05'),stableId('question-v2:IE-M02-Q05:A')));

const question=(n,version=1)=>({question_id:`q${n}-v${version}`,question_key:`key${n}`,editorial_id:`IE-M01-Q0${n}`,question_version:version,purpose:'checkpoint',module_no:1,prompt:'Fixture técnica',status:'draft',correct_option_id:`q${n}-v${version}-a`,correct_feedback:'Aplicação da fixture confirmada.',review_concept:'Fixture',options:['a','b','c','d'].map(k=>({option_id:`q${n}-v${version}-${k}`,option_text:k,feedback:'Reveja o princípio da fixture.'}))});
const bank=[1,2,3,4,5].map(n=>question(n));
test('preview aluno recebe apenas enunciado e opções, sem respostas ou feedback antecipados',()=>{const result=assessmentPreviewBank(bank,'student');assert.equal(result.length,5);assert.doesNotMatch(JSON.stringify(result),/correct_option|correct_feedback|feedback|is_correct/);});
test('instrumento simulado seleciona uma revisão por ID; editor conserva histórico',()=>{const versions=[...bank,question(1,2)];assert.equal(assessmentPreviewBank(versions,'student').length,5);assert.equal(assessmentPreviewBank(versions,'student')[0].question_version,2);assert.equal(assessmentPreviewBank(versions,'content_master').length,6);});
function answers(score){return bank.map((q,i)=>({question_id:q.question_id,selected_option_id:q.options[i<score?0:1].option_id}));}
test('correção da prévia no servidor aplica 3/5 falha e 4/5 passa sem persistência',()=>{assert.equal(assessmentPreviewGrade(bank,{purpose:'checkpoint',module:1,answers:answers(3)}).passed,false);const r=assessmentPreviewGrade(bank,{purpose:'checkpoint',module:1,answers:answers(4)});assert.equal(r.passed,true);assert.equal(r.persisted,false);assert.doesNotMatch(JSON.stringify(r),/correct_option_id|certificate/);});
test('prévia recusa respostas de outro instrumento, duplicadas ou incompletas',()=>{for(const a of [answers(5).slice(1),[...answers(5).slice(1),answers(5)[1]],answers(5).map(a=>({...a,selected_option_id:'foreign'}))])assert.throws(()=>assessmentPreviewGrade(bank,{purpose:'checkpoint',module:1,answers:a}),/answers_invalid/);});
test('prévia recusa versão stale e módulo arbitrário',()=>{assert.throws(()=>assessmentPreviewGrade([...bank,question(1,2)],{purpose:'checkpoint',module:1,answers:answers(5)}),/answers_invalid/);assert.throws(()=>assessmentPreviewGrade(bank,{purpose:'checkpoint',module:2,answers:answers(5)}),/answers_invalid/);});
test('prova simulada exige 14/20 e permanece independente de E10',()=>{const exam=Array.from({length:20},(_,i)=>({...question(i+1),purpose:'final',editorial_id:`IE-QF${i+1}`}));const a=n=>exam.map((q,i)=>({question_id:q.question_id,selected_option_id:q.options[i<n?0:1].option_id}));assert.equal(assessmentPreviewGrade(exam,{purpose:'final',answers:a(13)}).passed,false);const r=assessmentPreviewGrade(exam,{purpose:'final',answers:a(14)});assert.equal(r.passed,true);assert.equal(r.final_project_approved,undefined);});

await import('../assets/js/universidade-content.js');
function dom(){const node=tag=>({tag,children:[],dataset:{},attrs:{},textContent:'',append(...c){this.children.push(...c)},setAttribute(k,v){this.attrs[k]=v}});return {createElement:node,createTextNode:text=>({tag:'#text',textContent:text,children:[]})};}
const flatten=n=>[n,...(n.children||[]).flatMap(flatten)];
test('Markdown renderiza sem HTML executável e bloqueia URLs javascript/data',()=>{const old=globalThis.document,loc=globalThis.location;globalThis.document=dom();globalThis.location={origin:'https://example.invalid'};try{const root=VCAcademicContent.renderMarkdown('# Conceito\n\n<script>alert(1)</script> [perigo](javascript:alert) [fonte](https://example.org)\n\n> **Princípio**\n\n| A | B |\n|---|---|\n| um | dois |');const nodes=flatten(root);assert.equal(nodes.filter(n=>n.tag==='script').length,0);assert.equal(nodes.filter(n=>n.tag==='a').length,1);assert.equal(nodes.find(n=>n.tag==='a').rel,'noopener noreferrer');assert.ok(nodes.some(n=>n.tag==='table'));assert.ok(nodes.some(n=>n.tag==='blockquote'));}finally{globalThis.document=old;globalThis.location=loc;}});
test('renderer não mostra metadados de proveniência na aula',()=>{const old=globalThis.document;globalThis.document=dom();try{const block=VCAcademicContent.renderBlock({block_type:'study',content:{format:'markdown',text:'Texto da fixture',provenance:{private_metadata:'do not display'}}});assert.doesNotMatch(JSON.stringify(block),/private_metadata|do not display/);}finally{globalThis.document=old;}});
test('navegação por aula tem nome acessível e IDs estáveis',()=>{const old=globalThis.document;globalThis.document=dom();try{const result=VCAcademicContent.renderLessons([1,2].map(n=>({lesson_version_id:`id-${n}`,title:`Aula ${n}`,learning_objectives:[],blocks:[]})));const nodes=flatten(result);assert.equal(nodes.find(n=>n.tag==='nav').attrs['aria-label'],'Aulas deste módulo');assert.equal(nodes.filter(n=>n.tag==='article')[1].id,'academic-lesson-id-2');}finally{globalThis.document=old;}});
