/**
 * @author bythesword
 * @date 2026-01-15
 * @description 
 *  一、mesh的primitive的属性对应名称
 *      1、JOINTS_0对应到了属性joints，对于JOINTS_1,2,3...对应属性未处理
 *      2、WEIGHTS_0对应到了属性weights，对于WEIGHTS_1,2,3...对应属性未处理
 *      3、POSITION对应到了属性position
 *      4、NORMAL对应到了属性normal
 *      5、TEXCOORD_0对应到了属性uv，对于TEXCOORD_1对应属性uv1
 * 
 */
import { Clock } from "../../core/scene/clock";
import { BaseModel, I_Model, T_ModelResKind } from "../../core/model/BaseModel";
// import { IV_NodeSpace, NodeInstanceModel, NodeObject, RootGPU } from "../../core/organization/root";
import { createCommonGPUBuffer } from "../../core/command/baseFunction";
import { I_indexGPUBufferBundle, I_vsGPUBufferBundle, T_indexAttribute } from "../../core/command/DrawCommandGenerator";
import { IV_MeshEntity, Mesh } from "../../core/entity/mesh/mesh";
import { IV_PointsEntity, Points } from "../../core/entity/mesh/points";
import { IV_LinesEntity, Lines } from "../../core/entity/mesh/lines";
import { I_TextureWithChanneAndNumberlForPBR, I_TextureWithChanneAndVec3lForPBR, IV_PBRMaterial, PBRMaterial } from "../../core/material/PBR/PBRMaterial";
import { I_drawMode, I_drawModeIndexed } from "../../core/command/base";
import { ColorMaterial } from "../../core/material/standard/colorMaterial";
import * as BaseFunction from "./function";
import { BaseEntity } from "../../core/entity/baseEntity";
import { VertexColorMaterial } from "../../core/material/standard/vertexColorMaterial";
import { Texture } from "../../core/texture/texture";
import { E_TextureChannel } from "../../core/texture/base";
import { E_accessorUseFor } from "./base";
import { BaseTexture } from "../../core/texture/baseTexture";
import { BaseMaterial } from "../../core/material/baseMaterial";
import { ModelDataLoader } from "../../core/model/ModelDataLoader";
import { GltfDataAtLoaders } from "./gltfAtLoaders";
import { weVec4 } from "../../core/base/coreDefine";
import { AnimationGroup } from "../../core/animation/animationGroup";
import { E_AnimationTargetType, E_InterpolationModes, I_AnimationSampler } from "../../core/animation/base";
import { TypedArray } from "webgpu-utils";
import { KeyFrameAnimation } from "../../core/animation/keyFrame";
import { MorphTargetAnimation } from "../../core/animation/morphTarget";
import { SkinAnimation } from "../../core/animation/skin";
import { Skeleton } from "../../core/animation/skeleton";
import { NodeObject, NodeInstanceModel } from "../../core/organization/nodeObject";
import { IV_NodeSpace } from "../../core/organization/nodeSpace";
import { RootGPU } from "../../core/organization/root";


export interface I_gltfInstanceResource {
    nodes: Map<any, NodeObject>;
    animation: Map<any, any>;
    animationGroup: Map<any, any>;
}

export async function createGLTFModel(input: I_Model): Promise<GLTFModel> {
    let type: "gltf" | "glb";
    let gltf = new GLTFModel(input);
    let DataLoader = new GltfDataAtLoaders(input.url, input.scene.device, gltf);
    await DataLoader.init();
    await gltf.initData(DataLoader);
    return gltf;
}


export class GLTFModel extends BaseModel {
    DataLoader!: ModelDataLoader;
    url: string;

    /** gltf当前场景索引 */
    currentScene: number = 0;

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
    instanceNodes: Map<any, I_gltfInstanceResource> = new Map();
    meshAndSkinBundle: { meshID: number, skinID: number, nodeID: number }[] = [];

