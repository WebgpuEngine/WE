import { E_lifeState, weColor4 } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { SHT_WireFrameFS, SHT_WireFrameFS_MSAA, SHT_WireFrameFS_MSAAinfo } from "../../shadermanagemnet/material/wireFrameMaterial";
import { E_MaterialType, I_BundleOfMaterialForMSAA, I_materialBundleOutput } from "../base";
import { ColorMaterial, I_ColorMaterial } from "./colorMaterial";



export class WireFrameMaterial extends ColorMaterial {
    getTTFS(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    formatTPFS(renderObject: BaseCamera | I_ShadowMapValueOfDC): string {
        throw new Error("Method not implemented.");
    }
    setTO(): void {
        this._opaqueOfTransparent = false;
    }

    getTOFS(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }


    constructor(input: I_ColorMaterial) {
        super(input);
        this.kind = E_MaterialType.wireframe;
        this.inputValues = input;
        if (this._transparent || this._color[3] < 1.0) {
            this._transparent = undefined;
            this._color[3] = 1.0;
            console.warn("wire frame 不支持透明");
        }
        this.shtOfMaterialType = {
            opacityForward: SHT_WireFrameFS,
            opacityDefer: SHT_WireFrameFS,
            opacityMSAA: SHT_WireFrameFS_MSAA,
            opacityMSAAInfo: SHT_WireFrameFS_MSAAinfo,

            TO_Forward: undefined,
            TO_Defer: undefined,
            TO_MSAA: undefined,
            TO_MsaaInfo: undefined,

            TT: undefined,

            TTP: undefined,
            TTPF: undefined,
        };
    }
    // getOpacity_Forward(startBinding: number = 0): I_materialBundleOutput {
    //     return this.generateBundleOutput(SHT_WireFrameFS, startBinding);
    // }
    // getOpacity_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
    //     let MSAA: I_materialBundleOutput = this.generateBundleOutput(SHT_WireFrameFS_MSAA, startBinding);
    //     let inforForward: I_materialBundleOutput = this.generateBundleOutput(SHT_WireFrameFS_MSAAinfo, startBinding);
    //     return { MSAA, inforForward };
    // }


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