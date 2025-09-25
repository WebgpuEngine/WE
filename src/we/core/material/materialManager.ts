import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { BaseMaterial } from "./baseMaterial";


export class MaterialManager extends ECSManager<BaseMaterial>{

    update(clock: Clock): void {
        for(let i of this.list)
            i.update(clock);
    }
    
}
