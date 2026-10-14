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

  const videoExtensions = new Set([".m4v", ".mov", ".mp4", ".ogv", ".ogg", ".webm"]);

  function getMediaType(rawUrl) {
    try {
      const pathname = new URL(rawUrl, window.location.href).pathname.toLowerCase();
      const extensionStart = pathname.lastIndexOf(".");
      const extension = extensionStart >= 0 ? pathname.slice(extensionStart) : "";
      return videoExtensions.has(extension) ? "video" : "image";
    } catch {
      return "image";
    }
  }

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
      const type = getMediaType(url);
      items.push({
        id: `image-${index}`,
        url,
        label: params.get(`label${index}`)?.trim() || `${type === "video" ? "Video" : "Image"} ${index}`,
        type,
      });
    }
    return { items, title: "Media Comparison", selectedA: 0, selectedB: 1 };
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
        type: getMediaType(sourceUrl.href),
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
        || "Media Comparison",
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
        "Two media URLs are required.",
        "Pass two to four public image URLs, exactly two public video URLs, or load a JSON preset.",
        "?img1=<url>&img2=<url>  or  ?pres=./presets/smoke.json",
      );
      return;
    }
    if (items.some((item) => item.type === "video") && items.length !== 2) {
      showUsage(
        "Two video URLs are required.",
        "Video comparisons currently support exactly two items.",
        "?img1=<video-url>&img2=<video-url>",
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
      videoA: document.querySelector("#video-a"),
      videoB: document.querySelector("#video-b"),
      clipB: document.querySelector("#clip-b"),
      labelA: document.querySelector("#label-a"),
      labelB: document.querySelector("#label-b"),
      divider: document.querySelector("#divider"),
      dividerHandle: document.querySelector("#divider-handle"),
      zoomIndicator: document.querySelector("#zoom-indicator"),
      loading: document.querySelector("#loading"),
      error: document.querySelector("#load-error"),
      warning: document.querySelector("#aspect-warning"),
      viewMode: document.querySelector("#view-mode"),
      curtainMode: document.querySelector("#curtain-mode"),
      sideBySideMode: document.querySelector("#side-by-side-mode"),
      videoControls: document.querySelector("#video-controls"),
      videoShortcuts: document.querySelector("#video-shortcuts"),
      play: document.querySelector("#play-button"),
      progress: document.querySelector("#video-progress"),
      videoTime: document.querySelector("#video-time"),
      mute: document.querySelector("#mute-button"),
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
      mode: params.get("mode") === "side-by-side" ? "side-by-side" : "curtain",
      isSeeking: false,
      playbackRequested: false,
    };

    const comparisonTitle = params.get("title")?.trim() || comparison.title;
    elements.title.textContent = comparisonTitle;
    document.title = `${comparisonTitle} · Media Compare`;
    elements.viewMode.hidden = false;

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

    function getActiveMedia(side) {
      const item = items[side === "A" ? state.selectedA : state.selectedB];
      if (item.type === "video") return side === "A" ? elements.videoA : elements.videoB;
      return side === "A" ? elements.imageA : elements.imageB;
    }

    function getPanLimits(media, viewportWidth, viewportHeight) {
      const dimensions = getMediaDimensions(media);
      if (!dimensions.width || !dimensions.height || !viewportWidth || !viewportHeight) {
        return { x: 0, y: 0 };
      }

      const fitScale = Math.min(
        viewportWidth / dimensions.width,
        viewportHeight / dimensions.height,
      );
      return {
        x: Math.max(0, (dimensions.width * fitScale * state.zoom - viewportWidth) / 2),
        y: Math.max(0, (dimensions.height * fitScale * state.zoom - viewportHeight) / 2),
      };
    }

    function clampPan() {
      const viewportWidth = elements.stage.clientWidth / (state.mode === "side-by-side" ? 2 : 1);
      const viewportHeight = elements.stage.clientHeight;
      const limits = [
        getPanLimits(getActiveMedia("A"), viewportWidth, viewportHeight),
        getPanLimits(getActiveMedia("B"), viewportWidth, viewportHeight),
      ];
      const limitX = Math.min(...limits.map((limit) => limit.x));
      const limitY = Math.min(...limits.map((limit) => limit.y));
      state.panX = Math.min(limitX, Math.max(-limitX, state.panX));
      state.panY = Math.min(limitY, Math.max(-limitY, state.panY));
    }

    function setTransforms() {
      clampPan();
      const transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
      elements.planeA.style.transform = transform;
      elements.planeB.style.transform = transform;
    }

    function setMode(mode) {
      state.mode = mode;
      const isSideBySide = mode === "side-by-side";
      elements.stage.classList.toggle("is-side-by-side", isSideBySide);
      elements.curtainMode.classList.toggle("is-active", !isSideBySide);
      elements.sideBySideMode.classList.toggle("is-active", isSideBySide);
      elements.curtainMode.setAttribute("aria-pressed", String(!isSideBySide));
      elements.sideBySideMode.setAttribute("aria-pressed", String(isSideBySide));
      setTransforms();
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

    function getMediaDimensions(media) {
      if (media instanceof HTMLVideoElement) {
        return { width: media.videoWidth, height: media.videoHeight };
      }
      return { width: media.naturalWidth, height: media.naturalHeight };
    }

    function validateAspectRatio(mediaA, mediaB) {
      const dimensionsA = getMediaDimensions(mediaA);
      const dimensionsB = getMediaDimensions(mediaB);
      const ratioA = dimensionsA.width / dimensionsA.height;
      const ratioB = dimensionsB.width / dimensionsB.height;
      const difference = Math.abs(ratioA - ratioB) / Math.max(ratioA, ratioB);
      elements.warning.textContent = "Media have different aspect ratios";
      elements.warning.hidden = !Number.isFinite(difference) || difference < 0.005;
    }

    function clearMediaElement(media) {
      if (media instanceof HTMLVideoElement) media.pause();
      media.removeAttribute("src");
      if (media instanceof HTMLVideoElement) media.load();
      media.hidden = true;
    }

    function prepareMedia(side, item) {
      const image = side === "A" ? elements.imageA : elements.imageB;
      const video = side === "A" ? elements.videoA : elements.videoB;
      const active = item.type === "video" ? video : image;
      const inactive = item.type === "video" ? image : video;

      clearMediaElement(inactive);
      active.hidden = false;
      if (active instanceof HTMLImageElement) {
        active.alt = item.label;
      } else {
        active.setAttribute("aria-label", item.label);
        active.muted = side === "B" || elements.mute.getAttribute("aria-pressed") === "true";
      }
      return active;
    }

    function waitForMedia(media, item, generation) {
      return new Promise((resolve, reject) => {
        const loadEvent = media instanceof HTMLVideoElement ? "loadedmetadata" : "load";
        const onLoad = () => { cleanup(); resolve(); };
        const onError = () => {
          cleanup();
          if (generation === state.generation) {
            reject(new Error(`Failed to load ${item.label}`));
          }
          else resolve();
        };
        const cleanup = () => {
          media.removeEventListener(loadEvent, onLoad);
          media.removeEventListener("error", onError);
        };
        media.addEventListener(loadEvent, onLoad, { once: true });
        media.addEventListener("error", onError, { once: true });
        media.src = item.url;
        if (media instanceof HTMLVideoElement) media.load();

        const isReady = media instanceof HTMLVideoElement
          ? media.readyState >= HTMLMediaElement.HAVE_METADATA
          : media.complete;
        if (isReady) {
          queueMicrotask(() => {
            const dimensions = getMediaDimensions(media);
            if (dimensions.width > 0) onLoad();
            else onError();
          });
        }
      });
    }

    function getSelectedVideos() {
      const itemA = items[state.selectedA];
      const itemB = items[state.selectedB];
      if (itemA.type !== "video" || itemB.type !== "video") return [];
      return [elements.videoA, elements.videoB];
    }

    function getVideoDuration() {
      const durations = getSelectedVideos()
        .map((video) => video.duration)
        .filter((duration) => Number.isFinite(duration) && duration > 0);
      return durations.length === 2 ? Math.min(...durations) : 0;
    }

    function formatTime(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
      const wholeSeconds = Math.floor(seconds);
      const minutes = Math.floor(wholeSeconds / 60);
      const remainder = String(wholeSeconds % 60).padStart(2, "0");
      return `${minutes}:${remainder}`;
    }

    function updateVideoProgress() {
      const [videoA] = getSelectedVideos();
      const duration = getVideoDuration();
      const currentTime = Math.min(videoA?.currentTime || 0, duration || 0);
      elements.progress.max = String(duration);
      if (!state.isSeeking) elements.progress.value = String(currentTime);
      elements.videoTime.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }

    function updatePlaybackButton() {
      const [videoA] = getSelectedVideos();
      elements.play.textContent = videoA && !videoA.paused && !videoA.ended ? "Pause" : "Play";
    }

    function pauseVideos() {
      state.playbackRequested = false;
      elements.videoA.pause();
      elements.videoB.pause();
      updatePlaybackButton();
    }

    function configureVideoControls(itemA, itemB) {
      const isVideoPair = itemA.type === "video" && itemB.type === "video";
      elements.videoControls.hidden = !isVideoPair;
      elements.videoShortcuts.hidden = !isVideoPair;
      if (!isVideoPair) return;

      elements.videoA.muted = true;
      elements.videoB.muted = true;
      elements.mute.setAttribute("aria-pressed", String(elements.videoA.muted));
      elements.mute.textContent = elements.videoA.muted ? "Unmute" : "Mute";
      updateVideoProgress();
      updatePlaybackButton();
      void playVideos();
    }

    async function playVideos() {
      const videos = getSelectedVideos();
      if (videos.length !== 2) return;
      const [videoA, videoB] = videos;
      state.playbackRequested = true;
      const duration = getVideoDuration();
      if (videoA.ended || (duration && videoA.currentTime >= duration)) videoA.currentTime = 0;
      videoB.currentTime = videoA.currentTime;
      videoB.muted = true;
      await Promise.allSettled([videoA.play(), videoB.play()]);
      updatePlaybackButton();
    }

    async function togglePlayback() {
      const [videoA] = getSelectedVideos();
      if (!videoA) return;
      if (!videoA.paused && !videoA.ended) {
        pauseVideos();
        return;
      }
      await playVideos();
    }

    function restartVideos() {
      const videos = getSelectedVideos();
      if (videos.length !== 2 || !state.playbackRequested) return;
      for (const video of videos) video.currentTime = 0;
      void playVideos();
    }

    function seekVideos(nextTime) {
      const duration = getVideoDuration();
      if (!duration) return;
      const position = Math.max(0, Math.min(duration, nextTime));
      for (const video of getSelectedVideos()) video.currentTime = position;
      updateVideoProgress();
    }

    function toggleMute() {
      elements.videoA.muted = !elements.videoA.muted;
      elements.mute.setAttribute("aria-pressed", String(elements.videoA.muted));
      elements.mute.textContent = elements.videoA.muted ? "Unmute" : "Mute";
    }

    async function toggleFullscreen() {
      if (!document.fullscreenElement) await elements.viewer.requestFullscreen?.();
      else await document.exitFullscreen?.();
    }

    async function loadSelection({ reset = true } = {}) {
      const itemA = items[state.selectedA];
      const itemB = items[state.selectedB];
      const generation = ++state.generation;
      pauseVideos();
      elements.labelA.textContent = itemA.label;
      elements.labelB.textContent = itemB.label;
      elements.loading.hidden = false;
      elements.error.hidden = true;
      elements.warning.hidden = true;
      elements.videoControls.hidden = true;
      elements.videoShortcuts.hidden = true;
      if (reset) resetView();

      if (itemA.type !== itemB.type) {
        elements.loading.hidden = true;
        elements.error.textContent = "Select two images or two videos.";
        elements.error.hidden = false;
        return;
      }

      const mediaA = prepareMedia("A", itemA);
      const mediaB = prepareMedia("B", itemB);
      const results = await Promise.allSettled([
        waitForMedia(mediaA, itemA, generation),
        waitForMedia(mediaB, itemB, generation),
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
      configureVideoControls(itemA, itemB);
      validateAspectRatio(mediaA, mediaB);
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
    elements.fullscreen.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", () => {
      elements.fullscreen.textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
      setTransforms();
    });
    window.addEventListener("resize", setTransforms);
    elements.curtainMode.addEventListener("click", () => setMode("curtain"));
    elements.sideBySideMode.addEventListener("click", () => setMode("side-by-side"));

    elements.play.addEventListener("click", togglePlayback);
    elements.progress.addEventListener("input", () => {
      state.isSeeking = true;
      const nextTime = Number(elements.progress.value);
      seekVideos(nextTime);
    });
    elements.progress.addEventListener("change", () => {
      state.isSeeking = false;
      updateVideoProgress();
    });
    elements.mute.addEventListener("click", toggleMute);

    elements.videoA.addEventListener("timeupdate", () => {
      const [, videoB] = getSelectedVideos();
      const duration = getVideoDuration();
      if (duration && elements.videoA.currentTime >= duration) {
        restartVideos();
        updateVideoProgress();
        return;
      }
      if (videoB && Math.abs(videoB.currentTime - elements.videoA.currentTime) > 0.12) {
        videoB.currentTime = elements.videoA.currentTime;
      }
      updateVideoProgress();
    });
    elements.videoA.addEventListener("play", () => {
      const [, videoB] = getSelectedVideos();
      if (videoB?.paused) void videoB.play();
      updatePlaybackButton();
    });
    elements.videoA.addEventListener("pause", () => {
      const [, videoB] = getSelectedVideos();
      videoB?.pause();
      updatePlaybackButton();
    });
    elements.videoA.addEventListener("ended", restartVideos);
    elements.videoA.addEventListener("durationchange", updateVideoProgress);

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
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof Element && (
        target.isContentEditable
        || target.closest("input, textarea, select, button, a[href], [role='slider']")
      )) return;

      if (event.code === "KeyR" || event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetView();
        setDivider(50);
        return;
      }

      if (event.code === "KeyF") {
        event.preventDefault();
        if (!event.repeat) void toggleFullscreen();
        return;
      }

      const [videoA] = getSelectedVideos();
      if (!videoA || elements.videoControls.hidden) return;
      switch (event.code) {
        case "Space":
        case "KeyK":
          event.preventDefault();
          if (!event.repeat) void togglePlayback();
          break;
        case "ArrowLeft":
        case "ArrowRight":
        case "KeyJ":
        case "KeyL": {
          event.preventDefault();
          const offset = { ArrowLeft: -5, ArrowRight: 5, KeyJ: -10, KeyL: 10 }[event.code];
          seekVideos(videoA.currentTime + offset);
          break;
        }
        case "KeyM":
          event.preventDefault();
          if (!event.repeat) toggleMute();
          break;
      }
    });

    populateSelects();
    setMode(state.mode);
    setDivider(50);
    setTransforms();
    loadSelection();
  }

  init();
})();
