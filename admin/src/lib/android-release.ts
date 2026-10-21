/** Public download links must stay on the single official origin. */
export function validAndroidRelease(d: any, allowedOrigins: string[]): boolean {
  try {
    const u = new URL(d.apkUrl),
      page = new URL(d.downloadUrl);
    return (
      d.available === true &&
      allowedOrigins.includes("https://dtexchange.app") &&
      u.href === "https://dtexchange.app/downloads/DTExchange.apk" &&
      page.href === "https://dtexchange.app/download" &&
      /^[a-f0-9]{64}$/.test(d.sha256) &&
      /^[a-f0-9]{64}$/.test(d.certificateSha256) &&
      /^\d+\.\d+\.\d+$/.test(d.latestVersion) &&
      Number.isSafeInteger(d.latestVersionCode) &&
      d.latestVersionCode > 0 &&
      Number.isSafeInteger(d.minimumVersionCode) &&
      d.minimumVersionCode > 0 &&
      d.minimumVersionCode <= d.latestVersionCode &&
      /^\d+$/.test(String(d.sizeBytes)) &&
      Number.isSafeInteger(Number(d.sizeBytes)) &&
      Number(d.sizeBytes) > 0 &&
      typeof d.releaseNotes === "string" &&
      d.releaseNotes.length > 0 &&
      d.releaseNotes.length <= 4000 &&
      typeof d.releaseDate === "string" &&
      Number.isFinite(Date.parse(d.releaseDate)) &&
      typeof d.mandatory === "boolean"
    );
  } catch {
    return false;
  }
}
