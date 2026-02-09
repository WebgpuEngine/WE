import { Mat4 } from "wgpu-matrix";
import { NodeObject } from "../organization/root";

export class Skeleton {

    /** 骨骼节点数量 */
    count: number = 0;
    /** 骨骼节点逆绑定矩阵 */
    inverseBindMatrices: Mat4[] = [];
    /** 骨骼节点 ，必须与inverseBindMatrices顺序与数量一致 */
    joints: NodeObject[] = [];
    /** 骨骼节点变换矩阵 */
    output!: ArrayBuffer;
    constructor() {
    }
    addJoint(joint: NodeObject) {
        this.joints.push(joint);
    }
    addInverseBindMatrix(matrix: Mat4) {
        this.inverseBindMatrices.push(matrix);
    }
    add(joint: NodeObject, matrix: Mat4) {
        this.addJoint(joint);
        this.addInverseBindMatrix(matrix);
        this.count = this.joints.length;
    }
    setInverseBindMatrices(matrices: Mat4[]) {
        this.count = matrices.length;
        this.inverseBindMatrices = matrices;
    }
    setJoints(joints: NodeObject[]) {
        this.count = joints.length;
        this.joints = joints;
    }
}