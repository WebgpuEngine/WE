import { SHT_WireFrameFS, SHT_WireFrameFS_MSAA, SHT_WireFrameFS_MSAAinfo } from "../../shadermanagemnet/material/wireFrameMaterial";
import { E_MaterialType } from "../base";
import { ColorMaterial, I_ColorMaterial } from "./colorMaterial";



export class WireFrameMaterial extends ColorMaterial {


    constructor(input: I_ColorMaterial) {
        super(input);
        this.kind = E_MaterialType.wireframe;
        this.inputValues = input;
        if (this._color[3] < 1.0) {
            this._color[3] = 1.0;
        }
        this.shtOfMaterialType = {
            opacityForward: SHT_WireFrameFS,
            opacityDefer: SHT_WireFrameFS,
            opacityMSAA: SHT_WireFrameFS_MSAA,
            opacityMSAAInfo: SHT_WireFrameFS_MSAAinfo,
            TT: undefined,
        };
    }

    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    getTransparent(): boolean {
        return false;
    }
}