"use strict";

document.getElementById("btnRetry").addEventListener("click", () => {
  window.location.href = "https://launcher.keychron.com";
});

document.getElementById("btnDiagnostic").addEventListener("click", () => {
  const box = document.getElementById("diagnosticsBox");
  box.classList.toggle("hidden");
});
