"""Synthetic only. Actual age crypto; AWS operations are contract fakes.
No network, production keys, application accounts or financial data are used.
"""
import base64
from datetime import datetime, timedelta, timezone
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import archive
import monitor

AGE = os.environ.get('DT_TEST_AGE', 'age')
KEYGEN = os.environ.get('DT_TEST_AGE_KEYGEN', 'age-keygen')

class StorageFake:
    def __init__(self):
        self.ops=[]; self.overrides={}; self.objects={}
    def __call__(self,args,data=None):
        op=args[args.index('s3api')+1]; self.ops.append(op)
        def arg(k): return args[args.index(k)+1]
        assert arg('--endpoint-url')=='https://s3.ap-south-1.amazonaws.com'
        assert arg('--expected-bucket-owner')=='123456789012'
        result={
          'get-bucket-location':{'LocationConstraint':'ap-south-1'},
          'get-bucket-versioning':{'Status':'Enabled'},
          'get-object-lock-configuration':{'ObjectLockConfiguration':{'ObjectLockEnabled':'Enabled'}},
          'get-public-access-block':{'PublicAccessBlockConfiguration':dict.fromkeys(['BlockPublicAcls','IgnorePublicAcls','BlockPublicPolicy','RestrictPublicBuckets'],True)},
          'get-bucket-policy-status':{'PolicyStatus':{'IsPublic':False}},
          'get-bucket-replication':{'ReplicationConfiguration':{'Rules':[]}},
        }.get(op,{})
        if op=='put-object':
            self.objects[arg('--key')]=Path(arg('--body')).read_bytes()
            self.head={'ChecksumSHA256':arg('--checksum-sha256'),'ContentLength':len(self.objects[arg('--key')]),
                       'ObjectLockMode':arg('--object-lock-mode'),'ObjectLockRetainUntilDate':arg('--object-lock-retain-until-date'),
                       'ServerSideEncryption':arg('--server-side-encryption'),
                       'Metadata':{'sha256':arg('--metadata').split('=',1)[1]}}
            result={'VersionId':'immutable-test-version'}
        if op=='head-object': result=self.head
        if op=='get-object':
            assert arg('--version-id')=='immutable-test-version'
            Path(args[-1]).write_bytes(self.objects[arg('--key')])
        value=self.overrides.get(op,result)
        if isinstance(value,Exception): raise value
        return json.dumps(value).encode()

class ArchiveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.keys=tempfile.TemporaryDirectory(prefix='dt-synthetic-keys-')
        cls.identity=Path(cls.keys.name)/'identity'
        # Test identities never enter the repository, stdout or artifact logs.
        archive.command([KEYGEN,'-o',str(cls.identity)])
        cls.recipient=Path(cls.keys.name)/'recipient'
        cls.recipient.write_bytes(archive.command([KEYGEN,'-y',str(cls.identity)]))
    @classmethod
    def tearDownClass(cls): cls.keys.cleanup()
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='dt-synthetic-archive-')
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.cfg={'enabled':True,'region':'ap-south-1','bucket':'dt-test-only','accountId':'123456789012','replicationAndAccountReviewed':True}
        self.fake=StorageFake(); self.s3=archive.IndiaS3(self.cfg,self.fake)
    def sealed(self,kind='ict'):
        return archive.seal({'nginx/events.jsonl':b'{"status":200}\n','audit/events.jsonl':b'{"action":"TEST_ONLY"}\n'},self.root/'spool',self.recipient,kind,AGE)
    def test_real_crypto_recovery_and_plaintext_not_in_ciphertext(self):
        p,r=self.sealed()
        self.assertNotIn(b'TEST_ONLY',p.read_bytes())
        result=archive.recover(p,r['sha256'],self.identity,AGE,self.root/'recovery')
        self.assertEqual(result['files'],2)
        self.assertEqual((self.root/'recovery/audit/events.jsonl').read_bytes(),b'{"action":"TEST_ONLY"}\n')
        self.assertTrue(p.exists())
    def test_corrupt_ciphertext_rejected(self):
        p,r=self.sealed(); p.write_bytes(p.read_bytes()[:-1]+b'!')
        with self.assertRaisesRegex(RuntimeError,'CIPHERTEXT_CHECKSUM_MISMATCH'): archive.recover(p,r['sha256'],self.identity,AGE)
    def test_tamper_with_recomputed_checksum_still_fails_age_authentication(self):
        p,r=self.sealed(); data=bytearray(p.read_bytes()); data[-4]^=1; p.write_bytes(data)
        with self.assertRaises(archive.ToolFailure): archive.recover(p,archive.sha(data),self.identity,AGE)
    def test_truncation_fails_before_plaintext_is_released(self):
        p,r=self.sealed(); p.write_bytes(p.read_bytes()[:-24])
        with self.assertRaises(archive.ToolFailure): archive.recover(p,archive.sha(p.read_bytes()),self.identity,AGE,self.root/'never-created')
        self.assertFalse((self.root/'never-created').exists())
    def test_recovery_never_overwrites_existing_file(self):
        p,r=self.sealed(); d=self.root/'existing'; d.mkdir(mode=0o700); (d/'keep').write_text('keep')
        with self.assertRaisesRegex(RuntimeError,'MUST_BE_EMPTY'): archive.recover(p,r['sha256'],self.identity,AGE,d)
        self.assertEqual((d/'keep').read_text(),'keep')
    def test_unsafe_names_rejected(self):
        for name in ['../escape','/absolute','a/../../b','a\\b','manifest.json']:
            with self.subTest(name=name),self.assertRaises(RuntimeError):
                archive.seal({name:b'x'},self.root,self.recipient,'ict',AGE)
    def test_non_india_disabled_and_missing_account_fail_closed(self):
        for change in [{'region':'ap-southeast-1'},{'enabled':False},{'accountId':''}]:
            with self.subTest(change=change),self.assertRaises(RuntimeError): archive.IndiaS3({**self.cfg,**change},self.fake)
        self.assertEqual(self.fake.ops,[])
    def test_remote_private_versioned_locked_hash_verified_and_retrieved(self):
        p,r=self.sealed(); remote=self.s3.upload(p,r)
        self.assertTrue(remote['remoteVerified'])
        restored=self.s3.retrieve(remote,self.root/'retrieved')
        self.assertEqual(restored.read_bytes(),p.read_bytes())
        self.assertEqual(archive.recover(restored,r['sha256'],self.identity,AGE)['files'],2)
        self.assertFalse(any('delete' in op for op in self.fake.ops))
    def test_archive_retention_classes(self):
        for kind,days in [('ict',181),('records',1830)]:
            p,r=self.sealed(kind); receipt=self.s3.upload(p,r)
            expiry=datetime.fromisoformat(receipt['retainUntil'])
            self.assertGreater(expiry,datetime.now(timezone.utc)+timedelta(days=days-1))
    def test_public_unversioned_unlocked_or_wrong_region_storage_rejected(self):
        for op,value in [('get-bucket-location',{'LocationConstraint':'us-east-1'}),
                         ('get-bucket-versioning',{'Status':'Suspended'}),('get-object-lock-configuration',{}),
                         ('get-public-access-block',{}),('get-bucket-policy-status',{'PolicyStatus':{'IsPublic':True}}),
                         ('get-bucket-replication',{'ReplicationConfiguration':{'Rules':[{'Status':'Enabled'}]}})]:
            with self.subTest(op=op):
                self.fake.overrides={op:value}
                with self.assertRaises(RuntimeError): self.s3.preflight()
        self.assertNotIn('put-object',self.fake.ops)
    def test_replication_absence_distinct_from_access_denied(self):
        self.fake.overrides={'get-bucket-replication':archive.ToolFailure('REPLICATION_NOT_CONFIGURED')}
        self.s3.preflight()
        self.fake.overrides={'get-bucket-replication':archive.ToolFailure('ACCESS_DENIED')}
        with self.assertRaises(archive.ToolFailure): self.s3.preflight()
    def test_failed_upload_preserves_encrypted_local_capture(self):
        p,r=self.sealed(); self.fake.overrides={'put-object':archive.ToolFailure()}
        with self.assertRaises(archive.ToolFailure): self.s3.upload(p,r)
        self.assertTrue(p.exists()); self.assertFalse(Path(str(p)+'.remote.json').exists())
    def test_remote_hash_or_retention_mismatch_not_acknowledged(self):
        p,r=self.sealed(); self.fake.overrides={'head-object':{'ChecksumSHA256':'WRONG'}}
        with self.assertRaises(RuntimeError): self.s3.upload(p,r)
        self.assertFalse(Path(str(p)+'.remote.json').exists())
    def test_private_key_not_accepted_as_recipient(self):
        with self.assertRaisesRegex(RuntimeError,'PUBLIC_AGE_RECIPIENT_REQUIRED'):
            archive.seal({'x':b'x'},self.root,self.identity,'ict',AGE)
    def test_size_limits_fail_without_archive(self):
        with patch.object(archive,'MAX_BYTES',5),self.assertRaises(RuntimeError): self.sealed()
        self.assertFalse((self.root/'spool').exists())
    def test_encrypted_traversal_or_symlink_archive_never_extracts(self):
        for mode in ['traversal','symlink']:
            with self.subTest(mode=mode):
                payload=io.BytesIO()
                with tarfile.open(fileobj=payload,mode='w:gz') as t:
                    item=tarfile.TarInfo('../escape' if mode=='traversal' else 'link')
                    if mode=='symlink': item.type=tarfile.SYMTYPE; item.linkname='/etc/passwd'
                    t.addfile(item,io.BytesIO(b''))
                cipher=archive.command([AGE,'-r',self.recipient.read_text().strip()],payload.getvalue())
                p=self.root/(mode+'.age'); p.write_bytes(cipher)
                with self.assertRaisesRegex(RuntimeError,'UNSAFE_ARCHIVE_MEMBER'):
                    archive.recover(p,archive.sha(cipher),self.identity,AGE,self.root/'never-extracted')
                self.assertFalse((self.root/'never-extracted').exists())
    def test_missing_remote_version_or_expired_retention_not_acknowledged(self):
        for invalid in ['version','retention']:
            with self.subTest(invalid=invalid):
                p,r=self.sealed()
                if invalid=='version': self.fake.overrides={'put-object':{'VersionId':'null'}}
                else:
                    self.fake.overrides={}
                    self.s3.upload(p,r)
                    Path(str(p)+'.remote.json').unlink() # Synthetic test receipt only.
                    self.fake.overrides={'head-object':{**self.fake.head,'ObjectLockRetainUntilDate':'2000-01-01T00:00:00+00:00'}}
                with self.assertRaises(RuntimeError): self.s3.upload(p,r)
                self.assertFalse(Path(str(p)+'.remote.json').exists())
    def test_monitor_alerts_no_financial_actions(self):
        now=1000000
        healthy={'apiReady':True,'workerCurrent':True,'clockSynchronized':True,'automationDisabled':True,
                 'ledgerIntegrityIssues':0,'backupAt':now,'archiveAt':now,'diskFree':4*1024**3,'dockerMaxFill':.1}
        self.assertEqual(monitor.evaluate(healthy,now),[])
        alerts=monitor.evaluate({**healthy,'failedLogins15m':12,'openHighRisk':1,'archiveAt':0,'automationDisabled':False},now)
        self.assertEqual(alerts,['ARCHIVE_STALE','AUTH_FAILURE_BURST','AUTOMATION_FLAG_DRIFT','OPEN_HIGH_RISK_REVIEW'])
    def test_alert_endpoint_off_by_default_and_tls_required(self):
        with self.assertRaises(RuntimeError): monitor.deliver(['TEST'],{})
        with self.assertRaises(RuntimeError): monitor.deliver(['TEST'],{'alertsEnabled':True,'alertUrl':'http://example.invalid','approvedAlertHost':'example.invalid'})
    def test_no_credential_or_network_dependency_in_example(self):
        c=json.loads(Path(__file__).with_name('config.example.json').read_text())
        self.assertFalse(c['enabled']); self.assertFalse(c['alertsEnabled'])
        with self.assertRaises(RuntimeError): archive.IndiaS3(c,self.fake)

if __name__=='__main__': unittest.main(verbosity=2)
