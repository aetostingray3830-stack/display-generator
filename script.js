/* ===== Theme & Accent ===== */
const root = document.documentElement;
document.getElementById("themeBtn").onclick = () => {
  const t = root.getAttribute("data-theme") === "light" ? "dark" : "light";
  root.setAttribute("data-theme", t);
};
document.querySelectorAll(".swatch").forEach((s) => {
  s.onclick = () => root.style.setProperty("--accent", s.dataset.ac);
});

/* ===== Stage & Layers ===== */
let stageW = 1600,
  stageH = 1200;
const stage = new Konva.Stage({
  container: "stage",
  width: stageW,
  height: stageH,
});
const bgLayer = new Konva.Layer();
const mainLayer = new Konva.Layer();
stage.add(bgLayer);
stage.add(mainLayer);

const tr = new Konva.Transformer({
  rotateEnabled: true,
  enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"],
});
mainLayer.add(tr);

let selectedNode = null;

/* ===== レイヤー管理 ===== */
const layerListEl = document.getElementById("layerList");
let counters = { text: 0, image: 0, radar: 0 };

function nodeType(n) {
  if (n instanceof Konva.Text) return "text";
  if (n instanceof Konva.Image && n._radarConfig) return "radar";
  if (n instanceof Konva.Image) return "image";
  return "node";
}
function ensureNodeName(n) {
  if (!n._prettyName) {
    const t = nodeType(n);
    counters[t] = (counters[t] || 0) + 1;
    const base =
      t === "text"
        ? "Text"
        : t === "image"
        ? "Image"
        : t === "radar"
        ? "Radar"
        : "Node";
    n._prettyName = `${base}_${counters[t]}`;
  }
  return n._prettyName;
}
function getDrawNodes() {
  return mainLayer.getChildren((n) => n !== tr);
}
function getDisplayOrderTopToBottom() {
  const arr = getDrawNodes()
    .slice()
    .sort((a, b) => a.zIndex() - b.zIndex());
  return arr.reverse();
}
function updateLayerList() {
  if (!layerListEl) return;
  const nodes = getDisplayOrderTopToBottom();
  layerListEl.innerHTML = "";
  nodes.forEach((n, idx) => {
    ensureNodeName(n);
    const li = document.createElement("li");
    li.className = "layer-item";
    li.draggable = true;
    li.dataset.uid = n._id;
    li.dataset.index = String(idx);
    li.innerHTML = `
      <button class="handle" title="ドラッグで並べ替え">≡</button>
      <button class="eye" title="表示/非表示" aria-pressed="${
        n.visible() ? "true" : "false"
      }">${n.visible() ? "👁" : "🙈"}</button>
      <span class="label">${ensureNodeName(n)}</span>
      <span class="meta">${nodeType(n)}</span>
      <button class="del" title="削除">🗑</button>
    `;
    if (!n.visible()) li.classList.add("is-hidden");
    if (selectedNode === n) li.classList.add("is-active");

    li.addEventListener("click", (e) => {
      if (
        e.target.closest(".eye") ||
        e.target.closest(".del") ||
        e.target.closest(".handle")
      )
        return;
      selectNode(n);
      highlightActiveItem();
      updateDatasetList();
    });
    li.querySelector(".eye").addEventListener("click", (e) => {
      e.stopPropagation();
      n.visible(!n.visible());
      e.currentTarget.textContent = n.visible() ? "👁" : "🙈";
      li.classList.toggle("is-hidden", !n.visible());
      mainLayer.draw();
    });
    li.querySelector(".del").addEventListener("click", (e) => {
      e.stopPropagation();
      n.destroy();
      if (selectedNode === n) selectNode(null);
      tr.moveToTop();
      mainLayer.draw();
      updateLayerList();
      updateDatasetList();
    });

    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", li.dataset.index);
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));
    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      li.classList.add("dragover");
    });
    li.addEventListener("dragleave", () => li.classList.remove("dragover"));
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("dragover");
      const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
      const to = parseInt(li.dataset.index, 10);
      if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
      const disp = getDisplayOrderTopToBottom();
      const moved = disp.splice(from, 1)[0];
      disp.splice(to, 0, moved);
      const bottomToTop = disp.slice().reverse();
      bottomToTop.forEach((node, i) => node.zIndex(i));
      tr.moveToTop();
      mainLayer.draw();
      updateLayerList();
    });

    layerListEl.appendChild(li);
  });
}
function highlightActiveItem() {
  if (!layerListEl) return;
  layerListEl
    .querySelectorAll(".layer-item")
    .forEach((li) => li.classList.remove("is-active"));
  if (selectedNode) {
    const active = layerListEl.querySelector(
      `.layer-item[data-uid="${selectedNode._id}"]`
    );
    if (active) active.classList.add("is-active");
  }
}

