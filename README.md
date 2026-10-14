# Media Compare

A dependency-free static viewer for comparing images and videos in the browser. It supports curtain and side-by-side layouts, synchronized video playback, synchronized zoom and pan, grouped A/B selection, JSON presets, fullscreen mode, keyboard controls, and mouse or touch input.

The viewer is plain HTML, CSS, and JavaScript. It has no build step, backend, database, upload service, or runtime dependencies. Media and preset files remain at their original URLs; the viewer only loads them in the browser.

## Run locally

The project must be served over HTTP because browsers do not allow a page opened with `file://` to fetch JSON presets reliably.

With the VS Code Live Server extension, open the repository root and choose **Open with Live Server**. Its usual URL is:

```text
http://localhost:5500/
```

You can also use any static HTTP server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/` with one of the query strings described below.

## GitHub Pages

Enable GitHub Pages deployment from the `main` branch and repository root. This repository is then available at:

```text
https://thetimmytook.github.io/media/
```

## URL modes

There are two ways to create a comparison:

1. Put two to four image URLs, or exactly two video URLs, directly in the page URL with `img1`, `img2`, and optional `img3` and `img4`.
2. Put media URLs in a JSON preset and pass its URL through `pres`. A preset can also contain several named views. The existing `images` array is used for both media types.

The comparison is defined entirely by its URL. The viewer does not create or store a share record.

## Direct media URLs

At minimum, provide `img1` and `img2`:

```text
?img1=<public-image-url>&img2=<public-image-url>
```

Optional `label1` through `label4` values control the labels displayed on the media. The optional `title` parameter overrides the page title.

| Parameter | Required | Description |
| --- | --- | --- |
| `img1` | Yes | First public image or video URL |
| `img2` | Yes | Second public image or video URL |
| `img3`, `img4` | No | Additional public image URLs; not supported for video comparisons |
| `label1`–`label4` | No | Labels for the corresponding media |
| `title` | No | Comparison title |
| `mode` | No | Initial layout: `curtain` (default) or `side-by-side` |

All values must be URL encoded when they contain characters such as `:`, `/`, spaces, `?`, or `&`. In JavaScript, use `encodeURIComponent(value)`. With `URLSearchParams`, encoding is handled automatically:

```js
const query = new URLSearchParams({
  title: "Flashlights",
  img1: "https://example.com/before.png",
  label1: "Before",
  img2: "https://example.com/after.png",
  label2: "After",
});

