
import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { eventOfScene, IV_Scene, userDefineEventCall } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../src/we/core/entity/mesh/mesh";
import { createEmptyGPUBuffer } from "../../../src/we/core/command/baseFunction";
import { Scene } from "../../../src/we/core/scene/scene";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  // reversedZ:true,
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

let radius = 2;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [0, 0, 3],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);




let size = 16*4*1024;//640B
let cpuMemList: ArrayBuffer[] = [];
let gpuMemList: GPUBuffer[] = [];
window.gpuMemList = gpuMemList;
let count = 1000; //3300个640KB的GPUBuffer，约等于2MB
for (let i = 0; i < count; i++) {
  // let gpuMem = createEmptyGPUBuffer(scene.device, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, size, i.toString());
  let gpuMem = createEmptyGPUBuffer(scene.device, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, size, i.toString());
  gpuMemList.push(gpuMem);
}

let writeGPUBuffer = () => {
  let cpuMem = new ArrayBuffer(size);
  // console.log("count",count)
  for (let i = 0; i < count; i++) {
    scene.device.queue.writeBuffer(gpuMemList[i], 0, cpuMem);
  }
}

/**
 * 内核写入
 * 1、32个64KB的GPUBuffer，内核写入GPUBuffer的CPU占有率 6%
 * 2、1000个64KB的GPUBuffer，内核写入GPUBuffer的CPU占有率 60%
 */
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    let timerNow = Date.now();
    let timerLast = timerNow;
    writeGPUBuffer();
    timerNow = Date.now();
    console.log("timer :", timerNow - timerLast);
  },
  name: "",
  state: true,
  event: eventOfScene.onUpdate
}
await scene.addUserDefineEvent(oneCall);