"use strict";

const LAUNCHER_TARGET = "https://launcher.keychron.com";
const statusText = document.getElementById("reconnectStatus");
const statusDot = document.querySelector(".status-dot");
let checkCount = 0;
let isReconnecting = false;

function checkConnectivity() {
  if (isReconnecting) return;
  checkCount++;

  if (statusText) {
    statusText.textContent = `Auto-detecting connection... (${checkCount})`;
  }

  fetch(`${LAUNCHER_TARGET}/favicon.ico?_=${Date.now()}`, {
    mode: "no-cors",
    cache: "no-store"
  })
    .then(() => {
      isReconnecting = true;
      if (statusText) statusText.textContent = "Connection restored! Loading launcher...";
      if (statusDot) statusDot.classList.add("online");
      setTimeout(() => {
        window.location.href = LAUNCHER_TARGET;
      }, 600);
    })
    .catch(() => {
      // Still offline, will retry on next interval
    });
}

// Auto-poll connection every 4 seconds
const intervalId = setInterval(checkConnectivity, 4000);
// Also listen for browser online event
window.addEventListener("online", checkConnectivity);

document.getElementById("btnRetry").addEventListener("click", () => {
  if (statusText) statusText.textContent = "Connecting...";
  window.location.href = LAUNCHER_TARGET;
});

document.getElementById("btnDiagnostic").addEventListener("click", () => {
  const box = document.getElementById("diagnosticsBox");
  box.classList.toggle("hidden");
});
