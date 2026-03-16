/**
 * 实体的geometry和material的bundle
 * 1、为了简化 mesh 、points、lines的相同功能的代码
 *  A、主要是material在forward 、MSAA、defer中存在大量相同功能的代码
 *  B、在TT、TTP、TTPF上也基本一致。
 *      a、wireframe无透明
 *      b、points无透明，points-Emulate作为mesh处理
 * 2、无功能性扩展，只是共性收集与处理
 * 3、非共性或功能不相同的，各自实现
 */
import { TypedArray } from "webgpu-utils";
import { E_lifeState, E_renderForDC } from "../base/coreDefine";
import { I_drawMode, I_drawModeIndexed, isDrawModeIndexed, isDrawModeVertex } from "../command/base";
import { DrawCommand } from "../command/DrawCommand";
import { isIndexGPUBufferBundle, isVsAttributeMerge, isVSGPUBufferBundle, IV_DC, vsAttribute } from "../command/DrawCommandGenerator";
import { BaseGeometry } from "../geometry/baseGeometry";
import { BaseLight } from "../light/baseLight";
import { I_BundleOfMaterialForMSAA, I_materialBundleOutput } from "../material/base";
import { BaseMaterial } from "../material/baseMaterial";
import { boundingBox } from "../math/Box";
import { E_renderPassName } from "../scene/renderManager";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate } from "../shadermanagemnet/base";
import { I_EntityAttributes, I_EntityBundleMaterial, I_EntityBundleOutput, I_vsfsBundle } from "./base";
import { BaseEntity } from "./baseEntity";
import { createIndexBuffer, createVerticesBuffer } from "../command/baseFunction";



export abstract class EntityBundleMaterial extends BaseEntity {
    declare inputValues: I_EntityBundleMaterial;
    /**mesh的geometry内部对象，获取attribute使用 */
    _geometry: BaseGeometry | undefined;
    /**
     * mesh的material内部对象，获取uniform、bindingroup字符串、SHT等使用
     */
    _material!: BaseMaterial;
    /** 顶点数据 */
    attributes: I_EntityAttributes = {
        vertices: {},
        vertexStepMode: "vertex",
        indices: [],
    };

