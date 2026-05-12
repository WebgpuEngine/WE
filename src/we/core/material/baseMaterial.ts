
import { RootGPU } from "../organization/root";

import { E_lifeState } from "../base/coreDefine";
import { I_ShadowMapValueOfDC } from "../entity/base";
import {
    IV_BaseMaterial,
    I_PartBundleOfUniform_TT,
    I_materialBundleOutput,
    I_AlphaTransparentOfMaterial,
    I_UniformBundleOfMaterial,
    I_BundleOfMaterialForMSAA,
    E_MaterialType,
    E_materialTypeForBindGroup
} from "./base";
import { commmandType, I_dynamicTextureEntryForView, isDynamicTextureEntryForExternal, isDynamicTextureEntryForView, T_uniformEntries, T_uniformOneGroup } from "../command/base";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate } from "../shadermanagemnet/base";
import { Scene } from "../scene/scene";
import { BaseCamera } from "../camera/baseCamera";
import { E_resourceKind } from "../resources/resourcesGPU";
import { I_mipmap } from "../texture/base";
import { Clock } from "../scene/clock";
import { E_GBufferNames, V_TransparentGBufferNames } from "../gbuffers/base";
import { getSampler } from "../sampler/baseFunction";
import { Texture } from "../texture/texture";
import { CubeTexture } from "../texture/cubeTexxture";
import { I_pointerStruct } from "../bufferBlock/pointer";
import { E_renderPassName } from "../scene/renderManager";


/**
 *二、 透明材质的说明
 * TO为不透明材质的不透明部分；
 * TT为透明材质的透明部分；
 * TTP为像素级别的排序
 * TTPF为像素级别的排序后的输出
 * 
 * 1、TO部分说明
 *      A、TTTT只获取了TO的forward部分
 *      B、TO_MSAA,TO_deferColor,TO_deferColorOfMSAA需要单独获取。
 *      C、单独获取的意义：
 *              (1)、纯透明：alpha的color材质，alpha的百分比透明（纹理等），全（半）透明的物理透明材质等，可能没有TO。
 *                  所以，如果没有TO，就不进行其他的TO变种的获取，优化初始化性能
 *             （2）、forward为标准的测试模板，必须有
 * 2、TT与TTP和TTPF同时存在，也一定有的，但不一定使用（需要看是否存在BVH判断的相交{AABB、OBB，真相交等}）


 */

export abstract class BaseMaterial extends RootGPU {
    ///////////////////////////////////////////////////////////////////
    declare inputValues: IV_BaseMaterial;
    kind!: E_MaterialType;
    /** 材质的uniform  Buffer 的指针，用于快速访问 
     * 20260419：
     * 1、这个名称不够直观，需要调整一下，调整为与VS相同的名称
    */
    uniformPointer!: I_pointerStruct;
    _doubleSided: boolean = false;
    get DoubleSided(): boolean { return this._doubleSided; }
    set DoubleSided(value: boolean) { this._doubleSided = value; }

    ///////////////////////////////////////////////////////////////////
    //材质相关
    /** 是否动态材质 :video材质的External就需要动态材质    */
    _dynamic: boolean = false;
    get Dynamic(): boolean { return this._dynamic; }
    set Dynamic(value: boolean) { this._dynamic = value; }
    /**
     * 纹理
     * ！！！这里定义的是any，后续各种材质所需要的纹理根据情况，进行declare
    */
    textures: any
    /** 材质的sampler是否存在，不存在就创建一个。    */
    defaultSamplerBindingType: GPUSamplerBindingType = "filtering";
    /**默认的sampler */
    defaultSampler!: GPUSampler;
    /**默认的2D纹理 */
    defaultTexture2D!: Texture;
    /**默认的3D纹理 */
    defaultTexture3D!: CubeTexture;

    /** mipmap设置     */
    _mipmap: I_mipmap = {
        enable: true,
        level: 3
    };
    ///////////////////////////////////////////////////////////////////
    //渲染相关
    /**
     * 材质的更新命令队列
     * 1、有materialManager调用，每帧更新一次。
     * 2、非必须，比如video材质的External就需要
     */
    commands: commmandType[] = [];

