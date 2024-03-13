// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

import { ipcRenderer } from 'electron';

console.log('[renderedr.ts] script loaded');

ipcRenderer.addListener('twitch-authenticated', () => {
  setTwitchButtonToAuthenticated();
});

ipcRenderer.addListener('buttplug-server-connected', () => {
  setButtonToConnected();
});

ipcRenderer.addListener('buttplug-server-disconnected', () => {
  setButtonToDisconnected();
});

async function authenticate(): Promise<void> {
  console.log('[renderer.ts] authenticate()');
  ipcRenderer.send('authenticate-event');
}

async function connect(): Promise<void> {
  console.log('[renderer.ts] connect()');
  ipcRenderer.send('connect-event');
}

export function setTwitchButtonToAuthenticated() {
  console.log('[renderer.ts] setTwitchButtonToAuthenticated');
  const twitchButton = document.querySelector('#twitchAuthButtonId');
  if (twitchButton) {
    twitchButton.setAttribute('value', 'Authenticated');
    twitchButton.setAttribute('disabled', 'true');
  }
}

export function setButtonToDisconnected() {
  console.log('[renderer.ts] setButtonToDisconnected');
  const connectButton = document.querySelector('#intifaceStatus');
  if (connectButton) {
    connectButton.setAttribute('value', 'Connect');
    connectButton.removeAttribute('disabled');
  }
}

export function setButtonToConnected() {
  console.log('[renderer.ts] setButtonToConnected');
  const connectButton = document.querySelector('#intifaceStatus');
  if (connectButton) {
    connectButton.setAttribute('value', 'Connected');
    connectButton.setAttribute('disabled', 'true');
  }
}

console.log('[renderer.ts] querrySelector(\'#intifaceStatus\')');
const connectButton = document.querySelector('#intifaceStatus');
if (connectButton) {
  connectButton.addEventListener('click', async () => {
    await connect();
  });
}

console.log('[renderer.ts] querrySelector(\'#intifaceStatus\')');
const authenticateButton = document.querySelector('#twitchAuthButtonId');
if (authenticateButton) {
  authenticateButton.addEventListener('click', async () => {
    await authenticate();
  });
}
