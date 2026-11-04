# Mattebox

给照片加装裱边框的小工具。上传照片 → 选样式 → 导出。全部在本机浏览器里完成，照片不上传。

## 运行

```bash
npm install
npm run dev      # http://localhost:5180
npm run build    # 产出单文件 dist/index.html
npm run check    # 布局 + 绘制自检（不需要浏览器）
npm run test:exif
```

分享链接参数：`?demo=1` 直接载入示例图，`?style=blur` 指定样式（`matte` / `polaroid` / `blur` / `bleed`）。

快捷键：`⌘S` 导出（多张时导出全部），`⌘O` 打开文件，`⌘V` 粘贴图片。

## 全屏预览

点一下预览里的照片就进全屏，按可用空间贴合放大；多张时左右方向键或两侧箭头切换，`Esc` 或点任意处退出。
全屏用的是同一套 `renderFrame`，所以看到的就是导出后的样子（含卡纸暗边、水印、题注）。
背板按 `devicePixelRatio` 绘制，并限制在 4096 物理像素以内，避免在 5K 屏上开一张上万像素的 canvas。

## 批量

- 一次拖入 / 选择多张，或在已有照片上继续追加；底部胶片条可以切换、单张移除。
- **每张照片各自持有一份参数**。调好一张之后点「套用到全部」，其余照片会套用同一套样式，
  但各自的**参数文字和题注会保留**——这两项是内容，不是样式。
- 「导出全部」逐张渲染、逐张下载，不打包。文件名形如 `DSC_4582-matte-2048x1365.jpg`，
  同名时浏览器会自动加 ` (1)`。第一次批量导出时 Chrome 会问一次「允许下载多个文件」，允许后就不再打断。

## 四种样式

| 样式 | 行业叫法 | 说明 |
| --- | --- | --- |
| 卡纸装裱 | Passe-partout（卡纸装裱），白卡纸本身叫 matte（美式）/ mount（英式） | 美术馆挂画的标准做法，窗洞边缘带一层落在照片上的阴影。画幅选「原始」就紧贴照片；选固定比例，照片就浮在卡纸上 |
| 拍立得 | Polaroid frame | 三边细边 + 底部大片留白，没有窗边阴影，可写题注 |
| 模糊氛围 | Blur fill / Blurred backdrop / Ambient background；YouTube 叫 Ambient mode | 同一张图放大模糊铺底，再叠清晰图 |
| 出血满幅 | Bleed（画面顶到纸边，不留白） | 只做裁切与圆角 |

> 「白边留白」曾经是第五个样式，但它和卡纸装裱走的是同一条渲染分支，画幅选「原始」时输出几乎逐像素相同。
> 现在它变成了**卡纸装裱 + 固定画幅**（1:1 / 4:5 / 3:2…），也就是印刷说的白边、UI 说的 inset frame，功能一点没少。

## 水印

上传 Logo 后贴在照片上，九宫格定位（左上 / 上中 / 右上 / 左中 / 居中 / 右中 / 左下 / 下中 / 右下），
尺寸按照片宽度百分比、内边距按照片短边百分比，另有不透明度。建议用透明底 PNG。

## 照片参数

上传 JPEG 时自动解析 APP1 / EXIF，取机身、镜头、焦距（优先 35mm 等效）、光圈、快门、ISO，
拼成一行 `TESTCAM X100 MARK II · XF 23mm F1.4 R · 35mm · f/1.8 · 1/250s · ISO 400` 压在底部留白里。

- 解析器是手写的（`src/exif.ts`），没有引第三方库：只读 JPEG 的 APP1 段和 TIFF IFD0 / ExifIFD 两处。
- PNG、截图、社交软件压过的图通常没有 EXIF，这时输入框留空，可以直接手写。
- 文字颜色跟着卡纸亮度走（深色卡纸自动转浅色字），模糊氛围样式会额外加一点投影保证可读。
- 字号会按可用宽度自动缩，参数再长也不会撑出画布。

## 实现要点

- **布局参考系**：照片长边归一化为 1000 单位，所有边距 / 圆角 / 模糊半径都以这个单位定义，因此预览和导出（1080～4096 px）永远等比一致。
- **两类布局**：画幅选「原始」时贴着照片走（画布 = 照片 + 边距）；选了固定比例、或者样式是模糊 / 出血时，先定画布再把照片 contain / cover 进去。所以「白边留白」不再需要单独一个样式，它只是卡纸 + 固定画幅的组合。
- **窗边阴影**：canvas 没有 inner-shadow，用 `clip(窗口) + evenodd 填一个外环矩形` 的技巧，让外环的阴影落进窗口内侧，模拟卡纸压在照片上的暗边。
- **模糊背景**：`ctx.filter = blur(Npx)` + overscan 放大绘制（`pad = blur × 1.8`），避免模糊产生的透明边露出来；再叠一层可调暗色遮罩。浏览器不支持 `ctx.filter` 时降级为「缩小再放大」的近似模糊。
- **水印**：绘制在照片的圆角裁剪区内，所以贴着边角也不会溢出窗洞；高度超过画面 32% 时按高度反算宽度，避免大 Logo 压死画面。
- **导出**：同一套渲染函数以 `longEdge` 重新计算缩放比，直接画到离屏 canvas，`toBlob` 下载，不依赖截图，所以没有 CSS 缩放糊边的问题。
- **持久化**：参数模板和水印 Logo 存 localStorage（Logo 上传时先按长边 1024 缩图再存，超过 1.5MB 就放弃缓存并提示），照片本身不存。
- **批量下载**：浏览器对连续触发的下载有节流，所以每张之间隔 280ms，避免后半截被静默丢弃；进度直接显示在导出按钮上。

