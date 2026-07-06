export function mobileGitHubOAuthConfigurationError(): string | null {
  const missing: string[] = [];
  const tokenEncryptionKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;

  if (!process.env.GITHUB_CLIENT_ID) missing.push("GITHUB_CLIENT_ID");
  if (!process.env.GITHUB_CLIENT_SECRET) missing.push("GITHUB_CLIENT_SECRET");
  if (!tokenEncryptionKey) {
    missing.push("GITHUB_TOKEN_ENCRYPTION_KEY");
  }
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    missing.push("DATABASE_URL or POSTGRES_URL");
  }

  if (missing.length > 0) {
    return `Set ${missing.join(", ")} to enable mobile GitHub sign-in.`;
  }

  if (!tokenEncryptionKey) {
    return "Set GITHUB_TOKEN_ENCRYPTION_KEY to enable mobile GitHub sign-in.";
  }

  if (tokenEncryptionKey.length < 32) {
    return "GITHUB_TOKEN_ENCRYPTION_KEY must be at least 32 characters to enable mobile GitHub sign-in.";
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.MOBILE_TOKEN_SECRET) {
      return "Set MOBILE_TOKEN_SECRET to enable mobile GitHub sign-in.";
    }

    if (process.env.MOBILE_TOKEN_SECRET === process.env.SESSION_SECRET) {
      return "MOBILE_TOKEN_SECRET must be distinct from SESSION_SECRET.";
    }
  }

  return null;
}
