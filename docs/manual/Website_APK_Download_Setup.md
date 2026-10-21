# Official download website

The existing Next.js project now has a public `/download` route outside the admin shell. It reuses the approved logo and white/mint/blue/navy tokens. It retrieves server-side release metadata, checks exact approved HTTPS origin and APK path, and shows version, size, update date, release notes and SHA-256 only for an available signed release. Otherwise the download button is disabled.

Set Next server variables `DT_BACKEND_URL` to the owned HTTPS API base including `/api/v1` and `APK_ALLOWED_ORIGINS` to the owned website origin. These contain no provider secrets. The example domain names are plans, not proof of ownership.

`docker/nginx/production.conf` includes a website virtual host placeholder, TLS references and exact APK/checksum locations. Configure actual owned hostnames/certificates and mount `/srv/dt-release` read-only from the verified artifact directory. APK MIME is `application/vnd.android.package-archive`. TLS keys stay outside source. Public website routing allows `/download`, required Next static assets and brand assets; it does not expose admin/API routes on the website host.

Uploads to authenticated manual file endpoints have a scoped 6 MB reverse-proxy cap; the app enforces 5 MB files. General JSON requests remain 64 KB. Receipt/proof endpoints never become public static locations.

Suggested validation after staging, without moving money:

```bash
curl --fail --head "$OFFICIAL_DOWNLOAD_ORIGIN/download"
curl --fail --head "$OFFICIAL_DOWNLOAD_ORIGIN/downloads/DTExchange.apk"
curl --fail --output /tmp/DTExchange.apk "$OFFICIAL_DOWNLOAD_ORIGIN/downloads/DTExchange.apk"
sha256sum /tmp/DTExchange.apk
apksigner verify --verbose --print-certs /tmp/DTExchange.apk
```

Compare the checksum and signer against the independently approved manifest. Verify DNS, certificate chain/renewal, HSTS, no mixed content, host allowlists and download behavior on a real Android device. No website/domain/TLS deployment was performed here.

Installation instructions explicitly retain Play Protect and limit unknown-source permission to the downloading browser; they never instruct globally disabling Android security.
