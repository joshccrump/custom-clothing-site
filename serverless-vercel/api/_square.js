// api/_square.js  (CommonJS)
const Square = require("square");
const { Client } = Square;
const Environment = Square.Environment || { Production: "production", Sandbox: "sandbox" };

function makeClient() {
  const envName = (process.env.SQUARE_ENV || "production").toLowerCase();
  const environment = envName === "production" ? Environment.Production : Environment.Sandbox;

  if (!process.env.SQUARE_ACCESS_TOKEN) throw new Error("SQUARE_ACCESS_TOKEN not set");
  if (!process.env.SQUARE_LOCATION_ID) throw new Error("SQUARE_LOCATION_ID not set");

  return new Client({
    bearerAuthCredentials: { accessToken: process.env.SQUARE_ACCESS_TOKEN },
    environment,
  });
}

module.exports = { makeClient };
