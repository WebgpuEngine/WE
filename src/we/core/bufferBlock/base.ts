/** BOL 状态
 * 1、open：表示可分配内存块
 * 2、close：表示不可分配内存块。
 * 3、released：已释放，不可写。
 * 4、rebuilding：重建中，不可写。
 */
export enum E_BOLState {
    open,
    close,
    released,
    rebuilding,
}

/** buffer 类型
 * 1、staticVS：静态VS，必须有初始化数据。
 * 2、VS：动态VS，必须有初始化数据。
 * 3、uniform：统一变量，必须有初始化数据。
 * 4、storage：存储变量，必须有初始化数据。
 */
export enum E_BOLBufferType {
    staticVS = "staticVS",
    VS = "VS",
    uniform = "uniform",
    storage = "storage",
}
/** BOL Buffer 大小定义接口 */
export interface I_BolSize {
    [E_BOLBufferType.staticVS]: number;
    [E_BOLBufferType.VS]: number;
    [E_BOLBufferType.uniform]: number;
    [E_BOLBufferType.storage]: number;
}
/** BOL Buffer 默认大小 */
export const V_BolBufferSize: I_BolSize = {
    [E_BOLBufferType.staticVS]: 1024 * 1024 * 20,//20MB
    [E_BOLBufferType.VS]: 1024 * 1024 * 10,//10MB
    [E_BOLBufferType.uniform]: 1024 * 1024 * 1,//1MB
    [E_BOLBufferType.storage]: 1024 * 1024 * 10,//10MB
};


/** BOL 重建百分比定义接口 */
export interface I_BolRebulidPercent {
    /** 静态VS，阈值：10M */
    // staticVS: number,
    /** 动态VS重建百分比，阈值：0.30 */
    VS: number,
    /** 统一重建百分比，阈值：0.3 */
    uniform: number,
    /** 存储重建百分比，阈值：0.3 */
    storage: number,
}


/** BOL合并更新间距阈值定义接口 */
export interface I_BolStrideSizeOfUpdate {
    /** 静态VS，阈值：10M */
    // staticVS?: number,
    /** 动态VS，阈值：64K*4 */
    VS: number,
    /** 统一变量，阈值：1K */
    uniform: number,
    /** 存储变量，阈值：64K */
    storage: number,
}

/** BOL 合并更新间距阈值
 * 1、默认64K
 * 2、合并更新间距更新。
 */
export const V_BolStrideSizeOfUpdate: I_BolStrideSizeOfUpdate = {
    /** 这个是不更新的*/
    // staticVS: 10 * 1024 * 1024,
    /** 动态VS，阈值：64K*4 */
    VS: 1 * 1024,
    /** 统一变量，阈值：1K */
    uniform: 1 * 1024,
    /** 存储变量，阈值：64K */
    storage: 1 * 16 * 1024,
}

