type Release = {
  version_name: string; version_code: number; size_bytes: string;
  sha256: string; certificate_sha256: string; signing_status?: string;
  attestation_status?: string; active: boolean; created_at: string;
  apk_url?: string | null; download_url?: string | null;
};
export function AndroidReleaseDetails({ release: r }: { release: Release }) {
  const verified = r.signing_status === "VERIFIED_BY_RELEASE_ATTESTATION";
  return <section aria-label={`Android Build ${r.version_code} details`}>
    <h2>Version {r.version_name} · Build {r.version_code}</h2>
    <dl className="owner-record" style={{ overflowWrap: "anywhere", minWidth: 0 }}>
      <div><dt>APK file size</dt><dd>{r.size_bytes} bytes</dd></div>
      <div><dt>SHA-256</dt><dd>{r.sha256}</dd></div>
      <div><dt>Production signing certificate status</dt><dd>{verified ? "Verified by signed release attestation" : "Unverified"}</dd></div>
      <div><dt>Certificate SHA-256</dt><dd>{r.certificate_sha256}</dd></div>
      <div><dt>Release attestation status</dt><dd>{r.attestation_status === "VERIFIED" ? "Verified" : "Unverified"}</dd></div>
      <div><dt>Publication status</dt><dd>{r.active ? "Current public release" : "Superseded release"}</dd></div>
      <div><dt>Release date/time (UTC)</dt><dd>{r.created_at}</dd></div>
      <div><dt>Official APK download URL</dt><dd>{r.active && r.apk_url ? <a href={r.apk_url}>{r.apk_url}</a> : "Superseded — current download serves the latest release"}</dd></div>
      <div><dt>Official download page</dt><dd>{r.download_url ? <a href={r.download_url}>{r.download_url}</a> : "Unavailable"}</dd></div>
    </dl>
  </section>;
}
