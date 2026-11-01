// Private candidate input only. This emitter intentionally has no COMMIT mode.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,stableId} from './universidade-curriculum-import.mjs';

export function numberedHeadings(text){
 return [...text.matchAll(/^#{1,6}\s+(\d[^\n]*)$/gm)].map(m=>m[1]);
}
export function validateCandidates(rows,readText,parents,expectedFunctional){
 if(rows.length!==50||new Set(rows.map(r=>r.code)).size!==50)throw Error('candidate_count_invalid');
 return rows.map(r=>{
  if(!/^IE-M(0[1-9]|10)-A0[1-5]$/.test(r.code)||r.parent_revision!==2||r.persisted!==false||r.academic_approval!==false)throw Error('candidate_scope_invalid');
  const parent=parents.find(p=>p.code===r.code),text=readText(r.code);
  if(!parent||r.parent_sha256!==parent.source_sha256||hash(text)!==r.candidate_sha256||Buffer.byteLength(text)!==r.bytes)throw Error('candidate_hash_mismatch');
  const expected=expectedFunctional.filter(x=>x.code===r.code).map(x=>x.rev2_heading);
  if(JSON.stringify(numberedHeadings(text))!==JSON.stringify(expected))throw Error('functional_numbering_changed');
  return {code:r.code,parent_lesson_version_id:parent.lesson_version_id,parent_hash:parent.source_sha256,
   candidate_sha256:r.candidate_sha256,title:parent.title,text,
   lesson_version_id:stableId('f01-dryrun-lesson:'+r.code+':'+r.candidate_sha256),
   content_block_id:stableId('f01-dryrun-block:'+r.code+':'+r.candidate_sha256)};
 });
}
export function candidateDryrunSql(lessons){
 const payload=JSON.stringify(lessons);
 if(['$f01$','$f01_data$'].some(x=>payload.includes(x)))throw Error('sql_delimiter_in_candidate');
 return readFileSync(new URL('./universidade-curriculum-candidate-dryrun.sql',import.meta.url),'utf8')
  .replace('/*CANDIDATES*/',()=>`$f01_data$${payload}$f01_data$::jsonb`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length!==1||args[0].startsWith('--'))throw Error('Use a private candidate directory; output always rolls back');
 const root=resolve(args[0]);
 const audit=JSON.parse(readFileSync(new URL('../audits/ie-curriculum-f01-audit.json',import.meta.url)));
 const bytes=readFileSync(resolve(root,'MANIFESTO_CANDIDATAS_F01.json'));
 const functionalBytes=readFileSync(resolve(root,'NUMERACAO_FUNCIONAL_VERIFICADA.json'));
 if(hash(bytes)!==audit.manifest_sha256||hash(functionalBytes)!==audit.functional_inventory_sha256)throw Error('candidate_package_not_recognized');
 const parents=JSON.parse(readFileSync(new URL('../audits/ie-curriculum-sanitization.v2.json',import.meta.url))).lesson_revisions;
 const plan=validateCandidates(JSON.parse(bytes),code=>readFileSync(resolve(root,'AULAS_CANDIDATAS',code+'.CANDIDATA_REV3.md'),'utf8'),parents,JSON.parse(functionalBytes));
 process.stdout.write(candidateDryrunSql(plan));
}
