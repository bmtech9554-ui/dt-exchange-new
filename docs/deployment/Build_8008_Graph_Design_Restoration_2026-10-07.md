# Build 8008 graph design restoration

## Evidence and attribution
This checkout has no .git directory. Inspected original UI update ZIP, manual-release ZIP, pre-deployment source tar, existing design reports and saved compact-Home render. The deployment tar has no mobile source. The original UI ZIP already separates sample curves from a flat production line; it predates the approved compact graph. The approved compact render (docs/ui-ux-update/previews/Home_Compact_360x740.png) and 27 September design report show the multi-curve mint/teal/aqua artwork retained in the current widget's preview branch.

The Build 8005 report confirms its fix enabled motion on the existing flat production branch. It did not itself replace the wavy geometry. The visible mismatch results from the preview/production styling split: production used [.5,.5], excluded area/grid/highlight points and omitted the value bubble. This is not an invented chart or a claimed Git rollback.

## A: styling split
_CurveGeometry selected flat coordinates for connected mode. RateSparklinePainter gated grid, area fill, endpoint highlight and points by preview. RateSparkline/Home gated the value bubble by preview.

## B: retained animation fix
Entrance/sweep controllers, continuous production overlay, cached base RepaintBoundary, reduced motion, TickerMode, background/resume and disposal unchanged byte-for-byte. No Home frame-loop or network polling added.

## C: restored approved artwork
Reuse exact normalized coordinates [.78,.72,.77,.48,.56,.34,.42,.24,.29,.13], cubic midpoint smoothing, margins, 3px gradient stroke, original fill/grid/glow/point sizes, and shared glint geometry. Existing graph heights76/88, card layout, spacing, header and action cards untouched. Value bubble uses the supplied backend rate only. Production keeps truthful decorative text; preview-only time labels and percentage changes are not introduced as fake financial history.

## Files
- mobile/lib/core/widgets/rate_sparkline.dart
- mobile/lib/features/home/home_page.dart (only bubble availability condition)
- mobile/test/approved_graph_design_test.dart
- mobile/test/home_layout_test.dart
- mobile/test/goldens/approved-graph-76.png
- mobile/test/goldens/approved-graph-88.png
- mobile/pubspec.yaml
- mobile/config/production.json
- local existing signing helper build number8008

Pixel references generated from the unedited Build8007 approved preview painter snapshot, not from the replacement implementation. Both connected-mode paint comparisons pass at the existing heights. Nonvisual production logic unchanged. No production deployment or temporary synthetic exception required.

Pending final suite results, existing-key signing, authorized Samsung update and physical visual/lifecycle checks. Public APK download remains disabled.

## Local verification completed
Flutter analyze: no issues. Full Flutter suite:348 passed. Golden comparisons cover the original approved artwork at76/88px, including glint geometry. Existing tab/background/reduced-motion/disposal tests pass. Responsive Home tests remain passing. Only Home source change outside the painter is passing the available backend rate to the existing value bubble.

Secure existing-password signing terminal opened for8008. Physical validation remains pending: Samsung first reported unauthorized, then absent after reconnect retry. No physical restoration or full-pass marker is claimed yet.

## Latest verification and blockers
Build8008 signed release verified with the existing identity; unchanged copy at C:/Users/Ashik/Downloads/DTExchange-release.apk matches SHA-256 179984a39c28e990ac8aa87e61ce296762a0149ac19347641b83ada07ffc71b2.
Flutter analyze clean;348 Flutter tests,40 website tests and5 focused backend tests passed. Website production build passed. Isolated Chrome checks at320/390/1440px show no horizontal overflow, hero first, processing-terms final and unique, no broken hash anchors, two preserved official Telegram links. Screenshots inspected. Website source moves terms to final section; not yet deployed.
Latest Samsung ADB status unauthorized. Strict SSH using verified known_hosts timed out before connection. No install or production mutation occurred in this continuation. Physical graph/lifecycle verification remains pending; no full-pass claim. Public APK publication has not been enabled.

## Physical and production completion — 7 October 2026
Samsung SM-F956B authorized; signed8008 installed successfully with adb install -r, no uninstall or rebuild. Existing authenticated session retained. Installed versionCode8008/versionName1.0.0. Copied release hash still matches verified signed artifact.
Physical Home screenshot confirms approved multi-curve/grid/fill/glow artwork, backend INR103.00 and preserved Home layout. Graph-only captures differ at0/1.2/30/60/61.2 seconds; visually inspected61.2s and background-resume images. Tab return and background/foreground captures both retain animation. Profile > Settings > Help & Support physically shows Telegram Support and @dtexchange. No SMS or financial transaction performed.
Strict verified SSH restored. Production source hash matched tested baseline before deployment. Saved rollback source and image, staged only admin/src/app/site/page.tsx, built and restarted web only. Live HTTPS checks at320/390/1440px: hero first, processing-terms final and unique, no overflow or broken hash anchors, two official Telegram links. API, workers, PostgreSQL, Redis and web running; API readiness200. Public APK URL404. No financial configuration, security exception, role, signing identity or API/database change.
GRAPH_PREVIOUS_DESIGN_RESTORED
GRAPH_ANIMATION_VALIDATED
WEBSITE_TERMS_SECTION_MOVED
FULL_PHYSICAL_DEVICE_VALIDATION_PASSED
This completes the remaining8008 presentation checks together with prior completed financial synthetic validation; no financial tests were repeated. Publication remains disabled pending explicit approval.
