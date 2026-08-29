(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const app = document.querySelector("#app");
  const usage = document.querySelector("#usage");
  const usageTitle = document.querySelector("#usage-title");
  const usageMessage = document.querySelector("#usage-message");
  const usageCode = document.querySelector("#usage-code");

  const presetAliases = {
    smoke: { pres: "./presets/smoke.json", view: "all" },
    "smoke-flashlites": { pres: "./presets/smoke.json", view: "flashlites" },
    "smoke-settings": { pres: "./presets/smoke.json", view: "settings" },
    "smoke-types": { pres: "./presets/smoke.json", view: "types" },
    "smoke-ir": { pres: "./presets/smoke.json", view: "ir" },
  };

  function showUsage(title, message, example) {
    usageTitle.textContent = title;
    usageMessage.textContent = message;
    usageCode.textContent = example;
    usage.hidden = false;
  }

  function readDirectImages() {
    const items = [];
    for (let index = 1; index <= 4; index += 1) {
      const url = params.get(`img${index}`)?.trim();
      if (!url) continue;
      items.push({
        id: `image-${index}`,
        url,
        label: params.get(`label${index}`)?.trim() || `Image ${index}`,
      });
    }
    return { items, title: "Image Comparison", selectedA: 0, selectedB: 1 };
  }

  function requireString(value, name) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${name} must be a non-empty string`);
    }
    return value.trim();
  }

  function resolveView(config, requestedView) {
    const views = config.views && typeof config.views === "object" ? config.views : {};
    const viewName = requestedView || (views.all ? "all" : Object.keys(views)[0]);
    if (!viewName) return { view: null, viewName: null };
    if (!views[viewName] || typeof views[viewName] !== "object") {
      throw new Error(`View "${viewName}" does not exist`);
    }
    return { view: views[viewName], viewName };
  }

  async function readJsonPreset(rawUrl, requestedView) {
    const configUrl = new URL(rawUrl, window.location.href);
    if (!["http:", "https:"].includes(configUrl.protocol)) {
      throw new Error("Preset URL must use HTTP or HTTPS");
    }

    const response = await fetch(configUrl.href, { credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status} while loading preset`);

    const config = await response.json();
    if (!config || typeof config !== "object" || !Array.isArray(config.images)) {
      throw new Error("Preset must contain an images array");
    }
    if (config.images.length > 100) throw new Error("Preset cannot contain more than 100 images");

    const ids = new Set();
    const allItems = config.images.map((image, index) => {
      if (!image || typeof image !== "object") {
        throw new Error(`images[${index}] must be an object`);
      }
      const id = requireString(image.id, `images[${index}].id`);
      if (ids.has(id)) throw new Error(`Duplicate image id "${id}"`);
      ids.add(id);

      const sourceUrl = new URL(requireString(image.src, `images[${index}].src`), configUrl);
      if (!["http:", "https:"].includes(sourceUrl.protocol)) {
        throw new Error(`Image "${id}" must use HTTP or HTTPS`);
      }

      return {
        id,
        label: typeof image.label === "string" && image.label.trim() ? image.label.trim() : id,
        group: typeof image.group === "string" && image.group.trim() ? image.group.trim() : null,
        url: sourceUrl.href,
      };
    });

    const { view, viewName } = resolveView(config, requestedView);
    let items = allItems;
    if (view && view.images !== "*") {
      if (!Array.isArray(view.images)) {
        throw new Error(`View "${viewName}" needs an images array or "*"`);
      }
      const byId = new Map(allItems.map((item) => [item.id, item]));
      items = view.images.map((id) => {
        if (!byId.has(id)) {
          throw new Error(`View "${viewName}" references unknown image "${id}"`);
        }
        return byId.get(id);
      });
    }

    if (items.length < 2) throw new Error("A preset view must contain at least two images");
    const selectedA = Math.max(0, items.findIndex((item) => item.id === view?.defaultA));
    let selectedB = items.findIndex((item) => item.id === view?.defaultB);
    if (selectedB < 0 || selectedB === selectedA) selectedB = selectedA === 0 ? 1 : 0;

    return {
      items,
      selectedA,
      selectedB,
      title: (typeof view?.title === "string" && view.title.trim())
        || (typeof config.title === "string" && config.title.trim())
        || "Image Comparison",
    };
  }

  async function getComparison() {
    const aliasName = params.get("preset")?.trim();
    const alias = aliasName ? presetAliases[aliasName] : null;
    if (aliasName && !alias) throw new Error(`Unknown preset alias "${aliasName}"`);

    const rawPresetUrl = params.get("pres")?.trim() || alias?.pres;
    if (rawPresetUrl) {
      return readJsonPreset(rawPresetUrl, params.get("view")?.trim() || alias?.view);
    }
    return readDirectImages();
  }

  async function init() {
    let comparison;
    try {
      comparison = await getComparison();
    } catch (error) {
      showUsage(
        "Failed to load preset.",
        error instanceof Error ? error.message : "The preset could not be loaded.",
        "?pres=./presets/smoke.json&view=all",
      );
      return;
    }

    const { items } = comparison;
    if (items.length < 2) {
      showUsage(
        "Two image URLs are required.",
        "Pass two to four public image URLs, or load a JSON preset.",
        "?img1=<url>&img2=<url>  or  ?pres=./presets/smoke.json",
      );
      return;
    }

    app.hidden = false;

    const elements = {
      title: document.querySelector("#comparison-title"),
      selectA: document.querySelector("#select-a"),
      selectB: document.querySelector("#select-b"),
      swap: document.querySelector("#swap-button"),
      fullscreen: document.querySelector("#fullscreen-button"),
      viewer: document.querySelector("#viewer"),
      stage: document.querySelector("#stage"),
      planeA: document.querySelector("#plane-a"),
      planeB: document.querySelector("#plane-b"),
      imageA: document.querySelector("#image-a"),
      imageB: document.querySelector("#image-b"),
      clipB: document.querySelector("#clip-b"),
      labelA: document.querySelector("#label-a"),
      labelB: document.querySelector("#label-b"),
      divider: document.querySelector("#divider"),
      dividerHandle: document.querySelector("#divider-handle"),
      zoomIndicator: document.querySelector("#zoom-indicator"),
      loading: document.querySelector("#loading"),
      error: document.querySelector("#load-error"),
      warning: document.querySelector("#aspect-warning"),
    };

    const state = {
      selectedA: comparison.selectedA,
      selectedB: comparison.selectedB,
      divider: 50,
      zoom: 1,
      panX: 0,
      panY: 0,
      generation: 0,
      panPointer: null,
      activePointers: new Map(),
      pinchGesture: null,
      dividerPointer: null,
      zoomHideTimer: null,
    };

    const comparisonTitle = params.get("title")?.trim() || comparison.title;
    elements.title.textContent = comparisonTitle;
    document.title = `${comparisonTitle} · Image Compare`;

    function populateSelects() {
      const groupsA = new Map();
      const groupsB = new Map();
      for (const [index, item] of items.entries()) {
        const optionA = new Option(item.label, String(index));
        const optionB = new Option(item.label, String(index));
        if (item.group) {
          if (!groupsA.has(item.group)) {
            const groupA = document.createElement("optgroup");
            const groupB = document.createElement("optgroup");
            groupA.label = item.group;
            groupB.label = item.group;
            groupsA.set(item.group, groupA);
            groupsB.set(item.group, groupB);
            elements.selectA.add(groupA);
            elements.selectB.add(groupB);
          }
          groupsA.get(item.group).append(optionA);
          groupsB.get(item.group).append(optionB);
        } else {
          elements.selectA.add(optionA);
          elements.selectB.add(optionB);
        }
      }
      elements.selectA.value = String(state.selectedA);
      elements.selectB.value = String(state.selectedB);
      updateDisabledOptions();
    }

    function updateDisabledOptions() {
      for (const option of elements.selectA.options) {
        option.disabled = Number(option.value) === state.selectedB;
      }
      for (const option of elements.selectB.options) {
        option.disabled = Number(option.value) === state.selectedA;
      }
    }

    function setTransforms() {
      const transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
      elements.planeA.style.transform = transform;
      elements.planeB.style.transform = transform;
    }

    function showZoomIndicator() {
      elements.zoomIndicator.textContent = `${Math.round(state.zoom * 100)}%`;
      elements.dividerHandle.classList.add("is-zooming");
      window.clearTimeout(state.zoomHideTimer);
      state.zoomHideTimer = window.setTimeout(() => {
        elements.dividerHandle.classList.remove("is-zooming");
      }, 1700);
    }

    function setDivider(nextValue) {
      state.divider = Math.min(100, Math.max(0, nextValue));
      elements.divider.style.left = `${state.divider}%`;
      elements.clipB.style.clipPath = `inset(0 0 0 ${state.divider}%)`;
      elements.divider.setAttribute("aria-valuenow", String(Math.round(state.divider)));
    }

    function resetView() {
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      window.clearTimeout(state.zoomHideTimer);
      elements.dividerHandle.classList.remove("is-zooming");
      setTransforms();
    }

    function validateAspectRatio() {
      const ratioA = elements.imageA.naturalWidth / elements.imageA.naturalHeight;
      const ratioB = elements.imageB.naturalWidth / elements.imageB.naturalHeight;
      const difference = Math.abs(ratioA - ratioB) / Math.max(ratioA, ratioB);
      elements.warning.hidden = difference < 0.005;
    }

    function waitForImage(image, item, generation) {
      return new Promise((resolve, reject) => {
        const onLoad = () => { cleanup(); resolve(); };
        const onError = () => {
          cleanup();
          if (generation === state.generation) reject(new Error(`Failed to load ${item.label}`));
          else resolve();
        };
        const cleanup = () => {
          image.removeEventListener("load", onLoad);
          image.removeEventListener("error", onError);
        };
        image.addEventListener("load", onLoad, { once: true });
        image.addEventListener("error", onError, { once: true });
        image.alt = item.label;
        image.src = item.url;
        if (image.complete) {
          queueMicrotask(() => {
            if (image.naturalWidth > 0) onLoad();
            else onError();
          });
        }
      });
    }

    async function loadSelection({ reset = true } = {}) {
      const itemA = items[state.selectedA];
      const itemB = items[state.selectedB];
      const generation = ++state.generation;
      elements.labelA.textContent = itemA.label;
      elements.labelB.textContent = itemB.label;
      elements.loading.hidden = false;
      elements.error.hidden = true;
      elements.warning.hidden = true;
      if (reset) resetView();
      const results = await Promise.allSettled([
        waitForImage(elements.imageA, itemA, generation),
        waitForImage(elements.imageB, itemB, generation),
      ]);
      if (generation !== state.generation) return;
      const failures = results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason.message);
      elements.loading.hidden = true;
      if (failures.length) {
        elements.error.textContent = failures.join(" · ");
        elements.error.hidden = false;
        return;
      }
      validateAspectRatio();
    }

    function changeSelection(side, nextIndex) {
      if (side === "A") {
        if (nextIndex === state.selectedB) return;
        state.selectedA = nextIndex;
      } else {
        if (nextIndex === state.selectedA) return;
        state.selectedB = nextIndex;
      }
      updateDisabledOptions();
      loadSelection();
    }

    function updateDividerFromPointer(event) {
      const bounds = elements.stage.getBoundingClientRect();
      setDivider(((event.clientX - bounds.left) / bounds.width) * 100);
    }

    elements.selectA.addEventListener("change", (event) => changeSelection("A", Number(event.target.value)));
    elements.selectB.addEventListener("change", (event) => changeSelection("B", Number(event.target.value)));
    elements.swap.addEventListener("click", () => {
      [state.selectedA, state.selectedB] = [state.selectedB, state.selectedA];
      elements.selectA.value = String(state.selectedA);
      elements.selectB.value = String(state.selectedB);
      updateDisabledOptions();
      loadSelection({ reset: false });
    });
    elements.fullscreen.addEventListener("click", async () => {
      if (!document.fullscreenElement) await elements.viewer.requestFullscreen?.();
      else await document.exitFullscreen?.();
    });
    document.addEventListener("fullscreenchange", () => {
      elements.fullscreen.textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
    });

    elements.divider.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.dividerPointer = event.pointerId;
      elements.divider.setPointerCapture(event.pointerId);
      updateDividerFromPointer(event);
    });
    elements.divider.addEventListener("pointermove", (event) => {
      if (event.pointerId === state.dividerPointer) updateDividerFromPointer(event);
    });
    elements.divider.addEventListener("pointerup", (event) => {
      if (event.pointerId !== state.dividerPointer) return;
      state.dividerPointer = null;
      elements.divider.releasePointerCapture(event.pointerId);
    });
    elements.divider.addEventListener("pointercancel", () => { state.dividerPointer = null; });
    elements.divider.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setDivider(state.divider - step);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setDivider(state.divider + step);
      }
    });

    function getPinchGeometry() {
      const [pointA, pointB] = [...state.activePointers.values()];
      return {
        distance: Math.max(1, Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y)),
        midpointX: (pointA.x + pointB.x) / 2,
        midpointY: (pointA.y + pointB.y) / 2,
      };
    }

    function beginPinch() {
      const geometry = getPinchGeometry();
      state.pinchGesture = {
        ...geometry,
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY,
      };
      state.panPointer = null;
    }

    function beginPan(pointerId, point) {
      state.panPointer = {
        id: pointerId,
        startX: point.x,
        startY: point.y,
        panX: state.panX,
        panY: state.panY,
      };
      state.pinchGesture = null;
    }

    elements.stage.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || state.dividerPointer !== null) return;
      state.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      elements.stage.setPointerCapture(event.pointerId);
      elements.stage.classList.add("is-panning");

      if (state.activePointers.size >= 2) beginPinch();
      else beginPan(event.pointerId, state.activePointers.get(event.pointerId));
    });

    elements.stage.addEventListener("pointermove", (event) => {
      if (!state.activePointers.has(event.pointerId)) return;
      state.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (state.activePointers.size >= 2) {
        if (!state.pinchGesture) beginPinch();
        const geometry = getPinchGeometry();
        state.zoom = Math.min(
          12,
          Math.max(0.25, state.pinchGesture.zoom * (geometry.distance / state.pinchGesture.distance)),
        );
        state.panX = state.pinchGesture.panX + geometry.midpointX - state.pinchGesture.midpointX;
        state.panY = state.pinchGesture.panY + geometry.midpointY - state.pinchGesture.midpointY;
        setTransforms();
        showZoomIndicator();
        return;
      }

      if (!state.panPointer || event.pointerId !== state.panPointer.id) return;
      state.panX = state.panPointer.panX + event.clientX - state.panPointer.startX;
      state.panY = state.panPointer.panY + event.clientY - state.panPointer.startY;
      setTransforms();
    });

    function endPan(event) {
      if (!state.activePointers.has(event.pointerId)) return;
      state.activePointers.delete(event.pointerId);
      if (elements.stage.hasPointerCapture(event.pointerId)) {
        elements.stage.releasePointerCapture(event.pointerId);
      }

      if (state.activePointers.size >= 2) {
        beginPinch();
      } else if (state.activePointers.size === 1) {
        const [remainingPointer] = state.activePointers.entries();
        beginPan(remainingPointer[0], remainingPointer[1]);
      } else {
        state.panPointer = null;
        state.pinchGesture = null;
        elements.stage.classList.remove("is-panning");
      }
    }

    elements.stage.addEventListener("pointerup", endPan);
    elements.stage.addEventListener("pointercancel", endPan);
    elements.stage.addEventListener("wheel", (event) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      state.zoom = Math.min(12, Math.max(0.25, state.zoom * factor));
      setTransforms();
      showZoomIndicator();
    }, { passive: false });
    elements.stage.addEventListener("dblclick", resetView);

    document.addEventListener("keydown", (event) => {
      const tagName = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA"].includes(tagName)) return;
      if (event.code === "KeyR" || event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetView();
        setDivider(50);
      }
    });

    populateSelects();
    setDivider(50);
    setTransforms();
    loadSelection();
  }

  init();
})();
