# TRON and custody acceptance

DT Exchange · Final Production Setup · based on RC1 1.0.0-rc.1

Status: **NEEDS_CREDENTIALS / BLOCKED**. No actual provider read was performed. No USDT was transferred. Existing mock tests do not validate a real endpoint or official mainnet token contract.

Supply TRON_API_URL/API_KEY, TRON_PROVIDER=tron-http, explicit test network, token contract, required confirmations and an existing known test transaction. The existing command only reads:

```sh
node backend/scripts/validate-tron.mjs
```

It requires DEPLOYMENT_ENV=staging and TRON_NETWORK=tron-shasta or tron-nile, with TRON_VALIDATION_TX_HASH. Record latest block, contract-filtered transaction details, address validity and confirmation count; test timeouts/429/error handling through a controlled fixture/proxy. CONNECTED is only connectivity evidence. Independently verify the official production TRC20 USDT contract with authoritative issuer/provider evidence when the intended network is selected. No such verification is claimed here.

Custody architecture observed in source: ConfiguredCustodyProvider allocates by a stable wallet/order allocation key. Development addresses are explicitly nonpayable mocks. A real gateway supplies deposit addresses using its API and idempotency key. This is an external custody allocation model, not a newly chosen shared collection wallet. Unique allocation/ownership rules require gateway acceptance; no private keys are generated or stored by the app. Any signing remains behind external custody/HSM/KMS/isolated signer. Do not place keys in .env.example, ordinary database fields, Flutter, admin or ZIPs.
