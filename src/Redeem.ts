import { Action } from "./Action";

export class Redeem {
  private titles: string[];
  private actions: Action[];

  public constructor(titles: string[], actions: Action[]) {
    this.titles = titles;
    this.actions = actions;
  }

  public getTitles(): string[] {
    return this.titles;
  }
  public getActions(): Action[] {
    return this.actions;
  }
}