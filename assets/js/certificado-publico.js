const CERT_ROOT="https://ctzgsxxbyvruzmfqibnl.supabase.co/functions/v1/vc-certificado-publico";
const form=document.querySelector("#validation-form");
const input=document.querySelector("#certificate-code");
const result=document.querySelector("#validation-result");
const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node};
function showError(message){result.className="validation-result is-error";result.replaceChildren(text("strong","Certificado não confirmado"),text("p",message))}
async function validate(code){
 result.className="validation-result is-loading";result.replaceChildren(text("span",""),text("p","Consultando o registro oficial…"));
 try{
  const response=await fetch(`${CERT_ROOT}?codigo=${encodeURIComponent(code)}`,{cache:"no-store"});const data=await response.json().catch(()=>({}));
  if(response.status===404){showError("Código não encontrado. Confira todos os caracteres e tente novamente.");return}
  if(!response.ok)throw Error("service_unavailable");
  if(!data.valid){result.className="validation-result is-revoked";result.replaceChildren(text("strong","Certificado revogado"),text("p","Este código existe, mas sua validade foi revogada pelo emissor."));return}
  const dl=document.createElement("dl");[["Nome",data.learnerName],["Formação",data.course],["Carga horária",`${data.hours} horas`],["Conclusão",new Date(`${data.completionDate}T12:00:00`).toLocaleDateString("pt-BR")],["Emissor",data.issuer],["Código",data.code]].forEach(([label,value])=>{dl.append(text("dt",label),text("dd",value))});
  result.className="validation-result is-valid";result.replaceChildren(text("span","✓","validation-seal"),text("strong","Certificado autêntico"),text("p","O registro foi localizado na base oficial da Universidade V&C."),dl)
 }catch{showError("O serviço de validação está temporariamente indisponível. Tente novamente em alguns instantes.")}
}
form.addEventListener("submit",event=>{event.preventDefault();const code=input.value.trim().toUpperCase();if(!/^VC-[A-Z0-9]{2,8}-\d{4}-\d{6}$/.test(code)){showError("Use o formato completo, por exemplo: VC-LEA-2026-000127.");return}input.value=code;const url=new URL(location.href);url.searchParams.set("codigo",code);history.replaceState(null,"",url);validate(code)});
const initial=new URLSearchParams(location.search).get("codigo");if(initial){input.value=initial.toUpperCase();form.requestSubmit()}
