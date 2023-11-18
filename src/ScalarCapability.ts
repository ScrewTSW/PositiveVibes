import { ButtplugClientDevice } from "buttplug/dist/main/src/client/ButtplugClientDevice";
import { ActuatorType, ScalarSubcommand } from "buttplug/dist/main/src/core/Messages";

export class ScalarCapability {

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
        console.log(`Actuating ${this.device.name} Scalar Capability ${this.index} ${this.featureDescriptor} ${this.actuatorType}`);
        await this.device.scalar(new ScalarSubcommand(this.index, 0.5, this.actuatorType));
        setTimeout(async () => await this.device.stop(), 500);
    }

    public async scalar(speed: number, duration?: number): Promise<void> {
        await this.device.scalar(new ScalarSubcommand(this.index, speed, this.actuatorType));
        if (duration !== undefined) {
            setTimeout(async () => await this.device.stop(), duration);
        }
    }
}