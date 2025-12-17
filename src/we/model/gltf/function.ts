/**
 * 获取accessor的component type size，用于计算accessor的size
 * @param componentType 
 * @returns number
 */
export function getComponentTypeSize(componentType: number): number {
    if (componentType == 5120) {
        return 1;//"int8";
    }
    else if (componentType == 5121) {
        return 1;//"uint8";
    }
    else if (componentType == 5122) {
        return 2;//"int16";
    }
    else if (componentType == 5123) {
        return 2;//"uint16";
    }
    else if (componentType == 5125) {
        return 4;//"uint32";
    }
    else if (componentType == 5126) {
        return 4;//"float32";
    }
    else {
        throw new Error("GLTFModel: unknown accessor component type");
    }
}

/**
 * 获取accessor的type size，用于计算accessor的size
 * @param type 
 * @returns number
 */
export function getTypeSize(type: string): number {
    let size = 0;
    if (type == "SCALAR") {
        size = 1;
    }
    else if (type == "VEC2") {
        size = 2;
    }
    else if (type == "VEC3") {
        size = 3;
    }
    else if (type == "VEC4") {
        size = 4;
    }
    else if (type == "MAT2") {
        size = 4;
    }
    else if (type == "MAT3") {
        size = 9;
    }
    else if (type == "MAT4") {
        size = 16;
    }
    else {
        throw new Error("GLTFModel: unknown accessor type");
    }
    return size;
}

/**
 * 获取accessor的size，用于计算accessor中引用bufferView的length
 * @param accessor 对象
 * @returns 
 * 
 *  size: number, 数量*组件构成数量
 * 
 *  unitByteSize: number ，组件byte大小
 */
export function getAccessorSize(accessor: any): { size: number, unitByteSize: number } {
    let type = accessor.type;
    let count = accessor.count;
    let componentSize = getTypeSize(type);
    if (componentSize == undefined) {
        throw new Error("GLTFModel: unknown type");
    }
    let componentTypeSize = getComponentTypeSize(accessor.componentType);
    if (componentTypeSize == undefined) {
        throw new Error("GLTFModel: unknown component type");
    }
    return { size: count * componentSize, unitByteSize: componentTypeSize };
}
/**
 * 获取accessor的byte stride，用于计算accessor中引用bufferView的byte offset
 * @param accessor 
 * @returns number
 */
export function getAccessorByteStride(accessor: any): number {
    let byteStride = accessor.byteStride || 0;
    if (byteStride == 0) {
        byteStride = getTypeSize(accessor.type) * getComponentTypeSize(accessor.componentType);
    }
    if (accessor.type == "VEC3") {//5120|5121|5122|5123 ,即（sint8|uint8|sint16|uint16）。需要将其转换为u32x3。
        byteStride = 4 * 3;
    }
    return byteStride;
}
/**
 * 获取accessor的index format，用于绑定到DC的index buffer
 * @param accessor 
 * @returns GPUIndexFormat
 */
export function getAccessorTypeForGPUIndexFormat(accessor: any): GPUIndexFormat {
    if (accessor.type == "SCALAR") {
        if (accessor.componentType == 5123) {
            return "uint16";
        }
        else if (accessor.componentType == 5125) {
            return "uint32";
        }
        else {
            throw new Error("GLTFModel: unknown accessor component type");
        }
    }
    else {
        throw new Error("GLTFModel: unknown accessor type");
    }
}
/**
 * 获取accessor的vertex format，用于绑定到DC的vertex buffer
 * @param accessor 
 * @returns { format: GPUVertexFormat, wgslFormat: string }
 */
