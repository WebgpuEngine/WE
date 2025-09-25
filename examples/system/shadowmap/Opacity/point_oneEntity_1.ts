
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { PointLight } from "../../../../src/we/core/light/pointLight";
import { AmbientLight } from "../../../../src/we/core/light/ambientLight";
import { SphereGeometry } from "../../../../src/we/core/geometry/sphereGeometry";
import { PhongMaterial } from "../../../../src/we/core/material/phong/phongMaterial";
import { DirectionalLight } from "../../../../src/we/core/light/DirectionalLight";
import { PlaneGeometry } from "../../../../src/we/core/geometry/planeGeomertry";
import { SpotLight } from "../../../../src/we/core/light/SpotLight";

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
  position: [5, 5, 0],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

/////////////////////////////////////////////////////////////
let ballGeometry = new SphereGeometry({
  radius: 0.1,
  widthSegments: 64,
  heightSegments: 64
});
let lightMaterial = new ColorMaterial({ color: [1, 1, 1, 1] });
let lightRadius = 3.5;
let lightZ = 2.;
let light1Entity1 = new Mesh(
  {
    attributes: {
      geometry: ballGeometry,
    },
    material: lightMaterial,
    position: [1, 1, -1],
    shadow: {
      generate: false,
      accept: false,
    },
    // update: (scope: any) => {
    //   const now = Date.now() / 1000;
    //   let pos = [Math.sin(now) * lightRadius, lightZ, Math.cos(now) * lightRadius];
    //   scope.Position = pos;
    // }
  });
await scene.add(light1Entity1);

let onelight = new PointLight(
  {
    position: [0, 0, 0],
    // position: [1, 1, 1],
    intensity: .50,
    shadow: true,
    // update(scope) {
    //   const now = Date.now() / 1000;
    //   let pos = [Math.sin(now) * lightRadius, lightZ, Math.cos(now) * lightRadius];
    //   scope.Position = pos;
    //   // console.log("light position", pos,"worldPosition",[scope.worldPosition[0],scope.worldPosition[1],scope.worldPosition[2]]);
    // },
  }
);
await light1Entity1.addChild(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.1
  }
)
await scene.add(ambientLight);

///////////////////////////////////////////////////////////////////////
let sphere = new SphereGeometry({
  widthSegments: 128,
  heightSegments: 128,
});


// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });
let phongMaterial = new PhongMaterial({
  color: [0, 0.9, 1, 1],
  roughness: 1,
  metalness: 0.1,
  shininess: 32
});

let inputMeshsphere: IV_MeshEntity = {
  attributes: {
    geometry: sphere,
  },
  material: phongMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let meshSphere = new Mesh(inputMeshsphere);
await scene.add(meshSphere);

let box = new BoxGeometry();
let inputMeshbox: IV_MeshEntity = {
  attributes: {
    geometry: box,
  },
  material: phongMaterial,
  position: [0, 1, -2],
};
let meshBox = new Mesh(inputMeshbox);
await scene.add(meshBox);


///ground
let planeGeometry = new PlaneGeometry({
  width: 20,
  height: 20
});
let groundMaterial = new PhongMaterial({
  color: [1, 1, 1, 1],
  roughness: 1,
  metalness: 0.1,
  shininess: 32
});
let groundMesh = new Mesh({
  attributes: {
    geometry: planeGeometry,
  },
  material: groundMaterial,
  position: [0, -1, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
await scene.add(groundMesh);