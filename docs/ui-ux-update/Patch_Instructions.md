# Applying to newer local source

Run `git apply --check DT_Exchange_UI_Update.patch` from the project root before applying. Resolve conflicts against your newer local edits; do not replace later auth/API/signing changes with an older archive. After applying the patch, also copy `mobile/test/assets/usdt-proof-preview.png` from this full archive, because the text patch cannot include a binary fixture. Run Flutter analysis and the full test suite.

Older source manifests and phase reports are retained as historical records. `UI_UX_SOURCE_MANIFEST.json` is the current archive manifest.
