import { NodeObject, NodeSpace } from "../organization/root";

import { boundingBox, generateBox3 } from "../math/Box";
import { boundingSphere, generateSphereFromBox3 } from "../math/sphere";


import {
    E_entityType,
    I_EntityBundleOutput,
    I_entityInstance,
    IV_BaseEntity,
    I_optionShadowEntity,
    I_ShadowMapValueOfDC,
} from "./base";
import { E_lifeState, weVec2 } from "../base/coreDefine";
import { Clock } from "../scene/clock";
import { DrawCommand } from "../command/DrawCommand";
import { BaseCamera } from "../camera/baseCamera";
import { BaseLight } from "../light/baseLight";
import { I_bindGroupAndGroupLayout, I_uniformArrayBufferEntry } from "../command/base";
import { I_ShaderTemplate } from "../shadermanagemnet/base";
import { EntityManager } from "./entityManager";
import { Scene } from "../scene/scene";
import { DrawCommandGenerator } from "../command/DrawCommandGenerator";
import { E_renderPassName } from "../scene/renderManager";
import { mergeLightUUID } from "../light/lightsManager";
import { createEmptyGPUBuffer, createUniformBuffer } from "../command/baseFunction";
import { mat4, Mat4, vec3, Vec3 } from "wgpu-matrix";
import { E_AnimationType } from "../animation/base";


export abstract class BaseEntity extends NodeSpace {
    ////////////////////////////////////////////////////////////////////
    //基础属性
    input: IV_BaseEntity;
    /**实例化数量，默认为1 */
    instance: I_entityInstance = {
        numInstances: 1,
    }
    /**     剔除模式    默认=back      */
    _cullMode: GPUCullMode = "back";
    /**MSAA */
    MSAA: boolean = false;
    /**
     * 这里指的是颜色前向，光影延迟
     */
    deferColor!: boolean;

    /**顶点数量 */
    vertexCount: number = 0;

    /** uv动画使用 */
    _uv: weVec2 = [0, 0];
    ///////////////////////////////////////////
    // shader
    /** 顶点偏移量，材质编辑器适用，目前(20260103)未使用*/
    vsOffset: number = 0;
    /**for shader  */
    entity_id!: Uint32Array;
    /**for shader */
    stage_id!: Uint32Array;
    /** 实体类型 */
    kind!: E_entityType;

