import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { BaseAnimation } from "./BaseAnimation";

export class AnimationManager extends ECSManager<BaseAnimation> {
    update(clock: Clock): void {
        for (let perOne of this.list) {
            perOne.update(clock);
        }
    }

}