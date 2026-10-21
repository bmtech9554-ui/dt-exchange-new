# Engagement worker rollback recovery — 9 October 2026

Status: **VERIFIED ORIGINAL RUNTIME RECOVERY — FULL ORIGINAL INDEX INCOMPLETE**.
The user explicitly approved this separately identified runtime artifact after
reviewing the missing-provenance limitation. Production cutover is not approved
by that recovery approval; it requires a fresh, separately scoped approval.

## Isolated startup validation — completed 9 October, 11:17 IST

The recovered runtime was started using its unmodified official entrypoint and
`engagement` command. A disposable PostgreSQL container used `--network none`;
disposable Redis and worker containers shared only its loopback network namespace.
There were no production mounts, credentials, networks, published ports, financial
records or notification recipients. The test used `NODE_ENV=test` and ephemeral
credentials; it does not claim a new validation of production provider credentials.

The same recovered runtime passed both cases:

| Disposable schema | Worker startup | Completed dispatch jobs | Heartbeat | Worker failures |
| --- | --- | --- | --- | --- |
| Current migrations 001–016 | PASS | 2 | Healthy | 0 |
| Candidate migrations 001–021 | PASS | 2 | Healthy | 0 |

The second case confirms the old runtime starts against the proposed additive
schema for rollback compatibility. These migrations ran only in the disposable
empty test database. Production remains at 001–016.

All test containers were removed by exact ID with matching purpose/run labels.
Production container IDs, images, configuration, mount definitions, start times
and restart counts were unchanged. No financial rows were created in the tests.
Machine evidence:
`/srv/dtexchange/rollback/engagement-20261009/isolated-startup-56a3d877099c.json`.

An initial attempt stopped before creating resources on its memory safety guard;
a later check passed the same unchanged threshold. The first completed startup
run exposed a test-helper false alarm: Docker varies mount-list ordering between
inspections. Repeated read-only samples established identical mount definitions
and other configuration. The helper now compares every mount property after
sorting by destination; the complete repeated rehearsal passed. No application
or production service fix was needed.

The local cutover preflight now requires passing isolated startup evidence for
both schema versions in addition to archive, image and captured-config verification.

## Diagnosis

The running `dtexchange-engagement-1` container is
`55ad0c54567955e15cfb35c0561c75140f128037ce19a67843f6cbaa06760ff5`.
It started at `2026-10-06T22:12:20.884092869Z` and has zero restarts.
Its original Docker image/index identifier is:

`sha256:019a012ccb614992e42501d059635983525546ffcb8f8bb41415b5e2eef7a399`.

Docker 29.1.3 uses the containerd image store on this VPS. The original index has
no image registration in the `moby` namespace. The mutable
`dtexchange-api:local-reviewed` tag now identifies the newer API image
`sha256:4e7774781bb0114d3b6266be54b16c2a2197580164905fcf6a6dd41c4a1f9dd5`.
Consequently, `docker image inspect` and `docker tag` cannot resolve the old index;
this is the immediate cause of `No such image` in the aborted cutover.

The old index blob survives in the `moby_history` namespace. Its AMD64 runtime
manifest, image configuration, and all 11 compressed filesystem layers also
survive. However, its 1,031-byte SLSA/in-toto build-provenance blob is missing:

`sha256:c570b735fe08a797b4f54d8533005238d8701df276b94459d7779277af974758`.

No matching copy was found in available containerd/BuildKit stores or caches.
Deployment archives contain source, not exported Docker/OCI images. No original
registry publication/reference or registry credentials were found. No speculative
registry pull was attempted. Retained lifecycle events do not establish when or
which process removed the registration/provenance; garbage collection must not
be asserted as a proven historical cause.

## Approved recovery and verification

This is **not a rebuilt image and not a live-container commit/export**. It restores
the exact original Linux/AMD64 runtime manifest from content-addressed blobs under
a separate image reference. It does not reproduce the incomplete full image index
or its missing build provenance.

- Image reference: `dtexchange-api:engagement-runtime-rollback-20261009`
- Runtime manifest / restored Docker image ID:
  `sha256:db376a18875f31e48ca028ee3d61d6af53d8994e4e8c1a283679fe29ff3c01cd`
- Original image configuration:
  `sha256:ecc64a6d19182f2c98562d359efe9a4092d7acd5925434cf31a71272d7dfcd9e`
- OCI archive: `/srv/dtexchange/rollback/engagement-20261009/worker-runtime.oci.tar`
- Archive SHA-256:
  `563a517a998a9b463021a444f2d5c34e38e811b286e66fec60d670f36d45a85d`
- Encrypted state: `/srv/dtexchange/rollback/engagement-20261009/worker-state.tar.age`
- Encrypted state SHA-256:
  `960e2cff344de4924325f356cf7ec99096a82b284195e7b9218f4579bfa29870`
- Machine verification: `/srv/dtexchange/rollback/engagement-20261009/verification.json`

All blob hashes/sizes and all 11 uncompressed layer diff IDs were verified against
the original manifest/configuration. The running container's
`ImageManifestDescriptor` matches this exact runtime manifest. The OCI archive
was independently read/hash-checked, loaded through Docker, and inspected; the
restored image ID, RootFS layer list and image configuration matched exactly.
The archive can be loaded without a registry or a rebuild. During artifact
recovery no container was created, paused, stopped, deleted or restarted. The
subsequent isolated startup validation above created and removed only disposable
test containers. No recovery launch used production dependencies.