    /**uniform :  st_entity 数据     */
    _entityCommonByteSize = 32;//以byte计算
    /** storage array
     * 每个instance的st_instance_info size
     * 1、每个instance的结构大小 ，st_instance_info 大小=16
     * 2、instance数量（M=1，动态，程序中）
     */
    _instanceInfoByteSize = 16;//以byte计算
    /**storage array(初始化默认一个矩阵，即一个instance)
     * 每个instance的world matrix大小(固定的)
     * 1、matrix以16byte一个单位计算，16 byte
     * 2、instance数量
     */
    _instanceWorldMatrixByteSize = 16 * 4;
    /**storage array(初始化默认一个矩阵，以适配没有joint的通用情况；)
     * 每个instance的joint matrix size
     * 1、matrix以16*4 byte一个单位计算
     * 2、当前entity的jonit数组数量：N=1(不使用时),N=关节数量
     * 3、instance 数量（M=1，动态，程序中）
     * 4、size= M*(N*16*4)
     */
    _instanceJointMatrixByteSize = 16 * 4;
    set JointMatrixByteSize(value: number) {
        this._instanceJointMatrixByteSize = value;
    }
    get JointMatrixByteSize(): number {
        return this._instanceJointMatrixByteSize;
    }
    /**storage array(初始化默认一个矩阵，以适配没有morph target的通用情况；)
     * 1、不使用的默认大小（为了在内没有morph target的情况下，使用default one storage buffer，最小以16计算 ）
     * 2、size计算= M*(N*4)
     *  A、instance 数量（M=1，动态，程序中）
     *  B、一个顶点的morphTarget数量N ;一般情况为4个，即大小=N*f32Size=4*4=16 byte
     */
    _instanceMorphTargetByteSize = 16 * 4;
    set MorphTargetByteSize(value: number) {
        this._instanceMorphTargetByteSize = value;
    }
    get MorphTargetByteSize(): number {
        return this._instanceMorphTargetByteSize;
    }
    ///////////////////////////////////////////////////////////////////
    //uniform
    /** 实例化数组最后重新的时间 */
     flagInstanceArrayBufferReNew: boolean = false;
    /**Buffer(uniform and storage )在CPU端的ArrayBuffer */
    bufferCPU: {
        /** 最终输出@group(1) @binding(0)的uniform buffer*/
        uniformCommonEntity?: ArrayBuffer;//instance的uniform 数组数量，在createDCCC中进行字符串替换，每个子类单独进行
        /** 实例化数组@group(1) @binding(1)*/
        instances?: ArrayBuffer;
        /** 世界矩阵数组@group(1) @binding(2)*/
        wolrdMatrix?: ArrayBuffer;
        /** 变形矩阵数组@group(1) @binding(3)*/
        morphMatrix?: ArrayBuffer;
        /** 骨骼矩阵数组@group(1) @binding(4)*/
        jointMatrix?: ArrayBuffer;
    } = {};
    /**Buffer(uniform and storage )在GPU端的 GPUBuffer */
    bufferGPU: {
        /** 最终输出@group(1) @binding(0)的uniform buffer*/
        uniformCommonEntity?: GPUBuffer;//instance的uniform 数组数量，在createDCCC中进行字符串替换，每个子类单独进行
        /** 实例化数组@group(1) @binding(1)*/
        instances?: GPUBuffer;
        /** 世界矩阵数组@group(1) @binding(2)*/
        wolrdMatrix?: GPUBuffer;
        /** 变形矩阵数组@group(1) @binding(3)*/
        morphMatrix?: GPUBuffer;
        /** 骨骼矩阵数组@group(1) @binding(4)*/
        jointMatrix?: GPUBuffer;
    } = {};
    /**
     * 外部实例化数组
     * 说明：
     * 1、由EntityManager.add()指向赋值：entity.outSideInstance = instances; 
     * 2、checkStorageBuffer() 检查是否需要更新storage buffer
     * 3、updateSelf() 中调用，
     *         this.updateUniformCommonEntity(clock);  //更新vs、fs的uniform
     *          this.updateInstanceBuffer();            //更新instance buffer
     *          this.updateWorldMatrixBuffer(clock);    //更新world matrix buffer
     *          this.updateMorphtTargetBuffer();        //更新morphtarget buffer
     *          this.updateJointMatrixBuffer();         //更新joint matrix buffer
     *    进行与instance相关的更新
     * 4、getInstancesCount() 获取实例化数量：内外部
     */
    outSideInstance: NodeObject[] = [];
    /** inside实例化矩阵数组，每个内部实例一个矩阵 */
    _insideInstanceMatrix: Mat4[] = [];
    ///////////////////////////////////////////////////////////////////
    //bind group
    bindGroup!: GPUBindGroup;
    bindGroupLayout!: GPUBindGroupLayout;
    ///////////////////////////////////////////////////////////////////
    //空间属性
    boundingBox: boundingBox | undefined;
    // = {
    //     min: [0, 0, 0],
    //     max: [0, 0, 0],
    // };//initDCC中赋值
    boundingSphere!: boundingSphere | undefined;
    //////////////////////////////////////////////////////////////////
    //动画相关
    /** 动画类型 :Set<E_AnimationType>*/
    _animationType: Set<E_AnimationType> = new Set([E_AnimationType.none]);
    // _animationType: number = E_AnimationType.none;
    get AnimationType(): number {
        let total: number = 0;
        for (let item of this._animationType) {
            total += item;
        }
        return total;
    }
    set AnimationType(animationType: E_AnimationType) {
        this._animationType.add(animationType);
    }
    /** todo :20260209
     * 需要适配动画复合类型：124的权限组合（shader也需要适配） 
     * 获取动画类型 */
    getAnimationKind(): E_AnimationType {
        return this.AnimationType;
    }
    /** 是否是变形目标动画 
     * 说明：
     * 1、不太可能同时有变形目标动画和骨骼动画，仅作为可能判断
     * 2、keyFrame动画:目前共用了MatrixWorld进行，故不设置：1的动画类型
     * 3、其他类型，目前未开始，暂时不设置(GPU shader相同)。
    */
    isMorphTargetAnimation(): boolean {
        return this.getAnimationKind() == E_AnimationType.morphTarget || this.getAnimationKind() as number == 6;
    }
    /**
     * 是否是骨骼动画 
     * 说明：
     * 1、不太可能同时有变形目标动画和骨骼动画，仅作为可能判断
     * 2、keyFrame动画:目前共用了MatrixWorld进行，故不设置：1的动画类型
     * 3、其他类型，目前未开始，暂时不设置(GPU shader相同)。
     * @returns 
     */
    isSkeletonAnimation(): boolean {
        return this.getAnimationKind() == E_AnimationType.skeleton || this.getAnimationKind() as number == 6;
    }
    /** 变形目标数量 
     * 1、由checkMorphTargetCount() 检查并设置
     * 2、checkMorphTargetCount()由class MorphTargetAnimation 调用
    */
    _morphTargetWeightsCount: number = 0;
    /** 获取变形目标数量 */
    get MorphtTargetCount(): number {
        return this._morphTargetWeightsCount;
    }
    set MorphtTargetCount(count: number) {
        this._morphTargetWeightsCount = count;
    }
    /** 检查变形目标数量是否匹配,检查attribute中position*的数量 ,并设置_morphTargetWeightsCount*/
    abstract checkMorphTargetCount(count: number): boolean;

    _jointsMattricesCount: number = 0;
    /** 获取骨骼动画数量 */
    get JointsMatCount(): number {
        return this._jointsMattricesCount;
    }
    set JointsMatCount(count: number) {
        this._jointsMattricesCount = count;
    }
    ///////////////////////////////////////////////////////////////////
    //状态属性

    // _init: E_lifeState = E_lifeState.unstart;
    /**是否每帧更新 */
    // updatePerFrame: boolean = true;

    // /**是否单独更新每个instance  默认=false    */
    // flagUpdateForPerInstance: boolean = false;

    /**
     * 是否需要更新,根据初始化状态，或触发更新
     */
    // needUpdate: boolean = true;


    //////////////////////////////////////////////////////////////////
    //是否透明属性
    /**透明属性     , 默认=false， 通过后续材质或函数设置     */
    _transparent: boolean = false;
    /** 设置是否透明 */
    set transparent(transparent: boolean) {
        this._transparent = transparent;
    }
    /** 获取是否透明 */
    get transparent() {
        return this._transparent;
    }
    //////////////////////////////////////////////////////////////////
    //阴影相关
    _shadow: I_optionShadowEntity = {
        accept: true,
        generate: true,
    };
    ////////////////////////////////////////////////////////////////////////////
    //渲染相关
    //延迟渲染，depth模式，先绘制depth，单像素
    deferRenderDepth!: boolean;
    //延迟渲染，color模式，todo：先绘制color，depth，材质集中在一起处理，需要一个shader进行处理，即，合批shader
    deferRenderColor!: boolean;
    /**
     * cameraDC 队列 
     * 1、由enity生成(每个摄像机)
     * 2、由entityManager调度给renderManager
     */
    cameraDC: {
        [name: string]: {
            [E_renderPassName.depth]: DrawCommand[],
            [E_renderPassName.MSAA]: DrawCommand[],
            [E_renderPassName.forward]: DrawCommand[],
            [E_renderPassName.transparent]: DrawCommand[],
        }
    } = {};

