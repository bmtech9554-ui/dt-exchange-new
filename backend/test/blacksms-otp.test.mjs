import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { BlackSmsOtpProvider } from "../dist/modules/auth/blacksms-otp.provider.js";
const d = () => ({challengeId:"synthetic", channel:"sms", destination:"+919876543210", code:"654321", expiresAt:new Date(Date.now()+60000)});
test("BlackSMS uses documented SMS payload and accepts only numeric success", async () => {
 const previous = {...process.env}, original = globalThis.fetch;
 Object.assign(process.env,{OTP_PROVIDER:"blacksms", BLACKSMS_API_KEY:"synthetic-key", BLACKSMS_SENDER_ID:"DTEST", BLACKSMS_ROUTE:"1"});
 let calls=0;
 try {
  globalThis.fetch=async (url, options) => {
   calls++; assert.equal(url,"https://blacksms.in/sms"); assert.equal(options.redirect,"error");
   assert.equal(options.headers.Authorization,"synthetic-key");
   assert.deepEqual(JSON.parse(options.body),{sender_id:"DTEST",variables_values:"654321",numbers:"9876543210",route:1});
   return Response.json({status:1,message:"OTP Sent"});
  };
  const provider=new BlackSmsOtpProvider(); await provider.send(d()); assert.equal(calls,1);
  for (const response of [() => Response.json({status:0,message:"secret diagnostic"}), () => Response.json({status:"1"}), () => Response.json({status:1},{status:403}), () => new Response("invalid")]) {
   globalThis.fetch=async () => response();
   await assert.rejects(provider.send(d()),e => e.message === "SMS authentication unavailable");
  }
  globalThis.fetch=async()=>{throw new Error("secret timeout diagnostic")};
  await assert.rejects(provider.send(d()),e=>e.message === "SMS authentication unavailable");
 } finally {globalThis.fetch=original; for(const k of Object.keys(process.env)) if(!(k in previous)) delete process.env[k]; Object.assign(process.env,previous);}
});
test("BlackSMS rejects invalid/expired OTP and configuration before network access", async()=>{
 const previous={...process.env},original=globalThis.fetch; let calls=0;
 Object.assign(process.env,{OTP_PROVIDER:"blacksms",BLACKSMS_API_KEY:"synthetic-key",BLACKSMS_SENDER_ID:"DTEST",BLACKSMS_ROUTE:"1"});
 globalThis.fetch=async()=>{calls++;throw new Error("unexpected call")};
 try {
  const p=new BlackSmsOtpProvider();
  for(const patch of [{destination:"+14155552671"},{channel:"email"},{code:"12"},{expiresAt:new Date(0)},{expiresAt:new Date("invalid")}]) await assert.rejects(p.send({...d(),...patch}));
  for(const key of ["BLACKSMS_API_KEY","BLACKSMS_SENDER_ID","BLACKSMS_ROUTE"]){const old=process.env[key];process.env[key]="";await assert.rejects(p.send(d()));process.env[key]=old;}
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in previous))delete process.env[k];Object.assign(process.env,previous);}
});
