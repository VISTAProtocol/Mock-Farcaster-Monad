var i = class {
  constructor(e) {
    this.lastMouseMove = Date.now();
    this.lastScroll = Date.now();
    this.visibilityRatio = 0;
    let t = document.getElementById(e);
    if (!t) throw new Error(`VISTA: element not found: ${e}`);
    ((this.element = t),
      (this.observer = new IntersectionObserver(
        (s) => {
          this.visibilityRatio = s[0]?.intersectionRatio ?? 0;
        },
        { threshold: [0, 0.25, 0.5, 0.75, 1] },
      )),
      this.observer.observe(this.element),
      (this.onMouseMove = () => {
        this.lastMouseMove = Date.now();
      }),
      (this.onScroll = () => {
        this.lastScroll = Date.now();
      }),
      window.addEventListener("mousemove", this.onMouseMove),
      window.addEventListener("scroll", this.onScroll, { passive: !0 }));
  }
  collect() {
    return {
      visibility: this.visibilityRatio,
      tabFocused: document.visibilityState === "visible",
      mouseActive: Date.now() - this.lastMouseMove < 3e3,
      scrolled: Date.now() - this.lastScroll < 2e3,
    };
  }
  calculateScore(e) {
    let t = 0;
    return (
      e.visibility >= 0.5 && (t += 0.4),
      e.tabFocused && (t += 0.3),
      e.mouseActive && (t += 0.2),
      e.scrolled && (t += 0.1),
      t
    );
  }
  destroy() {
    (this.observer.disconnect(),
      window.removeEventListener("mousemove", this.onMouseMove),
      window.removeEventListener("scroll", this.onScroll));
  }
};
var n = class {
  constructor(e) {
    this.intervalId = null;
    this.oracleUrl = e;
  }
  start(e, t) {
    this.intervalId = setInterval(async () => {
      try {
        let s = e(),
          d = await (
            await fetch(`${this.oracleUrl}/heartbeat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(s),
            })
          ).json();
        t(d);
      } catch (s) {
        console.warn("[VISTA] Heartbeat failed:", s);
      }
    }, 5e3);
  }
  stop() {
    this.intervalId &&
      (clearInterval(this.intervalId), (this.intervalId = null));
  }
};
var o = class {
  constructor() {
    this.usedNonces = new Set();
    this.MAX_NONCES = 1e3;
    this.sessionId = this.generateSessionId();
  }
  getSessionId() {
    return this.sessionId;
  }
  generateNonce() {
    let e = Math.random().toString(36).substring(2, 10);
    if ((this.usedNonces.add(e), this.usedNonces.size > this.MAX_NONCES)) {
      let t = Math.floor(this.MAX_NONCES * 0.1),
        s = 0;
      for (let l of this.usedNonces) {
        if (s >= t) break;
        (this.usedNonces.delete(l), s++);
      }
    }
    return e;
  }
  generateSessionId() {
    return `vista_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
  reset() {
    ((this.sessionId = this.generateSessionId()), this.usedNonces.clear());
  }
};
var r = class {
    constructor() {
      this.config = null;
      this.collector = null;
      this.sender = null;
      this.sessionManager = null;
      this.earnCallback = null;
      this.sessionAmount = 0;
      this.lastValidSeconds = 0;
      this.lastScore = 0;
      this.isActive = !1;
      this.beforeunloadHandler = null;
      this.visibilitychangeHandler = null;
      this.listenersSetup = !1;
    }
    init(e) {
      let t = [
        "apiKey",
        "userWallet",
        "oracleUrl",
        "campaignId",
        "publisherWallet",
      ];
      for (let s of t) if (!e[s]) throw new Error(`VISTA: ${s} is required`);
      (this.removeSessionEndListeners(),
        (this.config = e),
        (this.sender = new n(e.oracleUrl)),
        (this.sessionManager = new o()),
        this.setupSessionEndListeners());
    }
    attachZone(e) {
      if (typeof window > "u")
        throw new Error("VISTA SDK requires browser environment");
      if (!this.config || !this.sessionManager)
        throw new Error("VISTA: call init() before attachZone()");
      if (this.isActive)
        throw new Error(
          "VISTA: zone already attached, call detachZone() first",
        );
      ((this.collector = new i(e)),
        (this.isActive = !0),
        this.sender.start(
          () => this.buildPayload(),
          (t) => this.handleResponse(t),
        ),
        console.log("[VISTA] Zone attached:", e));
    }
    detachZone() {
      this.isActive &&
        ((this.isActive = !1),
        this.sender?.stop(),
        this.collector?.destroy(),
        (this.collector = null),
        this.postSessionEnd(),
        this.sessionManager?.reset(),
        console.log("[VISTA] Zone detached"));
    }
    onEarn(e) {
      this.earnCallback = e;
    }
    getStatus() {
      return {
        active: this.isActive,
        sessionId: this.sessionManager?.getSessionId() ?? null,
        validSeconds: this.lastValidSeconds,
        sessionAmount: this.sessionAmount,
        score: this.lastScore,
      };
    }
    buildPayload() {
      let e = this.collector.collect(),
        t = this.collector.calculateScore(e);
      return {
        sessionId: this.sessionManager.getSessionId(),
        apiKey: this.config.apiKey,
        userWallet: this.config.userWallet,
        campaignId: this.config.campaignId,
        publisherWallet: this.config.publisherWallet,
        timestamp: Date.now(),
        nonce: this.sessionManager.generateNonce(),
        score: t,
        signals: e,
      };
    }
    handleResponse(e) {
      if (((this.lastScore = e.score), !e.valid)) return;
      let t = e.validSeconds - this.lastValidSeconds;
      if (
        ((this.lastValidSeconds = e.validSeconds), t > 0 && this.earnCallback)
      ) {
        let s = t * 333e-6;
        ((this.sessionAmount += s),
          this.earnCallback({
            sessionAmount: this.sessionAmount,
            tickAmount: s,
            validSeconds: e.validSeconds,
            score: e.score,
            flagged: e.flagged,
          }));
      }
    }
    async postSessionEnd() {
      if (!(!this.config || !this.sessionManager))
        try {
          await fetch(`${this.config.oracleUrl}/session/end`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: this.sessionManager.getSessionId(),
              apiKey: this.config.apiKey,
            }),
          });
        } catch (e) {
          console.warn("[VISTA] Session end failed:", e);
        }
    }
    setupSessionEndListeners() {
      typeof window > "u" ||
        this.listenersSetup ||
        ((this.beforeunloadHandler = () => {
          this.detachZone();
        }),
        (this.visibilitychangeHandler = () => {
          document.visibilityState === "hidden" && this.detachZone();
        }),
        window.addEventListener("beforeunload", this.beforeunloadHandler),
        document.addEventListener(
          "visibilitychange",
          this.visibilitychangeHandler,
        ),
        (this.listenersSetup = !0));
    }
    removeSessionEndListeners() {
      typeof window > "u" ||
        (this.listenersSetup &&
          (this.beforeunloadHandler &&
            (window.removeEventListener(
              "beforeunload",
              this.beforeunloadHandler,
            ),
            (this.beforeunloadHandler = null)),
          this.visibilitychangeHandler &&
            (document.removeEventListener(
              "visibilitychange",
              this.visibilitychangeHandler,
            ),
            (this.visibilitychangeHandler = null)),
          (this.listenersSetup = !1)));
    }
    showOnboardingModal(e) {
      if (typeof window === "undefined") return;
      if (document.getElementById("vista-onboarding-modal")) return;

      const colors = {
        background: "oklch(0.2529 0.0415 279.0076)",
        foreground: "oklch(0.9842 0.0034 247.8575)",
        card: "oklch(0.3120 0.0503 278.3787)",
        primary: "oklch(0.6255 0.1741 149.0136)",
        primaryForeground: "oklch(1.0000 0 0)",
        mutedForeground: "oklch(0.7322 0.0382 275.1551)",
        border: "oklch(0.3548 0.0524 277.5527)",
        input: "oklch(0.2087 0.0377 278.0260)"
      };

      let modal = document.createElement("div");
      modal.id = "vista-onboarding-modal";
      Object.assign(modal.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "999999",
        backdropFilter: "blur(4px)",
        fontFamily: "system-ui, -apple-system, sans-serif"
      });

      let container = document.createElement("div");
      Object.assign(container.style, {
        position: "relative",
        width: "90%",
        maxWidth: "600px",
        maxHeight: "90vh",
        backgroundColor: colors.card,
        borderRadius: "28px",
        overflowY: "auto",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        border: `1px solid ${colors.border}`,
        padding: "32px",
        color: colors.foreground
      });

      let closeBtn = document.createElement("button");
      closeBtn.innerHTML = "&times;";
      Object.assign(closeBtn.style, {
        position: "absolute",
        top: "20px",
        right: "20px",
        background: "transparent",
        border: "none",
        color: colors.mutedForeground,
        fontSize: "24px",
        cursor: "pointer",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "color 0.2s"
      });
      closeBtn.onmouseover = () => closeBtn.style.color = colors.foreground;
      closeBtn.onmouseout = () => closeBtn.style.color = colors.mutedForeground;
      closeBtn.onclick = () => {
        if (document.body.contains(modal)) document.body.removeChild(modal);
      };

      let header = document.createElement("div");
      header.innerHTML = `
        <h2 style="margin:0 0 6px 0;font-size:24px;font-weight:600;letter-spacing:-0.02em;">Tell VISTA what to show you</h2>
        <p style="margin:0 0 24px 0;color:${colors.mutedForeground};font-size:14px;">Add your age, location, and preference profile so the Oracle can route relevant campaigns.</p>
      `;

      let form = document.createElement("form");
      
      const inputStyle = `width:100%;background:transparent;border:1px solid ${colors.input};border-radius:6px;padding:9px 12px;color:${colors.foreground};margin-bottom:20px;box-sizing:border-box;font-size:14px;outline:none;transition:border 0.2s;`;
      const labelStyle = `display:block;margin-bottom:8px;font-size:14px;font-weight:500;color:${colors.foreground};`;

      let flexContainer = document.createElement("div");
      flexContainer.style.cssText = "display:flex;gap:16px;width:100%;";

      let ageContainer = document.createElement("div");
      ageContainer.style.flex = "1";
      ageContainer.innerHTML = `<label style="${labelStyle}">Age</label>`;
      let ageInput = document.createElement("input");
      ageInput.type = "number";
      ageInput.min = "13";
      ageInput.value = "27";
      ageInput.style.cssText = inputStyle;
      ageInput.onfocus = () => ageInput.style.border = `1px solid ${colors.primary}`;
      ageInput.onblur = () => ageInput.style.border = `1px solid ${colors.input}`;
      ageContainer.appendChild(ageInput);

      let locContainer = document.createElement("div");
      locContainer.style.flex = "1";
      locContainer.innerHTML = `<label style="${labelStyle}">Location</label>`;
      let locationInput = document.createElement("input");
      locationInput.type = "text";
      locationInput.value = "Jakarta";
      locationInput.style.cssText = inputStyle;
      locationInput.onfocus = () => locationInput.style.border = `1px solid ${colors.primary}`;
      locationInput.onblur = () => locationInput.style.border = `1px solid ${colors.input}`;
      locContainer.appendChild(locationInput);

      flexContainer.appendChild(ageContainer);
      flexContainer.appendChild(locContainer);

      let prefsContainer = document.createElement("div");
      prefsContainer.innerHTML = `<label style="${labelStyle}">Preferences</label>
        <p style="margin:0 0 16px 0;font-size:13px;color:${colors.mutedForeground};">Pick all categories you want VISTA to target.</p>`;
      
      let grid = document.createElement("div");
      grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:32px;";
      
      const ALL_PREFS = ["tech", "gaming", "fashion", "sport", "food", "healthy", "finance", "crypto", "travel", "music", "automotive", "beauty"];
      ALL_PREFS.forEach(p => {
        let btn = document.createElement("button");
        btn.type = "button";
        btn.className = "vista-pref-btn";
        btn.dataset.val = p;
        btn.dataset.selected = (p === "tech" || p === "gaming") ? "true" : "false";
        btn.innerHTML = `<div style="font-weight:500;margin-bottom:4px;">${p.charAt(0).toUpperCase() + p.slice(1)}</div>`;
        
        const updateBtnStyle = () => {
          if (btn.dataset.selected === "true") {
            btn.style.cssText = `padding:16px;border-radius:24px;font-size:14px;cursor:pointer;background:color-mix(in oklch, ${colors.primary} 10%, transparent);border:1px solid ${colors.primary};color:${colors.primary};text-align:left;transition:all 0.2s;`;
          } else {
            btn.style.cssText = `padding:16px;border-radius:24px;font-size:14px;cursor:pointer;background:color-mix(in oklch, ${colors.background} 70%, transparent);border:1px solid color-mix(in oklch, ${colors.border} 70%, transparent);color:${colors.foreground};text-align:left;transition:all 0.2s;`;
          }
        };
        updateBtnStyle();
        
        btn.onclick = (ev) => {
          ev.preventDefault();
          btn.dataset.selected = btn.dataset.selected === "true" ? "false" : "true";
          updateBtnStyle();
        };
        grid.appendChild(btn);
      });
      prefsContainer.appendChild(grid);

      let submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.innerText = "Create user profile";
      submitBtn.style.cssText = `width:100%;padding:10px 16px;background:${colors.primary};color:${colors.primaryForeground};border:none;border-radius:6px;font-weight:500;font-size:14px;cursor:pointer;transition:opacity 0.2s;height:40px;`;
      submitBtn.onmouseover = () => submitBtn.style.opacity = "0.9";
      submitBtn.onmouseout = () => submitBtn.style.opacity = "1";

      form.onsubmit = async (evt) => {
        evt.preventDefault();
        submitBtn.disabled = true;
        submitBtn.innerText = "Saving profile...";
        
        const prefs = Array.from(document.querySelectorAll('.vista-pref-btn[data-selected="true"]'))
          .map(el => el.dataset.val);

        try {
          const targetUrl = (e.dashboardUrl || "http://localhost:3031") + "/api/users";
          const res = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress: e.wallet,
              age: parseInt(ageInput.value) || 27,
              location: locationInput.value || "Jakarta",
              preferences: prefs
            })
          });
          
          if (!res.ok) throw new Error("Failed to save profile");
          
          if (document.body.contains(modal)) {
            document.body.removeChild(modal);
          }
          window.postMessage("VISTA_ONBOARDING_COMPLETE", "*");
        } catch (err) {
          console.error("[VISTA] Onboarding error:", err);
          submitBtn.innerText = "Error - Try Again";
          submitBtn.disabled = false;
        }
      };

      form.appendChild(flexContainer);
      form.appendChild(prefsContainer);
      form.appendChild(submitBtn);

      container.appendChild(closeBtn);
      container.appendChild(header);
      container.appendChild(form);
      modal.appendChild(container);
      document.body.appendChild(modal);
    }
  },
  c = new r();
export { c as Vista };
//# sourceMappingURL=index.mjs.map
