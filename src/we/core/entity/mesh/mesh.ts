import { E_renderForDC, weColor4 } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { I_drawModeIndexed, T_uniformGroups } from "../../command/base";
import { IV_DC } from "../../command/DrawCommandGenerator";
import { BaseMaterial } from "../../material/baseMaterial";
import { WireFrameMaterial } from "../../material/standard/wireFrameMaterial";
import { E_renderPassName } from "../../scene/renderManager";
import { SHT_MeshWireframeVS } from "../../shadermanagemnet/mesh/wireFrameVS";
import { E_entityType, IV_BaseEntity, I_vsfsBundle } from "../base";
import { EntityBundleMaterial } from "../entityBundleMaterial";


/**mesh的顶点结构与材质，各有一个，一一对应 */
export interface IV_MeshEntity extends IV_BaseEntity {

    /**线框 wireframe    */
    wireFrame?: {
        /**是否显示线框 */
        enable: boolean;
        /**只显示线框 */
        wireFrameOnly?: boolean;
        /**线框颜色，默认黑色(0,0,0,1)
         * 数值范围：0-1
        */
        color?: weColor4,
        /**
         * 线与面的偏移量
         * 线框宽度，默认1
         * 数值范围：0.01-10,
         * 计算公式有VS和FS两种，目前为了简单使用的是FS的；
         * VS计算公式在shader/entity/mesh/wireframe.vs.wgsl
         * FS计算公式在shader/material/wireframe/wireframe.fs.wgsl
        */
        offset?: number,
        indices?: number[],
    }

}

export class Mesh extends EntityBundleMaterial {
    override inputValues: IV_MeshEntity;

    /**
     * mesh的wireframe材质内部对象，获取uniform、bindingroup字符串、SHT等使用
     */
    _materialWireframe!: BaseMaterial;
    /**线框 */
    _wireframe: {
        /**只显示线框 */
        wireFrameOnly?: boolean;
        /**线框颜色，默认黑色(0,0,0,1)
         * 数值范围：0-1
        */
        wireFrameColor?: weColor4,
        enable: boolean,
        indices: number[],
        indexCount: number,
        offset: number,
    } = {
            wireFrameOnly: false,
            wireFrameColor: [0, 0, 0, 1],
            enable: false,
            offset: 1,
            indices: [],
            indexCount: 0,
        };


