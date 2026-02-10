/**
 * 管理DC的中间层，用于管理DC的GPU资源：GPUBuffer,GPUBindGroup。
 * 防止重复资源创建（前向渲染，延迟渲染的深度，shadowmap都是使用相同的资源），同时抽象DC的创建过程
 * 材质的资源不进行管理，传过来的已经是GPU资源
 */

import type { Scene } from "../scene/scene";
import type { I_DrawCommandIDs, I_drawMode, I_drawModeIndexed, I_uniformArrayBufferEntry, I_viewport, T_BindGroupLayout, T_drawMode, T_rpdInfomationOfMSAA, T_uniformGroups } from "./base";
import { createIndexBuffer, createUniformBuffer, createVerticesBuffer, isGPUBindGroup, updataOneUniformBuffer } from "./baseFunction";
import { DrawCommand, IV_DrawCommand } from "./DrawCommand";
import { E_renderForDC, weVec3 } from "../base/coreDefine";
import { isDynamicTextureEntryForExternal, isDynamicTextureEntryForView, isUniformBufferPart, ResourceManagerOfGPU } from "../resources/resourcesGPU";
import { AA } from "../scene/base";
import { E_shaderTemplateReplaceType, I_ShaderTemplate_Final, SHT_refDCG } from "../shadermanagemnet/base";
import { BaseCamera } from "../camera/baseCamera";
import { E_TransparentType, I_TransparentOptionOfMaterial } from "../material/base";
import { Clock } from "../scene/clock";
import { BaseEntity } from "../entity/baseEntity";
import { I_VertexBufferEntry } from "./BaseDrawCommand";

export interface IV_DrawCommandGenerator {
    scene: Scene,
}

//==================================================================================================================
/**
 * 顶点属性的bundle（有更加详细的数据说明），用于绑定到DC的vertex buffer
 */
export interface vsAttribute {
    // shaderLocation: 0,//这个在function，自动增加计算
    /**
     * 顶点相关的各类数据
     * date of vertex attribute
     * 1、比如:position ,uv,normail,color
     * 1, exp: position ,uv ...
     * 2、也可以自定义，
     * 2, custom attribute exp: custom0, custom1 ...
     */
    data: number[],
    /**
     * 顶点数量 
     * count of vertex
     */
    count: number,
    /**
     * 顶点数据的格式,必须
     * vertex attribute format
     * 
     * 比如："float32x3",GPUBuffer对应ArrayBuffer按照对应的格式建立
     * exp: float32x3, float32x2, uint32x4
     */
    format: GPUVertexFormat,
    /**      
     * 以byte计算 ，比如：xyz=4*3，uv=4*2    
     * by byte ,exp: xyz=4*3 , uv=4*2
     */
    arrayStride: number,
    /**
     * 默认从0开始 
     * default: 0
     */
    offset?: 0,
}
/**
 * 顶点属性的bundle，用于绑定到DC的vertex buffer
 * 1、gltf使用
 */
export interface I_vsGPUBufferBundle {
    buffer: GPUBuffer,
    format: GPUVertexFormat,
    wgslFormat: string,
    name: string,
    arrayStride: number,
    /**
     * 顶点数据在arrayStride中的offset
     * todo: 20260115 在gltf中未实现
     */
    offsetInStride?: number,
    count: number,

    /**
     * 从buffer的offset开始读取数据,比如一个大的GPUBuffer，包括了多个vertex attribute和index attribute，还可能包括uniform数据
     *  from offset to size，exp:one big GPUBuffer, include vertex attribute and index attribute and uniform data
     * default: 0
     */
    offset: number,
    /**
     * bytesize
     * 读取数据的大小，默认=count*arrayStride
     * default: count*arrayStride
     */
    byteSize?: number,
    /**计算包围盒用 */
    min: weVec3,
    max: weVec3,
}
export function isVSGPUBufferBundle(attr: T_vsAttribute): attr is I_vsGPUBufferBundle {
    return (attr as I_vsGPUBufferBundle).buffer && (attr as I_vsGPUBufferBundle).min !== undefined && (attr as I_vsGPUBufferBundle).max !== undefined;
}
/**
 * 索引buffer的bundle，用于绑定到DC的index buffer 。GLTF使用
 * index buffer bundle , used for bind index buffer to DC .gltf use
 */
export interface I_indexGPUBufferBundle {
    buffer: GPUBuffer,
    format: GPUIndexFormat,
    name: string,
    count: number,
    /**
     * 从buffer的offset开始读取数据,比如一个大的GPUBuffer，包括了多个vertex attribute和index attribute，还可能包括uniform数据
     *  from offset to size，exp:one big GPUBuffer, include vertex attribute and index attribute and uniform data
     * default: 0
     */
    byteSize: number,
    /**
     * 读取数据的大小，默认=count*arrayStride
     * default: count*arrayStride
     */
    size?: number,
}
export function isIndexGPUBufferBundle(attr: T_indexAttribute): attr is I_indexGPUBufferBundle {
    return (attr as I_indexGPUBufferBundle).buffer !== undefined;
}

/**
 * 单个vertex的多个属性merge在一起的形式
 * merge vertex attribute
 * 1、一个数组形式，名称不能重复
 * 1, array, exp: position ,uv ,normal ...
 * 2、可以有多个map的，需要保持结构与数量同步，未测试
 * 2, map, exp: {position:0,uv:1,normal:2}
 */
export interface vsAttributeMerge {
    /**单个vertex的多个属性的大数组 
     * attributes in array, exp: position ,uv ,normal ...
    */
    data: number[],
    /**顶点数量 
     * count of vertex
    */
    count: number,
    /**单个vertex属性的总长度
     * array stride of vertex attribute
     */
    arrayStride: number,
    /**
     * 单个vertex属性的合并格式
     * merge attribute format
     */
    mergeAttribute: vsAttributeMergeAttribute[],
    // /**每个vertex的属性的格式 */
    // format: GPUVertexFormat[],

    // /**单个vertex属性的偏移量 */
    // offset: number[],
    // /**每个vertex属性的名称 */
    // names: string[]
}
export function isVsAttributeMerge(attr: T_vsAttribute): attr is vsAttributeMerge {
    return (attr as vsAttributeMerge).mergeAttribute !== undefined;
}
/**
 * 单个vertex属性的合并格式
 * per one attribute format and offset in merge attribute
 */
export interface vsAttributeMergeAttribute {
    name: string,
    format: GPUVertexFormat,
    offset: number
}

/**
 * 顶点属性的类型:三种类型
 */
export type T_vsAttribute = vsAttribute | vsAttributeMerge | number[] | I_vsGPUBufferBundle

