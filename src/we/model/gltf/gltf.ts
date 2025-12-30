import { Clock } from "../../core/scene/clock";
import { BaseModel, I_Model, T_ModelResKind } from "../../core/model/BaseModel";
import { load } from '@loaders.gl/core';
import { DracoLoader } from "@loaders.gl/draco";
import { GLB, GLTF, GLTFAccessor, GLTFLoader, GLTFNode, GLTFScene, GLTFWithBuffers } from '@loaders.gl/gltf';
import { GLBLoader } from '@loaders.gl/gltf';
import { Scene } from "../../core/scene/scene";
import { RootGPU } from "../../core/organization/root";
import { cloneBufferSource, createCommonGPUBuffer, createIndexBuffer, createUniformBuffer, createVerticesBuffer } from "../../core/command/baseFunction";
import { I_indexGPUBufferBundle, I_vsGPUBufferBundle, T_indexAttribute } from "../../core/command/DrawCommandGenerator";
import { IV_MeshEntity, Mesh } from "../../core/entity/mesh/mesh";
import { IV_PointsEntity, Points } from "../../core/entity/mesh/points";
import { IV_LinesEntity, Lines } from "../../core/entity/mesh/lines";
import { IV_PBRMaterial, PBRMaterial } from "../../core/material/PBR/PBRMaterial";
import { I_drawMode, I_drawModeIndexed, T_BindGroupLayout, T_uniformGroups } from "../../core/command/base";
import { ColorMaterial } from "../../core/material/standard/colorMaterial";
import * as BaseFunction from "./function";
import { BaseEntity } from "../../core/entity/baseEntity";
import { NodeEntity } from "../../core/entity/nodeEntity";
import { weVec3, weVec4 } from "../../core/base/coreDefine";
import { mat4 } from "wgpu-matrix";

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


export type T_accessorBufferSource = GPUBufferBinding | I_vsGPUBufferBundle | I_indexGPUBufferBundle;

export class GLTFModel extends BaseModel {
    modelData: GLTFWithBuffers | GLB;
    filePath: string;
    gltfType: "gltf" | "glb";
    // scenes: any[] = [];
    // nodes: any[] = [];
    modelGltfBuffers: any[] = [];
    modelAccessors: T_accessorBufferSource[] = [];
    /** gltf当前场景索引 */
    currentScene: number = 0;

    constructor(input: I_GLTFModel) {
        super(input);
        this.gltfType = input.type;
        this.filePath = input.url;
        if (input.name) {
            this._name = input.name;
        }
        this.modelData = input.data;
        this.scene = input.scene;
        this.device = input.scene.device;
    }
    /**
     * 初始化模型数据,
     * 1. 解析模型数据,GPUBuffer(attributes),GPUTexture,image,
     * 2. 初始化模型数据,meshes,materials,animations,cameras
     * 3. 初始化模型数据,
     */
    async initData() {
        if (this.gltfType == "gltf") {
            this.modelGltfBuffers = (this.modelData as GLTFWithBuffers).buffers
        }
        else if (this.gltfType == "glb") {
            this.modelGltfBuffers = (this.modelData as GLB).binChunks;
        }
        this.initDefaultMaterial();
        this.initBufferViews();
        this.initAccessors();
        this.initMeshes();
        this.initTextures();
        this.initMaterials();
        this.initCameras();
        this.initNodes();
        this.initAnimations();
        // this.initScene();
    }

