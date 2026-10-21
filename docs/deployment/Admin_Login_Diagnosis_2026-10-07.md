# Admin login diagnosis — pending production access

Public HTTPS admin root redirects to /dashboard. Browser loads without JavaScript errors; anonymous operations/dashboard returns401 and renders the email/password/authenticator form. The default Dashboard requires dashboard.read, which the prior confirmed standard-operations/manual-deposit-review/release-publisher grants intentionally do not include.

Confirmed frontend defect (isolated browser with intercepted synthetic responses): login200 followed by dashboard403 leaves the sign-in form visible. ProductionOperations.action only clears login after load succeeds. This incorrectly couples authentication state to access to the selected module.

Local correction in admin/src/components/production-operations.tsx: clear login immediately after successful login response, before loading module data. Retain role-denied message and all server authentication/RBAC enforcement. No permissions, credentials, TOTP, cookies, proxy, financial configuration or APK changes.

Validation:41 admin tests and production build pass. Isolated browser regression .tools/test-admin-login-state.cjs confirms login success plus403 hides form, logout restores form, rejected login retains form, and re-login succeeds in UI fixture. Fixture intercepts every operations request; no synthetic credentials reached production.

Production verification remains incomplete. Strict SSH with existing identity/known_hosts timed out on repeated attempts. Could not yet inspect current DB, clock or sanitized production login logs; therefore this confirmed frontend defect is not asserted as the sole cause of the user's actual login failure. Fix not deployed. Existing-password/fresh-TOTP secure terminal validation must follow production diagnosis/deployment. No account duplication/reset, no TOTP reset, no additional role grants and no APK publication occurred.


## Superseded by completed routing repair
The full session-aware frontend fix is now deployed and live-validated. See Admin_Post_Login_Routing_2026-10-07.md for current state, changed files and secure login/logout evidence. No credentials or permissions changed.