export type T_indexAttribute = number[] | I_indexGPUBufferBundle
/**
 * @data    数据部分 
 * @render  渲染参数 
 * @system  系统参数:camera 或 light
 */
export interface IV_DC {

    /**是否包括动态资源在binding group中
     * 默认：false，
     * 如果true，则需要动态绑定资源
     */
    dynamic?: boolean,
    /**
     * 是否透明渲染,包括alpha 透明，物理透明
     */
    transparent?: I_TransparentOptionOfMaterial,
    //没有意义，取消，因为transparent pass 透明渲染是在forward之后，这时候loadOP已经是load模式
    // /**
    //  * 是否透明渲染
    //  * 默认：false;forward pass 透明渲染需要开启
    //  * 如果是true，有2种情况：
    //  * 1、透明的不透明渲染，走的也是forward pass，这时，loadOP需要=load。
    //  * 2、透明的透明渲染，走的是transparent pass
    //  */
    // transparent?: boolean,
    label: string,
    /**
     * ID组,TT使用，用于获取entity的Blend参数
     */
    IDS?: I_DrawCommandIDs,
    data: {
        vertices?: { [name in string]: T_vsAttribute },
        // vertices?: Map<string, T_vsAttribute>,
        vertexStepMode?: GPUVertexStepMode,
        indexes?: T_indexAttribute,//number[] | I_indexGPUBufferBundle,
        /**
         * 1、最多4个bind group；
         * 2、如果有system，system的bindGroup是0，还剩3个；
         * 3、entity的bindGroup占用bindGroup1的位置；
         * 4、如果IV_DC,没有定义system，则uniform不考虑system的BindGroup的问题，即raw模式（NDC）
         */
        uniforms?: T_uniformGroups[],//vs 部分有会 vertex texture
        unifromLayout?: T_BindGroupLayout[],
    },
    render: {
        // code: string,//这里需要进行VS 属性的映射替换
        vertex: {
            /**shader模板 */
            // shaderTemplate?: shaderTemplate,
            code: string | I_ShaderTemplate_Final,
            /**默认："vs" */
            entryPoint: string,
            constants?: Record<string, number>,
        },
        /**
         * 无,则只有VS渲染
         */
        fragment?: {
            /**未定义，则FS和VS代码共用 */
            code?: string | I_ShaderTemplate_Final,
            /**默认："fs" */
            entryPoint: string,
            constants?: Record<string, number>,
            /**
             * 没有，则去scene中获取
             */
            targets?: GPUColorTargetState[],
        },
        drawMode: T_drawMode,
        primitive?: GPUPrimitiveState,
        // multisample?: GPUMultisampleState,
        /**
         * 是否开启深度测试和深度写入
         * 不需要深度测试的（比如没有depth输出等的），需要设置为：false
         */
        depthStencil?: GPUDepthStencilState | false,
        viewport?: I_viewport,
    },
    /**
     * 有system：摄像机或光源模式
     * 没有system：NDC模式
     */
    system?: {
        /**
         * camera可以不设置ID，使用default camera
         */
        UUID?: string,
        type: E_renderForDC,//"camera" | "light"
        MSAA?: T_rpdInfomationOfMSAA,
    },
    /**
     * 父实体，
     * 1、entity的bindGroup占用bindGroup1的位置；
     * 2、如果存在parent，bindgroup和bindgrouplayout通过parent.getBindGroupAndBindGroupLayout()获取
     * 2、如果没有父实体，则entity的bindGroup使用data中的uniform数据生成bindgroup；同时layout 通过cache获取
     */
    parent?: BaseEntity,
    /**
     * 渲染pass的描述符，
     * 1、如果有同级别中的system存在，则安装camera或light，去scene中获取
     * 2、如果没有system：
     *  A、若有本项，则使用
     *  B、没有，则去scene中获取NDC的RPD
     */
    renderPassDescriptor?: GPURenderPassDescriptor | (() => GPURenderPassDescriptor),
    /**
     * 材质 shader模块的名称
     * 1、用于shader module的Map 操作的key
     * 2、如果没有，则不进行Map操作，直接创建使用
     */
    shaderModuleName?: string,

}

export class DrawCommandGenerator {
    device: GPUDevice;
    scene: Scene;
    resources: ResourceManagerOfGPU;
    AA: AA;
    MSAA: boolean;

    /**DrawCommand的输入参数数组 */
    inputDC: IV_DC[] = [];

    clock: Clock;

    constructor(inputValue: IV_DrawCommandGenerator) {
        this.device = inputValue.scene.device;
        this.scene = inputValue.scene;
        this.resources = this.scene.resourcesGPU;
        this.AA = this.scene.AA;
        this.MSAA = this.scene.MSAA;
        this.clock = this.scene.clock;
    }
    clear() {
        console.warn("DrawCommandGenerator.clear() 未实现");
    }
    /**     更新DC的GPU资源     */
    upadate() {
        this.updateUniform();
    }
    /**更新uniform中数据 */

    updateUniform() {
        for (let i of this.inputDC) {//所有的DrawCommand
            if (i.data.uniforms) {//更新uniform，如果有uniform
                let systemFlag = true;
                if (i.system) {
                    systemFlag = true;
                }
                else systemFlag = false
                for (let perGroup of i.data.uniforms) {
                    if (perGroup != undefined && (Array.isArray(perGroup) && perGroup.length > 0))//判断是当前的bindgroup否有uniform
                        for (let perEntry of perGroup)
                            if ("data" in perEntry && "update" in perEntry && perEntry.update === true) {//需要更新,只更新数据
                                if (this.resources.has(perEntry, "uniformBuffer")) {
                                    let buffer: GPUBuffer = this.resources.get(perEntry, "uniformBuffer");
                                    if (buffer) {
                                        updataOneUniformBuffer(this.device, buffer, (perEntry as I_uniformArrayBufferEntry).data)
                                    }
                                    else {
                                        console.warn(i, perGroup, perEntry, "获取uiform对应的GPUBuffer资源获取失败");
                                    }
                                }
                                else {
                                    console.warn(i, perGroup, perEntry, "查询uiform对应的GPUBuffer资源获取失败");
                                }
                            }
                }
            }
        }
    }
    /**
     * 更新uniform 数据的GPUBuffer
     * 1、立即更新模式。（与每帧的update相同，但可以一帧按需更新多次）
     * 2、TTPF需要使用
     * @param perEntry I_uniformArrayBufferEntry
     */
    updateUniformOfGPUBuffer(perEntry: I_uniformArrayBufferEntry) {
        if (this.resources.has(perEntry, "uniformBuffer")) {
            let buffer: GPUBuffer = this.resources.get(perEntry, "uniformBuffer");
            if (buffer) {
                updataOneUniformBuffer(this.device, buffer, (perEntry as I_uniformArrayBufferEntry).data)
            }
            else {
                console.warn(perEntry, "获取uiform对应的GPUBuffer资源获取失败");
            }
        }
        else {
            console.warn(perEntry, "查询uiform对应的GPUBuffer资源获取失败");
        }
    }

