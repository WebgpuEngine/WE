//全局逆绑定矩阵=骨骼全局矩阵（matrixWorld） 左乘 骨骼逆绑定矩阵
@group(1) @binding(3) var<storage> joint_matrix: array<mat4x4f>;           //length=instance count * joint matrix count
