import { mat4, quat, Quat, vec3, vec4, Vec4, type Mat4, type Vec3 } from "wgpu-matrix";
import { WeGenerateID, WeGenerateUUID } from "../math/baseFunction";
import type { Scene } from "../scene/scene";
import { BaseCamera } from "../camera/baseCamera";
import { BaseLight } from "../light/baseLight";
import { E_lifeState, I_Update, weMat4, weVec2, weVec3, weVec4 } from "../base/coreDefine";
import { Clock } from "../scene/clock";
import { BaseEntity } from "../entity/baseEntity";
import { isWeMat4, isWeVec3, isWeVec4 } from "../base/coreFunction";
import { ResourceManagerOfGPU } from "../resources/resourcesGPU";
import { E_renderPassName } from "../scene/renderManager";
import { BaseAnimation } from "../animation/BaseAnimation";
import { BaseParticle } from "../particle/baseParticle";
import { AnimationGroup } from "../animation/animationGroup";
import { BaseModel } from "../model/BaseModel";
import { WeightMixAnimation } from "../animation/weightMixAnimation";
import { SkinAnimation } from "../animation/skin";


export interface I_UUID {
    UUID: string,
    _isDestroy: boolean,

}
////////////////////////////////////////////////////////////RootGPU//////////////////////////////////////////////////////////////////////////////////////////


export abstract class RootGPU implements I_UUID {
    device!: GPUDevice;
    scene!: Scene;
    /**
     * 节点名称
     * node name
     */
    _name: string;
    get Name() { return this._name }
    set Name(value: string) {
        this._name = value;
    }
    /**
     * 节点ID
     * node ID
     */

    _id!: number;
    set ID(id) { this._id = id; }
    get ID(): number { return this._id; }
    /**
     * 节点UUID
     * node UUID
     */

    UUID!: string;
    _isDestroy: boolean = false;
    _state: E_lifeState = E_lifeState.unstart;
    inputValues!: I_Update;
    lastUpdaeTime: number = 0;

    /**
     * 节点类型
     * node type
     */
    type!: string;

    /**
     * 映射列表，用于存储映射关系，例如：[texture, bindGroupEntry]
     * 例如：[texture, bindGroupEntry]
     * destroy时需要删除映射关系
     */
    mapList: {
        key: any,//key of map
        type: string, //类型
        map?: string,//明确的Map<>
    }[] = [];

    resourcesGPU!: ResourceManagerOfGPU;
    /**
     * 节点是否以及GPU准备好
     * node is ready of GPU
     */
    _readyForGPU!: boolean;
    constructor(input?: I_Update) {
        this.UUID = WeGenerateUUID();
        this.ID = WeGenerateID();
        // console.log("create root:", this.ID);
        if (input) this.inputValues = input;
        if (input?.name) this._name = input!.name!;
        else this._name = this.ID.toString();

    }

    isDestroy() {
        return this._isDestroy;
    }
    /**
     * 三段式初始化的第二步：init()
     * 
     * @param scene 
     * @param parent 
     * @param renderID 
     * @returns 
     */
    async init(scene: Scene): Promise<any> {
        await this.setRootENV(scene);
        await this.readyForGPU();
    }
    /**由init()调用 */
    async setRootENV(scene: Scene) {
        this.device = scene.device;
        this.scene = scene;
        this.resourcesGPU = scene.resourcesGPU;
        this._readyForGPU = true;
    }
    /**
     * 三段式初始化的第三步：readyForGPU
     * 当前对象的GPU已经可以用时，执行此调用。
     * when GPU is ready, call this function
     */
    abstract readyForGPU(): Promise<any>
    destroy(): void {
        if (this.resourcesGPU) {
            for (let i of this.mapList) {
                if (i.map && this.resourcesGPU.getProperty(i.map as keyof ResourceManagerOfGPU)) {
                    (this.resourcesGPU[i.map as keyof ResourceManagerOfGPU] as Map<any, any>).delete(i.map);
                }
                else
                    this.resourcesGPU.delete(i.key, i.type);
            }
        }
        this._destroy();
        this._isDestroy = true;
    }
    abstract _destroy(): void;
    /**
     * 正常更新
     * 1、更新I_Update的自定义function
     * 2、调用updateSelf()更新自身私有属性
     * 
     * @param clock Clock 时钟
     * @param updateSelftFN 是否调用自身的updateSelf(),默认=true
     *         此参数可以方便子类重载时，决定调用的updateSelf()的时间顺序或是否调用updateSelft()
     * @returns 
     */
    update(clock: Clock, updateSelftFN: boolean = true, updateAtEndFN: boolean = true): boolean {
        // if (this.lastUpdaeTime === clock.now) //更新检查
        //     return false;
        if (this.inputValues && this.inputValues.update !== undefined && typeof this.inputValues.update === "function") {
            this.inputValues.update(this);
        }
        if (updateSelftFN) {
            this.updateSelf(clock);                         //更新自身
            this.lastUpdaeTime = clock.now;                     //更新最后一次更新时间
        }
        //在最后执行调用
        if (updateAtEndFN)
            if (this.inputValues && this.inputValues.updateAtEnd !== undefined && typeof this.inputValues.updateAtEnd === "function") {
                this.inputValues.updateAtEnd(this);
            }
        return true;
    }
    abstract updateSelf(clock: Clock): void;
}
////////////////////////////////////////////////////////////NodeSpace//////////////////////////////////////////////////////////////////////////////////////////
/**
 * 空间节点初始化参数interface
 * node space interface
 */
