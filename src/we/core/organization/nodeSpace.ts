////////////////////////////////////////////////////////////NodeSpace//////////////////////////////////////////////////////////////////////////////////////////
/**
 * 空间节点初始化参数interface
 * node space interface
 */

import { Mat4, mat4, Vec3, vec3, Quat, Vec4, quat, vec4 } from "wgpu-matrix";
import { I_Update, weMat4, weVec3, weVec4 } from "../base/coreDefine";
import { isWeVec3, isWeVec4, isWeMat4 } from "../base/coreFunction";
import { Clock } from "../scene/clock";
import { RootGPU } from "./root";


export interface IV_NodeSpace extends I_Update {
    position?: weVec3,
    scale?: weVec3,
    rotate?: weVec4,
    quaternion?: weVec4,
    matrix?: weMat4,
}
export abstract class NodeSpace extends RootGPU {
    needUpdateMatrix: boolean = true;
    /**当前mesh的local的矩阵，按需更新 */
    matrix: Mat4 = mat4.create(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,);
    /**当前entity在世界坐标（层级的到root)，可以动态更新 */
    matrixWorld: Mat4 = mat4.create(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,);
    worldPosition: Vec3 = vec3.create();

    //空间属性
    _position: Vec3 = vec3.create();
    _positionOld: Vec3 | undefined;
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

    _scaleOld: Vec3 | undefined;
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
    _rotateOld: weVec4 | undefined;
    _rotate: weVec4 | undefined;

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
    _quaternionOld: Quat | undefined;
    _quaternion: Quat | undefined;
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
        /**
         * 一、判断needUpdateMatrix是否为true
         * 
         * 二、判断是否需要更新矩阵
         * 1、判断parent 的matrixWorld是否有变化
         * 2、判断position，scale，rotate|quaternion是否有变化
         * 
         * 
         * 三、更新矩阵
         */
        //一、判断needUpdateMatrix是否为true
        if (!this.needUpdateMatrix) {
            return this.matrix;
        }
        //二、判断是否需要更新矩阵
        let flagScale = false;
        let flagPosition = false;
        let flagQuaternion = false;
        let flagParentMatrixWorld = false;
        let flagRotate = false;

        if (this._scale[0] == 1 || this._scale[1] == 1 || this._scale[2] !== 1) {
            let abc = 1
        }
        //三、更新矩阵
        if (this.Name === "0") {
            let abc = 1;
        }
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
        if (updateSelftFN && this.needUpdateSelf) {
            this.updateSelf(clock);
            this.lastUpdaeTime = clock.now;                     //更新最后一次更新时间
        }
        //在最后执行调用
        if (updateAtEndFN)
            // if (this.inputValues && this.inputValues.updateAtEnd !== undefined && typeof this.inputValues.updateAtEnd === "function") {
            if (this.needUpdateuserDefineAtEnd) {
                this.inputValues.updateAtEnd!(this);
            }
        return true;
    }
}