    /**
     * 生成DrawCommand
     * @param values 
     * @returns 
     */
    generateDrawCommand(values: IV_DC): DrawCommand {
        this.inputDC.push(values);//保存每个DC的init参数，为了后续的更新uniform使用（如果其中有update选项）
        //1、buffer资源
        let { DC_vertexBuffers, DC_indexBuffer, DC_vertexNames, DC_localtions, DC_verticesBufferLayout } = this.initVertexPart(values);

        //2、bindgroup部分
        let { DC_bindGroups, DC_bindGroupLayouts } = this.initUniformPart(values);

        //3、shadermodel 编译

        let { vertex, fragment } = this.initShaderModel(values, DC_vertexNames, DC_localtions, DC_verticesBufferLayout);

        //4、pipeline 部分
        let pipeline = this.initPipeLine(values, vertex, fragment, DC_bindGroupLayouts);

        //4、GPURenderPassDescriptor
        let renderPassDescriptor = () => {
            let renderPassDescriptor: GPURenderPassDescriptor;
            //1、如果有rpd描述。
            if (values.renderPassDescriptor != undefined && typeof values.renderPassDescriptor != "function") {
                renderPassDescriptor = values.renderPassDescriptor;
            }
            //2、如果有rpd函数。
            else if (values.renderPassDescriptor != undefined && typeof values.renderPassDescriptor == "function") {
                renderPassDescriptor = values.renderPassDescriptor();
            }
            //3\ 增加一个MSAA 的NDC
            else if (this.scene.finalTarget.NDC == true && values.system?.MSAA) {
                // if (values.system?.MSAA)
                renderPassDescriptor = this.scene.getRenderPassDescriptorForNDC();
            }
            //4、如果没有rpd描述，且有system。
            else if (values.system && values.renderPassDescriptor == undefined) {
                let UUID = this.checkUUID(values);
                if (UUID) {
                    if (this.MSAA) {
                        if (values.system.MSAA != undefined)
                            renderPassDescriptor = this.scene.getRenderPassDescriptor(UUID, values.system.type, values.system.MSAA);
                        else
                            throw new Error("MSAA渲染,需要在system中指定MSAA");
                    }
                    else
                        renderPassDescriptor = this.scene.getRenderPassDescriptor(UUID, values.system.type);
                }
                else {
                    this.errorUUID();// throw new Error("获取UUID失败");
                }
            }
            //5、NDC，raw模式
            else {
                renderPassDescriptor = this.scene.getRenderPassDescriptorForNDC();
            }
            return renderPassDescriptor!;
        }

        //5、传参，生产DC
        let commandOption: IV_DrawCommand = {
            scene: this.scene,
            device: this.device,
            pipeline,
            vertexBuffers: DC_vertexBuffers,
            drawMode: values.render.drawMode,
            label: values.label,
            uniform: DC_bindGroups,
            renderPassDescriptor,
            // dynamic: values.dynamic || false,
        }
        //5.1 为了适配动态增加光源后的阴影贴图的动态更新。
        //在BaseDrawCommand.doEncoder()中，会动态绑定system0
        if (values.system) {
            let UUID = this.checkUUID(values);
            if (UUID) {
                commandOption.system = {
                    UUID,
                    type: values.system.type,
                }
            }
        }
        //5.2 传输ID
        if (values.IDS) {
            commandOption.IDS = values.IDS;
        }
        //5.3 传输transparentType。（20251206 未在DC中发现具有使用情况，应该是早期参数，暂时保留）
        if (values.transparent) {
            if (values.transparent.type) {
                commandOption.transparentType = values.transparent.type;
            }
        }
        //5.4 viewport
        if (values.render.viewport) commandOption.viewport = values.render.viewport;
        let camera = this.getCamera(values);
        if (camera) {
            commandOption.viewport = camera.viewport;
        }
        //5.5 动态bindGroup情况，如果dynamicUniform参数，DC会根据dynamicUniform参数，动态绑定bindGroup。
        if (values.dynamic && values.dynamic === true) {
            let layoutNumber = 0;
            if (values.system) {
                layoutNumber = 1;
            }
            commandOption.dynamicUniform = {
                bindGroupLayout: DC_bindGroupLayouts,
                bindGroupsUniform: values.data.uniforms!,
                layoutNumber: layoutNumber,
            };
        }
        //5.6 indexBuffer
        if (DC_indexBuffer) {
            commandOption.indexBuffer = DC_indexBuffer;
            if ("buffer" in values.data.indexes!) {
                commandOption.indexFormat = values.data.indexes.format;
            }
        }
        //5.7 parent 
        if (values.parent) {
            commandOption.parent = values.parent;
        }
        //6 创建DC
        let drawCommand = new DrawCommand(commandOption);
        return drawCommand;
    }

    /**
     * 获取camera从scene中根据UUID
     * @param values 
     * @returns BaseCamera | false
     */
    getCamera(values: IV_DC): BaseCamera | false {
        if (values.system?.type == E_renderForDC.camera) {
            let UUID = this.checkUUID(values);
            if (UUID) {
                let camera = this.scene.cameraManager.getCameraByUUID(UUID);
                if (camera)
                    return camera;
            }
        }
        return false;
    }

