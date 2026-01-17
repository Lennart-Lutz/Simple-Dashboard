// public/ui/toast.js
//
// Central toast service for errors and notifications
//
// Usage:
//   import { showError, showSuccess } from "./ui/toast.js";
//   showError("Saving failed");

export function showToast({
  title = "",
  message = "",
  variant = "dark", // dark | danger | success | warning | info
  delay = 5000,
}) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const el = document.createElement("div");
  el.className = `toast text-bg-${variant} border-0`;
  el.role = "alert";
  el.ariaLive = "assertive";
  el.ariaAtomic = "true";

  el.innerHTML = `
    <div class="toast-header">
      <strong class="me-auto">${title}</strong>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
    </div>
    <div class="toast-body">
      ${message}
    </div>
  `;

  container.appendChild(el);

  const toast = bootstrap.Toast.getOrCreateInstance(el, { delay });
  toast.show();

  el.addEventListener("hidden.bs.toast", () => el.remove());
}

// Convenience wrappers
export function showError(message, title = "Error") {
  showToast({ title, message, variant: "danger" });
}

export function showSuccess(message, title = "Success") {
  showToast({ title, message, variant: "success", delay: 3000 });
}

export function showInfo(message, title = "Info") {
  showToast({ title, message, variant: "info" });
}
