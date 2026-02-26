/**
 * @author bythesword
 * @date 2026-01-15
 * @description 
 *  一、todo:
 *      1、gltf accessor中的vertex数据和vertex spares中的类型u8,i8,u16,i16的VEC3数据的重构未验证
 *      2、vertex 数据中stride中存在offset的实现，即数据为一个stride中包括： position+uv+noraml，每个属性有不同的stride中的offset
 *      3、normal的重建计算。
 *              A、non-indexed的normal重建计算：每个三角形一个normal，顶点使用面法线。
 *              B、indexed的normal重建计算：1、计算每个三角形，顶点使用三角形法线；2，将所有顶点的相同normal合并，取平均。
 */
import { Clock } from "../../core/scene/clock";
import { BaseModel, I_Model, T_ModelResKind } from "../../core/model/BaseModel";
import { load } from '@loaders.gl/core';
import { DracoLoader } from "@loaders.gl/draco";
import { GLB, GLTF, GLTFAccessor, GLTFBufferView, GLTFImage, GLTFLoader, GLTFMaterial, GLTFNode, GLTFSampler, GLTFScene, GLTFTexture, GLTFWithBuffers } from '@loaders.gl/gltf';
import { GLBLoader } from '@loaders.gl/gltf';
import { IV_Node, IV_NodeSpace, newNode, NodeInstance, NodeInstanceModel, NodeObject, RootGPU } from "../../core/organization/root";
import { cloneBufferSource, createCommonGPUBuffer, createIndexBuffer, createUniformBuffer, createVerticesBuffer } from "../../core/command/baseFunction";
import { I_indexGPUBufferBundle, I_vsGPUBufferBundle, T_indexAttribute } from "../../core/command/DrawCommandGenerator";
import { IV_MeshEntity, Mesh } from "../../core/entity/mesh/mesh";
import { IV_PointsEntity, Points } from "../../core/entity/mesh/points";
import { IV_LinesEntity, Lines } from "../../core/entity/mesh/lines";
import { I_TextureWithChanneAndNumberlForPBR, I_TextureWithChanneAndVec3lForPBR, IV_PBRMaterial, PBRMaterial } from "../../core/material/PBR/PBRMaterial";
import { I_drawMode, I_drawModeIndexed, T_BindGroupLayout, T_uniformGroups } from "../../core/command/base";
import { ColorMaterial } from "../../core/material/standard/colorMaterial";
import * as BaseFunction from "./function";
import { BaseEntity } from "../../core/entity/baseEntity";
import { weVec3, weVec4 } from "../../core/base/coreDefine";
import { mat4 } from "wgpu-matrix";
import { VertexColorMaterial } from "../../core/material/standard/vertexColorMaterial";
import { Texture } from "../../core/texture/texture";
import { E_TextureChannel } from "../../core/texture/base";
import { TextureMaterial } from "../../core/material/standard/textureMaterial";
import { E_accessorUseFor, T_accessorBufferSource } from "./base";
import { BaseTexture } from "../../core/texture/baseTexture";
import { BaseMaterial } from "../../core/material/baseMaterial";


////////////////////////////////////////////////////////////////////////////////////////
/**
 * GLTF外部图像类型:copy from @loaders.gl/gltf/src/lib/types/gltf-types.ts
 */
type ImageDataType = {
    data: Uint8Array;
    width: number;
    height: number;
    compressed?: boolean;
};
type ImageType = ImageBitmap | ImageDataType | HTMLImageElement;
type GLTFExternalImage = ImageType | {
    compressed: true;
    mipmaps: false;
    width: number;
    height: number;
    data: Uint8Array;
};
////////////////////////////////////////////////////////////////////////////////////////

export interface I_GLTFModel extends I_Model {
    type: "gltf" | "glb",
    data: GLTFWithBuffers | GLB,
}
export async function createGLTFModel(input: I_Model): Promise<GLTFModel> {
    let type: "gltf" | "glb";
    let data: GLTFWithBuffers | GLB;
    if (input.url.indexOf(".gltf") != -1) {
        type = "gltf";
        data = await load(input.url, GLTFLoader, { DracoLoader, decompress: true });
    }
    else if (input.url.indexOf(".glb") > -1) {
        type = "glb";
        data = await load(input.url, GLBLoader, { DracoLoader, decompress: true });
    }
    else {
        throw new Error("GLTFModel: unknown file type");
    }
    let inputValue = input as I_GLTFModel;
    inputValue.type = type;
    inputValue.data = data;
    let gltf = new GLTFModel(inputValue);
    await gltf.initData();


    return gltf;
}


export class GLTFModel extends BaseModel {
    modelData: GLTFWithBuffers | GLB;
    url: string;
    gltfType: "gltf" | "glb";
    // scenes: any[] = [];
    // nodes: any[] = [];

    // modelGltfBuffers: any[] = [];
    modelAccessors: T_accessorBufferSource[] = [];
    /** gltf当前场景索引 */
    currentScene: number = 0;
    gltfJson!: GLTF;

    modelRes: {
        [key: string]: Map<any, any>;
    } = {
            "GPUBuffers": new Map<any, GPUBuffer>(),
            /**
             * 采样器
             */
            "sampler": new Map<any, GPUSampler>(),
            /**
             * 采样器绑定类型
             * 1、key 必须与sampler的key保持一致 
             * 2、GPUSamplerBindingType": new Map<any, GPUSamplerBindingType>(),
            */
            "GPUSamplerBindingType": new Map<any, GPUSamplerBindingType>(),
            "GPUTexture": new Map<any, GPUTexture>(),
            /**
             * 访问器，gltf
             */
            "accessor": new Map<any, any>(),
            "texture": new Map<any, BaseTexture>(),
            "material": new Map<any, BaseMaterial>(),
            "entity": new Map<any, BaseEntity>(),
            "animation": new Map<any, any>(),
        };

    constructor(input: I_GLTFModel) {
        super(input);
        this.gltfType = input.type;
        this.url = input.url;
        if (input.name) {
            this._name = input.name;
        }
        this.modelData = input.data;
        this.scene = input.scene;
        this.device = input.scene.device;
    }
    /**detachData
     * 初始化模型数据,
     * 1. 解析模型数据,GPUBuffer(attributes),GPUTexture,image,
     * 2. 初始化模型数据,meshes,materials,animations,cameras
     * 3. 初始化模型数据,
     */
    async initData() {
        if (this.gltfType == "gltf") {
            this.gltfJson = (this.modelData as GLTFWithBuffers).json;
            // this.modelGltfBuffers = (this.modelData as GLTFWithBuffers).buffers;
        }
        else if (this.gltfType == "glb") {
            this.gltfJson = ((this.modelData as GLB).json as GLTF);
            // this.modelGltfBuffers = (this.modelData as GLB).binChunks;
        }
        this.initBufferViews();
        // this.initAccessors();//改为，获取accessor数据并按需创建GPUBuffer
        await this.initGPUTextures();
        this.initSamplers();
        await this.initTextures();
        this.initMaterials();
        await this.initMeshes();
        this.initCameras();
        // this.initNodes();
        this.initAnimations();
        // this.initScene();
    }
    _destroy(): void {
    }
    /**
     * 释放模型原始资源
     */
    detachData(): void {
        throw new Error("Method not implemented.");
    }

