(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const items = [];

  for (let index = 1; index <= 4; index += 1) {
    const url = params.get(`img${index}`)?.trim();
    if (!url) continue;

    items.push({
      sourceIndex: index,
      url,
      label: params.get(`label${index}`)?.trim() || `Image ${index}`,
    });
  }

  const app = document.querySelector("#app");
  const usage = document.querySelector("#usage");

  if (!params.get("img1")?.trim() || !params.get("img2")?.trim()) {
    usage.hidden = false;
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
    loading: document.querySelector("#loading"),
    error: document.querySelector("#load-error"),
    warning: document.querySelector("#aspect-warning"),
    zoom: document.querySelector("#zoom-readout"),
  };

  const state = {
    selectedA: 0,
    selectedB: 1,
    divider: 50,
    zoom: 1,
    panX: 0,
    panY: 0,
    generation: 0,
    panPointer: null,
    dividerPointer: null,
  };

  const comparisonTitle = params.get("title")?.trim() || "Image Comparison";
  elements.title.textContent = comparisonTitle;
  document.title = `${comparisonTitle} · Image Compare`;

  function populateSelects() {
    for (const [index, item] of items.entries()) {
      const optionA = new Option(item.label, String(index));
      const optionB = new Option(item.label, String(index));
      elements.selectA.add(optionA);
      elements.selectB.add(optionB);
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
    elements.zoom.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function setDivider(nextValue) {
    state.divider = Math.min(100, Math.max(0, nextValue));
    elements.divider.style.left = `${state.divider}%`;
    elements.clipB.style.clipPath = `inset(0 ${100 - state.divider}% 0 0)`;
    elements.divider.setAttribute("aria-valuenow", String(Math.round(state.divider)));
  }

  function resetView() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
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
      const onLoad = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        if (generation === state.generation) {
          reject(new Error(`Failed to load ${item.label}`));
        } else {
          resolve();
        }
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

  elements.selectA.addEventListener("change", (event) => {
    changeSelection("A", Number(event.target.value));
  });

  elements.selectB.addEventListener("change", (event) => {
    changeSelection("B", Number(event.target.value));
  });

  elements.swap.addEventListener("click", () => {
    [state.selectedA, state.selectedB] = [state.selectedB, state.selectedA];
    elements.selectA.value = String(state.selectedA);
    elements.selectB.value = String(state.selectedB);
    updateDisabledOptions();
    loadSelection({ reset: false });
  });

  elements.fullscreen.addEventListener("click", async () => {
    if (!document.fullscreenElement) {
      await elements.viewer.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
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
    if (event.pointerId !== state.dividerPointer) return;
    updateDividerFromPointer(event);
  });

  elements.divider.addEventListener("pointerup", (event) => {
    if (event.pointerId !== state.dividerPointer) return;
    state.dividerPointer = null;
    elements.divider.releasePointerCapture(event.pointerId);
  });

  elements.divider.addEventListener("pointercancel", () => {
    state.dividerPointer = null;
  });

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

  elements.stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || state.dividerPointer !== null) return;
    state.panPointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: state.panX,
      panY: state.panY,
    };
    elements.stage.setPointerCapture(event.pointerId);
    elements.stage.classList.add("is-panning");
  });

  elements.stage.addEventListener("pointermove", (event) => {
    if (!state.panPointer || event.pointerId !== state.panPointer.id) return;
    state.panX = state.panPointer.panX + event.clientX - state.panPointer.startX;
    state.panY = state.panPointer.panY + event.clientY - state.panPointer.startY;
    setTransforms();
  });

  function endPan(event) {
    if (!state.panPointer || event.pointerId !== state.panPointer.id) return;
    state.panPointer = null;
    elements.stage.classList.remove("is-panning");
    if (elements.stage.hasPointerCapture(event.pointerId)) {
      elements.stage.releasePointerCapture(event.pointerId);
    }
  }

  elements.stage.addEventListener("pointerup", endPan);
  elements.stage.addEventListener("pointercancel", endPan);

  elements.stage.addEventListener("wheel", (event) => {
    event.preventDefault();

    const bounds = elements.stage.getBoundingClientRect();
    const cursorX = event.clientX - bounds.left - bounds.width / 2;
    const cursorY = event.clientY - bounds.top - bounds.height / 2;
    const worldX = (cursorX - state.panX) / state.zoom;
    const worldY = (cursorY - state.panY) / state.zoom;
    const factor = Math.exp(-event.deltaY * 0.0015);
    const nextZoom = Math.min(12, Math.max(0.25, state.zoom * factor));

    state.panX = cursorX - worldX * nextZoom;
    state.panY = cursorY - worldY * nextZoom;
    state.zoom = nextZoom;
    setTransforms();
  }, { passive: false });

  elements.stage.addEventListener("dblclick", resetView);

  document.addEventListener("keydown", (event) => {
    const tagName = document.activeElement?.tagName;
    if (tagName === "SELECT" || tagName === "INPUT" || tagName === "TEXTAREA") return;
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      resetView();
    }
  });

  populateSelects();
  setDivider(50);
  setTransforms();
  loadSelection();
})();
