type Database = (table: string,query?: string,options?: RequestInit)=>Promise<any>;
export const cycleActions=['setup_draft','weekly_draft','final_draft','start','goal_revise','pause','resume','log','weekly_complete','final_complete','submit'];
export async function cycleDefinitions(db:Database,course:string,version:string,preview=false){
 return db('vc_university_application_cycle_versions','?select=configuration,status,cycle_version_id&course_id=eq.'+encodeURIComponent(course)+'&course_version=eq.'+encodeURIComponent(version)+'&status='+(preview?'in.(draft,review,published)':'eq.published'));
}
export async function cycleRead(db:Database,actor:string,enrollment:string){return db('rpc/vc_university_cycle_read','',{method:'POST',body:JSON.stringify({p_actor:actor,p_enrollment:enrollment})});}
export async function cycleWrite(db:Database,actor:string,enrollment:string,input:any){
 if(!cycleActions.includes(input.cycle_action)||!Number.isInteger(input.expected_version)||input.expected_version<0||!input.payload||Array.isArray(input.payload)||typeof input.payload!=='object'||new TextEncoder().encode(JSON.stringify(input.payload)).byteLength>65536)return {error:'invalid_cycle_request',status:400};
 if(!input.cycle_action.endsWith('_draft')&&!['pause','resume'].includes(input.cycle_action)&&! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.request_id||''))return {error:'cycle_request_id_required',status:400};
 return db('rpc/vc_university_cycle_write','',{method:'POST',body:JSON.stringify({p_actor:actor,p_enrollment:enrollment,p_action:input.cycle_action,p_payload:input.payload,p_expected_version:input.expected_version,p_request:input.request_id||null,p_key:input.entry_key||null})});
}
