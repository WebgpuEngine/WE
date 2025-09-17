export function createBuffer(device: GPUDevice, usage: GPUBufferUsageFlags, size: number, label: string,) {
    return device.createBuffer({
        label: label,
        size: size,
        usage: usage
    });;
}

/** 创建uniform Buffer，  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST*/
export function createUniformBuffer(device: GPUDevice, size: number, label: string, data?: ArrayBuffer, usage?: GPUBufferUsageFlags) {
    if (usage == undefined) usage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
    if (label == undefined) label = "uniform buffer:" + size;
    let buffer = createBuffer(device, usage, size, label);
    if (data)
        device.queue.writeBuffer(buffer, 0, data);
    return buffer;
}
/** 创建uniform Buffer，  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST*/
export function createStorageBuffer(device: GPUDevice, size: number, label: string, usage?: GPUBufferUsageFlags) {
    if (usage == undefined) usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
    if (label == undefined) label = "storage buffer:" + size;
    return createBuffer(device, usage, size, label);
}
/**
 * 创建顶点GPUBuffer
 */
export function createIndexBuffer(device: GPUDevice, dataArray: BufferSource, label?: string) {
    if (label == undefined) label = "index buffer:" + dataArray.byteLength;
    const buffer = createBuffer(device, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, dataArray.byteLength, label);
    device.queue.writeBuffer(buffer, 0, dataArray);
    //  new Uint32Array(indexBuffer.getMappedRange()).set(indexdata);
    //  indexBuffer.unmap();
    return buffer;

}
/**
 * 创建顶点GPUBuffer
 */
export function createVerticesBuffer(device: GPUDevice, dataArray: BufferSource, label: string) {

    if (label == undefined) label = "vertex buffer:" + dataArray.byteLength;
    const buffer = createBuffer(device, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, dataArray.byteLength, label);
    device.queue.writeBuffer(buffer, 0, dataArray);
    return buffer;

    // //创建 顶点buffer Create a vertex buffer from the cube data.
    // const verticesBuffer = device.createBuffer({
    //     label: label,
    //     size: VertexArray.byteLength,
    //     usage: GPUBufferUsage.VERTEX,
    //     mappedAtCreation: true,
    // });
    // // if (type == "Float32Array")
    // //     new Float32Array(verticesBuffer.getMappedRange()).set(VertexArray);
    // // else if (type == "Float64Array")
    // //     new Float64Array(verticesBuffer.getMappedRange()).set(VertexArray);
    // // else if (type == "Uint8Array")
    // //     new Uint8Array(verticesBuffer.getMappedRange()).set(VertexArray);
    // // else if (type == "Uint16Array")
    // //     new Uint16Array(verticesBuffer.getMappedRange()).set(VertexArray);
    // // else if (type == "Uint32Array")
    // //     new Uint32Array(verticesBuffer.getMappedRange()).set(VertexArray);
    // device.queue.writeBuffer(verticesBuffer, 0, VertexArray);
    // verticesBuffer.unmap();
    // return verticesBuffer;
}

export function updataOneUniformBuffer(device: GPUDevice, uniformBuffer: GPUBuffer, data: ArrayBuffer) {
    device.queue.writeBuffer(
        uniformBuffer,
        0,
        data,
        // 0,//buffer.byteOffset,
        // data.byteLength
    );
}

export function createUniformGroupsByLayout() { }