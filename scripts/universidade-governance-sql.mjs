// Emit SQL only. Execution uses the authenticated database connector, never credentials here.
import {readFileSync} from 'node:fs';
const mode=process.argv[2]||'editorial';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const names={editorial:'tests/universidade_governance_editorial_rls.sql',assessment:'tests/universidade_assessment_flow_rls.sql',evidence:'tests/universidade_evidence_flow_rls.sql',cycle:'tests/universidade_application_cycle_flow_rls.sql',foundation:'tests/universidade_foundation_rls.sql',progression:'tests/universidade_content_progression_rls.sql',leadership:'tests/universidade_content_progression_flow.sql',certification:'tests/universidade_assessment_flow_rls.sql'};
if(!names[mode])throw Error('unknown_suite');
let sql=read(names[mode]);
if(['assessment','evidence','cycle','certification'].includes(mode)){
 sql=sql.replace(/\bbegin;/i,match=>match+'\n'+read('tests/universidade_editorial_fixture.sql'));
 sql=sql.replace(/(^\s*)(update public\.vc_university_[^\n]*set status='published')/gm,'$1perform pg_temp.pr6_refresh_editorial_fixture();\n$1$2');
}
if(mode==='certification')sql=sql.replace(/set local role authenticated;/,()=>read('tests/universidade_governance_certification_rls.sql')+'\nset local role authenticated;');
process.stdout.write(sql);
