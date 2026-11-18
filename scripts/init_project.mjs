import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export async function initProject(name,root=path.join(repo,'projects')){
  if(typeof name!=='string'||!name.trim()||name!==name.trim()||
    /[<>:"/\\|?*\x00-\x1f]/.test(name)||/[. ]$/.test(name)||name==='.'||name==='..'||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
    throw Error('Use a single project directory name, not a path or reserved filename.');
  const prefs=JSON.parse(await fs.readFile(path.join(repo,'config/user-preferences.json'),'utf8'));
  const dir=path.join(path.resolve(root),name);
  await fs.mkdir(root,{recursive:true});
  // Existing projects are never reset. Resume from their records.
  await fs.mkdir(dir);
  const plan={version:2,demo:false,theme:prefs.theme,mode:prefs.layout_mode,notes_mode:prefs.notes_mode,
    presentation_policy:{supplementary_figures:'notes-text-only',backup_slides:false,first_figure_explanation:true},
    sources:[],evidence:[],claims:[],slides:[],coverage:[]};
  const files={
    'plan.json':JSON.stringify(plan,null,2),
    'preferences.json':JSON.stringify(prefs,null,2),
    'decisions.md':`# ${name}：选择与进度\n\n当前阶段：等待导入真实文献；空计划不能生成 PPT。\n\n沿用偏好见 preferences.json。新用户指令优先；常规内容/布局判断由 Agent 自主完成。\n\n| 决策 | 选择 | 依据/用户原话 | 状态 |\n| --- | --- | --- | --- |\n| 大纲审核 | 待形成真实大纲 | 尚未请求 | pending |\n| 预览审核 | 待生成实际预览 | 尚未请求 | pending |\n\n## 下一步\n\n登记主文版本、补充材料及必要引用文献，阅读图像与图注，建立证据清单。\n`,
    'materials-status.md':`# ${name}：材料清单\n\n尚未导入文献，不能据此判断补充材料缺失。\n\n| 来源/版本 | 本地文件与定位 | 已读正文/图像 | 缺失项 | 影响页面/结论 | 处理方式 |\n| --- | --- | --- | --- | --- | --- |\n`,
    'outline.md':`# ${name}：汇报大纲\n\n待阅读真实文献后填写。默认背景→主体证据→讨论→结尾，按科学内容调整章节与页数。\n\n研究问题：待核查\n\n叙事主线与时长：待规划\n\n| 页 | 本页任务/结论 | 来源与Panel | 方法/设计解释 | 关键术语 | 与下一页关系 | 材料缺口 |\n| --- | --- | --- | --- | --- | --- | --- |\n\n## 未展示证据与理由\n\n阅读正文和补充材料后填写；对应 plan.json 的 coverage。\n`
  };
  for(const [name,text] of Object.entries(files))await fs.writeFile(path.join(dir,name),text+'\n',{flag:'wx'});
  return dir;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(await initProject(process.argv[2]));}
  catch(e){console.error(e.message);process.exitCode=1;}
}
