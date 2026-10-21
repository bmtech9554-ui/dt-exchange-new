import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const requiredAreas=['backend','flutter','admin','security','ledger','reconciliation','postgres','redis','blockchain','payout','kyc','bankVerification','notifications','storage','android','ios','backupRestore','monitoring','domains','organizationalApproval'];
export const manualRequiredAreas=requiredAreas.filter(a=>!['blockchain','payout','ios'].includes(a)).concat(['manualDeposits','manualPayouts','privateReceipts','androidWebsite']);
export const providerStatuses=['MOCK','SANDBOX','CONNECTED','VALIDATED','PRODUCTION_READY','NOT_CONFIGURED','BLOCKED'];
export function certify(evidence, now=Date.now()) {
 const blockers=[];
 const manual=evidence.operatingModel==='MANUAL_ANDROID';
 for(const area of (manual?manualRequiredAreas:requiredAreas)){const e=evidence.areas?.[area];
  if(!e || e.status!=='PASS' || !/^[a-f0-9]{64}$/.test(e.artifactSha256??'') || !e.reviewer || !Number.isFinite(Date.parse(e.checkedAt)) || Date.parse(e.checkedAt)>now || now-Date.parse(e.checkedAt)>7*86400000)
   blockers.push(area+': current reviewed acceptance evidence required');
 }
 for(const f of evidence.findings??[]) if(f.severity==='CRITICAL'||f.severity==='HIGH'&&!(f.approvedMitigation?.reviewer&&f.approvedMitigation?.reference)) blockers.push('security: unresolved '+f.severity);
 if(!manual && evidence.financialMode!=='VALIDATED') blockers.push('financial providers: validated adapters required');
 return {status:blockers.length?'BLOCKED_FOR_PRODUCTION':'READY_FOR_PRODUCTION',blockers};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const evidence=JSON.parse(await readFile(process.argv[2]??'release/acceptance.json','utf8'));const result=certify(evidence);console.log(JSON.stringify(result,null,2));if(result.blockers.length)process.exitCode=2;}catch{console.error('RELEASE_EVIDENCE_UNAVAILABLE');process.exitCode=1;}}