    updateSelf(clock: Clock): void {
        //1、更新mesh的update，按照node tree
    }
    /**
     * 初始化模型节点
     * 1、被parent的addChild调用
     * 2、调用initScene初始化场景
     * @param parent 父节点
     * @param attachValue 节点空间属性
     * @returns 场景节点实例
     */
    async initInstance(parent: NodeObject, attachValue?: IV_NodeSpace): Promise<NodeInstanceModel> {
        let nodeOfScene: NodeInstanceModel = await this.initScene(parent, this.currentScene, attachValue);
        return nodeOfScene;
    }
    async readyForGPU(): Promise<any> {
        //已经在new时传入了GPUDevice，不需要再进行ready工作。
    }
    /**
     * 初始化场景，主入口。
     * 1、gltf会新建一个node object作为场景节点，并返回
     * 2、根据场景索引，初始化场景中的节点
     * 3、初始化节点是递归操作（包括camera）
     * 4、如果有animation，则在新的Node Object上初始化animation，并注册到animationManager
     * 5、如果有animation，则在新的Node Object上初始化animation group，并注册到animationGroupManager
     * @param id 场景索引
     * @param attachValue 节点空间属性
     * @returns 场景节点实例
     */
    async initScene(parent: NodeObject, id: number = 0, attachValue?: IV_NodeSpace): Promise<NodeInstanceModel> {
        let nodeOfScene: NodeInstanceModel = new NodeInstanceModel(attachValue);   //创建node object
        await nodeOfScene.init(this.scene, parent);         // 初始化node object
        nodeOfScene._modelOrigin = this;
        nodeOfScene._name = "gltf scene " + nodeOfScene.ID;

        let scene: GLTFScene = this.getSceneByIndex(id);
        if (scene == undefined) {
            throw new Error(`scene ${id} not found`);
        }
        let nodes: number[] = [];
        if (scene.nodes != undefined) {
            nodes = scene.nodes as number[];
        }
        else {
            throw new Error(`scene ${id} not found nodes`);
        }
        this.currentScene = id;
        /**
         *  push mesh to children
         */
        for (let nodeID of nodes) {
            await BaseFunction.addChildMesh(this, nodeID, nodeOfScene);
        }
        return nodeOfScene;
    }
    getSceneByIndex(index: number = 0): GLTFScene {
        if (this.gltfJson.scenes == undefined) {
            throw new Error(`gltf not found scenes`);
        }
        return this.gltfJson.scenes[index];
    }
    /**
     * 注销场景
     * 1、注销所有实体和camera
     * 
     * 用途：
     * 1、在场景切换时，注销当前场景的所有实体和camera
     * 2、不适用在gltf的销毁时，gltf的注销有RootGPU的destroy方法实现
     */
    destroyScene() {
        for (let child of this.children) {
            if (child instanceof RootGPU) {//scene中的camera,也会被注销
                child.destroy();
            }
        }
    }
    /**
     * 获取Buffer
     * @param bufferView 
     * @returns  {
        byteOffset: number,  buffer的offset
        byteLength: number,  buffer的长度
        arrayBuffer: ArrayBuffer;
    }
     */
    getBufferByID(bufferID: number): {
        byteOffset: number,
        byteLength: number,
        arrayBuffer: ArrayBuffer;
    } {
        if (this.gltfType == "glb") {
            return (this.modelData as GLB).binChunks[bufferID];
        }
        else// if (this.gltfType == "gltf") {
        {
            return (this.modelData as GLTFWithBuffers).buffers[bufferID];
        }
    }
    /**
     * 获取BufferView对应的Buffer
     * @param bufferViewID 
     * @returns {
     * 
        byteOffset: number,  两层offset相加后的offset
        
        byteLength: number,  bufferView的长度

        arrayBuffer: ArrayBuffer;
    } 
     */
    getBufferByBufferViewID(bufferViewID: number): {
        byteOffset: number,
        byteLength: number,
        arrayBuffer: ArrayBuffer;
    } {
        if (this.gltfJson.bufferViews == undefined) {
            throw new Error(`gltf not found bufferViews`);
        }
        let bufferView: GLTFBufferView = this.gltfJson.bufferViews[bufferViewID];
        let buffer = this.getBufferByID(bufferView.buffer);
        return {
            byteOffset: buffer.byteOffset + (bufferView.byteOffset || 0),
            byteLength: bufferView.byteLength,
            arrayBuffer: buffer.arrayBuffer,
        };
    }
    /**
     * 初始化bufferViews,创建GPUBuffer
     * 1、accessor 中type为：SCALAR|VEC3,且componentType为：5120|5121|5122|5123 ,即（sint8|uint8|sint16|uint16）。需要将其转换为u32x3。
     */
    initBufferViews() {
        let imagesInBufferView = this.checkImagesInBufferview();
        if (this.gltfJson.bufferViews)
            for (let i in this.gltfJson.bufferViews) {
                if (imagesInBufferView.indexOf(Number(i)) != -1) continue;
                let bufferView: GLTFBufferView = this.gltfJson.bufferViews[i];
                console.log(i, bufferView);
                if (i == "5") {
                    let abc = 1
                }

                let buffer = this.getBufferByID(bufferView.buffer);     //获取buffer
                let gpuBuffer = createCommonGPUBuffer(this.device, bufferView.name || i, buffer.arrayBuffer, (bufferView.byteOffset || 0) + buffer.byteOffset, bufferView.byteLength);
                this.modelRes.GPUBuffers.set(Number(i), gpuBuffer);
            }
    }
    /**
     * 检查images是否在bufferView中。
     * 1、检查images是否在bufferView中,返回包含image的bufferViewID数组
     * 2、initBufferViews(),如果在,则不需要创建GPUBuffer
     * @returns 包含image的bufferViewID数组
     */
    checkImagesInBufferview(): number[] {
        let imagesInBufferView: number[] = [];
        if (this.gltfJson.images)
            for (let i in this.gltfJson.images) {
                let imageView = this.gltfJson.images[i];
                if (typeof imageView.bufferView == "number") {
                    imagesInBufferView.push(imageView.bufferView);
                }
            }
        return imagesInBufferView;
    }
    /**
     * 获取GPUBuffer：获取对应的GPUBuffer.number id 、bufferViewID+"_webgpu"和 alias id（accessorID+"_xxx"）三种格式
     * 1、如果有,则返回对应的GPUBuffer；
     *      A、优先返回bufferViewID+"_webgpu" 对应的gpubuffer；
     *      B、numberID 和 aliaseID 不冲突，同等对待
     *      C、如果alias 和 bufferViewID 都没有,则返回undefined。
     * 2、bufferViewID对应三种形式
     *      A、bufferViewID     
     *      B、webgpu alias：bufferViewID+"_webgpu"
     *      C、特殊的 accessor alias 对应，比如sparse accessor(名称特殊，由使用者决定)。
     
     */
    getGPUBufferFromRES(bufferViewID: number | string): GPUBuffer | undefined {
        let id = bufferViewID;
        if (this.modelRes.GPUBuffers.has(id + "_webgpu")) {
            id += "_webgpu";
        }
        if (this.modelRes.GPUBuffers.has(id)) {
            let gpuBuffer = this.modelRes.GPUBuffers.get(id);
            if (gpuBuffer) {
                return gpuBuffer;
            }
            else {
                throw new Error(`GPUBuffer ${id} not found `);
            }
        }
        return undefined;
    }
    /**
     * 设置GPUBuffer别名
     * 1、不包括numberID,numberID对应GPUBuffer在this.initBufferViews()中已经建立;
     * 2、 两种情况：
     *      A、alias：bufferViewID+"_webgpu"，将bufferViewID 对应的GPUBuffer 别名设置为 bufferViewID+"_webgpu"
     *      B、特殊的accessor对应，比如sparse accessor。
     * @param bufferViewID 
     * @param gpuBuffer 
     */
    setGPUBufferAliasToRES(bufferViewID: string, gpuBuffer: GPUBuffer) {
        this.modelRes.GPUBuffers.set(bufferViewID + "_webgpu", gpuBuffer);
    }

