CREATE TABLE admin_event_notifications (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_key text NOT NULL UNIQUE,
 permission_code text NOT NULL REFERENCES admin_permissions(code),
 title text NOT NULL,
 entity_id uuid NOT NULL,
 target text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_event_notifications_permission_date ON admin_event_notifications(permission_code,created_at DESC,id DESC);
CREATE TRIGGER admin_event_notifications_immutable BEFORE UPDATE OR DELETE ON admin_event_notifications FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TABLE admin_notification_reads (
 admin_id uuid NOT NULL REFERENCES admin_users(id),
 notification_id bigint NOT NULL REFERENCES admin_event_notifications(id),
 read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(admin_id,notification_id)
);
CREATE FUNCTION notify_owner_operations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE permission text; label text; target_path text;
BEGIN
 CASE TG_TABLE_NAME
  WHEN 'manual_deposit_requests' THEN permission:='DEPOSIT_REVIEW';label:='New deposit request';target_path:='/manual-deposits';
  WHEN 'sell_orders' THEN permission:='orders.read';label:='New sell order';target_path:='/orders';
  WHEN 'payouts' THEN permission:='PAYOUT_VIEW';label:='Payout requires attention';target_path:='/manual-payouts';
  WHEN 'support_tickets' THEN permission:='support.write';label:='New support ticket';target_path:='/support';
 END CASE;
 INSERT INTO admin_event_notifications(event_key,permission_code,title,entity_id,target)
 VALUES(TG_TABLE_NAME||':'||NEW.id,permission,label,NEW.id,target_path||'?id='||NEW.id) ON CONFLICT(event_key) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER admin_deposit_notice AFTER INSERT ON manual_deposit_requests FOR EACH ROW EXECUTE FUNCTION notify_owner_operations();
CREATE TRIGGER admin_sell_notice AFTER INSERT ON sell_orders FOR EACH ROW EXECUTE FUNCTION notify_owner_operations();
CREATE TRIGGER admin_payout_notice AFTER INSERT ON payouts FOR EACH ROW EXECUTE FUNCTION notify_owner_operations();
CREATE TRIGGER admin_support_notice AFTER INSERT ON support_tickets FOR EACH ROW EXECUTE FUNCTION notify_owner_operations();
