import { notFound } from 'next/navigation';
import '../../site/site.css';
export const dynamic = 'force-dynamic';
export default async function Legal({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!['privacy', 'terms'].includes(kind)) notFound();
  let document: { body: string; version: string } | null = null;
  try {
    if (process.env.DT_BACKEND_URL === 'https://api.dtexchange.app/api/v1') {
      const response = await fetch(`${process.env.DT_BACKEND_URL}/settings/legal/${kind}`, {
        cache: 'no-store', signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const value = await response.json();
        // Drafts never render on public routes, even if returned accidentally.
        if (value.status === 'PUBLISHED' && typeof value.body === 'string') {
          document = { body: value.body, version: String(value.version ?? '') };
        }
      }
    }
  } catch { /* Retain an honest unavailable state; do not invent legal terms. */ }
  return <div className="public-site">
    <header className="site-nav"><a className="site-brand" href="/">
      <img src="/brand/dt-monogram.svg" width="42" height="42" alt="DT Exchange" />DT Exchange
    </a></header>
    <main style={{ maxWidth: 840, padding: '48px 24px', margin: '0 auto' }}>
      <h1>{kind === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}</h1>
      {document ? <article style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {document.body}{document.version && <p>Version: {document.version}</p>}
      </article> : <p>This document is not yet published. Please contact <a href="https://t.me/dtexchange">@dtexchange</a> for assistance.</p>}
      <a href="/">Back to DT Exchange</a>
    </main>
  </div>;
}