    /**
     * light的shadow map DC 队列 
     * 1、由enity生成(每个摄像机)
     * 2、由entityManager调度给renderManager
     */
    shadowmapDC: {
        [name: string]: {
            // depth: DrawCommand[],
            // transparent: DrawCommand[],
            [E_renderPassName.shadowmapOpacity]: DrawCommand[],
            [E_renderPassName.shadowmapTransparent]: DrawCommand[],
        }
    } = {}
    /**
     * DrawCommand 生成器
     */
    DCG!: DrawCommandGenerator;
    ////////////////////////////////////////////////////////////////////////////
    //ECS
    entityManager!: EntityManager;

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // abstract 部分
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 可见性(visible)、
     * 可用性(enable)、
     * 初始化状态(_state)
     * 上级group的状态（可见性、使用性）
     */
    abstract checkStatus(): boolean
    /** 生成原始包围盒和原始包围球 */
    abstract generateBoxAndSphere(): void
    /** 获取混合模式 */
    abstract getBlend(): GPUBlendState | undefined;
    /** 获取是否透明 */
    abstract getTransparent(): boolean;

    /**延迟渲染的深度渲染：单像素模延迟 ，不透明*/
    abstract createDeferDepthDC(camera: BaseCamera): void
    /**前向渲染 不透明 */
    abstract createForwardDC(camera: BaseCamera): void
    /**透明渲染 */
    abstract createTransparent(camera: BaseCamera): void

    /**渲染shadowmap 不透明*/
    abstract createShadowMapDC(input: I_ShadowMapValueOfDC): void
    /**渲染shadowmap 透明模式 */
    abstract createShadowMapTransparentDC(input: I_ShadowMapValueOfDC): void

    /**获取uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
     * 涉及三个部分：
     * 1、uniformGroups：uniform多组，至少有group0(system),group1(entity)。
     * 2、shaderTemplateFinal：shader模板输出，包括了shader代码和groupAndBindingString。
     * 3、enity 和material的uniform layout 到ResourceGPU的Map操作
     * @param startBinding 
     * @returns  uniformGroups: T_uniformGroups[], shaderTemplateFinal: I_ShaderTemplate_Final 
     */
    abstract getVSUniformAndShaderTemplateFinal(SHT_VS: I_ShaderTemplate, startBinding: number): I_EntityBundleOutput

    constructor(input: IV_BaseEntity) {
        super(input);
        this.type = "entity";
        this._state = E_lifeState.constructing;
        this.input = input;

        // //是否每帧更新矩阵等
        // if (input.updatePerFrame !== undefined) {
        //     this.updatePerFrame = input.updatePerFrame;
        // }
        // else if (input.dynamicMesh !== undefined) {
        //     this.updatePerFrame = input.dynamicMesh;
        // }
        // else if (input.dynamicPostion !== undefined) {
        //     this.updatePerFrame = input.dynamicPostion;
        // }
        // else if (input.update !== undefined) {
        //     this.updatePerFrame = true;
        // }
        // else {
        //     this.updatePerFrame = false;
        // }

        if (input.instance) {
            this.instance = input.instance;
            this.checkInstance();
        }

        if (input.cullmode) {
            this._cullMode = input.cullmode;
        }
        // if (input.position) this._position = vec3.fromValues(input.position[0], input.position[1], input.position[2]);
        // if (input.scale) this._scale = vec3.fromValues(input.scale[0], input.scale[1], input.scale[2]);
        // if (input.rotate) this._rotate = {
        //     axis: vec3.fromValues(input.rotate[0], input.rotate[1], input.rotate[2]),
        //     angleInRadians: input.rotate[3],
        // };
        // if (input.name) this.Name = input.name;

        //////////////////
        //about shader
        if (input.shadow) {
            if (input.shadow.accept === false) this._shadow.accept = false;
            if (input.shadow.generate === false) {
                this._shadow.generate = false;
            }
        }
        // console.log(this.ID);
        this._state = E_lifeState.constructed;

    }
    abstract detachData(): void;
    // /**
    //  * 检查内部instance是否合法
    //  */
    checkInstance() {
        if (this.instance.index) {
            if (this.instance.index.length < this.instance.numInstances) {
                throw new Error("instance.index 长度必须大于等于 instance.numInstances");
            }
        }
        else if (this.instance.position) {
            if (this.instance.numInstances > this.instance.position.length) {
                throw new Error("instance.position 长度必须大于等于 instance.numInstances");
            }
            this.instance.numInstances = this.instance.position.length / 3;
        }
        let posLen = 0, rotLen = 0, scaleLen = 0;
        if (this.instance.position) {
            posLen = this.instance.position.length;
        }
        else {
            throw new Error("instance.position 必须有");
        }
        if (this.instance.rotate) {
            rotLen = this.instance.rotate.length;
        }
        if (this.instance.scale) {
            scaleLen = this.instance.scale.length;
        }

        if (rotLen != 0 && rotLen / 4 != posLen / 3) {
            throw new Error("position rotate 长度必须相同");
        }
        if (scaleLen != 0 && scaleLen != posLen) {
            throw new Error("position scale 长度必须相同");
        }
    }

