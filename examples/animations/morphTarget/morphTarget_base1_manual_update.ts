
import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../src/we/core/entity/mesh/mesh";
import { NodeObject } from "../../../src/we/core/organization/root";
import { Mat4, mat4, vec3 } from "wgpu-matrix";
import { weVec4 } from "../../../src/we/core/base/coreDefine";
import { IV_LinesEntity, Lines } from "../../../src/we/core/entity/mesh/lines";
import { E_AnimationPlayType, E_AnimationTargetType, E_AnimationType, E_InterpolationModes, I_AnimationSampler } from "../../../src/we/core/animation/base";
import { VertexColorMaterial } from "../../../src/we/core/material/standard/vertexColorMaterial";
import { Interpolator, IV_Interpolator } from "../../../src/we/core/animation/interpolator";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0.1, 0.1, 0.1, 1.],
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
  position: [0.5, 0, 4],
  lookAt: [0.5, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);




let colorMaterial = new VertexColorMaterial();
// let colorMaterial = new ColorMaterial({
//   color: [1, 1, 1, 1]
// });

/////////////////////////////////////////////////////////////
let position = [
  0, 0, 0,
  1, 0, 0,
  0.5, 0.5, 0,
];
let position_1 = [
  0, 0, 0,
  0, 0, 0,
  -1, 1, 0];
let position_2 = [
  0, 0, 0,
  0, 0, 0,
  1, 1, 0];

let indices = [0, 1, 1, 2, 2, 0];
let timer = [0, 1, 2, 3, 4];
let weights = [
  0, 0,
  0, 1,
  1, 1,
  1, 0,
  0, 0
];
let inputMesh: IV_LinesEntity = {
  attributes: {
    data: {
      vertices: {
        position,
        position_1,
        position_2,
      },
      indices: indices,
      // vertexStepMode: "vertex"
    },
  },
  material: colorMaterial,

}
let lines = new Lines(inputMesh);



let MorphtTargetCount = 2;
lines.MorphtTargetCount = MorphtTargetCount;
lines._animationType.add(E_AnimationType.morphTarget);

let morphTargetArray = new ArrayBuffer(4 * 4);          //4个f32 ，默认的morphTarget 数量=4
let weightsFloat32Array = new Float32Array(morphTargetArray);

let sampler: I_AnimationSampler = {
  target: E_AnimationTargetType.weights,
  interpolation: E_InterpolationModes.linear,
  frames: timer,
  values: weights,
  targetStride: 2
}
let interpolationMorphTarget = new Interpolator({
  sampler,
})

let linesEntity = await scene.add(
  {
    entity: lines,
    update: function (scope: NodeObject) {
      let clock = scene.clock;
      interpolationMorphTarget.update(clock);
      weightsFloat32Array.set(interpolationMorphTarget.output);
      // console.log(interpolationMorphTarget.output);
    }
  }
);
interpolationMorphTarget.play(
  {
    mode:
    {
      type: E_AnimationPlayType.loop
    }
  }
);
linesEntity.MorphTarget = morphTargetArray;

window.mesh = linesEntity;