export function getAccessorTypeForGPUVertexFormat(accessor: any): { format: GPUVertexFormat, wgslFormat: string } {
    let type = accessor.type;
    let format: GPUVertexFormat;
    let wgslFormat: string;
    if (type == "SCALAR") {
        if (accessor.componentType == 5120) {
            format = "sint8";
            wgslFormat = "i32";
        }
        else if (accessor.componentType == 5121) {
            format = "uint8";
            wgslFormat = "u32";
        }
        else if (accessor.componentType == 5122) {
            format = "sint16";
            wgslFormat = "i32";
        }
        else if (accessor.componentType == 5123) {
            format = "uint16";
            wgslFormat = "u32";
        }
        else if (accessor.componentType == 5125) {
            format = "uint32";
            wgslFormat = "u32";
        }
        else if (accessor.componentType == 5126) {
            format = "float32";
            wgslFormat = "f32";
        }
        else {
            throw new Error("GLTFModel: unknown accessor component type");
        }
    }
    else if (type == "VEC2") {
        if (accessor.componentType == 5120) {
            format = "sint8x2";
            wgslFormat = "vec2i";
        }
        else if (accessor.componentType == 5121) {
            format = "uint16x2";
            wgslFormat = "vec2u";
        }
        else if (accessor.componentType == 5122) {
            format = "sint16x2";
            wgslFormat = "vec2i";
        }
        else if (accessor.componentType == 5123) {
            format = "uint16x2";
            wgslFormat = "vec2u";
        }
        else if (accessor.componentType == 5125) {
            format = "uint32x2";
            wgslFormat = "vec2u";
        }
        else if (accessor.componentType == 5126) {
            format = "float32x2";
            wgslFormat = "vec2f";
        }
        else {
            throw new Error("GLTFModel: unknown accessor component type");
        }
    }
    else if (type == "VEC3") {
        if (accessor.componentType == 5120) {
            format = "sint32x3";
            wgslFormat = "vec3i";
        }
        else if (accessor.componentType == 5121) {
            format = "uint32x3";
            wgslFormat = "vec3u";
        }
        else if (accessor.componentType == 5122) {
            format = "sint32x3";
            wgslFormat = "vec3i";
        }
        else if (accessor.componentType == 5123) {
            format = "uint32x3";
            wgslFormat = "vec3u";
        }
        else if (accessor.componentType == 5125) {
            format = "uint32x3";
            wgslFormat = "vec3u";
        }
        else if (accessor.componentType == 5126) {
            format = "float32x3";
            wgslFormat = "vec3f";
        }
        else {
            throw new Error("GLTFModel: unknown accessor component type");
        }
    }
    else if (type == "VEC4") {
        if (accessor.componentType == 5120) {
            format = "sint8x4";
            wgslFormat = "vec4i";
        }
        else if (accessor.componentType == 5121) {
            format = "uint16x4";
            wgslFormat = "vec4u";
        }
        else if (accessor.componentType == 5122) {
            format = "sint16x4";
            wgslFormat = "vec4i";
        }
        else if (accessor.componentType == 5123) {
            format = "uint16x4";
            wgslFormat = "vec4u";
        }
        else if (accessor.componentType == 5125) {
            format = "uint32x4";
            wgslFormat = "vec4u";
        }
        else if (accessor.componentType == 5126) {
            format = "float32x4";
            wgslFormat = "vec4f";
        }
        else {
            throw new Error("GLTFModel: unknown accessor component type");
        }
    }
    else {
        throw new Error("GLTFModel: unknown accessor type");
    }
    return { format: format, wgslFormat: wgslFormat };


    // else if (type == "MAT2") {
    //     return "float32x4";
    // }
    // else if (type == "MAT3") {
    //     return 9;
    // }
    // else if (type == "MAT4") {
    //     return 16;
    // }
}


/**
 * 检查bufferView是否包含VEC3类型的accessor，
 * 如果包含，且componentType为5120、5121、5122、5123中的一种，
 * 则需要新构建buffer
 * @param bufferView 要检查的bufferView
 * @param accessors 所有accessor
 * @returns 
 */
export function checkRebulidBufferForVec3(accessor: any): boolean {
    if (accessor.type == "VEC3") {
        if (accessor.componentType == 5120 || accessor.componentType == 5121 || accessor.componentType == 5122 || accessor.componentType == 5123) {
            return true;
        }
    }
    return false;
}


