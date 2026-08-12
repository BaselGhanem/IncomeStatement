(function(){
  "use strict";
  const aliases={
    accountCode:["account code","gl code","ledger code","sap gl account","رقم الحساب"],
    accountName:["account","account name","gl account","ledger account","sap gl account description","الحساب","اسم الحساب"],
    amount:["amount","value","actual","balance","net amount","المبلغ","القيمة"],
    date:["date","transaction date","posting date","period date","التاريخ"],
    category:["category","group","classification","account group","financial category"],
    department:["department","dept","القسم"],costCenter:["cost center","cost centre","cc"],
    branch:["branch","location","الفرع"],businessUnit:["business unit","businessunit","bu","division"],
    currency:["currency","curr","عملة"],scenario:["scenario","version","type","actual budget","actual/budget"],
    budget:["budget","budget amount","plan","planned"],prior:["prior year","previous year","py"]
  };
  const monthMap={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
  const clean=v=>String(v??"").replace(/[\u200e\u200f]/g,"").replace(/\s+/g," ").trim();
  const key=v=>clean(v).toLowerCase().replace(/[_\-\/]+/g," ").replace(/\s+/g," ");
  function score(header,list){const h=key(header);let best=0;list.forEach(a=>{const k=key(a);if(h===k)best=Math.max(best,1);else if(h.includes(k)||k.includes(h))best=Math.max(best,.72)});return best}
  function detect(headers){const result={};Object.entries(aliases).forEach(([field,list])=>{let best={header:null,score:0};headers.forEach(header=>{const s=score(header,list);if(s>best.score)best={header,score:s}});result[field]=best});return result}
  function parseNumber(value){if(typeof value==="number")return Number.isFinite(value)?value:null;if(value===null||value===undefined||value==="")return null;let s=clean(value).replace(/\s/g,"");const negative=/^\(.*\)$/.test(s);s=s.replace(/[(),]/g,"").replace(/[^0-9.\-]/g,"");if(!s||s==="-")return null;const n=Number(s);return Number.isFinite(n)?(negative?-Math.abs(n):n):null}
  function excelDate(value){if(value instanceof Date&&!Number.isNaN(value))return value;if(typeof value==="number"&&value>20000&&value<80000){const d=XLSX.SSF.parse_date_code(value);return d?new Date(d.y,d.m-1,d.d):null}const parsed=new Date(value);return Number.isNaN(parsed.getTime())?null:parsed}
  function periodHeader(header,index){const raw=key(header);const m=raw.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?$/);if(m)return{header,month:monthMap[m[1]],year:Number(m[2])||null,index};const y=raw.match(/^(20\d{2})[\s\-\/](0?[1-9]|1[0-2])$/);return y?{header,month:Number(y[2]),year:Number(y[1]),index}:null}
  function duplicateKey(row,headers){return headers.map(h=>clean(row[h])).join("¦")}
  function inspectRows(rows,headers){let blank=0,duplicates=0;const seen=new Set();rows.forEach(row=>{if(headers.every(h=>clean(row[h])==="")){blank++;return}const k=duplicateKey(row,headers);if(seen.has(k))duplicates++;seen.add(k)});return{blank,duplicates}}
  async function parse(file){
    if(!/\.(xlsx|xls|csv)$/i.test(file.name))throw new Error("Unsupported file. Choose an XLSX, XLS, or CSV workbook.");
    if(!window.XLSX)throw new Error("The Excel reader could not load. Check your connection and retry.");
    const data=await file.arrayBuffer();let wb;try{wb=XLSX.read(data,{type:"array",cellDates:true,cellNF:true})}catch(e){throw new Error("The workbook could not be read. It may be damaged or password protected.")}
    if(!wb.SheetNames.length)throw new Error("This workbook contains no worksheets.");
    const sheets=wb.SheetNames.map(name=>{
      const raw=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,raw:true});
      const headerIndex=raw.findIndex(r=>r.some(v=>clean(v)!==""));
      if(headerIndex<0)return{name,headers:[],rows:[],rawRows:0};
      const headers=raw[headerIndex].map((h,i)=>clean(h)||`Column ${i+1}`);
      const objects=raw.slice(headerIndex+1).map((r,rowIndex)=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??null]).concat([["__row",rowIndex+headerIndex+2]])));
      const periods=headers.map(periodHeader).filter(Boolean);
      return{name,headers,rows:objects,rawRows:raw.length,headerIndex,detection:detect(headers),periodColumns:periods,quality:inspectRows(objects,headers)};
    });
    return{fileName:file.name,fileSize:file.size,sheets,workbook:wb};
  }
  function normalize(sheet,mapping,options={}){
    const issues=[];const records=[];const excluded=[];const headers=sheet.headers;const periods=sheet.periodColumns;const wide=periods.length>=2&&!mapping.amount;
    const dimensions=["category","department","costCenter","branch","businessUnit","currency","scenario"];
    let invalidAmount=0,missingAccount=0,invalidDate=0,blank=0,subtotal=0;
    const sourceRows=sheet.rows.filter(row=>{const isBlank=headers.every(h=>clean(row[h])==="");if(isBlank)blank++;return !isBlank});
    const seen=new Set();let duplicates=0;
    sourceRows.forEach(row=>{
      const signature=duplicateKey(row,headers);if(seen.has(signature))duplicates++;seen.add(signature);
      const accountName=clean(row[mapping.accountName]);const accountCode=clean(row[mapping.accountCode]);
      if(!accountName&&!accountCode){missingAccount++;excluded.push({row:row.__row,reason:"Missing account"});return}
      const isSubtotal=/^(total|subtotal|net\s|gross profit|operating profit|ebitda|ebit|net profit)/i.test(accountName);
      if(isSubtotal){subtotal++;excluded.push({row:row.__row,reason:"Probable source subtotal",source:row});return}
      const base={accountCode,accountName,sourceRow:row.__row,source:row};dimensions.forEach(d=>base[d]=mapping[d]?clean(row[mapping[d]]):"");
      if(wide){periods.forEach((p,i)=>{const amount=parseNumber(row[p.header]);if(amount===null&&clean(row[p.header])!==""){invalidAmount++;return}if(amount===null)return;const year=p.year||Number(options.defaultYear)||new Date().getFullYear();const date=new Date(year,p.month-1,1);records.push({...base,amount,date,period:`${year}-${String(p.month).padStart(2,"0")}`,periodLabel:new Intl.DateTimeFormat("en",{month:"short",year:"numeric"}).format(date),periodIndex:i})})}
      else{const amount=parseNumber(row[mapping.amount]);if(amount===null){invalidAmount++;excluded.push({row:row.__row,reason:"Missing or invalid amount",source:row});return}const date=mapping.date?excelDate(row[mapping.date]):null;if(mapping.date&&!date){invalidDate++;excluded.push({row:row.__row,reason:"Invalid date",source:row});return}const period=date?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`:"All periods";records.push({...base,amount,date,period,periodLabel:date?new Intl.DateTimeFormat("en",{month:"short",year:"numeric"}).format(date):"All periods"})}
    });
    if(!records.length)issues.push("No usable financial values were found after validation.");
    if(wide&&periods.some(p=>!p.year))issues.push(`Month columns have no year. ${options.defaultYear||new Date().getFullYear()} is used for period ordering only.`);
    if(missingAccount)issues.push(`${missingAccount} row(s) have no account identifier.`);if(invalidAmount)issues.push(`${invalidAmount} value(s) are blank or invalid numeric amounts.`);if(subtotal)issues.push(`${subtotal} probable subtotal row(s) were excluded to prevent double counting.`);if(duplicates)issues.push(`${duplicates} exact duplicate source row(s) detected and retained for review.`);if(invalidDate)issues.push(`${invalidDate} record(s) contain invalid dates.`);
    return{records,excluded,issues,quality:{total:sheet.rows.length,valid:records.length,excluded:excluded.length,warnings:issues.length,unmapped:0,blank,duplicates,invalidAmount,missingAccount,subtotal},wide};
  }
  window.ExcelParser={parse,normalize,detect,parseNumber,clean,aliases};
})();