    constructor(input: IV_MeshEntity) {
        super(input);
        this.kind = E_entityType.mesh;
        this.inputValues = input;
        if (input.wireFrame && (input.attributes.geometry || Array.isArray(input.attributes.data?.indices))) {//不考虑输入的indices是GPUBuffer的情况，比如gltf，也就是说只有number[]的情况，可以使用wireframe
            this._wireframe.enable = input.wireFrame.enable;
            if (input.wireFrame.wireFrameOnly) {
                this._wireframe.wireFrameOnly = true;
            }
            if (input.wireFrame.color) {
                this._wireframe.wireFrameColor = input.wireFrame.color;
            }
            if (input.wireFrame.offset) {
                this._wireframe.offset = input.wireFrame.offset;
            }
            if (input.attributes.geometry) {//如果有几何体，就创建线框
                this._wireframe.indices = input.attributes.geometry.getWireFrameIndeices();
                this._wireframe.indexCount = input.attributes.geometry.getWireFrameDrawCount();
            }
            else if (input.attributes.data) {
                if (input.attributes.data.indices) {
                    this._wireframe.indices = this.createWrieFrame([], input.attributes.data.indices as number[]);
                }
                else {
                    let positionTemp;
                    let position: number[] = [];
                    let attributes = input.attributes.data.vertices;
                    //如果有position属性，就创建线框
                    if (attributes["position"] !== undefined) {
                        positionTemp = attributes["position"];
                    }
                    // else {  //没有position属性，就取第一个属性
                    //     for (let i in attributes) {
                    //         positionTemp = attributes[i];
                    //         break;
                    //     }
                    // }
                    if (positionTemp === undefined) {
                        throw new Error("Mesh constructor: wireFrame must have position attribute");
                    }
                    if ("format" in positionTemp && "data" in positionTemp) {//I_vsAttribute
                        position = positionTemp.data as number[];
                    }
                    //如果有mergeAttribute属性
                    else if ("mergeAttribute" in positionTemp) {//I_vsAttributeMerge
                        let positionIndex = -1;
                        for (let mergeNameI in positionTemp.mergeAttribute) {
                            if (positionTemp.mergeAttribute[mergeNameI].name == "position") {
                                positionIndex = parseInt(mergeNameI);
                            }
                        }
                        //没有position属性，报错，不在处理
                        if (positionIndex === -1) {
                            throw new Error("Mesh constructor: wireFrame must have position attribute");
                        }
                    }
                    else {//数组
                        position = positionTemp as number[];
                    }
                    this._wireframe.indices = this.createWrieFrame(position, []);
                }
                this._wireframe.indexCount = this._wireframe.indices.length;
            }
            else {
                throw new Error("Mesh constructor: wireFrame must have geometry or attribute data");
            }
        }
        else {
            this._wireframe.enable = false;//如果没有indices不是number[]，就不创建线框
        }
        if (input.primitive) {
            this._primitive = input.primitive;
        }
        else {
            this._primitive = {
                topology: "triangle-list",
                cullMode: this._cullMode,
            };
        }
    }
    override _destroy(): void {
        super._destroy();
        if (this._materialWireframe) {
            this._materialWireframe.destroy();
            //@ts-ignore
            this._materialWireframe = undefined;
        }
    }
    /**三段式初始化的第三段
     * 覆写 Root的function,因为材料类需要GPUDevice */
    override async readyForGPU() {
        await super.readyForGPU();
        if (this._wireframe.enable) {
            this._materialWireframe = new WireFrameMaterial({
                color: this._wireframe.wireFrameColor as weColor4,
            })
            await this._materialWireframe.init(this.scene,this);
        }
        // this._state = E_lifeState.finished;
    }
    /**
     * 反转法线，未测试过
     */
    invertNormal() {
        if (this.attributes.vertices["normal"]) {
            let normal = this.attributes.vertices["normal"] as number[];
            if (normal) {
                for (let i = 0; i < normal.length; i += 3) {
                    normal[i] = -normal[i];
                    normal[i + 1] = -normal[i + 1];
                    normal[i + 2] = -normal[i + 2];
                }
            }
        }
    }

    /**
     * 生成线框的DrawCommand的input value
     * @param type 渲染类型
     * @param UUID camera UUID or light merge UUID
     * @param bundle 实体的uniform和shader模板
     * @returns IV_DrawCommand
     */
    generateWireFrameInputValueOfDC(type: E_renderForDC, UUID: string, bundle: I_vsfsBundle, vsOnly: boolean = false, scope?: Mesh): IV_DC {
        if (scope == undefined) scope = this;
        let drawMode: I_drawModeIndexed = {
            indexCount: 0,
            instanceCount: 1,
            firstIndex: 0,
            baseVertex: 0,
            firstInstance: 0,
        }
        if (scope._wireframe.indices) {
            drawMode.indexCount = scope._wireframe.indexCount;
            drawMode.instanceCount = scope.instance.numInstances;
        }
        else {
            throw new Error("Mesh constructor: wireFrame must have geometry or attribute data");
        }
        let uniforms: T_uniformGroups[] = [];
        // let uniforms = [bundle.vsBundle.uniformGroup];
        if (bundle.fsBundle) {
            uniforms.push(bundle.fsBundle.uniformGroup);
        }
        let valueDC: IV_DC = {
            // label: `wireframe  ${scope.Name} for ${type}: ${UUID}`,
            label: `wireframe ${scope.Name}`,
            data: {
                vertices: scope.attributes.vertices,
                vertexStepMode: scope.attributes.vertexStepMode,
                indices: scope._wireframe.indices,
                // uniforms: uniforms,
            },
            render: {
                vertex: {
                    code: bundle.vsBundle.shaderTemplateFinal,
                    entryPoint: "vs",

                },
                fragment: {
                    code: bundle.fsBundle!.shaderTemplateFinal,
                    entryPoint: "fs",
                    constants: {
                        offsetOfWireframeVale: scope._wireframe.offset,
                    }
                },
                // drawMode,
                drawMode: (UUID: string, kind: E_renderForDC) => { return scope.getDrawModeArrayOfInstances(UUID, kind, drawMode) },//wireframe 的drawMode 与mesh的数量不同

                primitive: {
                    topology: "line-list",
                },
            },

            system: {
                parent: scope,
                UUID,
                type//: E_renderForDC.camera
            },
            IDS: {
                UUID: scope.UUID,
                ID: scope.ID,
                renderID: scope.ID,
            }
        }
        return valueDC;
    }

