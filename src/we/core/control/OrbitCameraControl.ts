import { mat4, Vec3, vec3 } from "wgpu-matrix";
import { InputManager } from "../input/inputManager";
import { ArcballCameraControl } from "./arcballCameraControl";
import { CamreaControl, IV_CamreaControl } from "./cameracControl";
import * as MathFun from "../math/baseFunction"


export interface IV_OrbitCameraControl extends IV_CamreaControl {
    /** 坐标系向上轴（默认轴）方向的角度范围 
     * 1、默认：
    */
    upAxisAngle?: {
        top?: number,
        bottom?: number,
    }
}

export class OrbitCameraControl extends ArcballCameraControl {
    declare inputValues: IV_OrbitCameraControl;
    upAxisAngle = {
        top: Math.PI / 2,
        bottom: -Math.PI / 2,
    };
    constructor(option: IV_CamreaControl, manager: InputManager) {
        super(option, manager);
        this.type = "orbit";
        this.inputValues = option;
        if (this.inputValues.upAxisAngle) {
            if (this.inputValues.upAxisAngle.top !== undefined && this.inputValues.upAxisAngle.top <= this.upAxisAngle.top) {
                this.upAxisAngle.top = this.inputValues.upAxisAngle.top;
            }
            if (this.inputValues.upAxisAngle.bottom !== undefined && this.inputValues.upAxisAngle.bottom >= this.upAxisAngle.bottom) {
                this.upAxisAngle.bottom = this.inputValues.upAxisAngle.bottom;
            }
        }
    }
    init() {
    }


