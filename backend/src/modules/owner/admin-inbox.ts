import {BadRequestException,NotFoundException} from '@nestjs/common';
import {DatabaseService} from '../../common/database.service';
export class AdminInbox {
 constructor(private db:DatabaseService){}
 private scope=`EXISTS(SELECT 1 FROM admin_users a JOIN admin_user_roles u ON u.admin_user_id=a.id JOIN admin_role_permissions p ON p.role_id=u.role_id WHERE a.id=$1 AND a.status='active' AND p.permission_code=n.permission_code)`;
 async list(actor:string,page=1){
  if(!Number.isInteger(page)||page<1||page>10000)throw new BadRequestException();
  const items=(await this.db.query(`SELECT n.id::text,n.title,n.entity_id,n.target,n.created_at,r.read_at FROM admin_event_notifications n LEFT JOIN admin_notification_reads r ON r.notification_id=n.id AND r.admin_id=$1 WHERE ${this.scope} ORDER BY n.created_at DESC,n.id DESC LIMIT 30 OFFSET $2`,[actor,(page-1)*30])).rows;
  const unread=(await this.db.query(`SELECT count(*)::text n FROM admin_event_notifications n WHERE ${this.scope} AND NOT EXISTS(SELECT 1 FROM admin_notification_reads r WHERE r.notification_id=n.id AND r.admin_id=$1)`,[actor])).rows[0]!.n;
  return {items,unread,page};
 }
 async mark(actor:string,id:string,read:unknown){
  if(!/^\d{1,19}$/.test(id)||typeof read!=='boolean')throw new BadRequestException();
  return this.db.transaction(async tx=>{
   if(!(await tx.query(`SELECT 1 FROM admin_event_notifications n WHERE n.id=$2 AND ${this.scope}`,[actor,id])).rows.length)throw new NotFoundException();
   if(read)await tx.query('INSERT INTO admin_notification_reads(admin_id,notification_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[actor,id]);
   else await tx.query('DELETE FROM admin_notification_reads WHERE admin_id=$1 AND notification_id=$2',[actor,id]);
   return {saved:true};
  });
 }
}
