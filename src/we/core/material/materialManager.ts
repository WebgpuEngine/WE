import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { BaseMaterial } from "./baseMaterial";


export class MaterialManager extends ECSManager<BaseMaterial>{

    update(clock: Clock): void {
        throw new Error("Method not implemented.");
    }
    
}
