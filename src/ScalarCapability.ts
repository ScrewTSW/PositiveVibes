import { ButtplugClientDevice } from "buttplug/dist/main/src/client/ButtplugClientDevice";
import { ActuatorType, ScalarSubcommand } from "buttplug/dist/main/src/core/Messages";

export class ScalarCapability {

    public actuatorType: ActuatorType;

    private device: ButtplugClientDevice;
    private index: number;
    private featureDescriptor: string;
    private stepCount: number;
    private scalarCommands: any[] = [];
    private isPerformingScalarAction: boolean = false;

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

    public async queueScalar(speed: number, duration: number): Promise<void> {
        this.scalarCommands.push({speed: speed, duration: duration});
        await this.performNextScalar();
    }

    private async performNextScalar(): Promise<void> {
        if (!this.isPerformingScalarAction) {
            let scalarCommand: any = this.scalarCommands.pop();
            if (scalarCommand !== undefined) {
                this.isPerformingScalarAction = true;
                await this.scalar(scalarCommand.speed, scalarCommand.duration);
            }
        }
    }

    private async scalar(speed: number, duration?: number): Promise<void> {
        await this.device.scalar(new ScalarSubcommand(this.index, speed, this.actuatorType));
        if (duration !== undefined) {
            setTimeout(async () => { 
                await this.device.stop();
                this.isPerformingScalarAction = false;
                await this.performNextScalar();
            }, duration);
        }
    }
}
