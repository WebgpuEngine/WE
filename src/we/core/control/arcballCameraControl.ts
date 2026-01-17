import {
    Vec3, vec3,
} from 'wgpu-matrix';

import { CamreaControl, } from "./cameracControl"

import * as MathFun from "../math/baseFunction"


/**
 * arcball 控制器
 */
export class ArcballCameraControl extends CamreaControl {

    // The current angular velocity
    private angularVelocity = 0;
    private distance = 0;
    // Speed multiplier for camera zoom
    zoomSpeed = 0.1;

    /** Rotation velocity drag coeffient [0 .. 1]
     0: Spins forever
     1: Instantly stops spinning
    */
    frictionCoefficient = 0.999;


    // The current rotation axis，旋转轴
    private axis_ = vec3.create();

    // Speed multiplier for camera rotation，角度旋转系数
    rotationSpeed = 1;


    // Returns the rotation axis
    get axis() {
        return this.axis_;
    }
    // Assigns `vec` to the rotation axis
    set axis(vec: Vec3) {
        vec3.copy(vec, this.axis_);
    }

    /** 右键旋转系数 */
    rightKeyRate = 0.01;

    // constructor(option: optionCamreaControl) {
    //     super(option)
    // }
    init() {
        // throw new Error('Method not implemented.');
    }
    /**
     * 更新相机位置，这里更新camera的position和dir 
     * 1、position是在camera的lookat位置为原点的坐标系下的位置
     *      A、
     *      B、（最后调用camera的updateByPositionDirection()会转化为camera的local坐标系下的位置）
     * 2、direction是在camera的lookat位置为原点的坐标系下的方向向量
     *      A、lookat为原点的坐标系与camera的local坐标系是只有position是不一样的，各自为原点。view空间是一致的，即xyz的分量相对于camera的parent的坐标系一致
     *      B、
     * @param deltaTime 
     * @returns 
     */
    update(deltaTime: number): boolean {
        if (typeof this.camera !== 'boolean') {
            //一、通用数据
            let input = this.getInputValue();
            let position = vec3.copy(this.camera.worldPosition);
            //1.1、计算当前距离，旋转距离不变
            this.distance = vec3.distance(this.camera.positionOfModelMatrix, this.camera.LookAt);
            let oldDistance = this.distance;
            //阈值，for 旋转角 & 旋转轴
            const epsilon = 0.0000001;

            //二、判断是否有鼠标操作
            if (this.eventValues.mouseValue.downOrUP == "down") {
                //2.1、处理旋转
                if (input.analog.touching) {//拖动
                    // Currently being dragged.//角速度归零
                    this.angularVelocity = 0;
                } else {//衰减角速度
                    // Dampen any existing angular velocity
                    this.angularVelocity *= Math.pow(1 - this.frictionCoefficient, deltaTime);
                    // console.log(this.angularVelocity)
                }



                //三、鼠标左键（主键）
                if (this.eventValues.mouseValue.buttons == 1) {
                    //2.2、处理移动 ：X , Y
                    // Calculate the movement vector，计算移动方向
                    const movement = vec3.create();  //以屏幕中心(lookat )为原点
                    vec3.addScaled(movement, this.camera.right, input.analog.x, movement);//X 方向的增量
                    vec3.addScaled(movement, this.camera.up, -input.analog.y, movement);//Y 方向的增量,负号是因为鼠标向上是负方向
                    // 3.1 叉乘出Z轴的增量 Cross the movement vector with the view direction to calculate the rotation axis x magnitude
                    const crossProduct = vec3.cross(movement, this.camera.back);

                    //3.1 计算拖动的量级，Z方向的向量长度; Calculate the magnitude of the drag
                    const magnitude = vec3.len(crossProduct);

                    //3.3 如果Z方向的的增量大于 epsilon，重新计算旋转轴和角速度
                    if (magnitude > epsilon) {//如果Z方向的的增量大于 epsilon，重新计算旋转轴
                        //旋转轴。 Normalize the crossProduct to get the rotation axis
                        this.axis = vec3.scale(crossProduct, 1 / magnitude);
                        //更新当前角速度 ，Z方向的增量*旋转系数。 Remember the current angular velocity. This is used when the touch is released for a fling.
                        this.angularVelocity = magnitude * this.rotationSpeed;
                    }
                    //3.4 计算旋转角 =角速度*时间区间。The rotation around this.axis to apply to the camera matrix this update
                    const rotationAngle = this.angularVelocity * deltaTime;

                    //3.5 计算camera的position 
                    //3.5.11 camera的Z轴，旋转角度大于阈值，重新计算Z轴
                    let dir!: Vec3;
                    if (rotationAngle > epsilon) {//旋转角度大于阈值
                        // Rotate the matrix around axis
                        // Note: The rotation is not done as a matrix-matrix multiply as the repeated multiplications
                        // will quickly introduce substantial error into the matrix.
                        dir = vec3.normalize(MathFun.rotate(this.camera.back, this.axis, rotationAngle));
                    }
                    //3.5.2 计算在dir方向上的摄像机的position的位置
                    if (dir) {//方向变化，距离有可能变化
                        position = vec3.scale(dir, this.distance);//重新计算位置
                        let positionOfLookat = vec3.add(position, this.camera.LookAt);//lookat位置
                        //3.4 更新摄像机的position和lookAt
                        this.camera.updateByPositionDirection(positionOfLookat, dir, true, true);
                        return true;
                    }
                    return false;
                }
                //四、鼠标右键（次键）
                else if (this.eventValues.mouseValue.buttons == 2) {
                    // console.log(this.eventValues.mouseValue.buttons, this.eventValues.mouseValue.downOrUP);
                    // const movement = vec3.create(input.analog.x * this.rightKeyRate, input.analog.y * this.rightKeyRate, 0); 
                    const movement = vec3.create();  //以屏幕中心(lookat )为原点
                    vec3.addScaled(movement, this.camera.right, -input.analog.x * this.rightKeyRate, movement);//X 方向的增量,负号是因为鼠标向右是负方向
                    vec3.addScaled(movement, this.camera.up, input.analog.y * this.rightKeyRate, movement);//Y 方向的增量
                    if (movement[0] || movement[1]) {//如果X或Y方向有增量
                        let localLookat = this.camera.getLocalLookAtVec3();
                        // console.log("before add: ", localLookat, movement, position);
                        vec3.add(localLookat, movement, localLookat);//lookat 加上增量
                        vec3.add(position, movement, position);//lookat 加上position
                        // console.log("after add: ", localLookat, movement, position);

                        this.camera.setLookAtFromLocalVec3(localLookat);//更新lookat
                        this.camera.updateByPositionDirection(position, localLookat, false, true);//更新position和lookat
                        return true;
                    }
                }
            }
            //五、 zoom，重新计算在dir方向上的摄像机的position的距离。 recalculate `this.position` from `this.back` considering zoom
            else if (input.analog.zoom !== 0) {
                //5.1 计算在dir方向上的摄像机的position的位置
                this.distance *= 1 + input.analog.zoom * this.zoomSpeed;
                //5.2 距离变化了，重新计算position
                if (oldDistance != this.distance) {
                    //5.3 重新计算position
                    position = vec3.add(vec3.scale(this.camera.back, this.distance), this.camera.LookAt);//重新计算位置
                    // console.log("zoom:dir", ...this.camera.back, "position", ...position, "distance", this.distance);
                    this.camera.updateByPositionDirection(position, this.camera.back, true, true);
                    return true;
                }
            }
        }
        else {
            console.log("arcbalCameraControl's camere didn't defined !,error from update()");
            return false;
        }
    }


}