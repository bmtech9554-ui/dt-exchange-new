"""Local synthetic data and ephemeral test keys only; no production connection."""
import gzip
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
import archive
import local_agent as agent
import local_integrity
import local_monitor

AGE=os.environ.get('DT_TEST_AGE','age')
KEYGEN=os.environ.get('DT_TEST_AGE_KEYGEN','age-keygen')


class LocalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.keys=tempfile.TemporaryDirectory()
        cls.identity=Path(cls.keys.name)/'identity'
        archive.command([KEYGEN,'-o',str(cls.identity)])
        cls.recipient=Path(cls.keys.name)/'recipient'
        cls.recipient.write_bytes(archive.command([KEYGEN,'-y',str(cls.identity)]))

    @classmethod
    def tearDownClass(cls):
        cls.keys.cleanup()

    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.log=self.root/'auth.log'
        self.log.write_bytes(b'Failed password for synthetic-user private-test-value\n')
        self.config={'enabled':True,'retentionDays':180,'archiveDirectory':str(self.root/'archives'),
          'stateDirectory':str(self.root/'state'),'recipientFile':str(self.recipient),
          'identityFile':str(self.identity),'minimumFreeBytes':40*1024**3,'archiveBudgetBytes':20*1024**3}
        self.disk=patch.object(agent.shutil,'disk_usage',return_value=shutil._ntuple_diskusage(200*1024**3,10*1024**3,190*1024**3))
        self.disk.start()

    def tearDown(self):
        self.disk.stop()
        self.temp.cleanup()

    def collect(self,**kw):
        return agent.collect(self.config,sources=[(self.log,'auth')],age=AGE,**kw)

    def test_secret_safe_allowlist_and_malformed_fields(self):
        fixtures=[b'{"event":"http_request","method":"GET","status":200,"duration":2,"password":"private-test-value","url":"?otp=private-test-value"}',
          b'{"event":"security_auth_result","operation":"admin_login","result":"rejected","status":401,"token":"private-test-value"}',
          b'{"event":{},"status":[]}',b'opaque private-test-value',
          b'{"log":"{\\"event\\":\\"http_request\\",\\"status\\":403,\\"token\\":\\"private-test-value\\"}","time":"2026-10-12T00:00:00Z"}']
        for line in fixtures:
            self.assertNotIn('private-test-value',json.dumps(agent.sanitize(line,'docker_api')))
        safe=agent.sanitize(b'1.2.3.4 - - [date] "GET /?token=private-test-value HTTP/1.1" 403 42','nginx')
        self.assertEqual(safe['status'],403)
        self.assertNotIn('private-test-value',json.dumps(safe))
        self.assertNotIn('1.2.3.4',json.dumps(safe))

    def test_actual_crypto_retrieval_and_source_preservation(self):
        before=self.log.read_bytes()
        result=self.collect()
        self.assertTrue(result['archiveVerified'])
        p=next((self.root/'archives').glob('*.age'))
        receipt=json.loads(Path(str(p)+'.json').read_text())
        self.assertEqual(receipt['retentionDays'],180)
        archive.recover(p,receipt['sha256'],self.identity,age=AGE,output=self.root/'retrieval')
        restored=(self.root/'retrieval'/'events.jsonl').read_text()
        self.assertIn('ssh_auth_failed',restored)
        self.assertNotIn('private-test-value',restored)
        self.assertEqual(self.log.read_bytes(),before)
        self.assertEqual(self.collect()['events'],0)

    def test_append_and_rename_follow_inode_without_skipping(self):
        self.collect()
        rotated=self.log.with_suffix('.1')
        self.log.rename(rotated)
        self.log.write_bytes(b'Accepted publickey test\n')
        result=agent.collect(self.config,sources=[(rotated,'auth'),(self.log,'auth')],age=AGE)
        self.assertEqual(result['events'],1)
        self.assertFalse(result['captureGap'])

    def test_copytruncate_or_replacement_is_recaptured(self):
        self.collect()
        self.log.write_bytes(b'Invalid user new\n')
        self.assertEqual(self.collect()['events'],1)

    def test_partial_line_waits_for_append(self):
        self.log.write_bytes(b'Failed password')
        self.assertEqual(self.collect()['events'],0)
        with self.log.open('ab') as out:out.write(b' for test\n')
        self.assertEqual(self.collect()['events'],1)

    def test_gzip_history_is_incrementally_captured(self):
        p=self.root/'history.gz'
        with gzip.open(p,'wb') as out:out.write(b'Failed password\n'*300)
        key,cursor,rows,n=agent.chunk(p,{},'auth',1024)
        self.assertGreater(len(rows),0)
        _,second,more,_=agent.chunk(p,{key:cursor},'auth',1024)
        self.assertGreater(second['offset'],cursor['offset'])
        self.assertTrue(more)

    def test_oversized_untrusted_message_not_retained(self):
        self.assertEqual(agent.sanitize(b'secret'*20000,'auth')['event'],'oversized_line_suppressed')

    def test_encryption_failure_never_advances_checkpoint(self):
        self.collect()
        state=self.root/'state'/'checkpoint.json'
        before=state.read_bytes()
        with self.log.open('ab') as out:out.write(b'Failed password\n')
        with patch.object(agent,'seal',side_effect=RuntimeError('synthetic_failure')):
            with self.assertRaises(RuntimeError):self.collect()
        self.assertEqual(state.read_bytes(),before)
        self.assertEqual(self.collect()['events'],1)

    def test_authentication_failure_never_advances_checkpoint(self):
        with patch.object(agent,'recover',side_effect=RuntimeError('synthetic_failure')):
            with self.assertRaises(RuntimeError):self.collect()
        self.assertFalse((self.root/'state'/'checkpoint.json').exists())

    def test_database_failure_keeps_source_unconsumed(self):
        def failed(_):raise RuntimeError('synthetic')
        with self.assertRaises(RuntimeError):self.collect(database=failed)
        self.assertFalse((self.root/'state'/'checkpoint.json').exists())
        self.assertEqual(self.collect()['events'],1)

    def test_low_disk_stops_without_deleting_or_collecting(self):
        with patch.object(agent.shutil,'disk_usage',return_value=shutil._ntuple_diskusage(100,99,1)):
            with self.assertRaisesRegex(RuntimeError,'DISK_RESERVE_REACHED'):self.collect()
        self.assertTrue(self.log.exists())
        self.assertFalse(list((self.root/'archives').glob('*.age')))

    def test_quota_and_retention_fail_closed(self):
        self.config['archiveBudgetBytes']=1
        with self.assertRaisesRegex(RuntimeError,'ARCHIVE_BUDGET_REACHED'):self.collect()
        self.config['retentionDays']=179
        with self.assertRaisesRegex(RuntimeError,'RETENTION_MINIMUM'):self.collect()

    def test_no_unapproved_enablement(self):
        self.config['enabled']=False
        with self.assertRaisesRegex(RuntimeError,'NOT_APPROVED'):self.collect()

    def test_disappeared_unread_source_is_sticky_gap(self):
        self.log.write_bytes(b'partial')
        self.collect()
        # Different inode; emulate source rotation having removed unread bytes.
        replacement=self.root/'replacement.log';replacement.write_bytes(b'new\n')
        result=agent.collect(self.config,sources=[(replacement,'auth')],age=AGE)
        self.assertTrue(result['captureGap'])
        self.assertTrue(agent.collect(self.config,sources=[(replacement,'auth')],age=AGE)['captureGap'])

    def test_integrity_scan_and_tamper_detection(self):
        self.collect()
        self.assertTrue(local_integrity.verify(self.config,age=AGE)['authenticatedRecovery'])
        p=next((self.root/'archives').glob('*.age'))
        with p.open('ab') as out:out.write(b'corrupt')
        with self.assertRaises(RuntimeError):local_integrity.verify(self.config,age=AGE)
        self.assertFalse(json.loads((self.root/'state'/'integrity-status.json').read_text())['ok'])

    def test_alert_codes_and_recovery_do_not_change_financial_policy(self):
        s={'apiReady':True,'workerCurrent':True,'clockSynchronized':True,'automationDisabled':True,
           'ledgerIntegrityIssues':0,'backupAt':100000,'archiveAt':100000,'diskFree':100*1024**3,
           'dockerMaxFill':0,'loggingServicesHealthy':True,'sshProtectionHealthy':True,'integrityHealthy':True}
        self.assertEqual(local_monitor.local_codes(s,self.config,100001),[])
        s.update(failedLogins15m=10,captureGap=True,integrityHealthy=False,diskFree=1)
        codes=local_monitor.local_codes(s,self.config,100001)
        self.assertIn('AUTH_FAILURE_BURST',codes)
        self.assertIn('ARCHIVE_CAPTURE_GAP',codes)
        self.assertIn('DISK_CAPACITY_LOW',codes)
        self.assertIn('ARCHIVE_INTEGRITY_FAILED',codes)

    def test_recent_admin_failures_deduplicate_by_request_id(self):
        line=json.dumps({'log':json.dumps({'event':'security_auth_result','operation':'admin_login',
          'result':'rejected','status':401,'password':'private-test-value',
          'requestId':'12345678-1234-1234-1234-123456789012'}),
          'time':datetime.now(timezone.utc).isoformat()}).encode()+b'\n'
        self.log.write_bytes(line*2)
        result=agent.collect(self.config,sources=[(self.log,'docker_api')],age=AGE)
        self.assertEqual(result['securityFailures15m'],{'admin_login':1})
        self.assertNotIn('private-test-value',(self.root/'state'/'checkpoint.json').read_text())

    def test_existing_nginx_safe_format_retains_only_operational_fields(self):
        line=json.dumps({'time':'2026-10-12T06:30:00+00:00','method':'POST','status':409,
                         'duration':.123,'extra':'private-test-value'}).encode()
        r=agent.sanitize(line,'nginx')
        self.assertEqual(r['status'],409)
        self.assertEqual(r['method'],'POST')
        self.assertEqual(r['durationMs'],123)
        self.assertEqual(r['time'],'2026-10-12T06:30:00+00:00')
        self.assertNotIn('private-test-value',json.dumps(r))

    def test_local_alert_delivery_failure_retries_and_recovers(self):
        s={'apiReady':True,'workerCurrent':True,'clockSynchronized':True,'automationDisabled':True,
           'ledgerIntegrityIssues':0,'backupAt':9999999999,'archiveAt':9999999999,'diskFree':100*1024**3,
           'dockerMaxFill':0,'loggingServicesHealthy':True,'sshProtectionHealthy':True,'integrityHealthy':True,
           'securityFailures15m':{'admin_login':5,'manual_deposit_submit':5}}
        with patch.object(local_monitor,'gather',return_value=s),patch.object(local_monitor,'deliver',side_effect=RuntimeError('synthetic')):
            r=local_monitor.main(self.config)
            self.assertTrue(r['deliveryPending'])
            self.assertIn('ADMIN_AUTH_FAILURE_BURST',r['codes'])
            self.assertIn('DEPOSIT_CONFLICT_BURST',r['codes'])
        with patch.object(local_monitor,'gather',return_value=s),patch.object(local_monitor,'deliver') as sent:
            self.assertFalse(local_monitor.main(self.config)['deliveryPending']);sent.assert_called_once()
        s['securityFailures15m']={}
        with patch.object(local_monitor,'gather',return_value=s),patch.object(local_monitor,'deliver') as sent:
            self.assertEqual(local_monitor.main(self.config)['codes'],[])
            self.assertEqual(sent.call_args.args[0],['RECOVERED'])


if __name__=='__main__':unittest.main()
