/* rs-phoneui-shared.js — canvas stream generators shared by phoneui-direct and phoneui-cloud.
 *
 * Usage:
 *   phoneui-cloud.html  →  <script src="rs-phoneui-shared.js"></script>  (direct script tag)
 *   phoneui-direct.html →  <!-- @@shared-js --> placeholder replaced at template-load time
 *                          by _load_html_template() in src/main.py
 *
 * PyInstaller: site/phoneui/rs-phoneui-shared.js is copied to the 'phoneui' data directory
 *              by rollshare.spec so _load_html_template() can read it from sys._MEIPASS.
 *
 * Exposes: window.RsDevGenerators
 *   .startNoise()            → MediaStream | null   (160×120 per-pixel noise)
 *   .startBlocksS()          → MediaStream | null   (160×120 8×8 colour blocks)
 *   .startBlocksL()          → MediaStream | null   (640×480 8×8 colour blocks)
 *   .stopNoise()             → void                 (stops whichever noise/blocks stream is active)
 *   .getCaptureStream(video) → MediaStream | null   (wraps video.captureStream or canvas fallback)
 *   .stopCaptureStream()     → void
 */
window.RS_JS_BUILD_TIME = '2026-07-15 22:43 UTC';

window.RsDevGenerators = (function () {
    'use strict';

    /* ── Noise / blocks state ─────────────────────────────────────────────── */
    var _noiseCanvas  = null;
    var _noiseInterval = null; /* unused after rAF switch; kept for legacy stopNoise call */
    var _noiseStream  = null;
    var _noiseActive  = false;

    /* ── captureStream-from-video fallback state ──────────────────────────── */
    var _captureCanvas    = null;
    var _canvasDrawHandle = null;

    /* Pure per-pixel noise (worst-case for encoder, higher bitrate demand) */
    function startNoise() {
        _noiseCanvas = document.createElement('canvas');
        _noiseCanvas.width = 160; _noiseCanvas.height = 120;
        _noiseCanvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;';
        document.body.appendChild(_noiseCanvas);
        var ctx = _noiseCanvas.getContext('2d');
        if (typeof _noiseCanvas.captureStream !== 'function') return null;
        _noiseStream = _noiseCanvas.captureStream(30);
        var imgData = ctx.createImageData(160, 120);
        var buf = new Uint8Array(160 * 120 * 4);
        _noiseActive = true;
        function drawFrame() {
            if (!_noiseActive) return;
            for (var i = 0; i < buf.length; i += 65536) {
                crypto.getRandomValues(buf.subarray(i, Math.min(i + 65536, buf.length)));
            }
            for (var j = 3; j < buf.length; j += 4) buf[j] = 255;
            imgData.data.set(buf);
            ctx.putImageData(imgData, 0, 0);
            requestAnimationFrame(drawFrame);
        }
        requestAnimationFrame(drawFrame);
        return _noiseStream;
    }

    /* 8×8 macroblock noise — small (160×120) */
    function startBlocksS() {
        _noiseCanvas = document.createElement('canvas');
        _noiseCanvas.width = 160; _noiseCanvas.height = 120;
        _noiseCanvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;';
        document.body.appendChild(_noiseCanvas);
        var ctx = _noiseCanvas.getContext('2d');
        if (typeof _noiseCanvas.captureStream !== 'function') return null;
        _noiseStream = _noiseCanvas.captureStream(30);
        _noiseActive = true;
        function drawFrame() {
            if (!_noiseActive) return;
            for (var by = 0; by < 15; by++) {
                for (var bx = 0; bx < 20; bx++) {
                    ctx.fillStyle = 'rgb(' + (Math.random()*255|0) + ',' + (Math.random()*255|0) + ',' + (Math.random()*255|0) + ')';
                    ctx.fillRect(bx * 8, by * 8, 8, 8);
                }
            }
            requestAnimationFrame(drawFrame);
        }
        requestAnimationFrame(drawFrame);
        return _noiseStream;
    }

    /* 8×8 macroblock noise — large (640×480) */
    function startBlocksL() {
        _noiseCanvas = document.createElement('canvas');
        _noiseCanvas.width = 640; _noiseCanvas.height = 480;
        _noiseCanvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;';
        document.body.appendChild(_noiseCanvas);
        var ctx = _noiseCanvas.getContext('2d');
        if (typeof _noiseCanvas.captureStream !== 'function') return null;
        _noiseStream = _noiseCanvas.captureStream(30);
        _noiseActive = true;
        function drawFrame() {
            if (!_noiseActive) return;
            for (var by = 0; by < 60; by++) {
                for (var bx = 0; bx < 80; bx++) {
                    ctx.fillStyle = 'rgb(' + (Math.random()*255|0) + ',' + (Math.random()*255|0) + ',' + (Math.random()*255|0) + ')';
                    ctx.fillRect(bx * 8, by * 8, 8, 8);
                }
            }
            requestAnimationFrame(drawFrame);
        }
        requestAnimationFrame(drawFrame);
        return _noiseStream;
    }

    function stopNoise() {
        _noiseActive = false;
        if (_noiseInterval !== null) { clearInterval(_noiseInterval); _noiseInterval = null; }
        if (_noiseStream) { _noiseStream.getTracks().forEach(function (t) { t.stop(); }); _noiseStream = null; }
        if (_noiseCanvas) { try { _noiseCanvas.remove(); } catch(e) {} _noiseCanvas = null; }
    }

    function getCaptureStream(videoEl) {
        if (typeof videoEl.captureStream === 'function') return videoEl.captureStream();
        if (typeof videoEl.mozCaptureStream === 'function') return videoEl.mozCaptureStream();
        if (!_captureCanvas) {
            _captureCanvas = document.createElement('canvas');
            _captureCanvas.style.display = 'none';
            document.body.appendChild(_captureCanvas);
        }
        _captureCanvas.width  = videoEl.videoWidth  || 640;
        _captureCanvas.height = videoEl.videoHeight || 480;
        var ctx = _captureCanvas.getContext('2d');
        if (typeof _captureCanvas.captureStream !== 'function') return null;
        var stream = _captureCanvas.captureStream(30);
        function draw() {
            if (!videoEl.paused && !videoEl.ended) ctx.drawImage(videoEl, 0, 0, _captureCanvas.width, _captureCanvas.height);
            _canvasDrawHandle = requestAnimationFrame(draw);
        }
        draw();
        return stream;
    }

    function stopCaptureStream() {
        if (_canvasDrawHandle !== null) { cancelAnimationFrame(_canvasDrawHandle); _canvasDrawHandle = null; }
    }

    return {
        startNoise: startNoise,
        startBlocksS: startBlocksS,
        startBlocksL: startBlocksL,
        stopNoise: stopNoise,
        getCaptureStream: getCaptureStream,
        stopCaptureStream: stopCaptureStream,
    };
})();

