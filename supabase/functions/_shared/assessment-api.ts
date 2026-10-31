import {gradeStableCheckpoint} from './academic-engine.ts';
type Database=(table:string,query?:string,options?:RequestInit)=>Promise<any>;
// Historical revisions remain available to the editor; each simulated instrument uses one revision per ID.
export function assessmentPreviewBank(bank:any[],perspective:string){
 if(perspective==='content_master')return bank;
 const latest=new Map<string,any>();
 for(const q of bank.filter(q=>q.status!=='archived')){
  const key=q.editorial_id||q.question_key||q.question_id;
  if(!latest.has(key)||latest.get(key).question_version<q.question_version)latest.set(key,q);
 }
 const chosen=[...latest.values()];
 if(perspective!=='student')return chosen;
 return chosen.map(q=>({question_id:q.question_id,editorial_id:q.editorial_id,question_version:q.question_version,
  purpose:q.purpose,module_no:q.module_no,prompt:q.prompt,status:q.status,
  options:q.options.map((o:any)=>({id:o.option_id,text:o.option_text}))}));
}
export function assessmentPreviewGrade(bank:any[],input:any){
 if(!['checkpoint','final'].includes(input?.purpose)||!Array.isArray(input.answers))throw Error('answers_invalid');
 const count=input.purpose==='checkpoint'?5:20;
 if(input.purpose==='checkpoint'&&(!Number.isInteger(input.module)||input.module<1||input.module>10))throw Error('answers_invalid');
 const available=assessmentPreviewBank(bank,'teacher').filter(q=>q.purpose===input.purpose&&(input.purpose==='final'||q.module_no===input.module));
 if(available.length!==count||input.answers.length!==count||new Set(input.answers.map((a:any)=>a.question_id)).size!==count)throw Error('answers_invalid');
 const questions=input.answers.map((a:any)=>available.find(q=>q.question_id===a.question_id));
 if(questions.some((q:any)=>!q))throw Error('answers_invalid');
 const grade=gradeStableCheckpoint(questions,input.answers.map((a:any)=>a.selected_option_id),70);
 return {preview:true,persisted:false,...grade,details:undefined,
  feedback:grade.details.map((d:any)=>({questionId:d.question_id,correct:d.correct,message:d.feedback})),
  review:[...new Set(grade.details.filter((d:any)=>!d.correct).map((d:any)=>questions.find((q:any)=>q.question_id===d.question_id).review_concept))],retryAllowed:true};
}
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
