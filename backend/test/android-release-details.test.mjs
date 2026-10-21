import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {AndroidService,releasePayload} from '../dist/modules/manual/android.service.js';
test('release history verifies evidence, excludes raw attestation and fails closed for tampering',async()=>{
 const pair=generateKeyPairSync('ed25519'), prior=process.env.APK_RELEASE_PUBLIC_KEY_B64,origins=process.env.APK_ALLOWED_ORIGINS;
 process.env.APK_RELEASE_PUBLIC_KEY_B64=Buffer.from(pair.publicKey.export({type:'spki',format:'pem'})).toString('base64');process.env.APK_ALLOWED_ORIGINS='https://dtexchange.app';
 try{
 const b={versionName:'1.0.0',versionCode:8011,minimumVersionCode:8008,apkUrl:'https://dtexchange.app/downloads/DTExchange.apk',downloadUrl:'https://dtexchange.app/download',sha256:'a'.repeat(64),certificateSha256:'b'.repeat(64),sizeBytes:59383620,releaseNotes:'Synthetic test',mandatory:false};
 const row={version_name:b.versionName,version_code:b.versionCode,minimum_version_code:b.minimumVersionCode,apk_url:b.apkUrl,download_url:b.downloadUrl,sha256:b.sha256,certificate_sha256:b.certificateSha256,size_bytes:String(b.sizeBytes),release_notes:b.releaseNotes,mandatory:false,active:true,attestation:sign(null,Buffer.from(releasePayload(b)),pair.privateKey).toString('base64')};
 let permission;const svc=new AndroidService({query:async()=>({rows:[row]})},{permission:async(_,p)=>{permission=p;}});
 const [r]=await svc.history('synthetic-admin');assert.equal(permission,'ANDROID_RELEASE_PUBLISH');assert.equal(r.attestation_status,'VERIFIED');assert.equal(r.signing_status,'VERIFIED_BY_RELEASE_ATTESTATION');assert.equal(r.apk_url,b.apkUrl);assert.equal(r.size_bytes,'59383620');assert.equal('attestation' in r,false);
 row.sha256='c'.repeat(64);assert.equal((await svc.history('synthetic-admin'))[0].signing_status,'UNVERIFIED');
 row.apk_url='https://evil.invalid/debug.apk';assert.equal((await svc.history('synthetic-admin'))[0].apk_url,null);
 delete process.env.APK_RELEASE_PUBLIC_KEY_B64;assert.equal((await svc.history('synthetic-admin'))[0].attestation_status,'UNVERIFIED');
 await assert.rejects(new AndroidService({query:async()=>{throw Error('must not query');}},{permission:async()=>{throw Error('forbidden');}}).history('unauthorized'),/forbidden/);
 }finally{if(prior===undefined)delete process.env.APK_RELEASE_PUBLIC_KEY_B64;else process.env.APK_RELEASE_PUBLIC_KEY_B64=prior;if(origins===undefined)delete process.env.APK_ALLOWED_ORIGINS;else process.env.APK_ALLOWED_ORIGINS=origins;}
});