/* ─────────────────────────────────────────────────────────────────────────────
 * RsCameraSelector — shared camera-enumeration and stream helpers.
 *
 * Usage (both pages):
 *   .openStreamForDevice(deviceId)            → Promise<MediaStream>
 *   .hasTorchCapability(track)                → boolean
 *   .deviceIdFromTrack(track)                 → string | null
 *   .probeTorchIds(inputs, IS_IOS, videoTrack) → Promise<Set<string>>
 *   .populateSelectEl(sel, selectedId, inputs, torchIds) → string (resolved value)
 *   .getPreferredIosCamera(videoInputs)        → MediaDeviceInfo | null
 *
 * Rotation contract (both pages):
 *   The <video> element always has CSS `transform: rotate(180deg)` to correct for
 *   the phone held face-down over the dice tray. The page-rotation toggle only
 *   controls the UI wrapper orientation — it does NOT affect the video transform or
 *   canvas frame sampling.  Canvas helpers (e.g. drawCoverTop) should always apply
 *   the same 180° rotation regardless of the rs_page_rotated localStorage value.
 * ──────────────────────────────────────────────────────────────────────────── */
window.RsCameraSelector = (function () {
    'use strict';

    /* Standard video constraints for the dice-camera use case (320×240 @ 12 fps). */
    function openStreamForDevice(deviceId) {
        var vc = {
            width:       { ideal: 320, min: 160, max: 640 },
            height:      { ideal: 240, min: 120, max: 480 },
            aspectRatio: { ideal: 4/3 },
            frameRate:   { ideal: 12, max: 15 },
        };
        if (deviceId) vc.deviceId = { exact: deviceId };
        else          vc.facingMode = { ideal: 'environment' };
        return navigator.mediaDevices.getUserMedia({ video: vc, audio: false });
    }

    /* Returns true if the track's capabilities include the 'torch' constraint. */
    function hasTorchCapability(track) {
        if (!track || !track.getCapabilities) return false;
        return 'torch' in (track.getCapabilities() || {});
    }

    /* Returns the deviceId reported by the track's settings, or null on failure. */
    function deviceIdFromTrack(track) {
        try {
            return ((track && track.getSettings ? track.getSettings() : {}).deviceId) || null;
        } catch (_) { return null; }
    }

    /* Probe which devices in `inputs` support torch.
     * On iOS only the active track is inspected (multi-camera probe ends the preview). */
    async function probeTorchIds(inputs, IS_IOS, activeTrack) {
        var ids = new Set();
        if (IS_IOS) {
            if (activeTrack && hasTorchCapability(activeTrack)) {
                var aid = deviceIdFromTrack(activeTrack);
                if (aid) ids.add(aid);
            }
            return ids;
        }
        for (var i = 0; i < inputs.length; i++) {
            var ps = null;
            try {
                ps = await openStreamForDevice(inputs[i].deviceId);
                var t = ps.getVideoTracks()[0] || null;
                if (hasTorchCapability(t)) ids.add(inputs[i].deviceId);
            } catch (_) {
            } finally {
                if (ps) ps.getTracks().forEach(function (t) { t.stop(); });
            }
        }
        return ids;
    }

    /* Populate a native <select> element with camera options.
     * Returns the value that was set on the select ('' = default rear camera). */
    function populateSelectEl(selectEl, selectedId, inputs, torchIds) {
        selectEl.innerHTML = '';
        var def = document.createElement('option');
        def.value = ''; def.textContent = 'Default rear camera';
        selectEl.appendChild(def);
        if (!inputs.length) {
            var none = document.createElement('option');
            none.value = ''; none.textContent = 'No camera found';
            selectEl.appendChild(none);
        }
        var n = 1;
        for (var i = 0; i < inputs.length; i++) {
            var d = inputs[i];
            var o = document.createElement('option');
            o.value = d.deviceId;
            var lbl = d.label || ('Camera ' + n++);
            o.textContent = (torchIds && torchIds.has(d.deviceId)) ? lbl + ' \uD83D\uDD26' : lbl;
            selectEl.appendChild(o);
        }
        var target = selectedId || '';
        var found = Array.from(selectEl.options).some(function (o) { return o.value === target; });
        selectEl.value = found ? target : '';
        return selectEl.value;
    }

    /* iOS: prefer a rear non-Wide camera for a tighter overhead dice-tray view.
     * Returns the matching MediaDeviceInfo, or null if none found. */
    function getPreferredIosCamera(videoInputs) {
        return videoInputs.find(function (d) {
            var lbl = (d.label || '').toLowerCase();
            if (!lbl) return false;
            if (!(lbl.includes('back') || lbl.includes('rear') || lbl.includes('environment'))) return false;
            return !lbl.includes('wide');
        }) || null;
    }

    /* Build/refresh camera option buttons in panelEl from selectEl's current options.
     * Clicking a button updates selectEl.value, fires a 'change' event on selectEl,
     * updates faceEl text, marks the button selected, and closes the panel.
     * Call this after populateSelectEl whenever the camera list changes.
     * Buttons use class 'cam-picker-option'; host page is responsible for CSS. */
    function populatePickerPanel(panelEl, selectEl, faceEl) {
        panelEl.innerHTML = '';
        var opts = Array.from(selectEl.options);
        opts.forEach(function(opt) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cam-picker-option' + (opt.value === selectEl.value ? ' selected' : '');
            btn.textContent = opt.textContent;
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                selectEl.value = opt.value;
                faceEl.textContent = opt.textContent;
                Array.from(panelEl.querySelectorAll('.cam-picker-option')).forEach(function(b) {
                    b.classList.remove('selected');
                });
                btn.classList.add('selected');
                panelEl.classList.remove('open');
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            });
            panelEl.appendChild(btn);
        });
    }

    return {
        openStreamForDevice:   openStreamForDevice,
        hasTorchCapability:    hasTorchCapability,
        deviceIdFromTrack:     deviceIdFromTrack,
        probeTorchIds:         probeTorchIds,
        populateSelectEl:      populateSelectEl,
        populatePickerPanel:   populatePickerPanel,
        getPreferredIosCamera: getPreferredIosCamera,
    };
})();
