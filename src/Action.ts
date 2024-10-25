import { ActionType } from "./ActionType";

export class Action {
  private actionType: ActionType;
  private speed: number;
  private clockwise: boolean;
  private duration: number;

  public constructor(type: ActionType, ...actionArgs: any) {
    switch(type) {
      case ActionType.ROTATE:
        this.speed = actionArgs[0];
        this.clockwise = actionArgs[1];
        this.duration = actionArgs[2];
        break;
      case ActionType.VIBRATE:
        this.speed = actionArgs[0];
        this.duration = actionArgs[1];
        break;
      case ActionType.WAIT:
        this.duration = actionArgs[0];
        break;
      default:
        throw new Error("Invalid action type");
    }
  }

  public getActionType(): ActionType {
    return this.actionType;
  }
  public getSpeed(): number {
    return this.speed;
  }
  public isClockwise(): boolean {
    return this.clockwise;
  }
  public getDuration(): number {
    return this.duration;
  }
}
