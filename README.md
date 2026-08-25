# Image Compare

A dependency-free static viewer for comparing images in the browser. It supports a draggable vertical divider, synchronized zoom and pan, grouped A/B selection, JSON presets, fullscreen mode, keyboard controls, and mouse or touch input.

The viewer is plain HTML, CSS, and JavaScript. It has no build step, backend, database, upload service, or runtime dependencies. Images and preset files remain at their original URLs; the viewer only loads them in the browser.

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

1. Put two to four image URLs directly in the page URL with `img1`, `img2`, and optional `img3` and `img4`.
2. Put any number of images in a JSON preset and pass its URL through `pres`. A preset can also contain several named views.

The comparison is defined entirely by its URL. The viewer does not create or store a share record.

## Direct image URLs

At minimum, provide `img1` and `img2`:

```text
?img1=<public-image-url>&img2=<public-image-url>
```

Optional `label1` through `label4` values control the labels displayed on the images. The optional `title` parameter overrides the page title.

| Parameter | Required | Description |
| --- | --- | --- |
| `img1` | Yes | First public image URL |
| `img2` | Yes | Second public image URL |
| `img3`, `img4` | No | Additional public image URLs |
| `label1`–`label4` | No | Labels for the corresponding images |
| `title` | No | Comparison title |

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

Image `src` values inside a preset are resolved relative to the JSON file itself, not relative to `index.html`. This lets a preset and its images move together without changing the viewer.

An external preset server must allow the viewer's origin through CORS. The images themselves must also be publicly loadable by a browser. Same-origin presets, such as files stored in this repository, need no additional CORS configuration.

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

Each image needs:

- `id`: a unique, non-empty identifier used by views.
- `src`: a relative or absolute HTTP(S) image URL.

`label` is optional and defaults to `id`. `group` is optional; images with the same group appear together in the A/B selectors.

Each view may use `"images": "*"` for every image or an array of image IDs for a subset. A view must resolve to at least two images. `defaultA` and `defaultB` are optional; if either is missing or invalid, the viewer chooses two different images automatically.

Preset files are validated in the browser. Duplicate IDs, unknown image IDs, unsupported URL protocols, invalid views, and failed network requests are shown as readable errors.

## Included smoke preset

The included [smoke.json](./presets/smoke.json) contains four selector groups: Flashlights, Settings, Types, and IR. It exposes five views:

| View | Contents | Default comparison |
| --- | --- | --- |
| `all` | Every image in all four groups | LAS/TAC 2 vs Baldr Pro |
| `flashlites` | Combined devices and dedicated flashlights | LAS/TAC 2 vs Baldr Pro |
| `settings` | Original, Low, Medium, High, and Ultra | Original vs Low |
| `types` | RDG-2B and M18 | RDG-2B vs M18 |
| `ir` | LAS/TAC 2 reference and IR devices | LAS/TAC 2 vs IR light |

Published URLs:

```text
https://thetimmytook.github.io/media/?pres=./presets/smoke.json
https://thetimmytook.github.io/media/?pres=./presets/smoke.json&view=flashlites
https://thetimmytook.github.io/media/?pres=./presets/smoke.json&view=settings
https://thetimmytook.github.io/media/?pres=./presets/smoke.json&view=types
https://thetimmytook.github.io/media/?pres=./presets/smoke.json&view=ir
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

- **Wheel**: zoom from the center of the viewport. The current percentage temporarily replaces the divider handle icon.
- **Drag**: pan both images together.
- **Double-click**: reset zoom and pan.
- **R**: reset zoom, pan, and the divider to its centered default.
- **Divider drag**: reveal more of either image.
- **Left/Right Arrow** while the divider is focused: move it precisely; hold **Shift** for larger steps.

No files, comparison state, or analytics are uploaded or stored by the viewer.
