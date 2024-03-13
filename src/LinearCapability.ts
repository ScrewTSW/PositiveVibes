import { ButtplugClientDevice } from "buttplug/dist/main/src/client/ButtplugClientDevice";
import { ActuatorType, LinearCmd, VectorSubcommand } from "buttplug/dist/main/src/core/Messages";

export class LinearCapability {

    public actuatorType: ActuatorType;

    private device: ButtplugClientDevice;
    private index: number;
    private featureDescriptor: string;
    private stepCount: number;

    constructor(device: ButtplugClientDevice, index: number, featureDescriptor: string, actuatorType: ActuatorType, stepCount: number) {
        this.device = device;
        this.index = index;
        this.featureDescriptor = featureDescriptor;
        this.actuatorType = actuatorType;
        this.stepCount = stepCount;
    }

    public async ping(): Promise<void> {
        await this.device.send(new LinearCmd([new VectorSubcommand(this.index, 0.5, 0.5)], this.device.index));
        await this.device.send(new LinearCmd([new VectorSubcommand(this.index, 0.0, 0.5)], this.device.index));
    }

    public async moveTo(position: number, duration: number): Promise<void> {
        await this.device.send(new LinearCmd([new VectorSubcommand(this.index, position, duration)], this.device.index));
    }
}