/* ===== 画像コントロール ===== */
function setImageControlsEnabled(enable, opacityValue = null) {
  const op = document.getElementById("imgOpacity");
  const opVal = document.getElementById("imgOpacityVal");
  const delBtn = document.getElementById("btnDelImage");
  if (!op || !opVal || !delBtn) return;
  op.disabled = !enable;
  delBtn.disabled = !enable;
  if (opacityValue != null) {
    op.value = opacityValue;
    opVal.textContent = Number(opacityValue).toFixed(2);
  }
}

/* ===== 選択処理 ===== */
function selectNode(node) {
  selectedNode = node;
  tr.nodes(node ? [node] : []);
  setImageControlsEnabled(
    !!(node && node instanceof Konva.Image),
    node?.opacity?.()
  );
  mainLayer.draw();
  highlightActiveItem();
  updateDatasetList();
}
stage.on("click tap", (e) => {
  if (e.target === stage) selectNode(null);
  else if (e.target.getParent()?.className !== "Transformer")
    selectNode(e.target);
});

/* ===== 背景 ===== */
let bgImageNode = null;
function resizeStage() {
  stageW = +cvW.value || 1600;
  stageH = +cvH.value || 1200;
  stage.size({ width: stageW, height: stageH });
  fitBackground();
  stage.draw();
}
function setBackgroundImage(url) {
  const img = new Image();
  img.onload = () => {
    if (!bgImageNode) {
      bgImageNode = new Konva.Image({
        image: img,
        x: 0,
        y: 0,
        listening: false,
      });
      bgLayer.add(bgImageNode);
    } else bgImageNode.image(img);
    fitBackground();
    bgLayer.draw();
  };
  img.src = url;
}
function fitBackground() {
  if (!bgImageNode || !bgImageNode.image()) return;
  const mode = bgFit.value,
    iw = bgImageNode.image().width,
    ih = bgImageNode.image().height;
  const sw = stage.width(),
    sh = stage.height(),
    ir = iw / ih,
    sr = sw / sh;
  const scale =
    mode === "cover"
      ? ir > sr
        ? sh / ih
        : sw / iw
      : ir > sr
      ? sw / iw
      : sh / ih;
  const w = iw * scale,
    h = ih * scale,
    x = (sw - w) / 2,
    y = (sh - h) / 2;
  bgImageNode.setAttrs({ x, y, width: w, height: h });
}
applyCanvas.onclick = resizeStage;
bgFile.onchange = (e) => {
  const f = e.target.files?.[0];
  if (f) {
    const r = new FileReader();
    r.onload = () => setBackgroundImage(r.result);
    r.readAsDataURL(f);
  }
};
clearBg.onclick = () => {
  if (bgImageNode) {
    bgImageNode.destroy();
    bgImageNode = null;
    bgLayer.draw();
  }
};

