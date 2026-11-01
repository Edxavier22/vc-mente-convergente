// Prospective revisions only. Pedagogical amendments live in the private review bundle.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePackage,questionProposals,hash,stableId} from './universidade-curriculum-import.mjs';
export const AMENDMENTS_SHA='4b98edf63984c2f3557513562a42db860bc229f6de78fa1b7e71725476e5cd2b';
export const FEEDBACK_SHA='bff6bed1fc139916bf1e61a98fd0269b7001d88272c325b217384c504af3ed11';
export const competenceCodes={'IE-M01-Q03':'C2','IE-M02-Q05':'C1','IE-M04-Q05':'C3','IE-M07-Q03':'C4','IE-M08-Q04':'C7','IE-M10-Q01':'C7'};
export function activityText(a){
 for(const key of ['artifact','acceptance','formative_feedback','safety_limit','next_action'])if(typeof a[key]!=='string'||a[key].trim().length<25)throw Error('activity_component_missing');
 return `## Aplicação específica — ${a.code}\n\n**Artefato verificável:** ${a.artifact}\n\n**Condição de aceitação para autoinspeção:** ${a.acceptance}\n\n**Devolutiva para revisar o artefato:** ${a.formative_feedback}\n\n**Limite e segurança:** ${a.safety_limit}\n\n**Próxima ação:** ${a.next_action}\n`;
}
export function reviseLesson(original,a,body){
 const text=original.content.text;
 const markers=['## Aplicação prática da aula','### Prática de consolidação'];
 const cut=Math.max(...markers.map(m=>text.lastIndexOf(m)));
 if(cut<0||!text.slice(cut).includes('**Critério de conclusão:**'))throw Error('historical_closing_not_recognized');
 let prefix=text.slice(0,cut);
 if(a.code==='IE-M10-A05'){
  if(typeof body!=='string'||body.split(/\s+/).length<900)throw Error('integrative_lesson_insufficient');prefix=body.trim()+'\n\n---\n\n';
 }else if(a.code==='IE-M10-A03'){
  const old='## 24. AGORA COMEÇA O IE30';if(!prefix.includes(old))throw Error('ie30_title_not_recognized');
  prefix=prefix.replace(old,'## 24. IE30 em andamento: estruture seus indicadores e sua documentação\n\n**Regra institucional do percurso:** configuração após M7; início após M9 concluído e seus requisitos. O ciclo tem duração de 30 dias e janela operacional de 45 dias. Chegar ao M10 não inicia outro ciclo nem altera suas datas. E10 exige avaliação humana; prova e projeto são requisitos distintos. Confira os estados e prazos no ambiente acadêmico.');
 }
 const revised=prefix+activityText(a);
 if(a.code==='IE-M10-A05'&&/avance para o próximo módulo/i.test(revised))throw Error('final_module_continuity_invalid');
 return revised;
}
export function parseFeedback(text,proposals){
 const sections=[...text.matchAll(/^## (IE-M\d{2}-Q\d{2})\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
 if(sections.length!==6)throw Error('feedback_count_invalid');
 return sections.map(([,id,body])=>{
  const proposal=proposals.find(q=>q.editorial_id===id);if(!proposal)throw Error('feedback_question_unknown');
  const correct=body.match(/Gabarito recomendado:\*\*\s*([A-D])/i)?.[1];
  const answers=[...body.matchAll(/^- \*\*([A-D]):\*\*\s*(.+)$/gm)];
  if(answers.length!==4||answers.map(m=>m[1]).join('')!=='ABCD')throw Error('feedback_options_invalid');
  const options=proposal.options.map((o,i)=>({...o,feedback:answers[i][2].trim()}));
  if(options.some(o=>o.feedback.length<20)||options['ABCD'.indexOf(correct)]?.option_id!==proposal.correct_option_id)throw Error('feedback_answer_key_mismatch');
  return {...proposal,options,correct_feedback:options.find(o=>o.is_correct).feedback,expected_competency:competenceCodes[id],previous_editorial_gap:proposal.editorial_gap,
   editorial_gap:'Feedback contextual proposto recebido; homologação docente, pertinência dos distratores, competência e dificuldade ainda pendentes.'};
 });
}
export function buildSanitization(source,amendmentsPath,feedbackPath){
 const old=validatePackage(source);const bytes=readFileSync(amendmentsPath),fb=readFileSync(feedbackPath);
 if(hash(bytes)!==AMENDMENTS_SHA||hash(fb)!==FEEDBACK_SHA)throw Error('sanitization_source_hash_mismatch');
 const changes=JSON.parse(bytes);if(changes.activities.length!==50||new Set(changes.activities.map(a=>a.code)).size!==50)throw Error('amendment_count_invalid');
 const lessons=old.lessons.map(original=>{
  const a=changes.activities.find(a=>a.code===original.code);if(!a)throw Error('lesson_amendment_missing');
  const text=reviseLesson(original,a,changes.m10_a05_body),digest=hash(text);
  return {...original,parent_lesson_version_id:original.lesson_version_id,parent_block_id:original.content_block_id,parent_hash:original.source_sha256,
   lesson_version_id:stableId('lesson-version:2:'+original.code),content_block_id:stableId('block:2:'+original.code),revision:2,
   title:original.code==='IE-M10-A05'?'Projeto integrador E10: conferir, compartilhar e acompanhar a revisão':original.code==='IE-M10-A03'?'IE30 em andamento: indicadores e documentação':original.title,
   learning_objectives:[...original.learning_objectives,a.artifact],
   source_sha256:digest,parent_bytes:original.source_bytes,source_bytes:Buffer.byteLength(text),words:text.match(/\S+/g)?.length??0,
   headings:(text.match(/^#{1,6}\s+.+$/gm)||[]).length,evidence_mentions:[...new Set(text.match(/\bE(?:0[1-9]|10)\b/g)||[])],
   content:{format:'markdown',text,provenance:{lesson_code:original.code,source_sha256:digest,parent_source_sha256:original.source_sha256,
    original_package_sha256:old.package_sha256,amendments_sha256:AMENDMENTS_SHA,revision:2,hours_status:'technical_placeholder_not_measured',academic_status:'draft_not_approved'}},
   gaps:['Revisão de saneamento proposta; aceite acadêmico das atividades, exemplos, fontes e classificação de alegações pendente.','Carga horária técnica não aferida; piloto obrigatório antes de validar 20h.']};
 });
 return {course_id:old.course_id,course_version:old.course_version,amendments_sha256:AMENDMENTS_SHA,feedback_sha256:FEEDBACK_SHA,
  source_id:stableId('sanitization:'+AMENDMENTS_SHA),lessons,questions:parseFeedback(fb.toString('utf8'),questionProposals(source))};
}
export function sanitationSql(plan,{commit=false}={}){
 const payload=JSON.stringify(plan);if(['$sanitation$','$sanitation_data$'].some(d=>payload.includes(d)))throw Error('sql_delimiter_in_source');
 return readFileSync(new URL('./universidade-curriculum-sanitize.sql',import.meta.url),'utf8')
  .replace('/*PAYLOAD*/',()=>`$sanitation_data$${payload}$sanitation_data$::jsonb`).replace('/*END*/',commit?'commit;':'rollback;');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
 if(!['--source','--amendments','--feedback','--out'].every(k=>args.includes(k)))throw Error('Use --source --amendments --feedback --out [--commit]');
 const plan=buildSanitization(arg('--source'),arg('--amendments'),arg('--feedback'));const out=resolve(arg('--out'));mkdirSync(out,{recursive:true});
 writeFileSync(resolve(out,'sanitization.sql'),sanitationSql(plan,{commit:args.includes('--commit')}),{mode:0o600});
 const metadata={...plan,lessons:plan.lessons.map(({content,learning_objectives,gaps,...l})=>l),questions:plan.questions.map(q=>({editorial_id:q.editorial_id,question_version:2,expected_competency:q.expected_competency,status:'draft',active:false,feedback_count:q.options.length,academic_approval:false}))};
 writeFileSync(resolve(out,'manifesto_revisao2.json'),JSON.stringify(metadata,null,2)+'\n');
 for(const l of plan.lessons)writeFileSync(resolve(out,l.code+'.rev2.md'),l.content.text);
 writeFileSync(resolve(out,'questions_with_feedback.private.json'),JSON.stringify(plan.questions,null,2)+'\n',{mode:0o600});
 process.stdout.write(JSON.stringify({lesson_revisions:plan.lessons.length,question_feedbacks:plan.questions.length*4,words:plan.lessons.reduce((n,l)=>n+l.words,0),status:'draft'})+'\n');
}
