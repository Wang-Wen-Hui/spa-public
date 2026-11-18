import {patterns} from './core.mjs';
export function demoPlan(theme='academic-blue') {
  const p={version:2,demo:true,theme,mode:'safe',sources:[{id:'demo',kind:'demo',locator:'SPA 布局演示：无真实论文数据'}],evidence:[],claims:[],slides:[],coverage:[]};
  const names=['已知背景','关键问题','科学空白'];
  for(const [i,pattern] of patterns.entries()) {
    const figureCount=pattern.id==='evidence-chain'?3:pattern.figures[0];
    const num=Math.max(figureCount,1),ids=[];
    for(let j=0;j<num;j++){
      const id=`D${i+1}${String.fromCharCode(65+j)}`;ids.push(id);
      p.evidence.push({id,source:'demo',figure:`Demo ${i+1}`,panel:String.fromCharCode(65+j),location:`示例 ${i+1}，并非论文页码`,question:'演示证据如何与解释对应',method:'这里只展示数据字段，不代表真实实验',condition:'演示条件；真实任务填写剂量与时间',control:'演示对照；真实任务填写具体对照',observation:'无科研观察值；不支持任何真实科学结论',statistics:'无统计数据；实际任务核对 n、重复类型及检验',limitation:'本示例仅供版式和备注功能检查',keywords:['证据对应','讲图顺序'],status:'demo',visual_status:'not-applicable'});
      p.coverage.push({evidence:id,disposition:'included',critical:true});
    }
    const claim=`C${i+1}`;p.claims.push({id:claim,text:pattern.name,kind:'demo',evidence:ids});
    const bCount=pattern.id==='discussion-summary'?4:pattern.id==='evidence-chain'?3:pattern.id==='method-workflow'?5:pattern.blocks[0];
    p.slides.push({id:`S${i+1}`,title:pattern.name,slide_type:'demonstration',claim,section:i<2?'背景':i<8?'证据':'讨论',purpose:`检查${pattern.name}的可读性与图位`,relationship:pattern.relations[0],priority:'figure_first',pattern:pattern.id,evidence:ids,
      figures:Array.from({length:figureCount},(_,j)=>({label:pattern.id==='experiment-comparison'?['对照条件','干预条件'][j]:pattern.geometry==='columns'?names[j]??'证据比较':`证据 ${j+1}`,evidence:[ids[j]],aspect:pattern.geometry==='focus'?3:pattern.geometry==='stacked'?2.6:pattern.geometry==='flanked'?1:1.5,preserve:['保留图例与比例尺']})),
      blocks:Array.from({length:bCount},(_,j)=>({title:pattern.geometry==='workflow'?`步骤 ${j+1}`:pattern.geometry==='summary'?['主要结论','证据局限','进一步验证','研究启发'][j]:['科学问题','结果解释','证据边界'][j%3],text:pattern.geometry==='workflow'?'材料与条件\n操作与读出':pattern.geometry==='flanked'?'解释关键证据\n保留结论边界':pattern.geometry==='focus'?'用一句经核实的结论概括主图，并保留重要限定条件。':'填写经过核查的解释\n保留必要的限定条件',evidence:[ids[j%ids.length]]})),transition:i===9?'结束：回到核心科学问题。':'下一页展示另一种图文关系。'});
  }
  return p;
}
