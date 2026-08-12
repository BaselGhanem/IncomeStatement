(function(){
  "use strict";
  const CATEGORIES=["Revenue","Contra Revenue","COGS","Selling Expense","Marketing Expense","Administrative Expense","Payroll","Depreciation & Amortization","Other Operating Expense","Other Income","Finance Cost","FX Gain / Loss","Tax","Other","Balance Sheet","Unmapped"];
  const expenseCategories=new Set(["COGS","Selling Expense","Marketing Expense","Administrative Expense","Payroll","Depreciation & Amortization","Other Operating Expense","Finance Cost","Tax"]);
  const opexCategories=new Set(["Selling Expense","Marketing Expense","Administrative Expense","Payroll","Depreciation & Amortization","Other Operating Expense"]);
  const balanceWords=/cash|bank|receivable|payable|capital|retained earnings|equipment|inventory|withholding|provision|advance payment|accrued|asset|liabilit|equity|petty cash/i;
  const rules=[
    ["Contra Revenue",/return|discount|rebate|sales allowance/i],["Revenue",/revenue|sales|turnover|service income|product income/i],["COGS",/cost of (goods|sales)|direct material|direct labor|purchase cost|freight in/i],
    ["Depreciation & Amortization",/depreciation|amortization/i],["Payroll",/salary|salaries|payroll|wage|social security|training tax contribution|personnel/i],["Marketing Expense",/marketing|advertis|promotion|campaign|brand/i],
    ["Selling Expense",/selling|sales commission|distribution|delivery|freight out/i],["Finance Cost",/interest|banks? charges?|finance cost|borrowing/i],["FX Gain / Loss",/foreign exchange|fx gain|fx loss|exchange difference/i],
    ["Tax",/income tax|corporate tax/i],["Other Income",/other income|gain on|miscellaneous income/i],["Administrative Expense",/professional fee|office|legal|audit|rent|utility|utilities|courier|stationery|insurance|registration|governmental fee|penalt/i],
    ["Other Operating Expense",/consumable|expense|maintenance|travel|telephone|internet/i]
  ];
  const clean=v=>String(v??"").trim();
  function savedMappings(){try{return JSON.parse(localStorage.getItem("lucent-account-mappings")||"{}")}catch{return{}}}
  function mappingKey(record){return `${clean(record.accountCode).toLowerCase()}|${clean(record.accountName).toLowerCase()}`}
  function classify(record){
    const custom=savedMappings()[mappingKey(record)];if(custom)return{category:custom,confidence:"user"};
    if(record.category&&CATEGORIES.includes(record.category))return{category:record.category,confidence:"source"};
    const text=`${record.accountCode} ${record.accountName}`;const code=clean(record.accountCode);
    if(/^[123]/.test(code))return{category:"Balance Sheet",confidence:"high"};
    for(const [category,regex] of rules)if(regex.test(text))return{category,confidence:"high"};
    if(balanceWords.test(text))return{category:"Balance Sheet",confidence:"high"};
    if(/^4/.test(code))return{category:"Revenue",confidence:"medium"};if(/^5/.test(code))return{category:"COGS",confidence:"medium"};if(/^6/.test(code))return{category:"Other Operating Expense",confidence:"medium"};if(/^7/.test(code))return{category:"Other",confidence:"low"};
    return{category:"Unmapped",confidence:"low"};
  }
  function economicValue(amount,category){if(category==="Revenue"||category==="Other Income")return amount<0?-amount:amount;if(category==="Contra Revenue")return Math.abs(amount);if(category==="FX Gain / Loss"||category==="Other")return -amount;return amount}
  function prepare(records){return records.map(r=>{const c=classify(r);return{...r,...c,economicAmount:economicValue(r.amount,c.category)}})}
  const sum=(arr,fn=r=>r.economicAmount)=>arr.reduce((a,r)=>a+(Number(fn(r))||0),0);
  const safePct=(a,b)=>b?((a-b)/Math.abs(b)):null;
  function byCategory(records){const map=new Map();records.forEach(r=>map.set(r.category,(map.get(r.category)||0)+r.economicAmount));return map}
  function metrics(records){
    const c=byCategory(records),revenue=(c.get("Revenue")||0)-(c.get("Contra Revenue")||0),cogs=c.get("COGS")||0,gross=revenue-cogs;
    const opex=[...opexCategories].reduce((a,k)=>a+(c.get(k)||0),0),da=c.get("Depreciation & Amortization")||0,ebitda=revenue?gross-(opex-da):null,operating=revenue?gross-opex:null;
    const otherIncome=c.get("Other Income")||0,other=c.get("Other")||0,finance=c.get("Finance Cost")||0,fx=c.get("FX Gain / Loss")||0,tax=c.get("Tax")||0;
    const pbt=operating===null?null:operating+otherIncome+other+fx-finance;const net=pbt===null?null:pbt-tax;
    return{revenue,cogs,gross,opex,da,ebitda,operating,otherIncome,other,finance,fx,tax,pbt,net,expenseTotal:cogs+opex+finance+tax,hasRevenue:Math.abs(revenue)>.000001,categoryTotals:c};
  }
  function periodSet(records){return[...new Set(records.map(r=>r.period))].sort()}
  function accountRollup(records){const map=new Map();records.forEach(r=>{if(r.category==="Balance Sheet")return;const key=mappingKey(r);if(!map.has(key))map.set(key,{key,accountCode:r.accountCode,accountName:r.accountName||r.accountCode,category:r.category,confidence:r.confidence,value:0,records:[]});const a=map.get(key);a.value+=r.economicAmount;a.records.push(r)});return[...map.values()]}
  function buildStatement(current,previous){
    const cm=metrics(current),pm=metrics(previous),currentAccounts=accountRollup(current),previousMap=new Map(accountRollup(previous).map(a=>[a.key,a.value]));
    const defs=[
      {category:"Revenue",label:"Revenue",type:"section"},{category:"Contra Revenue",label:"Sales returns & discounts",type:"section"},{metric:"revenue",label:"Net Revenue",type:"key-total",requires:"hasRevenue"},
      {category:"COGS",label:"Cost of sales",type:"section"},{metric:"gross",label:"Gross Profit",type:"key-total",requires:"hasRevenue"},
      {group:"opex",label:"Operating expenses",type:"section"},{metric:"opex",label:"Total Operating Expenses",type:"total"},
      {metric:"ebitda",label:"EBITDA",type:"key-total",requires:"hasRevenue"},{metric:"operating",label:"Operating Profit / EBIT",type:"key-total",requires:"hasRevenue"},
      {category:"Other Income",label:"Other income",type:"section"},{category:"Other",label:"Other income / expense",type:"section"},{category:"Finance Cost",label:"Finance costs",type:"section"},{category:"FX Gain / Loss",label:"FX gain / loss",type:"section"},
      {metric:"pbt",label:"Profit Before Tax",type:"total",requires:"hasRevenue"},{category:"Tax",label:"Income tax",type:"section"},{metric:"net",label:"Net Profit",type:"key-total",requires:"hasRevenue"}
    ];
    const lines=[];
    defs.forEach(def=>{
      if(def.requires&&!cm[def.requires])return;
      let accounts=[];if(def.group==="opex")accounts=currentAccounts.filter(a=>opexCategories.has(a.category));else if(def.category)accounts=currentAccounts.filter(a=>a.category===def.category);
      if(def.category&&!accounts.length)return;
      let currentValue,previousValue;
      if(def.metric){currentValue=cm[def.metric];previousValue=pm[def.metric]}
      else{currentValue=sum(accounts,a=>a.value);previousValue=accounts.reduce((s,a)=>s+(previousMap.get(a.key)||0),0)}
      const favorableDirection=def.metric||def.category==="Revenue"||def.category==="Other Income"?1:-1;
      lines.push({...def,id:def.metric||def.group||def.category,current:currentValue,previous:previousValue,variance:currentValue-previousValue,variancePct:safePct(currentValue,previousValue),revenuePct:cm.revenue?currentValue/cm.revenue:null,favorableDirection,accounts:accounts.sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).map(a=>({...a,previous:previousMap.get(a.key)||0}))});
    });
    return{lines,currentMetrics:cm,previousMetrics:pm,currentAccounts,previousMap};
  }
  function driverAnalysis(current,previous){
    const currentMap=new Map(accountRollup(current).map(a=>[a.key,a]));const previousMap=new Map(accountRollup(previous).map(a=>[a.key,a]));const keys=new Set([...currentMap.keys(),...previousMap.keys()]);
    return[...keys].map(key=>{const c=currentMap.get(key),p=previousMap.get(key);const account=c||p;const variance=(c?.value||0)-(p?.value||0);const benefit=(account.category==="Revenue"||account.category==="Other Income")?variance:-variance;return{...account,current:c?.value||0,previous:p?.value||0,variance,benefit}}).filter(d=>Math.abs(d.benefit)>.000001).sort((a,b)=>Math.abs(b.benefit)-Math.abs(a.benefit));
  }
  function saveMapping(key,category){const mappings=savedMappings();mappings[key]=category;localStorage.setItem("lucent-account-mappings",JSON.stringify(mappings))}
  window.FinancialEngine={CATEGORIES,expenseCategories,opexCategories,prepare,metrics,buildStatement,driverAnalysis,periodSet,accountRollup,safePct,saveMapping,mappingKey,sum};
})();
