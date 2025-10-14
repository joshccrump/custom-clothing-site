// scripts/square-env.mjs
export function getSquareEnv(fromProcess = true) {
  const envNameRaw = (fromProcess ? process.env.SQUARE_ENVIRONMENT : undefined) || "sandbox";
  const envName = String(envNameRaw).toLowerCase().trim();
  if (!["sandbox","production"].includes(envName)) throw new Error(`Invalid SQUARE_ENVIRONMENT: ${envNameRaw}`);

  const accessToken = (fromProcess ? process.env.SQUARE_ACCESS_TOKEN : undefined);
  if (!accessToken || accessToken.trim().length < 40) {
    throw new Error("SQUARE_ACCESS_TOKEN missing or too short");
  }

  const locationId = (fromProcess ? process.env.SQUARE_LOCATION_ID : undefined) || null;
  const appId = (fromProcess ? process.env.SQUARE_APP_ID : undefined) || null;

  return { envName, accessToken: accessToken.trim(), locationId, appId };
}