/* ===== 画像追加・不透明度・削除 ===== */
function addImageFromFile(file) {
  const r = new FileReader();
  r.onload = () => addImageFromURL(r.result);
  r.readAsDataURL(file);
}
function addImageFromURL(url) {
  const img = new Image();
  img.onload = () => {
    const node = new Konva.Image({
      image: img,
      x: 100,
      y: 100,
      draggable: true,
    });
    node.on("transformend dragend", () => mainLayer.batchDraw());
    ensureNodeName(node);
    mainLayer.add(node);
    selectNode(node);
    setImageControlsEnabled(true, 1);
    mainLayer.draw();
    updateLayerList();
  };
  img.src = url;
}
addImg.onclick = () => {
  const f = imgFile.files?.[0];
  if (f) addImageFromFile(f);
};
imgOpacity.addEventListener("input", (e) => {
  const v = parseFloat(e.target.value);
  imgOpacityVal.textContent = v.toFixed(2);
  if (selectedNode && selectedNode instanceof Konva.Image) {
    selectedNode.opacity(v);
    mainLayer.batchDraw();
  }
});
btnDelImage.onclick = () => {
  if (selectedNode && selectedNode instanceof Konva.Image) {
    selectedNode.destroy();
    selectNode(null);
    mainLayer.draw();
    updateLayerList();
  }
};
window.addEventListener("keydown", (ev) => {
  if ((ev.key === "Delete" || ev.key === "Backspace") && selectedNode) {
    selectedNode.destroy();
    selectNode(null);
    mainLayer.draw();
    updateLayerList();
  }
});

/* ===== テキスト ===== */
function addTextNode(o) {
  const t = new Konva.Text({
    text: (o.text || "").replace(/\\n/g, "\n"),
    x: 120,
    y: 120,
    draggable: true,
    fontSize: +o.size || 64,
    fill: o.fill || "#111",
    stroke: o.stroke || "#fff",
    strokeWidth: +o.strokeW || 2,
    lineHeight: +o.lineH || 1.2,
    fontStyle: o.weight || "normal",
    fontFamily: o.font || "Inter",
  });
  t.on("transformend dragend", () => mainLayer.batchDraw());
  ensureNodeName(t);
  mainLayer.add(t);
  selectNode(t);
  mainLayer.draw();
  updateLayerList();
}
addText.onclick = () =>
  addTextNode({
    text: txtContent.value,
    size: txtSize.value,
    fill: txtColor.value,
    stroke: txtStrokeColor.value,
    strokeW: txtStrokeW.value,
    lineH: txtLineH.value,
    weight: txtWeight.value,
    font: txtFont.value,
  });
updateText.onclick = () => {
  if (!selectedNode || !(selectedNode instanceof Konva.Text))
    return alert("テキストを選択してください");
  selectedNode.setAttrs({
    text: txtContent.value.replace(/\\n/g, "\n"),
    fontSize: +txtSize.value || 64,
    lineHeight: +txtLineH.value || 1.2,
    fill: txtColor.value,
    stroke: txtStrokeColor.value,
    strokeWidth: +txtStrokeW.value || 2,
    fontStyle: txtWeight.value,
    fontFamily: txtFont.value,
  });
  mainLayer.draw();
  updateLayerList();
};