    update(deltaTime: number): boolean {
        if (this.upAxisAngle.bottom > this.upAxisAngle.top) {
            throw new Error("top角度必须小于bottom角度");
        }
        /**
         * 没有使用欧拉角，而是使用arcball旋转方法进行了扩展。
         * 1、上方向轴的角度范围判断，采用arcball的方法先进行计算，然后计算camera与lookat的向量，然后与上方向向量进行点积，判断是否在范围内。
         * 2、负方向相同方法；
         * 3、const epsilon = 0.000001; epsilon是为了避免浮点数精度问题，导致判断错误。
         * 4、判断到达极点（top，bottom）（camera.back dot +-Y）。
         *      A、需要将两个三维向量转为共平面的二维向量，其中上方向为X轴。
         *      B、可以后边，不能前进。
         *      C、计算下一步在camera.back与+-Y的cross，
         *              a、正，是向前旋转，拒绝，保持camera不变
         *              b、负，是向后旋转，许可
         */
        if (typeof this.camera !== 'boolean') {
            //一、通用数据
            let input = this.getInputValue();
            let position = vec3.subtract(this.camera.worldPosition, this.camera.LookAt);
            //1.1、计算当前距离，旋转距离不变
            this.distance = vec3.distance(this.camera.positionOfModelMatrix, this.camera.LookAt);
            let oldDistance = this.distance;
            //阈值，for 旋转角 & 旋转轴
            const epsilon = 0.0000001;

            //二、判断是否有鼠标操作
            if (this.eventValues.mouseValue.downOrUP == "down") {
                //三、鼠标左键（主键）
                if (this.eventValues.mouseValue.buttons == 1) {
                    let pointOfPlaneXZ = vec3.normalize(position);
                    let radianX = -input.analog.x * this.rotationSpeed / 180 * Math.PI;
                    let radianY = -input.analog.y * this.rotationSpeed / 180 * Math.PI;
                    if (Math.abs(radianX) < epsilon && Math.abs(radianY) < epsilon) {
                        return false;
                    }
                    // console.log("radianX", radianX, "radianY", radianY);

                    //判断camera的Z轴是否与upY轴平行
                    let upDotCameraZ = vec3.dot(this.camera.UpDirection, pointOfPlaneXZ);
                    // console.log("upDotCameraZ", upDotCameraZ, "radianY", radianY, "radianX", radianX);
                    if (Math.abs((this.upAxisAngle.top - Math.PI / 2)) < this.epsilon && upDotCameraZ > 0.999999) {
                        if (radianY > 0) {
                            let x = vec3.transformMat3(this.camera.right, this.camera.Parent!.matrixWorld);//将camera.right向量从camera坐标系转换到world坐标系。
                            position = MathFun.rotate(position, x, radianY);
                        }
                        else if (Math.abs(radianX) > epsilon) {
                            /** *********************************** */
                            //旋转camera.right向量和camera.up向量
                            let right = MathFun.rotate(this.camera.right, vec3.create(0, 1, 0), radianX);//绕Y轴（为lookat Y轴）旋转camera.right向量。
                            vec3.normalize(right, this.camera.right);                                       //归一化right向量，保持其长度为1。
                            vec3.normalize(vec3.cross(this.camera.back, this.camera.right), this.camera.up);    //计算新的up向量，保持与right向量垂直。
                        }
                        //计算新位置
                        let positionOfLookat = vec3.add(position, this.camera.LookAt);//在现有位置上增加lookat位的增量。camera和lookat的坐标系在xyz的三个向量上保持一致，只有position不同（no zoom情况下）。
                        this.camera.updateByPositionDirection(positionOfLookat, positionOfLookat, true, true);//第二、三个参数，在控制器情况下，不使用，无意义。具体参见camera.updateByPositionDirection
                        return true;
                    }
                    //判断camera的Z轴是否与upY轴平行
                    else if (Math.abs((this.upAxisAngle.bottom - (-Math.PI / 2))) < this.epsilon && upDotCameraZ < -0.999999) {
                        if (radianY < 0) {
                            let x = vec3.transformMat3(this.camera.right, this.camera.Parent!.matrixWorld);
                            position = MathFun.rotate(position, x, radianY);
                        }
                        else if (radianX != 0) {
                            //
                            let right = MathFun.rotate(this.camera.right, vec3.create(0, 1, 0), radianX);//绕Y轴（为lookat Y轴）旋转camera.right向量。
                            vec3.normalize(right, this.camera.right);                                       //归一化right向量，保持其长度为1。
                            vec3.normalize(vec3.cross(this.camera.back, this.camera.right), this.camera.up);    //计算新的up向量，保持与right向量垂直。
                        }
                        //计算新位置
                        let positionOfLookat = vec3.add(position, this.camera.LookAt);//在现有位置上增加lookat位的增量。camera和lookat的坐标系在xyz的三个向量上保持一致，只有position不同（no zoom情况下）。
                        this.camera.updateByPositionDirection(positionOfLookat, positionOfLookat, true, true);//第二、三个参数，在控制器情况下，不使用，无意义。具体参见camera.updateByPositionDirection
                        return true;
                    }
                    else {
                        let sinCosCameraZ = this.computeSinAndCosOfUpDirectionAndX0z(position);//sin  cos 


                        if (upDotCameraZ < 0.999 &&sinCosCameraZ.sin > 0) {
                            ////绕X轴（为camera Z轴对应的X轴，非lookat的X轴【原始相等】）旋转
                            let rotateAxisX = vec3.normalize(vec3.cross(this.camera.UpDirection, pointOfPlaneXZ));
                            position = MathFun.rotate(position, rotateAxisX, radianY);
                            ////绕Y轴（为lookat Y轴）旋转
                            position = MathFun.rotate(position, vec3.create(0, 1, 0), radianX);
                        }
                        else if (upDotCameraZ > 0.999) {
                            if (sinCosCameraZ.sin > 0)//上半球
                                if (radianY > 0) {
                                    let x = vec3.transformMat3(this.camera.right, this.camera.Parent!.matrixWorld);//将camera.right向量从camera坐标系转换到world坐标系。
                                    position = MathFun.rotate(position, x, radianY);                    //绕X轴（为camera Z轴对应的X轴，非lookat的X轴【原始相等】）旋转
                                }
                                else {
                                    position = MathFun.rotate(position, vec3.create(0, 1, 0), radianX);//绕Y轴（为lookat Y轴）旋转
                                }
                            // else {
                            //     if (radianY < 0) {
                            //         let x = vec3.transformMat3(this.camera.right, this.camera.Parent!.matrixWorld);
                            //         position = MathFun.rotate(position, x, radianY);
                            //     }
                            //     else {
                            //         position = MathFun.rotate(position, vec3.create(0, 1, 0), radianX);
                            //     }
                            // }
                        }
                        else if (upDotCameraZ > -0.999) {
                            let rotateAxisX = vec3.normalize(vec3.cross(this.camera.UpDirection, pointOfPlaneXZ));
                            position = MathFun.rotate(position, rotateAxisX, radianY);
                            ////绕Y轴（为lookat Y轴）旋转
                            position = MathFun.rotate(position, vec3.create(0, 1, 0), radianX);
                        }
                        else if (upDotCameraZ < -0.999) {
                            if (sinCosCameraZ.sin < 0)//下半球
                                if (radianY < 0) {
                                    let rotateAxisX = vec3.normalize(vec3.cross(this.camera.UpDirection, pointOfPlaneXZ));
                                    position = MathFun.rotate(position, rotateAxisX, radianY);
                                }
                                else {
                                    position = MathFun.rotate(position, vec3.create(0, 1, 0), radianX);
                                }
                        }



                        // console.log("cameraZ", sinCosCameraZ);
                        let sinOfTop = Math.sin(this.upAxisAngle.top);
                        let sinOfBottom = Math.sin(this.upAxisAngle.bottom);

                        //有角度
                        if (sinCosCameraZ.sin > sinOfTop) {//摄像机视角在+Y方向,且已经超过top角度
                            let vectorOfPlaneXZ = vec3.normalize(vec3.create(position[0], 0, position[2]));//XZ平面的单位向量
                            let axisOfRotationZ = vec3.cross(vectorOfPlaneXZ, vec3.create(0, 1, 0,));//旋转轴Z, X cross Y = Z;反过来，当中X轴也可以；
                            let pointOfPlaneXZ = vec3.scale(vectorOfPlaneXZ, this.distance);//XZ平面的单位向量，长度为distance
                            position = MathFun.rotate(pointOfPlaneXZ, axisOfRotationZ, this.upAxisAngle.top);//作为Z轴，角度不变
                        }
                        else if (sinCosCameraZ.sin < sinOfBottom) {//摄像机视角在+Y方向,且已经超过top角度
                            console.log("position", position);

                            let vectorOfPlaneXZ = vec3.normalize(vec3.create(position[0], 0, position[2]));//XZ平面的单位向量
                            let axisOfRotationZ = vec3.cross(vectorOfPlaneXZ, vec3.create(0, 1, 0,));//旋转轴Z, X cross Y = Z;反过来，当中X轴也可以；
                            let pointOfPlaneXZ = vec3.scale(vectorOfPlaneXZ, this.distance);//XZ平面的单位向量，长度为distance

                            if (this.upAxisAngle.bottom != 0) {
                                position = MathFun.rotate(pointOfPlaneXZ, axisOfRotationZ, this.upAxisAngle.bottom);//作为Z轴，角度不变
                            }
                            else {
                                position = pointOfPlaneXZ;
                            }
                        }

                        let dir = vec3.normalize(position);
                        let positionOfLookat = vec3.add(position, this.camera.LookAt);//在现有位置上增加lookat位的增量。camera和lookat的坐标系在xyz的三个向量上保持一致，只有position不同（no zoom情况下）。

                        //3.4 更新摄像机的position和lookAt
                        this.camera.updateByPositionDirection(positionOfLookat, dir, true, true);//第二、三个参数，在控制器情况下，不使用，无意义。具体参见camera.updateByPositionDirection
                        return true;
                    }

                }
                //四、鼠标右键（次键）
                else if (this.eventValues.mouseValue.buttons == 2) {
                    // console.log(this.eventValues.mouseValue.buttons, this.eventValues.mouseValue.downOrUP);
                    const movement = vec3.create();  //以屏幕中心(lookat )为原点
                    vec3.addScaled(movement, this.camera.right, -input.analog.x * this.rightKeyRate, movement);//X 方向的增量,负号是因为鼠标向右是负方向
                    vec3.addScaled(movement, this.camera.up, input.analog.y * this.rightKeyRate, movement);//Y 方向的增量

                    if (movement[0] || movement[1]) {//如果X或Y方向有增量
                        let position = vec3.copy(this.camera.worldPosition);
                        let localLookat = this.camera.getLocalLookAtVec3();

                        vec3.add(localLookat, movement, localLookat);//lookat 加上增量
                        vec3.add(position, movement, position);//lookat 加上position

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
            return false;
        }
        else {
            console.log("arcbalCameraControl's camere didn't defined !,error from update()");
            return false;
        }
    }

}