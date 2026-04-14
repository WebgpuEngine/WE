import { E_renderForDC } from "../base/coreDefine";
import { BaseEntity } from "../entity/baseEntity";
import { EntityBundleMaterial } from "../entity/entityBundleMaterial";
import { Mesh } from "../entity/mesh/mesh";
import { E_TransparentType } from "../material/base";
import { BaseMaterial } from "../material/baseMaterial";
import { Scene } from "../scene/scene";
import { I_drawMode, I_drawModeIndexed, } from "./base";
import { BaseDrawCommand, I_drawCallOption, IV_BaseDrawCommand } from "./BaseDrawCommand";




interface I_DrawInputValueMaterial {
    /**material 所有者 */
    owner: BaseMaterial,
    /**material类型 
     * 1、不同类型的material的type，其bind group不同
    */
    type: "opacity" | "TO" | "TT" | "TTP" | "TTPF",
    /**透明类型 :透明材质才需要.todo：备用
    */
    transparentType?: E_TransparentType,
    dynamic: boolean
}
interface I_DrawInputValueTarget {
    UUID: string,
    type: E_renderForDC,//"camera" | "light"
}
/**
 * DrawCommand input value 
 */
export interface IV_DrawCommand extends IV_BaseDrawCommand {
    scene: Scene,
    /**基础信息 */
    baseInfo: {
        parent?: BaseEntity,
        /**material 
         * 1、有值：渲染material
         * 2、无值：渲染depth
        */
        material?: I_DrawInputValueMaterial
        /**draw 目标，
         * 1、有值：camera或light
         */
        traget: I_DrawInputValueTarget
    },
}

export class DrawCommand extends BaseDrawCommand {
    /**Entity     */
    parent: BaseEntity | undefined;
    scene: Scene;
    material: I_DrawInputValueMaterial | undefined;

    inputValues: IV_DrawCommand;
    traget: I_DrawInputValueTarget | undefined;

    constructor(input: IV_DrawCommand) {
        super(input);
        this.inputValues = input;
        if (input.scene != undefined) this.scene = input.scene;
        else throw new Error("DrawCommand: scene 不能为空");
        if (input.baseInfo?.traget) this.traget = input.baseInfo.traget;
        else throw new Error("DrawCommand: baseInfo.traget 不能为空");
        if (input.baseInfo?.parent) this.parent = input.baseInfo.parent;
        else throw new Error("DrawCommand: baseInfo.parent 不能为空");
        if (input.baseInfo?.material) this.material = input.baseInfo.material;
    }

    /**
     * uniform 的GPUBuffer列表，
     * destroy时需要删除GPUBuffer
     */
    uniformBufferList: any[] = [];
    destroy() {
        console.warn("DrawCommand destroy:", this.label);
        this.uniformBufferList = [];
        this.pipeline = {} as GPURenderPipeline;
        // this.scene = null;
        this.inputValues = {} as IV_DrawCommand;
        // this.pipelineLayout = {} as GPUPipelineLayout;
        this.renderPassDescriptor = {} as () => GPURenderPassDescriptor;
        this.vertexBuffers = [];
        this.indexBuffer = undefined;
        this.bindGroups = [undefined, undefined, undefined, undefined];
        this.drawMode = {} as I_drawMode | I_drawModeIndexed;

        this._isDestroy = true;
    }

    override update(): GPUCommandBuffer {
        /**
         * 目标：
         * 1、为DC绑定camera的bindGroup0（动态增加光源的阴影贴图后，shadowmap textture 会重建，原来绑定的会失效）
         * 2、透明的shadowmap渲染，预计也可能有类似的问题。（如果是copy 到公用的uniform depth texture的方式，应该没有此问题）todo
         */
        if (this.traget && this.traget.type === E_renderForDC.camera) {
            let bindGroupBundle = this.scene.getSystemBindGroupAndBindGroupLayoutForZero(this.traget.UUID, this.traget.type);
            this.bindGroups[0] = bindGroupBundle.bindGroup;
        }
        // 如果有parent(entity)，则绑定parent的bindGroup0; PP的DC也有parent
        if (this.parent !== undefined && this.parent.type === "entity") {
            let bindGroupBundle = this.parent.getBindGroupAndBindGroupLayout();
            this.bindGroups[1] = bindGroupBundle.bindGroup;

            if (this.traget && this.traget.type == E_renderForDC.camera) {
                if (this.label.includes("wireframe")) {
                    if ((this.parent as Mesh)._materialWireframe) {
                        let { bindGroup, bindGroupLayout } = (this.parent as Mesh)._materialWireframe.getBindGroupAndBindGroupLayout();
                        this.bindGroups[2] = bindGroup;
                    }
                }
                else {
                    if ((this.parent as EntityBundleMaterial)._material) {
                        let { bindGroup, bindGroupLayout } = (this.parent as EntityBundleMaterial)._material.getBindGroupAndBindGroupLayout();
                        this.bindGroups[2] = bindGroup;
                    }
                }
            }
        }
        return super.update();
    }
    // override doDraw(passEncoder: GPURenderPassEncoder) {
    override  doDraw(option: I_drawCallOption) {
        let passEncoder = option.passEncoder;
        for (let i in this.vertexBuffers) {
            const verticesBuffer = this.vertexBuffers[i];
            if (verticesBuffer.offset !== undefined && verticesBuffer.byteSize !== undefined)
                passEncoder.setVertexBuffer(parseInt(i), verticesBuffer.buffer, verticesBuffer.offset, verticesBuffer.byteSize);//四个参数： slot, buffer, offset, size
            else
                passEncoder.setVertexBuffer(parseInt(i), verticesBuffer.buffer);//四个参数： slot, buffer, offset, size
        }
        if (this.viewport) {
            let minDepth = this.viewport.minDepth == undefined ? 0 : this.viewport.minDepth;
            let maxDepth = this.viewport.maxDepth == undefined ? 1 : this.viewport.maxDepth;

            passEncoder.setViewport(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height, minDepth, maxDepth);
        }

        if (option.renderPassName && option.mergeID && option.drawModeData) {
            throw new Error("Method not implemented");
        }
        else {
            for (let i in this.bindGroups) {
                passEncoder.setBindGroup(parseInt(i), this.bindGroups[i]);
            }
            // 绘制实例 :函数返回多个instance数组(merge instance模式).主要的工作模式
            if (typeof this.drawMode === "function") {
                if (this.traget !== undefined) {
                    let drawModeTemp: I_drawMode[] | I_drawModeIndexed[] = this.drawMode(this.traget.UUID, this.traget.type);
                    this.drawInstacnceArray(passEncoder, drawModeTemp);
                }
                else {
                    throw new Error("drawMode is  function and  must be have system input value ");
                }
            }
            // 绘制实例 :多个instance数组。测试模拟merge
            else if (Array.isArray(this.drawMode)) {
                this.drawInstacnceArray(passEncoder, this.drawMode);
            }
            // 绘制实例 :单个instance。测试模拟single instance模式，raw模式
            else {
                this.drawInstacnce(passEncoder, this.drawMode as I_drawMode | I_drawModeIndexed);
            }
        }
    }

}