/* ===== Radar Chart ===== */
function parseLabels(text) {
  return (text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
function parseValues(text) {
  return (text || "").split(",").map((s) => Number(s.trim()) || 0);
}
function hexToRGBA(hex, a = 1) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = [...hex].map((x) => x + x).join("");
  const r = parseInt(hex.slice(0, 2), 16),
    g = parseInt(hex.slice(2, 4), 16),
    b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function buildDataset(name, values, lineHex, fillHex, alpha, dots) {
  return {
    label: name || "データ",
    data: values,
    borderColor: hexToRGBA(lineHex, 1),
    backgroundColor: hexToRGBA(fillHex, +alpha || 0.25),
    borderWidth: 4,
    pointRadius: String(dots) === "1" ? 3 : 0,
    pointHoverRadius: 6,
    fill: true,
    spanGaps: true,
    _visible: true,
  };
}
function makeRadarCanvas(cfg) {
  // ---- バリデーション & 正規化 ----
  const labels = Array.isArray(cfg?.labels)
    ? cfg.labels.map((s) => String(s ?? "").trim())
    : [];
  const safeLabels = labels.filter(Boolean);
  // ラベルが3未満ならダミーを補う（Chartがクラッシュしないように）
  while (safeLabels.length < 3) safeLabels.push(`L${safeLabels.length + 1}`);

  const rawDatasets = Array.isArray(cfg?.datasets) ? cfg.datasets : [];
  // _visible !== false のみ使い、ラベル数に合わせて data を丸める
  const dsForChart = rawDatasets
    .filter((ds) => ds && ds._visible !== false)
    .map((ds) => {
      const data = Array.isArray(ds.data)
        ? ds.data.slice(0, safeLabels.length)
        : [];
      while (data.length < safeLabels.length) data.push(0);
      return {
        label: ds.label ?? "Dataset",
        data,
        borderColor: ds.borderColor ?? "rgba(255,99,132,1)",
        backgroundColor: ds.backgroundColor ?? "rgba(255,99,132,0.25)",
        borderWidth: Number.isFinite(ds.borderWidth) ? ds.borderWidth : 4,
        pointRadius: Number.isFinite(ds.pointRadius) ? ds.pointRadius : 3,
        pointHoverRadius: Number.isFinite(ds.pointHoverRadius)
          ? ds.pointHoverRadius
          : 6,
        fill: ds.fill !== false,
        spanGaps: !!ds.spanGaps,
      };
    });

  // 1本も無ければダミーを1本
  if (dsForChart.length === 0) {
    dsForChart.push({
      label: "Dataset",
      data: Array(safeLabels.length).fill(0),
      borderColor: "rgba(99,102,241,1)",
      backgroundColor: "rgba(99,102,241,0.25)",
      borderWidth: 4,
      pointRadius: 3,
      pointHoverRadius: 6,
      fill: true,
      spanGaps: true,
    });
  }

  const min = Number.isFinite(cfg?.min) ? cfg.min : 0;
  const max = Number.isFinite(cfg?.max) ? cfg.max : 100;

  // ---- キャンバス作成 ----
  const c = document.createElement("canvas");
  c.width = 800;
  c.height = 800;

  // ---- Chart 生成（try/catchで保護）----
  let chart = null;
  try {
    // Chartが読み込まれていない場合のチェック
    if (typeof Chart === "undefined") {
      throw new Error(
        'Chart.js が読み込まれていません。<script src="...chart.umd.min.js"></script> を確認してください。'
      );
    }

    chart = new Chart(c.getContext("2d"), {
      type: "radar",
      data: { labels: safeLabels, datasets: dsForChart },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          // ↓ デバッグしやすいようにアニメ短縮（任意）
          tooltip: { enabled: true },
        },
        scales: {
          r: {
            min,
            max,
            ticks: { stepSize: Math.ceil(Math.max(1, (max - min) / 5)) },
            angleLines: { color: "rgba(0,0,0,.15)" },
            grid: { color: "rgba(0,0,0,.15)" },
            pointLabels: { font: { size: 16 } },
          },
        },
      },
    });
  } catch (err) {
    console.error("[makeRadarCanvas] Chart生成に失敗:", err);

    // フォールバック：エラーメッセージを書いた簡易キャンバスを返す
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#e11d48";
    ctx.font = "20px sans-serif";
    ctx.fillText("Radar chart error", 24, 40);
    ctx.fillStyle = "#111";
    ctx.font = "14px monospace";
    ctx.fillText(String(err.message || err), 24, 70);
  }

  return { canvas: c, chart };
}

