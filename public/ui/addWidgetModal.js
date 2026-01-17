// public/ui/addWidgetModal.js

export function createAddWidgetModal({ onAdd }) {
  const elModal = document.getElementById("addWidgetModal");
  const elBtnAdd = document.getElementById("addWidgetConfirm");
  const elType = document.getElementById("addWidgetType");
  const elOptions = document.getElementById("addWidgetOptions");

  if (!elModal || !elBtnAdd || !elType || !elOptions) {
    throw new Error("AddWidget modal elements not found.");
  }
  if (typeof bootstrap === "undefined" || !bootstrap.Modal) {
    throw new Error("Bootstrap JS Modal not available.");
  }

  const modal = bootstrap.Modal.getOrCreateInstance(elModal);

  function renderOptions() {
    const type = elType.value;

    // value1x1
    if (type === "value1x1") {
      elOptions.innerHTML = `
        <div class="mb-2" style="margin-top: 32px;">
          <label class="form-label">Title</label>
          <input id="addWidgetTitle" type="text" class="form-control" maxlength="10" autocomplete="off" />
        </div>

        <div class="mb-3">
          <label class="form-label">Refresh Interval</label>
          <select id="addWidgetRefresh" class="form-select">
            <option value="1000">1s</option>
            <option value="2000">2s</option>
            <option value="5000" selected>5s</option>
            <option value="10000">10s</option>
            <option value="30000">30s</option>
            <option value="60000">1m</option>
            <option value="300000">5m</option>
            <option value="600000">10m</option>
            <option value="1800000">30m</option>
            <option value="3600000">1h</option>
          </select>
          <div class="form-text">Applies only to this widget.</div>
        </div>

        <div class="mt-2">
          <div class="mb-2">
            <label class="form-label">Endpoint</label>
            <input id="addWidgetEndpoint" type="text" class="form-control" autocomplete="off"
                  placeholder="/api/latest" />
          </div>

          <div class="row g-2">
            <div class="col-6">
              <label class="form-label">Query key</label>
              <input id="addWidgetParamKey" type="text" class="form-control" autocomplete="off"
                    placeholder="key" />
            </div>
            <div class="col-6">
              <label class="form-label">Query value</label>
              <input id="addWidgetParamValue" type="text" class="form-control" autocomplete="off"
                    placeholder="value" />
            </div>
          </div>

          <div class="form-text mt-2">
            Example: <code>/api/latest?key=value</code>
          </div>
        </div>
      `;
      return;
    }

    elOptions.innerHTML = `<div class="text-muted small">No options.</div>`;
  }

  async function submit() {
    elBtnAdd.disabled = true;
    try {
      const type = elType.value;
      const titleEl = document.getElementById("addWidgetTitle");
      const title = (titleEl?.value || "").trim();
      const endpoint = (document.getElementById("addWidgetEndpoint")?.value || "").trim();
      const paramKey = (document.getElementById("addWidgetParamKey")?.value || "").trim();
      const paramValue = (document.getElementById("addWidgetParamValue")?.value || "").trim();
      const refreshMsRaw = (document.getElementById("addWidgetRefresh")?.value || "").trim();
      const refreshMs = Number(refreshMsRaw);

      await onAdd({ type, title, endpoint, paramKey, paramValue, refreshMs });

      modal.hide();
    } finally {
      elBtnAdd.disabled = false;
    }
  }

  elBtnAdd.addEventListener("click", submit);

  elType.addEventListener("change", renderOptions);

  elModal.addEventListener("shown.bs.modal", () => {
    renderOptions();
    // focus title if exists
    const titleEl = document.getElementById("addWidgetTitle");
    if (titleEl) {
      titleEl.focus();
      titleEl.select();
    }
  });

  elModal.addEventListener("hidden.bs.modal", () => {
    elBtnAdd.disabled = false;
  });

  function open() {
    modal.show();
  }

  return { open };
}
