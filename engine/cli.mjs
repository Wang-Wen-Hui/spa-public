import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validatePlan,compile,digest} from './core.mjs';
import {demoPlan} from './demo.mjs';
import {render} from './render.mjs';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const write=async(p,v)=>fs.writeFile(p,JSON.stringify(v,null,2));
async function previewHash(dir){
  const audit=await read(path.join(dir,'render-audit.json'));
  if(!Array.isArray(audit.errors)||audit.errors.length)throw Error('Render audit did not pass');
  const names=(await fs.readdir(dir)).filter(n=>/^slide-\d+\.png$/.test(n)||['draft.pptx','compiled.json','render-audit.json'].includes(n)).sort();
  if(!names.includes('draft.pptx')||names.length<2)throw Error('Missing PPTX or previews');
  if(names.filter(n=>/^slide-\d+\.png$/.test(n)).length!==audit.slides)throw Error('Preview slide count mismatch; use a clean build directory');
  const h=createHash('sha256');for(const n of names){h.update(n);h.update(await fs.readFile(path.join(dir,n)));}return h.digest('hex');
}
async function main(){
  const [cmd,file,arg,extra]=process.argv.slice(2);
  if(cmd==='demo'){
    for(const theme of ['academic-blue','academic-red']){
      const p=demoPlan(theme);await fs.mkdir('examples',{recursive:true});await write(`examples/${theme}.json`,p);
      const dir=path.resolve('.build',theme);await render(p,dir);console.log(`Rendered ${theme}: ${dir}`);
    }return;
  }
  if(cmd==='check'){const p=await read(file),v=validatePlan(p);if(!v.errors.length)try{const c=compile(p);v.layouts=c.slides.map(s=>({slide:s.id,pattern:s.chosen.pattern,score:s.chosen.score}));}catch(e){v.errors.push(e.message);}console.log(JSON.stringify(v,null,2));if(v.errors.length)process.exitCode=1;return;}
  if(cmd==='approve-outline'){
    if(!arg)throw Error('Provide the actual user decision text as the last argument.');
    const p=await read(file);compile(p);await write(`${file}.outline-review.json`,{hash:digest(p),decision:arg,at:new Date().toISOString()});return;
  }
  if(cmd==='build'){
    const p=await read(file);if(p.demo!==true){const review=await read(`${file}.outline-review.json`);if(review.hash!==digest(p))throw Error('Outline changed; review required.');}
    const dir=path.resolve(arg??'.build/current');await render(p,dir);console.log(`Preview: ${path.join(dir,'index.html')}`);return;
  }
  if(cmd==='approve-preview'){
    if(!extra)throw Error('Usage: approve-preview PLAN BUILD_DIR actual-user-decision');
    const p=await read(file),c=await read(path.join(arg,'compiled.json'));if(c.planHash!==digest(p))throw Error('Plan changed; rebuild preview.');
    await write(path.join(arg,'preview-review.json'),{planHash:digest(p),artifactHash:await previewHash(arg),decision:extra,at:new Date().toISOString()});return;
  }
  if(cmd==='deliver'){
    const p=await read(file),review=await read(path.join(arg,'preview-review.json'));
    if(review.planHash!==digest(p)||review.artifactHash!==await previewHash(arg))throw Error('Preview or plan changed; review required.');
    if(!extra)throw Error('Specify a NEW output PPTX path');
    await fs.mkdir(path.dirname(path.resolve(extra)),{recursive:true});await fs.copyFile(path.join(arg,'draft.pptx'),extra,1);console.log(extra);return;
  }
  console.log('SPA: check PLAN | approve-outline PLAN DECISION | build PLAN DIR | approve-preview PLAN DIR DECISION | deliver PLAN DIR OUTPUT | demo');
  if(cmd)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
