/** Internal metadata only. No bodies, URLs, query strings, headers, identifiers,
 * OTPs or exception messages may enter this event. It cannot change responses. */
export function securityObservation(path: string, status: number) {
  const operation = path === '/api/v1/admin/login' ? 'admin_login'
    : path === '/api/v1/auth/login' ? 'user_login'
    : path === '/api/v1/auth/verify-otp' ? 'otp_verify'
    : path === '/api/v1/auth/refresh' ? 'session_refresh'
    : null;
  if (operation) return { event: 'security_auth_result', operation,
    result: status >= 200 && status < 300 ? 'accepted' : 'rejected', status };
  // A conflict may be a duplicate TxID or another existing submission guard.
  // Do not infer which guard fired or log the submitted transaction hash.
  if (path === '/api/v1/manual/deposits' && status === 409)
    return { event: 'security_deposit_conflict', operation: 'manual_deposit_submit',
      result: 'conflict', status };
  if (status === 401 || status === 403 || status === 429)
    return { event: 'security_request_rejected', operation: 'protected_request',
      result: 'rejected', status };
  return null;
}
