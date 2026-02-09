
import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../src/we/core/entity/mesh/mesh";
import { IV_AnimationValue } from "../../../src/we/core/animation/BaseAnimation";
import { E_AnimationTargetType, E_InterpolationModes, I_AnimationSampler } from "../../../src/we/core/animation/base";
import { KeyFrameAnimation } from "../../../src/we/core/animation/keyFrame";
import { NodeObject } from "../../../src/we/core/organization/root";
import { mat4, vec3 } from "wgpu-matrix";
import { weVec4 } from "../../../src/we/core/base/coreDefine";

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
  position: [0, 0, 10],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);





let boxGeometry = new BoxGeometry();

let colorMaterial = new ColorMaterial({
  color: [0, 0.1, 0.2, 1]
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: boxGeometry,
  },
  material: colorMaterial,
  wireFrame: {
    color: [1, 1, 1, 1],
    enable: true,
    // wireFrameOnly: true,
  }
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
let posMat = mat4.translation(vec3.fromValues(-0.5, 0, 0));
let posMatInv = mat4.invert(posMat);
console.log(posMat, posMatInv);

await scene.add(mesh)

let meshEntity = await scene.add({
  entity: mesh,
  position: [1.5, 0, 0],
  // scale: [2, 2, 2],
  updateAtEnd: (scopy: NodeObject) => {
    // scopy.matrixWorld = mat4.multiply(scopy.matrixWorld, posMat);
    const now = Date.now() / 500;
    let rotate: weVec4 = [0, 0, 1, (Math.sin(now) + 1) * Math.PI];
    mat4.axisRotate(scopy.matrixWorld, vec3.fromValues(rotate[0], rotate[1], rotate[2]), rotate[3], scopy.matrixWorld);
    // scopy.matrixWorld = mat4.multiply(scopy.matrixWorld, posMatInv);
  }
});
window.meshEntity = meshEntity;