    constructor(input?: IV_BaseMaterial) {
        super(input);
        this.type = "material";
        this.DoubleSided = input?.doubleSided || false;
        this._state = E_lifeState.unstart;
    }
    _destroy(): void {
        console.log("===material destroy release pointer", this.uniformPointer.pointerID);
        this.scene.pointers.releasePointer(this.uniformPointer.pointerID);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 基础功能部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**设置状态 */
    set LifeState(state: E_lifeState) { this._state = state; }
    /**获取状态 */
    get LifeState(): E_lifeState { return this._state; }
    /**
     * 材质是否已经准备好，
     * 判断两个值，
     * 1、this._readyForGPU：延迟GPU device相关的资源建立需要延迟。 需要其顶级使用者被加入到stage中后，才能开始。
     * 2、this._state：材质自身的初始化是否完成。
     * 
     * @returns true：可以使用，false：需要等待。     
     */
    getReady(): E_lifeState {
        return this._state;
    }

    async init(scene: Scene): Promise<any> {
        // this._shadow = (parent as BaseEntity)._shadow;
        this.scene = scene;
        // this.entity = entity;
        this.defaultTexture2D = this.scene.resourcesGPU.weTextureOfString.get("default") as Texture;
        this.defaultTexture3D = this.scene.resourcesGPU.weTextureOfString.get("defaultCube") as CubeTexture;
        this.defaultSampler = this.checkSampler(this.inputValues);
        this.resourcesGPU = this.scene.resourcesGPU;
        await super.init(scene);

        this.setTO();
        this.scene.materialManager.add(this);
        // this._state == E_lifeState.finished;
    }
    /**
     * 正常更新，从上到下 
     * @param clock Clock 时钟
     * @param updateSelftFN 是否调用自身的updateSelf(),默认=true
     *         此参数可以方便子类重载时，决定调用的updateSelf()的时间顺序或是否调用updateSelft()
     * @returns 
     */
    // update(clock: Clock, updateSelftFN: boolean = true): boolean {
    update(clock: Clock, updateSelftFN: boolean = true, updateAtEndFN: boolean = true): boolean {
        super.update(clock, false, false);//更新I_Update，不更新updateSelf() and  updateAtEnd()
        //更新updateSelf()。只更新一次,在所有自身更新之后
        if (updateSelftFN) {
            this.updateSelf(clock);
            this.lastUpdaeTime = clock.now;                     //更新最后一次更新时间
        }
        //在最后执行调用
        if (updateAtEndFN)
            if (this.needUpdateuserDefineAtEnd) {
                this.inputValues.updateAtEnd!(this);
            }
        return true;
    }
    /**
    * 获取当前材质的pointer的byte size
    * @param size 
    * @returns 
    * */
    getPointerByteSize(size: number): number {
        let min = Math.ceil(size / 256) || 1;
        return min * 256;
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // bind group 部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**材质的默认绑定组，默认是2 */
    bindGroupNumber: number = 2;
    /** 材质的SHT模板，key:材质类型，value:SHT模板。 */
    shtOfMaterialType!: {
        [key in E_materialTypeForBindGroup]: I_ShaderTemplate | undefined;
    };
    /** VS bind group 
     * 1、 key :string 采样E_materialTypeForBindGroup的值
     * 2、不使用[key in E_materialTypeForBindGroup] 的原因：
     *  A、不是所有类型会有用到，防止不必要的创建
     *  B、目前TTP、TTPF暂停中；20260419
    */
    bindGroup: {
        [key in E_materialTypeForBindGroup]:
        GPUBindGroup | undefined |
        {//按照UUID再进行分类的：MSAA，TTP，TTPF
            [uuid: string]: GPUBindGroup,
        }
    } = {
            [E_materialTypeForBindGroup.opacityForward]: undefined,
            [E_materialTypeForBindGroup.opacityDefer]: undefined,
            [E_materialTypeForBindGroup.opacityMSAA]: {},
            [E_materialTypeForBindGroup.opacityMSAAInfo]: undefined,
            [E_materialTypeForBindGroup.TO_Forward]: undefined,
            [E_materialTypeForBindGroup.TO_Defer]: undefined,
            [E_materialTypeForBindGroup.TO_MSAA]: {},
            [E_materialTypeForBindGroup.TO_MsaaInfo]: undefined,
            [E_materialTypeForBindGroup.TT]: undefined,
            [E_materialTypeForBindGroup.TTP]: {},
            [E_materialTypeForBindGroup.TTPF]: {},
        };
    /** VS bind group layout */
    bindGroupLayout: { [key: string]: GPUBindGroupLayout } = {};

    /** 检查是否需要创建bind group
     * 1、如果材质类型不存在，创建
     * 2、pointer 不存在或 rebuild，需要更新bind group
     * 3、如果材质类型存在，但是dynamic texture，创建
     */
    checkNeedCreateBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string): boolean {
        let flagCreateBindGroup = false;
        //undefined，创建
        if (this.bindGroupLayout[materialType] == undefined) {
            this.bindGroupLayout[materialType] = this.getBindGroupLayout(materialType);
            flagCreateBindGroup = true;
        }

        //bindgroup需要使用camera的texture时，需要检查是否存在bind group
        if (materialType == E_materialTypeForBindGroup.opacityMSAA ||
            materialType == E_materialTypeForBindGroup.TO_MSAA ||
            materialType == E_materialTypeForBindGroup.TTP ||
            materialType == E_materialTypeForBindGroup.TTPF) {
            if (uuid == undefined)
                flagCreateBindGroup = true;
            else if ((this.bindGroup[materialType] as { [uuid: string]: GPUBindGroup })[uuid] == undefined)
                flagCreateBindGroup = true;
        }
        else if (this.bindGroup[materialType] == undefined)
            flagCreateBindGroup = true;

        //pointer rebuild，需要更新bind group
        if (this.uniformPointer != undefined && this.uniformPointer.rebuildTime == this.scene.clock.now) {
            flagCreateBindGroup = true;
        }
        //dynamic texture，需要更新bind group
        if (this.Dynamic) {
            flagCreateBindGroup = true;
        }
        return flagCreateBindGroup;
    }
    /** 创建bind group */
    createBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string) {
        let perGroup: T_uniformEntries[] = this.getEntriesOfBindGroup(materialType, uuid);
        //BindGroup 的数据入口,主要是buffer的创建需要push,-->1.1.1
        let bindGroupEntry: GPUBindGroupEntry[] = [];
        for (let j in perGroup) {//遍历每组group的每个entry
            let perEntry = perGroup[j];
            //20260422,不再有数据类型的entry，已经使用BOL转为GPUBindGroupEntry
            //动态 external texture,不做map
            if (isDynamicTextureEntryForExternal(perEntry)) {
                bindGroupEntry.push({
                    binding: perEntry.binding,
                    resource: perEntry.getResource(perEntry.scope),
                });
            }
            //动态 view texture,不做map
            else if (isDynamicTextureEntryForView(perEntry)) {
                bindGroupEntry.push({
                    binding: perEntry.binding,
                    resource: perEntry.getResource(),
                });
            }
            //排除其他类型后，即是GPUBindGroupEntry
            else {
                bindGroupEntry.push(perEntry as GPUBindGroupEntry);//GPUBindGroupEntry
            }
        }
        //初始化BindGroup描述
        let bindGroupDesc: GPUBindGroupDescriptor = {
            label: `${this.kind}:${this.ID} :${materialType}`,
            layout: this.bindGroupLayout[materialType],
            entries: bindGroupEntry,
        }
        //创建BindGroup

        if (uuid == undefined &&
            materialType != E_materialTypeForBindGroup.opacityMSAA &&
            materialType != E_materialTypeForBindGroup.TO_MSAA &&
            materialType != E_materialTypeForBindGroup.TTP &&
            materialType != E_materialTypeForBindGroup.TTPF) {
            let bindGroup = this.device.createBindGroup(bindGroupDesc);//防止uuid为空时创建，会产生webGPU错误
            this.bindGroup[materialType] = bindGroup;
        }
        else if (uuid != undefined) {
            let bindGroup = this.device.createBindGroup(bindGroupDesc);//防止uuid为空时创建
            if (this.bindGroup[materialType] == undefined) {
                this.bindGroup[materialType] = { [uuid]: bindGroup };
            }
            else {
                (this.bindGroup[materialType] as { [uuid: string]: GPUBindGroup })[uuid] = bindGroup;
            }
        }
        else {
            throw new Error(`createBindGroup: uuid(${uuid}) and materialType(${materialType}) are not opacityForward`);
        }
    }
    /**按照materialType获取bind group layout的layout entry */
    abstract getEntriesOfBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayoutEntry[];
    /**按照materialType获取bind group的entry */
    abstract getEntriesOfBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string): T_uniformEntries[];
    /**按照materialType获取bind group的groupAndBindingString */
    abstract getGroupAndBindingString(materialType: E_materialTypeForBindGroup): string;
    /**
     * opacity and TO ：forward,defer,MSAAInfo 通用
     * @returns I_bindGroupAndGroupLayout
     */
    bindGroupOfForward(): GPUBindGroup {
        let materialType = E_materialTypeForBindGroup.opacityForward;
        let createBindGroup = this.checkNeedCreateBindGroup(materialType);
        //创建或更新bind group
        if (createBindGroup === true) {
            this.createBindGroup(materialType);
        }//end 
        return this.bindGroup[materialType] as GPUBindGroup;
    }
    bindGroupLayoutOfForward(): GPUBindGroupLayout {
        let materialType = E_materialTypeForBindGroup.opacityForward;
        if (this.bindGroupLayout[materialType] != undefined)
            return this.bindGroupLayout[materialType];

        this.bindGroupLayout[materialType] = this.device.createBindGroupLayout({
            label: `${this.kind}:${this.ID}:${materialType}`,
            entries: this.getEntriesOfBindGroupLayout(materialType),
        });
        return this.bindGroupLayout[materialType];
    }
    bindGroupOfMSAA(mergeID: string): GPUBindGroup {
        // return this.bindGroupAndLayoutOfForward();
        let materialType = E_materialTypeForBindGroup.opacityMSAA;
        let createBindGroup = this.checkNeedCreateBindGroup(materialType, mergeID);
        if (this.scene.isResized() && this.scene.cameraManager.getCameraByUUID(mergeID).FixedSize == false) {
            createBindGroup = true;
        }
        //创建或更新bind group
        if (createBindGroup === true) {
            this.createBindGroup(materialType, mergeID);
        }//end 
        return (this.bindGroup[materialType] as { [uuid: string]: GPUBindGroup })[mergeID];
    }
    bindGroupLayoutOfMSAA(): GPUBindGroupLayout {
        let materialType = E_materialTypeForBindGroup.opacityMSAA;
        if (this.bindGroupLayout[materialType] != undefined)
            return this.bindGroupLayout[materialType];

        this.bindGroupLayout[materialType] = this.device.createBindGroupLayout({
            label: `${this.kind}:${this.ID}:${materialType}`,
            entries: this.getEntriesOfBindGroupLayout(materialType),
        });
        return this.bindGroupLayout[materialType];
    }

    bindGroupOfTT(): GPUBindGroup {
        return this.bindGroupOfForward();
    }
    bindGroupLayoutOfTT(): GPUBindGroupLayout {
        return this.bindGroupLayoutOfForward();
    }
    bindGroupOfTTP(mergeID: string): GPUBindGroup {
        throw new Error("Method not implemented: TTPTP");
    }
    bindGroupLayoutOfTTP(): GPUBindGroupLayout {
        throw new Error("Method not implemented: TTPTP");
    }
    bindGroupOfTTPF(mergeID: string): GPUBindGroup {
        throw new Error("Method not implemented: TTPTF");
    }
    bindGroupLayoutOfTTPF(): GPUBindGroupLayout {
        throw new Error("Method not implemented: TTPTF");
    }
    getBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayout {
        if (materialType == E_materialTypeForBindGroup.opacityForward ||
            materialType == E_materialTypeForBindGroup.opacityDefer ||
            materialType == E_materialTypeForBindGroup.opacityMSAAInfo ||
            materialType == E_materialTypeForBindGroup.TO_Forward ||
            materialType == E_materialTypeForBindGroup.TO_Defer ||
            materialType == E_materialTypeForBindGroup.TO_MsaaInfo
        ) {
            return this.bindGroupLayoutOfForward();
        }
        else if (materialType == E_materialTypeForBindGroup.opacityMSAA || materialType == E_materialTypeForBindGroup.TO_MSAA) {
            return this.bindGroupLayoutOfMSAA();
        }
        else if (materialType == E_materialTypeForBindGroup.TT) {
            return this.bindGroupLayoutOfTT();
        }
        else if (materialType == E_materialTypeForBindGroup.TTP) {
            return this.bindGroupLayoutOfTTP();
        }
        else if (materialType == E_materialTypeForBindGroup.TTPF) {
            return this.bindGroupLayoutOfTTPF();
        }
        else {
            throw new Error(`不支持的材质类型：${materialType}`);
        }
    }
    /**
     * 20260402 增加：DC可以获取当前材质的bind group和bind group layout
     * 获取当前材质的bind group和bind group layout
     * @returns I_bindGroupAndGroupLayout
     */
    getBindGroup(
        materialType: E_materialTypeForBindGroup = E_materialTypeForBindGroup.opacityForward,
        /**MSAA的需要camera的GBuffer中的texture作为uniform输入，需要指定mergeID。         */
        mergeID: string,
        renderPassName: E_renderPassName,
    ): GPUBindGroup {
        if (materialType == E_materialTypeForBindGroup.opacityForward ||
            materialType == E_materialTypeForBindGroup.opacityDefer ||
            materialType == E_materialTypeForBindGroup.opacityMSAAInfo ||
            materialType == E_materialTypeForBindGroup.TO_Forward ||
            materialType == E_materialTypeForBindGroup.TO_Defer ||
            materialType == E_materialTypeForBindGroup.TO_MsaaInfo
        ) {
            return this.bindGroupOfForward();
        }
        else if (materialType == E_materialTypeForBindGroup.opacityMSAA || materialType == E_materialTypeForBindGroup.TO_MSAA) {
            return this.bindGroupOfMSAA(mergeID);
        }
        else if (materialType == E_materialTypeForBindGroup.TT) {
            return this.bindGroupOfTT();
        }
        else if (materialType == E_materialTypeForBindGroup.TTP) {
            return this.bindGroupOfTTP(mergeID);
        }
        else if (materialType == E_materialTypeForBindGroup.TTPF) {
            return this.bindGroupOfTTPF(mergeID);
        }
        else {
            throw new Error(`不支持的材质类型：${materialType}`);
        }
    }



    /////////////////////////////////////三个不透明的模板输出/////////////////////////////////////
    generateBundleOutput(template: I_ShaderTemplate, _startBinding: number, materialType: E_materialTypeForBindGroup): I_materialBundleOutput {
        let replaceList = new Map<string, string | (() => string)>();
        let output = this.formatSHT(template, replaceList, _startBinding, materialType);
        return output;
    }
    /**
     * 获取uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
     * 涉及三个部分：
     * 1、uniformGroups：uniform，一个组的内有多个binding 的uniform。
     * 2、singleShaderTemplateFinal：shader模板输出，包括了shader代码和groupAndBindingString。
     * 3、uniform layout 到ResourceGPU的Map操作
     * @param startBinding 
     * @returns I_materialBundleOutput
     */
    getOpacity_Forward(startBinding?: number): I_materialBundleOutput {
        let replaceList = new Map<string, string | (() => string)>();
        let output = this.formatSHT(this.shtOfMaterialType[E_materialTypeForBindGroup.opacityForward]!, replaceList, startBinding || 0);
        return output;
    }
    /**
     * MSAA 材质输出shader模板
     * @param startBinding 
     * @returns { MSAA: I_materialBundleOutput, inforForward: I_materialBundleOutput }
     *  1、MSAA：只输出color和depth
     *  2、inforForward:输出其他GBuffer信息
     */
    getOpacity_MSAA(startBinding?: number): I_BundleOfMaterialForMSAA {
        let MSAA: I_materialBundleOutput = this.generateBundleOutput(this.shtOfMaterialType[E_materialTypeForBindGroup.opacityMSAA]!, startBinding || 0, E_materialTypeForBindGroup.opacityMSAA);
        // // let bundleOfMsaa = this.getUniformEntryBundleOfMSAA(undefined, MSAA.bindingNumber);
        // MSAA.shaderTemplateFinal.material.groupAndBindingString += `
        //  @group(2) @binding(${MSAA.bindingNumber++}) var u_texture_id: texture_2d<u32>;
        //  @group(2) @binding(${MSAA.bindingNumber++}) var u_texture_normal: texture_2d<f32>; 
        // `;
        let inforForward: I_materialBundleOutput = this.generateBundleOutput(this.shtOfMaterialType[E_materialTypeForBindGroup.opacityMSAAInfo]!, startBinding || 0, E_materialTypeForBindGroup.opacityMSAAInfo);
        return { MSAA, inforForward };
    }
    /**
     * 延迟渲染的shader模板输出
     * @param startBinding 
     * @returns I_materialBundleOutput  不包含光影的GBuffer，但GBuffer的输出中需要按照延迟渲染的约定进行。
     */
    getOpacity_DeferColor(startBinding?: number): I_materialBundleOutput {
        let replaceList = new Map<string, string | (() => string)>();
        let output = this.formatSHT(this.shtOfMaterialType[E_materialTypeForBindGroup.opacityDefer]!, replaceList, startBinding || 0, E_materialTypeForBindGroup.opacityDefer);
        return output;
    }

    /////////////////////////////////////三个TO的模板输出/////////////////////////////////////

    /**
     * 透明材质的不透明code （ transparent  opaque ）
     * @param startBinding binding开始值
     * @returns 
     */
    getFS_TO(startBinding: number): I_materialBundleOutput {
        if (this.shtOfMaterialType[E_materialTypeForBindGroup.TO_Forward] == undefined) {
            throw new Error(`Material ${this.kind} not support TO_Forward.`);
        }
        return this.formatSHT(this.shtOfMaterialType[E_materialTypeForBindGroup.TO_Forward]!, new Map(), startBinding || 0);
    }

    /**
     * MSAA 材质（color及光影计算部分）输出shader模板
     * @param startBinding 
     * @returns { MSAA: I_materialBundleOutput, inforForward: I_materialBundleOutput }
     *  1、MSAA：只输出color和depth
     *  2、inforForward:输出其他GBuffer信息
     */
    getFS_TO_MSAA(startBinding?: number): I_BundleOfMaterialForMSAA {
        if (this.shtOfMaterialType[E_materialTypeForBindGroup.TO_Forward] == undefined) {
            throw new Error(`Material ${this.kind} not support TO_MSAA.`);
        }
        let MSAA: I_materialBundleOutput = this.formatSHT(this.shtOfMaterialType[E_materialTypeForBindGroup.TO_MSAA]!, new Map(), startBinding || 0, E_materialTypeForBindGroup.TO_MSAA);
        let inforForward: I_materialBundleOutput = this.formatSHT(this.shtOfMaterialType[E_materialTypeForBindGroup.TO_MsaaInfo]!, new Map(), startBinding || 0, E_materialTypeForBindGroup.TO_MsaaInfo);
        return { MSAA, inforForward };
    }


    /**
     * 延迟渲染的shader模板输出（即、不包括光影部分的shader）
     * @param startBinding 
     * @returns I_materialBundleOutput  不包含光影的GBuffer，但GBuffer的输出中需要按照延迟渲染的约定进行。
     */
    getFS_TO_DeferColor(startBinding?: number): I_materialBundleOutput {
        if (this.shtOfMaterialType[E_materialTypeForBindGroup.TO_Forward] == undefined) {
            throw new Error(`Material ${this.kind} not support TO_DeferColor.`);
        }
        return this.formatSHT(this.shtOfMaterialType[E_materialTypeForBindGroup.TO_Defer]!, new Map(), startBinding || 0, E_materialTypeForBindGroup.TO_Defer);
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //TTTT 功能实现部分
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 设置透明材质的不透明部分是否存在
     */
    abstract setTO(): void;

    /**
     * 获取透明材质的uniform和shader模板输出,
     * TO为不透明材质的不透明部分；
     * TT为透明材质的透明部分；
     * TTP为像素级别的排序
     * TTPF为像素级别的排序后的输出
     * 
     * @param renderObject  BaseCamera | I_ShadowMapValueOfDC
     * @param startBinding number
     * @returns   
     * {
     *     TT: I_materialBundleOutput,
     *     TO?: I_materialBundleOutput,
     *     TTP: I_materialBundleOutput,
     *     TTPF: I_materialBundleOutput
     * }
     */
    getTTTT(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number = 0): {
        TT: I_materialBundleOutput,
        TO?: I_materialBundleOutput,
        TTP: I_materialBundleOutput,
        TTPF: I_materialBundleOutput
    } {
        // this.setUniformIDOfTTPF(meshID);

        let TT: I_materialBundleOutput = this.getFS_TT(renderObject, startBinding);;
        let TO: I_materialBundleOutput;
        // let TTP: I_materialBundleOutput = this.getFS_TTP(renderObject, startBinding);;
        // let TTPF: I_materialBundleOutput = this.getFS_TTPF(renderObject, startBinding);
        // // TT = this.getFS_TT(renderObject, startBinding);
        // // TTP = this.getFS_TTP(renderObject, startBinding);
        let TTTT: {
            TT: I_materialBundleOutput, TO?: I_materialBundleOutput,
            TTP: I_materialBundleOutput, TTPF: I_materialBundleOutput
        } =
        {
            TT,
            // TTP, TTPF
        };
        if (this._opaqueOfTransparent) {
            TO = this.getFS_TO(startBinding);
            TTTT.TO = TO;
        }
        return TTTT;
    }

    /////////////////////////////////////三个透明TT、TTP、TTPF的模板输出/////////////////////////////////////
    /**
     * 透明材质的code（ transparent ）
     * @param _startBinding 
     * @returns 
     */
    getFS_TT(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
        if (this.shtOfMaterialType[E_materialTypeForBindGroup.TT] == undefined) {
            throw new Error(`Material ${this.kind} not support TT.`);
        }
        return this.formatSHT(this.shtOfMaterialType[E_materialTypeForBindGroup.TT]!, new Map(), _startBinding || 0, E_materialTypeForBindGroup.TT);
    }
    /**
     * 透明材质的透明部分的pixel 的最终输出（ transparent's transparent pixcel final render ）
     * @param _startBinding binding开始值
     */
    abstract getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput;

    /**
     * 格式化TTP的shader代码，并返回
     * 1、各类材质自行实现，SHT在TTP的代码中
     * @param renderObject 渲染对象，相机或阴影映射
     * @returns 
     */
    abstract formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput;

    /**
     * 透明材质的像素级别对比与处理 （ transparent  transparent pixcel  ）
     * 针对BVH的包围盒相交的情况
     * @param renderObject 渲染对象，相机或阴影映射
     * @param _startBinding binding开始值
     */
    getFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number = 0): I_materialBundleOutput {
        let output: I_materialBundleOutput;
        if (renderObject instanceof BaseCamera) {
            output = this.formatFS_TTP(renderObject);
            let partBundleOfUniform_TT = this.getUniformEntryOfCamera_TTP(renderObject, output.bindingNumber);
            output.bindingNumber = partBundleOfUniform_TT.bindingNumber;
            //更新groupAndBindingString
            output.shaderTemplateFinal.material.groupAndBindingString += partBundleOfUniform_TT.groupAndBindingString;
            //由于使用camera的gbuffer，所以bindgroup 需要动态获取（resize 会重建gbuffer）
            output.shaderTemplateFinal.material.dynamic = true;
            return output;
        }
        //light shadow map TT
        else {
            //todo
            throw new Error("light shadow map TT todo");
        }
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    // function 
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 1、检查材质的sampler是否存在，不存在就创建一个。
     * 2、设置this._samplerBindingType:GPUSamplerBindingType
     * @param input IV_BaseMaterial 材质的输入参数
     * @returns GPUSampler 材质的sampler
     */
    checkSampler(input: IV_BaseMaterial): GPUSampler {
        let { sampler, bindingType } = getSampler({}, this.scene);
        this.defaultSamplerBindingType = bindingType;
        this.defaultSampler = sampler;
        return sampler;
    }

    /**
     * 将SHT对象中add部分转为字符串
     * @param addPart 
     * @returns 
     */
    convertAddPartOfSHT(addPart: I_shaderTemplateAdd[]): string {
        let code: string = "";
        // console.log("convertAddPartOfSHT",this.entity.ID);
        for (let perOne of addPart) {
            // if(this.entity.ID ==296) debugger;
            // if (perOne.name == "st_output") {
            //     //如果entity有locationInterpolate，就添加st_output。用途：非默认的插值方式
            //     if (this.entity?.locationInterpolate && this.entity.locationInterpolate != undefined) {
            //         code += this.entity.getSHT_st_output();
            //         continue;
            //     }
            // }
            code += perOne.code;
        }
        return code;
    }
    /**
     * 格式化SHT模板
     * @param template I_ShaderTemplate SHT模板
     * @param replaceList Map<string, string | ((scope?: any) => string)> 替换列表
     * @param startBinding number 开始的binding
     * @returns I_materialBundleOutput 材质的bundle输出
     */
    formatSHT(
        template: I_ShaderTemplate,
        replaceList: Map<string, string | ((scope?: any) => string)>,
        startBinding: number,
        materialType: E_materialTypeForBindGroup = E_materialTypeForBindGroup.opacityForward,
        // isTTPF: boolean = false,
        // renderObject?: BaseCamera
    ): I_materialBundleOutput {
        let shaderTemplateFinal: I_ShaderTemplate_Final = {};
        //获取材质的groupAndBindingString
        let groupAndBindingString: string = this.getGroupAndBindingString(materialType);
        for (let i in template) {
            let perPartSHT = template[i] as I_singleShaderTemplate;
            if (i == "scene") {
                let shader = this.scene.getShaderCodeOfSHT_SceneOfCamera(perPartSHT);
                shaderTemplateFinal[i] = shader.scene;
            }
            else if (i == "material") {
                let code: string = "";
                code += this.convertAddPartOfSHT(perPartSHT.add as I_shaderTemplateAdd[]);
                for (let perOne of perPartSHT.replace as I_shaderTemplateReplace[]) {
                    if (code.indexOf(perOne.replace) != -1) {
                        //replaceCode
                        if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                            code = code.replace(perOne.replace, perOne.replaceCode as string);
                        }
                        //replaceValue
                        /**
                         * 替换值
                         * 1、类型是： E_shaderTemplateReplaceType.value
                         * 2、perOne.replace 作为key，去replaceList中查找对应的值
                         */
                        else if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                            let replaceValue: string = "";
                            if (replaceList.has(perOne.replace)) {
                                let getReplaceValue = replaceList.get(perOne.replace) as string;
                                if (!getReplaceValue) {
                                    throw new Error("replaceValue is undefined");
                                }
                                if (typeof getReplaceValue == "function") {
                                    replaceValue = (getReplaceValue as (() => string))();
                                }
                                else {
                                    replaceValue = getReplaceValue;
                                }
                            }
                            else {
                                replaceValue = "";
                            }
                            code = code.replace(perOne.replace, replaceValue);
                        }
                        //替换选择代码
                        /**
                         * 20260310
                         * 1、E_shaderTemplateReplaceType.selectCode早期设计,在统一参数的material中，不能使用selectCode
                         * 2、DCG的动态注入中还是有selectCode，影响VS的动画部分（morphtarget，skins）；
                         */
                        else if (perOne.replaceType == E_shaderTemplateReplaceType.selectCode) {
                            if (typeof perOne.check == "string") {
                                if (code.indexOf(perOne.check!) != -1) {
                                    code = code.replace(perOne.replace, perOne.selectCode![1]);
                                }
                                else {
                                    code = code.replace(perOne.replace, perOne.selectCode![0]);
                                }
                            }
                        }
                    }
                }
                shaderTemplateFinal[i] = {
                    templateString: code,
                    groupAndBindingString: groupAndBindingString,
                    owner: perPartSHT.owner,
                }
            }
        }
        return {
            // uniformGroup: uniformBundle.entry,
            shaderTemplateFinal,
            bindingNumber: 0,
            materialType
        };
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    // 透明相关信息部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /** 透明材质是否有不透明的部分     */
    _opaqueOfTransparent: boolean = false;
    /**
     * blending混合的状态interface
     * 
     * 1、如果是undefined，说明不混合
     * 2、如果是object，说明混合
     */
    _transparent: I_AlphaTransparentOfMaterial | undefined;

    _ToTaTp: {
        /** 透明材质是否有不透明的部分     */
        opaqueOfTransparent: boolean,
        /** 透明材质是否有alpha透明的部分   ，是否有BLEND。
         * 两种情况：
         *  1、使用统一的透明度（opacity）
         *  2、使用来自texture的透明度（alpha）
          */
        alphaOfTransparent: boolean,
        alphaParams: I_AlphaTransparentOfMaterial | undefined,
    } = {
            opaqueOfTransparent: false,
            alphaOfTransparent: false,
            alphaParams: undefined,
        }
    /**
     * 是否为透明材质
     * @returns boolean  true：是透明材质，false：不是透明材质
     */
    getTransparent(): boolean {
        return this._ToTaTp.alphaOfTransparent;
        // if (this._transparent) {
        //     return true;
        // }
        // else return false;
    }
    /**
     * 获取混合状态
     * @returns  GPUBlendState | undefined  混合状态，undefined表示不混合
     */
    // abstract getBlend(): GPUBlendState | undefined;
    getBlend(): GPUBlendState[] {
        // if (this._transparent?.type == E_TransparentType.alpha) {
        //     return [this._transparent.blend!];
        // }
        // else return false;
        if (this._ToTaTp.alphaOfTransparent && this._ToTaTp.alphaParams?.blendParams?.blend) {
            return [this._ToTaTp.alphaParams?.blendParams?.blend!];
        }
        else {
            throw new Error("透明材质的blend状态不能为空");
            return [];
        }
    }



    /**获取camera 使用的TT的uniformEntry  */
    getUniformEntryOfCamera_TTP(renderObject: BaseCamera, _bindingNumber: number = 0): I_PartBundleOfUniform_TT {
        let bindingNumber = _bindingNumber;
        let groupAndBindingString = "";
        let uniformRoot: T_uniformOneGroup = [];

        // {//获取固定uniform序列
        //     let uniformBundle = this.getUniformEntryBundleOfCommon(bindingNumber);
        //     uniformRoot.push(...uniformBundle.entry);
        //     bindingNumber = uniformBundle.bindingNumber;
        //     groupAndBindingString += uniformBundle.groupAndBindingString;
        // }
        //camera 的深度纹理，用于透明度测试（像素是否在不透明的前面）
        {/**end 
         * 是否开启TTP的深度测试	
         * 20251008，暂缓，开启并去除uniform深度纹理后，有问题，多色混合有问题，待查
         */
            let uniform1: I_dynamicTextureEntryForView;

            /**这里不适用map，因为camera相同，但每个材质的uniform顺序不同，绑定binding不同 */
            // //这里使用map，因为每个相机都有一个深度纹理而且uniform1是动态getResource，就是说：uniform1是不变的（里面是function）
            // if (this.scene.resourcesGPU.cameraToEntryOfDepthTT.has(renderObject.UUID)) {
            //     uniform1 = this.scene.resourcesGPU.cameraToEntryOfDepthTT.get(renderObject.UUID) as I_dynamicTextureEntryForView;
            // }
            // else
            {
                uniform1 = {
                    label: "colorTT camera depth of " + renderObject.UUID,
                    binding: bindingNumber,
                    getResource: () => { return renderObject.manager.getGBufferTextureByUUID(renderObject.UUID, E_GBufferNames.depth); },
                };
                // this.scene.resourcesGPU.cameraToEntryOfDepthTT.set(renderObject.UUID, uniform1);
                // this.mapList.push({ key: uniform1, type: E_resourceKind.cameraToEntryOfDepthTT, map: "cameraToEntryOfDepthTT" });
            }

            let uniformLayout_1: GPUBindGroupLayoutEntry;
            // if (this.scene.resourcesGPU.entriesToEntriesLayout.has(uniform1)) {
            //     uniformLayout_1 = this.scene.resourcesGPU.entriesToEntriesLayout.get(uniform1) as GPUBindGroupLayoutEntry;
            //     console.log("resoureGPU")
            // }
            // else 
            {
                uniformLayout_1 = {
                    binding: bindingNumber,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "depth",
                        viewDimension: "2d",
                        // multisampled: false,
                    },
                };
                this.scene.resourcesGPU.entriesToEntriesLayout.set(uniform1, uniformLayout_1);
                this.mapList.push({ key: uniform1, type: E_resourceKind.entriesToEntriesLayout, map: "entriesToEntriesLayout" });
            }
            //u_camera_opacity_depth在shader中是固定的
            groupAndBindingString += ` @group(${this.bindGroupNumber}) @binding(${bindingNumber}) var u_camera_opacity_depth : texture_depth_2d; \n `;
            // this.scene.resourcesGPU.entriesToEntriesLayout.set(uniform1, uniformLayout_1);
            uniformRoot.push(uniform1);
            // console.log(`1 :TTP uniform binding ${bindingNumber},uniform:${uniform1.binding},layout:${uniformLayout_1.binding}`);
            bindingNumber++;
        }

        //循环 绑定透明材质的GBuffer of uniform
        for (let key in V_TransparentGBufferNames) {
            let uniform2: I_dynamicTextureEntryForView = {
                label: "colorTT: " + key + " of " + renderObject.UUID,
                binding: bindingNumber,
                getResource: () => { return renderObject.manager.getTTUniformTexture(key as E_GBufferNames); },
            };

            let uniformLayout_2: GPUBindGroupLayoutEntry;
            if (this.scene.resourcesGPU.entriesToEntriesLayout.has(uniform2)) {
                uniformLayout_2 = this.scene.resourcesGPU.entriesToEntriesLayout.get(uniform2) as GPUBindGroupLayoutEntry;
            }
            else {
                if (key.indexOf("color") != -1) {//测试使用的color
                    uniformLayout_2 = {
                        binding: bindingNumber,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        texture: {
                            sampleType: "float",
                            viewDimension: "2d",
                            // multisampled: false,
                        },
                    };
                }
                else if (key.indexOf("depth") != -1) {
                    uniformLayout_2 = {
                        binding: bindingNumber,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        texture: {
                            sampleType: "unfilterable-float",
                            viewDimension: "2d",
                            // multisampled: false,
                        },
                    };
                }
                else {
                    {
                        uniformLayout_2 = {
                            binding: bindingNumber,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            texture: {
                                sampleType: "uint",
                                viewDimension: "2d",
                                // multisampled: false,
                            },
                        };
                    }
                }
            }
            this.scene.resourcesGPU.entriesToEntriesLayout.set(uniform2, uniformLayout_2);  //这里的资源需要注销管理
            this.mapList.push({ key: uniform2, type: E_resourceKind.entriesToEntriesLayout, map: "entriesToEntriesLayout" });
            uniformRoot.push(uniform2);
            let uniformType = V_TransparentGBufferNames[key as E_GBufferNames].uniformType;
            groupAndBindingString += ` @group(${this.bindGroupNumber}) @binding(${bindingNumber}) var u_${key} : ${uniformType}; \n `;
            // console.log(`2 :TTP uniform binding ${bindingNumber},uniform:${uniform2.binding},layout:${uniformLayout_2.binding}`, this);
            bindingNumber++;
        }


        return { uniformGroup: uniformRoot, groupAndBindingString: groupAndBindingString, bindingNumber };
    }
    /**
     * 获取当前材质的TTPF的输出uniform bundle 。（在common uniform bundle之后）
     * @param renderObject 
     * @param startBinding 
     * @returns I_UniformBundleOfMaterial
     */
    getUniformEntryBundleOfTTPF(renderObject: BaseCamera, startBinding: number): I_UniformBundleOfMaterial {
        if (this.unifromEntryBundle_TTPF != undefined) {
            return this.unifromEntryBundle_TTPF;
        }
        else {//uniform ID纹理
            let bindingNumber = startBinding;
            let groupAndBindingString = "";
            let uniform1: T_uniformOneGroup = [];
            let layout: GPUBindGroupLayoutEntry[] = [];
            let uniforIDTexture: I_dynamicTextureEntryForView = {
                label: this.Name + " texture ID at group(2) binding(" + bindingNumber + ")",
                binding: bindingNumber,
                getResource: () => { return renderObject.manager.getTTRenderTexture("id"); },
            };
            let uniforIDTextureLayout: GPUBindGroupLayoutEntry = {
                binding: bindingNumber,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "uint",
                    viewDimension: "2d",
                    // multisampled: false,
                },
            };
            //添加到resourcesGPU的Map中
            this.scene.resourcesGPU.entriesToEntriesLayout.set(uniforIDTexture, uniforIDTextureLayout);
            this.mapList.push({
                key: uniforIDTexture,
                type: "entriesToEntriesLayout",
                map: "entriesToEntriesLayout"
            });
            groupAndBindingString += ` @group(${this.bindGroupNumber}) @binding(${bindingNumber}) var u_texture_ID: texture_2d<u32>; \n `;

            //push到uniform1队列
            uniform1.push(uniforIDTexture);
            //+1
            bindingNumber++;

            this.unifromEntryBundle_TTPF = {
                bindingNumber: bindingNumber,
                groupAndBindingString: groupAndBindingString,
                entry: uniform1,
            };
            return this.unifromEntryBundle_TTPF;
        }
    }

}