/**
 * 创建BufferSource
 * @param data 原始数据
 * @param componentType 组件类型
 * @param byteOffset 偏移量
 * @param size 大小
 * @returns 
 */
export function getBufferSourceOfArrayBuffer(data: ArrayBuffer, componentType: number, byteOffset: number, size: number): Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array  {
    let buffer;
    if (componentType == 5120) {
        buffer = new Int8Array(data, byteOffset, size);
    }
    else if (componentType == 5121) {
        buffer = new Uint8Array(data, byteOffset, size);
    }
    else if (componentType == 5122) {
        buffer = new Int16Array(data, byteOffset, size);
    }
    else if (componentType == 5123) {
        buffer = new Uint16Array(data, byteOffset, size);
    }
    else if (componentType == 5125) {
        buffer = new Uint32Array(data, byteOffset, size);
    }
    else if (componentType == 5126) {
        buffer = new Float32Array(data, byteOffset, size);
    }
    else {
        throw new Error(`GLTFModel:  component type ${componentType} not support`);
    }
    return buffer;
}

export function createBufferSourceOfArrayBuffer(data: ArrayBuffer, componentType: number, byteOffset: number, size: number): Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array  {
    let buffer;
    if (componentType == 5120) {
        buffer = new Int8Array(data, byteOffset, size);
    }
    else if (componentType == 5121) {
        buffer = new Uint8Array(data, byteOffset, size);
    }
    else if (componentType == 5122) {
        buffer = new Int16Array(data, byteOffset, size);
    }
    else if (componentType == 5123) {
        buffer = new Uint16Array(data, byteOffset, size);
    }
    else if (componentType == 5125) {
        buffer = new Uint32Array(data, byteOffset, size);
    }
    else if (componentType == 5126) {
        buffer = new Float32Array(data, byteOffset, size);
    }
    else {
        throw new Error(`GLTFModel:  component type ${componentType} not support`);
    }
    return buffer;
}

/**
 * 为sparse 写入bufferView中的数据
 * @param bufferView 要写入的bufferView
 * @param type 类型
 * @param index 索引
 * @param value 值
 */
export function writeArayBufferViewForSparse(buffe: ArrayBuffer,type:string,componentType:number,index:number,value:any,sparseIndex:number){
    let bufferView ;
    if (componentType == 5120) {
        bufferView = new Int8Array(buffe);
    }
    else if (componentType == 5121) {
        bufferView = new Uint8Array(buffe);
    }
    else if (componentType == 5122) {
        bufferView = new Int16Array(buffe);
    }
    else if (componentType == 5123) {
        bufferView = new Uint16Array(buffe);
    }
    else if (componentType == 5125) {
        bufferView = new Uint32Array(buffe);
    }
    else if (componentType == 5126) {
        bufferView = new Float32Array(buffe);
    }
    else {
        throw new Error(`GLTFModel:  component type ${componentType} not support`);
    }
    if(type == "SCALAR"){
        bufferView[index] = value[sparseIndex];
    }
    else if(type == "VEC2"){
        bufferView[index*2] = value[sparseIndex*2];
        bufferView[index*2+1] = value[sparseIndex*2+1];
    }
    else if(type == "VEC3"){
        bufferView[index*3] = value[sparseIndex*3];
        bufferView[index*3+1] = value[sparseIndex*3+1];
        bufferView[index*3+2] = value[sparseIndex*3+2];
    }
    else if(type == "VEC4"){
        bufferView[index*4] = value[sparseIndex*4];
        bufferView[index*4+1] = value[sparseIndex*4+1];
        bufferView[index*4+2] = value[sparseIndex*4+2];
        bufferView[index*4+3] = value[sparseIndex*4+3];
    }
    else{
        throw new Error(`GLTFModel:  type ${type} not support`);
    }
}