import { mat4, quat, Quat, vec3, vec4, Vec4, type Mat4, type Vec3 } from "wgpu-matrix";
import type { Rotation } from "../math/baseDefine";
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
import { BaseModel } from "../model/BaseModel";


export interface I_UUID {
    // update(clock: Clock): unknown;
    UUID: string,
    _isDestroy: boolean,

}

export abstract class RootGPU implements I_UUID {

    device!: GPUDevice;

    scene!: Scene;
    /**
     * 节点名称
     * node name
     */
    _name: string;

    /**
     * 节点ID
     * node ID
     */

    _id!: number;



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
    animation: BaseAnimation[] | undefined;
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

    // update(clock: Clock, updateSelftFN: boolean = true): boolean {
    //     if (this._readyForGPU === false)
    //         return false;
    //     else
    //         return super.update(clock, updateSelftFN);
    // }
    /**
     * 正常更新，从上到下 
     * @param clock Clock 时钟
     * @param updateSelftFN 是否调用自身的updateSelf(),默认=true
     *         此参数可以方便子类重载时，决定调用的updateSelf()的时间顺序或是否调用updateSelft()
     * @returns 
     */
    update(clock: Clock, updateSelftFN: boolean = true): boolean {
        if (this.lastUpdaeTime === clock.now) //更新检查
            return false;
        // this.updateSelfAttribute(clock);                //更新自身的属性
        // if (this.children.length > 0)                   //更新子节点
        //     for (let i of this.children)
        //         i.update(clock);
        if (updateSelftFN)
            this.updateSelf(clock);                         //更新自身
        return true;
    }
    abstract updateSelf(clock: Clock): void;


    set ID(id) { this._id = id; }
    get ID(): number { return this._id; }
}



export interface RootOriginJSON {
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

export abstract class RootOrigin extends RootGPU {
    /**父节点 parent node     */
    _parent: RootOrigin | undefined;
    /**  子节点 child nodes     */
    _children: RootOrigin[] = [];
    /**
     * renderID，use for pickup
     * generate by stage 
     */
    _renderID!: number;

    /** stageID*/
    stageID: number = 0;

    /** uv动画使用 */
    _uv: weVec2 = [0, 0];

    //空间属性
    _position: Vec3 = vec3.create();
    _scale: Vec3 = vec3.create(1, 1, 1);
    _rotate: Rotation | undefined = undefined;
    _quaternion: Quat | undefined = undefined;
    _matrix: Mat4 | undefined;
    /**当前mesh的local的矩阵，按需更新 */
    matrix: Mat4 = mat4.create(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,);
    /**当前entity在世界坐标（层级的到root)，可以动态更新 */
    matrixWorld: Mat4 = mat4.create(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,);
    worldPosition: Vec3 = vec3.create();

    /**
     * 节点是否可见,如果不在root的树，则visible为false，但没有删除，还在资源池中
     * node visible
     */
    visible: boolean = true;
    enable: boolean = true;
    /**是否为entity */
    noEntity!: boolean;
    /**是否为模型的子节点 */
    belongModel?: BaseModel | undefined;

    constructor(input?: I_Update) {
        super(input);
        if (input?.belongModel) this.belongModel = input.belongModel;
    }

    /**
     * 三段式初始化的第二步：init()
     * 
     * @param scene 
     * @param parent 
     * @param renderID 
     * @returns 
     */
    async init(scene: Scene, parent?: RootOrigin, renderID?: number): Promise<number> {
        super.init(scene);
        if (parent) {
            this.parent = parent;
        }
        //获取最新的ID
        this.renderID = this.scene.root.getRenderID();//这里的renderID包括了所有的子类，enity，camera，light，material，texture，其中只有enity是实现使用的
        return this.renderID + 1;
    }
    destroy(): void {
        if (this.children.length > 0) {
            for (let child of this.children) {
                if (child instanceof RootOrigin) {
                    child.destroy();
                }
            }
        }
        super.destroy();
    }

