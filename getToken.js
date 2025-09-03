// getToken.js - OAuth token fetch for Google APIs using a Web client redirect
// - Starts a local HTTP server to receive the OAuth callback at the redirect_uri
// - Explicitly sets redirect_uri in the auth URL
// - Saves tokens to token.json with clear logs and robust error handling

import fs from "fs";
import http from "http";
import { google } from "googleapis";
import { spawn } from "child_process";

const TOKEN_PATH = "token.json";

function loadCredentials() {
  // Load credentials from environment variables instead of credentials.json
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect_uri = process.env.GOOGLE_REDIRECT_URI;
  
  if (!client_id || !client_secret || !redirect_uri) {
    throw new Error('Missing Google OAuth credentials in environment variables. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.');
  }
  
  return {
    client_id,
    client_secret,
    redirect_uris: [redirect_uri]
  };
}

function tryOpenInBrowser(url) {
  try {
    // Windows: open default browser
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
  } catch {
    // Ignore failures; user can open manually
  }
}

function ensureHttpOrHttps(url) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported redirect protocol: ${url.protocol}. Use http or https.`);
  }
}

async function main() {
  const creds = loadCredentials();
  const { client_id, client_secret, redirect_uris } = creds;

  const redirectUri = redirect_uris[0];
  const redirectURL = new URL(redirectUri);
  ensureHttpOrHttps(redirectURL);

  const host = redirectURL.hostname;
  const port = Number(redirectURL.port || (redirectURL.protocol === "https:" ? 443 : 80));
  const path = redirectURL.pathname || "/";

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );

  if (fs.existsSync(TOKEN_PATH)) {
    console.log(`ℹ️  ${TOKEN_PATH} already exists. Delete it to re-authorize if needed.`);
  }

  // Build the auth URL manually to ensure required params (e.g., response_type=code)
  const params = new URLSearchParams({
    client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // Start callback server first to avoid race conditions
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method !== "GET") {
        res.statusCode = 405;
        res.end("Method Not Allowed");
        return;
      }

      const reqUrl = new URL(req.url, `${redirectURL.origin}`);
      if (reqUrl.pathname !== path) {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }

      const code = reqUrl.searchParams.get("code");
      const errParam = reqUrl.searchParams.get("error");

      if (errParam) {
        console.error("OAuth error:", errParam);
        res.statusCode = 400;
        res.end("OAuth error: " + errParam);
        server.close();
        return;
      }

      if (!code) {
        res.statusCode = 400;
        res.end("Missing code parameter");
        return;
      }

      try {
        const { tokens } = await oAuth2Client.getToken({ code, redirect_uri: redirectUri });
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        console.log("✅ Token stored to", TOKEN_PATH);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end("<html><body><h2>Authorization complete.</h2><p>You can close this window and return to the terminal.</p></body></html>");
      } catch (e) {
        console.error("Error retrieving access token:", e?.response?.data ?? e);
        res.statusCode = 500;
        res.end("Failed to retrieve token. Check terminal for details.");
      } finally {
        try { server.close(); } catch {}
        // Exit shortly after to flush logs
        setTimeout(() => process.exit(0), 100);
      }
    } catch (e) {
      console.error("Unexpected error:", e);
      try { res.statusCode = 500; res.end("Internal error"); } catch {}
      try { server.close(); } catch {}
      setTimeout(() => process.exit(1), 100);
    }
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use on ${host}. Close the other process or change the first redirect URI in credentials.json.`);
    } else {
      console.error("Server error:", err);
    }
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(`Listening for OAuth callback on ${host}:${port}${path}`);
    console.log("Authorize this app by visiting this URL:\n", authUrl);
    tryOpenInBrowser(authUrl);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});