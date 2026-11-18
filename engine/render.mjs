import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {compile, themes, contain, estimateLines, geometryIssues, pageGeometry, figureChrome, makeEvidenceNotes, navigationLabel} from './core.mjs';
const require=createRequire(import.meta.url);
export async function artifactAPI() {
  const paths=[process.env.SPA_NODE_MODULES,path.resolve('.build/node_modules'),path.resolve('node_modules')].filter(Boolean);
  let entry;try{entry=require.resolve('@oai/artifact-tool',{paths});}catch{throw Error('Set SPA_NODE_MODULES to the bundled Node packages directory (see README).');}
  return import(pathToFileURL(entry).href);
}
export async function render(plan,dir) {
  const compiled=compile(plan),t=themes[plan.theme];
  const {Presentation,PresentationFile}=await artifactAPI();
  const p=Presentation.create({slideSize:{width:1280,height:720}});
  await fs.mkdir(dir,{recursive:true});
  for(const [i,s] of compiled.slides.entries()) {
    const slide=p.slides.add();slide.background.fill=t.paper;
    const shape=(name,r,fill='none',stroke='none',geometry='rect',dashed=false,radius)=>slide.shapes.add({name,geometry,...(radius!==undefined?{borderRadius:radius}:{}),position:{left:r.x,top:r.y,width:r.w,height:r.h},fill,line:{fill:stroke,width:stroke==='none'?0:1.4,style:dashed?'dashed':'solid'}});
    const text=(name,str,r,size=24,color=t.ink,bold=false,alignment='left')=>{
      const sh=shape(name,r);sh.text=str;sh.text.style={typeface:t.font,fontSize:size,color,bold,alignment,verticalAlignment:'top',autoFit:'none',wrap:'square',insets:0};return sh;
    };
    if(t.navigation==='side'){
      shape('theme-navigation',{x:0,y:0,w:108,h:720},t.accent);
      text('brand','SPA',{x:15,y:36,w:66,h:40},24,'#FFFFFF',true);
      const sections=[...new Set(plan.slides.map(x=>x.section))];
      const step=Math.min(150,500/sections.length);
      sections.slice(0,6).forEach((name,j)=>text(`navigation-${j}`,navigationLabel(name),{x:12,y:170+j*step,w:84,h:step-12},18,name===s.section?'#FFFFFF':'#A9BED2',name===s.section));
    }else{
      shape('theme-top-rule',{x:128,y:34,w:1096,h:5},t.accent);
      shape('theme-section-block',{x:38,y:53,w:60,h:60},t.accent);
      text('theme-section-number',String(i+1).padStart(2,'0'),{x:46,y:65,w:44,h:40},28,'#FFFFFF',true,'center');
    }
    const page=pageGeometry(s,plan.theme);
    text('slide-title',s.title,{x:128,y:page.titleY,w:1096,h:page.titleH},36,t.accent,true);
    shape('title-divider',{x:128,y:page.dividerY,w:1096,h:2},t.line);
    const {figures,blocks,arrows}=s.chosen.layout;
    if(s.slide_type==='author_background') {
      const three=s.author_profiles.length===3;
      for(const [j,profile] of (s.author_profiles??[]).entries()) {
        const x=three?128+j*374:170+j*548;
        const width=three?348:470;
        if(profile.portrait) {
          const bytes=await fs.readFile(profile.portrait);
          slide.images.add({name:`author-portrait-${j}`,blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:'image/jpeg',alt:profile.name,fit:'cover',position:{left:x+(width-270)/2,top:156,width:270,height:300}});
        }
        text(`author-name-${j}`,profile.name,{x,y:470,w:width,h:42},three?26:30,t.accent,true,'center');
        text(`author-role-${j}`,profile.role,{x,y:526,w:width,h:70},24,t.ink,false,'center');
      }
      text('author-institution',s.institution??'',{x:128,y:611,w:1096,h:36},24,t.accent,false,'center');
    } else {
    s.figures.forEach((f,j)=>{
      const r=figures[j];shape(`figure-frame-${j}`,r,'#FFFFFF',t.line,'roundRect',true);
      const chrome=figureChrome(f,r,plan.theme);
      shape(`figure-label-bg-${j}`,chrome.label,t.accent,'none',t.labelRadius?'roundRect':'rect',false,t.labelRadius);
      text(`figure-label-${j}`,f.label,chrome.text,22,'#FFFFFF',true,chrome.alignment);
      const fit=contain(f.aspect,chrome.image);
      shape(`image-slot-${j}`,fit,t.pale);
      const labels=f.evidence.map(id=>{const e=plan.evidence.find(x=>x.id===id);return `${e.figure} ${e.panel}`;}).join(' · ');
      const label=`${labels}\n${f.preserve.join('、')}`;
      const height=estimateLines(label,fit.w-20,20)*27+12;
      text(`image-instruction-${j}`,label,{x:fit.x+10,y:fit.y+Math.max(8,(fit.h-height)/2),w:fit.w-20,h:height},20,t.muted,false,'center');
    });
    s.blocks.forEach((b,j)=>{
      const r=blocks[j];shape(`explanation-card-${j}`,r,t.card,'none',t.cardRadius?'roundRect':'rect',false,t.cardRadius);
      const titleH=estimateLines(b.title,r.w,24)*31;
      text(`block-title-${j}`,b.title,{x:r.x+14,y:r.y+12,w:r.w-28,h:titleH},24,t.accent,true);
      text(`block-body-${j}`,b.text,{x:r.x+14,y:r.y+titleH+18,w:r.w-28,h:r.h-titleH-28},24);
    });
    arrows.forEach((r,j)=>shape(`relation-arrow-${j}`,r,t.accent,'none','rightArrow'));
    }
    const sources=[...new Set(s.evidence.map(id=>{const e=plan.evidence.find(x=>x.id===id);return `${e.source}: ${e.figure} ${e.panel}`;}))].join(' / ');
    text('source-footer',(plan.demo?'布局演示 · 非论文结果  |  ':'')+sources,{x:128,y:665,w:1000,h:30},16,t.muted);
    text('page-number',String(i+1).padStart(2,'0'),{x:1175,y:662,w:49,h:32},20,t.accent,true,'right');
    slide.speakerNotes.text=s.notes;
  }
  const draft=path.join(dir,'draft.pptx');
  await (await PresentationFile.exportPptx(p)).save(draft);
  // Round-trip the actual PPTX before producing previews, rather than previewing only the source scene.
  const {FileBlob}=await artifactAPI();
  const roundtrip=await PresentationFile.importPptx(await FileBlob.load(draft));
  const inspection=await roundtrip.inspect({kind:'slide,textbox,notes',maxChars:2000000});
  const rows=inspection.ndjson.split('\n').filter(Boolean).map(x=>JSON.parse(x));
  const auditErrors=[];
  if(roundtrip.slides.items.length!==compiled.slides.length)auditErrors.push('slide count changed after export');
  const normalize=x=>x.replace(/\s+/g,' ').trim();
  for(const [i,s] of compiled.slides.entries()){
    const notes=rows.find(x=>x.kind==='notes'&&x.slideIndex===i);
    if(!notes||normalize(notes.text)!==normalize(s.notes))auditErrors.push(`slide ${i+1}: notes changed or missing`);
    const texts=rows.filter(x=>x.kind==='textbox'&&x.slideIndex===i);
    const bounds=texts.map(x=>({x:x.position.left,y:x.position.top,w:x.position.width,h:x.position.height}));
    auditErrors.push(...geometryIssues(bounds).map(e=>`slide ${i+1}: exported text ${e}`));
    if(!texts.some(x=>x.name==='slide-title'&&x.text===s.title))auditErrors.push(`slide ${i+1}: editable title missing`);
  }
  await fs.writeFile(path.join(dir,'render-audit.json'),JSON.stringify({errors:auditErrors,slides:compiled.slides.length,method:'PPTX re-import; notes equality and editable text geometry. Not pixel text measurement.'},null,2));
  if(auditErrors.length)throw Error(auditErrors.join('\n'));
  for(const [i,slide] of roundtrip.slides.items.entries()){
    const png=await roundtrip.export({slide,format:'png',scale:1});
    await fs.writeFile(path.join(dir,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
  }
  await fs.writeFile(path.join(dir,'compiled.json'),JSON.stringify(compiled,null,2));
  await fs.writeFile(path.join(dir,'notes.md'),compiled.slides.map((s,i)=>`## ${i+1}. ${s.title}\n\n${s.notes}`).join('\n\n'));
  await fs.writeFile(path.join(dir,'evidence.md'),plan.slides.map((s,i)=>`## ${i+1}. ${s.title}\n\n${makeEvidenceNotes(s,plan)}`).join('\n\n'));
  const html='<!doctype html><meta charset="utf-8"><title>SPA preview</title><style>body{background:#e8ebee;margin:32px;font-family:sans-serif}img{display:block;width:min(100%,1280px);margin:24px auto;box-shadow:0 4px 20px #0002}p{max-width:1280px;margin:auto}</style><p>SPA PPTX round-trip preview — '+(plan.demo?'演示素材':'待预览审核')+'</p>'+compiled.slides.map((_,i)=>`<img alt="Slide ${i+1}" src="slide-${String(i+1).padStart(2,'0')}.png">`).join('');
  await fs.writeFile(path.join(dir,'index.html'),html);
  return {draft,compiled};
}
