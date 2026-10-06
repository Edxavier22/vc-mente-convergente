(function () {
 "use strict";
 const make = (tag, text) => {const node=document.createElement(tag);if(text)node.textContent=text;return node};
 function appendValue(parent,value) {
  if(typeof value==="string" || typeof value==="number") {parent.append(make("p",String(value)));return}
  if(Array.isArray(value)){const list=make("ul");value.forEach(item=>{const li=make("li");appendValue(li,item);list.append(li)});parent.append(list);return}
  if(value && typeof value==="object") {
   for(const [key,item] of Object.entries(value)) {
    if(["url","href","src","html"].includes(key))continue;
    if(key==="title")parent.append(make("h3",String(item)));
    else appendValue(parent,item);
   }
  }
 }
 function renderBlock(block) {
  const section=make("section");section.className="pedagogy-block";
  section.dataset.blockType=block.block_type;
  appendValue(section,block.content);
  const raw=block.content?.url || block.content?.href || block.content?.src;
  if(typeof raw==="string") {
   try {const url=new URL(raw,location.origin);if(["https:","http:"].includes(url.protocol)) {
    const link=make("a",block.block_type==="download"?"Abrir material":"Consultar recurso");
    link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";section.append(link);
   }} catch { /* Um recurso inválido não impede a leitura do bloco. */ }
  }
  return section;
 }
 function renderLessons(lessons) {
  const section=make("section");section.className="lesson-section";
  if(!lessons.length)section.append(make("p","Conteúdo acadêmico ainda não importado."));
  lessons.forEach(lesson=>{const article=make("article");article.append(make("h2",lesson.title));
   appendValue(article,lesson.learning_objectives);
   (lesson.blocks||[]).forEach(block=>article.append(renderBlock(block)));section.append(article);
  });return section;
 }
 globalThis.VCAcademicContent={renderBlock,renderLessons};
})();
