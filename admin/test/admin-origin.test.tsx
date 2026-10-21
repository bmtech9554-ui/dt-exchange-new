import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedAdminOrigin} from '../src/lib/admin-origin';
const official='https://admin.dtexchange.app';
const request=(origin?:string)=>new Request('http://localhost:3000/api/operations/login',{method:'POST',headers:{...(origin?{origin}:{}),'x-forwarded-host':'attacker.invalid','x-forwarded-proto':'https'}});
test('configured public admin origin works behind an internal HTTP reverse proxy',()=>{
 assert.equal(isAllowedAdminOrigin(request(official),official,true),true);
});
test('production origin protection fails closed for missing, invalid and insecure configuration',()=>{
 for(const configured of [undefined,'bad','http://admin.dtexchange.app',official+'/path',official+'?x=1','https://user:password@admin.dtexchange.app'])assert.equal(isAllowedAdminOrigin(request(official),configured,true),false);
});
test('missing, null, lookalike, sibling and spoofed proxy origins remain rejected',()=>{
 for(const origin of [undefined,'null','https://admin.dtexchange.app.attacker.invalid','https://dtexchange.app','https://attacker.invalid','http://localhost:3000'])assert.equal(isAllowedAdminOrigin(request(origin),official,true),false);
});
test('local development retains exact same-origin protection',()=>{
 assert.equal(isAllowedAdminOrigin(request('http://localhost:3000'),undefined,false),true);
 assert.equal(isAllowedAdminOrigin(request(official),undefined,false),false);
});
