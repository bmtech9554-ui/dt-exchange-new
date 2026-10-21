import type { PublicConfiguration } from "@/lib/public-configuration";
export function PublicMaintenance({
  configuration,
}: {
  configuration: PublicConfiguration;
}) {
  const telegram = configuration.config?.telegram ?? "dtexchange";
  return (
    <main
      className="public-site"
      style={{ maxWidth: 720, margin: "10vh auto", padding: 24 }}
    >
      <img
        src="/brand/dt-monogram.svg"
        width="52"
        height="52"
        alt="DT Exchange"
      />
      <h1>We'll be back shortly</h1>
      <p>
        {configuration.maintenance?.message ??
          "DT Exchange is temporarily under maintenance. Please try again shortly."}
      </p>
      <a href="">Retry</a>
      <p>
        <a
          href={"https://t.me/" + telegram}
          rel="noopener noreferrer"
          target="_blank"
        >
          Telegram Support @{telegram}
        </a>
      </p>
    </main>
  );
}
