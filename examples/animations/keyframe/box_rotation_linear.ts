
import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../src/we/core/entity/mesh/mesh";
import { IV_AnimationValue } from "../../../src/we/core/animation/BaseAnimation";
import { E_AnimationTargetType, E_InterpolationModes, I_AnimationSampler } from "../../../src/we/core/animation/base";
import { KeyFrameAnimation } from "../../../src/we/core/animation/keyFrame";

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
let meshEntity = await scene.add({
  entity: mesh,
  position: [0.5, 0, 0],
  scale: [2, 2, 2],
});


let sampler: I_AnimationSampler = {
  interpolation: E_InterpolationModes.linear,
  frames: [0, 1, 2, 3, 4],
  values: [
    0, 0, 1, 0 / 180 * Math.PI,
    0, 0, 1, 90 / 180 * Math.PI,
    0, 0, 1, 180 / 180 * Math.PI,
    0, 0, 1, 270 / 180 * Math.PI,
    0, 0, 1, 360 / 180 * Math.PI,

  ],
  target: E_AnimationTargetType.rotation,

  targetStride: 3
}
let aniValue: IV_AnimationValue = {
  parent: meshEntity,
  sampler: sampler,
}

let keyFrame: KeyFrameAnimation = new KeyFrameAnimation(aniValue);
window.keyFrame = keyFrame;

keyFrame.play({speed:2,mode:{type:"count",count:1}})