    /**
     * 为每个camera创建前向渲染的DrawCommand
     * @param camera 
     */
    override createForwardDC(camera: BaseCamera): void {
        if (this._wireframe.wireFrameOnly !== true) {
            super.createForwardDC(camera);
        }
        //wireframe 前向渲染
        if (this._wireframe.enable) {
            let UUID = camera.UUID;
            let dc = this.generateOpacityDC(UUID, SHT_MeshWireframeVS, undefined, this._materialWireframe, this.generateWireFrameInputValueOfDC);
            this.cameraDC[UUID][E_renderPassName.forward].push(dc);
        }
    }

    createTransparent(camera: BaseCamera): void {
        if (this._wireframe.wireFrameOnly === false) {//非wireframe 才创建前向渲染的DrawCommand
            super.createTransparent(camera);
        }
        //wireframe 前向渲染,暂时不考虑wireframe 透明渲染
        if (this._wireframe.enable) {
            let UUID = camera.UUID;
            let bundle = this.getVSUniformAndShaderTemplateFinal(SHT_MeshWireframeVS);
            let uniformsMaterial = this._materialWireframe.getOpacity_Forward(bundle.bindingNumber);
            // if (uniformsMaterial) {
            //     bundle.uniformGroups[0].push(...uniformsMaterial.uniformGroup);
            //     bundle.shaderTemplateFinal.material = uniformsMaterial.singleShaderTemplateFinal;
            // }
            let valueDC = this.generateWireFrameInputValueOfDC(E_renderForDC.camera, UUID, { vsBundle: bundle, fsBundle: uniformsMaterial });
            let dc = this.DCG.generateDrawCommand(valueDC);
            this.cameraDC[UUID][E_renderPassName.forward].push(dc);
        }
    }

    /**
     * 生成线框的索引
     * @param position 顶点位置数组
     * @param indeices 索引数组
     * @returns wireframe 索引数组
     */
    createWrieFrame(position: number[], indeices: number[]) {

        let list: { [name: string]: number[] };
        list = {};
        if (indeices.length == 0) {//如果没有索引，就按三角形来创建线框
            let i_index = 0;
            for (let i = 0; i < position.length / 3; i++) {
                list[i_index++] = [i, i + 1];
                list[i_index++] = [i + 1, i + 2];
                list[i_index++] = [i + 2, i];

            }
        }
        else {//如果有索引，就按索引来创建线框
            for (let i = 0; i < indeices.length; i += 3) {
                let A = indeices[i];
                let B = indeices[i + 1];
                let C = indeices[i + 2];
                let AB = [A, B].sort().toString();
                let BC = [B, C].sort().toString();
                let CA = [C, A].sort().toString();
                list[AB] = [A, B];
                list[BC] = [B, C];
                list[CA] = [C, A];
            }
        }
        let indeicesWireframe: number[] = [];
        for (let i in list) {
            indeicesWireframe.push(list[i][0], list[i][1]);
        }
        return indeicesWireframe;
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
}