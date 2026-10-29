const API = (window.NCVIEW_API_BASE || "/ncview/api").replace(/\/$/, "");

const state = {
  sessionId: null,
  variables: [],
  plotUrl: null,
  abort: null,
  style: "auto",
};

const $ = (id) => document.getElementById(id);

const fileInput = $("fileInput");
const dropZone = $("dropZone");
const fileLabel = $("fileLabel");
const uploadPanel = $("uploadPanel");
const plotPanel = $("plotPanel");
const varSelect = $("varSelect");
const timeSelect = $("timeSelect");
const levelSelect = $("levelSelect");
const timeField = $("timeField");
const levelField = $("levelField");
const levelHint = $("levelHint");
const varHint = $("varHint");
const otherDims = $("otherDims");
const comboValue = $("comboValue");
const btnPlot = $("btnPlot");
const plotImg = $("plotImg");
const plotPlaceholder = $("plotPlaceholder");
const plotLoading = $("plotLoading");
const btnExport = $("btnExport");
const btnPrint = $("btnPrint");
const btnOpen = $("btnOpen");
const btnOpenFile = $("btnOpenFile");
const btnSample = $("btnSample");
const btnSampleLayers = $("btnSampleLayers");
const styleSeg = $("styleSeg");
const varRailList = $("varRailList");
const previewLabel = $("previewLabel");

function setBusy(busy) {
  plotLoading.classList.toggle("hidden", !busy);
  btnPlot.disabled = busy;
}

function formatDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  return String(detail);
}

function currentVar() {
  return state.variables.find((v) => v.name === varSelect.value) || state.variables[0];
}

function fillSelect(sel, dim) {
  sel.innerHTML = "";
  if (!dim) return;
  (dim.labels || []).forEach((label, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = label;
    sel.appendChild(opt);
  });
}

function kindHint(kind) {
  return (
    {
      speed: "建议：流线 + 色块（流速/风速大小）",
      uv_component: "建议：色块（红蓝表示正负分量）",
      temp: "建议：色块（温度越高颜色越深）",
      wave: "建议：色块（波高）",
      diff: "建议：色块（红蓝差值）",
    }[kind] || "建议：色块"
  );
}

function syncVarRail() {
  if (!varRailList) return;
  if (!state.variables.length) {
    varRailList.innerHTML = ["u10", "v10", "t2m", "tp"]
      .map((n) => `<div class="var-item ghost"><span class="dot"></span>${n}</div>`)
      .join("");
    return;
  }
  const cur = varSelect.value;
  varRailList.innerHTML = state.variables
    .map((v) => {
      const on = v.name === cur ? " on" : "";
      return `<button type="button" class="var-item${on}" data-name="${v.name}"><span class="dot"></span>${v.name}</button>`;
    })
    .join("");
  varRailList.querySelectorAll("button.var-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      varSelect.value = btn.dataset.name;
      renderDimControls();
    });
  });
}

function updateCombo() {
  const v = currentVar();
  if (!v) {
    comboValue.textContent = "—";
    return;
  }
  const bits = [v.long_name || v.name];
  if (timeSelect.dataset.dim && timeSelect.selectedOptions[0]) {
    bits.push(timeSelect.selectedOptions[0].textContent);
  }
  if (levelSelect.dataset.dim && !levelSelect.disabled && levelSelect.selectedOptions[0]) {
    bits.push(`${levelSelect.selectedOptions[0].textContent} m`.replace(/ m m$/, " m"));
  }
  const styleLabel = { auto: "自动", heatmap: "色块", streamline: "流线" }[state.style];
  bits.push(styleLabel);
  comboValue.textContent = bits.join(" · ");
  syncVarRail();
}

function renderDimControls() {
  const v = currentVar();
  otherDims.innerHTML = "";
  if (!v) return;

  const timeDim = (v.extra_dims || []).find((d) => d.is_time);
  const levelDim = (v.extra_dims || []).find((d) => d.is_level);
  const rest = (v.extra_dims || []).filter((d) => !d.is_time && !d.is_level);

  varHint.textContent = kindHint(v.kind);

  if (timeDim) {
    timeField.classList.remove("is-empty");
    timeSelect.disabled = false;
    fillSelect(timeSelect, timeDim);
    timeSelect.dataset.dim = timeDim.name;
  } else {
    timeField.classList.add("is-empty");
    timeSelect.innerHTML = "<option>本文件无时间维</option>";
    timeSelect.disabled = true;
    delete timeSelect.dataset.dim;
  }

  if (levelDim) {
    levelField.classList.remove("is-empty");
    levelSelect.disabled = false;
    fillSelect(levelSelect, levelDim);
    levelSelect.dataset.dim = levelDim.name;
    levelHint.textContent = `共 ${levelDim.size} 层`;
  } else {
    levelField.classList.add("is-empty");
    levelSelect.innerHTML = "<option>本文件无高度层</option>";
    levelSelect.disabled = true;
    delete levelSelect.dataset.dim;
    levelHint.textContent = "例如 20m — 需要 NC 里有 height/level 维";
  }

  rest.forEach((d) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = d.name;
    const sel = document.createElement("select");
    sel.dataset.dim = d.name;
    fillSelect(sel, d);
    sel.addEventListener("change", updateCombo);
    wrap.append(lab, sel);
    otherDims.appendChild(wrap);
  });

  updateCombo();
}