    /**
     * 获取accessor数据
     * 1、 accessorID 为 accessor资源的ID。
     * 2、判断map中是否有，没有则调用generateAccessor()生成。
     * @param accessorID accessor资源的ID
     * @param useFor accessor 资源的使用模式
     * @returns accessorBufferSource
     */
    async getAccessor(accessorID: number, useFor: E_accessorUseFor): Promise<T_accessorBufferSource> {
        let generate: boolean = false;
        let accessor = this.modelRes.accessor.has(accessorID);
        if (accessor) {
            generate = false;
        }
        else {
            generate = true;
        }
        // }

        if (generate) {
            return await this.generateAccessor(accessorID, useFor);
        }
        else {
            return this.modelRes.accessor.get(accessorID);
        }
    }
    /**
     * 生成 accessor数据
     * 1、accessor资源具有多种属性：index data，vertex attribute，uniform，interpolate...
     * 2、按需获取并写入到accessors资源中。
     *   （统一initAccessors，需要确认数据的属性（顶点，indx，矩阵，插值...）和使用模式（cpu|gpu）,需要遍历数据，不方便。改为按需获取并创建）
     * 3、对应accessor的资源情况
     *      A、index、vertex、uniform数据是GPUBuffer
     *      B、目前插值等数据是CPU端的，为了先保障正确性。后期再考虑GPU端计算的问题（估计会比较远了）
     *      C、GPUBuffer资源如果不适配webgpu，则新建别名资源。通过map.has()判断;按照情况使用aliaseID或accessorID;
     *      D、CPU数据根据场景与定义的格式而定。
     * 4、最后，返回accessorBufferSource并写入accessors资源中。
     * 
     */
    async generateAccessor(accessorID: number, useFor: E_accessorUseFor): Promise<T_accessorBufferSource> {
        if (!this.gltfJson.accessors) {
            throw new Error(`GLTFModel: accessor ${accessorID} not found`);
        }
        let accessor: GLTFAccessor = this.gltfJson.accessors[accessorID];
        let bufferView: GLTFBufferView;
        // 检查accessor是否有bufferView
        //todo check ： gltf文档中 bufferView 不是必须的
        if (accessor.bufferView != undefined && this.gltfJson.bufferViews)
            bufferView = this.gltfJson.bufferViews[accessor.bufferView];
        else {
            throw new Error(`GLTFModel: accessor ${accessorID} bufferView not found`);
        }
        //输出值：accessorBufferSource
        let accessorBufferSource: T_accessorBufferSource;
        // index 数据
        // if ((bufferView.target && bufferView.target == 34963) || useFor == E_accessorUseFor.index) {
        if (useFor == E_accessorUseFor.indexTriangleList || useFor == E_accessorUseFor.indexTriangleStrip
            || useFor == E_accessorUseFor.indexLineList || useFor == E_accessorUseFor.indexLineStrip
            || useFor == E_accessorUseFor.indexPointList
        ) {
            //获取对应的GPUBuffer.number id 、 bufferViewID+"_webgpu" 两种情况；alias id 的情况在具体场景中，再次调用以确定是否存在。
            let gpuBuffer = this.getGPUBufferFromRES(accessor.bufferView);
            accessorBufferSource = {
                buffer: gpuBuffer,
                format: BaseFunction.getAccessorTypeForGPUIndexFormat(accessor),
                name: accessor.name || accessorID.toString(),
                // arrayStride: g;tfGetAccessorByteStride(accessor),
                count: accessor.count,
                /**
                 * 从buffer的offset开始读取数据,比如一个大的GPUBuffer，包括了多个vertex attribute和index attribute，还可能包括uniform数据
                 *  from offset to size，exp:one big GPUBuffer, include vertex attribute and index attribute and uniform data
                 * default: 0
                 */
                offset: accessor.byteOffset,
                byteSize: BaseFunction.getAccessorSize(accessor, bufferView).bytesize,
            } as I_indexGPUBufferBundle;
        }
        else if (useFor == E_accessorUseFor.indexLineLoop) {
            let aliasIdOfAccessor = accessor.bufferView + "_accessor_LineLoop2List";
            if (this.modelRes.accessor.has(aliasIdOfAccessor)) {
                accessorBufferSource = this.modelRes.accessor.get(aliasIdOfAccessor);
            }
            else {
                let aliasIdOfBufferView = accessor.bufferView + "_webgpu";// bufferview(index buffer) 增加alias，后续若有其他accessor使用，直接从map中获取即可。
                let countsOfList = accessor.count * 2;
                let gpuBuffer = this.getGPUBufferFromRES(aliasIdOfBufferView);
                if (gpuBuffer == undefined) {
                    let oldIndexBuffer: Uint16Array | Uint32Array = this.getBufferSourceForAccessor(accessor) as Uint16Array | Uint32Array;
                    let newIndexBuffer = BaseFunction.convertLineIndexLoopToList(oldIndexBuffer, accessor.count);
                    gpuBuffer = createCommonGPUBuffer(this.device, bufferView.name || aliasIdOfBufferView, newIndexBuffer, 0, newIndexBuffer.byteLength);
                    this.setGPUBufferAliasToRES(aliasIdOfBufferView, gpuBuffer);
                }
                accessorBufferSource = {
                    buffer: gpuBuffer,
                    format: "uint32",//转换后都采用uint32
                    name: accessor.name || accessorID.toString(),
                    count: countsOfList,
                    offset: 0,
                    byteSize: countsOfList * 4,//每个index 4字节,u32
                } as I_indexGPUBufferBundle;
            }
        }
        else if (useFor == E_accessorUseFor.indexTriangleFan) {
            let aliasIdOfAccessor = accessor.bufferView + "_accessor_TriangleFan2List";
            if (this.modelRes.accessor.has(aliasIdOfAccessor)) {
                accessorBufferSource = this.modelRes.accessor.get(aliasIdOfAccessor);
            }
            else {
                let aliasIdOfBufferView = accessor.bufferView + "_webgpu";// bufferview(index buffer) 增加alias，后续若有其他accessor使用，直接从map中获取即可。
                let countsOfList = (accessor.count - 2) * 3;
                let gpuBuffer = this.getGPUBufferFromRES(aliasIdOfBufferView);
                if (gpuBuffer == undefined) {
                    let oldIndexBuffer: Uint16Array | Uint32Array = this.getBufferSourceForAccessor(accessor) as Uint16Array | Uint32Array;
                    let newIndexBuffer = BaseFunction.convertTriangleIndexFanToList(oldIndexBuffer, accessor.count);
                    gpuBuffer = createCommonGPUBuffer(this.device, bufferView.name || aliasIdOfBufferView, newIndexBuffer, 0, newIndexBuffer.byteLength);
                    this.setGPUBufferAliasToRES(aliasIdOfBufferView, gpuBuffer);
                }
                accessorBufferSource = {
                    buffer: gpuBuffer,
                    format: "uint32",//转换后都采用uint32
                    name: accessor.name || accessorID.toString(),
                    count: countsOfList,
                    offset: 0,
                    byteSize: countsOfList * 4,
                } as I_indexGPUBufferBundle;
            }
        }
        // vertex 数据
        else if (((bufferView.target == 34962) || useFor == E_accessorUseFor.vertex) && accessor.sparse === undefined) {
            //获取对应的GPUBuffer.number id 、 bufferViewID+"_webgpu" 两种情况；alias id 的情况在具体场景中，再次调用以确定是否存在。
            let gpuBuffer = this.getGPUBufferFromRES(accessor.bufferView);
            let sizes = BaseFunction.getAccessorSize(accessor, bufferView);
            let byteSize = sizes.bytesize;
            let arrayStride = sizes.byteStride;            // let arrayStride = BaseFunction.getAccessorByteStride(accessor, bufferView);
            //获取对应的wgsl的format
            const { format, wgslFormat } = BaseFunction.getAccessorTypeForGPUVertexFormat(accessor);
            // let buffer = this.modelGPUBuffers[accessor.bufferView]
            let reBuildBuffer = BaseFunction.checkRebulidBufferForVec3(accessor);
            // 检查是否需要新构建buffer
            if (reBuildBuffer) {
                /**
                 * todo:20260115,此部分代码修改了，未验证。下面的sparse中的未修改，参考验证
                 * 目前未涉及需要vec3u类型的情况,并且是u8,i8,u16,i16的顶点数据
                 */
                const oldBuffer = this.getBufferSourceForAccessor(accessor);
                // 新构建buffer
                let countsOfVec3 = sizes.count;//count of vec3
                byteSize = countsOfVec3 * 12;//每个vec3 占用4字节,u32类型，so byteSize = countsOfVec3 * vec3u(4*3)
                // 重新确认 map 中是否存在_webgpu别名，没有，则新建一个GPUBuffer
                gpuBuffer = this.getGPUBufferFromRES(accessor.bufferView + "_webgpu");
                if (gpuBuffer === undefined) {
                    let newBuffer = new ArrayBuffer(byteSize);
                    let newBufferView = new Uint32Array(newBuffer);
                    for (let j = 0; j < countsOfVec3 * 3; j++) {
                        newBufferView[j] = oldBuffer[j];
                    }
                    gpuBuffer = createCommonGPUBuffer(this.device, bufferView.name || accessorID.toString(), newBuffer, 0, newBuffer.byteLength);
                    // 设置GPUBuffer别名
                    this.setGPUBufferAliasToRES(accessorID.toString(), gpuBuffer);
                }
            }
            accessorBufferSource = {
                buffer: gpuBuffer,
                format: format,
                wgslFormat: wgslFormat,
                name: accessor.name || accessorID.toString(),
                arrayStride: arrayStride,
                count: accessor.count,
                /**
                 * 从buffer的offset开始读取数据,比如一个大的GPUBuffer，此顶点数据收从offset开始，每个元素占用arrayStride字节
                 * default: 0
                 */
                offset: accessor.byteOffset,
                // offsetInStride: accessor.byteOffset,
                // offset:0,
                byteSize: byteSize,
                min: accessor.min,
                max: accessor.max,
            } as I_vsGPUBufferBundle;
        }
        //spares 数据
        else if (accessor.sparse) {
            let aliaseID = accessorID + "_sparse";
            // 确认 map 中是否存在 accessor 别名，没有，则新建.
            if (this.modelRes.accessor.has(aliaseID)) {
                accessorBufferSource = this.modelRes.accessor.get(aliaseID);
            }
            else {
                // 确认 map 中是否存在 sparse 别名，没有，则新建一个GPUBuffer
                let gpuBuffer = this.getGPUBufferFromRES(aliaseID);
                const { format, wgslFormat } = BaseFunction.getAccessorTypeForGPUVertexFormat(accessor);// webGPU的属性格式和wgsl中的格式
                let arrayStride = BaseFunction.getAccessorByteStride(accessor, bufferView);// 访问器的字节步长，每个元素占用的字节数
                let size = BaseFunction.getAccessorSize(accessor, bufferView).bytesize;// 访问器的元素数量：数量*组件构成数量
                let reBuildBuffer = BaseFunction.checkRebulidBufferForVec3(accessor);// 检查是否需要新构建buffer
                //sparse
                let bufferAttribute: ArrayBuffer;
                // 检查是否需要新构建buffer
                if (reBuildBuffer) {//里面有accessorBufferSource相关参数更新
                    const oldBuffer = this.getBufferSourceForAccessor(accessor);
                    // 新构建buffer
                    let countsOfVec3 = oldBuffer.byteLength * 4;
                    if (accessor.componentType == 5122 || accessor.componentType == 5123) {
                        countsOfVec3 = oldBuffer.byteLength * 2;
                    }
                    let newBuffer = new ArrayBuffer(countsOfVec3);
                    let newBufferView = new Uint32Array(newBuffer);
                    for (let j = 0; j < countsOfVec3 / 4; j++) {
                        newBufferView[j] = oldBuffer[j];
                    }
                    //适配到sparse的bufferAttribute，之后使用sparse index和sparse value填充需要改变的
                    bufferAttribute = newBuffer;
                    size = countsOfVec3 * arrayStride;
                }
                // 没有bufferView的情况，构建一个sparse count大小的bufferAttribute
                else if (accessor.bufferView == undefined) {
                    bufferAttribute = new ArrayBuffer(accessor.sparse.count * BaseFunction.getAccessorByteStride(accessor, bufferView));
                }
                // 有bufferView的情况且不需要重构的，直接从bufferView中读取数据
                else {
                    let fromBuffer = this.getArrayViewForBufferView(accessor.bufferView, accessor.componentType, accessor.count, accessor.type, accessor.byteOffset);
                    bufferAttribute = cloneBufferSource(fromBuffer, fromBuffer.byteOffset, fromBuffer.byteLength);
                }
                if (gpuBuffer == undefined) {
                    let countOfSparse = accessor.sparse.count;
                    // sparse index
                    let indexBufferSparse = this.getArrayViewForBufferView(accessor.sparse.indices.bufferView,
                        accessor.sparse.indices.componentType,
                        countOfSparse,
                        "SCALAR",
                        accessor.sparse.indices.byteOffset);
                    // sparse value
                    let valueBufferSparse = this.getArrayViewForBufferView(accessor.sparse.values.bufferView,
                        accessor.componentType,
                        countOfSparse,
                        accessor.type,
                        accessor.sparse.values.byteOffset);
                    // 写入sparse数据到bufferAttribute
                    for (let i_sparse = 0; i_sparse < countOfSparse; i_sparse++) {
                        let index = indexBufferSparse[i_sparse];
                        BaseFunction.writeArayBufferViewForSparse(bufferAttribute, accessor.type, accessor.componentType, index, valueBufferSparse, i_sparse);
                    }
                    // 构建对应的GPUBuffer
                    let byteOffset = 0;//sparse数据对应的Arraybuffer是新建的，从0开始
                    gpuBuffer = createCommonGPUBuffer(this.device, bufferView.name || accessorID.toString(), bufferAttribute, byteOffset, bufferAttribute.byteLength);
                    this.setGPUBufferAliasToRES(aliaseID, gpuBuffer);
                }
                // 构建对应的GPUBufferBundle
                accessorBufferSource = {
                    buffer: gpuBuffer,
                    format: format,
                    wgslFormat: wgslFormat,
                    name: accessor.name || accessorID.toString(),
                    arrayStride: arrayStride,
                    count: accessor.count,
                    /**
                     * 从buffer的offset开始读取数据,比如一个大的GPUBuffer，包括了多个vertex attribute和index attribute，还可能包括uniform数据
                     *  from offset to size，exp:one big GPUBuffer, include vertex attribute and index attribute and uniform data
                     * default: 0
                     */
                    offset: accessor.byteOffset,
                    /**
                     * 读取数据的大小，默认=count*arrayStride
                     * default: count*arrayStride
                     */
                    byteSize: size,
                    min: accessor.min,
                    max: accessor.max,
                } as I_vsGPUBufferBundle;
            }
        }
        else {
            throw new Error(`GLTFModel: accessor ${accessorID} bufferView ${accessor.bufferView} target ${bufferView.target} not support`);
        }
        // }
        // else {
        //     const { format, wgslFormat } = getAccessorTypeForGPUVertexFormat(accessor);
        //     accessorBufferSource = {
        //         buffer: buffer,
        //         offset: accessor.byteOffset,
        //         size: accessor.byteLength,
        //         format: format,
        //     } as GPUBufferBinding;
        // }
        // this.modelAccessors.push(accessorBufferSource);
        this.modelRes.accessor.set(accessorID, accessorBufferSource);
        return accessorBufferSource;
    }

