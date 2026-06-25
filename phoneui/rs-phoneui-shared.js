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
