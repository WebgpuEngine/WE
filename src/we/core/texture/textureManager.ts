import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { BaseTexture } from "./baseTexture";


export class TextureManager extends ECSManager<BaseTexture>{

    update(clock: Clock): void {
        for(let i of this.list)
            i.update(clock);
    }
    
}
