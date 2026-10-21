"""Daily ciphertext scan and rotating authenticated recovery; never deletes.
Each newly produced archive has already passed full authenticated recovery.
"""
import hashlib
import json
from pathlib import Path
import sys
import time
from archive import recover, require
from local_agent import atomic_json


def verify(config, age='age'):
    require(config.get('enabled') is True, 'INTEGRITY_NOT_ENABLED')
    folder=Path(config['archiveDirectory'])
    status_path=Path(config['stateDirectory'])/'integrity-status.json'
    previous=json.loads(status_path.read_text()) if status_path.exists() else {}
    receipt_paths=sorted(folder.glob('*.age.json'))
    try:
        require(bool(receipt_paths), 'NO_ARCHIVES_TO_VERIFY')
        total=0
        for p in receipt_paths:
            require(not p.is_symlink(), 'UNSAFE_RECEIPT')
            receipt=json.loads(p.read_text())
            archive=p.with_suffix('')
            require(not archive.is_symlink() and archive.name==receipt['file'], 'UNSAFE_ARCHIVE')
            h=hashlib.sha256()
            with archive.open('rb') as f:
                while data:=f.read(1024**2):
                    h.update(data)
                    total+=len(data)
            require(h.hexdigest()==receipt['sha256'], 'CIPHERTEXT_CHECKSUM_MISMATCH')
            require(receipt.get('localVerified') is True and receipt['retentionDays']>=180,
                    'ARCHIVE_RECEIPT_INVALID')
        require(len(list(folder.glob('*.age')))==len(receipt_paths), 'UNTRACKED_ARCHIVE')
        index=previous.get('nextRecoveryIndex',0)%len(receipt_paths)
        sample=json.loads(receipt_paths[index].read_text())
        recover(folder/sample['file'],sample['sha256'],config['identityFile'],age=age)
        result={'ok':True,'checkedAt':time.time(),'ciphertextsVerified':len(receipt_paths),
                'bytesVerified':total,'authenticatedRecovery':True,'nextRecoveryIndex':index+1}
        atomic_json(status_path,result)
        return result
    except Exception:
        atomic_json(status_path,{'ok':False,'checkedAt':time.time(),'code':'ARCHIVE_INTEGRITY_FAILED'})
        raise


if __name__=='__main__':
    try:
        r=verify(json.loads(Path(sys.argv[1]).read_text()))
        print(json.dumps({'event':'local_archive_integrity_verified','archives':r['ciphertextsVerified']}))
    except Exception:
        print('{"event":"local_archive_integrity_failed"}')
        raise SystemExit(1)
