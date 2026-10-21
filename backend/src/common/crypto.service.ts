import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import jwt from "jsonwebtoken";
const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (e, k) => (e ? reject(e) : resolve(k)),
    ),
  );
@Injectable()
export class CryptoService {
  private key(name: string) {
    const value = process.env[name];
    if (!value) throw new ServiceUnavailableException();
    return Buffer.from(value, "base64");
  }
  digest(value: string, purpose = "lookup") {
    return createHmac(
      "sha256",
      this.key(purpose === "otp" ? "OTP_HASH_KEY" : "LOOKUP_HASH_KEY"),
    )
      .update(purpose + "\0" + value)
      .digest("hex");
  }
  equal(a: string, b: string) {
    const x = Buffer.from(a),
      y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  }
  encrypt(value: string, context: string) {
    const iv = randomBytes(12);
    const c = createCipheriv(
      "aes-256-gcm",
      this.key("DATA_ENCRYPTION_KEY"),
      iv,
    );
    c.setAAD(Buffer.from(context));
    return Buffer.concat([
      Buffer.from([1]),
      iv,
      c.update(value, "utf8"),
      c.final(),
      c.getAuthTag(),
    ]);
  }
  decrypt(value: Buffer | Uint8Array, context: string) {
    const b = Buffer.from(value);
    if (b[0] !== 1) throw new Error("Unsupported encryption envelope");
    const d = createDecipheriv(
      "aes-256-gcm",
      this.key("DATA_ENCRYPTION_KEY"),
      b.subarray(1, 13),
    );
    d.setAAD(Buffer.from(context));
    d.setAuthTag(b.subarray(-16));
    return Buffer.concat([d.update(b.subarray(13, -16)), d.final()]).toString(
      "utf8",
    );
  }
  async password(value: string) {
    const salt = randomBytes(16);
    return `scrypt$131072$8$1$${salt.toString("hex")}$${(await derive(value, salt)).toString("hex")}`;
  }
  async verifyPassword(value: string, hash: string | null) {
    const parts = hash?.split("$");
    if (!parts || parts.length !== 6) {
      await derive(value, Buffer.alloc(16));
      return false;
    }
    return this.equal(
      (await derive(value, Buffer.from(parts[4]!, "hex"))).toString("hex"),
      parts[5]!,
    );
  }
  token() {
    return randomBytes(32).toString("base64url");
  }
  access(userId: string, sessionId: string) {
    return jwt.sign({ sid: sessionId }, this.key("JWT_PRIVATE_KEY_B64"), {
      algorithm: "RS256",
      subject: userId,
      issuer: "dt-exchange",
      audience: "dt-mobile",
      expiresIn: "10m",
    });
  }
  verifyAccess(token: string) {
    const result = jwt.verify(token, this.key("JWT_PUBLIC_KEY_B64"), {
      algorithms: ["RS256"],
      issuer: "dt-exchange",
      audience: "dt-mobile",
    });
    if (
      typeof result === "string" ||
      typeof result.sub !== "string" ||
      typeof result.sid !== "string"
    )
      throw new Error("Invalid token");
    return { userId: result.sub, sessionId: result.sid as string };
  }
}
