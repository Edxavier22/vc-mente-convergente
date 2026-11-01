import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../scripts/universidade-curriculum-import.mjs';
import {numberedHeadings,validateCandidates,candidateDryrunSql} from '../scripts/universidade-curriculum-candidate-dryrun.mjs';
function fixture(){
 const text='# Módulo\n## Aula\n### Protocolo\n#### 1. PARE.\n#### 2. VERIFIQUE.\n### 28 ITENS\n',rows=[],parents=[],functional=[];
 for(let m=1;m<=10;m++)for(let a=1;a<=5;a++){
  const code=`IE-M${String(m).padStart(2,'0')}-A0${a}`;rows.push({code,parent_revision:2,parent_sha256:'parent',candidate_sha256:hash(text),bytes:Buffer.byteLength(text),persisted:false,academic_approval:false});
  parents.push({code,source_sha256:'parent',lesson_version_id:code,title:'Fixture'});
  for(const heading of numberedHeadings(text))functional.push({code,rev2_heading:heading});
 }return {text,rows,parents,functional};
}
test('candidatas validadas preservam passos e quantidades no texto',()=>{const f=fixture();assert.equal(validateCandidates(f.rows,()=>f.text,f.parents,f.functional).length,50);assert.deepEqual(numberedHeadings(f.text),['1. PARE.','2. VERIFIQUE.','28 ITENS']);});
test('número funcional removido é recusado mesmo com novo hash coerente',()=>{const f=fixture(),text=f.text.replace('1. PARE.','PARE.');f.rows.forEach(r=>{r.candidate_sha256=hash(text);r.bytes=Buffer.byteLength(text)});assert.throws(()=>validateCandidates(f.rows,()=>text,f.parents,f.functional),/functional_numbering_changed/);});
test('hash, bytes e pai adulterados são recusados',()=>{for(const key of ['parent_sha256','candidate_sha256','bytes']){const f=fixture();f.rows[0][key]='changed';assert.throws(()=>validateCandidates(f.rows,()=>f.text,f.parents,f.functional),/candidate_hash_mismatch/);}});
test('identidade duplicada e lote incompleto são recusados',()=>{const f=fixture();assert.throws(()=>validateCandidates(f.rows.slice(1),()=>f.text,f.parents,f.functional),/candidate_count_invalid/);f.rows[1].code=f.rows[0].code;assert.throws(()=>validateCandidates(f.rows,()=>f.text,f.parents,f.functional),/candidate_count_invalid/);});
test('aprovação ou persistência alegadas e versão pai incorreta são recusadas',()=>{for(const [key,value] of [['persisted',true],['academic_approval',true],['parent_revision',1]]){const f=fixture();f.rows[0][key]=value;assert.throws(()=>validateCandidates(f.rows,()=>f.text,f.parents,f.functional),/candidate_scope_invalid/);}});
test('emissor termina sempre em rollback e não toca banco de avaliações',()=>{const f=fixture(),sql=candidateDryrunSql(validateCandidates(f.rows,()=>f.text,f.parents,f.functional));assert.match(sql,/rollback;\s*$/);assert.match(sql,/for pass in 1\.\.2/);assert.doesNotMatch(sql,/\bcommit;|disable trigger|delete from|truncate|vc_university_questions|editorial_decide/i);});
test('delimitadores no texto privado não escapam do JSON SQL',()=>{for(const text of ['$f01$','$f01_data$'])assert.throws(()=>candidateDryrunSql([{text}]),/sql_delimiter_in_candidate/);});