function normalizeValuesToLabels(values, labels) {
  const res = values.slice(0, labels.length);
  while (res.length < labels.length) res.push(0);
  return res;
}
function addRadarNode() {
  const labels = parseLabels(radarLabels.value);
  if (labels.length < 3) return alert("ラベルは3つ以上にしてください");
  let values = parseValues(radarValues.value);
  values = normalizeValuesToLabels(values, labels);
  const ds = buildDataset(
    radarSetName.value,
    values,
    radarLine.value,
    radarFill.value,
    radarAlpha.value,
    radarDots.value
  );
  const min = +radarMin.value || 0,
    max = +radarMax.value || 100;
  const { canvas, chart } = makeRadarCanvas({
    labels,
    min,
    max,
    datasets: [ds],
  });
  const node = new Konva.Image({
    image: canvas,
    x: 200,
    y: 200,
    draggable: true,
  });
  node._chart = chart;
  node._radarConfig = { labels, min, max, datasets: [ds] };
  node.on("transformend dragend", () => mainLayer.batchDraw());
  ensureNodeName(node);
  mainLayer.add(node);
  selectNode(node);
  mainLayer.draw();
  updateLayerList();
  updateDatasetList();
}
function addDatasetToSelectedRadar() {
  if (!selectedNode || !selectedNode._radarConfig)
    return alert("レーダーを選択してください");
  const cfg = selectedNode._radarConfig;
  let values = parseValues(radarValues.value);
  values = normalizeValuesToLabels(values, cfg.labels);
  cfg.datasets.push(
    buildDataset(
      radarSetName.value,
      values,
      radarLine.value,
      radarFill.value,
      radarAlpha.value,
      radarDots.value
    )
  );
  updateSelectedRadar();
  updateDatasetList();
}
function updateSelectedRadar() {
  if (!selectedNode || !selectedNode._radarConfig) return;
  const cfg = selectedNode._radarConfig;
  cfg.labels = parseLabels(radarLabels.value);
  cfg.min = +radarMin.value || 0;
  cfg.max = +radarMax.value || 100;
  cfg.datasets = cfg.datasets.map((ds) => ({
    ...ds,
    data: normalizeValuesToLabels(ds.data, cfg.labels),
  }));
  const tmp = makeRadarCanvas(cfg);
  selectedNode.image(tmp.canvas);
  if (selectedNode._chart) selectedNode._chart.destroy();
  selectedNode._chart = tmp.chart;
  mainLayer.draw();
  updateLayerList();
}
addRadar.onclick = addRadarNode;
addRadar2.onclick = addDatasetToSelectedRadar;
updateRadar.onclick = () => {
  updateSelectedRadar();
  updateDatasetList();
};

/* ===== データセット管理 ===== */
const datasetListEl = document.getElementById("datasetList");
const datasetPanel = document.getElementById("radarDatasetsPanel");
let selectedDatasetIndex = null;
function updateDatasetList() {
  if (!datasetPanel) return;
  if (!selectedNode || !selectedNode._radarConfig) {
    datasetPanel.style.display = "none";
    return;
  }
  const cfg = selectedNode._radarConfig;
  datasetPanel.style.display = "block";
  datasetListEl.innerHTML = "";
  cfg.datasets.forEach((ds, i) => {
    const li = document.createElement("li");
    li.className = "layer-item";
    li.innerHTML = `<span class="label">${
      ds.label || "Dataset " + (i + 1)
    }</span>
      <button class="eye">${ds._visible !== false ? "👁" : "🙈"}</button>
      <button class="del">🗑</button>`;
    if (ds._visible === false) li.classList.add("is-hidden");
    if (selectedDatasetIndex === i) li.classList.add("is-active");

    li.addEventListener("click", (e) => {
      if (e.target.closest(".eye") || e.target.closest(".del")) return;
      selectedDatasetIndex = i;
      datasetListEl
        .querySelectorAll(".layer-item")
        .forEach((l) => l.classList.remove("is-active"));
      li.classList.add("is-active");
    });

    li.querySelector(".eye").addEventListener("click", () => {
      ds._visible = !ds._visible;
      updateSelectedRadar();
      updateDatasetList();
    });
    li.querySelector(".del").addEventListener("click", () => {
      cfg.datasets.splice(i, 1);
      selectedDatasetIndex = null;
      updateSelectedRadar();
      updateDatasetList();
    });

    datasetListEl.appendChild(li);
  });
}
btnDelDataset.onclick = () => {
  if (
    selectedNode &&
    selectedNode._radarConfig &&
    selectedDatasetIndex != null
  ) {
    selectedNode._radarConfig.datasets.splice(selectedDatasetIndex, 1);
    selectedDatasetIndex = null;
    updateSelectedRadar();
    updateDatasetList();
  }
};

