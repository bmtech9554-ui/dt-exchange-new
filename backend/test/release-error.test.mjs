import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ForbiddenException, UnauthorizedException} from '@nestjs/common';
import {HttpErrorFilter} from '../dist/common/http-exception.filter.js';
function response(error) {
 let status, body;
 const res={status(s){status=s;return this;},json(b){body=b;},getHeader(){return 'safe-request-id';}};
 new HttpErrorFilter().catch(error,{switchToHttp:()=>({getResponse:()=>res,getRequest:()=>({path:'/api/v1/sell/quote'})})});
 return {status,body};
}
test('release gate stays forbidden but is not mislabeled as account review',()=>{
 const r=response(new ForbiddenException('Update Required'));
 assert.equal(r.status,403);
 assert.equal(r.body.error.code,'ANDROID_RELEASE_REQUIRED');
 assert.equal(r.body.error.message,'Transactions are unavailable until an approved Android release is enabled.');
 assert.doesNotMatch(r.body.error.message,/verification|account review/i);
});
test('genuine review and authentication restrictions remain enforced and redacted',()=>{
 const r=response(new ForbiddenException('Account review required'));
 assert.equal(r.status,403);assert.equal(r.body.error.code,'HTTP_403');
 assert.match(r.body.error.message,/review/);
 assert.equal(response(new UnauthorizedException()).status,401);
 assert.doesNotMatch(JSON.stringify(response(new ForbiddenException('private internal reason'))),/private internal reason/);
});