    get children() { return this._children; }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // add 
    add = this.addChild;
    async addChild(child: RootOrigin): Promise<number> {
        await child.init(this.scene, this);
        child.parent = this;
        this._children.push(child);

        if (this.parent instanceof RootOrigin && child instanceof RootOrigin) {
            await child.setRootENV(this.scene);
        }
        if (child.type == "Camera") {
            this.scene.cameraManager.add(child as BaseCamera);

        }
        else if (child.type == "Light") {
            this.scene.lightsManager.add(child as BaseLight);
            this.scene.resourcesGPU.cleanSystemUniform();//shadowmap 数量会变化，清除system的map
            if ((child as BaseLight).Shadow)
                this.scene.renderManager.RC[E_renderPassName.transparent][child.UUID] = [];
            // this.scene.renderManager.initRenderCommandForLight(child.UUID);//改到enityManager的update中

        }
        // else if (child.type == "ParticleSystem") {
        //     this.scene.particleManager.addParticleSystem(child as ParticleSystem);
        // }
        else if (child.type == "Model") {
            // this.scene.modelManager.addModel(child as Model);
        }
        else if (child.type == "entity") {
            // if (child.belongModel) {
            //     (child.inputValues.belongModel as BaseModel).entities.push(child as BaseEntity);
            // }
            // else {
            this.scene.entityManager.add(child as BaseEntity);
            // }
        }
        // else if (child.type == "material") {
        //     // if (child.belongModel) {
        //     //     (child.inputValues.belongModel as BaseModel).materials.push(child as BaseMaterial);
        //     // }
        //     // else {
        //     this.scene.materialManager.add(child as BaseMaterial);
        //     // }
        // }
        else {
            console.log("未找到对应的ECS manager", child);
        }
        return this.renderID + 1;
    }
    remove = this.removeChild;
    removeChild(child: RootOrigin): RootOrigin | false {
        let childRemoveResult = this.removeChild(child);
        if (childRemoveResult) {
            if (child.type == "Camera") {
                this.scene.cameraManager.remove(child as BaseCamera);
                delete this.scene.renderManager.RC[E_renderPassName.forward][child.UUID];
            }
            else if (child.type == "Light") {
                this.scene.lightsManager.remove(child as BaseLight);
                this.scene.resourcesGPU.cleanSystemUniform();//shadowmap 数量会变化，清除system的map

                if (this.scene.renderManager.RC[E_renderPassName.shadowmapTransparent][child.UUID])
                    delete this.scene.renderManager.RC[E_renderPassName.shadowmapTransparent][child.UUID];
                if (this.scene.renderManager.RC[E_renderPassName.shadowmapOpacity][child.UUID])
                    delete this.scene.renderManager.RC[E_renderPassName.shadowmapOpacity][child.UUID];
            }
            else if (child.type == "entity") {
                this.scene.entityManager.remove(child as BaseEntity);
            }
            // else if (child.type == "material") {
            //     this.scene.materialManager.remove(child as BaseMaterial);
            // }
            else {
                console.log("未找到对应的ECS manager", child);
            }
        }
        return childRemoveResult;
    }

    /**
     * add child 
     * 添加子节点
     * @param child 
     */
    // async addChild(child: RootOrigin): Promise<number> {
    //     child.parent = this;
    //     this._children.push(child);
    //     return child._renderID;
    // }

    /**
     * remove child
     * 移除子节点
     * @param child 
     * @returns RootOrigin | false
     *           移除成功返回子节点，失败返回false
     *           success return child, fail return false
     */
    // removeChild(child: RootOrigin): RootOrigin | false {
    //     let index = this._children.indexOf(child);

    //     if (index !== -1) {
    //         this._children[index].removeChildren();
    //         this._children[index].visible = false;
    //         let child = this._children.splice(index, 1);
    //         return child[0];
    //     }
    //     return false;
    // }
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
    getObjectByName(name: string): RootOrigin | boolean {
        for (let i of this.children) {
            if (i.Name == name) {
                return this;
            }
            else if (i instanceof RootOrigin) {
                let scope = i.getObjectByName(name);
                if (typeof scope != "boolean") {
                    return scope;
                }
            }
        }
        return false;
    }
    set renderID(id: number) {
        this._renderID = id;
    }
    get renderID() {
        return this._renderID;
    }
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
    set Visible(value: boolean) {
        if (value === this.visible) return;
        else {
            this.visible = value;
            this.children.forEach((child) => {
                child.Visible = value;
            });
        }
    }
    get Visible(): boolean {
        return this.visible;
    }

    get parent(): RootOrigin | undefined {
        return this._parent;
    }
    set parent(value: RootOrigin) {
        this._parent = value;
    }



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

    set Rotate(rotate: Rotation) {
        this._rotate = rotate;
    }
    get Rotate(): Rotation | undefined {
        return this._rotate;
    }
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

