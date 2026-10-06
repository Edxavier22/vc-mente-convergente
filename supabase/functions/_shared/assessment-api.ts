type Database=(table:string,query?:string,options?:RequestInit)=>Promise<any>;
export async function assessmentBegin(db:Database,actor:string,enrollment:string,purpose:string,module:number|null){
 return db("rpc/vc_university_assessment_begin","",{method:"POST",body:JSON.stringify({p_actor:actor,p_enrollment:enrollment,p_purpose:purpose,p_module:module})});
}
export async function assessmentSubmit(db:Database,actor:string,enrollment:string,input:any){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.session_id||"")||!Array.isArray(input.answers)) return {status:400,error:"answers_invalid"};
 return db("rpc/vc_university_assessment_submit","",{method:"POST",body:JSON.stringify({p_actor:actor,p_enrollment:enrollment,p_session:input.session_id,p_answers:input.answers})});
}
// Only call after owner or course-assigned teacher preview authorization.
export async function assessmentBank(db:Database,course:string,version:string){
 const questions=await db("vc_university_questions","?select=question_id,editorial_id,question_key,question_version,purpose,module_no,module_version_id,kind,prompt,correct_option_id,correct_feedback,review_concept,competency_id,difficulty,status,movement,editorial_gap&course_id=eq."+encodeURIComponent(course)+"&course_version=eq."+encodeURIComponent(version)+"&editorial_id=not.is.null&order=editorial_id.asc,question_version.desc&limit=1000");
 if(!questions.length)return [];
 const ids=questions.map((q:any)=>q.question_id).join(",");
 const [options,competencies,sources]=await Promise.all([
  db("vc_university_question_options","?select=question_id,option_id,option_order,option_text,feedback&question_id=in.("+ids+")&order=option_order.asc&limit=4000"),
  db("vc_university_competencies","?select=competency_id,code,title&limit=1000"),
  db("vc_university_source_links","?select=question_id,source_id,relationship,vc_university_sources(title,citation,editorial_classification,status)&question_id=in.("+ids+")&limit=4000")
 ]);
 for(const q of questions){
  q.options=options.filter((o:any)=>o.question_id===q.question_id);
  q.competency=competencies.find((c:any)=>c.competency_id===q.competency_id);
  q.sources=sources.filter((s:any)=>s.question_id===q.question_id);
 }
 return questions;
}