    errorUUID() {
        throw new Error("获取UUID失败");
    }
    /**
     * 检查UUID,如果没有UUID，根据system.type，返回默认相机的UUID。
     * @param values IV_DC
     * @returns  string | false
     */
    checkUUID(values: IV_DC): string | false {
        if (values.system) {
            let UUID = values.system.UUID;
            if (values.system.type === E_renderForDC.camera && values.system.UUID == undefined) {//相机没有UUID，默认使用默认相机
                if (this.scene.cameraManager.DefaultCamera)
                    UUID = this.scene.cameraManager.DefaultCamera.UUID;
            }
            if (UUID != undefined)
                return UUID;
            else
                // throw new Error("获取UUID失败,DCG未收到camera UUID,get default camera UUID fail");
                return false;
        }
        return false
    }
    /**
     * VS反射attribute属性到WGSL的结构体中，并按照SHT格式化vs shader代码.
     * @param templateFinal  shader模板
     * @param refName 反射的变量名
     * @param locations 反射的变量location
     * @returns 
     */
    refVSShaderCode(templateFinal: I_ShaderTemplate_Final, refName: string[], locations: string[]): string {
        let groupAndBindingString: string = "";
        let shaderCode: string = "";
        //合并bindingGroupString 和shaderCode
        // for (let i in templateFinal) {
        //     let perPart = templateFinal[i];
        //     for (let i_single in perPart) {
        //         if (i_single == "groupAndBindingString") {
        //             groupAndBindingString += perPart[i_single as keyof typeof perPart];
        //         }
        //         else if (i_single == "templateString") {
        //             shaderCode += perPart[i_single as keyof typeof perPart];
        //         }
        //     }
        // }
        shaderCode = this.convertSHT2ShaderCode(templateFinal);
        //反射attribute
        for (let i in SHT_refDCG) {
            if (i == "replace") {
                for (let perReplace of SHT_refDCG.replace!) {
                    //替换代码
                    if (perReplace.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                        shaderCode = shaderCode.replace(perReplace.replace!, perReplace.replaceCode!);
                    }
                    //替换选择代码
                    else if (perReplace.replaceType == E_shaderTemplateReplaceType.selectCode) {
                        //替换目标是单个字符串
                        if (typeof perReplace.check == "string") {
                            if (refName.indexOf(perReplace.check!) != -1) {
                                shaderCode = shaderCode.replace(perReplace.replace, perReplace.selectCode![1]);
                            }
                            else {
                                shaderCode = shaderCode.replace(perReplace.replace, perReplace.selectCode![0]);
                            }
                        }
                        //替换目标是字符串数组
                        else if (typeof perReplace.check == "object" && Array.isArray(perReplace.check) && (perReplace.check as string[]).length > 0) {
                            let isReplace = false;
                            for (let check of perReplace.check as string[]) {
                                if (refName.indexOf(check) == -1) {
                                    isReplace = false;
                                    break;
                                }
                                else
                                    isReplace = true;
                            }
                            if (isReplace) {
                                //如果是morphTarget，需要特殊处理position数组，WGSL是静态语言，不能在运行时动态计算morphTarget的position数量
                                if (perReplace.replace == "$morphTarget") {
                                    // // 目标生成字符串：var positions :array<vec3f,N>=[attribute.position1,attribute.position2,attribute.position3,...] 
                                    // let positions: string[] = [];
                                    // /**
                                    //  * 遍历refName，将所有position_*属性添加到positions数组中
                                    //  * 虽然是对象，但position_*属性的后续字符是数组，是顺序排列的，所以可以直接添加到positions数组中
                                    //  */
                                    // for (let i = 0; i < refName.length; i++) {
                                    //     if (refName[i].indexOf("position_") != -1) {
                                    //         positions.push("attribute." + refName[i]);
                                    //     }
                                    // }
                                    // let positionsString: string = positions.join(",");
                                    // let preCode: string = `\n var positions :array<vec3f,${positions.length}>=[$positionsString]; \n`;
                                    // shaderCode = shaderCode.replace(perReplace.replace, preCode + positionsString);
                                }
                                else {
                                    shaderCode = shaderCode.replace(perReplace.replace, perReplace.selectCode![1]);
                                }
                            }
                            else {
                                shaderCode = shaderCode.replace(perReplace.replace, perReplace.selectCode![0]);
                            }
                        }
                    }
                    //替换值值
                    else if (perReplace.replaceType == E_shaderTemplateReplaceType.value) {
                        if (perReplace.name == "refName") {
                            let locationString: string = locations.join("\n");
                            shaderCode = shaderCode.replace(perReplace.replace!, locationString);
                        }
                    }
                }
            }
        }
        return groupAndBindingString + "\n" + shaderCode;
    }
    convertSHT2ShaderCode(templateFinal: I_ShaderTemplate_Final): string {
        let groupAndBindingString: string = "";
        let shaderCode: string = "";
        //合并bindingGroupString 和shaderCode
        for (let i in templateFinal) {
            let perPart = templateFinal[i];
            for (let i_single in perPart) {
                if (i_single == "groupAndBindingString") {
                    groupAndBindingString += perPart[i_single as keyof typeof perPart];
                }
                else if (i_single == "templateString") {
                    shaderCode += perPart[i_single as keyof typeof perPart];
                }
            }
        }
        return groupAndBindingString + "\n" + shaderCode;
    }
    /**
     * 获取attribute的属性格式转换为wgsl的变量格式
     * @param format string
     * @returns string
     */
    getWgslValueFormat(format: string) {
        let wgsl_value_format = "";
        switch (format) {
            /////////////////////////////////////////f32
            case "float32":
                wgsl_value_format = "f32";
                break;
            case "float32x2":
                wgsl_value_format = "vec2f";
                break;
            case "float32x3":
                wgsl_value_format = "vec3f";
                break;
            case "float32x4":
                wgsl_value_format = "vec4f";
                break;
            /////////////////////////////////////////u32
            case "uint32":
                wgsl_value_format = "u32";
                break;
            case "uint32x2":
                wgsl_value_format = "vec2u";
                break;
            case "uint32x3":
                wgsl_value_format = "vec3u";
                break;
            case "uint32x4":
                wgsl_value_format = "vec4u";
                break;
            /////////////////////////////////////////u16
            case "uint16":
                wgsl_value_format = "u16";
                break;
            case "uint16x2":
                wgsl_value_format = "vec2u";
                break;
            case "uint16x4":
                wgsl_value_format = "vec4u";
                break;
            /////////////////////////////////////////i8
            case "uint8":
                wgsl_value_format = "u32";
                break;
            case "uint8x2":
                wgsl_value_format = "vec2u";
                break;
            case "uint8x4":
                wgsl_value_format = "vec4u";
                break;
            /////////////////////////////////////////i32
            case "sint32":
                wgsl_value_format = "i32";
                break;
            case "sint32x2":
                wgsl_value_format = "vec2i";
                break;
            case "sint32x3":
                wgsl_value_format = "vec3i";
                break;
            case "sint32x4":
                wgsl_value_format = "vec4i";
                break;
            /////////////////////////////////////////i16
            case "sint16":
                wgsl_value_format = "i16";
                break;
            case "sint16x2":
                wgsl_value_format = "vec2i";
                break;
            case "sint16x4":
                wgsl_value_format = "vec4i";
                break;
            /////////////////////////////////////////i8
            case "sint8":
                wgsl_value_format = "i32";
                break;
            case "sint8x2":
                wgsl_value_format = "vec2i";
                break;
            case "sint8x4":
                wgsl_value_format = "vec4i";
                break;
            /////////////////////////////////////////unorm16
            case "unorm16":
                wgsl_value_format = "f32";
                break;
            case "unorm16x2":
                wgsl_value_format = "vec2f";
                break;
            case "unorm16x4":
                wgsl_value_format = "vec4f";
                break;
            /////////////////////////////////////////snorm16
            case "snorm16":
                wgsl_value_format = "f32";
                break;
            case "snorm16x2":
                wgsl_value_format = "vec2f";
                break;
            case "snorm16x4":
                wgsl_value_format = "vec4f";
                break;
            /////////////////////////////////////////unorm10-10-10-2
            case "unorm10-10-10-2":
                wgsl_value_format = "vec4f";
                break;
            /////////////////////////////////////////unorm8x4-bgra
            case "unorm8x4-bgra":
                wgsl_value_format = "vec4f";
                break;
            /////////////////////////////////////////f16
            case "float16":
                wgsl_value_format = "f16";
                break;
            case "float16x2":
                wgsl_value_format = "vec2f";
                break;
            case "float16x4":
                wgsl_value_format = "vec4f";
                break;

            default:
                throw new Error("顶点属性格式不能匹配数据");
                break;
        }

        return wgsl_value_format;
    }
    /**
     * 初始化顶点资源
     * 
     * 1、顶点资源
     * 2、索引资源
     * 
     * @param values 
     * @returns  { DC_vertexBuffers, DC_verticesBufferLayout, DC_localtions, DC_vertexNames, DC_indexBuffer }
     */
    initVertexPart(values: IV_DC): {
        DC_vertexBuffers: I_VertexBufferEntry[],
        DC_indexBuffer: GPUBuffer | undefined,
        DC_vertexNames: string[],
        DC_localtions: string[],
        DC_verticesBufferLayout: GPUVertexBufferLayout[],
    } {
        //1、buffer资源
        // 20260114修改为 I_VertexBufferEntry
        let DC_vertexBuffers: I_VertexBufferEntry[] = [];//当前DC的顶点列表。之后在DC中passEncoder.setVertexBuffer(parseInt(i), verticesBuffer)使用。
        let DC_verticesBufferLayout: GPUVertexBufferLayout[] = [];//vertex.buffers[]
        let DC_localtions: string[] = [];//顶点资源的名称列表，反射code中的内容使用
        let DC_vertexNames: string[] = [];//顶点资源的名称列表，反射code中的内容使用
        let DC_indexBuffer: GPUBuffer | undefined;//GPUBuffer默认使用uint32的格式。passEncoder.setIndexBuffer(this.indexBuffer, 'uint32');
        //1.1、顶点资源

        let shaderLocation = 0;//最多16个
        let location_i = 0;
        if (values.data.vertices) {
            // for (const [key, value] of values.data.vertices) {
            for (let key in values.data.vertices) {
                let value = values.data.vertices[key];
                let locationString: string = "";
                let lowKey = key.toLocaleLowerCase();
                let _GPUVertexBufferLayout: GPUVertexBufferLayout;//当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                let vertexBuffer: GPUBuffer;
                //20260114 增加interface I_VertexBufferEntry
                let vertexBufferEntry: I_VertexBufferEntry;
                //标准的数组格式，默认为position等
                if (Array.isArray(value)) {
                    if (value.length == 0) {
                        console.warn("顶点属性" + key + "数据为空");
                    }
                    let data = new Float32Array(value);//默认:float32
                    let arrayStride = 4 * 3;
                    let format: GPUVertexFormat = "float32x3";
                    switch (lowKey) {
                        case "position":
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            break;
                        case "uv":
                            // case "uv1":
                            // case "uv2":
                            arrayStride = 4 * 2;
                            format = "float32x2";
                            break;
                        case "normal":
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            break;
                        case "color":
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            break;
                        case "joints":
                            arrayStride = 4 * 4;
                            format = "float32x4";
                            break;
                        case "weights":
                            arrayStride = 4 * 4;
                            format = "float32x4";
                            break;
                        default:
                            arrayStride = 4 * 3;
                            format = "float32x3";
                            break;
                    }
                    let wgsl_value_format = this.getWgslValueFormat(format);
                    locationString += ` @location(${location_i}) ${lowKey} : ${wgsl_value_format}  ,`;


                    //判断是否以及存在顶点GPUBuffer
                    if (!this.resources.has(value, "vertices")) {
                        vertexBuffer = createVerticesBuffer(this.device, values.label + " vertex GPUBuffer of " + lowKey, data.buffer);
                        this.resources.set(value, vertexBuffer, "vertices");
                    }
                    else {
                        vertexBuffer = this.resources.get(value, "vertices");
                    }
                    vertexBufferEntry = {
                        buffer: vertexBuffer,
                        // offset: 0,
                        // size:data.byteLength,
                    }
                    //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                    _GPUVertexBufferLayout = {
                        arrayStride: arrayStride,
                        attributes: [{
                            shaderLocation: shaderLocation++,
                            format: format,
                            offset: 0,
                        }],
                    };

                }
                //有更多详细的数据说明，来约定顶点数据，例如format,arrayStride,offset等
                else if ("format" in value && "data" in value) {
                    let format: GPUVertexFormat = value.format;
                    let data;//默认:float32
                    let arrayStride = 4 * 3;
                    switch (value.format) {//这里只匹配了几种数据，以后视情况而定
                        case "float32x3":
                            arrayStride = 4 * 3;
                            data = new Float32Array(value.data);
                            break;
                        case "float32x2":
                            arrayStride = 4 * 2;
                            data = new Float32Array(value.data);
                            break;
                        case "float32x4":
                            arrayStride = 4 * 4;
                            data = new Float32Array(value.data);
                            break;
                        case "float32":
                            arrayStride = 4 * 1;
                            data = new Float32Array(value.data);
                            break;
                        case "uint32":
                            arrayStride = 4 * 1;
                            data = new Uint32Array(value.data);
                            break;
                        case "uint32x2":
                            arrayStride = 4 * 2;
                            data = new Uint32Array(value.data);
                            break;
                        case "uint32x3":
                            arrayStride = 4 * 3;
                            data = new Uint32Array(value.data);
                            break;
                        case "uint32x4":
                            arrayStride = 4 * 4;
                            data = new Uint32Array(value.data);
                            break;
                        case "sint32":
                            arrayStride = 4 * 1;
                            data = new Int32Array(value.data);
                            break;
                        case "sint32x2":
                            arrayStride = 4 * 2;
                            data = new Int32Array(value.data);
                            break;
                        case "sint32x3":
                            arrayStride = 4 * 3;
                            data = new Int32Array(value.data);
                            break;
                        case "sint32x4":
                            arrayStride = 4 * 4;
                            data = new Int32Array(value.data);
                            break;
                        default:
                            arrayStride = 4 * 3;
                            data = new Float32Array(value.data);
                            break;
                    }
                    let wgsl_value_format = this.getWgslValueFormat(value.format);
                    locationString += ` @location(${location_i}) ${lowKey} : ${wgsl_value_format}  ,`;
                    //判断是否以及存在顶点GPUBuffer
                    if (!this.resources.has(value, "vertices")) {
                        vertexBuffer = createVerticesBuffer(this.device, values.label + " vertex GPUBuffer of " + lowKey + " format =" + format, data.buffer);
                        this.resources.set(value, vertexBuffer, "vertices");
                    }
                    else {
                        vertexBuffer = this.resources.get(value, "vertices");
                    }
                    vertexBufferEntry = {
                        buffer: vertexBuffer,
                        // offset: 0,
                        // size:data.byteLength,
                    }
                    //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                    _GPUVertexBufferLayout = {
                        arrayStride: arrayStride,
                        attributes: [{
                            shaderLocation: shaderLocation++,
                            format: format,
                            offset: 0,
                        }],
                    }
                }
                //合并属性，例如position和normal合并到一个顶点属性中
                else if (isVsAttributeMerge(value)) {
                    let mergeAttribute = value.mergeAttribute
                    let arrayStride = value.arrayStride;
                    let data = new Float32Array(value.data);
                    let attributes: GPUVertexAttribute[] = [];
                    for (let i in mergeAttribute) {
                        let item = mergeAttribute[i];
                        attributes.push({
                            shaderLocation: shaderLocation++,
                            format: item.format,
                            offset: item.offset,
                        });
                        let wgsl_value_format = this.getWgslValueFormat(item.format);
                        locationString += ` @location(${location_i}) ${item.name.toLowerCase()} : ${wgsl_value_format}  ,`;
                        location_i++;//合并属性，每个属性都要增加一个location
                    }
                    if (!this.resources.has(value, "vertices")) {
                        vertexBuffer = createVerticesBuffer(this.device, values.label + " vertex GPUBuffer of " + lowKey + " format =mergeAttribute", data.buffer);
                        this.resources.set(value, vertexBuffer, "vertices");
                    }
                    else {
                        vertexBuffer = this.resources.get(value, "vertices");
                    }
                    vertexBufferEntry = {
                        buffer: vertexBuffer,
                        // offset: 0,
                        // size:data.byteLength,
                    }
                    _GPUVertexBufferLayout = {
                        arrayStride: arrayStride,
                        attributes,
                    }
                }
                //顶点数据是GPUBuffer数据的
                else if ("format" in value && value.buffer instanceof GPUBuffer) {
                    let format = value.format;
                    let arrayStride = value.arrayStride;
                    let wgsl_value_format = this.getWgslValueFormat(format);
                    locationString += ` @location(${location_i}) ${lowKey} : ${wgsl_value_format}  ,`;
                    vertexBuffer = value.buffer;
                    vertexBufferEntry = {
                        buffer: vertexBuffer,//GPUBuffer
                        offset: value.offset,//当前vertex 数据在GPUBuffer的offset，默认从0开始读取
                        size: value.byteSize,//当前vertex 数据在GPUBuffer的size，默认是全部
                    }
                    _GPUVertexBufferLayout = {
                        arrayStride: arrayStride,
                        attributes: [{
                            shaderLocation: shaderLocation++,
                            format: format,
                            //todo：20260115，还差个stride中的offset
                            offset: value.offsetInStride || 0,//默认从0开始读取，指的是arraystride中的offset
                        }],
                    }
                }
                else {
                    console.warn("顶点属性", key, value, " 不能匹配数据");
                    throw new Error("顶点属性 key, value 不能匹配数据");
                    continue;
                }
                if (values.data.vertexStepMode) {
                    _GPUVertexBufferLayout.stepMode = values.data.vertexStepMode;
                }

                DC_verticesBufferLayout.push(_GPUVertexBufferLayout);      //顺序push顶点Buffer的layout
                DC_localtions.push(locationString);                                  //顺序push顶点名称
                DC_vertexNames.push(key);                                  //顺序push顶点名称

                if (vertexBuffer) {
                    DC_vertexBuffers.push(vertexBufferEntry);             //顺序push顶点Buffer
                }
                else {
                    console.warn("顶点属性", key, value, " 不能匹配数据");
                    throw new Error("顶点属性 key, value 不能匹配数据");
                }
                location_i++;
            }
            //1.2、索引资源
            if (values.data.indexes)
                if (Array.isArray(values.data.indexes)) {
                    if (values.data.indexes && values.data.indexes.length > 0) {
                        let u32Buffer = new Uint32Array(values.data.indexes);
                        if (!this.resources.has(values.data.indexes, "indexes")) {
                            let _indexBuffer = createIndexBuffer(this.device, values.label + " index GPUBuffer", u32Buffer.buffer);
                            this.resources.set(values.data.indexes, _indexBuffer, "indexes");
                        }
                        let index = this.resources.get(values.data.indexes, "indexes");
                        if (index) {
                            DC_indexBuffer = index;
                        }
                    }
                }
                else {
                    let indexBundle = values.data.indexes as I_indexGPUBufferBundle;
                    if (indexBundle) {
                        DC_indexBuffer = indexBundle.buffer;
                    }
                }
        }
        return { DC_vertexBuffers, DC_indexBuffer, DC_vertexNames, DC_localtions, DC_verticesBufferLayout };
    }

    /**
     * 初始化uniform部分
     * @param values 
     * @returns GPUBindGroup[] and GPUBindGroupLayout[]
     */
    initUniformPart(values: IV_DC): {
        DC_bindGroups: GPUBindGroup[],
        DC_bindGroupLayouts: GPUBindGroupLayout[],
    } {
        //2、bindgroup部分

        let DC_bindGroups: GPUBindGroup[] = [];
        let DC_bindGroupLayouts: GPUBindGroupLayout[] = [];
        let layoutNumber = 0;
        //2.1 、获取 BindGroup 0 以及其layout。camera 和light都从各自的体系获得
        if (values.system) {
            let UUID = this.checkUUID(values);
            if (UUID) {
                let { bindGroup, bindGroupLayout } = this.scene.getSystemBindGroupAndBindGroupLayoutForZero(UUID, values.system.type);
                DC_bindGroups.push(bindGroup);
                DC_bindGroupLayouts.push(bindGroupLayout);
                layoutNumber++;
            }
        }
        if (values.parent) {
            let { bindGroup, bindGroupLayout } = values.parent.getBindGroupAndBindGroupLayout();
            DC_bindGroups.push(bindGroup);
            DC_bindGroupLayouts.push(bindGroupLayout);
            layoutNumber++;
        }
        //2.2、创建其他uniforms的BindGroup和BindGroupLayout
        if (values.data.uniforms) {
            for (let i in values.data.uniforms) {
                if (layoutNumber > 3) {
                    console.warn("uniforms 最多只能有4个BindGroup");
                    break;
                }

                let perGroup = values.data.uniforms[i];
                if (perGroup == undefined || (Array.isArray(perGroup) && perGroup.length == 0)) {
                    // console.warn("uniforms 组", i, "为空");
                    continue;
                }
                if (values.data.unifromLayout)
                    if (values.data.unifromLayout[i] == undefined || values.data.unifromLayout[i].length == 0) {
                        console.warn("uniforms layoiut 组[", i, "]的layout为空,与uniform组不匹配");
                        continue;
                    }
                //BindGroup，重点1
                let bindGroup: GPUBindGroup;
                //BindGroupDesc ,重点1->1.1
                let bindGroupDesc: GPUBindGroupDescriptor;
                //BindGroup 的数据入口,主要是buffer的创建需要push,-->1.1.1
                let bindGroupEntry: GPUBindGroupEntry[] = [];



                //BindGroupLayout，重点2
                let bindGroupLayout: GPUBindGroupLayout;
                //BindGroup 的layout 描述，重点2->2.1
                let bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
                    label: `BGLD(${i})(${layoutNumber}) ${values.label}@${this.clock.now}`,
                    // label: values.label +" BGLD: "+ layoutNumber + " time:"+this.clock.now,
                    entries: []
                };
                //BindGroup layout的数据入口  -->2.1.1
                let bindGroupLayoutEntry: GPUBindGroupLayoutEntry[] = [];

                if (isGPUBindGroup(perGroup)) {
                    bindGroup = perGroup;
                    let bindGroupLayoutGet = this.resources.get(bindGroup)!;//是否有对应的layout
                    if (bindGroupLayoutGet) {
                        bindGroupLayout = bindGroupLayoutGet;
                    }
                    else {
                        throw new Error("bindGroupLayout 不存在");
                    };
                }
                else if (!values.dynamic && this.resources.has(perGroup)) {//已经存在bindgroup，比如：同一个mesh中
                    let bindGroupGet = this.resources.get(perGroup);
                    if (bindGroupGet) {
                        bindGroup = bindGroupGet;
                        let bindGroupLayoutGet = this.resources.get(bindGroup)!;//这里没有进行判断，稍后补上
                        if (bindGroupLayoutGet) {
                            bindGroupLayout = bindGroupLayoutGet;
                        }
                        else {
                            throw new Error("bindGroupLayout 不存在");
                            // console.error("bindGroupLayout 不存在");
                        }
                    }
                    else {
                        throw new Error("bindGroup 不存在");
                        // console.error("bindGroup 不存在");
                    }

                }
                else {//不在BindGroup 和BindGroupLayout的记录，创建
                    for (let j in perGroup) {
                        let perEntry = perGroup[j];
                        let perBindGroupLayoutEntry: GPUBindGroupLayoutEntry;
                        //如果传入的参数中有GPUBindGroupLayoutEntry，就从GPUBindGroupLayoutEntry中获取，否则从entriesToEntriesLayout中获取
                        if (values.data.unifromLayout) {
                            perBindGroupLayoutEntry = values.data.unifromLayout[i]![j];         //使用断言，判断在前面已经判断了layout不为空
                            bindGroupLayoutEntry.push(perBindGroupLayoutEntry);
                        }
                        else {
                            /**
                             * 获取perEntry的layout
                             */
                            perBindGroupLayoutEntry = this.resources.entriesToEntriesLayout.get(perEntry) as GPUBindGroupLayoutEntry;//每个entry的layout
                            if (perBindGroupLayoutEntry) {
                                bindGroupLayoutEntry.push(perBindGroupLayoutEntry);
                            }
                            else {
                                // console.warn("bindGroupLayoutEntry 不存在", perEntry);
                                throw new Error("bindGroupLayoutEntry 不存在");
                            }
                        }
                        /**
                         * 创建 uniform data 的 GPUBuffer 并添加到 bindGroupEntry
                         * 其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                        */
                        if (isUniformBufferPart(perEntry)) {
                            if (this.resources.has(perEntry, "uniformBuffer")) {//已有,直接获取，不创建
                                let buffer = this.resources.get(perEntry, "uniformBuffer");
                                if (buffer)
                                    bindGroupEntry.push({
                                        binding: perEntry.binding,
                                        resource: {
                                            buffer
                                        }
                                    });
                            }
                            else {//没有，创建
                                const label = (perEntry as I_uniformArrayBufferEntry).label;
                                let buffer = createUniformBuffer(this.device, label, (perEntry as I_uniformArrayBufferEntry).data);
                                this.resources.set(perEntry, buffer, "uniformBuffer");
                                bindGroupEntry.push({
                                    binding: perEntry.binding,
                                    resource: {
                                        buffer
                                    }
                                });
                            }
                        }
                        //动态 external texture,不做map
                        else if (isDynamicTextureEntryForExternal(perEntry)) {
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
                        //其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                        else {
                            bindGroupEntry.push(perEntry);
                        }
                    }

                    //更新BindGroup 的layout 描述的entry部分
                    bindGroupLayoutDescriptor.entries = bindGroupLayoutEntry;
                    //创建BindGroupLayout
                    bindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);
                    //初始化BindGroup描述
                    bindGroupDesc = {
                        // label: values.label + " BGD:" + layoutNumber + " time:"+this.clock.now,
                        label: `BGD(${layoutNumber})@${this.clock.now} ${values.label}`,
                        layout: bindGroupLayout,
                        entries: bindGroupEntry,
                    }
                    //创建BindGroup
                    bindGroup = this.device.createBindGroup(bindGroupDesc);
                    ///////////////////
                    //增加到资源
                    this.resources.set(perGroup, bindGroup,);
                    this.resources.set(bindGroup, bindGroupLayout);
                }
                DC_bindGroups.push(bindGroup);
                DC_bindGroupLayouts.push(bindGroupLayout);
                layoutNumber++;
            }//end for values.data.uniforms
        }
        return { DC_bindGroups, DC_bindGroupLayouts };
    }
    /**shadermodel 编译
     * 1、反射顶点名称到shader code的顶点属性的占位符中
     * 2、编译VS shader code 到 shader module
     * 3、如果有fragment shader，编译shader module
     * 4、创建GPURenderPipelineDescriptor的vertex部分和fragment部分
     * @param values 
     * @param DC_vertexNames 
     * @param DC_localtions 
     */
    initShaderModel(values: IV_DC, DC_vertexNames: string[], DC_localtions: string[], DC_verticesBufferLayout: GPUVertexBufferLayout[]): {
        vertex: GPUVertexState,
        fragment: GPUFragmentState | undefined,
    } {
        // 3.1 反射顶点名称到shader code的顶点属性的占位符中
        //vertex shader
        let moduleVS: GPUShaderModule
        let shadercode: string;
        if (typeof values.render.vertex.code === "string")
            shadercode = values.render.vertex.code;
        else {
            shadercode = this.refVSShaderCode(values.render.vertex.code, DC_vertexNames, DC_localtions);
        }
        // 测试输出
        // if (values.transparent)
        //     console.log(shadercode);

        //3.2、VS shadermodel 编译
        moduleVS = this.device.createShaderModule({
            label: `vs ${values.label} @${this.clock.now} `,
            code: shadercode,
        });
        //3.3 GPURenderPipelineDescriptor.vertex部分
        let constansVS = {};
        if (values.render.vertex.constants) { constansVS = values.render.vertex.constants; }
        let vertex: GPUVertexState = {
            module: moduleVS,
            entryPoint: values.render.vertex.entryPoint,
            buffers: DC_verticesBufferLayout,
            constants: constansVS,
        }
        //3.4 GPURenderPipelineDescriptor.fragment部分
        let moduleFS: GPUShaderModule;
        let fragment: GPUFragmentState | undefined;
        if (values.render.fragment) {
            // 3.4.1 判断是否是混合shader
            if (values.render.fragment.code == undefined) {
                moduleFS = moduleVS;
            }
            else {
                let codeFS: string;
                let flagFS = "fsCode";
                //如果是字符串,则直接赋值
                if (typeof values.render.fragment.code === "string")
                    codeFS = values.render.fragment.code;
                //如果是I_ShaderTemplate_Final,则需要根据material 生成代码
                else {
                    let FS_SHT = (values.render.fragment.code as I_ShaderTemplate_Final);
                    if (FS_SHT) {
                        codeFS = this.convertSHT2ShaderCode(FS_SHT);
                    }
                    else {
                        throw new Error("fragment code SHT模板中material不能为空");
                    }
                    flagFS = "fs"
                }
                moduleFS = this.device.createShaderModule({
                    label: `${flagFS} ${values.label} @${this.clock.now}`,
                    code: codeFS,
                })
            }
            //3.4.2 配置targets
            let targets: GPUColorTargetState[] = [];
            //如果没有指定targets,则使用默认的targets
            if (values.render.fragment.targets) {
                targets = values.render.fragment.targets;//使用传入参数
            }
            //如果没有指定targets,则使用默认的targets
            else if (values.system && values.render.fragment.targets == undefined) {//获取camera CATs
                let UUID = this.checkUUID(values);
                if (UUID) {
                    if (this.MSAA) {
                        if (values.system.MSAA != undefined)
                            targets = this.scene.getColorAttachmentTargets(UUID, values.system.type, values.system.MSAA);
                        else
                            throw new Error("MSAA渲染,需要在system中指定MSAA");
                    }
                    else
                        targets = this.scene.getColorAttachmentTargets(UUID, values.system.type);
                }
                else
                    // console.error("获取UUID失败");
                    this.errorUUID();
            }
            //3.4.3 透明处理,alpha blend
            if (values.transparent?.type == E_TransparentType.alpha && values.transparent.blend) {
                for (let i = 0; i < values.transparent.blend.length; i++) {
                    targets[i].blend = values.transparent.blend[i];
                }
            }
            // if (values.render.fragment.code) {
            //     if (typeof values.render.fragment.code === "string") {
            //         moduleFS = this.device.createShaderModule({
            //             code: values.render.fragment.code,
            //         })
            //     }
            //     else {
            //         //todo moduleFS  
            //     }
            // }
            // else {
            //     moduleFS = moduleVS;
            // }
            let constansFS = {};
            //3.4.4 配置constants
            if (values.render.fragment?.constants) { constansFS = values.render.fragment.constants; }
            //3.4.5 配置entryPoint
            fragment = {
                module: moduleFS,
                entryPoint: values.render.fragment.entryPoint,
                targets,
                constants: constansFS,
            }
        }

        return { vertex, fragment };
    }
    initPipeLine(values: IV_DC, vertex: GPUVertexState, fragment: GPUFragmentState | undefined, DC_bindGroupLayouts: GPUBindGroupLayout[]): GPURenderPipeline {
        //1、创建GPURenderPipelineDescriptor
        let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: "PipelineLayout@" + this.clock.now + " " + values.label,
            bindGroupLayouts: DC_bindGroupLayouts,
        }
        //2、创建GPUPipelineLayout
        let pipelineLayout = this.device.createPipelineLayout(pipelineLayoutDescriptor);
        let descriptor: GPURenderPipelineDescriptor = {
            label: "Pipeline@" + this.clock.now + " " + values.label,
            vertex,
            layout: pipelineLayout,
        }
        //3、GPURenderPipelineDescriptor.其他部分
        if (fragment) descriptor.fragment = fragment;
        if (values.render.primitive) descriptor.primitive = values.render.primitive;
        if (this.MSAA && values.system && values.system.MSAA == "MSAA") {
            descriptor.multisample = {
                count: 4,
            }
        }
        //4、TTP 没有使用depth，因为需要copy深度纹理或多一个深度纹理；TTPF,目前不使用depthStencil
        if (values.render.depthStencil !== false) {
            //如果有depthStencil输入，就使用它
            if (values.render.depthStencil) {
                descriptor.depthStencil = values.render.depthStencil;
            }
            else {
                if (values.transparent)//透明渲染，使用透明模板
                    descriptor.depthStencil = this.scene.depthMode.depthStencilTT;
                else {
                    //MSAA渲染，分成两种情况
                    if (this.MSAA) {
                        //MSAAinfo 渲染，使用深度模板(开启测试，不写入) 
                        if (values.system && values.system.MSAA == "MSAAinfo") {
                            descriptor.depthStencil = this.scene.depthMode.depthStencilMSAAinfo;
                        }
                        //MSAA 渲染，使用深度模板(开启测试，写入) 
                        else {
                            descriptor.depthStencil = this.scene.depthMode.depthStencilMSAA;
                        }
                    }
                    //非MSAA渲染，使用深度模板(开启测试，写入) 
                    else {
                        descriptor.depthStencil = this.scene.depthMode.depthStencil;
                    }
                }
            }
        }


        //3.6 生产pipeline
        let pipeline: GPURenderPipeline = this.device.createRenderPipeline(descriptor);

        return pipeline;
    }

}