    /**
     * 获取accessor的数据来源,BufferSource
     * 1、为webgpu不支持的类型，获取原始数据，重构GPUBuffer使用。
     *      A、紧密结构的直接返回对应的 ArrayBufferView
     *      B、非紧密机构的，需要根据byteStride和unitByteSize进行重构，转换为新的 ArrayBuffer对应的 ArrayBufferView，数据类型与原始的一致。
     * 2、为print数据使用，进行分析和debug
     * @param accessor 
     * @returns Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array
     */
    getBufferSourceForAccessor(accessor: GLTFAccessor):
        Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array {
        if (!this.gltfJson.bufferViews) {
            throw new Error("GLTFModel: accessor bufferView not found");
        }
        let bufferView = this.gltfJson.bufferViews[accessor.bufferView!];

        let componentType = accessor.componentType;     //componentType(int8,uint8,sint16,uint16,uint32,float32)

        let byteOffset = accessor.byteOffset || 0;//) + (bufferView.byteOffset || 0);

        let sizes = BaseFunction.getAccessorSize(accessor, bufferView);
        // this.modelGltfBuffers[bufferView.buffer].arrayBuffer
        let buffer = this.getBufferByBufferViewID(accessor.bufferView!);

        //数据元素是紧密排列的
        //或
        //元素跨度=组件（SCALAR|VEC2|VEC3|VEC4|MAT2|MAT3|MAT4）*组件类型byte(int8,uint8,sint16,uint16,uint32,float32)大小
        if (sizes.byteStride === 0 || sizes.byteStride === sizes.unitByteSize) {
            return BaseFunction.getBufferSourceOfArrayBuffer(buffer.arrayBuffer, componentType, buffer.byteOffset + byteOffset, sizes.count * sizes.componentSize);
        }
        //数据元素是有跨度排序的，多个原始||有填充
        //simpleSkin.gltf 中joints_0 accessor的byteStride=16,unitByteSize=VEC4*uint16=4*2=8,这里就不相等了（后面的8byte是占位）
        else {
            // throw new Error("/数据元素是有跨度排序的，多个原始||有填充,未实现");
            return BaseFunction.getArrayBufferViewByStrideAndCount(buffer.arrayBuffer, buffer.byteOffset + byteOffset, accessor.type, componentType, sizes.byteStride, accessor.count);
        }
    }
    /**
     * 从获取bufferView的数据来源,ArrayView 
     * 1、sparse accessor，返回原始数据，新建ArrayBuffer
     * 2、测试输出使用，printBufferView
     * @param bufferViewIndex bufferView索引
     * @param componentType 组件类型
     * @param count 元素数量
     * @param type 数据类型
     * @param byteOffset 偏移量
     * @returns Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array
     */
    getArrayViewForBufferView(bufferViewIndex: number, componentType: number, count: number, type: string, byteOffset: number = 0): Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array {
        if (this.gltfJson.bufferViews == undefined) {
            throw new Error(`gltf not found bufferViews`);
        }
        let bufferView = this.gltfJson.bufferViews[bufferViewIndex];
        // let offset = (bufferView.byteOffset || 0) + byteOffset;
        let size = count * BaseFunction.getTypeSize(type);
        let buffer = this.getBufferByBufferViewID(bufferViewIndex);
        return BaseFunction.getBufferSourceOfArrayBuffer(buffer.arrayBuffer, componentType, buffer.byteOffset, size);
    }

