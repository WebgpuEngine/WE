import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { ColorMaterial } from "../../../src/we/core/material/standard/colorMaterial";
import { IV_LinesEntity, Lines } from "../../../src/we/core/entity/mesh/lines";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0.1, 0.91],

};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

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



let colorMaterial = new ColorMaterial({
  color: [1, 0, 0, 1]
});

let position = [
  0.5,
  0.5,
  0.5,
  0.5,
  0.5,
  -0.5,
  0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  -0.5,
  0.5,
  -0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  -0.5,
  -0.5,
  -0.5,
  0.5,
  -0.5,
  0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  0.5,
  0.5,
  0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  0.5,
  -0.5,
  -0.5,
  -0.5,
  0.5,
  -0.5,
  -0.5,
  -0.5,
  0.5,
  0.5,
  0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  0.5,
  0.5,
  -0.5,
  0.5,
  0.5,
  0.5,
  -0.5,
  -0.5,
  0.5,
  -0.5,
  0.5,
  -0.5,
  -0.5,
  -0.5,
  -0.5,
  -0.5
];
let indexes
  = [
    2, 0,
    5, 7,
    0, 5,
    7, 2
  ]

let inputMesh: IV_LinesEntity = {
  attributes: {
    data: {
      vertices: {
        position
      },
      indexes,
      // vertexStepMode: "vertex"
    },
  },
  material: colorMaterial,

}
window.mesh = new Lines(inputMesh);
console.log(window.mesh);
await scene.add(window.mesh);

