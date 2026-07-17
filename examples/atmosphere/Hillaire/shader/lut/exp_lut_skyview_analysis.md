# exp_lut_skyview.wgsl 函数调用关系分析

## 1. 文件概述

`exp_lut_skyview.wgsl` 是天空视图 LUT（Sky View Lookup Table）的完整渲染着色器，用于预计算每个方向的天空散射亮度。该着色器采用 **Compute Shader** 架构，每个线程负责计算 LUT 中的一个像素。

**核心功能**：
- 对每个 LUT 像素计算对应方向的散射亮度（单次散射 + 多重散射）
- 支持自定义阴影（城市建筑物遮挡太阳光）
- 支持双光源（太阳 + 月亮）
- 使用 Ray Marching 进行光线积分

---

## 2. 函数调用流程图

### 2.1 主入口函数调用链

```mermaid
flowchart TD
    A[render_sky_view_lut<br/>入口函数] --> B[compute_world_dir<br/>计算视线方向]
    A --> C[compute_sun_dir<br/>计算太阳方向]
    A --> D[move_to_atmosphere_top<br/>移动相机到大气顶]
    A --> E[integrate_scattered_luminance<br/>积分散射亮度]
    
    D --> F[find_closest_ray_sphere_intersection<br/>光线与球体交点]
    F --> G[solve_quadratic_for_positive_reals<br/>求解二次方程]
    
    E --> H[find_atmosphere_t_max<br/>计算大气边界距离]
    H --> F
    
    E --> I[sample_medium<br/>采样大气介质]
    
    E --> J[transmittance_lut_params_to_uv<br/>透射率LUT参数化]
    
    E --> K[get_multiple_scattering<br/>获取多重散射贡献]
    
    E --> L[compute_planet_shadow<br/>计算行星阴影]
    L --> M[ray_intersects_sphere<br/>判断光线与球体相交]
    M --> N[quadratic_has_positive_real_solutions<br/>判断二次方程有解]
    
    E --> O[get_sample_shadow<br/>获取采样点阴影]
    O --> P[get_shadow<br/>查询阴影贴图]
    
    E --> Q[mie_phase<br/>Mie相位函数]
    Q --> R[hg_draine_phase<br/>HG-Draine相位]
    Q --> S[cornette_shanks_phase<br/>Cornette-Shanks相位]
    
    E --> T[rayleigh_phase<br/>Rayleigh相位函数]
```

### 2.2 核心积分函数调用关系

```mermaid
flowchart TB
    subgraph integrate_scattered_luminance
        A[初始化] --> B[计算大气边界]
        B --> C[确定采样数]
        C --> D[循环光线步进]
        
        D --> E[计算采样位置]
        E --> F[sample_medium<br/>采样介质属性]
        F --> G[计算透射率衰减]
        
        G --> H[计算到太阳的透射率]
        H --> I[transmittance_lut_params_to_uv]
        
        G --> J[计算相位函数值]
        J --> K[mie_phase]
        J --> L[rayleigh_phase]
        
        G --> M[get_multiple_scattering<br/>获取多重散射]
        
        G --> N[compute_planet_shadow<br/>行星阴影]
        
        G --> O[get_sample_shadow<br/>自定义阴影]
        O --> P[get_shadow]
        
        H & J & M & N & O --> Q[累加散射亮度]
        Q --> R{是否还有采样点?}
        R -->|是| D
        R -->|否| S[返回结果]
    end
```

### 2.3 阴影查询流程

```mermaid
flowchart TD
    A[get_sample_shadow] --> B[坐标转换<br/>大气坐标→世界坐标]
    B --> C[get_shadow]
    C --> D{光源索引}
    D -->|0 = 太阳| E[使用 sun_view_projection【0】 ]
    D -->|1 = 月亮| F[使用 sun_view_projection【1】 ]
    
    E --> G[世界坐标→裁剪空间]
    F --> G
    
    G --> H[NDC→纹理UV]
    H --> I{UV在阴影贴图范围内?}
    I -->|是| J[textureSampleCompareLevel<br/>采样shadow_map/shadow_map2]
    I -->|否| K[返回 1.0<br/>完全光照]
    
    J --> L[返回阴影因子]
    K --> L
```

