/** buffer 类型
 * 1、staticVS：静态VS，必须有初始化数据。
 * 2、VS：动态VS，必须有初始化数据。
 * 3、uniform：统一变量，必须有初始化数据。
 * 4、storage：存储变量，必须有初始化数据。
 */
export enum E_BufferType {
    staticVS = "staticVS",
    VS = "VS",
    uniform = "uniform",
    storage = "storage",
}

/** BOL 合并更新间距阈值
 * 1、默认64K
 * 2、合并更新间距阈值，用于判断是否需要合并更新。
 */
export const V_BolStrideSizeOfUpdate = {
    /** 这个是不更新的*/
    staticVs: 10 * 1024 * 1024,
    /** 动态VS，阈值：64K*4 */
    VS: 4 * 64 * 1024,
    /** 统一变量，阈值：64K */
    uniform: 64 * 1024,
    /** 存储变量，阈值：640K */
    storage: 10 * 64 * 1024,
}

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