    /**
     * 初始化bufferViews,创建GPUBuffer
     * 1、accessor 中type为：SCALAR|VEC3,且componentType为：5120|5121|5122|5123 ,即（sint8|uint8|sint16|uint16）。需要将其转换为u32x3。
     */
    initBufferViews() {
        let imagesInBufferView = this.checkImagesInBufferview();
        for (let i in this.modelData.json.bufferViews) {
            if (imagesInBufferView.indexOf(Number(i)) != -1) continue;
            let bufferView = this.modelData.json.bufferViews[i];
            let buffer = this.modelGltfBuffers[bufferView.buffer].arrayBuffer;
            // // 检查是否需要新构建buffer
            // let checkResult = checkRebulidBufferForVec3(bufferView, this.modelData.json.accessors);
            // if (checkResult.status) {
            //     buffer = newBuffer;
            // }
            let gpuBuffer = createCommonGPUBuffer(this.device, bufferView.name || i, buffer, bufferView.byteOffset, bufferView.byteLength);
            // this.modelGPUBuffers.push(gpuBuffer);
            this.modelRes.GPUBuffers.set(i, gpuBuffer);
        }
    }
    /**
     * 检查images是否在bufferView中,如果在,则不需要创建GPUBuffer
     */
    checkImagesInBufferview(): number[] {
        let imagesInBufferView: number[] = [];
        for (let i in this.modelData.json.images) {
            let imageView = this.modelData.json.images[i];
            if (typeof imageView.bufferView == "number") {
                imagesInBufferView.push(imageView.bufferView);
            }
        }
        return imagesInBufferView;
    }