    /**
     * 更新顶点数据，
     * 1、如果是数组形式，直接更新
     * 2、如果是vsAttribute，更新data   
     * 3、其他暂时不支持，没有必要
     * @param name 顶点数据的名称
     * @param data 顶点数据
     * @param option 顶点数据的类型和步长
     * @returns 
     */
    setVertexBuffer(name: string, data: number[], option?: { type?: "float32" | "int32" | "uint32", stride?: number }) {
        let replaceTarget = this.attributes.vertices[name];
        if (isVSGPUBufferBundle(this.attributes.vertices[name]) && isVsAttributeMerge(replaceTarget)) {
            console.warn("EntityBundleMaterial: setVertexAndIndexBuffers, merge attribute and gpu buffer attribute, not support set data");
            return;
        }
        else {
            /*
             * 一、更新this.attributes.vertices[name]
             * 1、是数组形式
             * 2、是vsAttribute： if ("format" in value && "data" in value)
             *
             * 二、GPUBuffer
             * 1、删除旧的vertexBuffer，
             * 2、创建新的vertexBuffer
             *  
             * 三、更新this.cameraDC
             *  
             * 四、更新shadowmapDC
             * 
             */
            //1.1 更新this.attributes.vertices[name]
            if ("format" in replaceTarget && "data" in replaceTarget) {
                (this.attributes.vertices[name] as vsAttribute).data = data;
            }
            else {
                this.attributes.vertices[name] = data;
            }

            //2.1 删除旧的vertexBuffer
            let vertexBuffer = this.resourcesGPU.vertices.get(replaceTarget);
            this.resourcesGPU.vertices.delete(replaceTarget);
            vertexBuffer?.destroy();

            let arrayBuffer;
            if (option?.type == "int32") {
                arrayBuffer = new Int32Array(data);
            }
            else if (option?.type == "uint32") {
                arrayBuffer = new Uint32Array(data);
            }
            else {
                arrayBuffer = new Float32Array(data);
            }
            //2.2 创建新的vertexBuffer
            vertexBuffer = createVerticesBuffer(this.device, `${this.ID} rebuild ${name} `, arrayBuffer);

            //3.1  更新cameraDC队列
            for (let i in this.cameraDC) {
                let perGroupDC = this.cameraDC[i];
                const dcGroups = Object.values(perGroupDC); // DrawCommand[][]
                for (let perArrayDC of dcGroups) {
                    for (let perDC of perArrayDC) {
                        for (let perVertexBuffer of perDC.vertexBuffers) {
                            if (perVertexBuffer.name == name) {
                                perVertexBuffer.buffer = vertexBuffer;
                            }
                        }
                    }
                }
            }
            //3.2 更新shadowmapDC队列
            for (let i in this.shadowmapDC) {
                let perGroupDC = this.shadowmapDC[i];
                const dcGroups = Object.values(perGroupDC); // DrawCommand[][]
                for (let perArrayDC of dcGroups) {
                    for (let perDC of perArrayDC) {
                        for (let perVertexBuffer of perDC.vertexBuffers) {
                            if (perVertexBuffer.name == name) {
                                perVertexBuffer.buffer = vertexBuffer;
                            }
                        }
                    }
                }
            }

        }
    }
    setIndexBuffer(data: number[], option?: { stride?: number, wireFrame?: boolean }) {
        let wireFrame = "wireframe";
        let isWireFrame = false;
        if (option?.wireFrame == true) {
            isWireFrame = true;
        }
        if (this.attributes.indices) {
            /**
             * 一、更新this.attributes.indices
             * 1、是数组形式
             *
             * 二、GPUBuffer
             * 1、删除旧的vertexBuffer，
             * 2、创建新的vertexBuffer
             *  
             * 三、更新this.cameraDC
             *  
             * 四、更新shadowmapDC
             * 
             */


            let replaceTarget = this.attributes.indices;
            if (Array.isArray(replaceTarget) && data.length > 0) {
                //1.1 更新this.attributes.indices
                this.attributes.indices = data;
                //2.1 删除旧的indexBuffer
                let indexBuffer = this.resourcesGPU.indices.get(replaceTarget);
                this.resourcesGPU.indices.delete(replaceTarget);
                indexBuffer?.destroy();
                //2.2 创建新的indexBuffer
                indexBuffer = createIndexBuffer(this.device, `${this.ID} rebuild indices `, new Uint32Array(data));
                //3.1 更新cameraDC队列
                for (let i in this.cameraDC) {
                    let perGroupDC = this.cameraDC[i];
                    const dcGroups = Object.values(perGroupDC); // DrawCommand[][]
                    for (let perArrayDC of dcGroups) {
                        for (let perDC of perArrayDC) {
                            if (perDC.label.includes(wireFrame) && isWireFrame === false) {
                                continue;
                            }
                            perDC.indexBuffer = indexBuffer;
                        }
                    }
                }
                //3.2 更新shadowmapDC队列
                for (let i in this.shadowmapDC) {
                    let perGroupDC = this.shadowmapDC[i];
                    const dcGroups = Object.values(perGroupDC); // DrawCommand[][]
                    for (let perArrayDC of dcGroups) {
                        for (let perDC of perArrayDC) {
                            if (perDC.label.includes(wireFrame) && isWireFrame === false) {
                                continue;
                            }
                            perDC.indexBuffer = indexBuffer;
                        }
                    }
                }

            }
            else {
                console.warn("EntityBundleMaterial: setIndexBuffer, only array type, not support set data");
                return;
            }
        }
    }


    checkMorphTargetCount(count: number): boolean {
        // throw new Error("EntityBundleMaterial: checkMorphTargetCount not implemented");
        let countFromAttribute = 0;
        for (let key in this.attributes.vertices) {
            if (key.indexOf("position_") == 0) {
                countFromAttribute++;
            }
        }
        this._morphTargetWeightsCount = countFromAttribute;
        return countFromAttribute == count;
    }

    detachData(): void {
        this.inputValues.attributes.geometry = undefined;
        this.inputValues.attributes.data = undefined;

        // this._geometry?.destroy();
        this._geometry = undefined;
        this.attributes.vertices = {};
        this.attributes.indices = [];
    }
    /**
     * 状态检查，是否已经完成初始化。updateSelf()中调用
     * @returns 是否完成初始化
     */
    checkStatus(): boolean {
        let readyForMaterial: boolean;
        //完成状态，正常情况
        if (this._material.getReady() == E_lifeState.finished) {
            readyForMaterial = true;
        }
        //更新状态，需要重新初始化
        else if (this._material.getReady() == E_lifeState.updated) {
            readyForMaterial = true;
        }
        else {
            readyForMaterial = false;
        }
        return readyForMaterial;
    }


