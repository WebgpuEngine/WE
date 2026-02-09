/**
 * Rodrigues' Rotation Formula
 * 1、旋转轴:[x,y,z]
 * 2、旋转角度：单位为弧度
 * 3、旋转点：[x,y,z]
 * 4、旋转后的点：[x',y',z']
 * 5、旋转公式：
 *      x' = x * cos(theta) + (x * axis.x + y * axis.y + z * axis.z) * (1 - cos(theta)) * axis.x + (y * axis.x + z * axis.y) * sin(theta) * axis.z
 *      y' = y * cos(theta) + (x * axis.x + y * axis.y + z * axis.z) * (1 - cos(theta)) * axis.y + (z * axis.x + x * axis.y) * sin(theta) * axis.z
 *      z' = z * cos(theta) + (x * axis.x + y * axis.y + z * axis.z) * (1 - cos(theta)) * axis.z + (x * axis.y + y * axis.z) * sin(theta) * axis.x
 * 
 */

/**
 * 罗德里格斯旋转矩阵（生成绕任意单位轴旋转θ的4×4矩阵，列主序，适配WebGPU）
 * @param {number[]} axis - 单位旋转轴 [x,y,z]（必须归一化！）
 * @param {number} angle - 旋转角度（弧度，右手定则）
 * @returns {Float32Array} 4×4旋转矩阵（列主序）
 */
function rodriguesRotationMatrix(axis: number[], angle: number) {
    let axisNormalized = axis.map(x => x / Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]));
    const [kx, ky, kz] = axisNormalized;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const oc = 1 - c; // 1 - cosθ

    // 3×3 罗德里格斯矩阵（列主序）
    const m3x3 = [
        // 第一列
        kx * kx * oc + c,
        ky * kx * oc + kz * s,
        kz * kx * oc - ky * s,
        // 第二列
        kx * ky * oc - kz * s,
        ky * ky * oc + c,
        kz * ky * oc + kx * s,
        // 第三列
        kx * kz * oc + ky * s,
        ky * kz * oc - kx * s,
        kz * kz * oc + c
    ];

    // 扩展为4×4矩阵（列主序，WebGPU标准）
    const mat4 = new Float32Array(16);
    mat4.set([
        m3x3[0], m3x3[1], m3x3[2], 0, // 列0
        m3x3[3], m3x3[4], m3x3[5], 0, // 列1
        m3x3[6], m3x3[7], m3x3[8], 0, // 列2
        0, 0, 0, 1  // 列3
    ]);
    return mat4;
}

// 示例：相机翻滚（绕视线轴旋转45°）
const forward = [0, 0, -1]; // 相机前方向（视线轴，已归一化）
const rollAngle = Math.PI / 4; // 45°翻滚
const rollMatrix = rodriguesRotationMatrix(forward, rollAngle);
console.log("翻滚旋转矩阵：", rollMatrix);