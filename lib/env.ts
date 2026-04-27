function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function getGeminiApiKey() {
  const value = readEnv("GEMINI_API_KEY", "GOOGLE_API_KEY");
  if (!value) {
    throw new Error(
      "Missing Gemini API key. Set GEMINI_API_KEY or fallback GOOGLE_API_KEY."
    );
  }
  return value;
}

export function getPageSpeedApiKey() {
  const value = readEnv("PAGESPEED_API_KEY", "GOOGLE_API_KEY");
  if (!value) {
    throw new Error(
      "Missing PageSpeed API key. Set PAGESPEED_API_KEY or fallback GOOGLE_API_KEY."
    );
  }
  return value;
}