    /**
     * 获取blend状态
     * 20251008，目前获取blend的状态不在使用此function
     * @returns 
     */
    getBlend(): GPUBlendState | undefined {
        return this._material.getBlend();
    }
    /**
     * 从材质获取是否为透明材质
     * @returns  boolean
     */
    getTransparent(): boolean {
        return this._material.getTransparent();
    }
    /** 生成原始包围盒，基于当前entity的原始包围盒，不涉及变换 */
    generateBox(position: number[]): boundingBox {
        //gltf 模型的box，需要从模型中获取
        if (this.inputValues.attributes &&
            this.inputValues.attributes.data &&
            this.inputValues.attributes.data.vertices &&
            this.inputValues.attributes.data.vertices.position &&
            isVSGPUBufferBundle(this.inputValues.attributes.data.vertices.position)) {
            let box: boundingBox = {
                min: this.inputValues.attributes.data.vertices.position.min,
                max: this.inputValues.attributes.data.vertices.position.max,
            };
            return box;
        }
        //其他情况，使用父类的方法
        else {
            return super.generateBox(position);
        }
    }
    /**
     * 生成boundingBox和boundingSphere，基于当前entity的原始包围盒和原始包围球，不涉及变换
     */
    generateBoxAndSphere(): void {
        if (this.checkStatus()) {
            let position: number[] = [];
            if (this.attributes.vertices["position"]) {
                position = this.attributes.vertices["position"] as number[];
                // if (position.length)
                {
                    this.boundingBox = this.generateBox(position);
                    this.boundingSphere = this.generateSphere(this.boundingBox);
                }
                // else {
                //     console.warn("Mesh generateBoxAndSphere: position is empty");
                // }
            }
            // else if (this.inputValues.position) {
            //     this.boundingBox = this.generateBox(this.inputValues.position);
            //     this.boundingSphere = this.generateSphere(this.boundingBox);
            // }
            // else {
            //     this.boundingBox = {
            //         min: [0, 0, 0],
            //         max: [0, 0, 0]
            //     };
            //     this.boundingSphere = this.generateSphere(this.boundingBox);
            // }
        }
    }
    getBoundingBoxMaxSize(): number {
        if (this.boundingBox == undefined)
            this.generateBoxAndSphere();
        let box3 = this.boundingBox;
        if (box3) {
            return Math.max(box3.max[0] - box3.min[0], box3.max[1] - box3.min[1], box3.max[2] - box3.min[2]);
        }
        return 0;
    }


