import { initSceneConfig } from "./base";
import { Scene } from "./scene";

export async function initScene(config: initSceneConfig) {
    let initValues = config.initConfig;
    if (config.loadConfig) {
        initValues.backgroudColor = config.loadConfig.weRender.backgroudColor;
        if (config.loadConfig.weRender.AA == "MSAA" || config.loadConfig.weRender.AA == "FXAA" || config.loadConfig.weRender.AA == "TAA") {
            initValues.AA = { type: config.loadConfig.weRender.AA };
        }
        initValues.premultipliedAlpha = config.loadConfig.surface.premultipliedAlpha;
        initValues.surface = config.loadConfig.surface;


    }
    let scene = new Scene(initValues);
    await scene.init();
    if (config.loadConfig) {
        scene.load(config.loadConfig);
    }
    if (config.runImmediately || config.loadConfig == undefined) {
        scene.run();
    }
    return scene;
}