export interface IV_NodeSpace extends I_Update {
    position?: weVec3,
    scale?: weVec3,
    rotate?: weVec4,
    quaternion?: weVec4,
    matrix?: weMat4,
}
export abstract class NodeSpace extends RootGPU {
    /**当前mesh的local的矩阵，按需更新 */
    matrix: Mat4 = mat4.create(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,);
    /**当前entity在世界坐标（层级的到root)，可以动态更新 */
    matrixWorld: Mat4 = mat4.create(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,);
    worldPosition: Vec3 = vec3.create();

    //空间属性
    _position: Vec3 = vec3.create();
    set Position(pos: Vec3 | weVec3) {
        // this._position = pos;
        // return;
        if (isWeVec3(pos)) {
            vec3.copy(vec3.fromValues(...pos), this._position);
        }
        else {
            vec3.copy(pos, this._position);
        }
    }
    get Position(): Vec3 {
        return this._position;
    }

    _scale: Vec3 = vec3.create(1, 1, 1);
    set Scale(scale: Vec3 | weVec3) {
        // this._scale = scale;
        // return ;
        if (isWeVec3(scale)) {
            vec3.copy(vec3.fromValues(...scale), this._scale);
        }
        else {
            vec3.copy(scale, this._scale);
        }
    }
    get Scale(): Vec3 | undefined {
        return this._scale;
    }

    /**旋转：自身原点为中心( 不，考虑_position位置)
     */
    _rotate: weVec4 | undefined = undefined;

    set Rotate(rotate: weVec4) {
        this._rotate = rotate;
    }
    get Rotate(): weVec4 | undefined {
        return this._rotate;
    }
    /** 任意点的任意轴的罗德里格斯旋转(考虑_position位置)
     * 1、数组第一个元素为旋转点，第二个元素为旋转轴
     * 2、数组第三个元素为旋转角度
     * 3、数组第四个元素为是否在世界坐标下旋转
    */
    _rodriguesRotation: [Vec3, Vec3, number, boolean] | undefined = undefined;
    /** 任意点的任意轴的罗德里格斯旋转
     * 1、数组第一个元素为旋转点，第二个元素为旋转轴
     * 2、数组第三个元素为旋转角度
    */
    set RodriguesAnyPoint(rodriguesRotation: [Vec3, Vec3, number, boolean] | [weVec3, weVec3, number, boolean]) {
        if (isWeVec3(rodriguesRotation[0])) {
            this._rodriguesRotation = [vec3.fromValues(...rodriguesRotation[0]), vec3.fromValues(...rodriguesRotation[1]), rodriguesRotation[2], rodriguesRotation[3]];
        }
        else {
            this._rodriguesRotation = [vec3.create(), vec3.create(), 0, false];
            vec3.copy(rodriguesRotation[0], this._rodriguesRotation[0]);
            vec3.copy(rodriguesRotation[1], this._rodriguesRotation[1]);
            this._rodriguesRotation[2] = rodriguesRotation[2];
        }
    }
    get RodriguesAnyPoint(): [Vec3, Vec3, number, boolean] | undefined {
        return this._rodriguesRotation;
    }
    /**旋转：以point(0,0,0)为原点为中心，考虑_position位置 
     * 1、数组第一个元素为旋转轴+旋转角度
     * 2、数组第二个元素为是否在世界坐标下旋转
    */
    set RodriguesZeroPoint([rotate, angle, isWorldSpace]: [Vec3 | weVec3, number, boolean]) {
        if (isWeVec3(rotate)) {
            this.RodriguesAnyPoint = [[0, 0, 0] as weVec3, [...rotate], angle, isWorldSpace];
        }
        else {
            this.RodriguesAnyPoint = [vec3.create(), rotate, angle, isWorldSpace];
        }
    }
    rodriguesRotation(worldSpace: boolean) {

        if (this._rodriguesRotation == undefined) return;
        if (worldSpace !== this._rodriguesRotation[3]) {
            return;
        }
        let matOrigin = mat4.create();
        let matTraget = mat4.create();
        if (this._rodriguesRotation[3]) {
            mat4.copy(this.matrixWorld, matOrigin);
        }
        else {
            mat4.copy(this.matrix, matOrigin);
        }
        let zeroPoint = vec3.fromValues(this._rodriguesRotation[0][0], this._rodriguesRotation[0][1], this._rodriguesRotation[0][2]);
        let zeroMat = mat4.translation(zeroPoint);
        let zeroMatInv = mat4.invert(zeroMat);
        mat4.multiply(zeroMat, matOrigin, matTraget);//将零点旋转到原点

        let pos: Vec3 = mat4.getTranslation(matOrigin);
        // console.log(pos[0], pos[1], pos[2]);
        let posMat = mat4.translation(vec3.fromValues(-pos[0], -pos[1], -pos[2]));
        let posMatInv = mat4.invert(posMat);
        mat4.multiply(posMat, matTraget, matTraget);//将位置旋转到原点

        mat4.axisRotate(matTraget, this._rodriguesRotation[1], this._rodriguesRotation[2], matTraget);//旋转

        mat4.multiply(matTraget, posMatInv, matTraget);//将位置旋转回原位置
        mat4.multiply(matTraget, zeroMatInv, matTraget);//将零点旋转回原位置

        if (this._rodriguesRotation[3]) {
            mat4.copy(matTraget, this.matrixWorld);
        }
        else {
            mat4.copy(matTraget, this.matrix);
        }
    }

