import { google } from 'googleapis';
import { storage } from './storage';

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

async function loadToken() {
  try {
    const tokenData = await storage.getGoogleToken();
    if (!tokenData) {
      throw new Error('Google OAuth token not found. Please run the OAuth setup first.');
    }
    return tokenData;
  } catch (error) {
    console.error('Error loading Google OAuth token:', error);
    throw error;
  }
}

export async function getGoogleClients(): Promise<GoogleClients> {
  const creds = loadCredentials();
  const token = await loadToken();
  const { client_id, client_secret, redirect_uris } = creds;
  const redirectUri = Array.isArray(redirect_uris) && redirect_uris.length ? redirect_uris[0] : undefined;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);
  oAuth2Client.setCredentials(token);
  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  return { oAuth2Client, calendar };
}