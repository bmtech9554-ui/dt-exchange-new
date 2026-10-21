# Domain recovery verification — 12 October 2026

Read-only recovery audit. No DNS, nameserver, DNSSEC, contact, production service,
financial setting or APK publication changes were made by this audit.

## Registrar

Authenticated Namecheap dashboard shows dtexchange.app ACTIVE, valid through
27 September 2027, Namecheap BasicDNS selected, parking OFF and transfer lock ON.
No pending contact-verification/suspension warning was displayed. The dashboard
does not expose a separate completed-verification timestamp in the inspected view.
DNSSEC is OFF; it was not changed.

Saved and independently queried authoritative records:

- A @, api, admin: 172.86.81.233.
- CNAME www: dtexchange.app.
- Nameservers: dns1.registrar-servers.com and dns2.registrar-servers.com.
- Both authoritative servers return the intended VPS for all four hosts.

## HTTPS and production

Normal DNS/TLS requests from the VPS succeeded for apex, www redirect, website,
download page, admin dashboard and public Android-version API. TLS 1.3 certificates
validated with expiration 4 January 2027. No certificate bypass or pinned origin
was used for these recovery checks.

Public APK downloaded successfully over normal HTTPS: Build 8011, 59,383,620 bytes,
SHA-256 8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b.
Metadata still advertises Build 8011. Build 8017 was not published.

Existing production validation passed: API ready; database, Redis, worker current;
21 migrations; zero ledger-integrity issues; automation disabled; legal drafts
unpublished; protected Owner health rejected anonymous access with HTTP 401.
Encrypted logging recovery and archive integrity passed, no backlog or capture gap.

Build 8017 signature was rechecked: APK v2 verified, same production certificate
475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c.
Samsung remained authorized with versionCode 8017. Existing physical UI results
are recorded in referral-coming-soon-8017.md; no rebuild/reinstallation occurred.

## Remaining propagation limitation

Google 8.8.8.8 returned the restored nameservers and all four correct addresses.
Cloudflare 1.1.1.1 began returning the restored nameservers but still intermittently
returned 198.54.117.242 parking answers, TTL 15, at approximately 15:10 IST.
Laptop normal HTTPS recovered, including admin, but resolver results are not yet
consistent. Do not claim DNS_RECOVERED until repeat public resolver and HTTPS
checks consistently pass. Do not rewrite correct authoritative records to address
recursive-cache propagation. Build 8017 remains unpublished pending separate
approval; the prepared backend referral pause remains staged, not activated.

## Windows recovery completed — approximately 15:21 IST

After the user explicitly approved a persistent local Wi-Fi DNS change, Windows
administrator elevation applied Google DoH to IPv4 (8.8.8.8, 8.8.4.4) and IPv6
(2001:4860:4860::8888, 2001:4860:4860::8844). AutoUpgrade is true and plaintext
fallback is false for those resolver entries. Original adapter DNS was DHCP on
both address families; snapshot and an explicit rollback script are retained in
`.tools/dns-recovery/`. No router, registrar or VPS configuration was changed.

Before the fix, cache flushing did not resolve the issue: router-provided IPv4
and IPv6 DNS returned the obsolete parking IP (TTL 1), and direct traditional
Cloudflare queries were inconsistent. Both encrypted resolvers and the VPS's
Cloudflare query path returned the correct records. There were no DT Exchange
hosts overrides, configured Windows VPN or proxy, or detected port-53 listener.
McAfee services were present; no evidence establishes them as the cause, and
they were not modified. Evidence isolates an unreliable local/router/upstream
plain-DNS path; it does not prove which device intercepted or cached packets.

After the approved fix, repeated ordinary Windows and Python resolution returned
172.86.81.233 for all four hostnames. All five public routes (apex, www redirect,
API release metadata, admin dashboard and download page) returned HTTP 200 with
normal TLS verification and no address override. Both authoritative servers
still returned the intended records. The full public Build 8011 download again
matched the 59,383,620-byte size and recorded SHA-256 exactly.

The laptop's configured DNS path and public HTTPS are recovered. This does not
assert every unused plaintext DNS path worldwide is consistent. Build 8017 stays
signed, unchanged and unpublished; mandatory release requirements and separate
publication approval remain outstanding. No customer text or legal document was
changed.