    _quaternion: Quat | undefined = undefined;
    set Quaternion(quaternion: Vec4 | weVec4) {
        if (isWeVec4(quaternion)) {
            this._quaternion = quat.fromValues(...quaternion);
        }
        else {
            vec4.copy(quaternion, this._quaternion);
        }
    }
    get Quaternion(): Vec4 | undefined {
        return this._quaternion;
    }

    _matrix: Mat4 | undefined;
    set Matrix(matrix: Mat4 | weMat4) {
        if (isWeMat4(matrix)) {
            this._matrix = mat4.create(...matrix);
        }
        else {
            this._matrix = mat4.create();
            mat4.copy(matrix, this._matrix);
        }
    }
    get Matrix(): Mat4 | undefined {
        return this._matrix;
    }
    constructor(input?: IV_NodeSpace) {
        super(input);
        if (input) {
            if (input.position) this.Position = input.position;
            if (input.scale) this.Scale = input.scale;
            if (input.rotate) this.Rotate = input.rotate;
            if (input.quaternion) this.Quaternion = input.quaternion;
            if (input.matrix) mat4.copy(input.matrix, this.matrix);
        }
    }
    /**scale */
    scale(vec: Vec3) {
        this._scale = vec;
        if (this._matrix)
            this.matrix = mat4.scale(this._matrix, vec);
        else
            this.matrix = mat4.scale(this.matrix, vec);
    }
    quaternion() {
        // 1. 四元数转4×4矩阵
        const rotationMatrix = mat4.fromQuat(this._quaternion!);
        //2 矩阵相乘
        this.matrix = mat4.multiply(this.matrix, rotationMatrix);
    }
    /** 绕任意轴旋转 */
    rotate = this.rotateAxis;
    rotateAxis(axis: Vec3, angle: number) {
        mat4.axisRotate(this.matrix as Mat4, axis, angle, this.matrix as Mat4);
    }
    /**绕X轴(1,0,0)旋转 */
    rotateX(angle: number) {
        this.rotateAxis(vec3.create(1, 0, 0), angle);
    }
    /**绕y轴(0,1,0)旋转 */
    rotateY(angle: number) {
        this.rotateAxis(vec3.create(0, 1, 0), angle);
    }
    /**绕z轴(0,0,1)旋转 */
    rotateZ(angle: number) {
        this.rotateAxis(vec3.create(0, 0, 1), angle);
    }
    /**
     * 在现有matrix（原有的position）上增加pos的xyz，
     * 将entity的矩阵应用POS的位置变换，是在原有矩阵上增加
     * @param pos :Vec3
     */
    translate(pos: Vec3) {
        mat4.translate(this.matrix as Mat4, pos, this.matrix);
    }

    /** 创建单位矩阵，矩阵的xyz(12,13,14)=pos
    * @param pos :Vec3
    */
    translation(pos: Vec3,) {
        this.matrix = mat4.translation(this.matrix, pos);
    }

    /**
     * 替换pos的位置（matrix的:12,13,14），其他的matrix数据不变，
     * 将entity的位置变为POS,等价wgpu-matrix的mat4的translation，是替换，不是增加
     * @param pos :Vec3
     */
    setTranslation(pos: Vec3,) {
        this.matrix = mat4.setTranslation(this.matrix, pos);
    }

    /**
     * 1、矩阵操作一般来说：
     *      CPU中：S*R*T(右乘)，行向量*列矩阵=行向量
     *      GPU中: T*R*S(左乘)，列矩阵*列向量=列向量
     * 
     * 2、更新矩阵的顺序是先进行线性变换，再进行位置变换。其实是没有影响，线性工作在3x3矩阵，位置变换在[12,13,14]，列优先。
     * 
     * 3、旋转部分，四元数优先，然后后轴旋转。
     *    A、在模型gltf中，旋转使用四元数。
     */
    updateMatrix(_m4?: Mat4, _opera: "copy" | "multiply" = "copy"): Mat4 {
        this.matrix = mat4.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,);
        if (_m4) {
            if (_opera === "copy")
                this.matrix = mat4.copy(_m4);
            else if (_opera === "multiply")
                this.matrix = mat4.multiply(this.matrix, _m4);
        }
        else if (this._matrix !== undefined) {
            mat4.copy(this._matrix, this.matrix);
        }

        if (this._scale[0] !== 1 || this._scale[1] !== 1 || this._scale[2] !== 1) {
            let abc = 1
        }
        if (this._scale)
            this.scale(this._scale);