    get Name() { return this._name }
    set Name(value: string) {
        this._name = value;
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
        ////这里注销到的是因为，for操作的是instance的每个个体
        // for (let i = 0; i < this.numInstances; i++) {
        //     this.matrix[i] = mat4.axisRotate(this.matrix[i], axis, angle, this.matrix[i]);
        // }
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

        if (this._scale)
            this.scale(this._scale);

        if (this._quaternion)
            this.quaternion();
        else if (this._rotate) {
            this.rotateAxis(this._rotate.axis, this._rotate.angleInRadians);
        }
        if (this._position && (this._position[0] !== 0 || this._position[1] !== 0 || this._position[2] !== 0))
            // this.translate(this._position);
            this.setTranslation(this._position);

        return this.matrix;
    }

    /** 
     * 更新世界矩阵，
     *          递归乘以父节点的矩阵
     */
    updateMatrixWorld(): void {
        if (this.parent !== undefined) {
            this.matrixWorld = mat4.multiply(this.parent.matrixWorld, this.updateMatrix());
        }
        else {
            this.matrixWorld = this.updateMatrix();
        }
    }
    updateWorldPosition() {
        this.worldPosition = vec3.fromValues(this.matrixWorld[12], this.matrixWorld[13], this.matrixWorld[14]);
    }

    /**
     * 正常更新，从上到下 
     * @param clock Clock 时钟
     * @param updateSelftFN 是否调用自身的updateSelf(),默认=true
     *         此参数可以方便子类重载时，决定调用的updateSelf()的时间顺序或是否调用updateSelft()
     * @returns 
     */
    update(clock: Clock, updateSelftFN: boolean = true): boolean {
        if (this.lastUpdaeTime === clock.now) //更新检查
            return false;
        this.updateSelfAttribute(clock);                //更新自身的属性
        if (this.children.length > 0)                   //更新子节点
            for (let i of this.children)
                i.update(clock);
        if (updateSelftFN)
            this.updateSelf(clock);                         //更新自身
        return true;
    }
    /**
     * 更新自己的属性，并更新lastUpdateTime
     */
    updateSelfAttribute(clock: Clock) {
        if (this.lastUpdaeTime !== clock.now) {
            if (this.inputValues)
                if (this.inputValues.update)
                    this.inputValues.update(this);
            this.updateMatrixWorld();//更新 world matrix
            this.updateWorldPosition(); //更新 world position
            this.lastUpdaeTime = clock.now;
            // console.log(this.Position)
        }
    }
    /**
     * 自下而上的更新，一条线而上，不更新兄弟节点
     * @param clock 
     * @returns 
     */
    updateParentOnly(clock: Clock) {
        if (this.parent) {
            this.parent.updateParentOnly(clock);//递归
        }
        if (this.lastUpdaeTime !== clock.now) {//更新自己
            this.updateSelfAttribute(clock);
            this.updateSelf(clock);
        }
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
    getBaseJSON(): RootOriginJSON {
        let outputJSON: RootOriginJSON = {
            type: this.type,
            name: this._name,
            id: this._id,
            // renderID: this._renderID,
            UUID: this.UUID,
            position: [],// this._position,
            scale: [],// this._scale,
            rotate: {
                axis: [],
                angleInRadians: 0,
            },
            quaternion: undefined,
            enable: this.enable,
            visible: this.visible,
            matrix: [],// this.matrix,
            matrixWorld: [],//this.matrixWorld,
            parent: 0,
            children: []
        };
        for (let i of this._position)
            outputJSON.position.push(i);

        if (this._quaternion) {
            for (let i of this._quaternion)
                outputJSON.quaternion!.push(i);
        }
        else {
            outputJSON.quaternion = undefined;
        }
        if (this._scale) {
            for (let i of this._scale)
                outputJSON.scale.push(i);
        }
        else {
            outputJSON.scale = undefined;
        }
        if (this._rotate) {
            for (let i of this._rotate.axis)
                outputJSON.rotate!.axis.push(i);
            outputJSON.rotate!.angleInRadians = this._rotate.angleInRadians;
        }
        else {
            outputJSON.rotate = undefined;
        }

        if (this.matrix)
            for (let i of this.matrix)
                outputJSON.matrix.push(i);

        if (this.matrixWorld)
            for (let i of this.matrixWorld)
                outputJSON.matrixWorld.push(i);
        if (this.parent)
            outputJSON.parent = this.parent.ID;
        for (let i of this._children) {
            outputJSON.children.push(i.ID);
        }

        return outputJSON
    }
}



