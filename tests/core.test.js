import {test} from 'node:test';import assert from 'node:assert/strict';import {validateRows,project,itemTotals,SALES_HEADERS,MASTER_HEADERS} from '../src/core.js';
const master=validateRows([MASTER_HEADERS,['I1','P1'],['I1','P2']],'master');
test('aggregate before uplift and round only once',()=>{const sales=validateRows([SALES_HEADERS,['P1','2026-01-01','S1',100,5,95],['P1','2026-01-02','S1',60,0,60]],'sales');assert.equal(project(sales,master)[0]['Projected unit'],200);});
test('item total across products and SKU rows',()=>{const s=validateRows([SALES_HEADERS,['P1','2026-01-01','S1',1,0,1],['P2','2026-01-01','S2',1,0,1]],'sales');const r=project(s,master);assert.equal(r.length,2);assert.equal(itemTotals(r)[0]['Projected unit'],3);});
test('reject conflicting mappings and retain string IDs',()=>{assert.throws(()=>validateRows([MASTER_HEADERS,['001','P'],['002','P']],'master'),/more than one/);assert.equal(validateRows([MASTER_HEADERS,['001','0002']],'master')[0]['Item ID'],'001');});
test('unmapped sales visible',()=>{assert.equal(project([{'Product Id':'unknown','SKU ID':'X','Gross Units':12}],master)[0]['Item ID'],'');});
test('malformed unit values and headers rejected',()=>{for(const v of ['oops','',-1,2.5])assert.throws(()=>validateRows([SALES_HEADERS,['P','2026-01-01','S',v,0,0]],'sales'));assert.throws(()=>validateRows([['Item ID'],['I']],'master'),/Missing/);});
test('duplicate master pairs are deduplicated',()=>{assert.equal(validateRows([MASTER_HEADERS,['I','P'],['I','P']],'master').length,1);});
