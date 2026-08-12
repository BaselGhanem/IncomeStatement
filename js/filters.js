(function(){
  "use strict";
  const DIMENSIONS=["department","costCenter","branch","businessUnit","currency","scenario"];
  const labels={department:"Department",costCenter:"Cost Center",branch:"Branch",businessUnit:"Business Unit",currency:"Currency",scenario:"Scenario"};
  function available(records){return DIMENSIONS.filter(d=>records.some(r=>r[d])).map(d=>({key:d,label:labels[d],values:[...new Set(records.map(r=>r[d]).filter(Boolean))].sort()}))}
  function apply(records,state,excludeDimension=null){return records.filter(r=>Object.entries(state).every(([k,v])=>k===excludeDimension||!v||v==="__all__"||r[k]===v))}
  function contextual(records,state){return available(records).map(d=>({...d,values:[...new Set(apply(records,state,d.key).map(r=>r[d.key]).filter(Boolean))].sort()}))}
  window.FilterEngine={DIMENSIONS,available,apply,contextual,labels};
})();
