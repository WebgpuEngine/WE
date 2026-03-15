import { AmbientLight } from "../../../../src/we/core/light/ambientLight";
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { DirectionalLight } from "../../../../src/we/core/light/DirectionalLight";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";

export async function initWe() {
    let input: IV_Scene = {
        canvas: "render",
        backgroudColor: [0, 0., 0., 0.],
        reversedZ:true,
        // AA:{
        //     MSAA: {
        //         enable: true,
        //     }
        // }
        // toneMapping:"linear"
        deferRender:"color"
    };
    let scene = await initScene({ initConfig: input, });
    window.scene = scene;

    let camera = new PerspectiveCamera({
        fov: (2 * Math.PI) / 5,
        aspect: scene.aspect,
        near: 0.01,
        far: 100,
        position: [3, 3, 3],
        lookAt: [0, 0, 0],
        controlType: "orbit",
    });
    await scene.add(camera);

    let onelight = new DirectionalLight({
        color: [1, 1, 1],
        direction: [0, 1, 1],
        intensity: 1,
        shadow: true,
    });
    await scene.add(onelight);

    let ambientLight = new AmbientLight(
        {
            color: [1, 1, 1],
            intensity: 0.025
        }
    )
    await scene.add(ambientLight);
    return scene;
}