    /**
     * 格式化shader代码
     * @param template 
     * @returns string
     */
    formatShaderCode(template: I_singleShaderTemplate, wireFrame: boolean = false): string {
        let code: string = "";
        for (let perOne of template.add as I_shaderTemplateAdd[]) {
            code += perOne.code;
        }
        for (let perOne of template.replace as I_shaderTemplateReplace[]) {
            if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                if (perOne.name == "userCodeVS") {
                    if (wireFrame === false) {  //wireframe 不使用用户自定义代码,此时是wireFrame =false
                        let userCodeVS = this.getUserCodeVS();
                        code = code.replace(perOne.replace, userCodeVS);
                    }
                    else {
                        code = code.replace(perOne.replace, "");
                    }
                }
                else {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
            }
            else if (perOne.replaceType == E_shaderTemplateReplaceType.value) {
                code = code.replace(perOne.replace, this.instance.numInstances.toString());
            }
        }
        return code;
    }
    /**
     * 获取VS 部分uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
     * @param startBinding 
     * @returns uniformGroups: T_uniformGroups[], shaderTemplateFinal: I_ShaderTemplate_Final 
     */
    getVSUniformAndShaderTemplateFinal(SHT_VS: I_ShaderTemplate, startBinding: number = 0, wireFrame: boolean = false): I_EntityBundleOutput {
        //uniform 部分
        // let bindingNumber = startBinding;
        // let uniform1: T_uniformOneGroup = [];

        // let unifrom10: I_uniformArrayBufferEntry = {
        //     label: this.Name + " uniform at group(1) binding(0)",
        //     binding: bindingNumber,
        //     size: this.getSizeOfUniformArrayBuffer(),
        //     data: this.getUniformCommonEntityInfo(),
        //     update: true,
        // };
        // let uniform10Layout: GPUBindGroupLayoutEntry = {
        //     binding: bindingNumber,
        //     visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        //     buffer: {
        //         type: "uniform"
        //     }
        // };

        // let uniform10GroupAndBindingString = " @group(1) @binding(0) var<uniform> entity : ST_entity; \n ";
        // this.scene.resourcesGPU.set(unifrom10, uniform10Layout);
        // bindingNumber++;
        // uniform1.push(unifrom10);
        // //scene 和 entity 的shader模板部分
        // let shaderTemplateFinal: I_ShaderTemplate_Final = {};

        // for (let i in SHT_VS) {
        //     if (i == "scene") {
        //         let shader = this.scene.getShaderCodeOfSHT_SceneOfCamera(SHT_VS[i]);
        //         shaderTemplateFinal.scene = shader.scene;
        //     }
        //     else if (i == "entity") {
        //         shaderTemplateFinal.entity = {
        //             templateString: this.formatShaderCode(SHT_VS[i], wireFrame),
        //             groupAndBindingString: uniform10GroupAndBindingString,
        //             owner: this,
        //         };
        //     }
        // }
        // return { bindingNumber: bindingNumber, uniformGroup: uniform1, shaderTemplateFinal };

        let bindingNumber = 5;
        //scene 和 entity 的shader模板部分
        let shaderTemplateFinal: I_ShaderTemplate_Final = {};
        for (let i in SHT_VS) {
            if (i == "scene") {
                let shader = this.scene.getShaderCodeOfSHT_SceneOfCamera(SHT_VS[i]);
                shaderTemplateFinal.scene = shader.scene;
            }
            else if (i == "entity") {
                shaderTemplateFinal.entity = {
                    templateString: this.formatShaderCode(SHT_VS[i], wireFrame),
                    groupAndBindingString: '',//@group(1) @binding(x)  在shader code 中
                    owner: this.type,
                };
            }
        }
        return { bindingNumber: bindingNumber, uniformGroup: this.bindGroup, shaderTemplateFinal };
    }

