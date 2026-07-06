export const mobileGitHubCallbackErrors = {
  invalid: "github_callback_invalid",
  expired: "github_connection_expired",
  failed: "github_connection_failed",
} as const;

export function mobileGitHubCallbackErrorCode(error: unknown): string {
  const message = errorMessage(error);

  if (/invalid github oauth callback/i.test(message)) {
    return mobileGitHubCallbackErrors.invalid;
  }

  if (/mobile auth state is invalid or expired/i.test(message)) {
    return mobileGitHubCallbackErrors.expired;
  }

  return mobileGitHubCallbackErrors.failed;
}

export function mobileAuthExchangeErrorMessage(error: unknown): string {
  const message = errorMessage(error);

  if (/mobile auth code is invalid or expired/i.test(message)) {
    return "GitHub sign-in expired. Please start GitHub connection again.";
  }

  return "Could not finish GitHub device setup. Please try connecting GitHub again.";
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string") return message;
  }

  return "";
}
