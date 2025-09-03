import fs from 'fs';
import { google } from 'googleapis';

export type GoogleClients = {
  oAuth2Client: any;
  calendar: any;
};

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

function loadToken() {
  const raw = fs.readFileSync('token.json', 'utf8');
  return JSON.parse(raw);
}

export function getGoogleClients(): GoogleClients {
  const creds = loadCredentials();
  const token = loadToken();
  const { client_id, client_secret, redirect_uris } = creds;
  const redirectUri = Array.isArray(redirect_uris) && redirect_uris.length ? redirect_uris[0] : undefined;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);
  oAuth2Client.setCredentials(token);
  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  return { oAuth2Client, calendar };
}