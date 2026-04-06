
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
import { I_bindGroupAndGroupLayout } from "../command/base";
import { I_ShaderTemplate } from "../shadermanagemnet/base";
import { EntityManager } from "./entityManager";
import { Scene } from "../scene/scene";
import { DrawCommandGenerator } from "../command/DrawCommandGenerator";
import { E_renderPassName } from "../scene/renderManager";
import { mergeLightUUID } from "../light/lightsManager";
import { mat4, Mat4, vec3, Vec3 } from "wgpu-matrix";
import { NodeObject } from "../organization/nodeObject";
import { NodeSpace } from "../organization/nodeSpace";
import { I_pointerCreateParams, I_pointerStruct } from "../bufferBlock/pointer";
import { E_BOLBufferType } from "../bufferBlock/base";
import { get } from "../../../@loaders.gl/draco/dist/draco-worker-node";


export abstract class BaseEntity extends NodeSpace {
    ////////////////////////////////////////////////////////////////////
    //基础属性
    input: IV_BaseEntity;
    /**内部实例化数量，默认为1 */
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

    ///////////////////////////////////////////////////////////////////
    //uniform
    /** 外部实例化数组stride数量，默认为4 */
    outsideInstanceCountOfDefaultStride: number = 4;
    /** 实例化数组最后重新的时间 ,有stride（256byte）存在，外部实例化数量改变时，可能不需要renew */
    flagInstanceArrayBufferReNew: boolean = false;
    /** 是否外部实例化数量改变 ，只标记是否有数量变化*/
    flagOutsideInstanceCountChange: boolean = false;

    /** storage buffer 列表
     * 1、instances 实例化数组
     * 2、wolrdMatrix 世界矩阵数组
     */
    storageBufferList: {
        name: string;
        byteSize: number;
    }[] = [
            {
                name: "instances",
                byteSize: this._instanceInfoByteSize
            },
            {
                name: "wolrdMatrix",
                byteSize: this._instanceWorldMatrixByteSize
            }];