    /**
     * 测试使用
     * 打印accessor的内容
     * gltf.printAccessorContent(0)
       gltf.printAccessorContent(1)
     * @param accessor  index 访问器索引
     */
    printAccessorContent(accessorIndex: number, print: boolean = true) {
        if (this.gltfJson.accessors == undefined) {
            throw new Error(`gltf not found accessors`);
        }
        let accessor = this.gltfJson.accessors[accessorIndex];
        let buffer = this.getBufferSourceForAccessor(accessor);
        if (print) {
            console.log(buffer);
        }
        return buffer;
    }
    /**
     * 测试使用
     * 打印bufferView的内容
     * gltf.printAccessorContent(0)
        gltf.printBufferView(2,5123,3,"SCALAR",0)
        gltf.printAccessorContent(1)
        gltf.printBufferView(3,5126,3,"VEC3",0)
     * @param index bufferView索引
     * @param componentType 组件类型
     * @param count 元素数量
     * @param type 数据类型
     * @param byteOffset 偏移量
     */
    printBufferView(index: number, componentType: number, count: number, type: string, byteOffset: number = 0) {
        let buffer = this.getArrayViewForBufferView(index, componentType, count, type, byteOffset);
        console.log(buffer);

    }


    getUniformBundleOfEntity(mesh: any): { uniforms: T_uniformGroups[], unifromLayout: T_BindGroupLayout[] } {
        let uniforms: T_uniformGroups[] = [];
        let unifromLayout: T_BindGroupLayout[] = [];

        return { uniforms, unifromLayout };
    }
    /**
     * 获取资源,根据资源类型(T_ModelResKind)和资源id获取资源
     * @param kind 资源类型
     * @param id 资源id
     * @returns 资源<T>或false
     */
    getRes<T>(kind: T_ModelResKind, id: number | string): T | false {
        // this.getResOfT<GPUBuffer>(T_ModelResKind.entity, "default");
        let key = id;
        // if (typeof id == "number") {
        //     key = id.toString();
        // }
        // else {
        //     key = id;
        // }
        switch (kind) {
            case T_ModelResKind.GPUBuffers:
                if (this.modelRes.GPUBuffers.has(key)) {
                    return this.modelRes.GPUBuffers.get(key) as T;
                }
                break;
            case T_ModelResKind.sampler:
                if (this.modelRes.sampler.has(key)) {
                    return this.modelRes.sampler.get(key) as T;
                }
                break;
            case T_ModelResKind.GPUSamplerBindingType:
                if (this.modelRes.GPUSamplerBindingType.has(key)) {
                    return this.modelRes.GPUSamplerBindingType.get(key) as T;
                }
                break;
            case T_ModelResKind.GPUTexture:
                if (this.modelRes.GPUTexture.has(key)) {
                    return this.modelRes.GPUTexture.get(key) as T;
                }
                break;
            case T_ModelResKind.accessor:
                if (this.modelRes.accessor.has(key)) {
                    let value = this.modelRes.accessor.get(key);
                    return value as T;
                }
                break;
            case T_ModelResKind.texture:
                if (this.modelRes.texture.has(key)) {
                    return this.modelRes.texture.get(key) as T;
                }
                break;
            case T_ModelResKind.material:
                if (this.modelRes.material.has(key)) {
                    return this.modelRes.material.get(key) as T;
                }
                break;
            case T_ModelResKind.entity:
                if (this.modelRes.entity.has(key)) {
                    return this.modelRes.entity.get(key) as T;
                }
                break;
            case T_ModelResKind.animation:
                if (this.modelRes.animation.has(key)) {
                    return this.modelRes.animation.get(key) as T;
                }
                break;
            case T_ModelResKind.camera:
                if (this.modelRes.camera.has(key)) {
                    return this.modelRes.camera.get(key) as T;
                }
                break;
            default:
                console.warn(`GLTFModel: getRes ${kind} not found`);
                // throw new Error(`GLTFModel: getRes ${kind} not found`);
                break;
        }

        // if (kind == T_ModelResKind.accessor) {
        //     if (this.modelRes.accessor.has(key)) {
        //         let value = this.modelRes.accessor.get(key);
        //         return value as T;
        //     }
        // } 
        // else if (kind == T_ModelResKind.material) {
        //     if (this.modelRes.material.has(key)) {
        //         return this.modelRes.material.get(key) as T;
        //     }
        // }
        // else if (kind == T_ModelResKind.entity) {
        //     if (this.modelRes.entity.has(key)) {
        //         return this.modelRes.entity.get(key) as T;
        //     }
        // }
        // else if (kind == T_ModelResKind.animation) {
        //     if (this.modelRes.animation.has(key)) {

        //         return this.modelRes.animation.get(key) as T;
        //     }
        // }
        // else if (kind == T_ModelResKind.GPUBuffers) {
        //     if (this.modelRes.GPUBuffers.has(key)) {
        //         return this.modelRes.GPUBuffers.get(key) as T;
        //     }
        // }
        // else if (kind == T_ModelResKind.GPUTexture) {
        //     if (this.modelRes.GPUTexture.has(key)) {
        //         return this.modelRes.GPUTexture.get(key) as T;
        //     }
        // }
        // else if (kind == T_ModelResKind.sampler) {
        //     if (this.modelRes.sampler.has(key)) {
        //         return this.modelRes.sampler.get(key) as T;
        //     }
        // }
        // else {
        //     console.warn(`GLTFModel: getRes ${kind} not found`);
        //     // throw new Error(`GLTFModel: getRes ${kind} not found`);
        // }
        console.warn(`GLTFModel: getRes ${kind} : ${key} not found`);
        return false;
    }


