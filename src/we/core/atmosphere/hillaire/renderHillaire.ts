import { AtmosphereRenderBase } from "../renderBase";
import { AtmosphereHillaire } from "./atmosphereHillaire";

export abstract class RenderHillaire extends AtmosphereRenderBase {
    declare parent: AtmosphereHillaire;
    constructor(parent: AtmosphereHillaire) {
        super(parent);
    }
    getConstants(): Record<string, number> | undefined {
        let constants: Record<string, number> = {};
        if (this.parent.atmosphereParams.FROM_KM_SCALE != undefined) {
            constants["FROM_KM_SCALE"] = this.parent.atmosphereParams.FROM_KM_SCALE;
        }
        // if(this.parent.atmosphereParams.USE_MOON != undefined && this.parent.atmosphereParams.USE_MOON ===true  ){
        //     constants["USE_MOON"] = 1;
        // }
        if (this.scene.reversedZ.isReversedZ === false) {
            constants["IS_REVERSE_Z"] = 0;
        }
        if (Object.keys(constants).length == 0) {
            return undefined;
        }
        console.log(constants);
        return constants;
    }
}