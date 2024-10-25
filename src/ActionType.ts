export class ActionType {
  public static readonly ROTATE = new ActionType("ROTATE");
  public static readonly VIBRATE = new ActionType("VIBRATE");
  public static readonly MOVE = new ActionType("MOVE");
  public static readonly WAIT = new ActionType("WAIT");

  private static actionType: string;
  constructor(public readonly type: string) {
    ActionType.actionType = type;
  }
  public static getActionType(): string {
    return ActionType.actionType;
  }
};