        if (this._quaternion)
            this.quaternion();
        else if (this._rotate) {
            // this.rotateAxis(this._rotate.axis, this._rotate.angleInRadians);
            this.rotateAxis(vec3.fromValues(this._rotate[0], this._rotate[1], this._rotate[2]), this._rotate[3]);
        }
        if (this._position && (this._position[0] !== 0 || this._position[1] !== 0 || this._position[2] !== 0))
            // this.translate(this._position);
            this.setTranslation(this._position);
        //根据是否使用罗德里格斯旋转，以及在local还是world空间，来更新旋转矩阵
        this.rodriguesRotation(false);

        return this.matrix;
    }
    /**
     * 更新世界位置
     * 1、entity的worldPosition 是entity的position在世界坐标系下的位置
     * 2、如果没有提供世界矩阵，默认使用entity的matrixWorld
     * @param _matrixWorld 世界矩阵
     * @returns 世界位置
     */
    updateWorldPosition(_matrixWorld?: Mat4): Vec3 {
        if (_matrixWorld) {
            this.worldPosition = vec3.fromValues(_matrixWorld[12], _matrixWorld[13], _matrixWorld[14]);
        }
        else {
            this.worldPosition = vec3.fromValues(this.matrixWorld[12], this.matrixWorld[13], this.matrixWorld[14]);
        }
        return this.worldPosition;
    }
    /**
     * 更新世界矩阵，返回世界矩阵
     * @param _parentMatrixWorld 父节点的世界矩阵（可选项）
     * @returns 世界矩阵
     */
    abstract updateMatrixWorld(_parentMatrixWorld?: Mat4): Mat4
    /**
     * 正常更新
     * 1、更新空间属性
     * 
     * 2、调用super.update()更新
     * 
     * @param clock Clock 时钟
     * @param updateSelftFN 是否调用自身的updateSelf(),默认=true
     *         此参数可以方便子类重载时，决定调用的updateSelf()的时间顺序或是否调用updateSelft()
     * @returns 
     */
    update(clock: Clock, updateSelftFN: boolean = true, updateAtEndFN: boolean = true): boolean {
        super.update(clock, false, false);//更新I_Update，不更新updateSelf()
        this.updateMatrixWorld();//更新 world matrix
        this.updateWorldPosition(); //更新 world position
        //更新updateSelf()。只更新一次,在所有自身更新之后
        if (updateSelftFN) {
            this.updateSelf(clock);
            this.lastUpdaeTime = clock.now;                     //更新最后一次更新时间
        }
        //在最后执行调用
        if (updateAtEndFN)
            if (this.inputValues && this.inputValues.updateAtEnd !== undefined && typeof this.inputValues.updateAtEnd === "function") {
                this.inputValues.updateAtEnd(this);
            }
        return true;
    }
}

////////////////////////////////////////////////////////////
// some JSON
///////////////////////////////////////////////////////////

export interface NodeObjectJSON {
    type: string,
    name: string,
    id: number,
    // renderID: number,
    UUID: string,
    position: number[],
    scale: number[] | undefined,
    rotate: {
        axis: number[],
        angleInRadians: number,
    } | undefined,
    quaternion: weVec4 | undefined,
    enable: boolean,
    visible: boolean,
    matrix: number[],
    matrixWorld: number[],
    parent: number,
    children: number[],
}
/**
 * model 空间属性附加参数
 * 
 */
export interface IV_AttachSpaceAttributeToNodeModel {
    position?: weVec3,
    scale?: weVec3,
    rotate?: weVec4,
    quaternion?: weVec4,
    matrix?: weMat4,
}
//////////////////////////////////////////////////////////////NodeObject////////////////////////////////////////////////////////////////////////////////////////
export interface IV_Node extends IV_NodeSpace {
    entity?: BaseEntity,
    /** 实例化的节点对象 */
    // instanceNode?: NodeObject,

    /**todo 实例化的相机对象(目前将相机作为节点的属性：非子对象) */
    // camera?: BaseCamera,

    /**todo  实例化的光源对象(目前将光源作为节点的属性，非子对象) */
    // light?: BaseLight,

    /**todo 实例化的粒子对象(目前将粒子作为节点的子对象) */
    // particle?: BaseParticle,

    /**todo 实例化的动画对象(目前将动画作为节点的属性) */
    // animation?: BaseAnimation[],
}
/**
 * 节点对象
 * 1、导入导出需要实例化
 * 2、readyForGPU需要实例化
 * 3、_destroy需要实例化
 * 4、updateSelf需要实例化
 */
export abstract class NodeObject extends NodeSpace {
    constructor(input?: IV_Node) {
        super(input);
        if (input) {
            if (input.entity) this.Entity = input.entity;
            // if (input.particle) this.Particle = input.particle;
            // if (input.animation) this.Animation = input.animation;
        }
    }
    /** stageID*/
    stageID: number = 0;

    /**父节点 parent node     */
    _parent: NodeObject | undefined;
    get Parent(): NodeObject | undefined {
        return this._parent;
    }
    set Parent(value: NodeObject | undefined) {
        this._parent = value;
    }
    /**  子节点 child nodes     */
    _children: NodeObject[] = [];


    /** renderID，use for pickup generate by stage      */
    _renderID!: number;
    set renderID(id: number) {
        this._renderID = id;
    }
    get renderID() {
        return this._renderID;
    }



    /** 实体对象 entity object     */
    _entity: BaseEntity | undefined;
    get Entity(): BaseEntity | undefined {
        return this._entity;
    }
    set Entity(entity: BaseEntity) {
        this._entity = entity;
    }