    bufferPointers: {
        uniformCommonEntity: I_pointerStruct | undefined;
        instances: I_pointerStruct | undefined;
        wolrdMatrix: I_pointerStruct | undefined;
    } = {
            uniformCommonEntity: undefined,
            instances: undefined,
            wolrdMatrix: undefined
        };
    /** 顶点buffer 列表:有DCG生成的顶点buffer和index buffer
     *  1、有DCG写入
    */
    vertexPointers: {
        [key: string]: {
            pointer?: I_pointerStruct;
            gpuBuffer?: any;
        }
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
    /** 上一帧外部实例化数量 */
    outSideInstanceCountPreFrame: number = 0;


    /** inside实例化矩阵数组，每个内部实例一个矩阵 */
    _insideInstanceMatrix: Mat4[] = [];
    ///////////////////////////////////////////////////////////////////
    //bind group
    /** VS bind group */
    bindGroup!: GPUBindGroup;
    /** VS bind group layout */
    bindGroupLayout!: GPUBindGroupLayout;
    ///////////////////////////////////////////////////////////////////
    //空间属性
    boundingBox: boundingBox | undefined;
    // = {
    //     min: [0, 0, 0],
    //     max: [0, 0, 0],
    // };//initDCC中赋值
    boundingSphere!: boundingSphere | undefined;



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
            // [E_renderPassName.depth]: DrawCommand[],
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
    // abstract createDeferDepthDC(camera: BaseCamera): void
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


    inputValues: IV_BaseEntity;

    constructor(input: IV_BaseEntity) {
        super(input);
        this.inputValues = input;
        this.type = "entity";
        this._state = E_lifeState.constructing;
        this.input = input;
        if (input.instance) {
            this.instance = input.instance;
            this.checkInstance();
        }
        if (input.primitive?.cullMode) {
            this._cullMode = input.primitive.cullMode;
        }
        //////////////////
        //about shader
        if (input.shadow) {
            if (input.shadow.accept === false) this._shadow.accept = false;
            if (input.shadow.generate === false) this._shadow.generate = false;
        }
        // console.log(this.ID);
        this._state = E_lifeState.constructed;

    }
    abstract detachData(): void;
    _destroy(): void {
        for (let i of this.outSideInstance) {
            i.destroy();
        }
        this.outSideInstanceCountPreFrame = 0;
        for (let i in this.bufferPointers) {
            let perPointer = this.bufferPointers[i as keyof typeof this.bufferPointers]!;
            console.log("===entity destroy release pointer", perPointer.pointerID);
            this.scene.pointers.releasePointer(perPointer.pointerID);
        }
        for (let i in this.vertexPointers) {
            if (!this.vertexPointers[i as keyof typeof this.vertexPointers].pointer != undefined) {
                let perPointer: I_pointerStruct = this.vertexPointers[i as keyof typeof this.vertexPointers].pointer!;
                console.log("===entity destroy release pointer", perPointer.pointerID);
                this.scene.pointers.releasePointer(perPointer.pointerID);
            }
        }

    }
    /**
     * 检查内部instance是否合法
     */
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
    override async init(scene: Scene): Promise<any> {
        this._state = E_lifeState.initializing;
        this.MSAA = scene.MSAA;
        this.deferColor = scene.deferRender.deferRenderColor;

        // this.outSideInstance.push(this);//临时代码

        await super.init(scene);
        this.intUniformCommonEntity();
        // this.updateInstanceBuffer();
        // this.updateWorldMatrixBuffer();
        // this.updateJointMatrixBuffer();

        this.transparent = this.getTransparent();
        this.DCG = this.scene.DCG;//new DrawCommandGenerator({ scene: this.scene, parent: this });
        this._state = E_lifeState.finished;
        // return this.renderID + 1;
    }


    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 基础部分
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //20260322,todo:确认是否使用，因为BaseEntity继承自NodeSpace，没有worldPosition的abstract定义
    updateWorldPosition(_matrixWorld?: Mat4): Vec3 {
        return this.worldPosition;
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
        // return this.updateWorldPosition(this.getMatrixWorldOfInstance(instance));
        let _matrixWorld = this.getMatrixWorldOfInstance(instance);
        return vec3.fromValues(_matrixWorld[12], _matrixWorld[13], _matrixWorld[14]);
    }
    /** 设置entity的包围盒
     * @param box 包围盒min,max坐标
     */
    setBoundingBox(box: boundingBox) {
        this.boundingBox = box;
        this.boundingSphere = this.generateSphere(box);
    }
    /** 根据顶点位置生成世界坐标的Box，当前entity的原始包围盒，不涉及变换 */
    generateBox(position: number[]): boundingBox | undefined {
        if (position) {
            let box = generateBox3(position);
            return box;
        }
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
        return this.bufferPointers.uniformCommonEntity;
    }

    /**
     * 20260322，todo，取消cameraDC中的按照id排序
     * 检查camear的id在commands中是否已经存在 */
    checkIdOfCommands(id: string, commands: Object): boolean {
        for (let i in commands) {
            if (i == id) return true;
        }
        return false;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 阴影相关部分
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // /**是否产生阴影
    //  * @returns boolean
    //  */
    // getShadwoMapGenerate(): boolean {
    //     return this._shadow.generate;
    // }
    // /**
    //  * 是否接受阴影
    //  * @returns boolean
    //  */
    // getShadowmAccept() {
    //     return this._shadow.accept;
    // }

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

        //判断初始化状态是否为完成，判断状态，判断是否有外部实例
        if (this._state === E_lifeState.finished && this.checkStatus() && this.getInstancesCount()) {
            super.update(clock, updateSelftFN);
            return true;
        }
        return false;
    }
    preUpdate(clock: Clock) {
        //注销状态或注销中
        if (this._isDestroy) return;
        this.flagOutsideInstanceCountChange = false;
        /**
         * 1、instance 增加，可以进行正常的update
         * 2、instance 减少，当全部删除时，无法进行update。需要进行相关的storage pointer的处理
         * 3、instance 保持不变，进行正常的update
         */
        if (this.outSideInstance.length !== this.outSideInstanceCountPreFrame) {
            // console.log("entityID:", this.ID, "外部实例数量", this.getInstancesCount());
            this.flagOutsideInstanceCountChange = true;
            this.outSideInstanceCountPreFrame = this.outSideInstance.length;
            this.checkStorageBuffer(this.storageBufferList);
        }
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
        this.updateUniformCommonEntity(clock);   //todo,暂时更新，后续按需进行更新
        this.updateInstanceBuffer();            //更新instance buffer
        this.updateWorldMatrixBuffer(clock);    //更新world matrix buffer
        //检查是否有新摄像机，有进行更新
        this.checkUpgradeCameras();
        //检查是否有新光源，有进行更新
        this.checkUpgradeLights();
    }

    /**
    * 获取instance总数量：内部instance*外部instance
    * @param outside 是否只获取外部instance数量
    *      true表示只获取外部instance数量，
    *      false表示获取内部instance数量*外部instance数量
    * @returns number
    */
    getInstancesCount(): number {
        return this.outSideInstance.length;
    }
    /** 获取instance总数量：内部instance*外部instance
     * @returns number
     */
    getInstanceCountTotal(): number {
        let outsideInstanceCount = this.getInstancesCount();
        return this.instance.numInstances * outsideInstanceCount
    }

    /**
     * 检查相关storage buffer的状态，根据instance数量已经动画进行创建、更新或保持
     * @param name buffer name
     * @returns  boolen :是否存在
     * 1、instances 和 worldMatrix 会忽略返回值
     * 2、morph target 和 骨骼动画 根据是否有动画返回boolean值
     */
    checkStorageBuffer(bufferList: {
        name: string;
        byteSize: number;
    }[]) {
        for (let perBuffer of bufferList) {
            /**
             * 1、判断ArrayBuffer是否存在
             * 2、判断长度是否与instance数量匹配
             * 3、判断是否存在动画
             *      A、morph target
             *      B、skins
             * 4、根据reNew是否创建ArrayBuffer和GPUBuffer
             */
            let nameOfPointer = perBuffer.name as keyof typeof this.bufferPointers;
            let byteSizeOfBuffer = perBuffer.byteSize;
            //实例化,最少1个（分配pointer使用）
            let instanceCount = this.getInstancesCount() || 1;
            //计算需要的pointer数量
            let count = Math.ceil(instanceCount / this.outsideInstanceCountOfDefaultStride);
            //计算需要的pointer长度
            let sizeOfInstances = Math.ceil(count * byteSizeOfBuffer * this.outsideInstanceCountOfDefaultStride / 256) * 256;
            //没有storage pointer，创建一个
            if (this.bufferPointers[nameOfPointer] == undefined) {
                this.flagInstanceArrayBufferReNew = true;//更新需要reNew的时间
                let pointerParams: I_pointerCreateParams = {
                    name: `${this.ID.toString()} ${perBuffer.name}:count=${instanceCount},size=${sizeOfInstances}`,
                    byteSize: sizeOfInstances,
                    type: E_BOLBufferType.storage,
                    viewType: "f32",//不使用view，各自更新各自的buffer
                };
                this.bufferPointers[nameOfPointer] = this.scene.pointers.createPointer(pointerParams, this);
                // console.log("EntityID:", this.ID, perBuffer.name, "创建大小:", sizeOfInstances, "指针ID:", this.bufferPointers[nameOfPointer].pointerID, "实例数量:", instanceCount);

            }
            //长度不相等
            else if (this.bufferPointers[nameOfPointer].byteLength != sizeOfInstances) {
                this.flagInstanceArrayBufferReNew = true;//更新需要reNew的时间
                let newPointer = this.scene.pointers.resizePointer(this.bufferPointers[nameOfPointer].pointerID, sizeOfInstances);
                if (newPointer) {
                    newPointer.name = `${this.ID.toString()} ${perBuffer.name}:count=${instanceCount},size=${sizeOfInstances}`;
                    this.bufferPointers[nameOfPointer] = newPointer;
                    // console.log("Resize ~ EntityID:", this.ID, "实例数量:", instanceCount, perBuffer.name, `Resize pointer:${newPointer.pointerID},size:${sizeOfInstances},offset:${newPointer.offset}`);
                }
                else {
                    throw new Error("更新实例化数组与GPU实例化数组失败");
                }
            }
        }
    }
    /** 清除DCC 渲染队列*/
    clearDC() {
        this.cameraDC = {};
        this.shadowmapDC = {};
    }
    // /**
    //  */
    // onResize(): void {
    //     for (let i in this.cameraDC) {
    //         let perCameraDC = this.cameraDC[i];
    //         // perCameraDC.transparent = [];
    //     }
    //     // this.upgradeCameras();
    // }

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
                        // [E_renderPassName.depth]: [],
                        [E_renderPassName.transparent]: [],
                        [E_renderPassName.MSAA]: [],
                    }
                }
                if (this.transparent === true) {
                    this.createTransparent(camera);
                }
                else {
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
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // pointer 相关

    intUniformCommonEntity() {
        let offsetSize = Math.ceil(this._entityCommonByteSize / 256) * 256;
        let pointerParams: I_pointerCreateParams = {
            name: this.ID.toString() + " uniform",
            byteSize: offsetSize,//uniform data 的bytesize大小
            type: E_BOLBufferType.uniform,
            viewType: "u8",//由于data是ArrayBuffer,按照u8处理
        };
        this.bufferPointers.uniformCommonEntity = this.scene.pointers.createPointer(pointerParams, this);
    }
    /**
     * 被update调用，更新vs、fs的uniform
     * 
     * this.flagUpdateForPerInstance 影响是否单独更新每个instance，使用用户更新的update（）的结果，或连续的结果
     */
    updateUniformCommonEntity(clock: Clock, write: boolean = true): void {
        if (this.bufferPointers.uniformCommonEntity !== undefined) {
            const st_entityValues = this.bufferPointers.uniformCommonEntity.cpuBuffer;
            let offset = this.bufferPointers.uniformCommonEntity.offset;
            const st_entityViews = {
                time: new Float32Array(st_entityValues, offset, 1),
                last_time: new Float32Array(st_entityValues, offset + 4, 1),
                instance_count: new Uint32Array(st_entityValues, offset + 8, 1),
                vs_offset: new Float32Array(st_entityValues, offset + 12, 1),
                animation_kind: new Uint32Array(st_entityValues, offset + 16, 1),
                morpht_target_count: new Uint32Array(st_entityValues, offset + 20, 1),
                vertex_count: new Uint32Array(st_entityValues, offset + 24, 1),
                joint_matrix_count: new Uint32Array(st_entityValues, offset + 28, 1),
            };
            st_entityViews.time[0] = clock.now;
            st_entityViews.last_time[0] = clock.last;
            st_entityViews.instance_count[0] = this.getInstancesCount();
            st_entityViews.vs_offset[0] = this.vsOffset;
            st_entityViews.animation_kind[0] = 0;//this.getAnimationKind();
            st_entityViews.morpht_target_count[0] = 0;//this.MorphtTargetCount;
            st_entityViews.vertex_count[0] = 0;//this.getVertexCount();
            st_entityViews.joint_matrix_count[0] = 0;// this.JointsMatCount;
            this.scene.pointers.updatePointerWriteTime(this.bufferPointers.uniformCommonEntity);
        }
    }


    /** 更新|初始化实例化数组 */
    updateInstanceBuffer() {
        if (this.flagOutsideInstanceCountChange) {
            //update：cpu and gpu
            if (this.bufferPointers.instances) {
                let offset = this.bufferPointers.instances.offset;
                //外部instance
                for (let i in this.outSideInstance) {
                    let perNode = this.outSideInstance[i];
                    //内部instance
                    for (let j = 0; j < this.instance.numInstances; j++) {
                        // let instanceIndex = Number(i) * Number(j) * this._instanceInfoByteSize;
                        let instanceIndex = (Number(i) * this.instance.numInstances + Number(j)) * this._instanceInfoByteSize + offset;
                        const st_instance_infoViews = {
                            node_id: new Uint32Array(this.bufferPointers.instances.cpuBuffer, instanceIndex, 1),
                            stage_id: new Uint32Array(this.bufferPointers.instances.cpuBuffer, instanceIndex + 4, 1),
                            uv: new Float32Array(this.bufferPointers.instances.cpuBuffer, instanceIndex + 8, 2),
                        };
                        st_instance_infoViews.node_id[0] = perNode.ID;
                        st_instance_infoViews.stage_id[0] = perNode.stageID;
                        st_instance_infoViews.uv.set(this._uv);
                    }
                }
                this.scene.pointers.updatePointerWriteTime(this.bufferPointers.instances);
            }
            else {
                throw new Error("更新实例化数组与GPU实例化数组失败");
            }
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
        //update：cpu and gpu
        if (this.bufferPointers.wolrdMatrix) {
            let offset = this.bufferPointers.wolrdMatrix.offset;
            //外部instance
            for (let i in this.outSideInstance) {
                let perNode = this.outSideInstance[i];
                //内部instance
                for (let j = 0; j < this.instance.numInstances; j++) {
                    let instanceIndex = (Number(i) * this.instance.numInstances + Number(j)) * this._instanceWorldMatrixByteSize + offset;
                    const worldMatrix = new Float32Array(this.bufferPointers.wolrdMatrix.cpuBuffer, instanceIndex, 16);//array buffer view ，全部为0的arraybuffer，参见checkStorageBuffer
                    let matrixWorld = mat4.multiply(this.getMatrixWorldOfInstance(perNode), this.getInsideInstanceMatrix(j));//内部矩阵乘以外部矩阵，得到世界矩阵
                    worldMatrix.set(matrixWorld)
                }
            }
            this.scene.pointers.updatePointerWriteTime(this.bufferPointers.wolrdMatrix);
        }
        else {
            throw new Error("更新世界矩阵数组与GPU世界矩阵数组失败");
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
        let createBindGroup = false;
        //undefined，创建
        if (this.bindGroup == undefined && this.bindGroupLayout == undefined) {
            //////////////////////////////////////////////////
            //bind group  layout
            let bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
                label: `entity:${this.ID}`,
                entries: [
                    {//@group(1) @binding(0) var<uniform> u_entity_base:st_entity;
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "uniform"
                        }
                    },
                    {//@group(1) @binding(1) var<storage> u_entity_instances: array<st_instance_info>;      //length=instance count
                        binding: 1,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "read-only-storage"
                        }
                    },
                    {//@group(1) @binding(2) var<storage> world_matrix: array<mat4x4f>;          //length=instance count;
                        binding: 2,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: "read-only-storage"
                        }
                    },
                    // {//@group(1) @binding(3) var<storage> morph_matrix: array<f32>;              //length=instance count * morph target count * vertex count
                    //     binding: 3,
                    //     visibility: GPUShaderStage.VERTEX,
                    //     buffer: {
                    //         type: "read-only-storage"
                    //     }
                    // },
                    // {//@group(1) @binding(4) var<storage> joint_matrix: array<mat4x4f>;           //length=instance count * joint matrix count
                    //     binding: 4,
                    //     visibility: GPUShaderStage.VERTEX,
                    //     buffer: {
                    //         type: "read-only-storage"
                    //     }
                    // },
                ]
            }
            this.bindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);;
            //////////////////////////////////////////////////
            //bind group  
            createBindGroup = true;
        }
        //当前帧有instance变化，更新
        else if (this.flagInstanceArrayBufferReNew === true) {
            createBindGroup = true;
        }
        //当前帧有pointer布局有变化（来自BOL系统，非entity的变化，比如BOL的rebuild等），更新bind group
        else {
            //当前帧匹配，调试模式下，使用手工调用rebuild，不能精确匹配。非手工模式可以
            // if (this.bufferPointers.uniformCommonEntity?.rebuildTime == this.scene.clock.now
            //     ||
            //     this.bufferPointers.instances?.rebuildTime == this.scene.clock.now
            //     ||
            //     this.bufferPointers.wolrdMatrix?.rebuildTime == this.scene.clock.now
            // )

            //匹配手工和当前帧模式
            if (this.bufferPointers.uniformCommonEntity?.rebuildTime
                ||
                this.bufferPointers.instances?.rebuildTime
                ||
                this.bufferPointers.wolrdMatrix?.rebuildTime
            ) {
                //重新设置为0
                this.bufferPointers.uniformCommonEntity!.rebuildTime = 0;
                this.bufferPointers.instances!.rebuildTime = 0;
                this.bufferPointers.wolrdMatrix!.rebuildTime = 0;
                createBindGroup = true;
                // console.log("rebuild time:", this.bufferPointers.wolrdMatrix?.rebuildTime, "system time:", this.scene.clock.now);
            }
        }

        //创建或更新bind group
        if (createBindGroup === true) {
            let entries: GPUBindGroupEntry[] = this.generateGPUBindGroupEntries();
            let bindGroupDescriptor: GPUBindGroupDescriptor = {
                label: `entity:${this.ID}`,
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
     * todo:20260322,这里需要BOL改造
     * 生成bind group 的entries
     * @returns GPUBindGroupEntry[]
     */
    generateGPUBindGroupEntries(): GPUBindGroupEntry[] {
        let entries: GPUBindGroupEntry[] = [];
        for (let i in this.bufferPointers) {
            let binding = this.getBindingOfBindGroup(i);//获取绑定的顺序
            let perEntry: GPUBindGroupEntry = {
                binding: binding,
                resource: {
                    buffer: this.bufferPointers[i as keyof typeof this.bufferPointers]!.gpuBufferView.buffer,
                    offset: this.bufferPointers[i as keyof typeof this.bufferPointers]!.gpuBufferView.offset,
                    size: this.bufferPointers[i as keyof typeof this.bufferPointers]!.gpuBufferView.size,
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
            // case "morphMatrix":
            //     return 3;
            // case "jointMatrix":
            //     return 4;
        }
        throw new Error(`未找到绑定${name}`);
    }


}

