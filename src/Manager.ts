import { ButtplugClientDevice } from "buttplug/dist/main/src/client/ButtplugClientDevice";
import { ButtplugClient } from "buttplug/dist/main/src/client/Client";
import { Device } from "./Device";
import { LinearCapability } from "./LinearCapability";
import { RotationalCapability } from "./RotationalCapability";
import { ScalarCapability } from "./ScalarCapability";
import { SensorCapability } from "./SensorCapability";
import * as renderer from "./renderer";

export class Manager {
  public static buttplugClient: ButtplugClient;
  public static BATTERY_SENSOR_READ_DELAY: number = 30_000;
  public static activeDevices: Device[] = [];

  constructor() {
    console.log('[Manager] constructor()');
    if (Manager.buttplugClient === undefined) {
      console.log('[Manager] instantiating ButtplugClient');
      Manager.buttplugClient = new ButtplugClient('Positive Vibes');
      // set up event listeners
      console.log('[Manager] buttplugClient.addListener.deviceadded');
      Manager.buttplugClient.addListener("deviceadded", async (d: ButtplugClientDevice) => {
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
        Manager.activeDevices.push(device);

        console.log(`Sending test commands to ${d.name}`);
        await device.poolSensors();
        await device.pingLinears();
        await device.pingRotationals();
        await device.pingScalars();

        console.log('Client currently knows about these devices:');
        Manager.buttplugClient.devices.forEach((device) => console.log(`- ${device.name}`));
      });
      console.log('[Manager] buttplugClient.addListener.deviceremoved');
      Manager.buttplugClient.addListener('deviceremoved', (device) => {
        console.log(`Device Removed: ${device.name}`)
        // remove device from active devices list when disconnected
        Manager.activeDevices.splice(Manager.activeDevices.indexOf(Manager.activeDevices.filter((d) => d.device === device)[0]), 1);
      });
      console.log('[Manager] buttplugClient.addListener.log');
      Manager.buttplugClient.addListener('log', (logMessage) => console.log(`Log: ${logMessage.message}`));
      console.log('[Manager] buttplugClient.addListener.disconnect');
      Manager.buttplugClient.addListener('disconnect', () => {
        console.log('Buttplug server disconnected!');
        renderer.setButtonToDisconnected();
      });
    }
  }
}