    constructor(input: I_Model) {
        super(input);
        // this.gltfType = input.type;
        this.url = input.url;
        if (input.name) {
            this._name = input.name;
        }
        // this.modelData = input.data;
        this.scene = input.scene;
        this.device = input.scene.device;
        this.debug = input.debug || false;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**实例化
    * 初始化模型节点
    * 1、被parent的addChild调用
    * 2、调用initScene初始化场景
    * @param parent 父节点
    * @param attachValue 节点空间属性
    * @returns 场景节点实例
    */
    async initInstance(parent: NodeObject, attachValue?: IV_NodeSpace): Promise<NodeInstanceModel> {
        let nodeOfScene: NodeInstanceModel = await this.initScene(parent, this.currentScene, attachValue);
        await this.initAnimationsForInstance(nodeOfScene);
        await this.initSkinsForInstance(nodeOfScene);
        if (this.debug === false) {
            this.instanceNodes.delete(nodeOfScene);//必须，否则map的资源不会被GC（在instance注销的情况）。debug模式时开启
        }
        return nodeOfScene;
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
        this.instanceNodes.set(nodeOfScene, {
            nodes: new Map<any, NodeObject>(),
            animation: new Map<any, any>(),
            animationGroup: new Map<any, any>(),
        });
        nodeOfScene._modelOrigin = this;
        nodeOfScene._name = "gltf scene " + nodeOfScene.ID;

        let scene = this.DataLoader.getScene(id);
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
        /**    push mesh to children         */
        for (let nodeID of nodes) {
            await BaseFunction.addNode(this, nodeID, nodeOfScene, nodeOfScene);
        }
        return nodeOfScene;
    }
    cleanInstanceResource(): void {
        if (this.debug === false) {
            this.instanceNodes.clear();//必须，否则map的资源不会被GC（在instance注销的情况）。debug模式时开启
        }
    }
    /**
     * 初始化皮肤
     * 1、皮肤附加到NodeObject
     * 2、皮肤实例附加到NodeInstanceModel
     */
    async initSkinsForInstance(nodeOfScene: NodeInstanceModel) {
        //1、递归获得mesh和skin的组合，以及对应的node ,输出[{meshID,skinID,nodeID}]

        //2、遍历mesh和skin的组合，初始化SkinAnimation,输出  [SkinAnimation]
        let skinAnimations: SkinAnimation[] = [];
        for (let bundle of this.meshAndSkinBundle) {
            let node = this.instanceNodes.get(nodeOfScene)!.nodes.get(bundle.nodeID);
            let mesh = node?.Entity;
            let skin = this.DataLoader.getSkin(bundle.skinID);

            let jointsNodes = skin.joints;
            let jointMatrix = await this.getAccessor(skin.inverseBindMatrices, E_accessorUseFor.array) as Float32Array;
            let joints: NodeObject[] = [];
            for (let i of jointsNodes) {
                joints.push(this.instanceNodes.get(nodeOfScene)!.nodes.get(i)!);
            }
            let skeletons = new Skeleton({
                joints: joints,
                jointsMatrices: jointMatrix,
            });

            let skinAnimation = new SkinAnimation(
                {
                    parent: node!,
                    skeleton: skeletons,
                    entity: node!.Entity,
                }
            );
            skinAnimations.push(skinAnimation);
        }

        //3、为每个animation group 增加skin animation：
        // //nodeOfScene.animationGroup.addSkinAnimation(skinAnimation)
        if (nodeOfScene.AnimationGroup == undefined) {
            // console.warn(`can not found animation group for skin at node id: ${nodeOfScene.ID}`);
            return;
        }
        for (let animationGroup of nodeOfScene.AnimationGroup) {
            for (let skinAnimation of skinAnimations) {
                animationGroup.addSkinAnimation(skinAnimation);
            }
        }
    }

    /**
     * 获取节点的morph target 数量
     * @param nodeID 节点索引
     * @returns morph target 数量
     */
    getMorphTargetsForNode(nodeID: number): number {
        let node = this.DataLoader.getNode(nodeID);
        if (node == undefined) {
            throw new Error(`node ${nodeID} not found`);
        }
        if (node.mesh == undefined) {
            throw new Error(`node ${nodeID} not found mesh`);
        }
        let mesh = this.DataLoader.getMesh(node.mesh);
        if (mesh == undefined) {
            throw new Error(`mesh ${node.mesh} not found`);
        }
        let stride = mesh.primitives[0].targets.length;
        return stride;
    }
    /**
     * 初始化动画
     * 1、基础动画附加到NodeObject
     * 2、动画组附加到NodeInstanceModel
     */
    async initAnimationsForInstance(nodeOfScene: NodeInstanceModel) {
        let animationGroupsJSON = this.DataLoader.gltfJSON().animations;
        if (animationGroupsJSON == undefined) {
            return;
        }
        if (animationGroupsJSON.length == 0) {
            return;
        }
        let animationGroups: AnimationGroup[] = [];
        for (let i in animationGroupsJSON) {
            let perAnimationGroupJSON = animationGroupsJSON[i];
            let name = perAnimationGroupJSON.name || i;
            let perGroupList: (KeyFrameAnimation | MorphTargetAnimation)[] = [];
            for (let j in perAnimationGroupJSON.channels) {
                let perChannels = perAnimationGroupJSON.channels[j];
                let perSampler = perAnimationGroupJSON.samplers[perChannels.sampler];
                let targetNode = this.instanceNodes.get(nodeOfScene)!.nodes.get(perChannels.target.node);
                let interpolation;
                if (perSampler.interpolation == undefined) {
                    interpolation = E_InterpolationModes.linear;
                }
                else {
                    interpolation = perSampler.interpolation.toLowerCase();
                    if (!Object.values(E_InterpolationModes).includes(interpolation)) {
                        throw new Error(`animation interpolation type ${interpolation} not found`);
                    }
                }
                let frames = await this.getAccessor(perSampler.input, E_accessorUseFor.array) as TypedArray;
                let values = await this.getAccessor(perSampler.output, E_accessorUseFor.array) as TypedArray;

                let targetAnimationType = perChannels.target.path.toLowerCase();
                //gltf rotation 是 四元数
                if (targetAnimationType === E_AnimationTargetType.rotation) {
                    targetAnimationType = E_AnimationTargetType.quaternion;
                }
                else if (targetAnimationType == "translation") {
                    targetAnimationType = E_AnimationTargetType.position;
                }

                if (!Object.values(E_AnimationTargetType).includes(targetAnimationType)) {
                    throw new Error(`animation target type ${targetAnimationType} not found`);
                }


                let targetStride = 4;
                switch (targetAnimationType) {
                    case E_AnimationTargetType.quaternion:
                        targetStride = 4;
                        break;
                    case E_AnimationTargetType.position:
                    case E_AnimationTargetType.scale:
                        targetStride = 3;
                        break;
                    case E_AnimationTargetType.weights:
                        targetStride = this.getMorphTargetsForNode(perChannels.target.node);
                        break;
                    default:
                        throw new Error(`animation target type ${targetAnimationType} not found`);
                }

                let sampler: I_AnimationSampler = {
                    interpolation: interpolation,
                    frames: frames,
                    values: values,
                    target: targetAnimationType,
                    targetStride: targetStride,
                }
                let oneAnimation: KeyFrameAnimation | MorphTargetAnimation;
                if (targetAnimationType === E_AnimationTargetType.weights) {
                    oneAnimation = new MorphTargetAnimation({
                        parent: targetNode!,
                        sampler: sampler,
                    });
                }
                else {
                    oneAnimation = new KeyFrameAnimation({
                        parent: targetNode!,
                        sampler: sampler,
                    });

                }
                perGroupList.push(oneAnimation);
            }
            let animationGroup = new AnimationGroup(
                {
                    animations: perGroupList,
                    scene: this.scene,
                    parent: nodeOfScene,
                    name,
                }
            );
            animationGroups.push(animationGroup);
        }
        nodeOfScene.AnimationGroup = animationGroups;
    }
    initCamerasForInstance() { }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 继承BaseModel的方法
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    _destroy(): void {
    }

    async readyForGPU(): Promise<any> {
        //已经在new时传入了GPUDevice，不需要再进行ready工作。
    }
    updateSelf(clock: Clock): void {
        //1、更新mesh的update，按照node tree
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //init part
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /** 释放模型原始资源  */
    detachData(): void {
        throw new Error("Method not implemented.");
    }
    /**初始化模型数据,
     * 1. 解析模型数据,GPUBuffer(attributes),GPUTexture,image,
     * 2. 初始化模型数据,meshes,materials,animations,cameras
     * 3. 初始化模型数据,
     */
    async initData(DataLoader: GltfDataAtLoaders) {
        this.DataLoader = DataLoader;
        // if (this.gltfType == "gltf") {
        //     this.gltfJson = (this.modelData as GLTFWithBuffers).json;
        //     // this.modelGltfBuffers = (this.modelData as GLTFWithBuffers).buffers;
        // }
        // else if (this.gltfType == "glb") {
        //     this.gltfJson = ((this.modelData as GLB).json as GLTF);
        //     // this.modelGltfBuffers = (this.modelData as GLB).binChunks;
        // }
        // this.initBufferViews();
        // this.initAccessors();//改为，获取accessor数据并按需创建GPUBuffer
        await this.initGPUTextures();
        this.initSamplers();
        await this.initTextures();
        this.initMaterials();
        await this.initMeshes();
        // this.initAnimationSamplers();
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
     * 获取资源,根据资源类型(T_ModelResKind)和资源id获取资源
     * @param kind 资源类型
     * @param id 资源id
     * @returns 资源<T>或false
     */
    getRes<T>(kind: T_ModelResKind, id: number | string): T | false {
        let key = id;
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
        console.warn(`GLTFModel: getRes ${kind} : ${key} not found`);
        return false;
    }

    /**
     * 初始化采样器
     * 1、初始化默认采样器：linear
     * 2、按照gltf的sampler，初始化采样器
     */
    initSamplers() {
        let defaultSampler = this.scene.resourcesGPU.getSampler("linear");
        this.modelRes.sampler.set("default", defaultSampler);
        let samplers = this.DataLoader.getSamplers();

        if (samplers) {
            for (let i in samplers) {
                let perSamplerData = samplers[i];
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

    }
    async initGPUTextures() {
        let defaultGPUTexture = this.scene.resourcesGPU.textureOfString.get("default");
        this.modelRes.GPUTexture.set("default", defaultGPUTexture);
        let images = this.DataLoader.getImages();
        if (images) {
            for (let i in images) {
                let perImageData = await this.DataLoader.getImage(Number(i));
                if (!perImageData) {
                    continue;
                }
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
    /**
     * 初始化纹理
     * 1、按照gltf的texture，初始化纹理
     */
    async initTextures() {
        let defaultTexture = this.scene.resourcesGPU.weTextureOfString.get("default");
        this.modelRes.texture.set("default", defaultTexture);
        let textures = this.DataLoader.getTextures();

        if (textures)
            for (let i in textures) {
                let perTextureData = textures[i];
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

        let materials = this.DataLoader.getMaterials();
        if (materials)
            for (let i in materials) {
                let perMaterialData = materials[i];
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
        let meshes = this.DataLoader.getMeshes();
        if (meshes) {
            // console.log("meshes.count ", meshes.length);
            for (let i in meshes) {
                let meshSource = meshes[i];
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
                    let cullMode: GPUCullMode = "back";
                    if (primitive.material != undefined) {
                        let materialDataSource = this.DataLoader.getMaterial(primitive.material);
                        if (materialDataSource.doubleSided && materialDataSource.doubleSided === true) {
                            cullMode = "none";
                        }
                        console.log("cullMode ", cullMode, materialDataSource.doubleSided);
                    }
                    // else
                    //     console.log("primitive ", primitive);
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
                    let verticesOfDataOfEntity = await this.getVerticesOfPrimitive(primitive, i, j);
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    //gpubuffer of index and draw mode   part
                    let indecis = await this.getIndecisOfPrimitive(primitive, i, j);
                    let drawMode = indecis.drawMode;
                    let indicesOfDataOfEntity = indecis.indecis;
                    let stripIndexFormat = indecis.stripIndexFormat;
                    /////////////////////////////////////////////////////////////////////////////////////////////////////
                    // primitive of render
                    let primitiveOfDataOfRender: GPUPrimitiveState = {
                        topology: "triangle-strip",
                        // cullMode: "none",//双面
                        cullMode: cullMode,
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
                                cullMode: cullMode,
                                // cullMode: "back",
                                // cullMode: "none",//双面
                            }
                            break;
                        case 5: //triangle strip
                            primitiveOfDataOfRender = {
                                topology: "triangle-strip",
                                cullMode: cullMode,
                                stripIndexFormat: stripIndexFormat,//设置索引缓冲区的格式
                                // stripIndexFormat: "uint16",
                            }
                            break;
                        case 6: //triangle fan，webgpu没有fan，转为list ，相关数据index在获取时已经转换
                            primitiveOfDataOfRender = {
                                topology: "triangle-list",
                                cullMode: cullMode,
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
                                // indices: [0, 1, 2],
                                indices: indicesOfDataOfEntity,//索引缓冲区，可以为undefined(无index)
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
        else {
            throw new Error(`gltf not found meshes`);
        }
    }
    /** 获取primitive的顶点数据 
     * @param primitive primitive数据
     * @param meshID meshID
     * @param primitiveID primitiveID
     * @returns 顶点数据集合
    */
    async getVerticesOfPrimitive(primitive: any, meshID: string, primitiveID: string): Promise<{ [name: string]: I_vsGPUBufferBundle }> {
        let verticesOfDataOfEntity: {
            [name: string]: I_vsGPUBufferBundle
        } = {};
        for (let k in primitive.attributes) {
            let oneAttribute = primitive.attributes[k];
            let accessor = await this.DataLoader.getAccessor(oneAttribute, E_accessorUseFor.vertex);
            // let accessor = this.modelRes.accessor.get(oneAttribute.toString());
            if (accessor == undefined) {
                console.warn(`mesh ${meshID} primitive ${primitiveID} attribute ${k} not found accessor`);
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
                nameOfAttribute = "weights";
            }

            verticesOfDataOfEntity[nameOfAttribute] = accessor as I_vsGPUBufferBundle;
        }
        if ("normal" in verticesOfDataOfEntity == false && (primitive.mode == undefined || primitive.mode == 4 || primitive.mode == 5 || primitive.mode == 6)) {//如果没有法线，计算法线
            let positionAccessorID = primitive.attributes["POSITION"];
            // let positionAccessor = this.modelData.json.accessors[positionAccessorID];
            let normalAccessorID = positionAccessorID + "_normal";
            let alreadyNormal = this.modelRes.accessor.has(normalAccessorID);
            if (alreadyNormal) {
                verticesOfDataOfEntity["normal"] = this.modelRes.accessor.get(normalAccessorID) as I_vsGPUBufferBundle;
            }
            else {
                let positions = this.DataLoader.getAccessorForByte(positionAccessorID) as Float32Array;
                // let positions = this.getBufferSourceForAccessor(positionAccessor) as Float32Array;
                let normalAccessorBufferSource: I_vsGPUBufferBundle;
                let gpuBuffer: GPUBuffer;
                if ("indices" in primitive) {//如果有索引，根据索引计算法线
                    let indicesAccessorID: number = primitive["indices"]!;
                    // let indicesAccessor = this.modelData.json.accessors[indicesAccessorID];
                    let indices = this.DataLoader.getAccessorForByte(indicesAccessorID) as Uint32Array;
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
        if (primitive.targets)
            for (let k in primitive.targets) {
                let index = Number(k) + 1;
                let oneAttribute = primitive.targets[k]["POSITION"];
                let accessor = await this.DataLoader.getAccessor(oneAttribute, E_accessorUseFor.vertex);
                verticesOfDataOfEntity["position_" + index] = accessor as I_vsGPUBufferBundle;
            }
        return verticesOfDataOfEntity;
    }
    /** 获取primitive的索引缓冲区和drawMode 
     * @param primitive primitive
     * @param meshID meshID
     * @param primitiveID primitiveID
     * @returns {indecis:T_indexAttribute | undefined,drawMode: I_drawMode | I_drawModeIndexed} 索引缓冲区和drawMode
    */
    async getIndecisOfPrimitive(primitive: any, meshID: string, primitiveID: string): Promise<
        {
            indecis: T_indexAttribute | undefined,
            drawMode: I_drawMode | I_drawModeIndexed,
            stripIndexFormat: GPUIndexFormat,
        }> {
        //strip index format default uint16,strip 存在，index一定存在，且stripIndexFormat 为 indexAttribute 的格式
        let indicesOfDataOfEntity: T_indexAttribute | undefined;
        let stripIndexFormat: GPUIndexFormat = "uint16";//gltf中一般默认uint16
        //index accessor 转义we interface，可以为undefined(无index)
        let drawMode: I_drawMode | I_drawModeIndexed;
        if (primitive.indices != undefined) {                //index 
            let idOfaccessors = primitive.indices;
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

            indicesOfDataOfEntity = indexAttribute as I_indexGPUBufferBundle;
            drawMode = {
                indexCount: (indexAttribute as I_indexGPUBufferBundle).count,
            }
        }
        else {                                                          // draw mode
            let count: number;
            if (primitive.attributes.POSITION != undefined) {
                let position = this.DataLoader.getAccessorOfSource(primitive.attributes.POSITION);
                if (position == undefined) {
                    throw new Error(`mesh ${meshID} primitive ${primitiveID} attribute position not found accessor`);
                }
                count = position.count;
            }
            else {
                throw new Error(`mesh ${meshID} primitive ${primitiveID} don't have POSITION attribute`);
            }
            drawMode = {
                vertexCount: count,
            }
        }
        return { indecis: indicesOfDataOfEntity, drawMode, stripIndexFormat };
    }
    /** 获取accessor */
    getAccessor(idOfaccessors: any, useFor: E_accessorUseFor) {
        return this.DataLoader.getAccessor(idOfaccessors, useFor);
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
}