    /**
     * 生成内部instance的矩阵，涵括内部instance的position,rotate,scale等
     * @returns Mat4[] 内部instance的矩阵
     */
    generateInsideInstanceMatrix(): Mat4[] {
        let positionEnable: boolean = false;
        let rotateEnable: boolean = false;
        let scaleEnable: boolean = false;
        if (this.instance.position && this.instance.position.length > 0) {
            positionEnable = true;
        }
        if (this.instance.rotate && this.instance.rotate.length > 0) {
            rotateEnable = true;
        }
        if (this.instance.scale && this.instance.scale.length > 0) {
            scaleEnable = true;
        }
        if (this.instance.index && this.instance.numInstances != this.instance.index.length) {
            this.instance.numInstances = this.instance.index.length;
        }
        else if (this.instance.position && this.instance.numInstances != this.instance.position.length / 3) {
            this.instance.numInstances = this.instance.position.length / 3;
        }
        let insideMatrix: Mat4[] = [];
        for (let j = 0; j < this.instance.numInstances; j++) {
            let index: number = j;
            if (this.instance.index) {
                index = this.instance.index[j];
            }
            let perMatrix = mat4.identity();
            if (scaleEnable) {
                let perScale = vec3.fromValues(this.instance.scale![index * 3 + 0], this.instance.scale![index * 3 + 1], this.instance.scale![index * 3 + 2]);
                mat4.scale(perMatrix, perScale, perMatrix);
            }
            if (rotateEnable) {
                let perAxis = vec3.fromValues(this.instance.rotate![index * 3] + 0, this.instance.rotate![index * 3] + 1, this.instance.rotate![index * 3] + 2);
                let perAngle = this.instance.rotate![index * 3 + 3];
                if (perAngle != 0 && (this.instance.rotate![index * 3 + 0] != 0 || this.instance.rotate![index * 3 + 1] != 0 || this.instance.rotate![index * 3 + 2] != 0)) {
                    mat4.axisRotate(perMatrix, perAxis, perAngle, perMatrix);
                }
            }
            if (positionEnable) {
                let perPosition = vec3.fromValues(this.instance.position![index * 3 + 0], this.instance.position![index * 3 + 1], this.instance.position![index * 3 + 2]);
                mat4.setTranslation(perMatrix, perPosition, perMatrix);
            }
            mat4.multiply(this.matrixWorld, perMatrix, perMatrix);     // 先缩放，再旋转，最后平移，然后乘以world matrix ，得到instance的world matrix，在shader中的VS是再次的局部坐标*这个world matrix，得到顶点的world position
            insideMatrix.push(perMatrix);
        }
        return insideMatrix;
    }
    /**
     * 三段式初始化的第二步：init
     * @param values
     */
    async init(scene: Scene): Promise<any> {
        this._state = E_lifeState.initializing;
        this.MSAA = scene.MSAA;
        this.deferColor = scene.deferRender.deferRenderColor;

        // this.outSideInstance.push(this);//临时代码

        await super.init(scene);
        this.intUniformCommonEntity();
        this.updateInstanceBuffer();
        this.updateWorldMatrixBuffer();
        this.updateWorldMatrixBuffer();
        this.updateJointMatrixBuffer();

        this.transparent = this.getTransparent();
        this.DCG = new DrawCommandGenerator({ scene: this.scene });
        this._state = E_lifeState.finished;
        // return this.renderID + 1;
    }