/* ===== 画像フィルター（影の見切れ対策付き） ===== */
// 影の見切れを防ぐパディング
function calcShadowPadding() {
  const blur = +document.getElementById("fxShadowBlur")?.value || 0;
  const ox = Math.abs(+document.getElementById("fxShadowOffX")?.value || 0);
  const oy = Math.abs(+document.getElementById("fxShadowOffY")?.value || 0);
  return Math.ceil(Math.max(blur + ox, blur + oy) + 8);
}
function applyFilters(node) {
  const shadowEnabled =
    document.getElementById("fxShadowEnable")?.value === "1";
  node.shadowColor(
    document.getElementById("fxShadowColor")?.value || "#000000"
  );
  node.shadowBlur(
    shadowEnabled ? +document.getElementById("fxShadowBlur")?.value || 0 : 0
  );
  node.shadowOpacity(
    shadowEnabled ? +document.getElementById("fxShadowOpacity")?.value || 0 : 0
  );
  node.shadowOffset({
    x: shadowEnabled ? +document.getElementById("fxShadowOffX")?.value || 0 : 0,
    y: shadowEnabled ? +document.getElementById("fxShadowOffY")?.value || 0 : 0,
  });

  if (!(node instanceof Konva.Image)) {
    node.clearCache();
    if (shadowEnabled) node.cache({ padding: calcShadowPadding() });
    mainLayer.batchDraw();
    return;
  }

  const filters = [];
  const blurEnable = document.getElementById("fxBlurEnable")?.value === "1";
  const blurR = +document.getElementById("fxBlurRadius")?.value || 0;
  if (blurEnable && blurR > 0) {
    filters.push(Konva.Filters.Blur);
    node.blurRadius(blurR);
  } else {
    node.blurRadius(0);
  }

  const hslEnable = document.getElementById("fxHSLEnable")?.value === "1";
  if (hslEnable && Konva.Filters.HSL) {
    filters.push(Konva.Filters.HSL);
    const h = +document.getElementById("fxHue")?.value || 0;
    const hue360 = ((h % 360) + 360) % 360;
    node.hue(hue360);
    node.saturation(+document.getElementById("fxSat")?.value || 0);
    node.luminance(+document.getElementById("fxLum")?.value || 0);
  } else {
    node.hue(0);
    node.saturation(0);
    node.luminance(0);
  }

  node.clearCache();
  if (shadowEnabled || filters.length) {
    node.cache({ padding: shadowEnabled ? calcShadowPadding() : 0 });
    node.filters(filters);
  } else {
    node.filters([]);
  }
  mainLayer.batchDraw();
}
fxApply.addEventListener("click", () => {
  if (!selectedNode) {
    alert("対象を選択してください");
    return;
  }
  applyFilters(selectedNode);
});
fxReset.addEventListener("click", () => {
  if (!selectedNode) {
    alert("対象を選択してください");
    return;
  }
  selectedNode.shadowOpacity(0);
  selectedNode.shadowBlur(0);
  selectedNode.shadowOffset({ x: 0, y: 0 });
  selectedNode.clearCache();
  selectedNode.filters([]);
  mainLayer.batchDraw();
});

/* ===== 共通削除ボタン ===== */
btnDeleteNode.onclick = () => {
  if (!selectedNode) return alert("削除する要素を選択してください");
  selectedNode.destroy();
  selectNode(null);
  mainLayer.draw();
  updateLayerList();
  updateDatasetList();
};

