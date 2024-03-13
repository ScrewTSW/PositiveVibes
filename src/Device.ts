import { SensorType } from "buttplug/dist/main/src/core/Messages";
import { LinearCapability } from "./LinearCapability";
import { RotationalCapability } from "./RotationalCapability";
import { ScalarCapability } from "./ScalarCapability";
import { SensorCapability } from "./SensorCapability";
import { ButtplugClientDevice } from "buttplug/dist/main/src/client/ButtplugClientDevice";
import { SensorReading } from "./SensorReading";

export class Device {

    public device: ButtplugClientDevice;

    private scalarCapabilities: ScalarCapability[];
    private linearCapabilities: LinearCapability[];
    private rotationalCapabilities: RotationalCapability[];
    private sensorCapabilities: SensorCapability[];

    constructor(device: ButtplugClientDevice, scalarCapabilities: ScalarCapability[], linearCapabilities: LinearCapability[], rotationalCapabilities: RotationalCapability[], sensorCapabilities: SensorCapability[]) {
        this.device = device;
        this.scalarCapabilities = scalarCapabilities;
        this.linearCapabilities = linearCapabilities;
        this.rotationalCapabilities = rotationalCapabilities;
        this.sensorCapabilities = sensorCapabilities;
    }

    public getDeviceName(): string {
        return this.device.name;
    }

    public async getSensorData(sensorType: SensorType): Promise<SensorReading[]> {
        const sensorResults: SensorReading[] = [];

        for (const cap of this.sensorCapabilities) {
            if (cap.sensorType === sensorType) {
                const sensorData: number[] = await cap.getSensorData();
                sensorResults.push(new SensorReading(sensorType, sensorData));
            }
        }

        return sensorResults;
    }

    // device capability tests

    public async poolSensors(): Promise<SensorReading[]> {
        const sensorResults: SensorReading[] = [];
        this.sensorCapabilities.forEach(async (sensorCapability) => {
            const sensorData: number[] = await sensorCapability.getSensorData();
            sensorResults.push(new SensorReading(sensorCapability.sensorType, sensorData));
        });
        return sensorResults;
    }

    public async rotateFor(speed: number, clockwise: boolean, duration: number): Promise<void> {
        this.rotationalCapabilities.forEach(async (rotationalCapability) => await rotationalCapability.queueRotate(speed, clockwise, duration));
    }

    public async vibrateFor(speed: number, duration: number): Promise<void> {
        this.scalarCapabilities.forEach(async (scalarCapability) => await scalarCapability.queueScalar(speed, duration));
    }

    public async pingLinears(): Promise<void> {
        this.linearCapabilities.forEach(async (linearCapability) => await linearCapability.ping());
    }

    public async pingRotationals(): Promise<void> {
        this.rotationalCapabilities.forEach(async (rotationalCapability) => await rotationalCapability.ping());
    }

    public async pingScalars(): Promise<void> {
        this.scalarCapabilities.forEach(async (scalarCapability) => await scalarCapability.ping());
    }
}