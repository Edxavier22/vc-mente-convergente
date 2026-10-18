type Rpc = (name:string, body:Record<string,unknown>)=>Promise<any>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const governanceErrors=['editorial_scope_denied','owner_required','academic_scope_denied','teacher_scope_required','editorial_revision_conflict','editorial_metadata_invalid','editorial_transition_denied','editorial_gaps_or_sources_pending','editorial_content_changed','editorial_approval_required','ie_publication_disabled','published_material_immutable','draft_patch_invalid','assignment_invalid','material_not_found'];
export async function governanceRequest(rpc:Rpc,actor:string,method:string,input:any,course:string|null=null){
 if(course!==null&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(course))return {status:400,error:'invalid_course'};
 if(method==='GET')return rpc('vc_university_governance_read',{p_actor:actor,p_course:course});
 if(!input||typeof input!=='object'||Array.isArray(input)||new TextEncoder().encode(JSON.stringify(input)).byteLength>70000)return {status:422,error:'invalid_request'};
 if(input.action==='teacher_assignment'){
  if(!UUID.test(input.cohort_id)||!UUID.test(input.teacher_id)||!['assign','remove'].includes(input.operation)||typeof input.can_edit_academic!=='boolean')return {status:422,error:'assignment_invalid'};
  return rpc('vc_university_teacher_assignment',{p_actor:actor,p_cohort:input.cohort_id,p_teacher:input.teacher_id,p_action:input.operation,p_editor:input.can_edit_academic});
 }
 if(!['editorial_decision','save_draft'].includes(input.action)||typeof input.kind!=='string'||typeof input.material_id!=='string'||input.material_id.length>150||!Number.isInteger(input.expected_revision)||input.expected_revision<0)return {status:422,error:'invalid_request'};
 if(input.action==='save_draft')return rpc('vc_university_material_draft_save',{p_actor:actor,p_kind:input.kind,p_id:input.material_id,p_expected:input.expected_revision,p_patch:input.patch});
 if(!UUID.test(input.author_id)||typeof input.note!=='string'||input.note.trim().length<3||input.note.length>2000||!Array.isArray(input.gaps)||!input.gaps.every((g:any)=>typeof g==='string'&&g.length<=500)||!Array.isArray(input.source_ids)||!input.source_ids.every((s:any)=>UUID.test(s)))return {status:422,error:'editorial_metadata_invalid'};
 return rpc('vc_university_editorial_decide',{p_actor:actor,p_kind:input.kind,p_id:input.material_id,p_state:input.state,p_expected:input.expected_revision,p_author:input.author_id,p_note:input.note,p_gaps:input.gaps,p_sources:input.source_ids});
}
export async function certificationEligibility(rpc:Rpc,actor:string,enrollment:string){
 if(!UUID.test(enrollment))return {status:400,error:'invalid_enrollment'};
 return rpc('vc_university_certification_eligibility',{p_actor:actor,p_enrollment:enrollment});
}
