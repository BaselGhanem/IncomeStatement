(function(){
  "use strict";
  const escape=value=>{const s=String(value??"");return/[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
  function download(name,content,type="text/csv;charset=utf-8"){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}
  function statement(lines,period,previous){const rows=[["Financial Line",period,previous,"Variance","Variance %","% Revenue"]];lines.forEach(l=>{rows.push([l.label,l.current,l.previous,l.variance,l.variancePct,l.revenuePct]);l.accounts.forEach(a=>rows.push([`  ${a.accountCode} ${a.accountName}`,a.value,a.previous,a.value-a.previous,"",""]))});download(`income-statement-${period}.csv`,`\uFEFF${rows.map(r=>r.map(escape).join(",")).join("\n")}`)}
  function records(records,name="account-detail.csv"){if(!records.length)return;const headers=Object.keys(records[0].source||{}).filter(h=>h!=="__row");const rows=[headers,...records.map(r=>headers.map(h=>r.source[h]))];download(name,`\uFEFF${rows.map(r=>r.map(escape).join(",")).join("\n")}`)}
  window.ExportEngine={statement,records,download};
})();
