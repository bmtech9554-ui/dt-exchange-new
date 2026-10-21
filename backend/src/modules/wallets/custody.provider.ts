import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { chainConfig } from "../blockchain/chain.config";
import { providerJson } from "../blockchain/providers/tron-http.provider";
export interface AddressAllocation {
  address: string;
  reference: string;
  provider: string;
  network: string;
  asset: "USDT";
  sandbox: boolean;
}
export abstract class AddressCustodyProvider {
  abstract allocate(input: {
    userId: string;
    allocationKey: string;
    purpose: "wallet" | "order";
  }): Promise<AddressAllocation>;
}
@Injectable()
export class ConfiguredCustodyProvider extends AddressCustodyProvider {
  async allocate(input: {
    userId: string;
    allocationKey: string;
    purpose: "wallet" | "order";
  }): Promise<AddressAllocation> {
    const c = chainConfig();
    if (c.sandbox) {
      if (process.env.NODE_ENV === "production")
        throw new ServiceUnavailableException();
      return {
        address:
          "DT-MOCK-TRON-" +
          createHash("sha256")
            .update(input.allocationKey)
            .digest("hex")
            .slice(0, 40),
        reference: input.allocationKey,
        provider: "mock",
        network: c.network,
        asset: "USDT",
        sandbox: true,
      };
    }
    if (
      process.env.CUSTODY_PROVIDER !== "gateway" ||
      !process.env.CUSTODY_API_URL ||
      !process.env.CUSTODY_PROVIDER_API_KEY
    )
      throw new ServiceUnavailableException(
        "Custody provider is not configured",
      );
    const r = await providerJson(
      new URL("/v1/deposit-addresses", process.env.CUSTODY_API_URL),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.CUSTODY_PROVIDER_API_KEY,
          "Idempotency-Key": input.allocationKey,
        },
        body: JSON.stringify({ ...input, network: c.network, asset: "USDT" }),
      },
    );
    if (
      r.network !== c.network ||
      r.asset !== "USDT" ||
      typeof r.address !== "string" ||
      typeof r.reference !== "string" ||
      r.reference.length > 200
    )
      throw new Error("INVALID_CUSTODY_RESPONSE");
    return {
      address: r.address,
      reference: r.reference,
      provider: "custody_gateway",
      network: c.network,
      asset: "USDT",
      sandbox: false,
    };
  }
}
