"use strict";
const fixture=document.querySelector("#assessment-fixture");
const questions=n=>Array.from({length:n},(_,i)=>({question_id:"fixture-"+i,editorial_id:"QA-"+i,question_version:1,status:"draft",difficulty:"N2",competency_code:"C1",prompt:`Fixture técnica ${i+1}: escolha uma alternativa para testar envio, feedback e retry.`,review_concept:"Fluxo técnico",correct_option_id:"fixture-"+i+"-ok",correct_feedback:"Alternativa técnica correta; feedback exibido após o envio.",options:[{option_id:"fixture-"+i+"-ok",option_text:"Alternativa técnica correta",feedback:"Alternativa técnica correta."},{option_id:"fixture-"+i+"-1",option_text:"Distrator técnico um",feedback:"Revise o princípio da fixture técnica; este é um distrator."},{option_id:"fixture-"+i+"-2",option_text:"Distrator técnico dois",feedback:"Este distrator permite verificar feedback específico."},{option_id:"fixture-"+i+"-3",option_text:"Distrator técnico três",feedback:"Retorne à fixture para testar outra tentativa."}]}));
document.querySelector("#checkpoint").onclick=()=>fixture.replaceChildren(VCAssessment.preview(questions(5),70));
document.querySelector("#final").onclick=()=>fixture.replaceChildren(VCAssessment.preview(questions(20),70));
document.querySelector("#master").onclick=()=>fixture.replaceChildren(VCAssessment.master(questions(5)));
document.querySelector("#mobile").onchange=e=>fixture.style.maxWidth=e.target.checked?"390px":"48rem";
document.querySelector("#checkpoint").click();
