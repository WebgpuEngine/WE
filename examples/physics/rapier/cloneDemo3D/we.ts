import { AmbientLight } from "../../../../src/we/core/light/ambientLight";
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { DirectionalLight } from "../../../../src/we/core/light/DirectionalLight";
import { E_ToneMappingType, IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";

export async function initWe() {
    let input: IV_Scene = {
        canvas: "render",
        backgroudColor: [0, 0., 0., 0.],
        reversedZ: true,
        // AA:{
        //     MSAA: {
        //         enable: true,
        //     }
        // },
        // toneMapping: E_ToneMappingType.linear,
        toneMapping: E_ToneMappingType.linearToSRGB,
        renderMode: "deferRender"
    };
    let scene = await initScene({ initConfig: input, });
    window.scene = scene;

    let camera = new PerspectiveCamera({
        fov: (Math.PI) / 4,
        aspect: scene.aspect,
        near: 0.1,
        far: 300,
        position: [3, 3, 3],
        lookAt: [0, 0, 0],
        controlType: "orbit",
    });
    await scene.add(camera);

    let onelight = new DirectionalLight({
        color: [1, 1, 1],
        direction: [0, 1, 1],
        intensity: 0.8,
        // shadow: true,
    });
    await scene.add(onelight);

    // let onelight2 = new DirectionalLight({
    //     color: [1, 1, 1],
    //     direction: [0, -1, 0],
    //     intensity: 0.83,
    //     // shadow: true,
    // });
    // await scene.add(onelight2);

    let ambientLight = new AmbientLight(
        {
            color: [1, 1, 1],
            intensity: 0.05
        }
    )
    await scene.add(ambientLight);
    return scene;
}