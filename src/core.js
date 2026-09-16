export const SALES_HEADERS=['Product Id','Order Date','SKU ID','Gross Units','Cancellation Units','Final Sale Units'];
export const MASTER_HEADERS=['Item ID','Product Id'];
const norm=v=>String(v??'').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[ _-]/g,'');
export function validateRows(matrix,kind){
 if(matrix.length<2)throw Error('The file needs a header row and at least one data row.');
 const required=kind==='sales'?SALES_HEADERS:MASTER_HEADERS;
 const headers=matrix[0].map(norm);
 if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw Error('Duplicate column headers found.');
 const missing=required.filter(h=>!headers.includes(norm(h)));if(missing.length)throw Error('Missing columns: '+missing.join(', '));
 const result=[]; const mappings=new Map();
 for(let i=1;i<matrix.length;i++){
  if(matrix[i].every(v=>String(v??'').trim()===''))continue;
  const row=Object.fromEntries(required.map(h=>[h,String(matrix[i][headers.indexOf(norm(h))]??'').trim()]));
  for(const h of required)if(!row[h])throw Error(`Row ${i+1}: ${h} is empty.`);
  if(kind==='sales'){
   for(const h of SALES_HEADERS.slice(3)){if(!/^\d+$/.test(row[h])||!Number.isSafeInteger(Number(row[h])))throw Error(`Row ${i+1}: ${h} must be a non-negative whole number.`);row[h]=Number(row[h]);}
   if(row['Cancellation Units']>row['Gross Units'])throw Error(`Row ${i+1}: Cancellation Units exceeds Gross Units.`);
  }else{
   const p=row['Product Id'];if(mappings.has(p)&&mappings.get(p)!==row['Item ID'])throw Error(`Row ${i+1}: Product ${p} maps to more than one Item ID.`);
   if(mappings.has(p))continue;mappings.set(p,row['Item ID']);
  }
  result.push(row);
 }
 if(!result.length)throw Error('No data rows found.');
 if(result.length>50000)throw Error('Use a maximum of 50,000 rows per file.');
 return result;
}
export function project(sales,master){
 const map=new Map(master.map(r=>[r['Product Id'],r['Item ID']]));const groups=new Map();
 for(const r of sales){const key=JSON.stringify([r['Product Id'],r['SKU ID']]);const g=groups.get(key)||{'Item ID':map.get(r['Product Id'])||'','Product Id':r['Product Id'],'SKU ID':r['SKU ID'],'Gross Units(total)':0};g['Gross Units(total)']+=r['Gross Units'];if(!Number.isSafeInteger(g['Gross Units(total)']*5))throw Error('Unit total exceeds the safe calculation limit.');groups.set(key,g);}
 return [...groups.values()].map(g=>({...g,'Projected unit':Math.ceil(g['Gross Units(total)']*5/4)})).sort((a,b)=>a['Item ID'].localeCompare(b['Item ID'])||a['Product Id'].localeCompare(b['Product Id'])||a['SKU ID'].localeCompare(b['SKU ID']));
}
export function itemTotals(rows){const m=new Map();for(const r of rows){const id=r['Item ID'];if(!id)continue;const g=m.get(id)||{'Item ID':id,'Gross Units(total)':0};g['Gross Units(total)']+=r['Gross Units(total)'];m.set(id,g);}return [...m.values()].map(r=>({...r,'Projected unit':Math.ceil(r['Gross Units(total)']*5/4)}));}
