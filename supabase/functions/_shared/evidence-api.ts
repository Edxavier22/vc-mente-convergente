type Database = (table: string, query?: string, options?: RequestInit) => Promise<any>;
export async function evidenceDefinitions(db: Database,course: string,version: string,preview=false) {
 const definitions=await db('vc_university_evidence_definitions','?select=evidence_definition_id,evidence_key,module_id&course_id=eq.'+encodeURIComponent(course));
 const modules=await db('vc_university_modules','?select=module_id,module_no&course_id=eq.'+encodeURIComponent(course));
 const versions=await db('vc_university_evidence_definition_versions','?select=*&course_id=eq.'+encodeURIComponent(course)+'&course_version=eq.'+encodeURIComponent(version)+'&status='+ (preview?'in.(draft,review,published)':'eq.published')+'&order=revision.desc');
 return versions.map((v:any)=>{const d=definitions.find((item:any)=>item.evidence_definition_id===v.evidence_definition_id);return {...v,evidence_key:d?.evidence_key,module_no:modules.find((m:any)=>m.module_id===d?.module_id)?.module_no}});
}
export async function evidenceRead(db: Database,course: string,version: string,enrollment: string,moduleNo: number) {
 const definitions=await evidenceDefinitions(db,course,version);
 const definition=definitions.find((d:any)=>d.module_no===moduleNo);
 if(!definition)return {error:'evidence_definition_unavailable'};
 const rows=await db('vc_university_evidence_submissions','?select=*&enrollment_id=eq.'+enrollment+'&evidence_definition_version_id=eq.'+definition.evidence_definition_version_id+'&limit=1');
 const submission=rows[0]||null;
 const revisions=submission?await db('vc_university_evidence_revisions','?select=evidence_revision_id,revision,created_at&submission_id=eq.'+submission.submission_id+'&order=revision.desc'):[];
 const reviews=submission?await db('vc_university_evidence_reviews','?select=evidence_revision_id,decision,feedback,created_at&submission_id=eq.'+submission.submission_id+'&order=created_at.desc'):[];
 return {definition,submission,revisions,reviews};
}
export async function evidenceWrite(db: Database,user: string,enrollment: string,module: string,input: any) {
 if(!['evidence_draft','evidence_submit'].includes(input?.action)||!Number.isInteger(input.expected_version)||input.expected_version<0||!input.payload||Array.isArray(input.payload)||typeof input.payload!=='object'||new TextEncoder().encode(JSON.stringify(input.payload)).byteLength>65536)
 return {error:'invalid_evidence_request',status:400};
 if(input.action==='evidence_submit' && (!input.privacy_confirmed||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.request_id||'')))return {error:'privacy_and_request_id_required',status:400};
 try{return await db('rpc/vc_university_evidence_write','',{method:'POST',body:JSON.stringify({p_actor:user,p_enrollment:enrollment,p_module:module,p_action:input.action==='evidence_draft'?'draft':'submit',p_payload:input.payload,p_expected_version:input.expected_version,p_request_id:input.request_id||null})})}
 catch(error){const message=error instanceof Error?error.message:'';const code=['draft_version_conflict','submission_locked','idempotency_payload_conflict','previous_module_required','evidence_structure_invalid','evidence_context_denied','evidence_definition_unavailable'].find(c=>message.includes(c));if(code)return {error:code,status:code==='evidence_structure_invalid'?422:409};throw error}
}
