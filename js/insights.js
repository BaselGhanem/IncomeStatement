(function(){
  "use strict";
  const pct=v=>v===null?"—":`${Math.abs(v*100).toFixed(1)}%`;
  const pp=v=>`${Math.abs(v*100).toFixed(1)} ${window.I18n?.current()==="ar"?"نقطة مئوية":"percentage points"}`;
  function generate(statement,drivers){
    const c=statement.currentMetrics,p=statement.previousMetrics,insights=[],attention=[];
    const ar=window.I18n?.current()==="ar";
    if(c.hasRevenue){
      const revChange=FinancialEngine.safePct(c.revenue,p.revenue);if(revChange!==null)insights.push({score:Math.abs(revChange)*100,text:ar?`الإيرادات ${revChange>=0?"ارتفعت":"انخفضت"} بنسبة ${pct(revChange)} مقارنة بالفترة المرجعية.`:`Revenue ${revChange>=0?"increased":"decreased"} ${pct(revChange)} versus the comparison period.`});
      const gm=c.revenue?c.gross/c.revenue:null,pgm=p.revenue?p.gross/p.revenue:null;if(gm!==null&&pgm!==null){const d=gm-pgm;insights.push({score:Math.abs(d)*150,text:ar?`هامش مجمل الربح ${d>=0?"تحسن":"انخفض"} من ${pct(pgm)} إلى ${pct(gm)}.`:`Gross margin ${d>=0?"improved":"declined"} from ${pct(pgm)} to ${pct(gm)}, a movement of ${pp(d)}.`});if(d<-.02)attention.push({title:ar?"انكماش هامش مجمل الربح":"Gross margin compression",detail:ar?`هامش مجمل الربح أقل من الفترة المرجعية بمقدار ${pp(d)}.`:`Gross margin is ${pp(d)} below the comparison period.`})}
      const nm=c.revenue?c.net/c.revenue:null,pnm=p.revenue?p.net/p.revenue:null;if(nm!==null&&pnm!==null){const d=nm-pnm;insights.push({score:Math.abs(d)*140,text:ar?`هامش صافي الربح ${d>=0?"تحسن":"انخفض"} بمقدار ${pp(d)} ليصل إلى ${pct(nm)}.`:`Net profit margin ${d>=0?"improved":"declined"} by ${pp(d)} to ${pct(nm)}.`})}
      if(c.net<0)attention.push({title:ar?"فترة خاسرة":"Loss-making period",detail:ar?"الفترة المحددة تحقق صافي خسارة وفق التصنيفات المؤكدة.":"The selected reporting period produces a net loss under the confirmed classifications."});
    }else attention.push({title:ar?"يلزم تصنيف الإيرادات":"Revenue classification required",detail:ar?"لا توجد حسابات إيرادات ضمن البيانات المفلترة، لذلك تم حجب مؤشرات الأرباح والهوامش.":"No revenue accounts are available in the filtered data, so profit and margin KPIs are withheld."});
    const payroll=c.categoryTotals.get("Payroll")||0;if(c.opex&&payroll)insights.push({score:Math.abs(payroll/c.opex)*50,text:ar?`تمثل الرواتب ${pct(payroll/c.opex)} من المصاريف التشغيلية.`:`Payroll represents ${pct(payroll/c.opex)} of operating expenses.`});
    const expenseChange=FinancialEngine.safePct(c.opex,p.opex);if(expenseChange!==null)insights.push({score:Math.abs(expenseChange)*80,text:ar?`المصاريف التشغيلية ${expenseChange>=0?"ارتفعت":"انخفضت"} بنسبة ${pct(expenseChange)} مقارنة بالفترة المرجعية.`:`Operating expenses ${expenseChange>=0?"increased":"decreased"} ${pct(expenseChange)} versus the comparison period.`});
    const neg=drivers.filter(d=>d.benefit<0);const totalNeg=neg.reduce((s,d)=>s+Math.abs(d.benefit),0);const top3=neg.slice(0,3).reduce((s,d)=>s+Math.abs(d.benefit),0);if(totalNeg&&top3)insights.push({score:top3/totalNeg*40,text:ar?`تفسر أكبر ثلاثة تحركات سلبية ${pct(top3/totalNeg)} من إجمالي الأثر السلبي المحدد.`:`The three largest unfavorable account movements explain ${pct(top3/totalNeg)} of total identified negative contribution.`});
    neg.slice(0,3).forEach(d=>{const base=Math.abs(d.previous);const movement=base?Math.abs(d.variance)/base:null;if(movement!==null&&movement>.2)attention.push({title:ar?`تحرك جوهري — ${d.accountName}`:`Material movement — ${d.accountName}`,detail:ar?`تحرك تصنيف ${window.I18n?.t(d.category)||d.category} بنسبة ${pct(movement)} مقارنة بالفترة المرجعية.`:`${d.category} moved ${pct(movement)} versus the comparison period.`})});
    return{insights:insights.sort((a,b)=>b.score-a.score).slice(0,6).map(i=>i.text),attention:attention.slice(0,5)};
  }
  window.InsightEngine={generate};
})();