function collectIndices() {
  const indices = {};
  if (timeSelect.dataset.dim) indices[timeSelect.dataset.dim] = Number(timeSelect.value || 0);
  if (levelSelect.dataset.dim) indices[levelSelect.dataset.dim] = Number(levelSelect.value || 0);
  otherDims.querySelectorAll("select[data-dim]").forEach((sel) => {
    indices[sel.dataset.dim] = Number(sel.value || 0);
  });
  return indices;
}

async function openFile(file) {
  if (state.abort) state.abort.abort();
  const fd = new FormData();
  fd.append("file", file);
  setBusy(true);
  try {
    const res = await fetch(`${API}/open`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(formatDetail(data.detail) || "打开失败");

    state.sessionId = data.session_id;
    state.variables = data.variables || [];
    fileLabel.textContent = data.filename;
    uploadPanel.classList.add("hidden");
    plotPanel.classList.remove("hidden");
    if (previewLabel) previewLabel.textContent = "预览 · 已加载";
    btnExport.disabled = true;
    btnPrint.disabled = true;
    btnOpen.dataset.active = "false";

    plotImg.classList.add("hidden");
    plotPlaceholder.classList.remove("hidden");
    plotPlaceholder.textContent = "选好组合后点「绘图」";

    varSelect.innerHTML = "";
    state.variables.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.name;
      const tag = v.derived ? " · 合成" : "";
      const kind = v.kind && v.kind !== "default" ? ` · ${v.kind}` : "";
      opt.textContent = `${v.name}${tag}${kind}`;
      varSelect.appendChild(opt);
    });
    renderDimControls();
  } catch (err) {
    alert(err.message || String(err));
  } finally {
    setBusy(false);
  }
}

async function doPlot() {
  const v = currentVar();
  if (!state.sessionId || !v) return;

  if (state.abort) state.abort.abort();
  state.abort = new AbortController();
  setBusy(true);
  plotPlaceholder.classList.add("hidden");
  try {
    const res = await fetch(`${API}/plot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: state.abort.signal,
      body: JSON.stringify({
        session_id: state.sessionId,
        variable: v.name,
        indices: collectIndices(),
        style: state.style,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(formatDetail(data.detail) || "出图失败");
    }
    const blob = await res.blob();
    if (state.plotUrl) URL.revokeObjectURL(state.plotUrl);
    state.plotUrl = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      plotImg.onload = resolve;
      plotImg.onerror = () => reject(new Error("图片加载失败"));
      plotImg.src = state.plotUrl;
    });
    plotImg.classList.remove("hidden");
    btnExport.disabled = false;
    btnPrint.disabled = false;
  } catch (err) {
    if (err.name === "AbortError") return;
    plotPlaceholder.classList.remove("hidden");
    plotPlaceholder.textContent = "出图失败，请重试";
    alert(err.message || String(err));
  } finally {
    setBusy(false);
  }
}

function exportPng() {
  if (!state.plotUrl) return;
  const v = currentVar();
  const a = document.createElement("a");
  a.href = state.plotUrl;
  a.download = `${v?.name || "ncview"}.png`;
  a.click();
}

async function loadSample(url, filename) {
  try {
    setBusy(true);
    const res = await fetch(url);
    if (!res.ok) throw new Error("示例加载失败");
    const blob = await res.blob();
    await openFile(new File([blob], filename, { type: "application/x-netcdf" }));
  } catch (err) {
    alert(err.message || String(err));
    setBusy(false);
  }
}

styleSeg.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    styleSeg.querySelectorAll(".seg-btn").forEach((b) => {
      b.dataset.active = "false";
    });
    btn.dataset.active = "true";
    state.style = btn.dataset.style;
    updateCombo();
  });
});

function pickFile() {
  fileInput.click();
}

dropZone.addEventListener("click", (e) => {
  if (e.target.closest("button")) return;
  pickFile();
});
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files?.[0];
  if (file) openFile(file);
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) openFile(file);
});

varSelect.addEventListener("change", renderDimControls);
timeSelect.addEventListener("change", updateCombo);
levelSelect.addEventListener("change", updateCombo);
btnPlot.addEventListener("click", doPlot);

btnOpen.addEventListener("click", () => {
  btnOpen.dataset.active = "true";
  pickFile();
});
if (btnOpenFile) btnOpenFile.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); pickFile(); });
btnExport.addEventListener("click", exportPng);
btnPrint.addEventListener("click", () => window.print());

btnSample.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  loadSample(`${API}/sample`, "uv_2026011111.nc");
});
btnSampleLayers.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  loadSample(`${API}/sample_layers`, "demo_layers.nc");
});
