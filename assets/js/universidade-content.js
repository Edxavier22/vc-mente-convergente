(function () {
 "use strict";
 const make = (tag, text) => {const node=document.createElement(tag);if(text)node.textContent=text;return node};
 function inline(parent,text,depth=0){
  if(depth>5){parent.append(document.createTextNode(text));return;}
  // All text uses DOM text nodes. Raw HTML and image markup are never interpreted.
  const token=/\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|`([^`\n]+)`|\*([^*\n]+)\*/g;
  let start=0,m;
  while((m=token.exec(text))){
   parent.append(document.createTextNode(text.slice(start,m.index)));
   if(m[1]){
    let url;try{url=new URL(m[2],location.origin);}catch{url=null;}
    if(url&&['https:','http:'].includes(url.protocol)){
     const a=make('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';inline(a,m[1],depth+1);parent.append(a);
    }else parent.append(document.createTextNode(m[0]));
   }else {const child=make(m[3]?'strong':m[4]?'code':'em');inline(child,m[3]||m[4]||m[5],depth+1);parent.append(child);}
   start=token.lastIndex;
  }
  parent.append(document.createTextNode(text.slice(start)));
 }
 function renderMarkdown(text){
  const root=make('div');root.className='academic-markdown';
  const lines=String(text).replace(/\r\n/g,'\n').split('\n');let i=0;
  const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());
  const special=line=>/^\s*(?:#{1,6}\s|>|[-*+]\s|\d+\.\s|```|---\s*$)/.test(line);
  while(i<lines.length){
   const line=lines[i];if(!line.trim()){i++;continue;}
   if(/^```/.test(line)){const pre=make('pre'),code=make('code');let value=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))value.push(lines[i++]);code.textContent=value.join('\n');pre.append(code);root.append(pre);i++;continue;}
   const h=line.match(/^(#{1,6})\s+(.+)$/);if(h){const node=make('h'+Math.min(6,h[1].length+2));inline(node,h[2]);root.append(node);i++;continue;}
   if(/^\s*(?:---+|\*\*\*+)\s*$/.test(line)){root.append(make('hr'));i++;continue;}
   if(i+1<lines.length&&line.includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){
    const wrap=make('div');wrap.className='academic-table-scroll';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Tabela da aula; deslize para consultar todas as colunas');
    const table=make('table'),head=make('thead'),row=make('tr');
    cells(line).forEach(value=>{const th=make('th');th.scope='col';inline(th,value);row.append(th);});head.append(row);table.append(head);i+=2;
    const body=make('tbody');while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){const tr=make('tr');cells(lines[i++]).forEach(value=>{const td=make('td');inline(td,value);tr.append(td);});body.append(tr);}table.append(body);wrap.append(table);root.append(wrap);continue;
   }
   if(/^\s*>/.test(line)){const quote=make('blockquote');while(i<lines.length&&/^\s*>/.test(lines[i])){const p=make('p');inline(p,lines[i++].replace(/^\s*>\s?/,''));quote.append(p);}root.append(quote);continue;}
   const li=line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);if(li){const list=make(li[2]?'ol':'ul');if(li[2])list.start=Number(li[2]);while(i<lines.length){const m=lines[i].match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);if(!m||Boolean(m[2])!==Boolean(li[2]))break;const item=make('li');inline(item,m[3]);list.append(item);i++;}root.append(list);continue;}
   const paragraph=[line];i++;while(i<lines.length&&lines[i].trim()&&!special(lines[i])&&!(i+1<lines.length&&lines[i].includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])))paragraph.push(lines[i++]);
   const p=make('p');inline(p,paragraph.join('\n'));root.append(p);
  }
  return root;
 }
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
  if(block.content?.format==='markdown'&&typeof block.content.text==='string')section.append(renderMarkdown(block.content.text));
  else appendValue(section,block.content);
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
  if(lessons.length>1){const nav=make('nav');nav.className='academic-lesson-nav';nav.setAttribute('aria-label','Aulas deste módulo');const list=make('ol');lessons.forEach((lesson,index)=>{const li=make('li'),a=make('a',lesson.title);a.href='#academic-lesson-'+String(lesson.lesson_version_id||index).replace(/[^a-zA-Z0-9-]/g,'');li.append(a);list.append(li);});nav.append(list);section.append(nav);}
  lessons.forEach((lesson,index)=>{const article=make("article");article.id='academic-lesson-'+String(lesson.lesson_version_id||index).replace(/[^a-zA-Z0-9-]/g,'');article.className='academic-lesson';article.append(make("h2",lesson.title));
   appendValue(article,lesson.learning_objectives);
   (lesson.blocks||[]).forEach(block=>article.append(renderBlock(block)));section.append(article);
  });return section;
 }
 globalThis.VCAcademicContent={renderBlock,renderLessons,renderMarkdown};
})();
