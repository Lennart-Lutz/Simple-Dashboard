// public/ui/addWidgetModal.js
//
// Simple Bootstrap modal wrapper.
// Calls onAdd() when user confirms.

export function createAddWidgetModal({ onAdd }) {
  const elModal = document.getElementById("addWidgetModal");
  const elBtnAdd = document.getElementById("addWidgetConfirm");

  if (!elModal || !elBtnAdd) {
    throw new Error("AddWidget modal elements not found.");
  }
  if (typeof bootstrap === "undefined" || !bootstrap.Modal) {
    throw new Error("Bootstrap JS Modal not available.");
  }

  const modal = bootstrap.Modal.getOrCreateInstance(elModal);

  async function submit() {
    elBtnAdd.disabled = true;
    try {
      await onAdd();
      modal.hide();
    } finally {
      elBtnAdd.disabled = false;
    }
  }

  elBtnAdd.addEventListener("click", submit);

  // Optional: reset button state on close
  elModal.addEventListener("hidden.bs.modal", () => {
    elBtnAdd.disabled = false;
  });

  function open() {
    modal.show();
  }

  return { open };
}
