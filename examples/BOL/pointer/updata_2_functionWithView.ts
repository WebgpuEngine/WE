
import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../src/we/core/entity/mesh/mesh";
import { I_pointerCreateParams } from "../../../src/we/core/bufferBlock/pointer";
import { E_BufferType } from "../../../src/we/core/bufferBlock/base";

declare global {
  interface Window {
    scene: any
    DC: any
    pointers: any
    pointer1: any
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






window.BPC = scene.BPC;
console.log(scene.BPC);
window.pointers = scene.BPC.pointers;
console.log(scene.BPC.pointers);

let pointer1_params: I_pointerCreateParams = {
  name: "pointer1",
  byteSize: 1024,
  viewType: "u32",
  type: E_BufferType.VS,
}
let pointer1 = scene.BPC.pointers.createPointer(pointer1_params);
window.pointer1 = pointer1;
console.log("create pointer1:", pointer1);

window.pointers.updatePointerData(pointer1, {
  viewType: "u32",
  buffer: {
    data: new Uint32Array([1, 2, 3, 4])
  },
  offsetByteOfWriteToPointer: 4 * 0,//U32类型，每个元素占4个byte节，从指针的第4个byte节开始写入
})
console.log("after update pointer1:", pointer1);


window.pointers.updatePointerData(pointer1, {
  buffer: {
    data: [5, 6, 7, 8]
  },
  offsetByteOfWriteToPointer: 4 * 4,//U32类型，每个元素占4个byte节，从指针的第4个byte节开始写入
})
console.log("after update pointer1:", pointer1);