const shareUrl = `https://example.com/compare/?${query}`;
```

Example:

```text
https://thetimmytook.github.io/media/?title=Flashlights&img1=https%3A%2F%2Fthetimmytook.github.io%2Fmedia%2Fscreens%2Fsmoke%2Fflashlites%2Fcombo%2Flas-tac2.png&label1=LAS%2FTAC%202&img2=https%3A%2F%2Fthetimmytook.github.io%2Fmedia%2Fscreens%2Fsmoke%2Fflashlites%2Fdedicated%2Fm600.png&label2=M600
```

Video URLs use the same parameters:

```text
https://thetimmytook.github.io/media/?img1=https%3A%2F%2Fcdn.example.com%2Fbefore.mp4&img2=https%3A%2F%2Fcdn.example.com%2Fafter.mp4&mode=side-by-side
```

Supported video URL extensions are `.mp4`, `.webm`, `.ogg`, `.ogv`, `.mov`, and `.m4v`. The browser must support the actual codec, and both URLs must be publicly accessible. Video comparisons contain exactly two videos; image/video pairs are rejected. Both videos start muted and loop in sync automatically. When unmuted, audio is played from side A only to avoid duplicate sound.

## JSON presets

Use `pres` to load a preset file. The preset URL may be relative to the viewer or an absolute public URL:

```text
?pres=./presets/smoke.json
?pres=https://cdn.example.com/comparisons/demo.json
```

Use `view` to select one named subset from the same preset:

```text
?pres=./presets/smoke.json&view=ir
```

| Parameter | Required | Description |
| --- | --- | --- |
| `pres` | Yes in preset mode | Relative or absolute URL of a JSON preset |
| `view` | No | Named view from the preset; defaults to `all`, or the first declared view |
| `title` | No | Overrides the title from the selected view or preset |
| `mode` | No | Initial layout: `curtain` (default) or `side-by-side` |

Media `src` values inside a preset are resolved relative to the JSON file itself, not relative to `index.html`. This lets a preset and its media files move together without changing the viewer.

An external preset server must allow the viewer's origin through CORS. The media files themselves must also be publicly loadable by a browser. Same-origin presets, such as files stored in this repository, need no additional CORS configuration.

### Preset format

```json
{
  "title": "Example Comparison",
  "images": [
    {
      "id": "reference",
      "label": "Reference",
      "group": "Lights",
      "src": "../screens/reference.png"
    },
    {
      "id": "candidate",
      "label": "Candidate",
      "group": "Lights",
      "src": "../screens/candidate.png"
    },
    {
      "id": "alternate",
      "label": "Alternate",
      "group": "Other",
      "src": "https://cdn.example.com/alternate.png"
    }
  ],
  "views": {
    "all": {
      "title": "All Images",
      "images": "*",
      "defaultA": "reference",
      "defaultB": "candidate"
    },
    "shortlist": {
      "title": "Shortlist",
      "images": ["reference", "alternate"],
      "defaultA": "reference",
      "defaultB": "alternate"
    }
  }
}
```

Each item needs:

- `id`: a unique, non-empty identifier used by views.
- `src`: a relative or absolute HTTP(S) image or video URL.

`label` is optional and defaults to `id`. `group` is optional; items with the same group appear together in the A/B selectors. Video items use the same `images` array and fields as image items, so existing JSON configuration does not change.

Each view may use `"images": "*"` for every image or an array of image IDs for a subset. A view must resolve to at least two images. `defaultA` and `defaultB` are optional; if either is missing or invalid, the viewer chooses two different images automatically.

Preset files are validated in the browser. Duplicate IDs, unknown image IDs, unsupported URL protocols, invalid views, and failed network requests are shown as readable errors.

## Included graphics settings presets

Graphics comparisons are organized by setting, then map, then camera position. Media files live under `screens/settings/<setting>/<map>/`, with an extra scene folder when a map has several viewpoints. Each setting has its own JSON file under `presets/settings/`.

Select a map or scene with `view`. Each view contains only values captured at that camera position, so the two panels compare the same scene. Without `view`, the first scene in the preset is selected. Comparisons open in Curtain mode by default. Static-image comparisons use Curtain unless a side-by-side layout is explicitly requested. The layout buttons remain available for switching modes.

```text
?pres=./presets/settings/lod.json&view=customs
?pres=./presets/settings/lod.json&view=streets
```

| Setting / preset | Map or scene (`view`) | Values | Open comparison |
| --- | --- | --- | --- |
| [Anisotropic Filtering](./presets/settings/anisotropic.json) | Factory (`factory`) | Off, On | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/anisotropic.json&view=factory) |
| [Antialiasing](./presets/settings/antialiasing.json) | Reserve (`reserve`) | Off, TAA High | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/antialiasing.json&view=reserve) |
| [DLSS](./presets/settings/dlss.json) | Factory (`factory`) | Off, On | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/dlss.json&view=factory) |
| [HBAO](./presets/settings/hbao.json) | Factory — Scene 3 (`factory-3`) | Off, Max Performance, Colored Ultra | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/hbao.json&view=factory-3) |
|  | Factory — Scene 1 (`factory-1`) | Off, Colored Ultra | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/hbao.json&view=factory-1) |
|  | Factory — Scene 2 (`factory-2`) | Off, Colored Ultra | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/hbao.json&view=factory-2) |
| [LOD](./presets/settings/lod.json) | Customs (`customs`) | LOD 2, LOD 4 | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/lod.json&view=customs) |
|  | Streets of Tarkov (`streets`) | LOD 2, LOD 4 | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/lod.json&view=streets) |
| [Resampling](./presets/settings/resampling.json) | Woods (`woods`) | 0.5x, 1x, 4x | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/resampling.json&view=woods) |
| [Shadow Quality](./presets/settings/shadows.json) | Customs (`customs`) | Low, Ultra | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/shadows.json&view=customs) |
| [Sharpness](./presets/settings/sharpness.json) | Factory (`factory`) | 0, 0.6, 3.0 | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/sharpness.json&view=factory) |
| [Screen Space Reflections](./presets/settings/ssr.json) | Streets of Tarkov (`streets`) | Off, Ultra | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/ssr.json&view=streets) |
| [Overall Visibility](./presets/settings/visibility.json) | Lighthouse — Chalets (`lighthouse-chalets`) | 400, 3000 | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/visibility.json&view=lighthouse-chalets) |
|  | Reserve — Radar (`reserve-radar`) | 400, 3000 | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/visibility.json&view=reserve-radar) |
|  | Woods — Scene 1 (`woods-1`) | 400, 3000 | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/visibility.json&view=woods-1) |
|  | Woods — Scene 2 (`woods-2`) | 400, 3000 | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/visibility.json&view=woods-2) |
|  | Woods — Scene 3 (`woods-3`) | 400, 3000 | [Curtain](https://thetimmytook.github.io/media/?pres=./presets/settings/visibility.json&view=woods-3) |

Antialiasing, DLSS, and LOD use the finalized H.264 MP4 exports; the remaining settings use PNG screenshots. The earlier two-video smoke test has been replaced by these graphics presets. Every video view contains exactly two videos.

## Included smoke preset

The included [smoke.json](./presets/smoke.json) contains five selector groups: Flashlights, Settings, Types, IR, and 45° Peripheral Vision. It exposes six views:

| View | Contents | Default comparison |
| --- | --- | --- |
| `all` | Every image in all five groups | LAS/TAC 2 vs Baldr Pro |
| `flashlites` | Combined devices and dedicated flashlights | LAS/TAC 2 vs Baldr Pro |
| `settings` | Original, Low, Medium, High, and Ultra | Original vs Low |
| `types` | RDG-2B and M18 | RDG-2B vs M18 |
| `ir` | LAS/TAC 2 reference and IR devices | LAS/TAC 2 vs IR light |
| `45deg` | Flashlight visibility at a 45° viewing angle | X400 Original vs X400 |

Published URLs:

```text
https://thetimmytook.github.io/media/?pres=./presets/smoke.json
https://thetimmytook.github.io/media/?pres=./presets/smoke.json&view=flashlites
https://thetimmytook.github.io/media/?pres=./presets/smoke.json&view=settings
https://thetimmytook.github.io/media/?pres=./presets/smoke.json&view=types
https://thetimmytook.github.io/media/?pres=./presets/smoke.json&view=ir
https://thetimmytook.github.io/media/?pres=./presets/smoke.json&view=45deg
```

## Included gun mount vs helmet preset

The included [gun-mount-vs-helm.json](./presets/gun-mount-vs-helm.json) compares the LAS/TAC 2 flashlight mounted on a gun and on a helmet.

```text
https://thetimmytook.github.io/media/?pres=./presets/gun-mount-vs-helm.json
```

## Included CS2 gas preset

The included [cs2-gas.json](./presets/cs2-gas.json) compares gas visibility through FLIR and T-7 thermal devices. Its `all` view contains all four images, while the `flir` and `t7` views provide direct two-image comparisons.

```text
https://thetimmytook.github.io/media/?pres=./presets/cs2-gas.json
https://thetimmytook.github.io/media/?pres=./presets/cs2-gas.json&view=flir
https://thetimmytook.github.io/media/?pres=./presets/cs2-gas.json&view=t7
```

## Included PvP smoke preset

The included [pvp-smoke.json](./presets/pvp-smoke.json) compares 13 flashlights across three PvP smoke scenarios: the attacker in smoke, both players in smoke, and the local player in smoke.

```text
https://thetimmytook.github.io/media/?pres=./presets/pvp-smoke.json
https://thetimmytook.github.io/media/?pres=./presets/pvp-smoke.json&view=attacker-in-smoke
https://thetimmytook.github.io/media/?pres=./presets/pvp-smoke.json&view=both-in-smoke
https://thetimmytook.github.io/media/?pres=./presets/pvp-smoke.json&view=me-in-smoke
```

## Legacy preset aliases

Existing links continue to work. These aliases map internally to the included JSON preset and its views:

| Alias | Equivalent JSON URL |
| --- | --- |
| `?preset=smoke` | `?pres=./presets/smoke.json&view=all` |
| `?preset=smoke-flashlites` | `?pres=./presets/smoke.json&view=flashlites` |
| `?preset=smoke-settings` | `?pres=./presets/smoke.json&view=settings` |
| `?preset=smoke-types` | `?pres=./presets/smoke.json&view=types` |
| `?preset=smoke-ir` | `?pres=./presets/smoke.json&view=ir` |

Use `pres` and `view` for new presets. The `preset` parameter exists only for these built-in backward-compatible aliases.

## Controls

- **Curtain / Side by side**: switch between the draggable overlay and two adjacent panels.
- **Play / Pause**: control both videos together. Seeking keeps their positions synchronized.
- **Mute / Unmute**: control audio from side A; side B always remains muted.
- **Space / K**: play or pause both videos. Holding the key does not repeatedly toggle playback.
- **Left/Right Arrow**: seek both videos backward/forward by 5 seconds; **J/L** seek by 10 seconds. Seeking while paused keeps playback paused, including at the end of a clip.
- **M**: mute or unmute audio from side A.
- **F**: enter or exit fullscreen.
- **Wheel**: zoom from the center of the viewport. The current percentage temporarily replaces the divider handle icon.
- **Pinch**: zoom with two fingers on a touchscreen; moving both fingers also pans the images.
- **Drag**: pan both images together.
- **Double-click**: reset zoom and pan.
- **R**: reset zoom, pan, and the divider to its centered default.
- **Divider drag**: reveal more of either image.
- **Left/Right Arrow** while the divider is focused: move it precisely; hold **Shift** for larger steps.

Global shortcuts do not override focused menus, inputs, buttons, links, or editable text. A focused control keeps its normal keyboard behavior, such as Space activating a button or arrow keys adjusting a slider.

No files, comparison state, or analytics are uploaded or stored by the viewer.