    /** 粒子对象 particle object     */
    _particle: BaseParticle[] | undefined;
    get Particle(): BaseParticle[] | undefined {
        return this._particle;
    }
    // set Particle(particle: BaseParticle) {
    //     this._particle = particle;
    // }


    /** 动画对象 animation object     
     * 1、有数据，则存在动画。
     * 2、每个元素为一个动画对象。
    */
    _animation: BaseAnimation[] | undefined;
    get Animation(): BaseAnimation[] | undefined {
        return this._animation;
    }
    set Animation(animation: BaseAnimation[]) {
        this._animation = animation;
    }

    /** 动画组对象 animation group object     
     * 1、gltf等模型使用
    */
    _animationGroup: AnimationGroup[] | undefined;
    get AnimationGroup(): AnimationGroup[] | undefined {
        return this._animationGroup;
    }
    set AnimationGroup(animationGroup: AnimationGroup[]) {
        this._animationGroup = animationGroup;
    }

    /** 骨架动画数据  SkinAnimation object 
     * 目前只设计了一个蒙皮动画。同一节点上不存在多个蒙皮动画。
     */
    _skinAnimation: SkinAnimation | undefined;
    get SkinAnimation(): SkinAnimation | undefined {
        return this._skinAnimation;
    }
    set SkinAnimation(skinAnimation: SkinAnimation) {
        this._skinAnimation = skinAnimation;
    }

    /** 骨架皮肤数据  ArrayBuffer of  jointsMat 
    *  1、有数据，则存在骨骼动画。
    *  2、工作流
    *      A、获得matrixWorld，
    *      B、根据jointsMat，计算出每个joint的world matrix。
   */
    _jointsMat: ArrayBuffer | undefined;
    get JointsMat(): ArrayBuffer | undefined {
        return this._jointsMat;
    }
    set JointsMat(skeletonSkin: ArrayBuffer) {
        this._jointsMat = skeletonSkin;
    }


    /**  morphTarget 目标值数据  ArrayBuffer of  morphTargetMat 
     *  1、有数据，则存在morphTarget动画。
    */
    _morphTarget: ArrayBuffer | undefined;
    get MorphTarget(): ArrayBuffer | undefined {
        return this._morphTarget;
    }
    set MorphTarget(morphTarget: ArrayBuffer) {
        this._morphTarget = morphTarget;
    }


    /**
     * 权重动画 weight animation object
     * 1、有数据，则存在权重动画。权重动画存在于_animation[]中,这里是指针的概念。
     * 2、工作流
     *      update()，根据是否有权重动画，选择matrixWorld的更新方式。
     * 3、如果存在多个权重动画组，这个标志为当前使用的权重动画组。
     */
    _weightMixAnimation: WeightMixAnimation | undefined;
    get WeightMixAnimation(): WeightMixAnimation | undefined {
        return this._weightMixAnimation;
    }
    set WeightMixAnimation(weightMix: WeightMixAnimation) {
        this._weightMixAnimation = weightMix;
    }


    /**
     * 节点是否可见,如果不在root的树，则visible为false，但没有删除，还在资源池中
     * node visible
     */
    visible: boolean = true;
    set Visible(value: boolean) {
        if (value === this.visible) return;
        else {
            this.visible = value;
            // this.children.forEach((child) => {//不递归，只改变当前节点的visible
            //     child.Visible = value;
            // });
        }
    }
    get Visible(): boolean {
        return this.visible;
    }


    /**
     * 向上递归，判断是否可见
     * 1、通过parent.type 判断是否为root节点
     */
    getVisibleAndParents(): boolean {
        if (this.visible == false) {
            return false;
        }
        if (this.Parent == undefined) {
            return false;
        }
        else if (this.Parent.type == "root") {
            return true;
        }
        else {
            return this.Visible && this.Parent.getVisibleAndParents();
        }
    }

    enable: boolean = true;
    set Enable(value: boolean) {
        if (value === this.enable) return;
        else {
            this.enable = value;
            this.children.forEach((child) => {
                child.Enable = value;
            });
        }
    }
    get Enable(): boolean {
        return this.enable;
    }
    /**
     * 向上递归，判断是否可用性
     */
    getEnableAndParents(): boolean {
        if (this.Enable == false) {
            return false;
        }
        if (this.Parent == undefined) {
            return false;
        }
        else if (this.Parent.type == "root") {
            return true;
        }
        else {
            return this.Enable && this.Parent.getEnableAndParents();
        }
    }

    // /**是否为entity */
    // noEntity!: boolean;
    // /**是否为模型的子节点 */
    // belongModel?: BaseModel | undefined;



