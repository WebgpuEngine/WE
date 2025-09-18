import { Color4 } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { T_uniformGroup } from "../../command/base";
import { Clock } from "../../scene/clock";
import { I_singleShaderTemplate_Final } from "../../shadermanagemnet/base";
import { textureSourceType } from "../../texture/base";
import { Texture } from "../../texture/texture";
import { E_TextureType, IV_BaseMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";


export interface I_PhongMaterial extends IV_BaseMaterial {
  color?: Color4;
  textures?: {
    [name in E_TextureType]?: textureSourceType | Texture
  },
}

export class PhongMaterial extends BaseMaterial {
  constructor(options: I_PhongMaterial) {
    super(options);
  }
  destroy(): void {
    throw new Error("Method not implemented.");
  }
  getOneGroupUniformAndShaderTemplateFinal(camera: BaseCamera, startBinding: number): { uniformGroup: T_uniformGroup; singleShaderTemplateFinal: I_singleShaderTemplate_Final; } {
    throw new Error("Method not implemented.");
  }
  readyForGPU(): Promise<any> {
    throw new Error("Method not implemented.");
  }
  updateSelf(clock: Clock): void {
    throw new Error("Method not implemented.");
  }
  saveJSON() {
    throw new Error("Method not implemented.");
  }
  loadJSON(json: any): void {
    throw new Error("Method not implemented.");
  }

}