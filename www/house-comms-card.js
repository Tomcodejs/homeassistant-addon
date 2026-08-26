class HouseCommsCard extends HTMLElement {
  setConfig(config) {
    if (!config.api_url) {
      throw new Error("house-comms-card: 'api_url' is required, e.g. http://homeassistant.local:8091");
    }
    this._config = config;
    this._apiUrl = config.api_url.replace(/\/$/, "");
    this._haUsers = [];
    this._disabledLocal = [];
    this._maintenance = { enabled: false, note: "" };
    this._messages = [];
    this._showAdmin = false;
    this._booted = false;

    if (!this._root) {
      this._root = this.attachShadow({ mode: "open" });
      this._root.innerHTML = `
        <style>
          :host { display: block; font-family: "SFMono-Regular", Menlo, Consolas, monospace; }
          .wrap { background:#0D0F13; border-radius:8px; overflow:hidden; border:1px solid #1C1F26; }
          .strip { display:flex; justify-content:space-between; align-items:center; padding:6px 12px;
                   font-size:10px; letter-spacing:.12em; text-transform:uppercase; }
          .strip.on { background:#0F1712; color:#5EEAD4; border-bottom:1px solid #1C2A22; }
          .strip.maint { background:#241C0D; color:#F2B84B; border-bottom:1px solid #4A3A16; }
          .header { display:flex; justify-content:space-between; align-items:center; padding:10px 12px;
                     background:#0F1116; border-bottom:1px solid #1C1F26; }
          .title { color:#E7E9EE; font-size:12px; letter-spacing:.12em; text-transform:uppercase; }
          .who { color:#8B92A3; font-size:11px; display:flex; align-items:center; gap:6px; }
          .btn { background:transparent; border:1px solid #2A2F3A; color:#8B92A3; font-size:10px;
                 text-transform:uppercase; letter-spacing:.08em; padding:5px 8px; border-radius:4px;
                 cursor:pointer; font-family:inherit; }
          .btn:hover { border-color:#5EEAD4; color:#5EEAD4; }
          .btn.danger { border-color:#3A2426; color:#E5484D; }
          .btn.ok { border-color:#245349; color:#5EEAD4; }
          .msgs { max-height:320px; min-height:160px; overflow-y:auto; padding:12px; display:flex;
                  flex-direction:column; gap:8px; }
          .msg { max-width:80%; padding:6px 10px; border-radius:4px; font-size:13px; line-height:1.4;
                 color:#D5D9E0; background:#14161B; border:1px solid #22262F; align-self:flex-start; }
          .msg.mine { align-self:flex-end; background:#173832; border-color:#245349; color:#E7E9EE; }
          .meta { font-size:10px; color:#4A5162; margin-bottom:2px; }
          .composer { display:flex; gap:8px; padding:10px 12px; border-top:1px solid #1C1F26; background:#0F1116; }
          .composer input { flex:1; background:#14161B; border:1px solid #2A2F3A; color:#E7E9EE;
                             font-family:inherit; font-size:13px; padding:8px 10px; border-radius:4px; outline:none; }
          .composer input:focus { border-color:#5EEAD4; }
          .composer button { background:#5EEAD4; border:none; color:#0D0F13; font-weight:600;
                              padding:0 14px; border-radius:4px; cursor:pointer; font-family:inherit; }
          .composer button:disabled { background:#2A2F3A; color:#4A5162; }
          .maint-note { text-align:center; color:#F2B84B; font-size:11px; padding:10px; }
          .admin-panel { border-top:1px solid #1C1F26; padding:12px; background:#0F1116; }
          .admin-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0;
                       border-bottom:1px solid #1a1d24; font-size:12px; color:#E7E9EE; }
          .admin-row:last-child { border-bottom:none; }
          .tag { font-size:9px; color:#5EEAD4; border:1px solid #245349; padding:1px 5px; border-radius:3px;
                 text-transform:uppercase; margin-left:6px; }
          .maint-form { display:flex; gap:6px; padding:10px 0; border-bottom:1px solid #1a1d24; }
          .maint-form input { flex:1; background:#0D0F13; border:1px solid #2A2F3A; color:#E7E9EE;
                               font-family:inherit; font-size:12px; padding:6px 8px; border-radius:4px; outline:none; }
        </style>
        <div class="wrap">
          <div class="strip"></div>
          <div class="header">
            <span class="title">🛰 House Comms</span>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="who"></span>
              <button class="btn admin-toggle" style="display:none;">Admin</button>
            </div>
          </div>
          <div class="msgs"></div>
          <div class="composer">
            <input type="text" placeholder="Écrire un message…" />
            <button type="button">Envoyer</button>
          </div>
          <div class="admin-panel" style="display:none;"></div>
        </div>
      `;

      this._els = {
        strip: this._root.querySelector(".strip"),
        who: this._root.querySelector(".who"),
        adminToggle: this._root.querySelector(".admin-toggle"),
        msgs: this._root.querySelector(".msgs"),
        input: this._root.querySelector(".composer input"),
        sendBtn: this._root.querySelector(".composer button"),
        adminPanel: this._root.querySelector(".admin-panel"),
      };

      this._els.sendBtn.addEventListener("click", () => this._send());
      this._els.input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this._send();
      });
      this._els.adminToggle.addEventListener("click", () => {
        this._showAdmin = !this._showAdmin;
        this._render();
      });

      this._poll();
      this._pollTimer = setInterval(() => this._poll(), 3000);
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._booted) {
      this._booted = true;
      this._render();
    }
  }

  get _me() {
    if (!this._hass || !this._hass.user) return null;
    return {
      id: this._hass.user.id,
      name: this._hass.user.name,
      is_admin: !!this._hass.user.is_admin,
    };
  }

  async _fetchJSON(path, opts) {
    const res = await fetch(this._apiUrl + path, opts);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    return res.json();
  }

  async _poll() {
    try {
      const [msgs, maint] = await Promise.all([
        this._fetchJSON("/api/messages"),
        this._fetchJSON("/api/maintenance"),
      ]);
      this._messages = msgs;
      this._maintenance = maint;

      if (this._me && this._me.is_admin && this._hass) {
        const authList = await this._hass.callWS({ type: "config/auth/list" }).catch(() => []);
        this._haUsers = authList || [];
        const access = await this._fetchJSON("/api/access").catch(() => ({ disabledLocal: [] }));
        this._disabledLocal = access.disabledLocal || [];
      }
      this._render();
    } catch (e) {
      // network hiccup, ignore silently and retry next tick
    }
  }

  async _send() {
    const me = this._me;
    const text = this._els.input.value.trim();
    if (!me || !text) return;
    this._els.input.value = "";
    try {
      await this._fetchJSON("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          user_id: me.id,
          user_name: me.name,
          is_admin: me.is_admin,
        }),
      });
      this._poll();
    } catch (e) {
      alert("Message non envoyé : " + e.message);
    }
  }

  async _toggleMaintenance(enable) {
    const me = this._me;
    if (!me) return;
    const note = enable ? prompt("Motif de la maintenance (optionnel) :") || "" : "";
    await this._fetchJSON("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: enable, note, by: me.name, is_admin: me.is_admin }),
    });
    this._poll();
  }

  async _toggleAccess(targetId, revoke) {
    const me = this._me;
    if (!me) return;
    await this._fetchJSON("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_user_id: targetId, revoked: revoke, is_admin: me.is_admin }),
    });
    this._poll();
  }

  _render() {
    if (!this._els) return;
    const me = this._me;

    this._els.strip.className = "strip " + (this._maintenance.enabled ? "maint" : "on");
    this._els.strip.textContent = this._maintenance.enabled
      ? `⚠ Maintenance${this._maintenance.note ? " — " + this._maintenance.note : ""}`
      : "● Système en ligne";

    this._els.who.textContent = me ? me.name + (me.is_admin ? " (admin)" : "") : "…";
    this._els.adminToggle.style.display = me && me.is_admin ? "inline-block" : "none";

    this._els.msgs.innerHTML = this._messages
      .map((m) => {
        const mine = me && m.userId === me.id;
        const t = new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return `<div class="msg ${mine ? "mine" : ""}">
                   <div class="meta">${mine ? "Toi" : this._escape(m.name)} · ${t}</div>
                   ${this._escape(m.text)}
                 </div>`;
      })
      .join("");
    this._els.msgs.scrollTop = this._els.msgs.scrollHeight;

    const canPost = !this._maintenance.enabled || (me && me.is_admin);
    this._els.input.disabled = !canPost;
    this._els.sendBtn.disabled = !canPost;
    this._els.input.placeholder = canPost ? "Écrire un message…" : "Envoi suspendu (maintenance)";

    if (this._showAdmin && me && me.is_admin) {
      this._els.adminPanel.style.display = "block";
      const rows = this._haUsers
        .map((u) => {
          if (u.id === me.id) return "";
          const revoked = this._disabledLocal.includes(u.id);
          return `<div class="admin-row">
                    <span>${this._escape(u.name)}${u.is_admin ? '<span class="tag">admin HA</span>' : ""}</span>
                    <button class="btn ${revoked ? "ok" : "danger"}" data-uid="${u.id}" data-revoke="${!revoked}">
                      ${revoked ? "Réactiver (chat)" : "Révoquer (chat)"}
                    </button>
                  </div>`;
        })
        .join("");

      this._els.adminPanel.innerHTML = `
        <div class="maint-form">
          ${
            this._maintenance.enabled
              ? '<button class="btn ok" id="maint-off">Désactiver la maintenance</button>'
              : '<button class="btn danger" id="maint-on">Activer la maintenance</button>'
          }
        </div>
        <div style="font-size:10px; color:#8B92A3; text-transform:uppercase; letter-spacing:.08em; margin:8px 0 4px;">
          Accès au chat (par compte HA)
        </div>
        ${rows || '<div style="color:#4A5162; font-size:11px;">Aucun autre utilisateur HA trouvé.</div>'}
      `;

      const onBtn = this._els.adminPanel.querySelector("#maint-on");
      if (onBtn) onBtn.addEventListener("click", () => this._toggleMaintenance(true));
      const offBtn = this._els.adminPanel.querySelector("#maint-off");
      if (offBtn) offBtn.addEventListener("click", () => this._toggleMaintenance(false));
      this._els.adminPanel.querySelectorAll("button[data-uid]").forEach((btn) => {
        btn.addEventListener("click", () =>
          this._toggleAccess(btn.dataset.uid, btn.dataset.revoke === "true")
        );
      });
    } else {
      this._els.adminPanel.style.display = "none";
    }
  }

  _escape(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  getCardSize() {
    return 6;
  }

  disconnectedCallback() {
    if (this._pollTimer) clearInterval(this._pollTimer);
  }
}

customElements.define("house-comms-card", HouseCommsCard);
