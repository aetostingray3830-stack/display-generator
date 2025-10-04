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
  if (n instanceof Konva.Image && n._patternConfig) return "pattern";
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
        : t === "pattern"
        ? "Pattern"
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
  const cvW = document.getElementById("cvW");
  const cvH = document.getElementById("cvH");
  stageW = +cvW.value || 1600;
  stageH = +cvH.value || 1200;
  stage.size({ width: stageW, height: stageH });
  fitBackground();
  stage.draw();
}
function setBackgroundImage(url) {
  const img = new Image();
  img.crossOrigin = "anonymous"; // ← 重要！
  img.onload = () => {
    if (!bgImageNode) {
      bgImageNode = new Konva.Image({
        image: img,
        x: 0,
        y: 0,
        listening: false,
      });
      bgLayer.add(bgImageNode);
    } else {
      bgImageNode.image(img);
    }
    fitBackground();
    bgLayer.draw();
  };
  img.onerror = (e) => {
    console.error("背景画像の読み込みに失敗", e);
    alert(
      "背景画像を読み込めませんでした。CORSを許可した画像URLか、ファイルから読み込んでください。"
    );
  };
  img.src = url;
}

function fitBackground() {
  if (!bgImageNode || !bgImageNode.image()) return;
  const bgFit = document.getElementById("bgFit").value;
  const iw = bgImageNode.image().width,
    ih = bgImageNode.image().height;
  const sw = stage.width(),
    sh = stage.height(),
    ir = iw / ih,
    sr = sw / sh;
  const scale =
    bgFit === "cover"
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
document.getElementById("applyCanvas").onclick = resizeStage;
document.getElementById("bgFile").onchange = (e) => {
  const f = e.target.files?.[0];
  if (f) {
    const r = new FileReader();
    r.onload = () => setBackgroundImage(r.result);
    r.readAsDataURL(f);
  }
};
document.getElementById("clearBg").onclick = () => {
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
  img.crossOrigin = "anonymous";
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
document.getElementById("addImg").onclick = () => {
  const f = document.getElementById("imgFile").files?.[0];
  if (f) addImageFromFile(f);
};
document.getElementById("imgOpacity").addEventListener("input", (e) => {
  const v = parseFloat(e.target.value);
  document.getElementById("imgOpacityVal").textContent = v.toFixed(2);
  if (selectedNode && selectedNode instanceof Konva.Image) {
    selectedNode.opacity(v);
    mainLayer.batchDraw();
  }
});
document.getElementById("btnDelImage").onclick = () => {
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
    shadowColor: "#000",
    shadowOpacity: 0,
    shadowBlur: 0,
    shadowOffset: { x: 0, y: 0 },
  });
  t.on("transformend dragend", () => mainLayer.batchDraw());
  ensureNodeName(t);
  mainLayer.add(t);
  selectNode(t);
  mainLayer.draw();
  updateLayerList();
}
document.getElementById("addText").onclick = () =>
  addTextNode({
    text: document.getElementById("txtContent").value,
    size: document.getElementById("txtSize").value,
    fill: document.getElementById("txtColor").value,
    stroke: document.getElementById("txtStrokeColor").value,
    strokeW: document.getElementById("txtStrokeW").value,
    lineH: document.getElementById("txtLineH").value,
    weight: document.getElementById("txtWeight").value,
    font: document.getElementById("txtFont").value,
  });
