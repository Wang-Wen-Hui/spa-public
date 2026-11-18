import fs from 'node:fs';
import {createHash} from 'node:crypto';
export const patterns = JSON.parse(fs.readFileSync(new URL('../design-system/patterns.json', import.meta.url)));
export const themes = JSON.parse(fs.readFileSync(new URL('../design-system/themes.json', import.meta.url)));
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const list = x => Array.isArray(x);
export function validatePlan(p) {
  const errors=[], warnings=[];
  const need=(ok,msg)=>{if(!ok) errors.push(msg);};
  need(p?.version===2,'version must be 2');
  need(!!themes[p?.theme], 'unknown theme');
  need(['safe','standard'].includes(p?.mode),'mode must be safe or standard; creative mode is not implemented');
  need(p?.notes_mode===undefined||['cues','full'].includes(p.notes_mode),'notes_mode must be cues or full');
  for(const k of ['sources','evidence','claims','slides','coverage']) need(list(p?.[k]),`${k} must be an array`);
  if(errors.length) return {errors,warnings};
  need(p.slides.length>0,'slides must not be empty');
  if(p.theme==='academic-blue')need(new Set(p.slides.map(s=>s?.section)).size<=6,'blue navigation supports at most six sections; consolidate section names');
  const indexes={};
  for(const k of ['sources','evidence','claims','slides']) {
    indexes[k]=new Map();
    for(const o of p[k]) {need(o && nonempty(o.id),`${k}: missing id`); if(!o) continue;need(!indexes[k].has(o.id),`${k}: duplicate ${o.id}`);indexes[k].set(o.id,o);}
  }
  if(errors.length) return {errors,warnings};
  for(const s of p.sources) {need(nonempty(s.locator),`source ${s.id}: locator required`);need(['main','supplement','external','demo'].includes(s.kind),`source ${s.id}: invalid kind`); if(s.kind==='demo') need(p.demo===true,'demo source forbidden in real plan');}
  for(const e of p.evidence) {
    const prefix=`evidence ${e.id}`;
    need(indexes.sources.has(e.source),`${prefix}: unknown source`);
    for(const k of ['figure','panel','location','question','method','condition','control','observation','statistics','limitation']) need(nonempty(e[k]),`${prefix}: ${k} required (use explicit 未报告/不适用 with reason)`);
    need(['verified','unverified','demo'].includes(e.status),`${prefix}: invalid status`);
    need(['read','unverified','not-applicable'].includes(e.visual_status),`${prefix}: visual_status required`);
    need(list(e.keywords)&&e.keywords.every(nonempty),`${prefix}: keywords required`);
    if(e.status==='verified') need(nonempty(e.verified_by)&&nonempty(e.verification_note),`${prefix}: verifier and verification_note required`);
    if(e.status==='demo') need(p.demo===true,`${prefix}: demo evidence forbidden in real plan`);
    if(e.visual_status==='unverified') warnings.push(`${prefix}: visual details remain unverified`);
  }
  for(const c of p.claims) {
    need(nonempty(c.text),`claim ${c.id}: text required`);
    need(['observation','interpretation','external','hypothesis','demo'].includes(c.kind),`claim ${c.id}: invalid kind`);
    need(list(c.evidence)&&c.evidence.length>0,`claim ${c.id}: evidence required`);
    for(const id of c.evidence??[]) need(indexes.evidence.has(id),`claim ${c.id}: unknown evidence ${id}`);
    if(c.kind==='demo') need(p.demo===true,`claim ${c.id}: demo claim forbidden`);
  }
  for(const s of p.slides) {
    const pre=`slide ${s.id}`;
    for(const k of ['title','purpose','section','relationship','transition']) need(nonempty(s[k]),`${pre}: ${k} required`);
    if(nonempty(s.section)&&p.theme==='academic-blue'){
      const navLines=navigationLabel(s.section).split('\n').length;
      const navHeight=Math.min(150,500/new Set(p.slides.map(s=>s.section)).size)-12;
      need(navLines<=4&&navLines*22<=navHeight,`${pre}: navigation section too long`);
    }
    if(s.slide_type==='author_background') {
      need(list(s.author_profiles)&&s.author_profiles.length>=1&&s.author_profiles.length<=3,`${pre}: one to three verified author profiles required`);
      for(const a of s.author_profiles??[])need(nonempty(a.name)&&nonempty(a.portrait)&&nonempty(a.role),`${pre}: author name, portrait and role required`);
    }
    for(const k of ['evidence','figures','blocks']) need(list(s[k]),`${pre}: ${k} must be array`);
    need(indexes.claims.has(s.claim),`${pre}: unknown claim`);
    if(!list(s.evidence)||!list(s.figures)||!list(s.blocks)) continue;
    need(new Set(s.evidence).size===s.evidence.length,`${pre}: duplicate evidence`);
    for(const id of s.evidence) need(indexes.evidence.has(id),`${pre}: unknown evidence ${id}`);
    if(p.notes_mode==='cues') {
      need(list(s.speaker_cues)&&s.speaker_cues.length>0,`${pre}: speaker_cues required in cues mode`);
      const cueEvidence=new Set();
      for(const cue of list(s.speaker_cues)?s.speaker_cues:[]) {
        need(['order','term','design','method','principle','background','readout','caution'].includes(cue?.kind)&&nonempty(cue?.text),`${pre}: cue kind and text required`);
        need(list(cue?.evidence)&&cue.evidence.length>0,`${pre}: cue evidence required`);
        for(const id of list(cue?.evidence)?cue.evidence:[]) {
          need(s.evidence.includes(id),`${pre}: cue references off-slide evidence ${id}`);
          cueEvidence.add(id);
        }
      }
      for(const id of s.evidence) need(cueEvidence.has(id),`${pre}: cue coverage missing ${id}`);
      const cues=list(s.speaker_cues)?s.speaker_cues:[];
      if(cues.length>8||cues.reduce((n,c)=>n+(c?.text?.length??0),0)>600)
        warnings.push(`${pre}: review notes for useful method/principle detail and repetition; do not truncate automatically`);
    }
    for(const id of indexes.claims.get(s.claim)?.evidence??[]) need(s.evidence.includes(id),`${pre}: claim-supporting evidence ${id} omitted`);
    if(s.slide_type==='experimental_result') need(s.title===indexes.claims.get(s.claim)?.text,`${pre}: result title must equal audited claim text`);
    for(const b of s.blocks) {need(nonempty(b.title)&&nonempty(b.text),`${pre}: block text required`);need(list(b.evidence)&&b.evidence.length>0,`${pre}: block evidence required`);for(const id of b.evidence??[]) need(s.evidence.includes(id),`${pre}: block evidence not on slide`);}
    const shown=[];
    for(const f of s.figures) {
      need(nonempty(f.label),`${pre}: figure label required`);need(Number.isFinite(f.aspect)&&f.aspect>0,`${pre}: positive figure aspect required`);
      need(list(f.preserve)&&f.preserve.length>0&&f.preserve.every(nonempty),`${pre}: preserve instructions required`);
      need(list(f.evidence)&&f.evidence.length>0,`${pre}: figure evidence required`);
      for(const id of f.evidence??[]) {
        need(s.evidence.includes(id),`${pre}: figure references off-slide evidence ${id}`);shown.push(id);
        if(p.presentation_policy?.supplementary_figures==='notes-text-only') {
          const e=indexes.evidence.get(id);
          need(indexes.sources.get(e?.source)?.kind!=='supplement',`${pre}: supplementary evidence belongs in notes, not figure slots`);
        }
      }
    }
    const notesOnly=s.notes_evidence??[];
    need(list(notesOnly),`${pre}: notes_evidence must be array`);
    for(const id of list(notesOnly)?notesOnly:[]) {
      need(s.evidence.includes(id),`${pre}: notes-only evidence not on slide`);
      need(!shown.includes(id),`${pre}: notes-only evidence also has a figure slot`);
      need(!s.blocks.some(b=>b.evidence?.includes(id)),`${pre}: notes-only evidence used in visible block`);
      need(!indexes.claims.get(s.claim)?.evidence?.includes(id),`${pre}: headline claim relies on notes-only evidence`);
      need(s.speaker_cues?.some(c=>c.evidence?.includes(id)),`${pre}: notes-only evidence missing from cues`);
    }
    if(s.slide_type==='experimental_result') for(const id of s.evidence) need(shown.includes(id)||(list(notesOnly)&&notesOnly.includes(id)),`${pre}: result evidence ${id} has no figure slot`);
    if(s.pattern) need(patterns.some(x=>x.id===s.pattern),`${pre}: unknown pattern`);
    if(s.figure_share!==undefined) need(p.mode==='standard'&&Number.isFinite(s.figure_share)&&s.figure_share>=0.5&&s.figure_share<=0.8,`${pre}: figure_share requires standard mode and range 0.5..0.8`);
  }
  for(const e of p.evidence) {
    const rows=p.coverage.filter(c=>c.evidence===e.id);need(rows.length===1,`coverage: ${e.id} needs exactly one disposition`);
    const row=rows[0];if(!row)continue;
    const used=p.slides.filter(s=>s.evidence?.includes(e.id)).map(s=>s.id);
    if(used.length) need(row.disposition==='included',`coverage ${e.id}: used evidence must be included`);
    else need(['omitted','backup'].includes(row.disposition)&&nonempty(row.reason),`coverage ${e.id}: unplaced evidence needs reason`);
    if(row.critical) need(used.length>0,`coverage ${e.id}: critical evidence cannot be omitted`);
  }
  for(const c of p.coverage) need(indexes.evidence.has(c.evidence),`coverage: unknown evidence ${c.evidence}`);
  const used=new Set(p.slides.flatMap(s=>s.evidence??[]));
  for(const e of p.evidence) if(used.has(e.id)&&e.status==='unverified') errors.push(`used evidence ${e.id} is unverified; resolve before build`);
  if(!p.demo && !p.sources.some(s=>s.kind==='supplement')) warnings.push('No supplementary source registered; record availability in outline review.');
  if(!p.demo && p.notes_mode!=='cues') warnings.push('Full evidence notes are legacy mode; use notes_mode=cues for presenter recall prompts.');
  return {errors,warnings};
}
export function makeNotes(slide, plan) {
  if(plan.notes_mode!=='cues')return makeEvidenceNotes(slide,plan);
  const labels={order:'读图',term:'术语',design:'实验设计',method:'方法',principle:'原理',background:'人物背景',readout:'读图'};
  return [plan.demo?'【演示数据，非论文结果】':'',
    ...slide.speaker_cues.filter(c=>c.kind!=='caution').map(c=>`${labels[c.kind]}：${c.text}`)
  ].filter(Boolean).join('\n\n');
}
export function makeEvidenceNotes(slide, plan) {
  const es=slide.evidence.map(id=>plan.evidence.find(e=>e.id===id));
  const claim=plan.claims.find(c=>c.id===slide.claim);
  return [plan.demo?'【演示数据，非论文结果】':'',`目标：${slide.purpose}`,`结论性质：${claim.kind}；${claim.text}`,
    ...es.map((e,i)=>[`${i+1}. ${e.figure} / ${e.panel}：${e.question}`,`方法：${e.method}`,`处理：${e.condition}；对照：${e.control}`,`观察：${e.observation}`,`统计：${e.statistics}`,`边界：${e.limitation}`,e.visual_status==='unverified'?'视觉细节：待确认；不能把图注推断当作已观察的图像事实。':'',`来源：${plan.sources.find(s=>s.id===e.source).locator}；${e.location}`].filter(Boolean).join('\n')),
    `术语：${[...new Set(es.flatMap(e=>e.keywords))].join('；')}`,`衔接：${slide.transition}`].filter(Boolean).join('\n\n');
}
// Coordinates belong to the engine. Models supply intent and evidence only.
const rect=(x,y,w,h)=>({x,y,w,h});
const cols=(area,n,gap=24)=>Array.from({length:n},(_,i)=>rect(area.x+i*(area.w+gap)/n,area.y,(area.w-gap*(n-1))/n,area.h));
export function navigationLabel(name) {
  const match=name.match(/^(\d+)[.．、\s]*(.*)$/u);
  const label=match?match[2]:name;
  return [...(match?[match[1]]:[]),...(label.match(/.{1,4}/gu)??[])].join('\n');
}
export function pageGeometry(s,theme) {
  if(!themes[theme]?.compactHeader) return {titleY:54,titleH:86,dividerY:139,content:rect(128,152,1096,484)};
  const titleH=Math.min(2,estimateLines(s.title,1096,36))*44;
  const titleY=32,dividerY=titleY+titleH+12,contentY=dividerY+28;
  return {titleY,titleH,dividerY,content:rect(128,contentY,1096,636-contentY)};
}
export function figureChrome(f,r,theme) {
  if(themes[theme]?.figureLabel!=='centered-border')return {
    label:rect(r.x+12,r.y+10,r.w-24,32),
    text:rect(r.x+20,r.y+11,r.w-40,30),
    image:rect(r.x+16,r.y+48,r.w-32,r.h-66),
    alignment:'left'
  };
  const units=[...f.label].reduce((n,c)=>n+(c.codePointAt(0)>255?1:0.58),0);
  const width=Math.min(r.w-40,Math.max(160,Math.min(260,r.w*0.6),units*22+40));
  const label=rect(r.x+(r.w-width)/2,r.y,width,32);
  return {label,text:rect(label.x+12,label.y+1,width-24,30),
    image:rect(r.x+16,r.y+48,r.w-32,r.h-66),alignment:'center'};
}
export function slots(pattern,s,ratio=pattern.figureShare,theme='academic-red') {
  const a=pageGeometry(s,theme).content,g=24;let figures=[],blocks=[],arrows=[];
  const n=s.figures.length,b=s.blocks.length;
  const vertical=(area,count)=>Array.from({length:count},(_,i)=>rect(area.x,area.y+i*(area.h+g)/count,area.w,(area.h-g*(count-1))/count));
  switch(pattern.geometry) {
    case 'columns':case 'paired':case 'chain': {
      const cells=cols(a,n,['chain','paired'].includes(pattern.geometry)?42:24);
      figures=cells.map(c=>rect(c.x,c.y,c.w,a.h*ratio));
      blocks=cols(rect(a.x,a.y+a.h*ratio+24,a.w,a.h*(1-ratio)-24),b);
      if(['paired','chain'].includes(pattern.geometry)) arrows=cells.slice(0,-1).map(c=>rect(c.x+c.w+6,a.y+120,30,20));break;
    }
    case 'side':case 'stacked': {
      const w=a.w*ratio; figures=vertical(rect(a.x,a.y,w,a.h),n);blocks=vertical(rect(a.x+w+g,a.y,a.w-w-g,a.h),b);break;
    }
    case 'focus':figures=[rect(a.x,a.y,a.w,a.h*ratio)];blocks=[rect(a.x,a.y+a.h*ratio+20,a.w,a.h*(1-ratio)-20)];break;
    case 'flanked': {const w=a.w*ratio,side=(a.w-w-2*g)/2;figures=[rect(a.x+side+g,a.y,w,a.h)];blocks=[rect(a.x,a.y,side,a.h),rect(a.x+side+2*g+w,a.y,side,a.h)];break;}
    case 'workflow': blocks=cols(rect(a.x,a.y+86,a.w,320),b,36);arrows=blocks.slice(0,-1).map(c=>rect(c.x+c.w+3,a.y+215,30,20));break;
    case 'summary': {const c=cols(a,2),h=b>2?(a.h-g)/2:a.h;blocks=Array.from({length:b},(_,i)=>rect(c[i%2].x,a.y+Math.floor(i/2)*(h+g),c[0].w,h));break;}
    default: throw Error('unknown geometry');
  }
  return {figures,blocks,arrows};
}
export function estimateLines(text,width,font=24) {
  let count=0;const cap=Math.max(1,(width-24)/font);
  for(const row of text.split('\n')){let units=0;for(const ch of row) units+=ch.codePointAt(0)>255?1:0.58;count+=Math.max(1,Math.ceil(units/cap));}return count;
}
export function contain(aspect,box) {
  const w=Math.min(box.w,box.h*aspect),h=w/aspect;return rect(box.x+(box.w-w)/2,box.y+(box.h-h)/2,w,h);
}
export function geometryIssues(boxes) {
  const errors=[];
  boxes.forEach((b,i)=> {if(![b.x,b.y,b.w,b.h].every(Number.isFinite)||b.w<=0||b.h<=0||b.x<0||b.y<0||b.x+b.w>1280.1||b.y+b.h>720.1) errors.push(`bounds:${i}`);
    boxes.slice(i+1).forEach((c,j)=>{if(Math.min(b.x+b.w,c.x+c.w)-Math.max(b.x,c.x)>1&&Math.min(b.y+b.h,c.y+c.h)-Math.max(b.y,c.y)>1) errors.push(`overlap:${i}:${i+j+1}`);});});return errors;
}
export function candidates(s,plan) {
  const eligible=patterns.filter(p=>s.figures.length>=p.figures[0]&&s.figures.length<=p.figures[1]&&s.blocks.length>=p.blocks[0]&&s.blocks.length<=p.blocks[1]);
  const result=[];
  for(const p of eligible) {
    const ratios=p.figureShare>0&&p.geometry!=='flanked'?[p.figureShare,p.figureShare-0.07,p.figureShare+0.05]:[p.figureShare];
    if(plan.mode==='standard'&&s.figure_share!==undefined&&['side','stacked','focus'].includes(p.geometry))ratios.unshift(s.figure_share);
    for(const ratio of ratios) {
      const layout=slots(p,s,ratio,plan.theme),errors=geometryIssues([...layout.figures,...layout.blocks,...layout.arrows]);let score=100;
      if(estimateLines(s.title,1096,36)>2) errors.push('title_overflow');
      for(let i=0;i<s.blocks.length;i++){
        const b=s.blocks[i],r=layout.blocks[i];
        const titleH=estimateLines(b.title,r.w,24)*31;
        if(titleH+estimateLines(b.text,r.w,24)*32+28>r.h) errors.push(`text_overflow:${i}`);
      }
      for(let i=0;i<s.figures.length;i++){
        const f=s.figures[i],r=layout.figures[i],chrome=figureChrome(f,r,plan.theme),fit=contain(f.aspect,chrome.image);
        if(estimateLines(f.label,chrome.text.w+24,22)>1)errors.push(`figure_label_overflow:${i}`);
        const label=f.evidence.map(id=>{const e=plan.evidence.find(e=>e.id===id);return `${e.figure} ${e.panel}`;}).join(' · ');
        if(estimateLines(`${label}\n${f.preserve.join('、')}`,fit.w-20,20)*27+20>fit.h) errors.push(`placeholder_text_overflow:${i}`);
        if(fit.w<200||fit.h<110) errors.push(`figure_too_small:${i}`);
        score-=Math.round((1-fit.w*fit.h/(r.w*r.h))*10);
      }
      if(p.relations.includes(s.relationship)) score+=18;
      if(s.priority==='figure_first') score+=Math.round(ratio*12);
      if(s.pattern===p.id)score+=25;
      result.push({pattern:p.id,ratio,score,errors,layout});
    }
  }
  return result.sort((a,b)=>a.errors.length-b.errors.length||b.score-a.score);
}
export function compile(plan) {
  const validation=validatePlan(plan);if(validation.errors.length)throw Error(validation.errors.join('\n'));
  const slides=plan.slides.map(s=>{
    const options=candidates(s,plan),chosen=options.find(x=>!x.errors.length);
    if(!chosen)throw Error(`NEEDS_REPLAN ${s.id}: no readable layout. Reallocate, shorten visible explanation without deleting evidence, or let scientific planner split. ${JSON.stringify(options.map(x=>({pattern:x.pattern,errors:x.errors})))}`);
    return {...s,chosen,candidates:options.slice(0,3),notes:makeNotes(s,plan)};
  });
  return {planHash:digest(plan),theme:plan.theme,demo:!!plan.demo,validation,slides};
}
