import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { SkinAnimation } from "./skin";

export class SkinsManager extends ECSManager<SkinAnimation> {
    
    update(clock: Clock): void {
        // throw new Error("Method not implemented.");
    }

    /** 皮肤数量 */
    Count: number = 0;
}