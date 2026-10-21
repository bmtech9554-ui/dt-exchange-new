# Nginx boundary reserved for Phase 8

The planned ingress terminates TLS, routes `/api/v1` to NestJS, routes the restricted admin hostname to Next.js, limits request size and upgrade connections, and forwards trusted request metadata only. The API remains the sole owner of authorization and financial writes. No production proxy configuration is enabled in Phase 1.
