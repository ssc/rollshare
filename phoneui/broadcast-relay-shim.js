/**
 * broadcast_relay_shim.js
 *
 * Drop-in replacement for window.supabase that routes Broadcast messages
 * through the devmode Phoenix relay instead of Supabase Realtime.
 *
 * Usage (load BEFORE phoneui-cloud.html's own scripts):
 *
 *   <script src="https://localhost:8080/devmode/broadcast-relay/shim.js"></script>
 *
 * The shim reads the relay URL from:
 *   window.ROLLSHARE_RELAY_URL  — set this before loading the shim, OR
 *   the default ws://localhost:8080/devmode/broadcast-relay
 *
 * What it replaces:
 *   window.supabase.createClient()  → returns a fake client
 *   client.channel(name)            → returns a channel backed by the relay WS
 *   channel.on(type, filter, cb)    → registers an inbound broadcast handler
 *   channel.subscribe(cb)           → connects WS, joins Phoenix topic, fires cb('SUBSCRIBED')
 *   channel.send(payload)           → sends broadcast frame over WS
 *   client.auth.signInAnonymously() → resolves immediately with a stub user
 *   client.storage.from(bucket)     → stub upload/download/remove (no-op, success)
 *
 * The relay echoes any broadcast message to all OTHER subscribers on the same
 * topic, so the Companion (connected via ROLLSHARE_BROADCAST_URL) will receive
 * every frame the phone sends.
 *
 * Heartbeat simulation:
 *   If no real Companion is connected the phone's zombie detector will fire.
 *   The shim starts a fake heartbeat interval (SHIM_HEARTBEAT_INTERVAL_MS) so
 *   the phone page stays alive during pure-UI iteration without a Companion.
 *   Set window.ROLLSHARE_SHIM_FAKE_HEARTBEAT = false to disable.
 */
(function () {
  "use strict";

  var RELAY_URL = (window.ROLLSHARE_RELAY_URL) ||
                  "ws://localhost:8080/devmode/broadcast-relay";

  var FAKE_HEARTBEAT = (window.ROLLSHARE_SHIM_FAKE_HEARTBEAT !== false);
  var HEARTBEAT_INTERVAL_MS = 14000;  // slightly under typical 15s zombie timeout

  // ── One WS connection per channel name ───────────────────────────────────
  function _makeChannel(channelName) {
    var _handlers = {};      // event name → [handler, ...]
    var _ws = null;
    var _subCallback = null;
    var _hbTimer = null;
    var _ref = 0;
    var _topic = "realtime:" + channelName;

    function _nextRef() { return String(++_ref); }

    function _triggerHandlers(event, data) {
      var hs = _handlers[event] || [];
      hs.forEach(function (h) { try { h(data || {}); } catch (e) { console.warn("[shim] handler error", e); } });
    }

    function _connect(onReady) {
      _ws = new WebSocket(RELAY_URL);

      _ws.onopen = function () {
        // Phoenix join
        _ws.send(JSON.stringify({
          event: "phx_join",
          topic: _topic,
          payload: { config: { broadcast: { self: false, ack: false } } },
          ref: _nextRef(),
        }));
      };

      _ws.onmessage = function (ev) {
        var frame;
        try { frame = JSON.parse(ev.data); } catch (_) { return; }

        var evt = frame.event;
        var payload = frame.payload || {};

        if (evt === "phx_reply") {
          var status = (payload.status || payload.response && payload.response.status || "");
          if (status === "ok" && onReady) {
            onReady();
            onReady = null;
            if (FAKE_HEARTBEAT) { _startFakeHeartbeat(); }
          }
          return;
        }

        if (evt === "broadcast") {
          // Relay wraps the original Phoenix payload one level deep.
          // Inbound from relay: {event:"broadcast", topic:T, payload: <original_payload>}
          // Original payload from phone: {type:"broadcast", event:"heartbeat", payload:{...}}
          var inner = payload;
          var evName = inner.event || inner.type || "";
          _triggerHandlers(evName, inner.payload || inner);
        }
      };

      _ws.onerror = function (e) {
        console.warn("[shim] WS error", e);
        if (_subCallback) { _subCallback("CHANNEL_ERROR"); }
      };

      _ws.onclose = function () {
        _stopFakeHeartbeat();
        if (_subCallback) { _subCallback("CLOSED"); }
      };
    }

    function _startFakeHeartbeat() {
      _stopFakeHeartbeat();
      _hbTimer = setInterval(function () {
        _triggerHandlers("heartbeat", {});
      }, HEARTBEAT_INTERVAL_MS);
    }

    function _stopFakeHeartbeat() {
      if (_hbTimer) { clearInterval(_hbTimer); _hbTimer = null; }
    }

    var _channel = {
      on: function (type, filter, handler) {
        var key = (filter && filter.event) ? filter.event : "__any";
        if (!_handlers[key]) { _handlers[key] = []; }
        _handlers[key].push(handler);
        return _channel;
      },

      subscribe: function (cb) {
        _subCallback = cb || null;
        _connect(function () {
          if (cb) { cb("SUBSCRIBED"); }
        });
        return _channel;
      },

      send: function (payload) {
        if (!_ws || _ws.readyState !== WebSocket.OPEN) {
          console.warn("[shim] send: WS not open, dropping", payload);
          return Promise.resolve({ status: "error", error: "not connected" });
        }
        _ws.send(JSON.stringify({
          event: "broadcast",
          topic: _topic,
          payload: payload,
          ref: _nextRef(),
        }));
        return Promise.resolve({ status: "ok" });
      },

      unsubscribe: function () {
        _stopFakeHeartbeat();
        if (_ws) {
          try {
            _ws.send(JSON.stringify({ event: "phx_leave", topic: _topic, payload: {}, ref: _nextRef() }));
          } catch (_) {}
          _ws.close();
          _ws = null;
        }
        return Promise.resolve();
      },
    };

    return _channel;
  }

  // ── Auth stub ─────────────────────────────────────────────────────────────
  var _auth = {
    signInAnonymously: function () {
      return Promise.resolve({
        data: { user: { id: "shim-user-00000000-devmode" } },
        error: null,
      });
    },
  };

  // ── Storage stub ──────────────────────────────────────────────────────────
  var _storage = {
    from: function (bucket) {
      return {
        upload: function (path, data, opts) {
          console.log("[shim] storage.upload (no-op)", bucket + "/" + path);
          return Promise.resolve({ data: { path: path }, error: null });
        },
        download: function (path) {
          console.log("[shim] storage.download (stub 1×1 PNG)", path);
          var B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjkB6QAAAABJRU5ErkJggg==";
          var raw = atob(B64);
          var arr = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) { arr[i] = raw.charCodeAt(i); }
          return Promise.resolve({ data: new Blob([arr], { type: "image/png" }), error: null });
        },
        remove: function (paths) {
          return Promise.resolve({ data: paths, error: null });
        },
      };
    },
  };

  // ── Client factory ────────────────────────────────────────────────────────
  function _createClient(url, key) {
    return {
      channel: function (name) { return _makeChannel(name); },
      auth:    _auth,
      storage: _storage,
    };
  }

  // ── Install ───────────────────────────────────────────────────────────────
  window.supabase = { createClient: _createClient };
  // Also cover the alternate import path the page checks
  window.supabaseJs = { createClient: _createClient };

  console.log("[shim] broadcast_relay_shim active → relay:", RELAY_URL,
              "| fake heartbeat:", FAKE_HEARTBEAT);
})();
