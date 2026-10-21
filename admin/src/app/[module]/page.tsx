import {OwnerDeposits} from "@/components/owner-deposits";
import {ReferralManagement} from "@/components/referral-management";
import {NotificationWorkspace} from "@/components/admin-inbox";
import {DepositPolicySettings,DepositWalletSettings} from "@/components/deposit-wallet-settings";
import { OwnerOperations } from "@/components/owner-operations";
import { ManualOperations } from "@/components/manual-operations";
import { ProductionOperations } from "@/components/production-operations";
import { EngagementOperations } from "@/components/engagement-operations";
import { PayoutOperations } from "@/components/payout-operations";
import { Operations } from "@/components/operations";
import { notFound } from "next/navigation";
import { navigation } from "@/lib/navigation";
export function generateStaticParams() {
  return navigation.map((n) => ({ module: n.slug }));
}
export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const item = navigation.find((n) => n.slug === module);
  if (!item) notFound();
  if(module==="referrals"||module==="referral-settings")return <ReferralManagement settings={module==="referral-settings"}/>;
  if(module==="notifications")return <NotificationWorkspace/>;
  if(module==="deposits")return <OwnerDeposits/>;
  if(module==="deposit-settings")return <DepositPolicySettings/>;
  if(module==="deposit-wallet")return <DepositWalletSettings/>;
  if(module==="sell-settings")return <><ProductionOperations module="rates"/><ProductionOperations module="fees"/><ProductionOperations module="limits"/></>;
  if (["dashboard","users","banks","wallets","health","admin-permissions","website-settings","app-settings","maintenance","reconciliation"].includes(module)) return <OwnerOperations module={module} />;
  if (
    ["manual-deposits", "manual-payouts", "android-releases"].includes(module)
  )
    return <ManualOperations module={module} />;
  if (["support", "referrals", "notifications"].includes(module))
    return <EngagementOperations module={module} />;
  if (module === "payouts") return <PayoutOperations />;
  if (module === "orders" || module === "reviews")
    return <Operations module={module} />;
  return <ProductionOperations module={module} />;
}