    /**
     * 三段式初始化的第二步：init()
     * 
     * @param scene 
     * @param parent 
     * @param renderID 
     * @returns 
     */
    async init(scene: Scene, parent?: NodeObject, renderID?: number): Promise<any> {
        super.init(scene);
        if (parent) {
            this.Parent = parent;
        }
        // //获取最新的ID
        // this.renderID = this.scene.root.getRenderID();//这里的renderID包括了所有的子类，enity，camera，light，material，texture，其中只有enity是实现使用的
        // return this.renderID + 1;
    }
    /**
     * 销毁节点
     * 1、递归销毁所有子节点
     * 2、需要entityManager中移除entity;entity的updateSelf()会更新instance 相关
     * 3、需要注销动画
     * 4、需要注销骨骼动画
     * 5、需要注销动画组
     * 6、需要注销粒子系统
     * 7、需要注销BVH和物理引擎中的相关数据
     */
    destroy(): void {
        //递归销毁所有子节点
        if (this.children.length > 0) {
            for (let child of this.children) {
                if (child instanceof NodeObject) {
                    child.destroy();
                }
            }
            this._children = [];
        }
        //从entityManager中移除entity
        this.detachEntity();

        //注销动画
        if (this.Animation) {
            this.Animation.forEach((animation) => {
                animation.destroy();
            });
            this.Animation = [];
        }
        //注销骨骼动画
        if (this._skinAnimation) {
            this._skinAnimation.destroy();
            this._skinAnimation = undefined;
        }
        //注销动画组
        if (this.AnimationGroup) {
            this.AnimationGroup.forEach((animationGroup) => {
                animationGroup.destroy();
            });
            this.AnimationGroup = [];
        }
        //注销粒子系统
        if (this.Particle) {
            this.Particle.forEach((particle) => {
                particle.destroy();
            });
            this._particle = undefined;
        }
        //注销BVH和物理引擎中的相关数据
        // if (this.BVH) {
        //     this.BVH.destroy();
        // }
        // if (this.PhysicsBody) {
        //     this.PhysicsBody.destroy();
        // }

        super.destroy();
    }

    get children() { return this._children; }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // add 
    /**
     * 附着entity到NodeObject上
     * 1. 如果NodeObject已经有entity，抛出错误
     * 2. 如果entity已经constructed,但没有init,则init entity
     * 3. 将entity添加到entityManager中
     * 
     * @param entity 
     */
    async attachEntity(entity: BaseEntity) {
        if (this.Entity) {
            console.warn("NodeObject already has an entity, remove it first");
        }
        else {
            this.Entity = entity;
            if (entity._state == E_lifeState.constructed) {//如果entity已经constructed,但没有init,则init entity
                await entity.init(this.scene);
            }
            this.scene.entityManager.add(entity, this);//将entity添加到entityManager中
        }
    }
    /** 从NodeObject上分离entity     */
    detachEntity() {
        if (this.Entity) {
            this.scene.entityManager.remove(this.Entity, this);//将entity从entityManager中移除
        }
    }

    /**
     * 添加子节点
     * 1. 如果是子节点，直接添加到children中
     *      A、camera
     *      B、light
     *      C、其他类型的NodeObject，直接添加到children中
     *          model，particle
     * 2、entity
     *      A. 如果是BaseEntity，通过新建参数，
     *          并将entity附着到新建Node Object上。         
     *      B. 如果是IV_Node，根据参数创建对应的Node Object；
     *          如果存在entity，并将entity附着到NodeObject上。
     *      C、将entity和node添加到entityManager中
     * 3、如果不存在entity，将node添加到children中
     * 
     * 4、如果是Model，根据modelAttachValue创建对应的Node Instance
     * 
     * @param child  NodeObject | BaseEntity | IV_Node 
     * @returns  Promise<NodeObject> 
     */
    async addChild(child: NodeObject | BaseEntity | IV_Node, modelAttachValue?: IV_NodeSpace): Promise<NodeObject> {
        let childNode: NodeObject;
        if (child instanceof NodeObject) {
            // child.parent = this;
            if (child.type == "Model" && child instanceof NodeObject) {
                await (child as BaseModel).init(this.scene, this);                                  //init
                childNode = await (child as BaseModel).initInstance(this, modelAttachValue);        //initInstance,返回NodeInstanceModel
            }
            else if (child instanceof NodeObject) {
                await child.init(this.scene, this);
                childNode = child;
            }
            else {
                throw new Error("child type not support");
            }
            if (child.type == "Camera") {
                this.scene.cameraManager.add(child as unknown as BaseCamera);
                childNode = child;
            }
            else if (child.type == "Light") {//这里不能使用 instanceof BaseLight，会遇到 “暂时性死区 Uncaught ReferenceError: Cannot access 'NodeOrigin' before initialization” 问题，应该是BaseLight的在NodeObject解析完成之前进行了初始化
                this.scene.lightsManager.add(child as BaseLight);
                this.scene.resourcesGPU.cleanSystemUniform();//shadowmap 数量会变化，清除system的map
                if ((child as BaseLight).Shadow)
                    this.scene.renderManager.RC[E_renderPassName.transparent][child.UUID] = [];
                childNode = child;
            }
            else if (child.type == "ParticleSystem") {
                // this.scene.particleManager.addParticleSystem(child as ParticleSystem);
                throw new Error("ParticleSystem 未实现");
            }
            // else if (child.type == "Model") {
            //     // this.scene.modelManager.addModel(child as Model);
            // }

        }
        //节点，根据参数创建
        else {
            let initValue: IV_Node;
            if (child instanceof RootGPU) {
                initValue = {
                    entity: child,
                };
            }
            else {
                initValue = child;
            }
            childNode = await this.initNodeObject(initValue);
        }
        this._children.push(childNode);
        return childNode;
    }
    add = this.addChild;

