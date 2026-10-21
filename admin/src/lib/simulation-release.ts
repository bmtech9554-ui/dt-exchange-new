import {validAndroidRelease} from './android-release';
const certificate='475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c';
export function validSimulationRelease(value:unknown){
 const r=value as Record<string,unknown>;
 return !!r && validAndroidRelease(r,['https://dtexchange.app']) && r.applicationId==='com.dtexchange.dt_exchange' && r.latestVersionCode===8021 && r.certificateSha256===certificate && r.signatureVerified===true && r.debuggable===false && r.simulation===true && r.realMoney===false && r.physicalDeviceValidation==='PASSED' && r.apiBaseUrl==='https://dtexchange.app/test-api/api/v1';
}
export async function simulationReleaseMetadata(){
 const path=process.env.DT_SIMULATION_RELEASE_FILE;
 if(!path)return null;
 try{
  const {readFile}=await import('node:fs/promises');
  const release=JSON.parse(await readFile(path,'utf8'));
  return validSimulationRelease(release)?release:null;
 }catch{return null;}
}
