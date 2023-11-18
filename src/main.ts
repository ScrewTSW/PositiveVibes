import { app, BrowserWindow } from "electron";
import { ActuatorType, ButtplugClient, ButtplugDeviceMessage, ButtplugMessage, ButtplugNodeWebsocketClientConnector, DeviceAdded, LinearCmd, MessageAttributes, RotateCmd, RotateSubcommand, ScalarCmd, ScalarSubcommand, SensorReadCmd, SensorReading, SensorType, StopDeviceCmd, VectorSubcommand } from "buttplug";
import * as path from "path";

const buttplugClient: ButtplugClient = new ButtplugClient("Positive Vibes");

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
  buttplugClient.addListener("deviceadded", async (device) => {
    console.log(`Device Connected: ${device.name}`);
    console.log(`Device object dump:\n${JSON.stringify(device)}`);
    const deviceInfo: DeviceAdded = device._deviceInfo;
    console.log(`Device Info:`);
    console.log(`${deviceInfo.DeviceName} - ${deviceInfo.DeviceDisplayName} - ${deviceInfo.DeviceIndex}`);
    const deviceMessages: MessageAttributes = deviceInfo.DeviceMessages;
    console.log(`Device Messages:`);
    console.log(`- commands:`);
    const linearSubCommands: VectorSubcommand[] = [];
    const rotateSubCommands: RotateSubcommand[] = [];
    const scalarSubCommands: ScalarSubcommand[] = [];
    const sensorCommands: {(): Promise<SensorReading>;}[] = [];
    if (deviceMessages.LinearCmd !== undefined) {
      console.log(`  - Linear Commands:`);
      deviceMessages.LinearCmd.forEach((msg) => {
        console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.ActuatorType} | ${msg.StepCount}`);
        linearSubCommands.push(new VectorSubcommand(msg.Index, 0.5, 0.5));
      });
    }
    if (deviceMessages.RotateCmd !== undefined) {
      console.log(`  - Rotate Commands:`);
      deviceMessages.RotateCmd.forEach((msg) => {
        console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.ActuatorType} | ${msg.StepCount}`);
        rotateSubCommands.push(new RotateSubcommand(msg.Index, 0.5, true));
      });
    }
    if (deviceMessages.ScalarCmd !== undefined) {
      console.log(`  - Scalar Commands:`);
      deviceMessages.ScalarCmd.forEach((msg) => {
        console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.ActuatorType} | ${msg.StepCount}`);
        scalarSubCommands.push(new ScalarSubcommand(msg.Index, 0.5, msg.ActuatorType));
      });
    }
    if (deviceMessages.SensorReadCmd !== undefined) {
      console.log(`  - Sensor Read Commands:`);
      deviceMessages.SensorReadCmd.forEach((msg) => {
        console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.SensorType} | ${msg.StepRange}`);
        sensorCommands.push(async () => await device.send(new SensorReadCmd(deviceInfo.DeviceIndex, msg.Index, msg.SensorType)));
      });
    }
    if (deviceMessages.SensorSubscribeCmd !== undefined) {
      console.log(`  - Sensor Subscribe Commands:`);
      deviceMessages.SensorSubscribeCmd.forEach((msg) => console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.SensorType} | ${msg.StepRange}`));
    }
    console.log(`  - Stop Device Command: ${JSON.stringify(deviceMessages.StopDeviceCmd)}`);
    console.log(`- Allowed Messages: ${JSON.stringify(device.allowedMsgs)}`);
    console.log(`Sending test commands to ${device.name}`);
    deviceMessages.SensorReadCmd !== undefined ? sensorCommands.forEach(async (callback) => {
      const buttplugDeviceMessage: SensorReading = await callback();
      console.log(`  - ${JSON.stringify(buttplugDeviceMessage)}`);
    }) : console.log("No SensorReadCmd available for this device.");
    deviceMessages.LinearCmd !== undefined ? await device.sendExpectOk(new LinearCmd(linearSubCommands, deviceInfo.DeviceIndex)) : console.log("No LinearCmd available for this device.");
    deviceMessages.RotateCmd !== undefined ? await device.sendExpectOk(new RotateCmd(rotateSubCommands, deviceInfo.DeviceIndex)) : console.log("No RotateCmd available for this device.");
    deviceMessages.ScalarCmd !== undefined ? await device.sendExpectOk(new ScalarCmd(scalarSubCommands, deviceInfo.DeviceIndex)) : console.log("No ScalarCmd available for this device.");
    setTimeout(async () => {
      await device.sendExpectOk(new StopDeviceCmd(deviceInfo.DeviceIndex));
    }, 500);
    console.log("Client currently knows about these devices:");
    buttplugClient.devices.forEach((device) => console.log(`- ${device.name}`));
  });
  buttplugClient.addListener("deviceremoved", (device) => console.log(`Device Removed: ${device.name}`));
  buttplugClient.addListener("scanningfinished", () => console.log("Scanning finished!"));
  buttplugClient.addListener("log", (logMessage) => console.log(`Log: ${logMessage.message}`));
  buttplugClient.addListener("error", (error) => console.log(`Error: ${error.errorMessage}`));
  buttplugClient.addListener("disconnect", () => console.log("Disconnected!"));

  // Connect to the server
  await buttplugClient.connect(new ButtplugNodeWebsocketClientConnector( "ws://127.0.0.1:12345")).then(() => {
    console.log("Connected!");
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "../index.html"));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Start scanning for devices
  await buttplugClient.startScanning().then(() => {
    console.log("Scanning started!");
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
