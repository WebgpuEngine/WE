import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { E_InputEvent, E_InputPriority, I_InputRegisterPriorityLayer } from "./base";
import { BaseInputControl } from "./baseInputControl";

export class InputManager extends ECSManager<BaseInputControl> {
    canvas: HTMLCanvasElement;
    /**E_InputControlType
     * 事件存储
     */
    event: Array<{ target: any, type: string, callback: (scope: any) => void, option: any }> = new Array();

    /**
     * 事件注册列表
     * 1、每个事件，都有三个优先级层，分别是broadcastStart, intercept, broadcastEnd
     * 2、事件的发送顺序是：broadcastStart -> intercept -> broadcastEnd
     * 3、event由DOM的EventTarget.addEventListener()触发，多个触发需要在控制器中组合
     */
    registerEventList: {
        [E_InputEvent.keydown]: I_InputRegisterPriorityLayer,
        [E_InputEvent.keyup]: I_InputRegisterPriorityLayer,
        [E_InputEvent.pointerdown]: I_InputRegisterPriorityLayer,
        [E_InputEvent.pointerup]: I_InputRegisterPriorityLayer,
        [E_InputEvent.pointermove]: I_InputRegisterPriorityLayer,
        [E_InputEvent.wheel]: I_InputRegisterPriorityLayer,
        [E_InputEvent.touchstart]: I_InputRegisterPriorityLayer,
        [E_InputEvent.touchend]: I_InputRegisterPriorityLayer,
        [E_InputEvent.touchmove]: I_InputRegisterPriorityLayer,
        [E_InputEvent.click]: I_InputRegisterPriorityLayer,
        [E_InputEvent.dblclick]: I_InputRegisterPriorityLayer,
    } = {
            [E_InputEvent.keydown]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.keyup]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointerdown]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointerup]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointermove]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.wheel]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchstart]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchend]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchmove]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.click]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.dblclick]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
        }


    constructor(scene: Scene) {
        super(scene);
        this.canvas = scene.canvas;
        this.init();
    }
    destroy() {
        for (let i = 0; i < this.event.length; i++) {
            const item = this.event[i];
            if (item.type == "pointerWheel") {
                item.target.removeEventListener(item.type, item.callback, item.option);
            }
            else {
                item.target.removeEventListener(item.type, item.callback);
            }
        }
        this.event = [];
    }
    /**
     * 清理所有控制器的eventValues和自定义数据结构
     */
    clean() {
        for (let perOne of this.list) {
            perOne.clean();
        }
    }
    /**
     * 初始化事件注册
     * 1、keydown事件注册
     * 2、keyup事件注册
     * 3、pointerdown事件注册
     * 4、pointerup事件注册
     * 5、pointermove事件注册
     * 6、wheel事件注册
     * //下面的未实现，基本够用了，延迟到需要的时候再实现
     * 7、touchstart事件注册
     * 8、touchend事件注册
     * 9、touchmove事件注册
     * 10、click事件注册
     * 11、dblclick事件注册
     */
    init() {
        let scope = this;

        // this.canvas.addEventListener('contextmenu', (e) => {
        //     // 1. 阻止默认右键菜单（核心）
        //     e.preventDefault();
        //     // 2. 可选：阻止事件冒泡（避免影响父元素）
        //     e.stopPropagation();
        //     // console.log('Canvas 右键被点击');
        // });


        let keyDown = (event: KeyboardEvent) => { scope.keyDown(scope, event); }                    //keydown事件
        window.addEventListener('keydown', keyDown);                                                //keydown事件注册
        this.event.push({ target: window, type: "keyDown", callback: keyDown, option: undefined }); //keydown事件注册

        let keyUp = (event: KeyboardEvent) => { scope.keyUp(scope, event); }
        window.addEventListener('keyup', keyUp);
        this.event.push({ target: window, type: "keyUp", callback: keyUp, option: undefined });

        let pointerDown = (event: PointerEvent) => { scope.pointerDown(scope, event); }
        this.canvas.addEventListener('pointerdown', (event) => this.pointerDown(this, event));
        this.event.push({ target: this.canvas, type: "pointerDown", callback: pointerDown, option: undefined });


        let pointerUp = (event: PointerEvent) => { scope.pointerUp(scope, event); }
        this.canvas.addEventListener('pointerup', pointerUp);
        this.event.push({ target: this.canvas, type: "pointerUp", callback: pointerUp, option: undefined });

        let pointerMove = (event: PointerEvent) => { scope.pointerMove(scope, event); }
        this.canvas.addEventListener('pointermove', pointerMove);
        this.event.push({ target: this.canvas, type: "pointerMove", callback: pointerMove, option: undefined });
        let whellOption = { passive: false };

        let wheel = (event: WheelEvent) => { scope.wheel(scope, event); }
        this.canvas.addEventListener('wheel', wheel, whellOption);
        this.event.push({ target: this.canvas, type: "wheel", callback: wheel, option: whellOption });

        // this.canvas.addEventListener('touchstart', this.touchStart);
        // this.canvas.addEventListener('touchend', this.touchEnd);
        // this.canvas.addEventListener('touchmove', this.touchMove);
        // this.canvas.addEventListener('click', this.click);
        // this.canvas.addEventListener('dblclick', this.dblclick);

        if (this.scene.disableCanvasContext === true) {
            let stop = (event: Event) => {
                event.preventDefault();
            };
            this.canvas.addEventListener('contextmenu', stop);
            this.event.push({ target: this.canvas, type: "contextmenu", callback: pointerDown, option: undefined });
        }
    }
    /**
     * 注册input事件到ECS对应事件队列
     * @param event 事件类型
     * @param priority 优先级
     * @param control 控制器
     * @returns 是否注册成功
     */
    registerEvent(event: E_InputEvent, priority: E_InputPriority, control: BaseInputControl): boolean {
        if (event == (E_InputEvent.touchstart || E_InputEvent.touchend || E_InputEvent.touchmove || E_InputEvent.click || E_InputEvent.dblclick)) {
            throw new Error("目前未实现事件" + event);
        }
        if (this.registerEventList[event as E_InputEvent][priority]) {
            this.registerEventList[event as E_InputEvent][priority].push(control);
            return true;
        }
        else {
            console.warn("registerEvent error: event or priority not found")
            return false;
        }
    }
    /**
     * 注销input事件到ECS对应事件队列
     * @param event 事件类型
     * @param priority 优先级
     * @param entity 控制器
     */
    removeRegisterEvent(event: E_InputEvent, priority: E_InputPriority, entity: BaseInputControl): void {
        this.registerEventList[event as E_InputEvent][priority].splice(this.registerEventList[event as E_InputEvent][priority].indexOf(entity), 1);
    }
    /**
     * 清理所有控制器的event注册
     */
    cleanRegisterEvent() {
        this.registerEventList = {
            [E_InputEvent.keydown]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.keyup]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointerdown]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointerup]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.pointermove]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.wheel]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchstart]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchend]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.touchmove]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.click]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
            [E_InputEvent.dblclick]: {
                [E_InputPriority.broadcastStart]: [],
                [E_InputPriority.intercept]: [],
                [E_InputPriority.broadcastEnd]: [],
            },
        }
    }
    pickupClick() { }
    pickupMove() { }
    /**
     * 
     * @param clock 
     */
    update(clock: Clock): void {
        this.checkDestroy();
        //最前面
        // this.pickupClick();cleanRegisterEvent() 

    }
    /**
     * 处理键盘事件keyDown
     * 1、由init()注册到window对象
     * 2、调用由window对象触发的事件
     * 3、调用所有注册的键盘事件控制器的keyDown方法
     * @param scope input manager 实例
     * @param event 键盘事件
     */
    keyDown(scope: InputManager, event: KeyboardEvent) {
        for (let i in scope.registerEventList[E_InputEvent.keydown]) {  //遍历keydown的"优先级"层,三层：优先广播，独占，最后广播
            for (let j in scope.registerEventList[E_InputEvent.keydown][i as E_InputPriority]) {//遍历当前优先级内的所有注册的"控制器"。例如：arcball，wasd
                const item = scope.registerEventList[E_InputEvent.keydown][i as E_InputPriority][j];//input 控制器
                let flagStop = item.receiveInput(event, E_InputEvent.keydown);  //调用控制器的keyDown方法，返回是否停止后续处理
                if (j == E_InputPriority.intercept) //独占优先级
                    if (flagStop) { //如果独占优先级的控制器返回true，停止后续处理
                        break;
                    }
            }
        }
        // event.preventDefault();
        // event.stopPropagation();
    }
    keyUp(scope: InputManager, event: KeyboardEvent) {
        for (let i in scope.registerEventList[E_InputEvent.keyup]) {
            for (let j in scope.registerEventList[E_InputEvent.keyup][i as E_InputPriority]) {
                const item = scope.registerEventList[E_InputEvent.keyup][i as E_InputPriority][j];
                let flagStop = item.receiveInput(event, E_InputEvent.keyup);
                if (j == E_InputPriority.intercept)
                    if (flagStop) {
                        break;
                    }
            }
        }
        // event.preventDefault();
        // event.stopPropagation();
    }
    pointerDown(scope: InputManager, event: PointerEvent) {
        for (let i in scope.registerEventList[E_InputEvent.pointerdown]) {
            for (let j in scope.registerEventList[E_InputEvent.pointerdown][i as E_InputPriority]) {
                const item = scope.registerEventList[E_InputEvent.pointerdown][i as E_InputPriority][j];
                let flagStop = item.receiveInput(event, E_InputEvent.pointerdown);
                if (j == E_InputPriority.intercept)
                    if (flagStop) {
                        break;
                    }
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }
    pointerUp(scope: InputManager, event: PointerEvent) {
        for (let i in scope.registerEventList[E_InputEvent.pointerup]) {
            for (let j in scope.registerEventList[E_InputEvent.pointerup][i as E_InputPriority]) {
                const item = scope.registerEventList[E_InputEvent.pointerup][i as E_InputPriority][j];
                let flagStop = item.receiveInput(event, E_InputEvent.pointerup);
                if (j == E_InputPriority.intercept)
                    if (flagStop) {
                        break;
                    }
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }
    pointerMove(scope: InputManager, event: PointerEvent) {
        for (let i in scope.registerEventList[E_InputEvent.pointermove]) {
            for (let j in scope.registerEventList[E_InputEvent.pointermove][i as E_InputPriority]) {
                const item = scope.registerEventList[E_InputEvent.pointermove][i as E_InputPriority][j];
                let flagStop = item.receiveInput(event, E_InputEvent.pointermove);
                if (j == E_InputPriority.intercept)
                    if (flagStop) {
                        break;
                    }
            }
        }
    }
    wheel(scope: InputManager, event: WheelEvent) {
        for (let i in scope.registerEventList[E_InputEvent.wheel]) {
            for (let j in scope.registerEventList[E_InputEvent.wheel][i as E_InputPriority]) {
                const item = scope.registerEventList[E_InputEvent.wheel][i as E_InputPriority][j];
                let flagStop = item.receiveInput(event, E_InputEvent.wheel);
                if (j == E_InputPriority.intercept)
                    if (flagStop) {
                        break;
                    }
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }



}
