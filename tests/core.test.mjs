import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,validatePlan,makeNotes,makeEvidenceNotes,contain,geometryIssues,digest,figureChrome,navigationLabel} from '../engine/core.mjs';
import {demoPlan} from '../engine/demo.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('both themes compile all ten distinct layout prototypes',()=>{
  for(const theme of ['academic-blue','academic-red']){
    const p=demoPlan(theme),c=compile(p);assert.equal(c.slides.length,10);
    assert.equal(new Set(c.slides.map(s=>s.chosen.pattern)).size,10);
    assert.ok(c.slides.every(s=>s.chosen.errors.length===0));
  }
});
test('orphan evidence, duplicate IDs and omitted claim support are rejected',()=>{
  const p=demoPlan();p.slides[0].evidence=[];p.evidence.push({...p.evidence[0]});
  assert.ok(validatePlan(p).errors.some(x=>x.includes('duplicate')));
  p.evidence.pop();assert.ok(validatePlan(p).errors.some(x=>x.includes('claim-supporting')));
});
test('missing experimental controls and missing statistical report do not pass',()=>{
  const p=demoPlan();delete p.evidence[0].control;delete p.evidence[0].statistics;
  assert.ok(validatePlan(p).errors.some(x=>x.includes('control')));assert.ok(validatePlan(p).errors.some(x=>x.includes('statistics')));
});
test('unverified used evidence cannot build; unknown visual details remain explicit',()=>{
  const p=demoPlan();p.evidence[0].status='unverified';assert.throws(()=>compile(p),/unverified/);
  p.evidence[0].status='demo';p.evidence[0].visual_status='unverified';assert.match(makeNotes(p.slides[0],p),/视觉细节：待确认/);
});
test('notes are panel-specific and use evidence instead of paraphrasing slide text',()=>{
  const p=demoPlan();p.evidence[0].condition='Condition_unique_24h';p.evidence[0].control='Control_unique';
  const notes=makeNotes(p.slides[0],p);assert.match(notes,/Condition_unique_24h/);assert.match(notes,/Control_unique/);assert.match(notes,/Demo 1 \/ A/);assert.match(notes,/统计/);
});
test('recall cues retain provenance while full preparation details stay in dossier',()=>{
  const p=demoPlan();p.notes_mode='cues';
  for(const s of p.slides)s.speaker_cues=s.evidence.map(id=>({kind:'design',text:`记住 ${id} 的处理与对照`,evidence:[id]}));
  p.evidence[0].method='LONG_PREPARATION_ONLY';
  p.evidence[0].visual_status='unverified';
  assert.equal(validatePlan(p).errors.length,0);
  const c=compile(p),notes=c.slides[0].notes;
  assert.doesNotMatch(notes,/LONG_PREPARATION_ONLY/);
  assert.match(makeEvidenceNotes(p.slides[0],p),/LONG_PREPARATION_ONLY/);
  assert.doesNotMatch(notes,/视觉细节|图索引|出处|边界|衔接|\[e/);
  assert.match(makeEvidenceNotes(p.slides[0],p),/视觉细节：待确认/);
  const h=digest(p);p.slides[0].speaker_cues[0].text='修改过的提示';assert.notEqual(h,digest(p));
});
test('blue labels align at frame top and descriptive navigation fits four-character lines',()=>{
  const frame={x:128,y:116,w:520,h:330};
  const c=figureChrome({label:'局部荧光分布'},frame,'academic-blue');
  assert.equal(c.label.y,frame.y);
  assert.equal(c.label.x+c.label.w/2,frame.x+frame.w/2);
  assert.ok(c.image.y>c.label.y+c.label.h);
  assert.equal(navigationLabel('2.图谱构建与结果'),'2\n图谱构建\n与结果');
});
test('main-figure-only policy permits supplementary notes but rejects supplementary image slots',()=>{
  const p=demoPlan();p.presentation_policy={supplementary_figures:'notes-text-only'};
  p.sources[0].kind='supplement';
  assert.ok(validatePlan(p).errors.some(x=>x.includes('supplementary evidence belongs in notes')));
  p.slides=p.slides.filter(s=>s.figures.length===0);
  for(const c of p.coverage){c.critical=false;if(!p.slides.some(s=>s.evidence.includes(c.evidence))){c.disposition='omitted';c.reason='notes-only policy test';}}
  assert.equal(validatePlan(p).errors.length,0);
});
test('cue mode rejects foreign evidence, absent cues and uncovered panels',()=>{
  const p=demoPlan();p.notes_mode='cues';
  for(const s of p.slides)s.speaker_cues=s.evidence.map(id=>({kind:'order',text:'读图顺序',evidence:[id]}));
  const s=p.slides[0];s.speaker_cues[0].evidence=['foreign-paper-evidence'];
  const errors=validatePlan(p).errors;
  assert.ok(errors.some(x=>x.includes('off-slide evidence')));
  assert.ok(errors.some(x=>x.includes('cue coverage missing')));
  s.speaker_cues=undefined;assert.ok(validatePlan(p).errors.some(x=>x.includes('speaker_cues required')));
});
test('supplementary method notes remain separate from visible result evidence',()=>{
  const p=demoPlan();p.notes_mode='cues';
  for(const s of p.slides)s.speaker_cues=s.evidence.map(id=>({kind:'method',text:'Specific method detail',evidence:[id]}));
  const s=p.slides.find(s=>s.figures.length>0), e={...p.evidence[0],id:'notes-extra'};
  p.evidence.push(e);p.coverage.push({evidence:e.id,disposition:'included',critical:true,reason:'Method notes'});
  s.slide_type='experimental_result';s.title=p.claims.find(c=>c.id===s.claim).text;
  s.evidence=[...s.evidence];
  s.evidence.push(e.id);s.notes_evidence=[e.id];s.speaker_cues.push({kind:'method',text:'Extra control detail',evidence:[e.id]});
  assert.equal(validatePlan(p).errors.length,0);
  s.blocks[0].evidence.push(e.id);assert.ok(validatePlan(p).errors.some(x=>x.includes('notes-only evidence used in visible block')));
  s.blocks[0].evidence.pop();p.claims.find(c=>c.id===s.claim).evidence.push(e.id);
  assert.ok(validatePlan(p).errors.some(x=>x.includes('headline claim relies on notes-only evidence')));
});
test('author page supports three corresponding authors and rejects unbounded crowding',()=>{
  const p=demoPlan(),s=p.slides[0];s.slide_type='author_background';
  s.author_profiles=Array.from({length:3},(_,i)=>({name:`Author ${i}`,portrait:`portrait-${i}.jpeg`,role:'Corresponding author'}));
  assert.equal(validatePlan(p).errors.length,0);
  s.author_profiles.push({...s.author_profiles[0]});assert.ok(validatePlan(p).errors.some(x=>x.includes('one to three')));
});
test('excess text produces replanning request, not smaller font or dropped content',()=>{
  const p=demoPlan();p.slides[0].blocks[0].text='实验解释'.repeat(800);
  assert.throws(()=>compile(p),/NEEDS_REPLAN/);assert.equal(p.slides[0].blocks[0].text.length,3200);
});
test('contain preserves extreme image proportions',()=>{
  for(const a of [0.2,1,1.8,8]){const r=contain(a,{x:0,y:0,w:500,h:300});assert.ok(Math.abs(r.w/r.h-a)<1e-8);assert.ok(r.w<=500&&r.h<=300);}
});
test('overlap and off-slide placement fail geometry check',()=>{
  assert.ok(geometryIssues([{x:0,y:0,w:100,h:100},{x:90,y:90,w:100,h:100}]).some(x=>x.startsWith('overlap')));
  assert.ok(geometryIssues([{x:1270,y:0,w:100,h:100}]).some(x=>x.startsWith('bounds')));
});
test('real decks reject demo evidence and require verification provenance',()=>{
  const p=demoPlan();p.demo=false;assert.ok(validatePlan(p).errors.some(x=>x.includes('demo')));
  p.demo=true;p.evidence[0].status='verified';assert.ok(validatePlan(p).errors.some(x=>x.includes('verifier')));
});
test('scientific approval hash changes when notes source or layout changes',()=>{
  const p=demoPlan(),h=digest(p);p.evidence[0].statistics='changed';assert.notEqual(h,digest(p));
});
test('standard permits bounded figure ratios, safe rejects arbitrary ratios',()=>{
  const p=demoPlan();p.slides[2].figure_share=0.65;assert.throws(()=>compile(p),/standard mode/);
  p.mode='standard';assert.equal(compile(p).slides.length,10);
});
test('critical evidence must be covered and all evidence needs a disposition',()=>{
  const p=demoPlan();p.coverage[0].disposition='omitted';assert.ok(validatePlan(p).errors.some(x=>x.includes('included')));
  p.coverage.shift();assert.ok(validatePlan(p).errors.some(x=>x.includes('exactly one')));
});
test('CLI review receipts detect plan changes, preview changes and output overwrite',()=>{
  fs.mkdirSync('.build',{recursive:true});
  const dir=fs.mkdtempSync(path.resolve('.build/review-test-'));
  const plan=demoPlan(),file=path.join(dir,'plan.json');
  fs.writeFileSync(file,JSON.stringify(plan));
  fs.writeFileSync(path.join(dir,'compiled.json'),JSON.stringify({planHash:digest(plan)}));
  fs.writeFileSync(path.join(dir,'render-audit.json'),JSON.stringify({errors:[],slides:1}));
  // Stub bytes exercise the receipt lifecycle only; PPTX rendering is tested by demo export.
  fs.writeFileSync(path.join(dir,'draft.pptx'),'test-only stub');fs.writeFileSync(path.join(dir,'slide-01.png'),'test-only stub');
  const cli=(...args)=>spawnSync(process.execPath,['engine/cli.mjs',...args],{encoding:'utf8'});
  assert.equal(cli('approve-preview',file,dir,'TEST FIXTURE ACCEPTED').status,0);
  const output=path.join(dir,'output.pptx');assert.equal(cli('deliver',file,dir,output).status,0);
  assert.notEqual(cli('deliver',file,dir,output).status,0);
  fs.appendFileSync(path.join(dir,'slide-01.png'),'changed');assert.notEqual(cli('deliver',file,dir,path.join(dir,'new.pptx')).status,0);
  plan.slides[0].title='Changed';fs.writeFileSync(file,JSON.stringify(plan));
  assert.notEqual(cli('approve-preview',file,dir,'TEST FIXTURE ACCEPTED').status,0);
});