    /**
     * 初始化采样器
     * 1、初始化默认采样器：linear
     * 2、按照gltf的sampler，初始化采样器
     */
    initSamplers(samplers: []) {
        let defaultSampler = this.scene.resourcesGPU.getSampler("linear");
        this.modelRes.sampler.set("default", defaultSampler);
        if (this.gltfJson.samplers)
            for (let i in this.gltfJson.samplers) {
                let perSamplerData: GLTFSampler = this.gltfJson.samplers[i];
                let samplerBindingType: GPUSamplerBindingType = "filtering";      //必须，手动bind group layout需要
                let magFilter: GPUFilterMode = "linear";
                if (perSamplerData.magFilter && perSamplerData.magFilter == 9728) {
                    magFilter = "nearest";
                }
                let minFilter: GPUFilterMode = "linear";
                let mipmapFilter: GPUFilterMode | undefined;
                if (perSamplerData.minFilter) {
                    switch (perSamplerData.minFilter) {
                        case 9728://NEAREST 
                            minFilter = "nearest";
                            samplerBindingType = "non-filtering";
                            // mipmapFilter = "nearest";
                            break;
                        case 9729://LINEAR
                            minFilter = "linear";
                            samplerBindingType = "filtering";
                            // mipmapFilter = "linear";
                            break;
                        case 9984://NEAREST_MIPMAP_NEAREST 
                            minFilter = "nearest";
                            mipmapFilter = "nearest";
                            samplerBindingType = "non-filtering";
                            break;
                        case 9985://LINEAR_MIPMAP_NEAREST  
                            minFilter = "linear";
                            mipmapFilter = "nearest";
                            samplerBindingType = "filtering";
                            break;
                        case 9986://NEAREST_MIPMAP_LINEAR  
                            minFilter = "nearest";
                            mipmapFilter = "linear";
                            samplerBindingType = "filtering";
                            break;
                        case 9987://LINEAR_MIPMAP_LINEAR  
                            minFilter = "linear";
                            mipmapFilter = "linear";
                            samplerBindingType = "filtering";
                            break;
                        default:
                            minFilter = "linear";
                            break;
                    }
                }

                if (perSamplerData.minFilter && perSamplerData.minFilter == 9728) {
                    minFilter = "nearest";
                }
                else {
                    minFilter = "linear";
                }
                let addressModeU: GPUAddressMode | undefined;
                if (perSamplerData.wrapS) {
                    switch (perSamplerData.wrapS) {
                        case 33071://CLAMP_TO_EDGE 
                            addressModeU = "clamp-to-edge";
                            break;
                        case 33072:// MIRRORED_REPEAT 
                            addressModeU = "mirror-repeat";
                            break;
                        case 10497://REPEAT
                            addressModeU = "repeat";
                            break;
                        default:
                            addressModeU = "repeat";
                            break;
                    }
                }
                let addressModeV: GPUAddressMode | undefined;
                if (perSamplerData.wrapT) {
                    switch (perSamplerData.wrapT) {
                        case 33071://CLAMP_TO_EDGE 
                            addressModeV = "clamp-to-edge";
                            break;
                        case 33072:// MIRRORED_REPEAT 
                            addressModeV = "mirror-repeat";
                            break;
                        case 10497://REPEAT
                            addressModeV = "repeat";
                            break;
                        default:
                            addressModeV = "repeat";
                            break;
                    }
                }

                let perSampler = this.device.createSampler({
                    label: perSamplerData.name || i,
                    magFilter,
                    minFilter,
                    mipmapFilter,
                    addressModeU,
                    addressModeV,
                });
                this.modelRes.sampler.set(Number(i), perSampler);
                this.modelRes.GPUSamplerBindingType.set(Number(i), samplerBindingType);
            }
    }

    async initGPUTextures() {
        let defaultGPUTexture = this.scene.resourcesGPU.textureOfString.get("default");
        this.modelRes.GPUTexture.set("default", defaultGPUTexture);
        if (this.gltfJson.images) {
            if (this.gltfType == "gltf") {
                //如果@loader.gl 有images,则使用images
                if ((this.modelData as GLTFWithBuffers).images) {
                    let images = (this.modelData as GLTFWithBuffers).images as GLTFExternalImage[];
                    for (let i in images) {
                        let perImageData = images[i];
                        let gpuTexture = this.device.createTexture({
                            label: i,
                            size: [perImageData.width, perImageData.height],
                            format: "rgba8unorm",
                            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
                        });
                        this.device.queue.copyExternalImageToTexture(
                            { source: perImageData as ImageBitmap, flipY: false }, //翻转Y轴,纹理错误
                            /**
                             * 存储的纹理像素不得进行预乘
                             * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-material-pbrmetallicroughness
                             */
                            { texture: gpuTexture, premultipliedAlpha: false },
                            [perImageData.width, perImageData.height]
                        );
                        this.modelRes.GPUTexture.set(Number(i), gpuTexture);
                    }
                }
            }
            else if (this.gltfType == "glb") {
                // needArrayBuffer2Image = true;
                for (let i in this.gltfJson.images) {
                    let perImageData = this.gltfJson.images[i];
                    // 创建 Blob 并生成 ImageBitmap
                    const buffer = this.getBufferByBufferViewID(perImageData.bufferView!);          //获取bufferView对应的buffer
                    let dataView = new DataView(buffer.arrayBuffer, buffer.byteOffset, buffer.byteLength);      //创建DataView，从buffer的byteOffset开始，长度为byteLength
                    const blob = new Blob([dataView], { type: perImageData.mimeType });
                    const bitmap = await createImageBitmap(blob);
                    let gpuTexture = this.device.createTexture({
                        label: i,
                        size: [bitmap.width, bitmap.height],
                        format: "rgba8unorm",
                        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
                    });
                    this.device.queue.copyExternalImageToTexture(
                        { source: bitmap, flipY: false }, //翻转Y轴,纹理错误
                        /**
                         * 存储的纹理像素不得进行预乘
                         * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-material-pbrmetallicroughness
                         */
                        { texture: gpuTexture, premultipliedAlpha: false },
                        [bitmap.width, bitmap.height]
                    );
                    this.modelRes.GPUTexture.set(Number(i), gpuTexture);
                }
            }
        }
    }
    /**
     * 初始化纹理
     * 1、按照gltf的texture，初始化纹理
     */
    async initTextures() {
        let defaultTexture = this.scene.resourcesGPU.weTextureOfString.get("default");
        this.modelRes.texture.set("default", defaultTexture);
        if (this.gltfJson.textures)
            for (let i in this.gltfJson.textures) {
                let perTextureData: GLTFTexture = this.gltfJson.textures[i];
                let sampler: GPUSampler | undefined = undefined;
                if (perTextureData.sampler !== undefined) {
                    // sampler = this.modelRes.sampler.get(Number(perTextureData.sampler));
                    sampler = <GPUSampler>this.getRes(T_ModelResKind.sampler, perTextureData.sampler);
                }
                let gpuTexture: GPUTexture;
                if (perTextureData.source !== undefined) {
                    gpuTexture = <GPUTexture>this.getRes(T_ModelResKind.GPUTexture, perTextureData.source);
                }
                else {
                    gpuTexture = <GPUTexture>this.getRes(T_ModelResKind.GPUTexture, "default");
                }
                let perTexture = new Texture({
                    source: gpuTexture,
                    sampler: sampler,
                    samplerBindingType: this.modelRes.GPUSamplerBindingType.get(Number(perTextureData.sampler)),
                }, this.device, this.scene);
                await perTexture.init(this.scene);
                this.modelRes.texture.set(Number(i), perTexture);
            }
    }
    /**
     * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-textureinfo
     * 
     */
    initTextureInfo() {

    }
    /**
     * 初始化默认材质
     * 1、初始化默认材质
     * 2、按照gltf的material，初始化材质
     */
    initMaterials() {
        // this.modelRes.material.set("default", this.scene.resourcesGPU.weMaterialOfString.get("defaultPBR"));
        let colorMaterial = new ColorMaterial({
            color: [1, 1, 1, 1],
        });
        this.modelRes.material.set("default", colorMaterial);
        let alert = new ColorMaterial({
            color: [1, 0, 0, 1],
        });
        this.modelRes.material.set("alert", alert);
        let vertexMaterial = new VertexColorMaterial();
        this.modelRes.material.set("vertexColor", vertexMaterial);
        if (this.gltfJson.materials)
            for (let i in this.gltfJson.materials) {
                let perMaterialData: GLTFMaterial = this.gltfJson.materials[i];
                ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                //未实现
                // 扩展未实现
                let extensions = perMaterialData.extensions;
                // extras未实现
                let extras = perMaterialData.extras;




                ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                let name = perMaterialData.name || i;
                let normalTexture = perMaterialData.normalTexture;
                /**
                 * 当alphaMode为"MASK"时，指定alphaCutoff值。
                 * 该值定义了alpha值的阈值，低于该值的像素将被视为完全透明。
                 * 该值必须大于或等于0且小于或等于1。
                 * 必填：否，默认值：0.5
                 */
                let alphaCutoff = perMaterialData.alphaCutoff || 0.5;
                /**
                 * 使用data2:i32进行传输
                 */
                let alphaMode = perMaterialData.alphaMode || "OPAQUE";

                /**
                 * 发光纹理。它控制着材质所发射光的颜色和强度。该纹理包含通过sRGB转换函数编码的RGB分量。
                 * 如果存在第四个分量（A），则必须忽略该分量。
                 * 未定义时，对该纹理进行采样时，其RGB分量必须为1.0
                 */
                let emissiveTexture = perMaterialData.emissiveTexture;
                /**
                 * 材料发光颜色的影响因素。该值定义了发光纹理采样纹素的线性倍增系数。
                 * 数组中的每个元素都必须大于或等于0且小于或等于1。
                 * 必填：否，默认值：[0,0,0]
                 */
                let emissiveFactor = perMaterialData.emissiveFactor || [0, 0, 0];
                /**
                 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#_material_alphamode
                 * "OPAQUE" 忽略 alpha 值，渲染输出完全不透明。
                 * "MASK" 渲染输出根据alpha值和指定的alphaCutoff值，要么完全不透明，要么完全透明；边缘的确切外观可能取决于特定于实现的技术，例如“Alpha-to-Coverage”（阿尔法到覆盖）。
                 * "BLEND" 阿尔法值用于合成源区域和目标区域。渲染输出通过常规绘制操作（即Porter和Duff的叠加运算符）与背景相结合。
                 */
                /**
                 * GLTF 中的 occlusionTexture 是 环境光遮挡（Ambient Occlusion, AO）纹理
                 * occlusion纹理。occlusion值从R通道进行线性采样。
                 * 值越高，表示接收全部间接光照的区域；值越低，表示没有间接光照的区域。
                 * 如果存在其他通道（GBA），在occlusion计算中MUST忽略这些通道。
                 * 未定义时，该材质没有occlusion纹理。
                 */
                let occlusionTexture = perMaterialData.occlusionTexture;
                /**
                 * 当为true时，渲染输出将在两个面都可见。
                 * 当为false时，仅渲染输出在前端可见的面。
                 * 必填：否，默认值：false
                 */
                let doubleSided = perMaterialData.doubleSided || false;
                // PBR材质基础
                let pbrMetallicRoughness = perMaterialData.pbrMetallicRoughness;
                //albedo
                let baseColor = pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
                let albedoTexture: Texture;
                let albedo: I_TextureWithChanneAndVec3lForPBR = { value: baseColor as weVec4 };
                if (pbrMetallicRoughness && pbrMetallicRoughness.baseColorTexture?.index != undefined) {
                    albedoTexture = <Texture>this.getRes(T_ModelResKind.texture, pbrMetallicRoughness.baseColorTexture?.index);
                    albedo.texture = albedoTexture;

                }
                //metallic
                let metallicFactor = pbrMetallicRoughness?.metallicFactor || 1;
                let metallicTexture: Texture;
                let metallic: I_TextureWithChanneAndNumberlForPBR = { value: metallicFactor };
                if (pbrMetallicRoughness && pbrMetallicRoughness.metallicRoughnessTexture?.index != undefined) {
                    metallicTexture = <Texture>this.getRes(T_ModelResKind.texture, pbrMetallicRoughness.metallicRoughnessTexture?.index);
                    metallic.texture = metallicTexture;
                    metallic.channel = E_TextureChannel.B;
                }
                //roughness
                let roughnessFactor = pbrMetallicRoughness?.roughnessFactor || 1;
                let roughnessTexture: Texture;
                let roughness: I_TextureWithChanneAndNumberlForPBR = { value: roughnessFactor };
                if (pbrMetallicRoughness && pbrMetallicRoughness.metallicRoughnessTexture?.index != undefined) {
                    roughnessTexture = <Texture>this.getRes(T_ModelResKind.texture, pbrMetallicRoughness.metallicRoughnessTexture?.index);
                    roughness.texture = roughnessTexture;
                    roughness.channel = E_TextureChannel.G;
                }

                let inputPBRMaterial: IV_PBRMaterial = {
                    textures: {
                        albedo,
                        // normal: { texture: { source: "/resource/PBR/rustediron/rustediron2_normal.png" } },
                        metallic,
                        roughness,
                    }
                };
                // let perMaterial;
                // if (pbrMetallicRoughness!.baseColorTexture != undefined) {
                //     metallicTexture = <Texture>this.getRes(T_ModelResKind.texture, Number(pbrMetallicRoughness!.baseColorTexture!.index));
                //     perMaterial = new TextureMaterial({
                //         textures: {
                //             color: metallicTexture,
                //         }
                //     });
                // }
                // else {
                //     perMaterial = new ColorMaterial({
                //         color: [1, 0, 0, 1],
                //     });
                // }
                let perMaterial = new PBRMaterial(inputPBRMaterial);
                this.modelRes.material.set(Number(i), perMaterial);
            }
    }

