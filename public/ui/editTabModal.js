// public/ui/editTabModal.js

export function createEditTabModal({ onSave, onDelete }) {
  const elModal = document.getElementById("editTabModal");
  const elInput = document.getElementById("editTabInput");
  const elSave = document.getElementById("editTabSave");
  const elErr = document.getElementById("editTabError");
  const elDelete = document.getElementById("editTabDelete");
  const elDeleteConfirm = document.getElementById("editTabDeleteConfirm");

  if (!elModal || !elInput || !elSave || !elErr || !elDelete || !elDeleteConfirm) {
    throw new Error("Edit modal elements not found in DOM (editTabModal).");
  }
  if (typeof bootstrap === "undefined" || !bootstrap.Modal) {
    throw new Error("Bootstrap JS Modal not available. Ensure bootstrap.bundle.min.js is loaded.");
  }

  const modal = bootstrap.Modal.getOrCreateInstance(elModal);

  let ctx = null; // { id, validate }

  function setError(msg) {
    if (!msg) {
      elInput.classList.remove("is-invalid");
      elErr.textContent = "";
      return;
    }
    elInput.classList.add("is-invalid");
    elErr.textContent = msg;
  }

  async function submit() {
    if (!ctx) return;

    const name = (elInput.value || "").trim();
    const validate = ctx.validate;

    if (!name) {
      setError("Please enter a name.");
      return;
    }
    if (validate) {
      const msg = validate(name);
      if (msg) {
        setError(msg);
        return;
      }
    }

    // UI lock
    elSave.disabled = true;

    try {
      await onSave({ id: ctx.id, name });
      modal.hide();
    } catch (e) {
      console.error(e);
      setError("Save failed.");
    } finally {
      elSave.disabled = false;
    }
  }

  // Save button
  elSave.addEventListener("click", submit);

  // Enter submits
  elInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  // Delete button
  elDelete.addEventListener("click", async () => {
    if (!ctx) return;

    elDelete.disabled = true;
    elDeleteConfirm.disabled = true;

    try {
      await onDelete({ id: ctx.id });
      modal.hide();
    } catch (e) {
      console.error(e);
      setError("Delete failed.");
    } finally {
      elDelete.disabled = true;
      elDeleteConfirm.disabled = false;
    }
  });

  elDeleteConfirm.addEventListener("change", () => {
    elDelete.disabled = !elDeleteConfirm.checked;
  });

  // Reset on open/close
  elModal.addEventListener("shown.bs.modal", () => {
    elInput.focus();
    elInput.select();
  });

  elModal.addEventListener("hidden.bs.modal", () => {
    ctx = null;
    elInput.value = "";
    setError(null);
    elSave.disabled = false;
    elDelete.disabled = true;
    elDeleteConfirm.checked = false;
  });

  function open({ id, currentName, validate }) {
    ctx = { id, validate };
    elInput.value = currentName || "";
    setError(null);

    // reset delete confirm
    elDeleteConfirm.checked = false;
    elDelete.disabled = true;

    modal.show();
  }

  return { open };
}
