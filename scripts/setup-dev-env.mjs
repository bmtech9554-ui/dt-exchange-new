import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, generateKeyPairSync } from "node:crypto";
const root = new URL("../", import.meta.url);
const postgres = randomBytes(24).toString("hex");
const redis = randomBytes(24).toString("hex");
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 3072,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
let text = await readFile(new URL(".env.example", root), "utf8");
text = text
  .replace("POSTGRES_PASSWORD=\n", `POSTGRES_PASSWORD=${postgres}\n`)
  .replace("REDIS_PASSWORD=\n", `REDIS_PASSWORD=${redis}\n`)
  .replace(
    "REPLACE_WITH_URL_ENCODED_PASSWORD@127.0.0.1:5432",
    `${postgres}@127.0.0.1:5432`,
  )
  .replace(
    "REPLACE_WITH_URL_ENCODED_PASSWORD@127.0.0.1:6379",
    `${redis}@127.0.0.1:6379`,
  );
for (const [name, value] of Object.entries({
  JWT_PRIVATE_KEY_B64: Buffer.from(privateKey).toString("base64"),
  JWT_PUBLIC_KEY_B64: Buffer.from(publicKey).toString("base64"),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  LOOKUP_HASH_KEY: randomBytes(32).toString("base64"),
  OTP_HASH_KEY: randomBytes(32).toString("base64"),
})) {
  text = text.replace(`${name}=\n`, `${name}=${value}\n`);
}
await writeFile(new URL(".env", root), text, { flag: "wx", mode: 0o600 });
console.log(
  "Created .env with local-only random credentials. Existing files are never overwritten.",
);
