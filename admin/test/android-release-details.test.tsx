import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {AndroidReleaseDetails} from '../src/components/android-release-details';
const release={version_name:'1.0.0',version_code:8011,size_bytes:'59383620',sha256:'a'.repeat(64),certificate_sha256:'b'.repeat(64),active:true,created_at:'2026-10-08T10:44:54.556Z',apk_url:'https://dtexchange.app/downloads/DTExchange.apk',download_url:'https://dtexchange.app/download',attestation_status:'VERIFIED',signing_status:'VERIFIED_BY_RELEASE_ATTESTATION'};
test('owner release details show trusted metadata and official download',()=>{
 const h=renderToStaticMarkup(<AndroidReleaseDetails release={release}/>);
 for(const value of ['8011','1.0.0','59383620 bytes',release.sha256,release.certificate_sha256,'Verified by signed release attestation','Release attestation status','Current public release',release.created_at,release.apk_url])assert.ok(h.includes(value),value);
});
test('missing evidence is unverified and historical releases have no misleading APK link',()=>{
 const h=renderToStaticMarkup(<AndroidReleaseDetails release={{...release,active:false,signing_status:undefined,attestation_status:undefined}}/>);
 assert.ok(h.includes('Unverified'));assert.ok(h.includes('Superseded'));assert.ok(!h.includes(`href="${release.apk_url}"`));
});