### 2.4 方向参数化流程

```mermaid
flowchart TD
    A[render_sky_view_lut] --> B[pix坐标]
    B --> C[uv = pix / resolution]
    C --> D[compute_world_dir]
    
    D --> E[from_sub_uvs_to_unit<br/>UV坐标归一化]
    E --> F{uv.y < 0.5}
    F -->|是| G[天顶方向区域<br/>cos_view_zenith递减]
    F -->|否| H[地面方向区域<br/>cos_view_zenith递增]
    
    G --> I{USE_UNIFORM_LONGITUDE}
    H --> I
    
    I -->|是| J[均匀经度参数化<br/>azimuth = uv.x * 2π]
    I -->|否| K[余弦参数化<br/>cos_light_view = 2uv.x² - 1]
    
    J --> L[返回方向向量]
    K --> L
```

---

## 3. 函数调用关系表

| 层级 | 函数名 | 调用者 | 被调用 | 功能描述 |
|------|--------|--------|--------|----------|
| **入口** | `render_sky_view_lut` | - | compute_world_dir, compute_sun_dir, move_to_atmosphere_top, integrate_scattered_luminance | 主入口，计算单个LUT像素 |
| **方向计算** | `compute_world_dir` | render_sky_view_lut | from_sub_uvs_to_unit | 将UV转换为3D方向向量 |
| **方向计算** | `compute_sun_dir` | render_sky_view_lut | to_z_up_left_handed | 将太阳方向转换到LUT坐标系 |
| **几何计算** | `move_to_atmosphere_top` | render_sky_view_lut | find_closest_ray_sphere_intersection | 将相机移动到大气顶部 |
| **核心积分** | `integrate_scattered_luminance` | render_sky_view_lut | 多个函数 | 光线步进积分散射亮度 |
| **几何计算** | `find_atmosphere_t_max` | integrate_scattered_luminance | find_closest_ray_sphere_intersection | 计算光线在大气中的最大距离 |
| **几何计算** | `find_closest_ray_sphere_intersection` | find_atmosphere_t_max, move_to_atmosphere_top | solve_quadratic_for_positive_reals | 光线与球体最近交点 |
| **数学工具** | `solve_quadratic_for_positive_reals` | find_closest_ray_sphere_intersection | - | 求解二次方程最小正根 |
| **介质采样** | `sample_medium` | integrate_scattered_luminance | - | 采样大气介质属性 |
| **LUT参数化** | `transmittance_lut_params_to_uv` | integrate_scattered_luminance | - | 透射率LUT坐标转换 |
| **多重散射** | `get_multiple_scattering` | integrate_scattered_luminance | from_unit_to_sub_uvs | 查询多重散射LUT |
| **阴影计算** | `compute_planet_shadow` | integrate_scattered_luminance | ray_intersects_sphere | 计算行星遮挡阴影 |
| **阴影计算** | `ray_intersects_sphere` | compute_planet_shadow | quadratic_has_positive_real_solutions | 判断光线与球体相交 |
| **数学工具** | `quadratic_has_positive_real_solutions` | ray_intersects_sphere | - | 判断二次方程有正根 |
| **阴影查询** | `get_sample_shadow` | integrate_scattered_luminance | get_shadow | 封装阴影查询 |
| **阴影查询** | `get_shadow` | get_sample_shadow | - | 采样自定义阴影贴图 |
| **相位函数** | `mie_phase` | integrate_scattered_luminance | hg_draine_phase, cornette_shanks_phase | Mie散射相位函数 |
| **相位函数** | `rayleigh_phase` | integrate_scattered_luminance | - | Rayleigh散射相位函数 |

---

## 4. 数据流分析

### 4.1 输入数据流向

