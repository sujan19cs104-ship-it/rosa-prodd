import fs from 'fs';
import { google } from 'googleapis';

export type GoogleClients = {
  oAuth2Client: any;
  calendar: any;
};

function loadCredentials() {
  const raw = fs.readFileSync('credentials.json', 'utf8');
  const parsed = JSON.parse(raw);
  const conf = parsed.installed ?? parsed.web;
  if (!conf) throw new Error('Invalid credentials.json: expected "installed" or "web" root');
  return conf;
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