/* ===== パターン（幾何学模様） ===== */
// RNG
function makeRNG(seed = 1) {
  let t = seed >>> 0;
  return function () {
    t ^= t << 13;
    t ^= t >>> 17;
    t ^= t << 5;
    return (t >>> 0) / 4294967295;
  };
}
function randRange(rng, a, b) {
  return a + (b - a) * rng();
}
function drawPlus(ctx, x, y, s, color, lw = 3) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x + s, y);
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y + s);
  ctx.stroke();
  ctx.restore();
}
function drawTriangle(ctx, x, y, s, color, fill = true, rot = 0, lw = 3) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s, s);
  ctx.lineTo(-s, s);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  ctx.restore();
}
function drawCircle(ctx, x, y, r, color, fill = true, lw = 3) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  ctx.restore();
}
function drawZigZag(ctx, x, y, w, h, color, lw = 3) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  const step = Math.max(6, w / 8);
  ctx.beginPath();
  let t = 0;
  ctx.moveTo(x, y);
  while (t <= w) {
    const nx = x + t;
    const ny = y + (Math.floor(t / step) % 2 === 0 ? -h / 2 : h / 2);
    ctx.lineTo(nx, ny);
    t += step;
  }
  ctx.stroke();
  ctx.restore();
}

function makePatternCanvas(cfg) {
  const size = Math.max(200, +cfg.canvas || 1000);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (cfg.bgTransparent !== true) {
    ctx.fillStyle = cfg.bgColor || "#fff";
    ctx.fillRect(0, 0, size, size);
  }
  const rng = makeRNG(+cfg.seed || 1);
  const density = Math.max(1, +cfg.density || 12);
  const count = Math.round(density * (size / 1000));
  const S = Math.max(6, +cfg.shapeSize || 48);
  const c1 = cfg.c1 || "#0ea5e9",
    c2 = cfg.c2 || "#ef2c90";
  if (+cfg.rotate) {
    ctx.translate(size / 2, size / 2);
    ctx.rotate((+cfg.rotate * Math.PI) / 180);
    ctx.translate(-size / 2, -size / 2);
  }

  for (let i = 0; i < count * 14; i++) {
    const x = randRange(rng, 0, size),
      y = randRange(rng, 0, size);
    const s = randRange(rng, S * 0.5, S * 1.25);
    const color = rng() > 0.5 ? c1 : c2;
    switch (cfg.kind) {
      case "dots": {
        const filled = rng() > 0.35;
        drawCircle(ctx, x, y, s * 0.5, color, filled, 3);
        break;
      }
      case "triangles": {
        const filled = rng() > 0.5;
        const rot = randRange(rng, 0, Math.PI);
        drawTriangle(ctx, x, y, s * 0.65, color, filled, rot, 3);
        break;
      }
      case "plus": {
        drawPlus(ctx, x, y, s * 0.5, color, 3);
        break;
      }
      case "zigzag": {
        drawZigZag(ctx, x - s * 0.8, y, s * 1.6, s * 0.8, color, 3);
        break;
      }
      case "rings": {
        drawCircle(ctx, x, y, s * 0.7, color, false, 3);
        drawCircle(ctx, x, y, s * 0.35, color, true, 3);
        break;
      }
      default: {
        drawCircle(ctx, x, y, s * 0.5, color, true, 3);
      }
    }
  }
  return c;
}
function readPatternConfigFromUI() {
  return {
    kind: patKind.value,
    seed: +patSeed.value || 1,
    c1: patC1.value,
    c2: patC2.value,
    bgColor: patBg.value,
    bgTransparent: patBgTransparent.value === "1",
    opacity: +patOpacity.value || 1,
    rotate: +patRot.value || 0,
    shapeSize: +patSize.value || 56,
    density: +patDensity.value || 18,
    canvas: +patCanvas.value || 1200,
  };
}
function addPatternNode() {
  const cfg = readPatternConfigFromUI();
  const canvas = makePatternCanvas(cfg);
  const node = new Konva.Image({
    image: canvas,
    x: 120,
    y: 120,
    draggable: true,
    opacity: cfg.opacity,
  });
  node._patternConfig = cfg;
  node.on("transformend dragend", () => mainLayer.batchDraw());
  ensureNodeName(node);
  mainLayer.add(node);
  selectNode(node);
  mainLayer.draw();
  updateLayerList();
}
function updateSelectedPattern() {
  if (
    !selectedNode ||
    !(selectedNode instanceof Konva.Image) ||
    !selectedNode._patternConfig
  ) {
    alert("パターンを選択してください");
    return;
  }
  const cfg = readPatternConfigFromUI();
  const canvas = makePatternCanvas(cfg);
  selectedNode.image(canvas);
  selectedNode.opacity(cfg.opacity);
  selectedNode._patternConfig = cfg;
  mainLayer.draw();
  updateLayerList();
}
patAdd.addEventListener("click", addPatternNode);
patUpdate.addEventListener("click", updateSelectedPattern);
patRandom.addEventListener("click", () => {
  patSeed.value = Math.floor(Math.random() * 100000) + 1;
});

