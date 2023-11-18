import { SensorType } from "buttplug/dist/main/src/core/Messages";
import { ButtplugClientDevice } from "buttplug/dist/main/src/client/ButtplugClientDevice";

export class SensorCapability {

    public sensorType: SensorType;

    private device: ButtplugClientDevice;
    private sensorIndex: number;
    private sensorDescriptor: string;
    private stepRange: number[];

    constructor(device: ButtplugClientDevice, sensorIndex: number, sensorType: SensorType, sensorDescriptor: string, stepRange: number[]) {
        this.device = device;
        this.sensorIndex = sensorIndex;
        this.sensorType = sensorType;
        this.sensorDescriptor = sensorDescriptor;
        this.stepRange = stepRange;
    }

    public async getSensorData(): Promise<number[]> {
        return await this.device.sensorRead(this.sensorIndex, this.sensorType);
    }
}