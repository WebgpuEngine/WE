import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { ECSManager } from "./manager";
import { I_UUID } from "./root";


export interface I_FeatureModule extends I_UUID {
    onResize(): Promise<void>;
    update(clock: Clock): void;
}


export class FeatureManager extends ECSManager<I_FeatureModule> {
    update(clock: Clock): void {
        this.checkDestroy();
        for (const perOne of this.list) {
            perOne.update(clock);
        }
    }
    async onResize(): Promise<void> {
        this.checkDestroy();
        for (const perOne of this.list) {
            await perOne.onResize();
        }
    }
    constructor(scene: Scene) {
        super(scene);
    }
}