import {BadRequestException,ConflictException,ForbiddenException} from '@nestjs/common';
import {z} from 'zod';
import {DatabaseService,SqlClient} from '../../common/database.service';
import {SecurityService} from '../../common/security.service';
import {LedgerService} from '../ledger/ledger.service';
import {decimal} from '../rates/money';
import {referralProgramPaused} from './referral-availability';

export const registrationPolicySchema=z.object({enabled:z.boolean(),rewardUsdt:z.string().regex(/^\d{1,6}(\.\d{1,6})?$/).refine(v=>decimal(v,6)>0n),event:z.literal('REGISTRATION_OTP'),creditMode:z.literal('MANUAL_RELEASE')}).strict();
export class RegistrationRewards {
 constructor(private db:DatabaseService,private ledger:LedgerService,private security:SecurityService){}
 async policy(tx:SqlClient=this.db){const r=(await tx.query("SELECT value,version,updated_at FROM system_settings WHERE key='registration_referral_policy'")).rows[0];return r?{...r,value:registrationPolicySchema.parse(r.value)}:null;}
 async permission(actor:string,permission:string,tx:SqlClient=this.db){
  if(!(await tx.query("SELECT 1 FROM admin_users a JOIN admin_user_roles u ON u.admin_user_id=a.id JOIN admin_role_permissions p ON p.role_id=u.role_id WHERE a.id=$1 AND a.status='active' AND p.permission_code=$2",[actor,permission])).rows.length)throw new ForbiddenException();
 }
 async verified(tx:SqlClient,uid:string){
  if(referralProgramPaused())return;
  const r=(await tx.query('SELECT * FROM referrals WHERE referred_user_id=$1 FOR UPDATE',[uid])).rows[0];
  if(!r||r.rule_snapshot?.event!=='REGISTRATION_OTP'||r.lifecycle==='REJECTED'||r.review_required)return;
  const rule=registrationPolicySchema.parse(r.rule_snapshot);
  if(!rule.enabled||!(await this.policy(tx))?.value.enabled)return;
  const users=(await tx.query("SELECT id FROM users WHERE id=ANY($1::uuid[]) AND status='active' AND (mobile_verified_at IS NOT NULL OR ($2 AND email_verified_at IS NOT NULL))",[[r.referrer_id,uid],process.env.NODE_ENV!=='production'])).rows;
  if(users.length!==2)return;
  const risky=(await tx.query(`SELECT 1 WHERE
   EXISTS(SELECT 1 FROM sessions a JOIN sessions b ON a.device_id_hash=b.device_id_hash WHERE a.user_id=$1 AND b.user_id=$2)
   OR EXISTS(SELECT 1 FROM risk_flags WHERE user_id=ANY($3::uuid[]) AND state<>'resolved')
   OR EXISTS(SELECT 1 FROM system_settings WHERE key='synthetic_device_validation' AND value->>'userId'=ANY($4::text[]))`,[r.referrer_id,uid,[r.referrer_id,uid],[r.referrer_id,uid]])).rows.length;
  if(risky){await tx.query("UPDATE referrals SET review_required=true,rejection_code='REVIEW_REQUIRED' WHERE id=$1",[r.id]);await this.security.audit(tx,uid,'referral.registration_review',r.id);return;}
  const added=(await tx.query('INSERT INTO referral_reward_entries(referral_id,user_id,amount_usdt,policy_snapshot) VALUES($1,$2,$3,$4) ON CONFLICT(referral_id) DO NOTHING RETURNING id',[r.id,r.referrer_id,rule.rewardUsdt,JSON.stringify(rule)])).rows[0];
  if(!added)return;
  await tx.query("UPDATE referrals SET lifecycle='QUALIFIED',status='qualified',reward_checked_at=now() WHERE id=$1",[r.id]);
  await this.security.audit(tx,uid,'referral.registration_qualified',r.id,{amountUsdt:rule.rewardUsdt,creditMode:'MANUAL_RELEASE',spendableWalletCredited:false});
 }
 async overview(uid:string){
  const p=await this.policy();
  const stats=(await this.db.query(`SELECT
   (SELECT count(*)::int FROM referrals WHERE referrer_id=$1) total,
   coalesce(sum(e.amount_usdt) FILTER(WHERE r.lifecycle<>'REJECTED'),0)::text earned,
   coalesce(sum(e.amount_usdt) FILTER(WHERE x.reward_id IS NULL AND r.lifecycle<>'REJECTED' AND NOT r.review_required),0)::text available
   FROM referral_reward_entries e JOIN referrals r ON r.id=e.referral_id LEFT JOIN referral_reward_releases x ON x.reward_id=e.id WHERE e.user_id=$1`,[uid])).rows[0]!;
  const history=(await this.db.query(`SELECT r.id,u.public_user_id::text referred_public_user_id,r.created_at,e.amount_usdt::text reward_usdt,
   CASE WHEN r.lifecycle='REJECTED' THEN 'REJECTED' WHEN r.review_required THEN 'REVIEW_REQUIRED' WHEN x.reward_id IS NOT NULL THEN 'RELEASED' WHEN e.id IS NOT NULL THEN 'PENDING_MANUAL_RELEASE' ELSE 'AWAITING_OTP' END reward_status
   FROM referrals r JOIN users u ON u.id=r.referred_user_id LEFT JOIN referral_reward_entries e ON e.referral_id=r.id LEFT JOIN referral_reward_releases x ON x.reward_id=e.id WHERE r.referrer_id=$1 AND r.rule_snapshot->>'event'='REGISTRATION_OTP' ORDER BY r.created_at DESC,r.id LIMIT 50`,[uid])).rows;
  return {registrationPolicy:p?.value,totalReferrals:stats.total,totalEarnedUsdt:stats.earned,availableReferralBalanceUsdt:stats.available,referralBalanceSpendable:false,history};
 }
 async admin(actor:string,page=1){
  await this.permission(actor,'referrals.read');
  if(!Number.isInteger(page)||page<1||page>10000)throw new BadRequestException();
  const permissions=new Set((await this.db.query("SELECT DISTINCT p.permission_code FROM admin_user_roles u JOIN admin_role_permissions p ON p.role_id=u.role_id WHERE u.admin_user_id=$1 AND p.permission_code IN ('referrals.review','referrals.release')",[actor])).rows.map(r=>r.permission_code));
  const rows=(await this.db.query(`SELECT r.id,r.code,r.created_at,r.lifecycle,r.review_required,u.public_user_id::text referrer_public_id,v.public_user_id::text referred_public_id,e.id reward_id,e.amount_usdt::text reward_usdt,e.policy_snapshot,x.created_at released_at FROM referrals r JOIN users u ON u.id=r.referrer_id JOIN users v ON v.id=r.referred_user_id LEFT JOIN referral_reward_entries e ON e.referral_id=r.id LEFT JOIN referral_reward_releases x ON x.reward_id=e.id ORDER BY r.created_at DESC,r.id LIMIT 50 OFFSET $1`,[(page-1)*50])).rows;
  return rows.map(r=>({...r,canReview:permissions.has('referrals.review'),canRelease:permissions.has('referrals.release')}));
 }
 async settings(actor:string){await this.permission(actor,'referrals.rules');return this.policy();}
 async save(actor:string,body:unknown){await this.permission(actor,'referrals.rules');const b=z.object({version:z.number().int().positive(),confirm:z.literal(true),reason:z.string().trim().min(10).max(500),value:registrationPolicySchema}).strict().safeParse(body);if(!b.success)throw new BadRequestException('Invalid referral settings');return this.db.transaction(async tx=>{const old=(await tx.query("SELECT * FROM system_settings WHERE key='registration_referral_policy' FOR UPDATE")).rows[0];if(!old||old.version!==b.data.version)throw new ConflictException('Settings changed; reload');await tx.query("UPDATE system_settings SET value=$1,version=version+1,updated_at=now() WHERE key='registration_referral_policy'",[JSON.stringify(b.data.value)]);await this.audit(tx,actor,'referral.policy.changed','registration_referral_policy',{before:old.value,after:b.data.value,reason:b.data.reason,effectiveAt:new Date().toISOString()});return {saved:true};});}
 async release(actor:string,id:string,body:unknown){
  await this.permission(actor,'referrals.release');const b=z.object({confirm:z.literal(true),reason:z.string().trim().min(10).max(500)}).strict().safeParse(body);if(!b.success)throw new BadRequestException();
  if(process.env.TRANSACTIONS_ENABLED!=='true'||process.env.REFERRAL_REWARD_RELEASE_ENABLED==='false')throw new ForbiddenException('Financial execution paused');
  return this.db.transaction(async tx=>{
   await this.permission(actor,'referrals.release',tx);
   const controls=(await tx.query("SELECT value FROM system_settings WHERE key='operational_controls' FOR SHARE")).rows[0]?.value;
   if(!controls||controls.mode!=='NORMAL'||controls.referrals!==true)throw new ForbiddenException('Referral release paused');
   const initial=(await tx.query('SELECT user_id FROM referral_reward_entries WHERE id=$1',[id])).rows[0];if(!initial)throw new BadRequestException('Reward unavailable');
   const u=(await tx.query('SELECT status FROM users WHERE id=$1 FOR UPDATE',[initial.user_id])).rows[0];
   const r=(await tx.query('SELECT e.*,r.review_required,r.lifecycle,r.referred_user_id FROM referral_reward_entries e JOIN referrals r ON r.id=e.referral_id WHERE e.id=$1 FOR UPDATE OF e,r',[id])).rows[0];
   if(!r)throw new BadRequestException('Reward unavailable');
   if((await tx.query('SELECT 1 FROM referral_reward_releases WHERE reward_id=$1',[id])).rows.length)return {released:true,duplicate:true};
   if(u?.status!=='active'||r.review_required||r.lifecycle!=='QUALIFIED'||(await tx.query("SELECT 1 FROM system_settings WHERE key='synthetic_device_validation' AND value->>'userId'=$1",[r.user_id])).rows.length)throw new ForbiddenException('Reward requires review');
   if((await tx.query("SELECT 1 FROM risk_flags WHERE user_id=ANY($1::uuid[]) AND state<>'resolved' LIMIT 1",[[r.user_id,r.referred_user_id]])).rows.length)throw new ForbiddenException('Reward requires risk review');
   const available=await this.ledger.account(tx,r.user_id,'USDT','available');
   const expense=(await tx.query("INSERT INTO ledger_accounts(code,asset_symbol,kind,bucket,normal_side) VALUES('platform:USDT:referral-expense','USDT','expense','adjustment','debit') ON CONFLICT(code) DO UPDATE SET code=excluded.code RETURNING id")).rows[0]!.id;
   await this.ledger.post(tx,'registration-referral:'+id,'referral',id,[{account:expense,asset:'USDT',side:'debit',amount:String(r.amount_usdt)},{account:available,asset:'USDT',side:'credit',amount:String(r.amount_usdt)}],undefined,actor);
   await tx.query("INSERT INTO referral_reward_releases(reward_id,admin_id,journal_id,reason) SELECT $1,$2,id,$3 FROM ledger_journals WHERE event_key=$4",[id,actor,b.data.reason,'registration-referral:'+id]);
   await this.audit(tx,actor,'referral.reward.released',id,{amountUsdt:String(r.amount_usdt),reason:b.data.reason});return {released:true};
  });
 }
 private async audit(tx:SqlClient,actor:string,action:string,id:string,data:unknown){await tx.query("INSERT INTO audit_logs(actor_type,actor_id,action,entity_type,entity_id,request_id,sanitized_changes) VALUES('admin',$1,$2,'referral',$3,gen_random_uuid(),$4)",[actor,action,id,JSON.stringify(data)]);}
}