    async initNodeObject(value: IV_Node): Promise<NodeObject> {
        let childNode: NodeObject = new NodeInstance(value);//创建node object
        await childNode.init(this.scene, this);  //初始化node object
        childNode.Parent = this;    //设置parent
        if (value.entity) {//如果有entity
            if (value.entity._state == E_lifeState.constructed) {//如果entity已经constructed,但没有init,则init entity
                await value.entity.init(this.scene);
            }
            this.scene.entityManager.add(value.entity, childNode);//将entity添加到entityManager中
        }
        // if (value.animation) {
        //     throw new Error("animation 未实现");
        // }
        // if (value.particle) {
        //     throw new Error("particle 未实现");
        // }
        return childNode;
    }
    removeChild(child: NodeObject): NodeObject | false {
        let index = this._children.indexOf(child);
        if (index !== -1) {
            // this._children[index].removeChildren();//递归移除子节点
            child.Parent = undefined;
            this._children[index].visible = false;
            this._children.splice(index, 1);
            return child;
        }
        console.log("未找到对应的子节点", child);
        return false;

        ////20260106 camera 和  light 的删除有ECS附着，之后转移到ESC中
        // if (childRemoveResult) {
        //     if (child.type == "Camera") {
        //         this.scene.cameraManager.remove(child as unknown as BaseCamera);
        //         delete this.scene.renderManager.RC[E_renderPassName.forward][child.UUID];
        //     }
        //     else if (child.type == "Light") {
        //         this.scene.lightsManager.remove(child as BaseLight);
        //         this.scene.resourcesGPU.cleanSystemUniform();//shadowmap 数量会变化，清除system的map
        //         if (this.scene.renderManager.RC[E_renderPassName.shadowmapTransparent][child.UUID])
        //             delete this.scene.renderManager.RC[E_renderPassName.shadowmapTransparent][child.UUID];
        //         if (this.scene.renderManager.RC[E_renderPassName.shadowmapOpacity][child.UUID])
        //             delete this.scene.renderManager.RC[E_renderPassName.shadowmapOpacity][child.UUID];
        //     }
        //     else {
        //         console.log("未找到对应的ECS manager", child);
        //     }
        // }
        // return childRemoveResult;
    }
    remove = this.removeChild;
    /**
     * remove all children
     * 移除所有子节点
     */
    removeChildren() {
        this._children.forEach((child) => {
            child.removeChild(child);
        });
    }
    /**
     * 返回第一个具有id的object
     * @param id 子节点的id
     */
    getObjectIndexByID(id: number): number | boolean {
        for (let i in this.children) {
            if (this.children[i].ID == id) {
                return parseInt(i);
            }
        }
        return false;
    }
    /**
     * get child by UUID
     * @param id 
     * @returns 
     */
    getObjectIndexByUUID(id: string): number | boolean {
        for (let i in this.children) {
            if (this.children[i].UUID == id) {
                return parseInt(i);
            }
        }
        return false;
    }
    /**
     * get child by renderID
     * @param id 
     * @returns 
     */
    getObjectIndexByRenderID(id: number): number | boolean {
        for (let i in this.children) {
            if (this.children[i]._renderID == id) {
                return parseInt(i);
            }
        }
        return false;
    }
    /**
     * 返回第一个具有name的object
     * @param name 
     * @returns 
     */
    getObjectByName(name: string): NodeObject | boolean {
        for (let i of this.children) {
            if (i.Name == name) {
                return this;
            }
            else if (i instanceof NodeObject) {
                let scope = i.getObjectByName(name);
                if (typeof scope != "boolean") {
                    return scope;
                }
            }
        }
        return false;
    }




    /**
     * 更新
     * 1、判断是否需要更新（时间上）
     * 2、调用super.update()更新，
     *      A、NodeSpace：更新空间属性
     *      B、RootGPU：更新user call back，调用最终子类更新自身updateSelf()
     * 3、更新NodeObject的属性
     * 4、更新子节点
     * @param clock Clock 时钟
     * @param updateSelftFN 是否调用自身的updateSelf(),默认=true
     *         此参数可以方便子类重载时，决定调用的updateSelf()的时间顺序或是否调用updateSelft()
     * @returns 
     */
    update(clock: Clock, updateSelftFN: boolean = true, updateAtEndFN: boolean = true): boolean {
        // if (this.lastUpdaeTime === clock.now) //更新检查
        //     return false;
        super.update(clock, false, false);                             //不更新updateSelf(),不更新updateAtEnd();都只执行一次
        this.updateSelfAttribute(clock);
        //更新updateSelf()。只更新一次,在所有自身更新之后
        if (updateSelftFN) {
            this.updateSelf(clock);
            this.lastUpdaeTime = clock.now;                     //更新最后一次更新时间
        }
        if (this.children.length > 0)                           //更新子节点
            for (let i of this.children)
                i.update(clock);

        //根据是否使用罗德里格斯旋转，以及在local还是world空间，来更新旋转矩阵
        this.rodriguesRotation(true);

        //测试：更新inputValues，比如更改matrixWorld,在更新完成位置和matrix之后
        // if (this.inputValues && this.inputValues.update !== undefined && typeof this.inputValues.update === "function") {
        //     this.inputValues.update(this);
        // }
        //在最后执行调用
        if (updateAtEndFN)
            if (this.inputValues && this.inputValues.updateAtEnd !== undefined && typeof this.inputValues.updateAtEnd === "function") {
                this.inputValues.updateAtEnd(this);
            }

        return true;

    }
    /**
     * 更新自己的属性
     */
    updateSelfAttribute(clock: Clock) {
        //更新包围盒
        if (this.Entity && this.Entity.boundingBox) {
            let box = this.Entity.boundingBox;
            const min = vec3.transformMat4(box.min, this.matrixWorld);
            const max = vec3.transformMat4(box.max, this.matrixWorld);
            this.scene.Box3s.push({
                min: [min[0], min[1], min[2]],
                max: [max[0], max[1], max[2]]
            });//更新scene的包围盒数组
        }
    }
    /**
     * 自下而上的更新，一条线而上，不更新兄弟节点
     * @param clock 
     * @returns 
     */
    updateParentOnly(clock: Clock) {
        if (this.Parent !== undefined && this.Parent.Name == "root") {
            this.Parent.updateParentOnly(clock);//递归
        }
        if (this.lastUpdaeTime !== clock.now) {//更新自己
            this.updateSelfAttribute(clock);
            this.updateSelf(clock);
        }
    }