    /**
     * drawMode 模板,保存drawMode的模板,后续实例化时使用
     */
    _drawModeTemplate!: I_drawMode | I_drawModeIndexed;
    /**
     * 获取drawMode 模板,如果没有则创建一个
     * @returns I_drawMode | I_drawModeIndexed 
     */
    getDrawModeTemplate(): I_drawMode | I_drawModeIndexed {
        if (this._drawModeTemplate == undefined) {
            let drawMode: I_drawMode | I_drawModeIndexed;
            if (this.inputValues.drawMode != undefined) {
                // if (isDrawModeIndexed(this.inputValues.drawMode)) {
                //     (drawMode as I_drawModeIndexed[]).push(this.inputValues.drawMode);
                // }
                // else if (isDrawModeVertex(this.inputValues.drawMode)) {
                //     (drawMode as I_drawMode[]).push(this.inputValues.drawMode);
                // }
                drawMode = this.inputValues.drawMode;
            }
            else {
                let drawModeMesh: I_drawMode = {
                    vertexCount: 0,
                    firstInstance: 0,
                    instanceCount: 1,
                };
                let drawModeIndexMesh: I_drawModeIndexed = {
                    indexCount: 0,//this.attributes.indices.length,
                    instanceCount: 1,
                    firstIndex: 0,
                    baseVertex: 0,
                    firstInstance: 0,
                }
                //index mode
                // if (scope.attributes.indices) {
                if (Array.isArray(this.attributes.indices) && this.attributes.indices.length > 0) {
                    drawModeIndexMesh.indexCount = this.attributes.indices.length;
                    drawModeIndexMesh.instanceCount = this.instance.numInstances;
                    drawMode = drawModeIndexMesh;
                }
                else if (this.attributes.indices && isIndexGPUBufferBundle(this.attributes.indices)) {
                    drawModeIndexMesh.indexCount = this.attributes.indices.count;
                    drawModeIndexMesh.instanceCount = this.instance.numInstances;
                    drawMode = drawModeIndexMesh;
                }
                //non-index mode
                else {
                    if (this.attributes.vertices["position"]) {
                        let pos = this.attributes.vertices["position"]!;
                        if (isVSGPUBufferBundle(pos)) {
                            drawModeMesh.vertexCount = pos.count;
                        }
                        else if ("count" in pos) {//vsAttribute | vsAttributeMerge |I_vsGPUBufferBundle
                            drawModeMesh.vertexCount = pos.count;
                        }
                        else if (Array.isArray(pos)) {// array[]
                            drawModeMesh.vertexCount = pos.length / 3;
                        }
                        else {
                            throw new Error("position is not array or GPUBufferBundle");
                        }
                    }
                    else {
                        throw new Error("position is not array or GPUBufferBundle");
                    }
                    drawModeMesh.instanceCount = this.instance.numInstances;
                    drawMode = drawModeMesh;
                }
            }
            this._drawModeTemplate = drawMode;
        }
        return this._drawModeTemplate;
    }
    /**
     * 获取实例化的drawMode数组
     * 1、DC 进行实例化优化使用
     * 2、DC获取的是动态的数组，提交instance index 根据可见性进行剔除，需要保持 instance index的编号与entityManager中的Map的instance数组下标一致（涉及storage buffer array）
     * @param UUID entity's UUID
     * @param kind 渲染类型(相机、light)
     * @param wireFrameDrawModeTemplate  wireFrame 模式的drawMode模板
     * @returns I_drawMode[] | I_drawModeIndexed[]
     */
    getDrawModeArrayOfInstances(UUID: string, kind: E_renderForDC, wireFrameDrawModeTemplate?: I_drawMode | I_drawModeIndexed): I_drawMode[] | I_drawModeIndexed[] {
        /**步骤
         * 1、获取entity drawMode模板
         * 2、可见性
         *      A、确认NodeObject的自身（parent）的enable和visible；
         *      B、确认当前渲染（摄像机、light）的BVH可见性
         *      C、输出形成可见性instanceID数组
         * 3、聚合bundle instance ID 连续的实例ID
         * 4、实例化drawMode数组
         * 5、返回
         */
        //1、获取entity drawMode模板
        let drawMode: I_drawMode | I_drawModeIndexed;
        if (wireFrameDrawModeTemplate != undefined) {
            drawMode = wireFrameDrawModeTemplate;
        }
        else {
            drawMode = this.getDrawModeTemplate();
        }


        //2、可见性
        // 可见的实例ID数组
        let visibleInstanceIDArray: number[] = [];
        // 遍历所有实例ID：可见性可用性判断
        for (let i in this.outSideInstance) {
            let visibleOfNode = true;
            let enableOfNode = true;
            let visibleInBVH = true;
            let perNode = this.outSideInstance[i];
            visibleOfNode = perNode.getVisibleAndParents();
            enableOfNode = perNode.getEnableAndParents();
            if (kind == E_renderForDC.camera) {
                visibleInBVH = this.scene.cameraManager.getCameraByUUID(UUID).getVisibleInBVH(perNode);
            }
            else if (kind == E_renderForDC.light) {
                let light = this.scene.lightsManager.getLightByMergeID(UUID);
                if (light != false && light instanceof BaseLight)
                    visibleInBVH = light.getVisibleInBVH(perNode);
            }
            if (visibleInBVH && visibleOfNode && enableOfNode) {
                for (let j = 0; j < this.instance.numInstances; j++) {
                    visibleInstanceIDArray.push(Number(i) * this.instance.numInstances + j);
                }
            }
        }

        //3、聚合instance bundle，形成 instance ID 连续的实例ID
        let visibleInstanceIDBundle: { count: number, firstInstance: number }[] = [];
        let firstInstance = visibleInstanceIDArray[0];
        // let instanceCount = visibleInstanceIDArray.length;
        let lastVisibleInstanceID = visibleInstanceIDArray[0];

        //3.1 bundle instance ID 连续的实例ID
        let lastInBundle = false;
        for (let i in visibleInstanceIDArray) {
            let id = visibleInstanceIDArray[i];
            if (i == "0") {
                firstInstance = id;
                lastVisibleInstanceID = id;
                continue;
            }
            if (id != lastVisibleInstanceID + 1) {
                visibleInstanceIDBundle.push({
                    count: lastVisibleInstanceID - firstInstance + 1,//+1=包含当前实例ID
                    firstInstance: firstInstance,
                });
                firstInstance = id;
                lastVisibleInstanceID = id;
                lastInBundle = true;
            }
            else {
                lastVisibleInstanceID = id;
                lastInBundle = false;
            }
        }
        //3.2 最后一个实例ID是否在bundle中
        if (!lastInBundle) {
            visibleInstanceIDBundle.push({
                count: lastVisibleInstanceID - firstInstance + 1,
                firstInstance: firstInstance,
            });
        }
        //4、实例化drawMode数组
        // 数组：实例化的drawMode数组
        let instanceDrawArray: I_drawMode[] | I_drawModeIndexed[] = [];
        for (let perPart of visibleInstanceIDBundle) {
            let instanceDraw: I_drawMode | I_drawModeIndexed = {
                ...drawMode
            };
            instanceDraw.instanceCount = perPart.count;
            instanceDraw.firstInstance = perPart.firstInstance;
            if (isDrawModeIndexed(drawMode)) {
                (instanceDrawArray as I_drawModeIndexed[]).push(instanceDraw as I_drawModeIndexed);
            }
            else {
                (instanceDrawArray as I_drawMode[]).push(instanceDraw as I_drawMode);
            }
        }
        //5、返回
        return instanceDrawArray;
    }
    /**
     * mesh 生成DrawCommand的input value
     * @param type 渲染类型
     * @param UUID camera UUID or light merge UUID
     * @param vsBundle 实体的uniform和shader模板
     * @param vsOnly 是否只渲染顶点
     * @returns IV_DrawCommand
     */
    generateInputValueOfDC(
        renderType: E_renderForDC,
        UUID: string,
        bundle: I_vsfsBundle,
        vsOnly: boolean = false,
        scope?: EntityBundleMaterial
    ): IV_DC {
        if (scope == undefined) scope = this;
        // if (scope.boundingBox == undefined)
        //     scope.generateBoxAndSphere();
        let boundingBoxMaxSize = scope.getBoundingBoxMaxSize();//生成 shader 中的cubeVecUV使用
        if (boundingBoxMaxSize === 0) boundingBoxMaxSize = 1;

        let fragment = undefined;
        if (bundle.fsBundle) {
            fragment = {
                code: bundle.fsBundle.shaderTemplateFinal,
                entryPoint: "fs",
            };
        }

        // let uniforms = [bundle.vsBundle.uniformGroup];//old ,未使用parent参数之前的代码
        let uniforms = [];

        if (bundle.fsBundle) {
            uniforms.push(bundle.fsBundle.uniformGroup);
        }
        let valueDC: IV_DC = {
            // label: scope.kind + scope.Name + " for " + renderType + ":" + UUID,
            label: `${scope.kind} ${scope.Name} for ${renderType}: ${UUID}`,
            data: {
                vertices: scope.attributes.vertices,
                vertexStepMode: scope.attributes.vertexStepMode,
                indices: scope.attributes.indices,
                uniforms,
            },
            render: {
                vertex: {
                    code: bundle.vsBundle.shaderTemplateFinal,
                    entryPoint: "vs",
                    constants: {
                        "boundingBoxMaxSize": boundingBoxMaxSize,
                    },
                },
                fragment,
                drawMode: (UUID: string, kind: E_renderForDC) => { return scope.getDrawModeArrayOfInstances(UUID, kind) },
                primitive: {
                    cullMode: scope._cullMode,
                }
            },
            system: {
                UUID,
                type: renderType
            },
            parent: scope,
            IDS: {
                UUID: scope.UUID,
                ID: scope.ID,
                renderID: scope.ID,
            }
        }
        // 如果是动态材质，需要在DrawCommand中添加dynamic属性,并每帧重新生成bind group
        if (bundle.fsBundle && bundle.fsBundle.shaderTemplateFinal.material?.dynamic === true) {
            valueDC.dynamic = true;
        }
        if (scope.inputValues.primitive) {
            valueDC.render.primitive = scope.inputValues.primitive;
        }
        if (vsOnly)
            delete valueDC.render.fragment;
        return valueDC;
    }
    /**
     * 生成opacity DC，并push到对应队列
     * 
     * 1、支持的类型：
     *      A、不透明 
     *      B、TO
     * 
     * 2、生成类型
     *      A、MSAA+infor
     *      B、MSAA defer+info
     *      C、defer
     *      D、forward
     * @param UUID camera UUID or light merge UUID
     * @param TO 透明物体的uniform和shader模板
     * @param specialMaterial 指定的材质，比如：线框（WireFrameMaterial），用于生成线框的MSAA
     */
    generateOpacityDC(
        UUID: string,
        SHT_VS: I_ShaderTemplate,
        TO?: I_materialBundleOutput,
        specialMaterial?: BaseMaterial,
        specialInitValueOfDC?: (renderType: E_renderForDC, UUID: string, bundle: I_vsfsBundle, vsOnly: boolean) => IV_DC
    ): DrawCommand {
        let bundle = this.getVSUniformAndShaderTemplateFinal(SHT_VS);

        let material = this._material;
        if (specialMaterial != undefined)
            material = specialMaterial;
        let getIV_DC = this.generateInputValueOfDC;//(E_renderForDC.camera, UUID, bundle);
        if (specialInitValueOfDC != undefined)
            getIV_DC = specialInitValueOfDC;

        let dc: DrawCommand;
        if (this.MSAA === true) {   //输出两个DC（MSAA 和 info forward）
            let uniformsMaterialMSAA: I_BundleOfMaterialForMSAA;
            {//MSAA 部分
                if (this.deferColor) {
                    if (TO !== undefined) {
                        uniformsMaterialMSAA = material.getFS_TO_DeferColorOfMSAA();
                    }
                    else
                        uniformsMaterialMSAA = material.getOpacity_DeferColorOfMSAA();
                }
                else {
                    if (TO !== undefined) {
                        uniformsMaterialMSAA = material.getFS_TO_MSAA();
                    }
                    else
                        uniformsMaterialMSAA = material.getOpacity_MSAA();
                }
            }
            {
                let valueDC = getIV_DC(E_renderForDC.camera, UUID, { vsBundle: bundle, fsBundle: uniformsMaterialMSAA.MSAA }, false, this);
                valueDC.system!.MSAA = "MSAA";
                if (TO !== undefined)
                    valueDC.label = "TO MSAA:" + valueDC.label;
                else
                    valueDC.label = "opacity MSAA:" + valueDC.label;
                // valueDC.label = this.ID.toString();
                let dc = this.DCG.generateDrawCommand(valueDC);
                this.cameraDC[UUID][E_renderPassName.MSAA].push(dc);
            }
            {       //info forward 部分
                let valueDC = getIV_DC(E_renderForDC.camera, UUID, { vsBundle: bundle, fsBundle: uniformsMaterialMSAA.inforForward }, false, this);
                valueDC.system!.MSAA = "MSAAinfo";
                if (TO !== undefined)
                    valueDC.label = "TO MSAA info:" + valueDC.label;
                else
                    valueDC.label = "opacity MSAA info:" + valueDC.label;
                // valueDC.label = this.ID.toString();
                dc = this.DCG.generateDrawCommand(valueDC);
            }
        }
        else {//正常的前向渲染输出,只输出一个DC（defer 或  forward）
            //mesh VS 模板输出
            let uniformsMaterial: I_materialBundleOutput;
            if (this.deferColor) {
                if (TO !== undefined) {
                    uniformsMaterial = material.getFS_TO_DeferColor();
                }
                else
                    uniformsMaterial = material.getOpacity_DeferColor();
            }
            else {
                if (TO !== undefined) {
                    if (TO == undefined) {
                        throw new Error("Mesh generateOpacityDC: TO is undefined");
                    }
                    uniformsMaterial = TO;
                }
                else
                    uniformsMaterial = material.getOpacity_Forward();
            }
            // //材质的shader 模板输出，
            {
                let valueDC = getIV_DC(E_renderForDC.camera, UUID, { vsBundle: bundle, fsBundle: uniformsMaterial }, false, this);
                let drawFor = " forward ";
                if (this.deferColor) drawFor = " defer "
                if (TO !== undefined)
                    valueDC.label = "TO:" + valueDC.label;
                else
                    valueDC.label = "opacity:" + valueDC.label;
                // if (valueDC.label == undefined)
                //     valueDC.label = this.ID.toString();
                dc = this.DCG.generateDrawCommand(valueDC);
                // this.cameraDC[UUID][E_renderPassName.forward].push(dc);
            }
        }
        return dc;
    }


}