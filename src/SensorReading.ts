import { SensorType } from "buttplug/dist/main/src/core/Messages";

export class SensorReading {

    public sensorType: SensorType;
    public sensorReadings: number[];

    constructor(sensorType: SensorType, sensorReadings: number[]) {
        this.sensorType = sensorType;
        this.sensorReadings = sensorReadings;
    }
}