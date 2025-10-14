// scripts/square-sdk-shim.mjs
// Loads the Square SDK in a way that works whether it's CommonJS or ESM,
// and whether it exposes Environment or not.
export async function loadSquare() {
  const mod = await import("square");
  // Handle CJS default export vs ESM named exports
  const S = (mod && typeof mod.default === "object") ? mod.default : mod;

  const Client = S.Client || mod.Client || S.default?.Client;
  // Fall back to string enum if Environment missing
  const Environment = S.Environment || mod.Environment || { Production: "production", Sandbox: "sandbox" };

  if (!Client) {
    throw new Error("Square SDK: Client class not found. Ensure `npm i square` is installed.");
  }
  return { Client, Environment };
}