document.getElementById("updateText").onclick = () => {
  if (!selectedNode || !(selectedNode instanceof Konva.Text))
    return alert("テキストを選択してください");
  selectedNode.setAttrs({
    text: document.getElementById("txtContent").value.replace(/\\n/g, "\n"),
    fontSize: +document.getElementById("txtSize").value || 64,
    lineHeight: +document.getElementById("txtLineH").value || 1.2,
    fill: document.getElementById("txtColor").value,
    stroke: document.getElementById("txtStrokeColor").value,
    strokeWidth: +document.getElementById("txtStrokeW").value || 2,
    fontStyle: document.getElementById("txtWeight").value,
    fontFamily: document.getElementById("txtFont").value,
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
  const c = document.createElement("canvas");
  c.width = 800;
  c.height = 800;
  const chart = new Chart(c.getContext("2d"), {
    type: "radar",
    data: {
      labels: cfg.labels,
      datasets: cfg.datasets.filter((d) => d._visible !== false),
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        r: {
          min: cfg.min,
          max: cfg.max,
          ticks: {
            stepSize: Math.ceil(Math.max(1, (cfg.max - cfg.min) / 5)),
          },
          grid: { color: "rgba(0,0,0,.15)" },
          angleLines: { color: "rgba(0,0,0,.15)" },
          pointLabels: { font: { size: 18 } },
        },
      },
    },
  });
  return { canvas: c, chart };
}

function normalizeValuesToLabels(values, labels) {
  const res = values.slice(0, labels.length);
  while (res.length < labels.length) res.push(0);
  return res;
}
function addRadarNode() {
  const labels = parseLabels(document.getElementById("radarLabels").value);
  if (labels.length < 3) return alert("ラベルは3つ以上にしてください");
  let values = parseValues(document.getElementById("radarValues").value);
  values = normalizeValuesToLabels(values, labels);
  const ds = buildDataset(
    document.getElementById("radarSetName").value,
    values,
    document.getElementById("radarLine").value,
    document.getElementById("radarFill").value,
    document.getElementById("radarAlpha").value,
    document.getElementById("radarDots").value
  );
  const min = +document.getElementById("radarMin").value || 0;
  const max = +document.getElementById("radarMax").value || 100;
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
  let values = parseValues(document.getElementById("radarValues").value);
  values = normalizeValuesToLabels(values, cfg.labels);
  cfg.datasets.push(
    buildDataset(
      document.getElementById("radarSetName").value,
      values,
      document.getElementById("radarLine").value,
      document.getElementById("radarFill").value,
      document.getElementById("radarAlpha").value,
      document.getElementById("radarDots").value
    )
  );
  updateSelectedRadar();
  updateDatasetList();
}
function updateSelectedRadar() {
  if (!selectedNode || !selectedNode._radarConfig) return;
  const cfg = selectedNode._radarConfig;
  cfg.labels = parseLabels(document.getElementById("radarLabels").value);
  cfg.min = +document.getElementById("radarMin").value || 0;
  cfg.max = +document.getElementById("radarMax").value || 100;
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
document.getElementById("addRadar").onclick = addRadarNode;
document.getElementById("addRadar2").onclick = addDatasetToSelectedRadar;
document.getElementById("updateRadar").onclick = () => {
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
const btnDelDataset = document.getElementById("btnDelDataset");
if (btnDelDataset) {
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
}

/* ===== 画像フィルター（影の見切れ対策付き） ===== */
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
const fxApply = document.getElementById("fxApply");
if (fxApply)
  fxApply.addEventListener("click", () => {
    if (!selectedNode) {
      alert("対象を選択してください");
      return;
    }
    applyFilters(selectedNode);
  });
const fxReset = document.getElementById("fxReset");
if (fxReset)
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

/* ===== パターン（幾何学模様） ===== */
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
    kind: document.getElementById("patKind").value,
    seed: +document.getElementById("patSeed").value || 1,
    c1: document.getElementById("patC1").value,
    c2: document.getElementById("patC2").value,
    bgColor: document.getElementById("patBg").value,
    bgTransparent: document.getElementById("patBgTransparent").value === "1",
    opacity: +document.getElementById("patOpacity").value || 1,
    rotate: +document.getElementById("patRot").value || 0,
    shapeSize: +document.getElementById("patSize").value || 56,
    density: +document.getElementById("patDensity").value || 18,
    canvas: +document.getElementById("patCanvas").value || 1200,
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
const patAdd = document.getElementById("patAdd");
if (patAdd) patAdd.addEventListener("click", addPatternNode);
const patUpdate = document.getElementById("patUpdate");
if (patUpdate) patUpdate.addEventListener("click", updateSelectedPattern);
const patRandom = document.getElementById("patRandom");
if (patRandom)
  patRandom.addEventListener("click", () => {
    document.getElementById("patSeed").value =
      Math.floor(Math.random() * 100000) + 1;
  });

/* ======== エクスポート補助：実描画範囲を取得（トリミング対策） ======== */
// 置き換え：getContentRect
// ステージ内の全要素の実描画範囲を取得（影・回転・スケールも含む）
// ステージ内の全要素の実描画範囲を取得（影・回転・スケールも含む）
function getContentRect(bleed = 32) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  stage.getChildren().forEach((layer) => {
    layer.getChildren().forEach((node) => {
      // 非表示ノード・Transformerは無視
      if (!node.visible() || node.className === "Transformer") return;

      const r = node.getClientRect({ skipShadow: false, skipStroke: false });
      if (
        !r ||
        !isFinite(r.x) ||
        !isFinite(r.y) ||
        !isFinite(r.width) ||
        !isFinite(r.height)
      )
        return;
      if (r.width <= 0 || r.height <= 0) return;

      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
    });
  });

  // コンテンツが無い場合
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = stage.width();
    maxY = stage.height();
  }

  // bleedぶんマージンを足す
  minX -= bleed;
  minY -= bleed;
  maxX += bleed;
  maxY += bleed;

  // 小数端切れ対策で整数化
  const x = Math.floor(minX);
  const y = Math.floor(minY);
  const width = Math.ceil(maxX - x);
  const height = Math.ceil(maxY - y);

  return { x, y, width, height };
}

/* ===== 日付入りファイル名 ===== */
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

/* ===== エクスポート（トリミング対策＋Blob/新タブフォールバック） ===== */
function exportPNG() {
  console.log("exportPNG called");

  try {
    const margin = Number(document.getElementById("outMargin")?.value || 0);
    const transparent =
      document.getElementById("outTransparent")?.value === "1";
    const bgColor = document.getElementById("outBgColor")?.value || "#ffffff";
    const prefix =
      (document.getElementById("outName")?.value || "display").trim() ||
      "display";
    const filename = makeDatedFilename(prefix);

    // ✅ 影などのはみ出し余白
    const bleed = 16;
    let rect = getContentRect(bleed);

    // rectの安全確認（width/heightが0ならステージ全体にフォールバック）
    if (
      !rect ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      !isFinite(rect.width) ||
      !isFinite(rect.height)
    ) {
      console.warn("rect fallback: invalid size", rect);
      rect = { x: 0, y: 0, width: stage.width(), height: stage.height() };
    }

    // ✅ ステージからDataURL取得（try-catch必須）
    let dataURL;
    try {
      dataURL = stage.toDataURL({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        pixelRatio: 1,
        mimeType: "image/png",
      });
    } catch (e) {
      console.error("stage.toDataURL failed:", e);
      alert("画像書き出しに失敗しました（外部画像やCORSの可能性）");
      return;
    }

    // ✅ 合成キャンバス作成
    const outCanvas = document.createElement("canvas");
    outCanvas.width = Math.ceil(rect.width) + margin * 2;
    outCanvas.height = Math.ceil(rect.height) + margin * 2;
    const ctx = outCanvas.getContext("2d");

    if (!transparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    }

    // ✅ Imageとして描画してBlob保存
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      console.log("img loaded OK");
      ctx.drawImage(img, margin, margin);

      if (outCanvas.toBlob) {
        outCanvas.toBlob((blob) => {
          if (!blob) {
            console.warn("Blob生成失敗、DataURLフォールバック");
            fallbackDataURL();
            return;
          }
          console.log("Blob生成成功", blob);

          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          console.log("✅ ダウンロード完了:", filename);
        }, "image/png");
      } else {
        fallbackDataURL();
      }
    };
    img.onerror = (e) => {
      console.error("画像読み込み失敗:", e);
      alert("PNG合成に失敗しました。");
    };
    img.src = dataURL;

    function fallbackDataURL() {
      try {
        console.log("フォールバック開始");
        const url = outCanvas.toDataURL("image/png");
        const newTab = window.open(url, "_blank");
        if (!newTab) alert("ポップアップがブロックされました。");
        else console.log("✅ 新タブで画像表示");
      } catch (err) {
        console.error("DataURLフォールバック失敗:", err);
        alert("PNG保存に失敗しました。");
      }
    }
  } catch (err) {
    console.error("exportPNG fatal:", err);
    alert("PNG保存時にエラーが発生しました。");
  }
}

/* ===== イベント結線 ===== */
document.getElementById("applyCanvas").click; // noop to ensure loaded
document.getElementById("export").addEventListener("click", exportPNG);
document.getElementById("addImg"); // keep refs warm (noop)
document.getElementById("addRadar"); // noop

/* ===== Init ===== */
resizeStage();
updateLayerList();
updateDatasetList();
