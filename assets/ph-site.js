/* RollShare public-site PostHog analytics.
 * surface = "site" — all public marketing/docs pages.
 * Loaded by every page under site/*.html via <script src="assets/ph-site.js">.
 * In dev (localhost / 127.0.0.1) all capturing is disabled automatically.
 */
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+" (stub)"},o="init bs ws ge fs capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

posthog.init('phc_znGJ5C6tARtEWQkCkyRJmWsEna3iq7ds4FquU93F6fAE', {
    api_host: 'https://us.i.posthog.com',
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: 'localStorage',
});

// Disable all capturing when running locally (dev / VS Code preview).
var _host = location.hostname;
if (_host === 'localhost' || _host === '127.0.0.1' || _host === '') {
    posthog.opt_out_capturing();
}

posthog.register({ surface: 'site' });

// Thin wrapper — allows test harnesses to stub analytics via window.__RS_ANALYTICS_OFF__.
function track(event, props) {
    if (window.__RS_ANALYTICS_OFF__) return;
    posthog.capture(event, props || {});
}
