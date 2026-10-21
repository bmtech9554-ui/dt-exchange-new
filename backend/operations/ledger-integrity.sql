-- Read-only. Run under REPEATABLE READ READ ONLY for one consistent snapshot.
SELECT * FROM ledger_integrity_issues ORDER BY journal_id;
SELECT p.id payout_id,p.order_id,'SUCCESS_WITHOUT_SETTLEMENT' issue
 FROM payouts p WHERE p.lifecycle='SUCCESS' AND NOT EXISTS
 (SELECT 1 FROM ledger_journals j WHERE j.event_key='payout:'||p.id);
SELECT p.id payout_id,p.order_id,'SETTLEMENT_AMOUNT_MISMATCH' issue FROM payouts p
 WHERE p.lifecycle='SUCCESS' AND p.amount_inr_minor::numeric/100 <>
 (SELECT COALESCE(sum(e.amount),0) FROM ledger_journals j JOIN ledger_entries e ON e.journal_id=j.id
 WHERE j.event_key='payout:'||p.id AND e.asset_symbol='INR' AND e.side='debit');
SELECT p.id payout_id,p.order_id,'ORDER_NOT_COMPLETED' issue FROM payouts p JOIN sell_orders o ON o.id=p.order_id
 WHERE p.lifecycle='SUCCESS' AND o.status<>'completed';
SELECT p.id payout_id,p.order_id,'MISSING_REVERSAL' issue FROM payouts p
 WHERE p.lifecycle='REVERSED' AND EXISTS(SELECT 1 FROM ledger_journals WHERE event_key='payout:'||p.id)
 AND NOT EXISTS(SELECT 1 FROM ledger_journals WHERE event_key='reverse:payout:'||p.id);

SELECT m.id manual_deposit_id,'MANUAL_CREDIT_MISMATCH' issue FROM manual_deposit_requests m
 WHERE m.status='CREDITED' AND (m.verified_amount IS NULL OR COALESCE(m.net_credited_amount,m.verified_amount) <>
 (SELECT COALESCE(sum(e.amount),0) FROM ledger_journals j JOIN ledger_entries e ON e.journal_id=j.id JOIN ledger_accounts a ON a.id=e.account_id
 WHERE j.event_key='deposit:'||m.network_code||':'||m.tx_hash AND e.asset_symbol='USDT' AND e.side='credit' AND a.user_id=m.user_id AND a.bucket='available'));
SELECT p.id payout_id,p.order_id,'MANUAL_PAYMENT_EVIDENCE_MISSING' issue FROM payouts p
 WHERE p.provider='manual' AND p.lifecycle='SUCCESS' AND (p.manual_paid_at IS NULL OR p.manual_confirmed_by IS NULL OR p.utr IS NULL OR NOT EXISTS(SELECT 1 FROM private_financial_files f WHERE f.id=p.manual_receipt_id AND f.purpose='receipt'));
