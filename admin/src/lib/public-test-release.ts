export const testApkUrl='https://dtexchange.app/downloads/test/DTExchange-test.apk';
export function validTestRelease(value:unknown){
  const r=value as Record<string,unknown>;
  return !!r && r.applicationId==='com.dtexchange.dt_exchange.publictest' && r.versionCode===8019 && r.versionName==='1.0.0' && r.publicTestMode===true && r.realMoney===false && r.debuggable===false && r.signatureVerified===true && r.physicalDeviceValidation==='PASSED' && r.certificateSha256==='475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c' && typeof r.sha256==='string' && /^[a-f0-9]{64}$/.test(r.sha256) && Number.isSafeInteger(r.sizeBytes) && Number(r.sizeBytes)>0 && r.apiBaseUrl==='https://dtexchange.app/test-api/api/v1' && typeof r.publishedAt==='string' && Number.isFinite(Date.parse(r.publishedAt));
}
export async function testReleaseMetadata(){
  try{
    if(process.env.DT_PUBLIC_TEST_METADATA_FILE){
      const {readFile}=await import('node:fs/promises');
      const data=JSON.parse(await readFile(process.env.DT_PUBLIC_TEST_METADATA_FILE,'utf8'));
      return validTestRelease(data)?data:null;
    }
    const response=await fetch('https://dtexchange.app/downloads/test/release.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok)return null;
    const data=await response.json();return validTestRelease(data)?data:null;
  }catch{return null;}
}