## 体积

`npm run build` 产出 **单文件约 387 KiB / gzip 约 182 KiB / brotli 约 168 KiB**（`vite build` 打印的 `396.54 kB` 是十进制单位，指同一个文件）。构成（1024 进制）：

| 项 | raw | gzip | 说明 |
|---|---|---|---|
| 示例照片（base64） | 131 kB | ~73 kB | WebP q70 @1600px，100,624 字节 → base64 后 ×1.33 |
| React 运行时 | 220 kB | 69 kB | 实测：只 import `react` + `react-dom/client` 的空壳构建就是 219.6 kB |
| 业务代码 | 29 kB | 8 kB | render / exif / storage / 组件全算上 |
| CSS | 12 kB | 3 kB | 无 web font，全靠系统字体 |

几条实测结论：

- **base64 比原始字节大 33%**，但 gzip 能压回来（base64 的可压缩性更高），所以单文件方案在传输上几乎不吃亏；代价是 HTML 无法和图片分开缓存。
- 示例图从 JPEG 换 WebP 后 273 kB → 100 kB，同尺寸同观感。`sips` 不支持 WebP 输出，用 `sharp` 转的（一次性工具，没有进项目依赖）。
- 本地 `npm run build` 能过 ≠ CI 能过：本地有 `node_modules` 顶着，CI 走 `npm ci`，对 lock 完整性是硬校验。
- 剩下最大的一块是 **React 运行时（220 KiB，占 gzip 的 38%）**。业务代码只有 29 KiB，也就是说框架占了代码体积的 88%。若换成 `preact/compat`（alias `react` → `preact/compat`），这块大约能压到 10 KiB 级别，产物 gzip 有望从 182 KiB 降到 120 KiB 上下——代价是换运行时，需要回归一遍交互。

## 部署（GitHub Pages）

产物是**单文件** `dist/index.html`（JS / CSS / 示例图全部内联，0 处 `assets/` 外链），所以扔到任何静态托管的任何子路径都能跑，不需要为项目站点配 `base`。

仓库里已带 `.github/workflows/deploy.yml`，push 到 `main` 就自动构建发布。首次启用只需一次手动操作：

1. 打开仓库 **Settings → Pages**
2. **Build and deployment → Source** 选 **GitHub Actions**（不要选 "Deploy from a branch"）
3. 到 **Actions** 页签手动跑一次 `Deploy to GitHub Pages`，或直接 push 一个提交触发

站点地址：`https://renascence.github.io/mattebox/`

> 依赖锁文件必须是完整的：`npm ci` 会严格比对 `package.json` 与 `package-lock.json`，只要 lock 的 `packages[""]` 里缺了 devDependencies（例如当初用 `--omit=dev` 生成），CI 会在 Install 步骤直接失败。改过依赖后跑一次 `npm install --package-lock-only` 把 lock 补齐，本地用 `npm ci --dry-run` 能验证。

不用 Actions 的手动方案：`npm run build` 后把 `dist/` 推到 `gh-pages` 分支，Pages 的 Source 选该分支的 `/ (root)`。

## 目录

```
.github/workflows/deploy.yml  push main 自动构建并发布到 Pages
check-geom.mjs    布局 + 绘制冒烟自检（npm run check）
scripts/
  test-exif.mjs   现场拼一张带 EXIF 的 JPEG 验证解析
  render-preview.mjs  离屏渲染出 PNG 做肉眼验收（需 npm i @napi-rs/canvas --no-save）
src/
  render.ts       布局计算 + canvas 渲染 + 导出
  exif.ts         JPEG / EXIF 解析与格式化
  storage.ts      水印 Logo 的缩图与 localStorage 缓存
  types.ts        设置项、预设、样式元数据
  demo.ts         载入内置示例照片
  assets/
    sample.webp   示例照片（1600×1066，构建时内联成 base64）
  App.tsx         状态、批量载入、粘贴、导出
  components/
    Stage.tsx     预览画布 / 拖拽区 / 空状态
    Lightbox.tsx  全屏预览（Esc 退出、左右切图）
    Filmstrip.tsx 底部胶片条（带样式的缩略图）
    Panel.tsx     右侧参数面板
    ui.tsx        Slider / Chips / Swatches / Toggle / Thumb / PosGrid
```
