// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

import { ButtplugNodeWebsocketClientConnector } from "buttplug/dist/main/src/client/ButtplugNodeWebsocketClientConnector";
import { Manager } from "./Manager";
import { Device } from "./Device";
import { SensorType } from "buttplug/dist/main/src/core/Messages";

console.log('[renderedr.ts] script loaded');
const manager: Manager = new Manager();

async function getSensorData(device: Device, sensorType: SensorType) {
  await device.getSensorData(sensorType).then((sensorReadings) => sensorReadings.forEach((sensorReading) => console.log(`${device.getDeviceName()} ${sensorReading.sensorType.toString()}: ${sensorReading.sensorReadings}`)));
}

async function poolActiveDevicesSensors(sensorType: SensorType) {
  Manager.activeDevices.forEach(async (device) => {
    await getSensorData(device, sensorType);
  });
  setTimeout(async () => {
    await poolActiveDevicesSensors(sensorType);
  }, Manager.BATTERY_SENSOR_READ_DELAY);
}

async function connect(): Promise<void> {
  console.log('[renderer.ts] connect()');
  // Connect to the server
  await Manager.buttplugClient.connect(new ButtplugNodeWebsocketClientConnector('ws://127.0.0.1:6969')).then(() => {
    console.log('Connecting to Buttplug server');
    setButtonToConnected();
  });
  // Start scanning for devices
  await Manager.buttplugClient.startScanning().then(async () => {
    console.log('Scanning started!');
    await poolActiveDevicesSensors(SensorType.Battery);
  });
}

console.log('[renderer.ts] querrySelector(\'#intifaceStatus\')');
const connectButton = document.querySelector('#intifaceStatus');
if (connectButton) {
  connectButton.addEventListener('click', async () => {
    await connect();
  });
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
