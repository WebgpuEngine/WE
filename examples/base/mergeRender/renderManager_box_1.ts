
import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../src/we/core/entity/mesh/mesh";
import { Scene } from "../../../src/we/core/scene/scene";
import { DrawCommandGenerator, IV_DrawCommandGenerator } from "../../../src/we/core/command/DrawCommandGenerator";

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


let scene = new Scene(input);
await scene._init();
let inputDC: IV_DrawCommandGenerator = {
  scene: scene,
  parent: scene
}
let DCManager = new DrawCommandGenerator(inputDC);
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
window.mesh = mesh;
window.instanceMash = await scene.add(mesh);

scene.run();