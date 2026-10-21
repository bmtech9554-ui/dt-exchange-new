"""Disabled-by-default archive/recovery tooling. No source deletion or rotation.

Only age public recipients are needed on the collector. Recovery identities belong
on a separately controlled recovery host. This module never prints payloads,
subprocess stderr, credentials, or untrusted exception messages.
"""
import argparse
import base64
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
import uuid

MAX_BYTES = 256 * 1024 * 1024
INDIA_REGIONS = {'ap-south-1', 'ap-south-2'}
RETENTION = {'ict': 181, 'records': 1830}


def require(value, code):
    if not value:
        raise RuntimeError(code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


class ToolFailure(RuntimeError):
    def __init__(self, code='ARCHIVE_COMMAND_FAILED'):
        super().__init__(code)
        self.code = code


def command(args, data=None):
    p = subprocess.run(args, input=data, capture_output=True, timeout=180)
    if p.returncode:
        # Only this explicit AWS absence response proves no replication rules.
        # AccessDenied/timeouts/other errors must remain fail-closed.
        if b'(ReplicationConfigurationNotFoundError)' in p.stderr:
            raise ToolFailure('REPLICATION_NOT_CONFIGURED')
        raise ToolFailure()
    return p.stdout


def safe_name(name):
    return (isinstance(name, str) and bool(re.fullmatch(r'[A-Za-z0-9_./-]{1,200}', name))
            and not name.startswith('/') and name != '.' and '..' not in PurePosixPath(name).parts
            and name == str(PurePosixPath(name)) and name != 'manifest.json')


def private_directory(path):
    path = Path(path)
    require(not path.is_symlink(), 'SYMLINK_DIRECTORY_REFUSED')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name != 'nt':
        require(path.stat().st_uid == os.geteuid() and path.stat().st_mode & 0o077 == 0,
                'PRIVATE_DIRECTORY_REQUIRED')
    return path


def exclusive_write(path, data):
    with open(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())


def seal(sources, directory, recipient_file, kind, age='age'):
    require(kind in RETENTION and sources, 'INVALID_ARCHIVE_CLASS')
    require(all(safe_name(n) and isinstance(b, bytes) for n, b in sources.items()), 'INVALID_SOURCE')
    require(len(sources) <= 2000 and sum(map(len, sources.values())) <= MAX_BYTES, 'ARCHIVE_LIMIT_EXCEEDED')
    recipient = Path(recipient_file).read_text().strip()
    require(re.fullmatch(r'age1[0-9a-z]{58}', recipient), 'PUBLIC_AGE_RECIPIENT_REQUIRED')
    created = datetime.now(timezone.utc)
    manifest = {'format': 1, 'class': kind, 'createdAt': created.isoformat(),
                'files': {n: {'bytes': len(b), 'sha256': sha(b)} for n, b in sorted(sources.items())}}
    payload = io.BytesIO()
    with tarfile.open(fileobj=payload, mode='w:gz') as t:
        for name, data in {**sources, 'manifest.json': json.dumps(manifest, sort_keys=True).encode()}.items():
            info = tarfile.TarInfo(name)
            info.size, info.mode, info.mtime = len(data), 0o600, int(created.timestamp())
            t.addfile(info, io.BytesIO(data))
    encrypted = command([age, '-r', recipient], payload.getvalue())
    require(encrypted.startswith(b'age-encryption.org/v1\n'), 'AGE_ENCRYPTION_FAILED')
    folder = private_directory(directory)
    name = created.strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex + '.tar.gz.age'
    path = folder / name
    exclusive_write(path, encrypted)
    receipt = {'format': 1, 'class': kind, 'createdAt': created.isoformat(),
               'sha256': sha(encrypted), 'bytes': len(encrypted), 'file': name,
               'sourceCount': len(sources), 'retentionDays': RETENTION[kind], 'remoteVerified': False}
    exclusive_write(folder / (name + '.json'), json.dumps(receipt, sort_keys=True).encode())
    return path, receipt


def recover(path, expected_sha, identity, age='age', output=None):
    require(re.fullmatch('[a-f0-9]{64}', expected_sha), 'TRUSTED_CHECKSUM_REQUIRED')
    require(Path(path).stat().st_size <= MAX_BYTES + 10485760, 'ARCHIVE_LIMIT_EXCEEDED')
    encrypted = Path(path).read_bytes()
    require(sha(encrypted) == expected_sha, 'CIPHERTEXT_CHECKSUM_MISMATCH')
    # Authentication must finish before parsing or releasing any plaintext.
    payload = command([age, '-d', '-i', str(identity)], encrypted)
    files = {}
    size = 0
    with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as t:
        for m in t:
            require(m.isfile() and (safe_name(m.name) or m.name == 'manifest.json'), 'UNSAFE_ARCHIVE_MEMBER')
            require(m.name not in files and len(files) < 2001, 'DUPLICATE_OR_EXCESS_MEMBERS')
            size += m.size
            require(size <= MAX_BYTES + 1048576, 'ARCHIVE_LIMIT_EXCEEDED')
            files[m.name] = t.extractfile(m).read()
    require('manifest.json' in files, 'MANIFEST_MISSING')
    manifest = json.loads(files.pop('manifest.json'))
    require(manifest.get('format') == 1 and manifest.get('class') in RETENTION, 'INVALID_MANIFEST')
    require(set(files) == set(manifest['files']), 'MANIFEST_MEMBERS_MISMATCH')
    for name, data in files.items():
        require(manifest['files'][name] == {'bytes': len(data), 'sha256': sha(data)}, 'PLAINTEXT_CHECKSUM_MISMATCH')
    if output is not None:
        folder = private_directory(output)
        require(not any(folder.iterdir()), 'RECOVERY_DIRECTORY_MUST_BE_EMPTY')
        for name, data in files.items():
            p = folder / name
            p.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            exclusive_write(p, data)
    return {'verified': True, 'class': manifest['class'], 'files': len(files)}


class IndiaS3:
    """Reference destination, not an approved/chosen provider. Never provisions a bucket.

    Runtime principal needs only scoped read-preflight, PutObject and HeadObject
    access. No delete, lifecycle, retention-bypass, IAM or provisioning rights.
    TLS verification is never disabled; credentials use the AWS external chain.
    """
    def __init__(self, config, runner=command):
        self.c, self.runner = config, runner
        require(config.get('enabled') is True, 'ARCHIVING_NOT_APPROVED_OR_ENABLED')
        require(config.get('region') in INDIA_REGIONS, 'INDIA_REGION_REQUIRED')
        require(re.fullmatch(r'[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]', config.get('bucket', '')), 'BUCKET_REQUIRED')
        require(re.fullmatch(r'\d{12}', config.get('accountId', '')), 'EXPECTED_ACCOUNT_REQUIRED')
        require(not any(os.environ.get(k) for k in ['AWS_ENDPOINT_URL','AWS_ENDPOINT_URL_S3','AWS_CA_BUNDLE']),
                'ENDPOINT_OR_CA_OVERRIDE_REFUSED')

    def call(self, op, extra=()):
        try:
            raw = self.runner(['aws', '--region', self.c['region'], '--no-cli-pager', '--output', 'json',
                               '--endpoint-url', 'https://s3.'+self.c['region']+'.amazonaws.com', 's3api', op,
                               '--bucket', self.c['bucket'], '--expected-bucket-owner', self.c['accountId'], *extra])
        except ToolFailure as e:
            if op == 'get-bucket-replication' and e.code == 'REPLICATION_NOT_CONFIGURED':
                return {'ReplicationConfiguration': {'Rules': []}}
            raise
        return json.loads(raw or b'{}')

    def preflight(self):
        require(self.call('get-bucket-location').get('LocationConstraint') == self.c['region'], 'BUCKET_REGION_MISMATCH')
        require(self.call('get-bucket-versioning').get('Status') == 'Enabled', 'VERSIONING_REQUIRED')
        require(self.call('get-object-lock-configuration').get('ObjectLockConfiguration', {}).get('ObjectLockEnabled') == 'Enabled', 'OBJECT_LOCK_REQUIRED')
        public = self.call('get-public-access-block').get('PublicAccessBlockConfiguration', {})
        require(all(public.get(k) is True for k in ['BlockPublicAcls','IgnorePublicAcls','BlockPublicPolicy','RestrictPublicBuckets']), 'PUBLIC_ACCESS_BLOCK_REQUIRED')
        require(self.call('get-bucket-policy-status').get('PolicyStatus', {}).get('IsPublic') is False, 'PRIVATE_POLICY_REQUIRED')
        # This reference profile requires explicit disabled replication rules.
        # Missing configuration/errors fail closed, not proof of no replication.
        replication = self.call('get-bucket-replication').get('ReplicationConfiguration', {})
        require('Rules' in replication and all(r.get('Status') == 'Disabled' for r in replication['Rules']), 'REPLICATION_REVIEW_REQUIRED')
        require(self.c.get('replicationAndAccountReviewed') is True, 'DESTINATION_REVIEW_REQUIRED')

    def upload(self, path, receipt):
        self.preflight()
        require(receipt['class'] in RETENTION and Path(path).name == receipt['file'], 'INVALID_RECEIPT')
        content = Path(path).read_bytes()
        require(sha(content) == receipt['sha256'], 'CIPHERTEXT_CHECKSUM_MISMATCH')
        checksum = base64.b64encode(hashlib.sha256(content).digest()).decode()
        until = (datetime.now(timezone.utc) + timedelta(days=RETENTION[receipt['class']])).replace(microsecond=0)
        key = 'dtexchange/' + receipt['class'] + '/' + receipt['file']
        result = self.call('put-object', ['--key', key, '--body', str(path), '--checksum-sha256', checksum,
             '--server-side-encryption', 'AES256', '--object-lock-mode', 'COMPLIANCE',
             '--object-lock-retain-until-date', until.isoformat(), '--metadata', 'sha256='+receipt['sha256']])
        require(isinstance(result.get('VersionId'), str) and result['VersionId'] not in ['', 'null'], 'VERSION_ID_REQUIRED')
        head = self.call('head-object', ['--key', key, '--version-id', result['VersionId'], '--checksum-mode', 'ENABLED'])
        require(head.get('ChecksumSHA256') == checksum and head.get('ContentLength') == len(content), 'REMOTE_CHECKSUM_MISMATCH')
        require(head.get('ObjectLockMode') == 'COMPLIANCE' and
                datetime.fromisoformat(head['ObjectLockRetainUntilDate'].replace('Z','+00:00')) >= until, 'REMOTE_RETENTION_MISMATCH')
        require(head.get('Metadata', {}).get('sha256') == receipt['sha256'] and head.get('ServerSideEncryption') == 'AES256', 'REMOTE_METADATA_MISMATCH')
        result = {**receipt, 'remoteVerified': True, 'bucket': self.c['bucket'], 'region': self.c['region'],
                  'key': key, 'versionId': result['VersionId'], 'retainUntil': head['ObjectLockRetainUntilDate']}
        exclusive_write(str(path)+'.remote.json', json.dumps(result, sort_keys=True).encode())
        return result

    def retrieve(self, receipt, output):
        self.preflight()
        require(receipt.get('remoteVerified') is True and receipt.get('bucket') == self.c['bucket'] and
                receipt.get('region') == self.c['region'], 'TRUSTED_REMOTE_RECEIPT_REQUIRED')
        require(receipt.get('key') == 'dtexchange/'+receipt['class']+'/'+receipt['file'] and
                safe_name(receipt['file']) and '/' not in receipt['file'], 'INVALID_OBJECT_KEY')
        target = private_directory(output) / receipt['file']
        require(not target.exists() and not target.is_symlink(), 'DESTINATION_EXISTS')
        self.call('get-object', ['--key', receipt['key'], '--version-id', receipt['versionId'], str(target)])
        os.chmod(target, 0o600)
        require(sha(target.read_bytes()) == receipt['sha256'], 'RETRIEVED_CHECKSUM_MISMATCH')
        return target


if __name__ == '__main__':
    p = argparse.ArgumentParser(description='Private archive verification; no source log deletion.')
    p.add_argument('action', choices=['verify','retrieve'])
    p.add_argument('--receipt', required=True)
    p.add_argument('--archive')
    p.add_argument('--identity')
    p.add_argument('--output')
    p.add_argument('--config')
    args = p.parse_args()
    try:
        r = json.loads(Path(args.receipt).read_text())
        if args.action == 'verify':
            result = recover(args.archive, r['sha256'], args.identity, output=args.output)
        else:
            IndiaS3(json.loads(Path(args.config).read_text())).retrieve(r, args.output)
            result = {'retrievedAndHashVerified': True}
        print(json.dumps(result))
    except Exception:
        print('{"event":"log_archive_operation_failed"}')
        raise SystemExit(1)
