import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";
const encodedPrefix = "v1";

export function encryptGitHubAccessToken(accessToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, tokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(accessToken, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    encodedPrefix,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptGitHubAccessToken(encryptedAccessToken: string): string {
  const [version, iv, tag, encrypted] = encryptedAccessToken.split(":");
  if (version !== encodedPrefix || !iv || !tag || !encrypted) {
    throw new Error("GitHub access token uses an unsupported encrypted format.");
  }

  const decipher = createDecipheriv(
    algorithm,
    tokenEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function githubTokenEncryptionKeyId(): string {
  return process.env.GITHUB_TOKEN_ENCRYPTION_KEY_ID || "default";
}

function tokenEncryptionKey(): Buffer {
  const secret = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "GITHUB_TOKEN_ENCRYPTION_KEY must be set to a high-entropy secret with at least 32 characters.",
    );
  }

  return createHash("sha256").update(secret).digest();
}