```mermaid
flowchart LR
    subgraph 绑定组0
        A[atmosphere_buffer] -->|大气参数| B[render_sky_view_lut]
        C[config_buffer] -->|渲染配置| B
        D[lut_sampler] -->|采样器| E[integrate_scattered_luminance]
        F[transmittance_lut] -->|透射率| E
        G[multi_scattering_lut] -->|多重散射| E
    end
    
    subgraph 绑定组1
        H[sun_view_projection] -->|光源投影| I[get_shadow]
        J[shadow_sampler] -->|比较采样器| I
        K[shadow_map] -->|太阳阴影| I
        L[shadow_map2] -->|月亮阴影| I
    end
    
    B -->|坐标| M[compute_world_dir]
    B -->|方向| N[compute_sun_dir]
    B -->|位置| O[move_to_atmosphere_top]
    B -->|参数| E
```

### 4.2 输出数据流向

```mermaid
flowchart LR
    A[integrate_scattered_luminance] -->|luminance, transmittance| B[render_sky_view_lut]
    B -->|RGB=散射亮度<br/>Alpha=1-透射率| C[sky_view_lut]
    
    style C fill:#90EE90,stroke:#333,stroke-width:2px
```

---

## 5. 关键算法流程

### 5.1 光线步进积分算法

```mermaid
flowchart TD
    A[开始积分] --> B[计算t_max<br/>光线与大气边界交点]
    B --> C[确定采样数<br/>根据距离动态调整]
    C --> D{采样循环}
    
    D --> E[计算采样位置t]
    E --> F[非线性分布<br/>近区域更密集]
    F --> G[sample_pos = world_pos + t * world_dir]
    
    G --> H[sample_medium<br/>获取散射/消光系数]
    H --> I[计算局部透射率<br/>exp（ -extinction * dt ）]
    
    I --> J[查询透射率LUT<br/>采样点→光源]
    I --> K[计算相位函数值]
    I --> L[查询多重散射LUT]
    I --> M[计算阴影因子]
    
    J & K & L & M --> N[计算散射亮度]
    N --> O[累加积分结果]
    O --> P[更新累计透射率]
    P --> D
    
    D -->|结束| Q[返回散射亮度和透射率]
```

### 5.2 非线性采样分布

```mermaid
flowchart TD
    A[s = 当前采样索引] --> B[t0 = s / sample_count]
    A --> C[t1 = （s+1） / sample_count]
    
    B --> D[t0 = t0² * t_max]
    C --> E[t1 = t1² * t_max]
    
    D & E --> F[dt = t1 - t0]
    F --> G[t = t0 + dt * 0.3]
    
    style G fill:#ff,stroke:#333,stroke-width:2px
```

> **设计意图**：使用二次函数 `t²` 映射采样位置，使得靠近观察者的区域采样更密集，提高近处散射计算的精度。`sample_segment_t = 0.3` 表示采样点位于分段的 30% 位置，而非中心，这是为了减少数值误差。

---

## 6. 总结

### 函数调用层次结构

```
render_sky_view_lut (入口)
├── compute_world_dir (方向参数化)
│   └── from_sub_uvs_to_unit
├── compute_sun_dir (方向转换)
│   └── to_z_up_left_handed
├── move_to_atmosphere_top (几何调整)
│   └── find_closest_ray_sphere_intersection
│       └── solve_quadratic_for_positive_reals
└── integrate_scattered_luminance (核心积分)
    ├── find_atmosphere_t_max
    │   └── find_closest_ray_sphere_intersection
    ├── sample_medium
    ├── transmittance_lut_params_to_uv
    ├── get_multiple_scattering
    │   └── from_unit_to_sub_uvs
    ├── compute_planet_shadow
    │   └── ray_intersects_sphere
    │       └── quadratic_has_positive_real_solutions
    ├── get_sample_shadow
    │   └── get_shadow
    ├── mie_phase
    │   ├── hg_draine_phase (可选)
    │   └── cornette_shanks_phase (可选)
    └── rayleigh_phase
```

### 关键设计特点

1. **并行架构**：每个线程独立计算一个 LUT 像素，无数据依赖
2. **非线性采样**：使用二次分布提高近处采样密度
3. **LUT 加速**：预计算透射率和多重散射，避免实时积分
4. **可选功能**：阴影贴图、月亮光源均通过 override 参数控制
5. **坐标系统抽象**：支持多种坐标系配置（Y/Z 轴向上、左右手坐标系）
