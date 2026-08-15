import { vec3 } from "wgpu-matrix";
import { PerspectiveCamera } from "../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../src/we/core/scene/base";
import { initScene } from "../../../src/we/core/scene/fn";
import { NodeObject } from "../../../src/we/core/organization/nodeObject";
import { IV_MeshEntity, Mesh } from "../../../src/we/core/entity/mesh/mesh";
import { BoxGeometry } from "../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../src/we/core/material/standard/colorMaterial";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 0.91],
  reversedZ: true,
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

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
await scene.add(mesh);

let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.1,
  far: 100,
  position: [0, 0, 0.01],
  lookAt: [0, 0, 0],
});
// await scene.add(camera);

let radius = 2;
let Y = 0;
let node_1 = new NodeObject({
  position: [1, 1, 1],
  update: (scope: any) => {
    const now = Date.now() / 1000;
    scope.Position = vec3.fromValues(Math.sin(now) * radius, Y, Math.cos(now) * radius);
  },
});
// node_1.Position = vec3.create(1, 1, 1);
// node_1.Rotate={
//   axis:vec3.create(0,1,0),
//   angleInRadians:Math.PI/1.3,
// }
// node_1.updateMatrixWorld();
// console.log("node_1 world position:", vec3.transformMat4(node_1._position, node_1.matrixWorld), node_1._position, node_1.matrixWorld)
await scene.add(node_1)
await node_1.addChild(camera);


