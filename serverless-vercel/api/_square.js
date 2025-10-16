// api/_square.js  (shared Square client helper)
import { Client, Environment as SquareEnvironment } from "square";

const Environment = SquareEnvironment ?? { Production: "production", Sandbox: "sandbox" };

export function makeClient() {
  const envName = (process.env.SQUARE_ENVIRONMENT || process.env.SQUARE_ENV || "production").toLowerCase();
  const environment = envName === "production" ? Environment.Production : Environment.Sandbox;

  const accessToken = process.env.SQUARE_ACCESS_TOKEN || process.env.SQUARE_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID || process.env.SQUARE_LOCATION;

  if (!accessToken) throw new Error("SQUARE_ACCESS_TOKEN not set");
  if (!locationId) throw new Error("SQUARE_LOCATION_ID not set");

  return new Client({
    bearerAuthCredentials: { accessToken },
    environment,
  });
}
