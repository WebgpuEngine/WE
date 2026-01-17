import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';
import { IV_NodeSpace, NodeObject, } from '../organization/root';
import { CamreaControl, optionCamreaControl } from '../control/cameracControl';
import { I_Update, weVec3, weVec4 } from '../base/coreDefine';
import { cameracCntrolType } from '../control/base';
import { ArcballCameraControl } from '../control/arcballCameraControl';
import { WASDCameraControl } from '../control/wasdCameraControl';
import { Clock } from '../scene/clock';
import { boundingBox } from '../math/Box';
import { boundingSphere } from '../math/sphere';
import { CameraManager } from './cameraManager';
import { I_viewport } from '../command/base';
import { isWeVec3 } from '../base/coreFunction';



/**
 * 投影矩阵的参数(base)
 */
export interface projectionOptions extends IV_NodeSpace {
  /** 向上的方向，默认是(0,1,0) */
  upDirection?: Vec3,

  /** 近平面*/
  near: number,

  /** 远平面 */
  far: number,
  // left?:number,
  // right?:number,
  // top?:number,
  // bottom?:number,

  // name?: string,//从I_Update继承

  /** 相机位置 
   * 1、局部坐标，这里是local position
   * 2、shader使用的是全局坐标
   *  A、如果camera在root，则全局坐标与局部坐标相同
   *  B、如果camera不在root，则全局坐标是局部坐标经过world Matrix变换后的坐标
  */
  position: weVec3,
  /** 相机目标点，默认是(0,0,0) ，默认是世界坐标。
   * 1、初始目标点默认是(0,0,0)，并且是由控制器来操作方向;即如果由控制器，lookAt是控制器的“初始目标点”；
   * 2、如果没有控制器，则使用lookAt为相机的目标点，即由位置与目标点确定相机的方向；
   *    A、lookAt是可以动态改变的，即可以在运行时改变lookAt的坐标；产生跟随效果；
   *    B、lookAt的坐标可以是全局坐标，也可以是局部坐标，跟随目标模式视场景而定；
   * 3、这里的坐标是全局坐标。可以通过isLookAtGlobal判断是否是全局坐标；
  */
  lookAt?: weVec3,
  /**
   * 是否是全局坐标，默认是true
   * todo:20251011,未验证，在updateSelf中使用
   */
  isLookAtGlobal?: boolean,
  viewport?: I_viewport;
  backGroundColor?: weVec4,
  premultipliedAlpha?: boolean,
  /**
   * 附加的控制器，与contrlType互斥 
   * 注：
   *   camrea有两种控制器初始化模式，
   *   1、设置控制器类型，即controlType；这里的类型是WE3D内部定义的。
   *   2、设置控制器，即control；这里的控制器可以是用户自定义的。
   */
  control?: CamreaControl,
  /**附加的控制器类型，自动创建，与contrl互斥 */
  controlType?: cameracCntrolType,
  /**
   * 相机尺寸的大小，若有多个viewport，可以优化性能
   * 1、默认与场景大小相同
   * 2、可以手动设置大小
   */
  size?: {
    width: number,
    height: number,
  }
}
// //todo
// export interface cameraRayValues {
//   direction: Vec3,
//   left: Vec3,
//   right: Vec3,
//   up: Vec3,
//   down: Vec3,
// }

/***
 * 摄像机抽象类
 */
export abstract class BaseCamera extends NodeObject {
  /** 初始化参数  */
  declare inpuValues: projectionOptions;
  manager!: CameraManager;
  ///////////////////////////////////////////////////////////////////
  //空间属性
  /**
   * todo:20251011，需要一系列验证;另外，最终输出的时候也需要考虑尺寸，尤其是copy的情况
   * 
   * 相机管理器的大小
   * 1、默认与场景大小相同
   * 2、可以手动设置大小
   */
  size: {
    width: number,
    height: number,
  } | undefined;
  boundingBox!: boundingBox;//initDCC中赋值
  boundingSphere!: boundingSphere;
  aspect!: number;
  // /**
  //  * 默认的上方向
  //  */
  // _upDirection: Vec3 = new Float32Array([0, 1, 0]);