    async initAccessors() {
        for (let i in this.modelData.json.accessors) {
            let accessor = this.modelData.json.accessors[i];
            let bufferView = this.modelData.json.bufferViews[accessor.bufferView];
            let accessorBufferSource: T_accessorBufferSource;
            let buffer = this.modelRes.GPUBuffers.get(accessor.bufferView.toString());
            if (!buffer) {
                throw new Error(`GLTFModel: accessor ${i} bufferView ${accessor.bufferView} not found`);
            }
            // if (bufferView.target) {
            if (bufferView.target && bufferView.target == 34963) {
                accessorBufferSource = {
                    buffer: buffer,
                    format: BaseFunction.getAccessorTypeForGPUIndexFormat(accessor),
                    name: accessor.name || i,
                    // arrayStride: g;tfGetAccessorByteStride(accessor),
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
                    size: BaseFunction.getAccessorSize(accessor, bufferView).size,
                } as I_indexGPUBufferBundle;
            }
            else if (bufferView.target == 34962) {
                let size = BaseFunction.getAccessorSize(accessor, bufferView).size;
                let arrayStride = BaseFunction.getAccessorByteStride(accessor, bufferView);

                //获取对应的wgsl的format
                const { format, wgslFormat } = BaseFunction.getAccessorTypeForGPUVertexFormat(accessor);
                // let buffer = this.modelGPUBuffers[accessor.bufferView]
                let reBuildBuffer = BaseFunction.checkRebulidBufferForVec3(accessor);
                // 检查是否需要新构建buffer
                if (reBuildBuffer) {
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
                    buffer = createCommonGPUBuffer(this.device, bufferView.name || i, newBuffer, 0, countsOfVec3);
                    size = countsOfVec3 * arrayStride;
                }
                accessorBufferSource = {
                    buffer: buffer,
                    format: format,
                    wgslFormat: wgslFormat,
                    name: accessor.name || i,
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
                    size: size,
                    min: accessor.min,
                    max: accessor.max,
                } as I_vsGPUBufferBundle;
            }
            else if (accessor.sparse) {
                //sparse
                let bufferAttribute: ArrayBuffer;

                // webGPU的属性格式和wgsl中的格式
                const { format, wgslFormat } = BaseFunction.getAccessorTypeForGPUVertexFormat(accessor);
                // 访问器的字节步长，每个元素占用的字节数
                let arrayStride = BaseFunction.getAccessorByteStride(accessor, bufferView);
                // 访问器的元素数量：数量*组件构成数量
                let size = BaseFunction.getAccessorSize(accessor, bufferView).size;
                // let buffer = this.modelGPUBuffers[accessor.bufferView]
                let reBuildBuffer = BaseFunction.checkRebulidBufferForVec3(accessor);
                // 检查是否需要新构建buffer
                if (reBuildBuffer) {
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
                let gpuBufferAttribute = createCommonGPUBuffer(this.device, bufferView.name || i, bufferAttribute, byteOffset, bufferAttribute.byteLength);
                // 构建对应的GPUBufferBundle

                accessorBufferSource = {
                    buffer: gpuBufferAttribute,
                    format: format,
                    wgslFormat: wgslFormat,
                    name: accessor.name || i,
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
                    size: size,
                    min: accessor.min,
                    max: accessor.max,
                } as I_vsGPUBufferBundle;

            }
            else {
                throw new Error(`GLTFModel: accessor ${i} bufferView ${accessor.bufferView} target ${bufferView.target} not support`);
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
            this.modelRes.accessor.set(i, accessorBufferSource);

        }
    }
    /**
     * 获取accessor的数据来源,BufferSource
     * 1、为webgpu不支持的类型，获取原始数据，重构GPUBuffer使用
     * @param accessor 
     * @returns Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array
     */
    getBufferSourceForAccessor(accessor: GLTFAccessor): Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array {
        let bufferView = this.modelData.json.bufferViews[accessor.bufferView];
        let componentType = accessor.componentType;
        let byteOffset = (accessor.byteOffset || 0) + (bufferView.byteOffset || 0);
        let { size, unitByteSize, byteStride, componentSize, typeSize } = BaseFunction.getAccessorSize(accessor, bufferView);
        //数据元素是紧密排列的。
        if (byteStride === 0) {
            return BaseFunction.getBufferSourceOfArrayBuffer(this.modelGltfBuffers[bufferView.buffer].arrayBuffer, componentType, byteOffset, size);
        }
        else if (byteStride == unitByteSize) {
            return BaseFunction.getBufferSourceOfArrayBuffer(this.modelGltfBuffers[bufferView.buffer].arrayBuffer, componentType, byteOffset, size);
        }
        //数据元素是有跨度排序的，多个原始||有填充
        else {

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
        let bufferView = this.modelData.json.bufferViews[bufferViewIndex];
        let offset = (bufferView.byteOffset || 0) + byteOffset;
        let size = count * BaseFunction.getTypeSize(type);
        return BaseFunction.getBufferSourceOfArrayBuffer(this.modelGltfBuffers[bufferView.buffer].arrayBuffer, componentType, offset, size);
    }

    /**
     * 测试使用
     * 打印accessor的内容
     * gltf.printAccessorContent(0)
       gltf.printAccessorContent(1)
     * @param accessor  index 访问器索引
     */
    printAccessorContent(accessorIndex: number) {
        let accessor = this.modelData.json.accessors[accessorIndex];
        let buffer = this.getBufferSourceForAccessor(accessor);
        console.log(buffer);
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
    initDefaultMaterial() {
        // this.modelRes.material.set("default", this.scene.resourcesGPU.weMaterialOfString.get("defaultPBR"));
        let colorMaterial = new ColorMaterial({
            color: [1, 0, 0, 1],
        });
        this.modelRes.material.set("default", colorMaterial);
    }

    getUniformBundleOfEntity(mesh: any): { uniforms: T_uniformGroups[], unifromLayout: T_BindGroupLayout[] } {
        let uniforms: T_uniformGroups[] = [];
        let unifromLayout: T_BindGroupLayout[] = [];

        return { uniforms, unifromLayout };
    }
    getRes<T>(kind: T_ModelResKind, id: number | string): T | false {
        // this.getResOfT<GPUBuffer>(T_ModelResKind.entity, "default");
        let key: string;
        if (typeof id == "number") {
            key = id.toString();
        }
        else {
            key = id;
        }
        if (kind == T_ModelResKind.accessor) {
            if (this.modelRes.accessor.has(key)) {
                let value = this.modelRes.accessor.get(key);
                return value as T;
            }
        }
        else if (kind == T_ModelResKind.material) {
            if (this.modelRes.material.has(key)) {
                return this.modelRes.material.get(key) as T;
            }
        }
        else if (kind == T_ModelResKind.entity) {
            if (this.modelRes.entity.has(key)) {
                return this.modelRes.entity.get(key) as T;
            }
        }
        else if (kind == T_ModelResKind.animation) {
            if (this.modelRes.animation.has(key)) {

                return this.modelRes.animation.get(key) as T;
            }
        }
        else if (kind == T_ModelResKind.GPUBuffers) {
            if (this.modelRes.GPUBuffers.has(key)) {
                return this.modelRes.GPUBuffers.get(key) as T;
            }
        }
        else if (kind == T_ModelResKind.GPUTexture) {
            if (this.modelRes.GPUTexture.has(key)) {
                return this.modelRes.GPUTexture.get(key) as T;
            }
        }
        else {
            throw new Error(`GLTFModel: getRes ${kind} not found`);
        }
        console.warn(`GLTFModel: getRes ${kind} : ${key} not found`);
        return false;
    }


    initMeshes() {
        for (let i in this.modelData.json.meshes) {
            let meshSource = this.modelData.json.meshes[i];
            for (let j in meshSource.primitives) {
                let primitive = meshSource.primitives[j];
                let primitiveMode = primitive.mode;
                if (primitiveMode == undefined) {
                    primitiveMode = 4;
                }
                let name = meshSource.name ?? i;
                //enity 属性
                let inputEntity: IV_MeshEntity | IV_PointsEntity | IV_LinesEntity;

                let materialOfPerEntity;
                if (primitive.material == undefined) {
                    materialOfPerEntity = this.getRes(T_ModelResKind.material, "default");
                    // materialOfPerEntity = <PBRMaterial> this.getRes(T_ModelResKind.material,"default");
                    // materialOfPerEntity = this.modelRes.material.get("default");
                }
                else {
                    materialOfPerEntity = this.modelRes.material.get(primitive.material);
                    if (materialOfPerEntity == undefined) {
                        throw new Error(`mesh ${name} primitive ${j} material ${primitive.material} not found`);
                    }
                }
                let verticesOfDataOfEntity: {
                    [name: string]: I_vsGPUBufferBundle
                } = {};
                for (let k in primitive.attributes) {
                    let oneAttribute = primitive.attributes[k];
                    let accessor = this.modelRes.accessor.get(oneAttribute.toString());
                    if (accessor == undefined) {
                        console.warn(`mesh ${name} primitive ${j} attribute ${k} not found accessor`);
                        continue;
                    }
                    verticesOfDataOfEntity[k.toLowerCase()] = accessor;
                }

                let primitiveOfDataOfRender: GPUPrimitiveState = {
                    topology: "triangle-strip",
                };
                switch (primitiveMode) {
                    case 0: //point
                        primitiveOfDataOfRender = {
                            topology: "point-list",
                        }
                        break;
                    case 1: //line
                        primitiveOfDataOfRender = {
                            topology: "line-list",
                        }
                        break;
                    case 2: //line loop
                        primitiveOfDataOfRender = {
                            topology: "line-list",
                        }
                        break;
                    case 3: //line strip
                        primitiveOfDataOfRender = {
                            topology: "line-strip",
                        }
                        break;
                    case 4: //triangle
                        primitiveOfDataOfRender = {
                            topology: "triangle-list",
                            cullMode: "none",
                        }
                        break;
                    case 5: //triangle strip
                        primitiveOfDataOfRender = {
                            topology: "triangle-strip",
                        }
                        break;
                    case 6: //triangle fan
                        break;
                    default:
                        throw new Error("primitiveMode not support");
                }

                let indexesOfDataOfEntity: T_indexAttribute | undefined;
                let drawMode: I_drawMode | I_drawModeIndexed;
                if (meshSource.primitives[0].indices != undefined) {
                    let idOfaccessors: string = meshSource.primitives[0].indices.toString();
                    let indexAttribute = this.modelRes.accessor.get(idOfaccessors);
                    if (indexAttribute == undefined) {
                        throw new Error(`mesh ${name} primitive ${j} indices ${idOfaccessors} not found accessor`);
                    }
                    indexesOfDataOfEntity = indexAttribute;
                    drawMode = {
                        indexCount: indexAttribute.count,
                    }
                }
                else {
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
                // let { uniforms, unifromLayout } = this.getUniformBundleOfEntity(meshSource);
                inputEntity = {
                    name: name,
                    attributes: {
                        data: {
                            vertices: verticesOfDataOfEntity,
                            // indexes: [0, 1, 2],
                            indexes: indexesOfDataOfEntity,
                        },
                    },
                    primitive: primitiveOfDataOfRender,
                    drawMode,
                    material: materialOfPerEntity,
                };

                let entity: Mesh | Points | Lines;
                if (primitiveMode == 4 || primitiveMode == 5) {
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

                this.modelRes.entity.set(i, entity);

                // this.scene.add(entity);
            }
        }
    }

    initTextures() {

    }

    initMaterials() {

    }

    initNodes() {

    }
    initSkins() {

    }
    initAnimations() {

    }
    initCameras() {

    }
    async initScene(id: number = 0) {
        let scene: GLTFScene = this.getSceneByIndex(id);
        if (scene == undefined) {
            throw new Error(`scene ${id} not found`);
        }
        let nodes: number[] = [];
        if (scene.nodes != undefined) {
            nodes = scene.nodes as number[];
        }
        else {
            console.warn(`scene ${id} not found nodes`);
            return;
        }
        this.currentScene = id;
        /**
         *  push mesh to children
         */
        for (let nodeID of nodes) {
            await addChildMesh(this, nodeID, this);
        }
    }
    getSceneByIndex(index: number = 0): GLTFScene {
        return this.modelData.json.scenes[index];
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
    _destroy(): void {

    }

    //被parent的addChild调用
    async init(scene: Scene, parent?: RootGPU, renderID?: number): Promise<number> {
        if (parent) {
            this.parent = parent;
        }
        if (renderID) {
            this.renderID = renderID;
        }
        else {
            this.renderID = 0;
        }
        await this.initScene();
        await this.setRootENV(scene);
        // await this.readyForGPU();
        return this.renderID + 1;
    }

    async readyForGPU(): Promise<any> {
        //已经在new时传入了GPUDevice，不需要再进行ready工作。
    }


    detectData(): void {
        throw new Error("Method not implemented.");
    }

    updateSelf(clock: Clock): void {
        //1、更新mesh的update，按照node tree
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
}



async function addChildMesh(gltf: GLTFModel, nodeID: number, parent: RootGPU): Promise<any> {

    let node: GLTFNode = gltf.modelData.json.nodes[nodeID];
    let mesh: BaseEntity | RootGPU;
    {
        if (node.mesh !== undefined && typeof node.mesh == "number") {//有mesh，就添加到parent中
            mesh = <BaseEntity>gltf.getRes(T_ModelResKind.entity, node.mesh);
            if (node.matrix !== undefined) {
                // mesh.setMatrix(node.matrix);
            }
            else {
                if (node.scale !== undefined) {
                    // mesh.setScale(node.scale);
                }
                else if (node.rotation !== undefined) {
                    // mesh.setRotation(node.rotation);
                }
                else if (node.translation !== undefined) {
                    // mesh.setPosition(node.translation);
                }
            }
            if (node.name !== undefined) {
                mesh.Name = node.name;
            }
            //morph target，设置权重与mesh的权重相同，会被override，node的权重会被忽略
            if (node.weights !== undefined) {
                // mesh.setWeights(node.weights);
            }
            await parent.addChild(mesh);
        }
        else {//没有mesh，就添加一个nodeEntity
            mesh = new NodeEntity();
            await parent.addChild(mesh);
        }
        if (node.scale !== undefined) {
            mesh.Scale = node.scale as weVec3;
        }
        if (node.rotation !== undefined) {
            mesh.Quaternion = node.rotation as weVec4;
        }
        if (node.translation !== undefined) {
            mesh.Position = node.translation as weVec3;
        }
        if (node.matrix !== undefined) {
            mesh.Matrix = mat4.create(...node.matrix);
        }

        if (node.children) {
            let children = node.children as number[];
            for (let childID of children) {
                await addChildMesh(gltf, childID, mesh);
            }
        }

        if (node.camera !== undefined) {
            // let camera = gltf.modelData.json.cameras[node.camera];
            // let cameraEntity = new CameraEntity(camera);
            // await mesh.addChild(cameraEntity);
        }
        if ("skin" in node) {

        }

        if (node.extensions !== undefined) {
            // if (node.extensions["KHR_morph_targets"] !== undefined) {
            //     let morphTarget = node.extensions["KHR_morph_targets"];
            //     if (morphTarget.weights !== undefined) {
            //         // mesh.setWeights(morphTarget.weights);
            //     }
            // }
        }
    }
}