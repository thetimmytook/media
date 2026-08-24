# Image Compare

A dependency-free static viewer for comparing two to four images from public URLs. It supports a draggable vertical divider, synchronized zoom and pan, A/B selection, labels, fullscreen mode, keyboard controls, and mobile pointer input.

The repository also contains the screenshots used in published comparisons.

## Run locally

Serve the repository with any static HTTP server. For example:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/` with comparison parameters.

## GitHub Pages

In the repository settings, enable GitHub Pages deployment from the `main` branch and repository root. The viewer will be available at:

```text
https://thetimmytook.github.io/media/
```

## URL parameters

| Parameter | Required | Description |
| --- | --- | --- |
| `title` | No | Comparison title |
| `img1` | Yes | First public image URL |
| `label1` | No | First image label |
| `img2` | Yes | Second public image URL |
| `label2` | No | Second image label |
| `img3`, `img4` | No | Additional image URLs |
| `label3`, `label4` | No | Additional image labels |

Image URLs must be URL encoded when inserted into the query string.

## Two-image example

```text
https://thetimmytook.github.io/media/?title=Flashlights&img1=https%3A%2F%2Fthetimmytook.github.io%2Fmedia%2Fscreens%2Fsmoke%2Fflashlites%2Fcombo%2Flas-tac2.png&label1=LAS%2FTAC%202&img2=https%3A%2F%2Fthetimmytook.github.io%2Fmedia%2Fscreens%2Fsmoke%2Fflashlites%2Fdedicated%2Fm600.png&label2=M600
```

## Four-image example

```text
https://thetimmytook.github.io/media/?title=Smoke%20Settings&img1=https%3A%2F%2Fthetimmytook.github.io%2Fmedia%2Fscreens%2Fsmoke%2Fsettings%2Flow.png&label1=Low&img2=https%3A%2F%2Fthetimmytook.github.io%2Fmedia%2Fscreens%2Fsmoke%2Fsettings%2Fmedium.png&label2=Medium&img3=https%3A%2F%2Fthetimmytook.github.io%2Fmedia%2Fscreens%2Fsmoke%2Fsettings%2Fhigh.png&label3=High&img4=https%3A%2F%2Fthetimmytook.github.io%2Fmedia%2Fscreens%2Fsmoke%2Fsettings%2Fultra.png&label4=Ultra
```

## Controls

- Drag the divider to reveal either image.
- Use the mouse wheel to zoom around the cursor.
- Drag the viewport to pan.
- Double-click or press `R` to reset zoom and pan.
- Focus the divider and use the arrow keys for precise movement (`Shift` for larger steps).

No files or comparison state are uploaded or stored by the viewer.
