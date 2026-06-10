# HexPro Mapper
> 六边形风格化你的 GeoJSON 地图

<div align="center">
   <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=000"/>
   <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=fff"/>
   <img src="https://img.shields.io/badge/D3-7-F9A03C?logo=d3dotjs&logoColor=fff"/>
   <img src="https://img.shields.io/badge/Turf.js-7-2F7E3E"/>
</div>

![PREVIEW](/imgs/preview.png)

## 项目功能

- **GeoJSON 六边形化**：将行政区、区域边界等 GeoJSON 数据转换为六边形网格视觉。

   - 支持 <u>dataV</u> 提供的 GeoJSON 文件（`FeatureCollection` 类），默认加载浙江省作为示例
   - 支持将生成的六边形网格导出为 `.geojson` 文件

- **视觉样式控制**：

   - 支持调节 六边形分辨率 + 瓦片间距
   - 支持切换原始边界轮廓显示、修改六边形填充颜色

- **交互式地图**：支持鼠标悬停 + 平移缩放

## 运行说明
> 建议使用 Node.js 18 或更高版本

- 安装依赖

   ```bash
   npm install
   ```

- 启动开发环境

   ```bash
   npm run dev     # 默认在 3000 端口
   ```

- 生产构建

   ```bash
   npm run build   # 输出至 dist/ 目录
   npm run preview # 本地预览构建结果
   ```
