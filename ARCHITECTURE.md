
## Manual operations profile (additive migration 008)

Manual intake/evidence and Android release metadata are separate domains beside the established financial model. Manual deposit approval calls the existing deposit journal; wallet-funded quotes/orders call existing reserve/sell/fee journals; manual payment confirmation calls existing INR settlement. There is one balance source: ledger accounts and entries. A configured shared TRC20 collection address needs no application-held signing key. Private proof/receipt bytes are AES-GCM encrypted in PostgreSQL and fetched only through authorized endpoints. Automatic providers and their workers are retained but disabled in the manual profile. Details and limitations are in `docs/manual`.
