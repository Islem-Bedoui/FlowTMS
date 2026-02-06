const TOKEN_URL = "https://login.microsoftonline.com/38681c7b-907c-49c7-9777-d0e3fabfd826/oauth2/v2.0/token";

// Store the token in memory (Better to use a database or cache in production)
let accessToken: string | null = null;
let tokenExpiry: number = 0;
async function fetchAccessToken() {
    try {
      const clientId = (process.env.AZURE_AD_CLIENT_ID || "").trim();
      const clientSecret = (process.env.AZURE_AD_CLIENT_SECRET || "").trim();
      const scope = (process.env.AZURE_AD_SCOPE || "https://api.businesscentral.dynamics.com/.default").trim();

      if (!clientId || !clientSecret) {
        throw new Error("Missing AZURE_AD_CLIENT_ID or AZURE_AD_CLIENT_SECRET");
      }

      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
          scope,
        }),
      });
  
      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`);
      }
  
      const data = await response.json();
      accessToken = data.access_token;
      tokenExpiry = Date.now() + data.expires_in * 1000; // Expiry time in milliseconds
  
      console.log(" New Access Token Generated:", accessToken);
    } catch (error: any) {
      console.error("Error fetching access token:", error.message);
      throw new Error("Failed to get access token");
    }
  }
  export async function getValidAccessToken(): Promise<string> {
    if (!accessToken || Date.now() >= tokenExpiry) {
      await fetchAccessToken(); // Get a new token if expired
    }
    if (!accessToken) {
      throw new Error("Failed to get access token");
    }
    return accessToken;
  }