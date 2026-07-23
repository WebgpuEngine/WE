import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { FeatureClass } from "./featureClass";
import { ECSManager } from "./manager";

export class FeatureManager extends ECSManager<FeatureClass> {
    update(clock: Clock): void {
         this.checkDestroy();
         for (const perOne of this.list) {
            perOne.update(clock);
         }
    }
    constructor(scene: Scene) {
        super(scene);
    }
}