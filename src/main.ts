import { app, BrowserWindow } from "electron";
import * as path from "path";
import { Device } from "./Device";
import { ScalarCapability } from "./ScalarCapability";
import { LinearCapability } from "./LinearCapability";
import { RotationalCapability } from "./RotationalCapability";
import { SensorCapability } from "./SensorCapability";
import { ButtplugClient } from "buttplug/dist/main/src/client/Client";
import { SensorType } from "buttplug/dist/main/src/core/Messages";
import { ButtplugClientDevice } from "buttplug/dist/main/src/client/ButtplugClientDevice";
import { ButtplugNodeWebsocketClientConnector } from "buttplug/dist/main/src/client/ButtplugNodeWebsocketClientConnector";

const BATTERY_SENSOR_READ_DELAY: number = 30_000;
const buttplugClient: ButtplugClient = new ButtplugClient("Positive Vibes");
const activeDevices: Device[] = [];

async function getSensorData(device: Device, sensorType: SensorType) {
  await device.getSensorData(sensorType).then((sensorReadings) => sensorReadings.forEach((sensorReading) => console.log(`${device.getDeviceName()} ${sensorReading.sensorType.toString()}: ${sensorReading.sensorReadings}`)));
}

async function poolActiveDevicesSensors(sensorType: SensorType) {
  activeDevices.forEach(async (device) => {
    await getSensorData(device, sensorType);
  });
  setTimeout(async () => {
    await poolActiveDevicesSensors(sensorType);
  }, BATTERY_SENSOR_READ_DELAY);
}

async function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    width: 800,
  });

  // set up event listeners
  buttplugClient.addListener("deviceadded", async (d: ButtplugClientDevice) => {
    console.log(`Device Connected: ${d.name}`);
    console.log(`Device object dump:\n${JSON.stringify(d)}`);
    console.log(`Device Info:`);
    console.log(`${d.name} - ${d.displayName} - ${d.index}`);
    console.log(`Device Messages:`);
    console.log(`- commands:`);
    const scalarCapabilities: ScalarCapability[] = [];
    const linearCapabilities: LinearCapability[] = [];
    const rotationalCapabilities: RotationalCapability[] = [];
    const sensorCapabilities: SensorCapability[] = [];
    if (d.messageAttributes.LinearCmd !== undefined) {
      console.log(`  - Linear Commands:`);
      d.messageAttributes.LinearCmd.forEach((msg) => {
        console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.ActuatorType} | ${msg.StepCount}`);
        linearCapabilities.push(new LinearCapability(d, msg.Index, msg.FeatureDescriptor, msg.ActuatorType, msg.StepCount));
      });
    }
    if (d.messageAttributes.RotateCmd !== undefined) {
      console.log(`  - Rotate Commands:`);
      d.messageAttributes.RotateCmd.forEach((msg) => {
        console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.ActuatorType} | ${msg.StepCount}`);
        rotationalCapabilities.push(new RotationalCapability(d, msg.Index, msg.FeatureDescriptor, msg.ActuatorType, msg.StepCount));
      });
    }
    if (d.messageAttributes.ScalarCmd !== undefined) {
      console.log(`  - Scalar Commands:`);
      d.messageAttributes.ScalarCmd.forEach((msg) => {
        console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.ActuatorType} | ${msg.StepCount}`);
        scalarCapabilities.push(new ScalarCapability(d, msg.Index, msg.FeatureDescriptor, msg.ActuatorType, msg.StepCount));
      });
    }
    if (d.messageAttributes.SensorReadCmd !== undefined) {
      console.log(`  - Sensor Read Commands:`);
      d.messageAttributes.SensorReadCmd.forEach((msg) => {
        console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.SensorType} | ${msg.StepRange}`);
        sensorCapabilities.push(new SensorCapability(d, msg.Index, msg.SensorType, msg.FeatureDescriptor, msg.StepRange));
      });
    }
    if (d.messageAttributes.SensorSubscribeCmd !== undefined) {
      console.log(`  - Sensor Subscribe Commands:`);
      d.messageAttributes.SensorSubscribeCmd.forEach((msg) => console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.SensorType} | ${msg.StepRange}`));
    }
    console.log(`  - Stop Device Command: ${JSON.stringify(d.messageAttributes.StopDeviceCmd)}`);

    const device: Device = new Device(d, scalarCapabilities, linearCapabilities, rotationalCapabilities, sensorCapabilities);
    activeDevices.push(device);

    console.log(`Sending test commands to ${d.name}`);
    await device.poolSensors();
    await device.pingLinears();
    await device.pingRotationals();
    await device.pingScalars();

    console.log("Client currently knows about these devices:");
    buttplugClient.devices.forEach((device) => console.log(`- ${device.name}`));
  });
  buttplugClient.addListener("deviceremoved", (device) => {
    console.log(`Device Removed: ${device.name}`)
    // remove device from active devices list when disconnected
    activeDevices.splice(activeDevices.indexOf(activeDevices.filter((d) => d.device === device)[0]), 1);
  });
  buttplugClient.addListener("scanningfinished", () => console.log("Scanning finished!"));
  buttplugClient.addListener("log", (logMessage) => console.log(`Log: ${logMessage.message}`));
  buttplugClient.addListener("error", (error) => console.log(`Error: ${error.errorMessage}`));
  buttplugClient.addListener("disconnect", () => console.log("Disconnected!"));

  // Connect to the server
  await buttplugClient.connect(new ButtplugNodeWebsocketClientConnector( "ws://127.0.0.1:12345")).then(() => {
    console.log("Connected!");
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "../src/static/index.html"));

  // Open the DevTools.
  if (process.env.DEBUG_ENABLED === "true") mainWindow.webContents.openDevTools();

  // Start scanning for devices
  await buttplugClient.startScanning().then(async () => {
    console.log("Scanning started!");
    await poolActiveDevicesSensors(SensorType.Battery);
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