  // /**   * 单位阵   */
  // matrix_ = new Float32Array([
  //   1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  // ]);
  /** view matrix */
  viewMatrix = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);

  /** model matrix  */
  modelMatrix = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);;
  /** projection Matrix  */
  projectionMatrix!: Mat4;

  /**///////////////////////////////////////////////////////// 第一行,X轴///////////////////////////////////////////// */
  right_ = new Float32Array(this.viewMatrix.buffer, 4 * 0, 4);
  get right() { return this.right_; } // Returns column vector 0 of the camera matrix
  set right(vec: Vec3) { vec3.copy(vec, this.right_); }// Assigns `vec` to the first 3 elements of column vector 0 of the camera matrix
  /**///////////////////////////////////////////////////////// 第二行,Y轴///////////////////////////////////////////// */
  up_ = new Float32Array(this.viewMatrix.buffer, 4 * 4, 4);
  get up() { return this.up_; }  // Returns column vector 1 of the camera matrix
  set up(vec: Vec3) { vec3.copy(vec, this.up_); }// Assigns `vec` to the first 3 elements of column vector 1 of the camera matrix
  /**///////////////////////////////////////////////////////// 第三行,Z轴///////////////////////////////////////////// */
  back_ = new Float32Array(this.viewMatrix.buffer, 4 * 8, 4);
  get back() { return this.back_; }  // Returns column vector 2 of the camera matrix
  set back(vec: Vec3) { vec3.copy(vec, this.back_); }  // Assigns `vec` to the first 3 elements of column vector 2 of the camera matrix
  /**///////////////////////////////////////////////////////// 第四行,位置;modelMatrix 第四行,位置///////////////////////////////////////////// */
  position_ = new Float32Array(this.modelMatrix.buffer, 4 * 12, 4); /**modelMatrix 第四行,位置 */
  get positionOfModelMatrix() { return this.position_; }
  set positionOfModelMatrix(vec: Vec3) { vec3.copy(vec, this.position_); } // Assigns `vec` to the first 3 elements of column vector 3 of the camera matrix
  /**///////////////////////////////////////////////////////// lookAt ///////////////////////////////////////////// */
  lookAt: Vec3 = vec3.create();
  set LookAt(value: Vec3 | weVec3) {
    if (isWeVec3(value)) {
      this.LookAt = vec3.fromValues(...value);
    }
    else {
      vec3.copy(this.lookAt, value);
    }
  }
  get LookAt() { return this.lookAt; }
  /** 上方向 */
  _upDirection = vec3.create(0, 1, 0);
  get UpDirection() { return this._upDirection; }  // Returns column vector 1 of the camera matrix
  set UpDirection(vec: Vec3) { vec3.copy(vec, this._upDirection); }// Assigns `vec` to the first 3 elements of column vector 1 of the camera matrix

  isLookAtGlobal: boolean = true;

  /** MVP的Mat4的数组，[model,view,projection]  */
  MVP: Mat4[] = [];
  /**归一化的方向 
   * lookAt 的 vector
  */
  direction!: Vec4;

  name!: string;

  _control!: CamreaControl;
  viewport!: I_viewport;


  /** 背景颜色 
   * 无，则使用场景的背景色
  */
  backGroundColor!: [number, number, number, number];
  /**单独设置背景色的预乘，
   * 初始化参数中：
   * 1、无|false：使用系统的背景色和预乘
   * 2、true；则需要设置背景颜色
   */
  premultipliedAlpha: boolean = false;

  /**
   * shader 中的systemMVP的arraybuffer
   * struct ST_SystemMVP {   
   *   model: mat4x4f,
   *   view: mat4x4f,
   *   projection: mat4x4f,
   *   cameraPosition: vec3f,
   *   reversedZ: u32,
   *   };
   */
  bufferOf_ST_SystemMVP: Float32Array = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,//cameraPosition+reversedZ
  ]);
  /**
   * GPUBuffer :系统的uniform buffer，
   * 1、MVP
   * 2、cameraPosition
   * 3、reversedZ
   */
  systemUniformBuffersOfGPU!: GPUBuffer;

  /**
   * 4*4=matrix
   * *4=byte
   * *n=行数
   */
  uniformBufferSize = 4 * 4 * 4 * 4;

  constructor(option: projectionOptions) {
    super(option);
    this.type = 'Camera';
    this.inpuValues = option;
    if (option.control) this._control = option.control;
    if (typeof option.name != 'undefined') this.name = option.name;
    ///////////////////////////////////////////////////////////////////
    //附属属性
    if (option.size) this.size = option.size;
    if (option.viewport) this.viewport = option.viewport;
    if (option.premultipliedAlpha) this.premultipliedAlpha = option.premultipliedAlpha;
    ///////////////////////////////////////////////////////////////////
    //空间属性
    // if (option.upDirection) vec3.copy(option.upDirection, this.UpDirection);//20260116,更新单独的上方向，不再使用this.up做为上方向
    if (option.upDirection) vec3.copy(option.upDirection, this.up);//参见：setViewMatrixByPosition（）
    //modelMatrix 第四行,位置
    if (option.position) {
      this.positionOfModelMatrix = vec3.fromValues(option.position[0], option.position[1], option.position[2]);
      // this.Position = vec3.fromValues(option.position[0], option.position[1], option.position[2]);
    }
    if (option.lookAt) {
      this.back = vec3.normalize(vec3.sub(option.position, option.lookAt));
      if (this.back[0] == 0 && this.back[2] == 0 && this.back[1] == -1) {
        vec3.copy(vec3.create(1, 0, 0), this.right);
        vec3.copy(vec3.create(0, 0, 1), this.up);
      }
      else if (this.back[0] == 0 && this.back[2] == 0 && this.back[1] == 1) {
        vec3.copy(vec3.create(1, 0, 0), this.right);
        vec3.copy(vec3.create(0, 0, -1), this.up);
      }
      else {//20260116,更新lookAt后，需要重新计算right和up
        this.setViewMatrixByPosition(this.back)
      }
      this.lookAt = vec3.fromValues(option.lookAt[0], option.lookAt[1], option.lookAt[2]);
    }
    else {
      this.lookAt = vec3.create(0, 0, 0);
    }
    if (option.isLookAtGlobal != undefined) {
      this.isLookAtGlobal = option.isLookAtGlobal;
    }
  }
  async readyForGPU(): Promise<any> {
    this.aspect = this.scene.aspect;
    this.updateProjectionMatrix();
    this.updateByPositionDirection(this.Position, this.lookAt, false);//这里需要是world position

    if (this.inpuValues.backGroundColor) {
      this.backGroundColor = this.inpuValues.backGroundColor;
    }
    else {
      this.backGroundColor = this.scene.getBackgroudColor();
    }
    this.systemUniformBuffersOfGPU = this.device.createBuffer({
      label: "camera (" + this.UUID + ") MVP",
      size: this.uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.updateProjectionMatrix();//构造投影矩阵

    if (this._control == undefined && this.inpuValues.controlType != undefined) {
      this.addControl(this.inpuValues.controlType);
    }
  }
  /**
   * 设置viewMatrix，通过position
   * @param position 
   */
  setViewMatrixByPosition(back: Vec3) {
    /**方向在世界坐标系的-Y轴，特殊判断条件，防止up向量和back向量平行
    *   Z|  / Y
    *    | /
    *    |/______X
    */
    if (this.back[0] == 0 && this.back[1] == -1 && this.back[2] == 0) {
      vec3.copy(vec3.create(1, 0, 0), this.right);
      vec3.copy(vec3.create(0, 0, 1), this.up);
    }
    /**方向在世界坐标系的+Y轴，特殊判断条件，防止up向量和back向量平行
     *    ______X
     *   /|
     * Y/ |Z
     * 
     */
    else if (this.back[0] == 0 && this.back[1] == 1 && this.back[2] == 0) {
      vec3.copy(vec3.create(1, 0, 0), this.right);
      vec3.copy(vec3.create(0, 0, -1), this.up);
    }
    else {
      // this.right = vec3.normalize(vec3.cross(this.UpDirection, back));//会产生突然的翻转，使用this.up,没问题
      this.right = vec3.normalize(vec3.cross(this.up, back));
      this.up = vec3.normalize(vec3.cross(this.back, this.right));
    }
  }

  /**
   * 添加控制，默认只有一个，如果之前有，则自动注销
   * @param control 
   */
  addControl(control: cameracCntrolType) {
    if (this._control) {
      this._control.destroy();
    }
    let controlOption: optionCamreaControl = {
      canvas: this.scene.canvas,
      camera: this,
    }
    switch (control) {
      case "arcball":
        this._control = new ArcballCameraControl(controlOption, this.scene.inputManager);
        break;
      case "wasd":
        this._control = new WASDCameraControl(controlOption, this.scene.inputManager);
        break;
    }
  }
  /**
   * 绑定控制，默认只有一个，如果之前有，则自动注销
   * @param control 
   */
  attachControl(control: CamreaControl) {
    if (this._control) {
      this._control.destroy();
    }
    this._control = control;
  }

  /**
   * 更新投影参数
   * @param options :projectionOptions
   */
  abstract updateProjectionMatrix(): any;

  getViewMatrix() { return this.viewMatrix; }
  getModelMatrix() { return this.modelMatrix; }
  getProjectionMatrix() { return this.projectionMatrix }
  /**归一化的方向  * lookAt 的 vector*/
  getDirection() { return this.direction; }

  /**
   * 返回MVP矩阵,分别是M,V,P三个矩阵
   * @returns  Mat4[]
   */
  getMVP() {
    if (this.MVP)
      return this.MVP;
  }
  updateWorldPosition(_matrixWorld?: Mat4): Vec3 {
    ////移动到NodeObject中
    // this.worldPosition = vec3.fromValues(this.matrixWorld[12], this.matrixWorld[13], this.matrixWorld[14]);
    super.updateWorldPosition();
    this.positionOfModelMatrix = this.worldPosition;//更新model matrix
    return this.worldPosition;
  }

  /**
   * 更新自身属性。
   * 1、更新控制器或根据worldPosition更新属性
   *    A、updateByPositionDirection
   *    B、updateByPositionYawPitch
   * 
   * 2、本fn在update()的updateMatrix()之后调用。
   *    updateMatrix():
   *                    ->updateMatrixWorld()
   *                                          ->updateMatrix()
   *                    ->updateWorldPosition()
   *   所以，调用控制器更新数据之后，需要再次更新position数据：
   *   包括 ：
   *        _position:下一帧updateMatrix()使用;
   *        worldPosition:system中camera的世界坐标
   *        positionOfModelMatrix:shader 的uniform 使用 MVP中的modelMatrix
   * 
   * @param clock 
   */
  updateSelf(clock: Clock): void {
    //1、更新控制器或根据worldPosition更新属性
    if (this._control) {
      //有控制器情况，会隐性调用updateByPositionDirection（）或者updateByPositionYawPitch（）更新MV矩阵和MVP[]
      let result = this._control.update(this.scene.clock.deltaTime);
    }
    else {
      let lookat = this.lookAt;
      if (this.isLookAtGlobal === false) {//lookat 是camera local 坐标系
        vec3.transformMat4(lookat, this.matrixWorld, lookat);//lookat 乘以 matrixWorld，得到lookat的世界坐标
      }
      //无控制器情况，更新MV矩阵和MVP[]
      this.updateByPositionDirection(this.worldPosition, lookat, false);//这里需要是world position
    }
    //2、 更新_position:下一帧updateMatrix()使用。否则,影响arcball zoom正确性和wasd 前后左右
    if (this.Parent) {
      let pos = vec3.sub(this.worldPosition, this.Parent.worldPosition);//camera在其parent的local 坐标系下的位置
      vec3.copy(pos, this._position);
    }
    //3、 更新GPUBuffer
    this.updateBufferOfSystemMVP();
  }

  /**更新camera的modelMatrix and viewMatrix 
  *  1、用途：
  *    A、更新_position 和worldPosition 
  *    B、通过position,dir更新camera的modelMatrix and viewMatrix 
  *       更新this.MPV[]（M，V，P），其中projectionMatrix不再整理更新
   * 2、调用
   *    A、updateSelf（）调用
   *    B、onResize时有Manager的onResize()调用
   *    C、控制器update调用
   * 3、position:
   *      A、position必须是camera的世界坐标系下 position
   *      B、如果是camera的local坐标系（控制器模式），需要显示增加isControlMode=true.然后转换为世界坐标。
   * 4、isControlMode:
   *      A、如果是控制器模式，需要将position转换为世界坐标。
   *      B、direction 和normalize 不使用，通过lookat的世界坐标，重新计算方向。若使用，或需要确保也是世界坐标系下的位置或方向
   * @param position ：摄像机位置
   * @param direction ：摄像机方向（归一化）||看向的位置（非归一化）
   * @param normalize ：摄像机方向是否归一化的
   * @returns  MVP的Mat4[]
   */
  updateByPositionDirection(position: Vec3, direction: Vec3, normalize = false, isControlMode?: boolean): Mat4[] {
    let lookAt=vec3.create();
    //lookat是camera local 坐标系
    if(this.isLookAtGlobal ===false ){
      lookAt= vec3.transformMat4(this.lookAt, this.Parent!.matrixWorld);//position 乘以 matrixWorld，得到position的世界坐标
    }
    //lookat是世界坐标系
    else {
      vec3.copy(this.lookAt,lookAt);
    }
    //控制器模式，非世界坐标系
    if (isControlMode) {
      this.worldPosition = vec3.transformMat4(position, this.Parent!.matrixWorld);//position 乘以 matrixWorld，得到position的世界坐标
      this.back = vec3.normalize(vec3.subtract(this.worldPosition, lookAt));
      this.positionOfModelMatrix = vec3.copy(this.worldPosition);//更新camera的modelMatrix的position
    }
    //世界坐标系
    else {
      if (normalize === false) {
        this.back = vec3.normalize(vec3.subtract(position, direction));
      }
      else {
        this.back = direction;
      }
      this.worldPosition = position;//世界坐标
      this.positionOfModelMatrix = vec3.copy(this.worldPosition);//更新camera的modelMatrix的position
    }

    this.setViewMatrixByPosition(this.back);
    /**方向在世界坐标系的-Y轴，特殊判断条件，防止up向量和back向量平行
     *   Z|  / Y
     *    | /
     *    |/______X
     */
    // if (this.back[0] == 0 && this.back[1] == -1 && this.back[2] == 0) {
    //   vec3.copy(vec3.create(1, 0, 0), this.right);
    //   vec3.copy(vec3.create(0, 0, 1), this.up);
    // }
    // /**方向在世界坐标系的+Y轴，特殊判断条件，防止up向量和back向量平行
    //  *    ______X
    //  *   /|
    //  * Y/ |Z
    //  * 
    //  */
    // else if (this.back[0] == 0 && this.back[1] == 1 && this.back[2] == 0) {
    //   vec3.copy(vec3.create(1, 0, 0), this.right);
    //   vec3.copy(vec3.create(0, 0, -1), this.up);
    // }
    // else {
    //   this.right = vec3.normalize(vec3.cross(this.up, this.back));
    //   this.up = vec3.normalize(vec3.cross(this.back, this.right));
    // }
    // console.log("projectionMatrix=", this.projectionMatrix)
    this.MVP = [mat4.invert(this.modelMatrix), mat4.invert(this.viewMatrix), this.projectionMatrix];

    return this.MVP;
  }
  updateByPositionYawPitch(position: Vec3, yaw: number, pitch: number): Mat4[] {
    //更新camera的矩阵，通过yaw和pitch的增量，暂缓后边通过camera.update更新
    // Reconstruct the camera's rotation, and store into the camera matrix.
    let view = mat4.rotateX(mat4.rotationY(yaw), pitch);
    mat4.copy(view, this.viewMatrix);

    vec3.copy(position, this.positionOfModelMatrix);
    vec3.copy(position, this.worldPosition);
    // if (this.Parent) {
    //   let pos = vec3.sub(this.positionOfModelMatrix, this.Parent.worldPosition);//camera在其parent的local 坐标系下的位置
    //   vec3.copy(pos, this._position);
    // }
    this.MVP = [mat4.invert(this.modelMatrix), mat4.invert(this.viewMatrix), this.projectionMatrix];
    return this.MVP;
  }

  // /**
  //  * 控制器更新
  //  * 1、model矩阵的position_
  //  * 2、worldPosition
  //  * 3、局部的position：todo check 在子节点情况，目前scene的update循环未重构完成；20250910
  //  * @param position 
  //  */
  // updateWorldPositionByPosition(position: Vec3) {
  //   // 更新局部坐标系中的position
  //   if (this.Parent) {
  //     let pos = vec3.sub(position, this.Parent.worldPosition);
  //     vec3.copy(pos, this._position);
  //   }
  //   else {
  //     vec3.copy(position, this._position);
  //   }
  //   // model matrix的 position 是局部坐标系中的position
  //   // vec3.copy(position, this.position_);//相同的变量
  //   // vec3.copy(position, this.worldPosition);//错误copy
  // }
  /**
   * 更新systemMVP
   */
  updateBufferOfSystemMVP() {
    let mvp = this.MVP;
    let MVP: GPUBuffer;
    let MVP_buffer = this.bufferOf_ST_SystemMVP;

    if (mvp.length == 3) {
      let model = new Float32Array(MVP_buffer.buffer, 4 * 4 * 4 * 0, 16);
      mat4.copy((<Mat4[]>mvp)[0], model);

      let view = new Float32Array(MVP_buffer.buffer, 4 * 4 * 4 * 1, 16);
      mat4.copy((<Mat4[]>mvp)[1], view);

      let projection = new Float32Array(MVP_buffer.buffer, 4 * 4 * 4 * 2, 16);
      mat4.copy((<Mat4[]>mvp)[2], projection);

    }
    else {
      throw new Error("MVP矩阵长度错误");
    }
    // console.log("updateBufferOfSystemMVP",this.worldPosition);
    let cameraPosition = new Float32Array(MVP_buffer.buffer, 4 * 4 * 4 * 3, 3);
    cameraPosition[0] = this.worldPosition[0];
    cameraPosition[1] = this.worldPosition[1];
    cameraPosition[2] = this.worldPosition[2];

    if (this.scene.reversedZ.isReversedZ) {
      let reversedZ = new Uint32Array(MVP_buffer.buffer, 4 * 4 * 4 * 3 + 3 * 4, 1);
      reversedZ[0] = 1;
    }


    this.device.queue.writeBuffer(
      this.systemUniformBuffersOfGPU,
      0,
      MVP_buffer.buffer,
      MVP_buffer.byteOffset,
      MVP_buffer.byteLength
    );
  }
  getBufferOfSystemMVP() {
    return this.systemUniformBuffersOfGPU;
  }

  /**
   * 判断节点是否在BVH中可见
   * @param node 节点
   * @returns 是否在BVH中可见
   */
  getVisibleInBVH(node: NodeObject): boolean {
    return true;
  }

}