## Configuration and mounted data

The worker has a read-only root filesystem, non-root `node` user, all capabilities
dropped, `no-new-privileges`, `/tmp` tmpfs, and `unless-stopped` restart policy.
It uses the existing `dtexchange_data` and `dtexchange_edge` networks and exposes
no published ports. Its only reported writable-layer changes are mount-point
directories under `/run`; there is no application-source change to preserve.

Required bind mounts are `/srv/dtexchange/config/app-secrets` and
`/srv/dtexchange/config/tls/ca.crt`, both read-only inside the worker. The encrypted
state archive contains the complete running container configuration, a validated
standalone rollback Compose document, current Compose configuration, current
runtime.env, and these mounted files. The recovery private key is not archived.
Archive encryption/decryption was round-trip verified in memory; plaintext secret
material was not printed or written to local project files.

Three environment names differ between the running worker and current Compose:
`APK_RELEASE_PUBLIC_KEY_B64`, `MANUAL_COLLECTION_ADDRESS`, and
`MANUAL_DEPOSIT_SUBMISSIONS_ENABLED`. Therefore rollback must use the captured
running environment, not blindly merge the current runtime.env. The encrypted
`worker.rollback.compose.json` contains the exact running environment, command,
entrypoint, user, mounts, networks and security settings. Docker Compose parsed
and validated it without starting a service.

The recovery directory is private to root; image/config artifacts are not web
served. No recovery material was copied off the VPS. PostgreSQL/Redis volumes
are not included in this worker image; they remain managed separately.

## Recovery procedure — requires controlled deployment authorization

1. Verify both artifact checksums from the recovery directory and the recorded
   runtime manifest. Read `verification.json`; do not assume the original full
   index was recovered.
2. If the separately named image is absent, run `docker image load` against the
   verified OCI archive. Require restored image ID `db376a18…ff3c01cd` and the
   original configuration/layer identities before proceeding.
3. Decrypt the state archive only on the VPS into a root-only temporary directory
   outside any served path. Do not print its contents. Validate the captured
   `worker.rollback.compose.json` with Docker Compose.
4. Check mounted files/networks still exist. Compare current mounts/configuration
   with the preserved state before changing anything. Do not overwrite shared
   secrets, database files, Redis data, or TLS material blindly; these mounts are
   shared with other services. Use the encrypted copies only as an explicitly
   reviewed disaster-recovery input if originals are unavailable.
5. Only within an approved rollback, use the standalone captured Compose file,
   project `dtexchange`, and service `engagement` with `--no-deps`. Do not run
   `down`, reset the database, or remove volumes. This step would replace the
   worker and has **not** been run during recovery.
6. Verify worker readiness via the API's internal readiness probe and container
   state; preserve immutable data and financial gates. Remove only the temporary
   plaintext recovery directory after checking its exact resolved path. Retain
   encrypted artifacts/checksum evidence.

The previous `.started` guard stays intact. Do not blindly rerun the failed
`master-run-approved-8015.sh`: its original worker-tag step is incompatible with
the incomplete index. A reviewed resume helper must consume this approved,
verified runtime reference and captured configuration before any migration.

## Readiness and unchanged production

- Strict known-host SSH passed repeatedly.
- Internal API `/health/ready`: HTTP 200, database/Redis/queues/workers ready.
- Public health endpoints intentionally return 404 under the existing Nginx
  health/metrics restriction; the production version API responds HTTP 200.
- Website and admin HTTPS: HTTP 200.
- Migrations 001–016 remain applied; 017–021 remain pending. No SQL migration ran.
- Existing data, balances, credentials/roles and audit rows passed preservation
  comparison across 14 critical tables; zero ledger integrity issues.
- Financial-settings digest unchanged:
  `eef37fbd8e35d85bb875b2cea19119c76651db3b14a6a512dd93a8813c5b0182`.
- Manual review/payout remain enabled; automatic blockchain credit and automatic
  payout, transaction/payout execution gates, and synthetic test window stay off.
- Latest encrypted database backup:
  `/srv/dtexchange/backups/dt-20261009T045228Z.dump.age`, SHA-256
  `9f643063ad2db5bb0493027293add4a3739b107fb3747dc3b6f5b60645ca2c4b`.
  Checksum, decryption and full pg_restore archive parsing passed. The earlier
  pre-cutover backup passed isolated restoration and candidate-migration rehearsals
  (71 tables preserved, six user IDs backfilled, zero ledger discrepancies).
- Pinned API/web candidate images and source archive match Build8015 readiness
  evidence. Signed Build8015 and Downloads copy both match
  `a7ba1c16d54457e9d8eae7787ca5bd1719d3567bdbb5e357de263d0081925e54`.
- Public Build8011 remains available. Build8015 and legal drafts stay unpublished.

The revised local cutover helper and a new one-time resume wrapper are prepared
and passed Bash syntax checks without execution. The read-only rollback preflight
also passed against the real recovered image, encrypted state, mounts and networks.
They retain the failed attempt's guard and use a new resume checkpoint; no helper
was dispatched and the production cutover script was not replaced during recovery.

Remaining gate: obtain fresh explicit cutover approval. Authenticated owner and Samsung integration validation
must follow actual deployment; none is claimed complete here.
