import {BadRequestException} from "@nestjs/common";
import {SqlClient} from "../../common/database.service";
import {decimal,databaseUnits} from "../rates/money";
export async function checkDepositLimits(tx:SqlClient,uid:string,value:string,policy:any,day:string,exclude:string|null=null){
    if(decimal(value,6)<decimal(policy.minimumDeposit,6)) throw new BadRequestException(`Minimum deposit is ${policy.minimumDeposit} USDT.`);
    const used=(await tx.query("SELECT coalesce(sum(coalesce(verified_amount,submitted_amount)),0)::text used FROM manual_deposit_requests WHERE user_id=$1 AND coalesce(limit_day,(created_at AT TIME ZONE 'Asia/Kolkata')::date)=$2::date AND status NOT IN ('REJECTED','CANCELLED') AND ($3::uuid IS NULL OR id<>$3::uuid)",[uid,day,exclude])).rows[0]!.used;
    if(decimal(used,6)+decimal(value,6)>decimal(policy.dailyDepositLimit,6)) throw new BadRequestException(`Daily deposit limit of ${policy.dailyDepositLimit} USDT would be exceeded.`);
    if(policy.monthlyLimitEnabled===true){
      const usedMonthly=(await tx.query("SELECT coalesce(sum(coalesce(verified_amount,submitted_amount)),0)::text used FROM manual_deposit_requests WHERE user_id=$1 AND status NOT IN ('REJECTED','CANCELLED') AND coalesce(limit_day,(created_at AT TIME ZONE 'Asia/Kolkata')::date)>=date_trunc('month',$2::date)::date AND coalesce(limit_day,(created_at AT TIME ZONE 'Asia/Kolkata')::date)<(date_trunc('month',$2::date)+interval '1 month')::date AND ($3::uuid IS NULL OR id<>$3::uuid)",[uid,day,exclude])).rows[0]!.used;
      if(databaseUnits(usedMonthly,6)+decimal(value,6)>decimal(policy.monthlyDepositLimit,6))throw new BadRequestException(`Monthly deposit limit of ${policy.monthlyDepositLimit} USDT would be exceeded.`);
    }
}