    /**顶点数量，morph target 使用 */
    getVertexCount(): number {
        if (this.vertexCount === 0) {
            // console.warn("vertexCount 没有计算");
        }
        return this.vertexCount;
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 基础部分
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /** 
     * 更新世界矩阵，
     * 1、更新局部矩阵，不更新entity的世界矩阵（entity是instance化后使用，使用使用实例化nodeInstance的世界矩阵）
     * 2、entity的matrixWorld 是单位矩阵
     * 3、这里只返回局部矩阵
     * @param parentMatrixWorld 父矩阵
     * @returns 世界矩阵
     */
    updateMatrixWorld(_parentMatrixWorld?: Mat4): Mat4 {
        this.updateMatrix();
        return this.matrix;
    }

    /**
     * 更新世界位置,entity无worldPosition，只有position在本地坐标系下的位置
     * 1、entity需要实例化，并使用实例的世界坐标。
     * 2、由于entity的worldPosition是在本地坐标系下的位置，worldPostion=(0,0,0)
     * 3、每个instance的世界矩阵不同而不同，所以这里的更新世界位置=返回世界坐标系（不更新entity的worldPosition）
     * 4、如果没有提供世界矩阵，默认使用entity的matrixWorld，并返回entity的position在世界坐标系下的位置（0,0,0）
     * @param _matrixWorld 世界矩阵
     * @returns 世界位置
     */
    updateWorldPosition(_matrixWorld?: Mat4): Vec3 {
        if (_matrixWorld) {
            return vec3.fromValues(_matrixWorld[12], _matrixWorld[13], _matrixWorld[14]);
        }
        else {
            return vec3.fromValues(this.matrixWorld[12], this.matrixWorld[13], this.matrixWorld[14]);//（0,0,0）
        }
    }
    /**
     * 获取实例的世界矩阵，不更新entity的worldPosition
     * 1、entity的matrixWorld 是单位矩阵
     * 2、返回instance的世界矩阵
     * @param instance 实例
     * @returns instance 世界矩阵
     */
    getMatrixWorldOfInstance(instance: NodeObject): Mat4 {
        let parentMatrixWorld: Mat4 = instance.matrixWorld;
        return mat4.multiply(parentMatrixWorld, this.matrix);
    }
    /**
     * 获取实例的世界位置
     * @param instance 实例
     * @returns 实例的世界位置
     */
    getWorldPositionOfInstance(instance: NodeObject): Vec3 {
        return this.updateWorldPosition(this.getMatrixWorldOfInstance(instance));
    }
    setBoundingBox(box: boundingBox) {
        this.boundingBox = box;
        this.boundingSphere = this.generateSphere(box);
    }


    /** 生成世界坐标的Box，当前entity的原始包围盒，不涉及变换 */
    generateBox(position: number[]): boundingBox {
        let box = generateBox3(position);
        // const min = vec3.transformMat4(box.min, instance.matrixWorld);
        // const max = vec3.transformMat4(box.max, instance.matrixWorld);
        // box.max[0] = max[0];
        // box.max[1] = max[1];
        // box.max[2] = max[2];
        // box.min[0] = min[0];
        // box.min[1] = min[1];
        // box.min[2] = min[2];
        return box;
    }
    /** 生成世界坐标的sphere，基于当前entity的原始包围球，不涉及变换 */
    generateSphere(box: boundingBox): boundingSphere {
        if (this.boundingBox == undefined) {
            console.error("boundingBox 没有计算");
        }
        return generateSphereFromBox3(box);
    }
    /**获取uniformCommonEntityInfo
     * 基础信息,st_entity_instances.vs.wgsl  
     */
    getUniformCommonEntityInfo() {
        return this.bufferCPU.uniformCommonEntity;
    }

    /**检查camear的id在commands中是否已经存在 */
    checkIdOfCommands(id: string, commands: Object): boolean {
        for (let i in commands) {
            if (i == id) return true;
        }
        return false;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 阴影相关部分
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**是否产生阴影
     * @returns boolean
     */
    getShadwoMapGenerate(): boolean {
        return this._shadow.generate;
    }
    /**
     * 是否接受阴影
     * @returns boolean
     */
    getShadowmAccept() {
        return this._shadow.accept;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //// update 部分
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 
     * @param clock 
     * @param updateSelftFN 是否call updateSelf()
     * @returns 
     */
    update(clock: Clock, updateSelftFN: boolean = true): boolean {
        if (this._state === E_lifeState.finished && this.checkStatus()) {//initial finish
            super.update(clock, updateSelftFN);
            return true;
        }
        return false;
    }

    /** 更新entity的自定义属性
     * 1、更新entity的uniform 通用
     * 2、更新entity的instance buffer
     * 3、更新entity的world matrix buffer
     * 4、更新entity的morphtarget buffer
     * 5、更新entity的joint matrix buffer
     * 6、检查是否有新摄像机，有进行更新
     * 7、检查是否有新光源，有进行更新
     * 8、DCG的uniform更新
     * @param clock 时钟
     */
    updateSelf(clock: Clock) {
        //uniform @group(1) @binding(0)
        // this.updateMatrix();
        this.updateUniformCommonEntity(clock);  //更新vs、fs的uniform
        this.updateInstanceBuffer();            //更新instance buffer
        this.updateWorldMatrixBuffer(clock);    //更新world matrix buffer
        this.updateMorphtTargetBuffer();        //更新morphtarget buffer
        this.updateJointMatrixBuffer();         //更新joint matrix buffer

        //检查是否有新摄像机，有进行更新
        this.checkUpgradeCameras();
        //检查是否有新光源，有进行更新
        this.checkUpgradeLights();

        this.DCG.upadate();
    }
    /** 获取当前状态（是否可以进行update）*/
    getStateus(): boolean {
        if (this.checkStatus()) {
            return true;
        }
        return false;
    }
    /** 清除DCC 渲染队列*/
    clearDC() {
        this.cameraDC = {};
        this.shadowmapDC = {};
    }
    /**
     * 透明的实体由于使用了camera的GBUffer，所以需要处理onSize
     */
    onResize(): void {
        for (let i in this.cameraDC) {
            let perCameraDC = this.cameraDC[i];
            // perCameraDC.transparent = [];
        }
        // this.upgradeCameras();
    }
    /**更新(创建)关于cameras的DCCC commands
     * 
     * @param parent 
     */
    upgradeCameras() {
        for (let camera of this.scene.cameraManager.list) {
            const id = camera.UUID;
            let already: boolean
            //判断透明还是不透明
            if (this.transparent === true) {
                // this.createDCCCForTransparent({ parent, id: "transparent", kind: E_renderForDC.transparent });
                already = this.checkIdOfCommands(id, this.cameraDC);//获取是否已经存在
            }
            else {
                already = this.checkIdOfCommands(id, this.cameraDC);//获取是否已经存在
            }

            if (already) {
                continue;
            }
            else {
                if (this.cameraDC[camera.UUID] == undefined) {
                    this.cameraDC[camera.UUID] = {
                        [E_renderPassName.forward]: [],
                        [E_renderPassName.depth]: [],
                        [E_renderPassName.transparent]: [],
                        [E_renderPassName.MSAA]: [],
                    }
                }
                if (this.transparent === true) {
                    this.createTransparent(camera);
                }
                else {
                    if (this.scene.deferRender.enable && this.scene.deferRender.deferRenderDepth) {
                        this.createDeferDepthDC(camera);
                    }
                    this.createForwardDC(camera);
                }
            }
        }
    }
    /**更新(创建)关于lights的DCCC commands
     * 
     */
    upgradeLights() {
        for (let i of this.scene.lightsManager.getShdowMapsStructArray()) {
            const id = i.light_id.toString();
            let UUID = this.scene.lightsManager.getUUIDByID(i.light_id);
            let already: boolean;
            // if (this.transparent === true) {
            //     already = this.checkIdOfCommands(id, this.shadowmapDC);//获取是否已经存在 
            // }
            // else {
            already = this.checkIdOfCommands(UUID, this.shadowmapDC);//获取是否已经存在
            // }
            if (already) {
                continue;
            }
            else {
                // this.shadowmapDC[UUID] = {
                //     depth: [],
                //     transparent: [],
                // }
                let perLight = this.scene.lightsManager.getLightByID(i.light_id);
                if (!perLight) {
                    throw new Error("light not found");
                }
                const valueOfLight: I_ShadowMapValueOfDC = {
                    light: perLight as BaseLight,
                    UUID: UUID,
                    matrixIndex: i.matrix_self_index
                };
                this.shadowmapDC[mergeLightUUID(UUID, i.matrix_self_index)] = {
                    [E_renderPassName.shadowmapOpacity]: [],
                    [E_renderPassName.shadowmapTransparent]: [],
                }
                if (this.transparent === true) {
                    this.createShadowMapTransparentDC(valueOfLight);
                }
                else {
                    this.createShadowMapDC(valueOfLight);
                }
            }
        }
    }
    /**检查是否有新摄像机，有进行更新 */
    checkUpgradeCameras() {
        const countsOfCamerasCommand = Object.keys(this.cameraDC).length;
        const countsOfCamera = this.scene.cameraManager.count();
        if (countsOfCamera > countsOfCamerasCommand) {
            this.upgradeCameras()
        }
    }
    /**检查是否有新光源，有进行更新 */
    checkUpgradeLights() {
        const countsOfCamerasCommand = Object.keys(this.shadowmapDC).length;
        const countsOfCameraActors = this.scene.lightsManager.getShdowMapsStructArray().length;
        if (countsOfCameraActors > countsOfCamerasCommand) {//比较的是shadowmap的数量
            this.upgradeLights()
        }
    }

    intUniformCommonEntity() {
        this.bufferCPU.uniformCommonEntity = new ArrayBuffer(this._entityCommonByteSize);
        this.bufferGPU.uniformCommonEntity = createUniformBuffer(this.device, "uniformCommonEntity:" + this.ID, this.bufferCPU.uniformCommonEntity);
    }
    /**
     * 被update调用，更新vs、fs的uniform
     * 
     * this.flagUpdateForPerInstance 影响是否单独更新每个instance，使用用户更新的update（）的结果，或连续的结果
     */
    updateUniformCommonEntity(clock: Clock): void {
        if (this.bufferCPU.uniformCommonEntity !== undefined) {

            const st_entityValues = this.bufferCPU.uniformCommonEntity;
            const st_entityViews = {
                time: new Float32Array(st_entityValues, 0, 1),
                last_time: new Float32Array(st_entityValues, 4, 1),
                instance_count: new Uint32Array(st_entityValues, 8, 1),
                vs_offset: new Float32Array(st_entityValues, 12, 1),
                animation_kind: new Uint32Array(st_entityValues, 16, 1),
                morpht_target_count: new Uint32Array(st_entityValues, 20, 1),
                vertex_count: new Uint32Array(st_entityValues, 24, 1),
                joint_matrix_count: new Uint32Array(st_entityValues, 28, 1),
            };
            st_entityViews.time[0] = clock.now;
            st_entityViews.last_time[0] = clock.last;
            st_entityViews.instance_count[0] = this.getInstancesCount();
            st_entityViews.vs_offset[0] = this.vsOffset;
            st_entityViews.animation_kind[0] = this.getAnimationKind();
            st_entityViews.morpht_target_count[0] = this.MorphtTargetCount;
            st_entityViews.vertex_count[0] = this.getVertexCount();
            st_entityViews.joint_matrix_count[0] = this.JointsMatCount;
            // console.log("joint_matrix_count", st_entityViews.joint_matrix_count[0]);
            // console.log("animation_kind", st_entityViews.animation_kind[0]);
            this.device.queue.writeBuffer(this.bufferGPU.uniformCommonEntity!, 0, this.bufferCPU.uniformCommonEntity);
        }
    }
    /**
     * 获取instance总数量：内部instance*外部instance
     * @returns number
     */
    getInstancesCount(): number {
        let outsideInstanceCount = this.outSideInstance.length;
        if (outsideInstanceCount === 0) outsideInstanceCount = 1;
        return this.instance.numInstances * outsideInstanceCount
    }

    /**
     * 检查相关storage buffer的状态，根据instance数量已经动画进行创建、更新或保持
     * @param name buffer name
     * @returns  boolen :是否存在
     * 1、instances 和 worldMatrix 会忽略返回值
     * 2、morph target 和 骨骼动画 根据是否有动画返回boolean值
     */
    checkStorageBuffer(name: string): boolean {
        /**
         * 1、判断ArrayBuffer是否存在
         * 2、判断长度是否与instance数量匹配
         * 3、判断是否存在动画
         *      A、morph target
         *      B、skins
         * 4、根据reNew是否创建ArrayBuffer和GPUBuffer
         */
        let reNew = false;
        let nameCPU = name as keyof typeof this.bufferCPU;
        //实例化
        if (name == "instances") {
            //没有
            if (this.bufferCPU[nameCPU] == undefined) {
                reNew = true;
            }
            //长度不相等
            else if (this.bufferCPU[nameCPU].byteLength != this.getInstancesCount() * this._instanceInfoByteSize) {
                reNew = true;
            }
        }
        else if (name == "wolrdMatrix") {
            //没有
            if (this.bufferCPU[nameCPU] == undefined) {
                reNew = true;
            }
            //长度不相等
            else if (this.bufferCPU[nameCPU].byteLength != this.getInstancesCount() * this._instanceWorldMatrixByteSize) {
                reNew = true;
            }
        }
        //morph target 
        else if (name == "morphMatrix") {//如果是变形目标
            //如果有morph target动画
            // if (this.getAnimationKind() == E_AnimationType.morphTarget||this.getAnimationKind() as number == 6) {
            if (this.isMorphTargetAnimation()) {
                //没有
                if (this.bufferCPU[nameCPU] == undefined) {
                    reNew = true;
                }
                //长度不相等
                else if (this.bufferCPU[nameCPU].byteLength != this.getInstancesCount() * this._instanceMorphTargetByteSize) {
                    reNew = true;
                }
            }
            else {
                return false;//不存在
            }
        }
        //骨骼动画
        else if (name == "jointMatrix") {
            //如果有骨骼动画
            if (this.isSkeletonAnimation()) {
                //没有
                if (this.bufferCPU[nameCPU] == undefined) {
                    reNew = true;
                }
                //长度不相等,默认是四个关联矩阵
                else if (this.bufferCPU[nameCPU].byteLength != this.getInstancesCount() * this._instanceJointMatrixByteSize) {
                    reNew = true;
                }
            }
            else {
                return false;//不存在
            }
        }
        //new or renew :cpu and gpu
        if (reNew) {
            this.flagInstanceArrayBufferReNew = true;//更新需要reNew的时间
            let size = 16;
            if (name == "instances") {
                size = this._instanceInfoByteSize;
            }
            else if (name == "wolrdMatrix") {
                size = this._instanceWorldMatrixByteSize;
            }
            else if (name == "jointMatrix") {
                size = this._instanceJointMatrixByteSize;
            }
            else if (name == "morphMatrix") {
                size = this._instanceMorphTargetByteSize;
            }
            else {
                throw new Error("checkStorageBuffer: unknown name:" + name);
            }
            let sizeOfInstances = this.getInstancesCount() * size;
            //创建ArrayBuffer，旧的ArrayBuffer由GC回收
            this.bufferCPU[nameCPU] = new ArrayBuffer(sizeOfInstances);     //创建新的ArrayBuffer，空的，不是N个单位矩阵
            //销毁旧的GPUBuffer，句柄由webGPU GC回收
            if (this.bufferGPU[nameCPU]) {
                this.bufferGPU[nameCPU].destroy();
            }
            //创建新的GPUBuffer
            this.bufferGPU[nameCPU] = createEmptyGPUBuffer(this.device, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, sizeOfInstances, name + ":" + this.ID);
        }

        return this.bufferCPU[nameCPU] != undefined;
    }
    /** 更新|初始化实例化数组 */
    updateInstanceBuffer() {
        this.checkStorageBuffer("instances");//instance 不考虑返回值
        //update：cpu and gpu
        if (this.bufferGPU.instances && this.bufferCPU.instances) {
            //外部instance
            for (let i in this.outSideInstance) {
                let perNode = this.outSideInstance[i];
                //内部instance
                for (let j = 0; j < this.instance.numInstances; j++) {
                    // let instanceIndex = Number(i) * Number(j) * this._instanceInfoByteSize;
                    let instanceIndex = (Number(i) * this.instance.numInstances + Number(j)) * this._instanceInfoByteSize;

                    const st_instance_infoViews = {
                        node_id: new Uint32Array(this.bufferCPU.instances, instanceIndex, 1),
                        stage_id: new Uint32Array(this.bufferCPU.instances, instanceIndex + 4, 1),
                        uv: new Float32Array(this.bufferCPU.instances, instanceIndex + 8, 2),
                    };
                    st_instance_infoViews.node_id[0] = perNode.ID;
                    st_instance_infoViews.stage_id[0] = perNode.stageID;
                    st_instance_infoViews.uv.set(this._uv);
                }
            }
            this.device.queue.writeBuffer(this.bufferGPU.instances, 0, this.bufferCPU.instances);
        }
        else {
            throw new Error("更新实例化数组与GPU实例化数组失败");
        }
    }
    /**
     * 获取内部instance的矩阵
     * @param i 内部instance的索引
     * @returns 内部instance的矩阵
     */
    getInsideInstanceMatrix(i: number): Mat4 {
        //由于子类constructor中的inside判断或晚于super，所有在第一次使用时再生成。
        if (this._insideInstanceMatrix.length == 0) {
            this._insideInstanceMatrix = this.generateInsideInstanceMatrix();
        }
        return this._insideInstanceMatrix[i];
    }
    /** 更新|初始化 world matrix 数组（cpu and gpu） 
     * 1、生成所有的instance 的矩阵，连续的，不考虑可见性与可用性；后期增加判断，避免重复计算
    */
    updateWorldMatrixBuffer(_clock?: Clock) {
        this.checkStorageBuffer("wolrdMatrix");//world matrix 不考虑返回值
        //update：cpu and gpu
        if (this.bufferGPU.wolrdMatrix && this.bufferCPU.wolrdMatrix) {
            //外部instance
            for (let i in this.outSideInstance) {
                let perNode = this.outSideInstance[i];
                //内部instance
                for (let j = 0; j < this.instance.numInstances; j++) {
                    let instanceIndex = (Number(i) * this.instance.numInstances + Number(j)) * this._instanceWorldMatrixByteSize;
                    const worldMatrix = new Float32Array(this.bufferCPU.wolrdMatrix, instanceIndex, 16);//array buffer view ，全部为0的arraybuffer，参见checkStorageBuffer
                    let matrixWorld = mat4.multiply(this.getMatrixWorldOfInstance(perNode), this.getInsideInstanceMatrix(j));//内部矩阵乘以外部矩阵，得到世界矩阵
                    worldMatrix.set(matrixWorld)
                }
            }
            this.device.queue.writeBuffer(this.bufferGPU.wolrdMatrix, 0, this.bufferCPU.wolrdMatrix);
        }
        else {
            throw new Error("更新世界矩阵数组与GPU世界矩阵数组失败");
        }
    }
    /**
     * morph target update 
     * 如果没有morph target，使用默认的storage buffer占位
     */
    updateMorphtTargetBuffer() {
        let state = this.checkStorageBuffer("morphMatrix");
        if (state == false && this.bufferGPU.morphMatrix == undefined) {
            this.bufferGPU.morphMatrix = this.scene.getResourceOneStorageMatrix();
        }
        else if (this.bufferGPU.morphMatrix != this.scene.getResourceOneStorageMatrix()) {
            // throw new Error("未完成")
            //update：cpu and gpu
            if (this.bufferGPU.morphMatrix && this.bufferCPU.morphMatrix) {
                for (let i in this.outSideInstance) {
                    let perNode = this.outSideInstance[i];
                    let instanceIndex = parseInt(i);
                    for (let j = 0; j < this.instance.numInstances; j++) {
                        let offset = (instanceIndex * this.instance.numInstances + j) * this.MorphTargetByteSize;    //内外部instance的偏移量加上内部instance的偏移量
                        this.device.queue.writeBuffer(this.bufferGPU.morphMatrix, offset, perNode.MorphTarget!);//写入每个instance的矩阵,内部instance写入相同的矩阵
                    }
                }
            }
            else {
                throw new Error("更新世界矩阵数组与GPU世界矩阵数组失败");
            }
        }
    }
    /**
     * 骨骼动画 update 
     * 如果没有morph target，使用默认的storage buffer占位
     */
    updateJointMatrixBuffer() {
        let state = this.checkStorageBuffer("jointMatrix");
        // 如果没有jointMatrix，且GPU没有jointMatrix，使用默认的storage buffer占位
        if (state == false && this.bufferGPU.jointMatrix == undefined) {
            this.bufferGPU.jointMatrix = this.scene.getResourceOneStorageMatrix();
        }
        else if (this.bufferGPU.jointMatrix != this.scene.getResourceOneStorageMatrix()) {
            // throw new Error("未完成")
            //update：cpu and gpu
            if (this.bufferGPU.jointMatrix && this.bufferCPU.jointMatrix) {
                for (let i in this.outSideInstance) {
                    let perNode = this.outSideInstance[i];
                    let instanceIndex = parseInt(i);
                    for (let j = 0; j < this.instance.numInstances; j++) {
                        let offset = (instanceIndex * this.instance.numInstances + j) * this.JointMatrixByteSize;    //内外部instance的偏移量加上内部instance的偏移量
                        this.device.queue.writeBuffer(this.bufferGPU.jointMatrix, offset, perNode.JointsMat!);//写入每个instance的矩阵,内部instance写入相同的矩阵
                    }
                }
            }
            else {
                throw new Error("更新世界矩阵数组与GPU世界矩阵数组失败");
            }
        }
    }

    /**
     * 获取用户自定义的shader代码
     * @returns string
     */
    getUserCodeVS(): string {
        if (this.input.shaderCode) {
            return this.input.shaderCode;
        }
        return "";
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //uniform merge part
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 获取bindGroup和bindGroupLayout。由DCG.initUniformPart() 和BaseDrawCommand.doEncoder()调用
     * 时间轴：render阶段
     * @returns I_bindGroupAndGroupLayout
     */
    getBindGroupAndBindGroupLayout(): I_bindGroupAndGroupLayout {
        /**
         * 1、判断bind group 和layout 是否存在，没有新建
         *      A、判断 this.bindGroup ,this.bindGroupLayout  undefined
         *      B、新建
         *      C、缓存layout ，bindgroup
         * 2、如果存在，判断是否需要更新bind group。layout 不变.
         *      A、判断 flagInstanceArrayBufferReNew ，
         *      B、如果=true ，更新，并重置为false
         *      C、返回值
         * 
         */
        //undefined，创建
        if (this.bindGroup == undefined && this.bindGroupLayout == undefined) {
            //////////////////////////////////////////////////
            //bind group  layout
            let bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
                label: `entity:${this.ID} @ ${this.scene.clock.now}`,
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "uniform"
                        }
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "read-only-storage"
                        }
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "read-only-storage"
                        }
                    },
                    {
                        binding: 3,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "read-only-storage"
                        }
                    },
                    {
                        binding: 4,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "read-only-storage"
                        }
                    },
                ]
            }
            this.bindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);;
            //////////////////////////////////////////////////
            //bind group  
            let entries: GPUBindGroupEntry[] = this.generateGPUBindGroupEntries();
            let bindGroupDescriptor: GPUBindGroupDescriptor = {
                label: `entity:${this.ID} @ ${this.scene.clock.now}`,
                layout: this.bindGroupLayout,
                entries: entries
            }
            this.bindGroup = this.device.createBindGroup(bindGroupDescriptor);
        }
        //当前帧有instance变化，更新
        else if (this.flagInstanceArrayBufferReNew === true) {
            let entries: GPUBindGroupEntry[] = this.generateGPUBindGroupEntries();
            let bindGroupDescriptor: GPUBindGroupDescriptor = {
                label: `entity:${this.ID} @ ${this.scene.clock.now}`,
                layout: this.bindGroupLayout,
                entries: entries
            }
            this.bindGroup = this.device.createBindGroup(bindGroupDescriptor);
            this.flagInstanceArrayBufferReNew = false;//重置为false
        }
        return {
            bindGroup: this.bindGroup,
            bindGroupLayout: this.bindGroupLayout
        }
    }
    /**
     * 生成bind group 的entries
     * @returns GPUBindGroupEntry[]
     */
    generateGPUBindGroupEntries(): GPUBindGroupEntry[] {
        let entries: GPUBindGroupEntry[] = [];
        for (let i in this.bufferGPU) {
            let binding = this.getBindingOfBindGroup(i);//获取绑定的顺序
            let perEntry: GPUBindGroupEntry = {
                binding: binding,
                resource: {
                    buffer: this.bufferGPU[i as keyof typeof this.bufferGPU]!,
                }
            }
            entries.push(perEntry)
        }
        return entries;
    }
    /**
     * 获取bind group 的binding,固定的与shader中的顺序对应
     * 说明：
     *  1、bufferGPU使用的对象，没有使用Map。原因是需要有通用的占位Storage buffer，直接指向对象可以共享占位GPUBuffer。
     *  2、对象不能保障顺序，所以需要一个单独绑定的顺序。
     * @param name 
     * @returns number
     */
    getBindingOfBindGroup(name: string): number {
        switch (name) {
            case "uniformCommonEntity":
                return 0;
            case "instances":
                return 1;
            case "wolrdMatrix":
                return 2;
            case "morphMatrix":
                return 3;
            case "jointMatrix":
                return 4;
        }
        throw new Error(`未找到绑定${name}`);
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //TTPF 相关部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 透明材质的TTPF的uniform layer 
     */
    uniformOfTTPFSize: number = 16;//需要确保 uniform 缓冲区的大小至少等于管线要求的最小大小，且是 16 字节的倍数。
    /**
     * TTPF使用的uniform的ArrayBuffer
     */
    uniformOfTTPF: ArrayBuffer = new ArrayBuffer(this.uniformOfTTPFSize);
    /**TTPF 是使用的 uniform: 主要是目的是更新entity所在的TTP的层数（0-3） 
     * I_uniformArrayBufferEntry结构使用在createTransparent（）中的TTPF代码部分
    */
    unifromTTPF!: I_uniformArrayBufferEntry;
    /**
     * 设置透明材质的TTPF的uniform
     * @param layer  对应RGBA四层
     */
    setUniformLayerOfTTPF(layer: number) {
        let view = new Uint32Array(this.uniformOfTTPF);
        view[0] = layer;
        view[1] = this.ID;
        this.updateUniformLayerOfTTPF();
        // console.log(view)
    }

    /**
     * 
     */
    abstract updateUniformLayerOfTTPF(): void

}

