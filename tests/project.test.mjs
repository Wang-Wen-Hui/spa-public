import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {initProject} from '../scripts/init_project.mjs';
import {validatePlan} from '../engine/core.mjs';
import {spawnSync} from 'node:child_process';

test('new paper workspace is real-data-only, resumable without overwrite, and stays inside projects',async()=>{
  await fs.mkdir('.build',{recursive:true});
  const root=await fs.mkdtemp(path.resolve('.build/project-test-'));
  const dir=await initProject('新文献',root);
  const file=path.join(dir,'plan.json');
  const plan=JSON.parse(await fs.readFile(file,'utf8'));
  assert.equal(plan.demo,false);assert.equal(plan.notes_mode,'cues');
  assert.ok(validatePlan(plan).errors.includes('slides must not be empty'));
  await fs.writeFile(file,'USER EDIT');
  await assert.rejects(initProject('新文献',root),/EEXIST/);
  assert.equal(await fs.readFile(file,'utf8'),'USER EDIT');
  await assert.rejects(initProject('../outside',root));
  await assert.rejects(initProject('C:\\outside',root));
  await assert.rejects(initProject('CON',root));
});
test('public build entry preserves validation and rejects a nonexistent plan',()=>{
  const run=(...args)=>spawnSync(process.execPath,['scripts/build_pptx.js',...args],{encoding:'utf8'});
  assert.equal(run('check','examples/academic-blue.json').status,0);
  assert.notEqual(run('check','.build/no-such-paper-plan.json').status,0);
});
