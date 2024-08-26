let steps = [];
let isRecording = false;

document.getElementById("startRecording").addEventListener("click", () => {
  startRecording();
});

document.getElementById("stopRecording").addEventListener("click", () => {
  stopRecording();
});

function startRecording() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "startRecording" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }
      console.log(response.status);
      isRecording = true;
    });
  });
}

function stopRecording() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "stopRecording" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }
      console.log(response.status);
      steps = response.steps;
      isRecording = false;
      updateStepList();
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateSteps") {
    steps = message.steps;
    updateStepList();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (isRecording) {
      chrome.tabs.sendMessage(tabId, { action: "getRecordingStatus" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }
        if (!response.isRecording) {
          startRecording();
        }
      });
    }
  }
});

function updateStepList() {
  const stepList = document.getElementById("stepList");
  stepList.innerHTML = "";

  steps.forEach((step, index) => {
    const stepElement = document.createElement("div");
    stepElement.className = "step";

    const img = document.createElement("img");
    img.src = step.screenshot;
    stepElement.appendChild(img);

    const info = document.createElement("div");
    info.className = "step-info";
    info.textContent = `Step ${index + 1}: Click at (${step.x}, ${step.y}) - ${step.url}`;
    stepElement.appendChild(info);

    stepList.appendChild(stepElement);
  });
}

function addRedCircle(img, x, y) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      ctx.beginPath();
      ctx.arc(x, y, 20, 0, 2 * Math.PI);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 3;
      ctx.stroke();

      resolve(canvas.toDataURL());
    };
  });
}

async function processScreenshot(step) {
  const img = new Image();
  img.src = step.screenshot;
  step.screenshot = await addRedCircle(img, step.x, step.y);
}