import { I_uniformArrayBufferEntry, T_uniformGroups, T_uniformOneGroup } from "../../command/base";
import { VertexColorMaterial } from "../../material/standard/vertexColorMaterial";
import { I_ShaderTemplate, I_ShaderTemplate_Final } from "../../shadermanagemnet/base";
import { IV_MeshEntity, Mesh } from "./mesh";
import { SHT_OneCubeColorVS } from "../../shadermanagemnet/mesh/meshVS";
import { BaseCamera } from "../../camera/baseCamera";
import { E_entityType, I_EntityBundleOutput } from "../base";



export class OneColoeCube extends Mesh {


    /**
     * oneColorCube 的位置颜色时在VS shader 输出是处理的
     */
    constructor(_input?: IV_MeshEntity) {
        let cube = {
            position: [1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0],
            normail: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
            uv: [0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0],
            color: [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6],
            indices: [0, 2, 1, 2, 3, 1, 4, 6, 5, 6, 7, 5, 8, 10, 9, 10, 11, 9, 12, 14, 13, 14, 15, 13, 16, 18, 17, 18, 19, 17, 20, 22, 21, 22, 23, 21],
        }
        let input: IV_MeshEntity = {
            attributes: {
                data: {
                    vertices: {
                        position: cube.position,
                        normal: cube.normail,
                        uv: cube.uv,
                        color: cube.color,
                    },
                    indices: cube.indices,
                }
            }
        };
        if (_input) {
            _input.attributes = input.attributes;
        }
        else {
            _input = input;
        }
        super(_input);
        this.kind = E_entityType.oneColorCube;
    }
    async readyForGPU() {
        this._material = new VertexColorMaterial();
        await this._material.init(this.scene);
    }
    getVSUniformAndShaderTemplateFinal(SHT_VS: I_ShaderTemplate, startBinding: number = 0, wireFrame: boolean = false): I_EntityBundleOutput {
        return super.getVSUniformAndShaderTemplateFinal(SHT_OneCubeColorVS);//使用OneCubeColorVS 模板
    }
}