    /** 
     * 更新世界矩阵，
     *          递归乘以父节点的矩阵
     */
    updateMatrixWorld(_parentMatrixWorld?: Mat4): Mat4 {
        if (this.Parent !== undefined && this.Parent.type !== "root") {
            this.matrixWorld = mat4.multiply(this.Parent.matrixWorld, this.updateMatrix());
        }
        else {
            this.matrixWorld = this.updateMatrix();
        }
        // console.log("root:", this.matrixWorld);
        return this.matrixWorld;
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 输出JSON格式
     * 需要每个继承类覆盖属性实现
     */
    abstract saveJSON(): any;
    /**
     * 加载JSON格式数据
     * @param json 输入的JSON格式数据
     */
    abstract loadJSON(json: any): void;
    // getBaseJSON(): NodeObjectJSON {
    //     let outputJSON: NodeObjectJSON = {
    //         type: this.type,
    //         name: this._name,
    //         id: this._id,
    //         // renderID: this._renderID,
    //         UUID: this.UUID,
    //         position: [],// this._position,
    //         scale: [],// this._scale,
    //         rotate: {
    //             axis: [],
    //             angleInRadians: 0,
    //         },
    //         quaternion: undefined,
    //         enable: this.enable,
    //         visible: this.visible,
    //         matrix: [],// this.matrix,
    //         matrixWorld: [],//this.matrixWorld,
    //         parent: 0,
    //         children: []
    //     };
    //     for (let i of this._position)
    //         outputJSON.position.push(i);

    //     if (this._quaternion) {
    //         for (let i of this._quaternion)
    //             outputJSON.quaternion!.push(i);
    //     }
    //     else {
    //         outputJSON.quaternion = undefined;
    //     }
    //     if (this._scale) {
    //         for (let i of this._scale)
    //             outputJSON.scale.push(i);
    //     }
    //     else {
    //         outputJSON.scale = undefined;
    //     }
    //     if (this._rotate) {
    //         for (let i of this._rotate.axis)
    //             outputJSON.rotate!.axis.push(i);
    //         outputJSON.rotate!.angleInRadians = this._rotate.angleInRadians;
    //     }
    //     else {
    //         outputJSON.rotate = undefined;
    //     }

    //     if (this.matrix)
    //         for (let i of this.matrix)
    //             outputJSON.matrix.push(i);

    //     if (this.matrixWorld)
    //         for (let i of this.matrixWorld)
    //             outputJSON.matrixWorld.push(i);
    //     if (this.parent)
    //         outputJSON.parent = this.parent.ID;
    //     for (let i of this._children) {
    //         outputJSON.children.push(i.ID);
    //     }

    //     return outputJSON
    // }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NodeInstance and NodeInstanceModel
/**
 * 节点实例
 * 用于实例化节点对象
 */
export class NodeInstance extends NodeObject {
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    async readyForGPU(): Promise<any> {
        // throw new Error("Method not implemented.");

    }
    _destroy(): void {
        // throw new Error("Method not implemented.");
    }
    updateSelf(clock: Clock): void {
        // throw new Error("Method not implemented.");
    }
}
/**
 * 节点实例
 * 用于实例化节点对象
 */
export class NodeInstanceModel extends NodeObject {
    /**
     *  模型来源 : 指向原始模型
     * 1、animation的数据来源使用modelOrigin
    */
    _modelOrigin!: BaseModel;
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    async readyForGPU(): Promise<any> {
        // throw new Error("Method not implemented.");

    }
    _destroy(): void {
        // throw new Error("Method not implemented.");
    }
    updateSelf(clock: Clock): void {
        // throw new Error("Method not implemented.");
    }
}

/**
 * 创建一个新的空节点实例
 * @param scene 场景
 * @param parent 父节点
 * @returns 新的节点实例
 */
export async function newNode(parent: NodeInstance) {
    let scene: Scene = parent.scene;
    let node = new NodeInstance();
    await node.init(scene, parent);
    return node;
}