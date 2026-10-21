# Build 8005 production graph fix

Root cause: RateSparkline starts ambient motion only when preview=true and only paints RateGlintPainter in preview. Production intentionally uses a decorative flat line (no historical feed), but its highlight therefore stops after entrance. This is a production-mode branch, not an optimizer or network issue.

Fix: production repeats the existing 4.2-second local sweep; the overlay follows the production line geometry. The base curve remains a RepaintBoundary with unchanged painter identity during ambient motion. No animation-driven requests or Home setState loop. Preview retains its existing cadence and sample-only labels; production retains decorative labeling and no fabricated time history. Reduced motion, TickerMode, background lifecycle and disposal stop motion. Rate availability controls animation. Failed rate fetch resets the unavailable display instead of showing stale values as current; valid backend responses restore it.

Version configured: 1.0.0+8005, production APP_VERSION_CODE=8005. Same existing signing helper and identity; no publication. No backend or admin permission change.

Pending: existing signing password in secure local terminal, release build/signature/hash verification, update install on Samsung, 60-second physical animation and tab/resume checks, final physical regression/cleanup validation. Build 8004 remains installed until the signed update is verified.