/* ===== Export ===== */

// 日付入りファイル名を生成: <prefix>_YYYY-MM-DD_HHMMSS.png
function makeDatedFilename(prefix = "sheet") {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${prefix}_${y}-${m}-${day}_${hh}${mm}${ss}.png`;
}

function exportPNG() {
  try {
    const margin = Math.max(
      0,
      parseInt(document.getElementById("outMargin").value || "0", 10)
    );
    const transparent = document.getElementById("outTransparent").value === "1";
    const bgColor = document.getElementById("outBgColor").value || "#ffffff";

    // ▼ ここでファイル名を作る（prefix はお好みで）
    const filename = makeDatedFilename("display"); // 例: display_2025-10-04_132455.png

    let dataURL;
    try {
      dataURL = stage.toDataURL({ pixelRatio: 1, mimeType: "image/png" });
    } catch (e) {
      console.error("stage.toDataURL failed:", e);
      alert("画像を書き出せませんでした（CORSの可能性）。");
      return;
    }

    const out = document.createElement("canvas");
    out.width = stage.width() + margin * 2;
    out.height = stage.height() + margin * 2;
    const ctx = out.getContext("2d");

    if (!transparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, out.width, out.height);
    }

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, margin, margin);

      if (out.toBlob) {
        out.toBlob((blob) => {
          if (!blob) {
            fallbackWithDataURL();
            return;
          }
          const url = URL.createObjectURL(blob);
          triggerDownload(url, filename);
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        }, "image/png");
      } else {
        fallbackWithDataURL();
      }
    };
    img.onerror = (e) => {
      console.error("export composite load error:", e);
      alert("書き出し合成に失敗しました。");
    };
    img.src = dataURL;

    function fallbackWithDataURL() {
      try {
        const url = out.toDataURL("image/png");
        if (isSafari()) {
          const win = window.open(url, "_blank");
          if (!win)
            alert("ポップアップがブロックされました。許可してください。");
        } else {
          triggerDownload(url, filename);
        }
      } catch (e) {
        console.error("fallback toDataURL failed:", e);
        alert("PNGデータURL生成に失敗しました。");
      }
    }

    function triggerDownload(href, filename) {
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    function isSafari() {
      const ua = navigator.userAgent;
      return /^((?!chrome|android).)*safari/i.test(ua);
    }
  } catch (err) {
    console.error("exportPNG fatal:", err);
    alert("PNG保存で予期しないエラーが発生しました。");
  }
}

const prefix =
  (document.getElementById("outName")?.value || "display").trim() || "display";
const filename = makeDatedFilename(prefix);

document.getElementById("export").addEventListener("click", exportPNG);

/* ===== Init ===== */
resizeStage();
updateLayerList();
updateDatasetList();
