// public/ui/tabsView.js
//
// Renders the dashboard tabs and exposes events (select, rename, create-new).

export function createTabsView({
  elTabs,
  getState,
  isEditing,
  onSelect,
  onRename,
  onCreateNew,
}) {
  if (!elTabs) throw new Error("createTabsView: elTabs missing");

  function render() {
    const state = getState();
    if (!state) return;

    elTabs.innerHTML = "";

    for (const d of state.dashboards) {
      const li = document.createElement("li");
      li.className = "nav-item";
      li.role = "presentation";

      const btn = document.createElement("button");
      const active = d.id === state.activeId;
      btn.className = "nav-link" + (active ? " active" : "");
      btn.type = "button";

      const label = document.createElement("span");
      label.textContent = d.name;
      btn.appendChild(label);

      if (active && isEditing()) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "tab-edit-btn";
        editBtn.title = "Dashboard umbenennen";
        editBtn.innerHTML = `<i class="bi bi-pencil"></i>`;

        editBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onRename(d);
        });

        btn.appendChild(editBtn);
      }

      btn.addEventListener("click", () => onSelect(d));

      li.appendChild(btn);
      elTabs.appendChild(li);
    }

    const liPlus = document.createElement("li");
    liPlus.className = "nav-item tab-plus";

    const btnPlus = document.createElement("button");
    btnPlus.className = "nav-link";
    btnPlus.type = "button";
    btnPlus.innerHTML = `<i class="bi bi-plus"></i>`;
    btnPlus.title = "Neues Dashboard";

    btnPlus.addEventListener("click", () => onCreateNew());

    liPlus.appendChild(btnPlus);
    elTabs.appendChild(liPlus);
  }

  return { render };
}
