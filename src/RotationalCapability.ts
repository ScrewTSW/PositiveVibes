import { ButtplugClientDevice } from "buttplug/dist/main/src/client/ButtplugClientDevice";
import { ActuatorType, RotateCmd, RotateSubcommand } from "buttplug/dist/main/src/core/Messages";

export class RotationalCapability {

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
        console.log(`Actuating ${this.device.name} Rotational Capability ${this.index} ${this.featureDescriptor} ${this.actuatorType}`);
        await this.device.send(new RotateCmd([new RotateSubcommand(this.index, 0.5, true)],this.device.index));
        setTimeout(async () => await this.device.stop(), 500);
    }

    public async rotate(speed: number, clockwise: boolean, duration?: number): Promise<void> {
        await this.device.send(new RotateCmd([new RotateSubcommand(this.index, speed, clockwise)],this.device.index));
        if (duration !== undefined) {
            setTimeout(async () => await this.device.stop(), duration);
        }
    }
}