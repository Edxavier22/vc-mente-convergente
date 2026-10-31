// Source Markdown is data only. This tool emits SQL; it never connects to a database.
import {createHash} from 'node:crypto';
import {readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const COURSE='inteligencia-emocional-aplicada';
export const OWNER='70aa4d75-bbb9-4839-aad8-670b7654664d';
export const PACKAGE_SHA='5a67583fa4a7fa3102c41e54d99f342b1647bb4aa272990d3b4f32342a176867';
export const MANIFEST_SHA='305350cf8c0da29af19272dee1a553f2f3b0ca1feb3e6c18c7fbdaebade58d15';
const PROPOSAL_SHA='7ddcc928046bdfe5241d357c879d5eaa307133042d6603dbc19c8ace080ab34b';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function stableId(key){
 const h=createHash('sha1').update('university-ie-curriculum-v1:'+key).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export function csvRows(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(field);field='';}
  else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
  else field+=c;
 }
 if(quoted)throw Error('manifest_csv_invalid');
 if(field||row.length){row.push(field);rows.push(row);}
 const headers=rows.shift().map(x=>x.replace(/^\uFEFF/,''));
 return rows.filter(r=>r.length>1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
}
function sourceTitle(text){
 const title=text.match(/^##\s+Aula\s+\d+\s*[—:–-]\s*(.+)$/mi)?.[1] ??
  text.match(/^#\s+(?:Módulo\s+\d+\s*[—–-]\s*)?Aula\s+\d+\s*[—:–-]\s*(.+)$/mi)?.[1];
 if(!title?.trim())throw Error('lesson_title_missing');
 return title.trim();
}
export function validatePackage(root,{manifestSha=MANIFEST_SHA}={}){
 root=realpathSync(root);
 const inside=path=>{const p=realpathSync(resolve(root,path));if(!p.startsWith(root+sep))throw Error('source_path_outside_package');return p;};
 const manifest=readFileSync(inside('manifestos/aulas.json'));
 if(hash(manifest)!==manifestSha)throw Error('package_manifest_not_recognized');
 const entries=JSON.parse(manifest);
 const csv=csvRows(readFileSync(inside('manifestos/inventario_50_aulas.csv'),'utf8'));
 const alerts=JSON.parse(readFileSync(inside('manifestos/alertas_editoriais.json'),'utf8'));
 const staging=JSON.parse(readFileSync(inside('manifestos/STAGING_NAO_EXECUTAVEL.json'),'utf8'));
 if(entries.length!==50||csv.length!==50||staging.lessons?.length!==50||alerts.length)throw Error('package_count_or_editorial_alerts');
 if(staging.course_slug!==COURSE||staging.course_version!=='1.0')throw Error('package_course_version_invalid');
 const seen=new Set(),digests=new Set();
 const lessons=entries.map(e=>{
  const expected=`IE-M${String(e.module_no).padStart(2,'0')}-A${String(e.lesson_no).padStart(2,'0')}`;
  if(e.lesson_code!==expected||e.module_no<1||e.module_no>10||e.lesson_no<1||e.lesson_no>5||seen.has(expected))throw Error('lesson_identity_invalid');
  seen.add(expected);
  if(e.target_file!==`aulas/MODULO_${String(e.module_no).padStart(2,'0')}/${expected}.md`)throw Error('source_path_invalid');
  const c=csv.find(r=>r.lesson_code===expected),st=staging.lessons.find(r=>r.editorial_id===expected);
  const bytes=readFileSync(inside(e.target_file));const digest=hash(bytes);
  if(!c||!st||digest!==e.sha256||digest!==c.sha256||digest!==st.sha256||bytes.length!==e.bytes||bytes.length!==Number(c.bytes))throw Error('source_hash_or_manifest_mismatch');
  if(Number(e.risk_flags)!==0||Number(c.risk_flags)!==0)throw Error('source_risk_requires_review');
  if(digests.has(digest))throw Error('duplicate_lesson_content');digests.add(digest);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  // Fail closed on teacher-only sections. Do not silently cut or summarize originals.
  if(/^#{1,6}\s+.*(?:gabarito|respostas?\s+corretas?|rubrica|uso\s+(?:interno|exclusivo)|manual\s+do\s+professor)/im.test(text))throw Error('private_material_requires_separation');
  const title=sourceTitle(text);
  const objectives=[...text.matchAll(/^#{1,6}\s+.*(?:objetivos?|competências?)\s*\n+([^#]+?)(?=\n#{1,6}\s|$)/gim)].map(m=>m[1].trim());
  return {code:expected,key:expected.toLowerCase(),module_no:e.module_no,lesson_no:e.lesson_no,title,
   lesson_id:stableId('lesson:'+expected),lesson_version_id:stableId('lesson-version:1:'+expected),
   content_block_id:stableId('block:1:'+expected),estimated_minutes:24,learning_objectives:objectives,
   content:{format:'markdown',text,provenance:{package_sha256:PACKAGE_SHA,source_sha256:digest,source_path:e.target_file,lesson_code:expected}},
   source_sha256:digest,source_bytes:bytes.length,words:text.match(/\S+/g)?.length??0,
   headings:(text.match(/^#{1,6}\s+.+$/gm)||[]).length,
   evidence_mentions:[...new Set(text.match(/\bE(?:0[1-9]|10)\b/g)||[])],
   gaps:['Homologação acadêmica e bibliografia pendentes; importação técnica não aprova o material.','Distribuição de 24 minutos por aula é técnica e precisa de homologação.']};
 }).sort((a,b)=>a.module_no-b.module_no||a.lesson_no-b.lesson_no);
 for(let n=1;n<=10;n++)if(lessons.filter(l=>l.module_no===n).length!==5)throw Error('module_lesson_count_invalid');
 const references=csvRows(readFileSync(inside('manifestos/referencias_a_verificar.csv'),'utf8'));
 return {package_sha256:PACKAGE_SHA,course_id:COURSE,course_version:'1.0',source_id:stableId('editorial-package:'+PACKAGE_SHA),lessons,
  summary:{lessons:50,modules:10,words:lessons.reduce((n,l)=>n+l.words,0),references:references.length,editorial_approval:false},references};
}
export function questionProposals(root){
 const bytes=readFileSync(resolve(root,'avaliacoes/PROPOSTA_6_QUESTOES.md'));
 if(hash(bytes)!==PROPOSAL_SHA)throw Error('question_proposal_not_recognized');
 const originals=JSON.parse(readFileSync(new URL('../supabase/seed-data/ie-assessment-bank.v1.json',import.meta.url),'utf8')).questions;
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const proposals=[...text.matchAll(/^### (IE-M\d{2}-Q\d{2})[^\n]*\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)].map(([,id,body])=>{
  const old=originals.find(q=>q.editorial_id===id);if(!old)throw Error('proposal_question_unknown');
  const options=[...body.matchAll(/^- \*\*([A-D])\*\*\s*(\(correta\))?\s*(.+)$/gm)].map((m,i)=>({option_id:stableId('question-v2:'+id+':'+m[1]),option_order:i,option_text:m[3].trim(),is_correct:Boolean(m[2]),feedback:null}));
  if(options.length!==4||new Set(options.map(o=>o.option_order)).size!==4||options.filter(o=>o.is_correct).length!==1)throw Error('proposal_options_invalid');
  return {editorial_id:id,question_id:stableId('question-v2:'+id),question_key:old.question_key,question_version:2,original_id:old.question_id,original_prompt:old.prompt,original_correct_option_id:old.correct_option_id,
   prompt:body.slice(0,body.indexOf('- **A**')).trim(),options,correct_option_id:options.find(o=>o.is_correct).option_id,
   editorial_gap:'Proposta PR17 não homologada: validar competência, dificuldade, rubrica e feedback específico das quatro alternativas; bibliografia pendente.'};
 });
 if(proposals.length!==6||new Set(proposals.map(q=>q.editorial_id)).size!==6)throw Error('proposal_count_invalid');
 return proposals;
}
export function mapping(plan){return {...plan,references:plan.references.map(r=>({...r,url:r.url?.split('?')[0].split(/%3Bjsessionid/i)[0],original_url_sha256:r.url?hash(r.url):undefined})),questions:plan.questions?.map(q=>({editorial_id:q.editorial_id,question_id:q.question_id,question_version:2,status:'draft',active:false,gap:q.editorial_gap})),lessons:plan.lessons.map(({content,learning_objectives,...metadata})=>metadata)};}
export function importSql(plan,{commit=false}={}){
 const payload=JSON.stringify(plan);if(['$curriculum_payload$','$import$'].some(d=>payload.includes(d)))throw Error('sql_delimiter_in_source');
 const template=readFileSync(new URL('./universidade-curriculum-import.sql',import.meta.url),'utf8');
 return template.replace('/*PAYLOAD*/',()=>`$curriculum_payload$${payload}$curriculum_payload$::jsonb`).replace('/*END_TRANSACTION*/',commit?'commit;':'rollback;');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);const source=args[args.indexOf('--source')+1];
 if(!args.includes('--source')||!source)throw Error('Use --source <extracted-package> [--sql <private-output.sql>] [--commit] [--mapping <report.json>]');
 const plan=validatePackage(source);
 plan.questions=questionProposals(source);
 plan.summary.question_candidates=plan.questions.length;
 if(args.includes('--mapping'))writeFileSync(args[args.indexOf('--mapping')+1],JSON.stringify(mapping(plan),null,2)+'\n');
 if(args.includes('--sql'))writeFileSync(args[args.indexOf('--sql')+1],importSql(plan,{commit:args.includes('--commit')}),{mode:0o600});
 process.stdout.write(JSON.stringify(plan.summary)+'\n');
}