    /**
     * 初始化entity 
     */
    async initMeshes() {
        if (this.gltfJson.meshes == undefined) {
            throw new Error(`gltf not found meshes`);
        }
        for (let i in this.gltfJson.meshes) {
            let meshSource = this.gltfJson.meshes[i];
            for (let j in meshSource.primitives) {
                /////////////////////////////////////////////////////////////////////////////////////////////////////
                //base  part
                let primitive = meshSource.primitives[j];       //mesh的primitive
                let primitiveMode = primitive.mode;             //当前entity的primitive的绘制模式
                if (primitiveMode == undefined) {               //设置primitiveMode为默认值4，GL_TRIANGLES
                    primitiveMode = 4;
                }
                let name = meshSource.name ?? i;
                let inputEntity: IV_MeshEntity | IV_PointsEntity | IV_LinesEntity;  //enity 属性
                /////////////////////////////////////////////////////////////////////////////////////////////////////
                //material part
                let materialOfPerEntity;                        //当前entity的primitive的材质
                if (primitive.material == undefined) {          //如果primitive没有材质，默认使用default材质
                    materialOfPerEntity = this.getRes(T_ModelResKind.material, "default");
                    // materialOfPerEntity = <PBRMaterial> this.getRes(T_ModelResKind.material,"default");
                    // materialOfPerEntity = this.modelRes.material.get("default");
                }
                else {                                          //如果primitive有材质，获取材质
                    materialOfPerEntity = this.modelRes.material.get(primitive.material);
                    if (materialOfPerEntity == undefined) {
                        console.warn(`mesh ${name} primitive ${j} material ${primitive.material} not found`);
                        // throw new Error(`mesh ${name} primitive ${j} material ${primitive.material} not found`);
                        materialOfPerEntity = this.getRes(T_ModelResKind.material, "alert");
                    }
                }
                /////////////////////////////////////////////////////////////////////////////////////////////////////
                //attribute part 
                //初始化mesh顶点数据为 we entity的顶点数据格式；
                let verticesOfDataOfEntity: {
                    [name: string]: I_vsGPUBufferBundle
                } = {};
                for (let k in primitive.attributes) {
                    let oneAttribute = primitive.attributes[k];
                    let accessor = await this.getAccessor(oneAttribute, E_accessorUseFor.vertex);
                    // let accessor = this.modelRes.accessor.get(oneAttribute.toString());
                    if (accessor == undefined) {
                        console.warn(`mesh ${name} primitive ${j} attribute ${k} not found accessor`);
                        continue;
                    }
                    let nameOfAttribute = k.toLowerCase();
                    if (k == "COLOR_0") {
                        nameOfAttribute = "color";
                    }
                    // if (k == "UV_0") {
                    //     nameOfAttribute = "uv";
                    // }
                    // else 
                    if (k == "TEXCOORD_0") {
                        nameOfAttribute = "uv";
                    }
                    else if (k == "TEXCOORD_1") {
                        nameOfAttribute = "uv1";
                    }
                    if (k == "NORMAL") {
                        nameOfAttribute = "normal";
                    }
                    if (k == "JOINTS_0") {
                        nameOfAttribute = "joints";
                    }
                    if (k == "WEIGHTS_0") {
                        nameOfAttribute = "weight";
                    }

                    verticesOfDataOfEntity[nameOfAttribute] = accessor as I_vsGPUBufferBundle;
                }
                if ("normal" in verticesOfDataOfEntity == false && (primitive.mode == undefined || primitive.mode == 4 || primitive.mode == 5 || primitive.mode == 6)) {//如果没有法线，计算法线
                    let positionAccessorID = primitive.attributes["POSITION"];
                    let positionAccessor = this.modelData.json.accessors[positionAccessorID];
                    let normalAccessorID = positionAccessorID + "_normal";
                    let alreadyNormal = this.modelRes.accessor.has(normalAccessorID);
                    if (alreadyNormal) {
                        verticesOfDataOfEntity["normal"] = this.modelRes.accessor.get(normalAccessorID) as I_vsGPUBufferBundle;
                    }
                    else {
                        let positions = this.getBufferSourceForAccessor(positionAccessor) as Float32Array;
                        let normalAccessorBufferSource: I_vsGPUBufferBundle;
                        let gpuBuffer: GPUBuffer;
                        if ("indices" in primitive) {//如果有索引，根据索引计算法线
                            let indicesAccessorID: number = primitive["indices"]!;
                            let indicesAccessor = this.modelData.json.accessors[indicesAccessorID];
                            let indices = this.getBufferSourceForAccessor(indicesAccessor) as Uint16Array | Uint32Array;
                            let normals: Float32Array = BaseFunction.computeNormalsFromPositionsAndIndices(positions, indices);
                            gpuBuffer = createCommonGPUBuffer(this.device, normalAccessorID, normals.buffer as ArrayBuffer, 0, normals.byteLength);
                            normalAccessorBufferSource = {
                                buffer: gpuBuffer,
                                format: "float32x3",
                                wgslFormat: "vec3f",
                                name: normalAccessorID,
                                arrayStride: 3 * 4,
                                count: verticesOfDataOfEntity["position"].count,
                                offset: 0,
                                byteSize: verticesOfDataOfEntity["position"].byteSize,
                                min: [-1, -1, -1],
                                max: [1, 1, 1],
                            };
                            verticesOfDataOfEntity["normal"] = normalAccessorBufferSource;
                        }
                        else {//如果没有索引，根据顶点顺序计算法线
                            let normals: Float32Array = BaseFunction.computeNormalsFromPositionsNoIndex(positions);
                            gpuBuffer = createCommonGPUBuffer(this.device, normalAccessorID, normals.buffer as ArrayBuffer, 0, normals.byteLength);
                            normalAccessorBufferSource = {
                                buffer: gpuBuffer,
                                format: "float32x3",
                                wgslFormat: "vec3f",
                                name: normalAccessorID,
                                arrayStride: 3 * 4,
                                count: verticesOfDataOfEntity["position"].count,
                                offset: 0,
                                byteSize: verticesOfDataOfEntity["position"].byteSize,
                                min: [-1, -1, -1],
                                max: [1, 1, 1],
                            };
                            verticesOfDataOfEntity["normal"] = normalAccessorBufferSource;
                        }
                        this.modelRes.accessor.set(normalAccessorID, normalAccessorBufferSource);
                        this.modelRes.GPUBuffers.set(normalAccessorID, gpuBuffer);
                    }
                }
                /////////////////////////////////////////////////////////////////////////////////////////////////////
                //gpubuffer of index and draw mode   part
                //strip index format default uint16,strip 存在，index一定存在，且stripIndexFormat 为 indexAttribute 的格式
                let stripIndexFormat: GPUIndexFormat = "uint16";
                //index accessor 转义we interface，可以为undefined(无index)
                let indexesOfDataOfEntity: T_indexAttribute | undefined;
                let drawMode: I_drawMode | I_drawModeIndexed;
                if (meshSource.primitives[0].indices != undefined) {                //index 
                    let idOfaccessors = meshSource.primitives[0].indices;
                    let useFor: E_accessorUseFor
                    switch (primitive.mode) {
                        case 0:
                            useFor = E_accessorUseFor.indexPointList;
                            break;
                        case 1:
                            useFor = E_accessorUseFor.indexLineList;
                            break;
                        case 2:
                            useFor = E_accessorUseFor.indexTriangleList;
                            break;
                        case 3:
                            useFor = E_accessorUseFor.indexLineStrip;
                            break;
                        case 4:
                            useFor = E_accessorUseFor.indexTriangleList;
                            break;
                        case 5:
                            useFor = E_accessorUseFor.indexTriangleStrip;
                            break;
                        case 6:
                            useFor = E_accessorUseFor.indexTriangleFan;
                            break;
                        default:
                            useFor = E_accessorUseFor.indexTriangleList;
                    }
                    let indexAttribute = await this.getAccessor(idOfaccessors, useFor);
                    stripIndexFormat = (indexAttribute as I_indexGPUBufferBundle).format;//重置 stripIndexFormat 为索引缓冲区的格式

                    indexesOfDataOfEntity = indexAttribute as I_indexGPUBufferBundle;
                    drawMode = {
                        indexCount: (indexAttribute as I_indexGPUBufferBundle).count,
                    }
                }
                else {                                                          // draw mode
                    let count: number;
                    if (primitive.attributes.POSITION != undefined) {
                        let position = this.modelRes.accessor.get(primitive.attributes.POSITION);
                        if (position == undefined) {
                            throw new Error(`mesh ${name} primitive ${j} attribute POSITION not found accessor`);
                        }
                        count = position.count;
                    }
                    else if (primitive.attributes.position != undefined) {
                        let position = this.modelRes.accessor.get(primitive.attributes.position);
                        if (position == undefined) {
                            throw new Error(`mesh ${name} primitive ${j} attribute position not found accessor`);
                        }
                        count = position.count;
                    }
                    else {
                        throw new Error(`mesh ${i} don't have POSITION attribute`);
                    }
                    drawMode = {
                        vertexCount: count,
                    }
                }
                /////////////////////////////////////////////////////////////////////////////////////////////////////
                // primitive of render
                let primitiveOfDataOfRender: GPUPrimitiveState = {
                    topology: "triangle-strip",
                };
                switch (primitiveMode) {
                    case 0: //point
                        primitiveOfDataOfRender = {
                            topology: "point-list",
                        }
                        //point 列表渲染，使用 vertexColorMaterial
                        materialOfPerEntity = this.getRes(T_ModelResKind.material, "vertexColor");
                        break;
                    case 1: //line
                        primitiveOfDataOfRender = {
                            topology: "line-list",
                        }
                        materialOfPerEntity = this.getRes(T_ModelResKind.material, "vertexColor");
                        break;
                    case 2: //line loop
                        primitiveOfDataOfRender = {
                            topology: "line-list",
                        }
                        materialOfPerEntity = this.getRes(T_ModelResKind.material, "vertexColor");
                        break;
                    case 3: //line strip
                        primitiveOfDataOfRender = {
                            topology: "line-strip",
                        }
                        materialOfPerEntity = this.getRes(T_ModelResKind.material, "vertexColor");
                        break;
                    case 4: //triangle
                        primitiveOfDataOfRender = {
                            topology: "triangle-list",
                            cullMode: "back",
                            // cullMode: "none",//todo,临时方案，后续根据模型数据动态设置
                        }
                        break;
                    case 5: //triangle strip
                        primitiveOfDataOfRender = {
                            topology: "triangle-strip",
                            stripIndexFormat: stripIndexFormat,//设置索引缓冲区的格式
                            // stripIndexFormat: "uint16",
                        }
                        break;
                    case 6: //triangle fan，webgpu没有fan，转为list ，相关数据index在获取时已经转换
                        primitiveOfDataOfRender = {
                            topology: "triangle-list",
                        }
                        break;
                    default:
                        throw new Error("primitiveMode not support");
                }
                /////////////////////////////////////////////////////////////////////////////////////////////////////
                // input entity and new entity
                // let { uniforms, unifromLayout } = this.getUniformBundleOfEntity(meshSource);
                inputEntity = {
                    name: name,
                    attributes: {
                        data: {
                            vertices: verticesOfDataOfEntity,
                            // indexes: [0, 1, 2],
                            indexes: indexesOfDataOfEntity,//索引缓冲区，可以为undefined(无index)
                        },
                    },
                    primitive: primitiveOfDataOfRender,
                    drawMode,
                    material: materialOfPerEntity,
                };

                let entity: Mesh | Points | Lines;
                if (primitiveMode == 4 || primitiveMode == 5 || primitiveMode == 6) {
                    entity = new Mesh(inputEntity as IV_MeshEntity);
                }
                else if (primitiveMode == 0) {
                    entity = new Points(inputEntity as IV_PointsEntity);
                }
                else if (primitiveMode == 1 || primitiveMode == 2 || primitiveMode == 3) {
                    entity = new Lines(inputEntity as IV_LinesEntity);
                }
                else {
                    throw new Error("primitiveMode not support");
                }
                this.modelRes.entity.set(Number(i), entity);
            }
        }
    }


    initNodes() { }
    initSkins() { }
    initAnimations() { }
    initCameras() { }

    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
}





