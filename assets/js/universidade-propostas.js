const ROOT="https://ctzgsxxbyvruzmfqibnl.supabase.co";
const KEY="sb_publishable_rF60SyuGpNstim9MqFvqmQ_sSm78z1b";
const form=document.querySelector("#enterprise-proposal-form");
const status=document.querySelector("#proposal-form-status");
const submit=form?.querySelector('button[type="submit"]');

function requestId(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
}
function show(message,state=""){
  status.textContent=message;status.hidden=false;status.className="enterprise-form-status"+(state?` is-${state}`:"");
  status.focus();
}

form?.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  submit.disabled=true;form.setAttribute("aria-busy","true");show("Enviando sua solicitação com segurança…");
  const data=new FormData(form);
  const payload=Object.fromEntries(data.entries());
  payload.request_id=form.dataset.requestId||requestId();form.dataset.requestId=payload.request_id;
  payload.consent=data.get("consent")==="yes";
  payload.source_path=location.pathname;
  try{
    const response=await fetch(`${ROOT}/functions/v1/vc-universidade-propostas`,{method:"POST",headers:{apikey:KEY,"content-type":"application/json",accept:"application/json"},body:JSON.stringify(payload),cache:"no-store"});
    const result=await response.json().catch(()=>({}));
    if(response.status===429)throw new Error("rate_limited");
    if(!response.ok)throw new Error(result.error||"service_unavailable");
    form.reset();delete form.dataset.requestId;
    show(`Solicitação recebida. Guarde o protocolo ${result.reference}. A equipe V&C entrará em contato pelos dados informados.`,"success");
  }catch(error){
    show(error.message==="rate_limited"?"Foram feitas muitas tentativas neste dispositivo. Aguarde uma hora e tente novamente.":"Não foi possível registrar a solicitação agora. Tente novamente ou escreva para vcmenteconvergente@gmail.com.","error");
  }finally{submit.disabled=false;form.removeAttribute("aria-busy")}
});
