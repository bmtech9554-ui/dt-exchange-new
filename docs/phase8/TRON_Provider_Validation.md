# TRON provider validation

DT Exchange RC1 · 1.0.0-rc.1 · Phase 8

Status: **NOT_VALIDATED** against an external endpoint. The configured development provider is MOCK. No mainnet activation or transfer occurred.

The existing tron-http adapter uses HTTPS, bounded responses and timeouts. It validates transaction receipts, canonical blocks, exact token units and the configured contract; domain tests cover invalid token/recipient/amount, confirmations, duplicates and review handling. These are local tests, not proof of a live endpoint's behavior.

For an authorized isolated test network, inject TRON_API_URL, TRON_API_KEY, TRON_USDT_CONTRACT, TRON_VALIDATION_TX_HASH, TRON_REQUIRED_CONFIRMATIONS and TRON_PROVIDER=tron-http. Set DEPLOYMENT_ENV=staging and TRON_NETWORK=tron-shasta or tron-nile, then:

```sh
npm run build --workspace @dt/backend
node backend/scripts/validate-tron.mjs
```

The command retrieves blocks and an existing known test transaction only. It never broadcasts or signs. Success reports CONNECTED, not PRODUCTION_READY. Separately record contract ownership/configuration, sender/recipient, amount, confirmations, canonicality, scan pagination, 429 handling, timeout and error mapping. Use a controlled proxy for fault injection; do not overload a provider. Test-network token configuration must not be presented as the official mainnet USDT contract.

Before mainnet, independently verify the official configured contract against authoritative issuer/provider evidence; explicitly set BLOCKCHAIN_NETWORK=mainnet and TRON_NETWORK=tron-mainnet only under approved deployment configuration. Custody remains an external gateway/signing trust boundary. HSM/KMS/external custody approval is required; no raw private keys belong in application code or ordinary tables.
