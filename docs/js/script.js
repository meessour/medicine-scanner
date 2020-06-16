const videoCanvas = document.getElementById('user-camera');

const enableCameraButton = document.getElementById("enable-camera-button");
const disableCameraButton = document.getElementById("disable-camera-button");
const scanResultContainer = document.getElementById("scan-result-container");
const switchCameraButton = document.getElementById("switch-camera");
const searchMedicineInput = document.getElementById("search-medicine");

const cameraComponents = document.getElementById("camera-components");

const progressText = document.getElementById("progress-text");
const statusText = document.getElementById("status-text");
const cancelScanButton = document.getElementById("cancel-scan-button");

const loadingBar = document.getElementById("loading-bar");

// Initiate socket for user
let socket = io();

let isCameraEnabled = false
const allCameraSources = []
let sourceId = undefined
let scanProgress;

const worker = Tesseract.createWorker({
    logger: m => {
        scanProgress = m?.progress;
        setLoadingProgress(scanProgress)
    }
});

// Initialize worker
(async () => {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    removeDisabledCameraButton();
})();

// Process the image
async function getTextFromImage(image) {
    if (!isCameraEnabled) return;

    cancelScanButton.disabled = false

    let text

    try {
        const data = await worker.recognize(image);
        text = data.data.text
    } catch (e) {
        console.log(e)
    }

    cancelScanButton.disabled = true
    setLogText(`Text found:
    
                    ${text}`)
    return text
}

async function stopWorker() {
    // await worker.terminate();
    console.log("load?")
    return true;
}

function removeDisabledCameraButton() {
    enableCameraButton.disabled = false;
    setCameraDevices();
}

function showSwitchCameraButton() {
    switchCameraButton.classList.remove("hidden")
}

function hideSwitchCameraButton() {
    switchCameraButton.classList.add("hidden")
}

function setAvailableCameras() {
    if (allCameraSources.length > 1) {
        enableCameraButton.classList.add("including-switch-camera")
        switchCameraButton.classList.remove("hidden")
    } else {
        enableCameraButton.classList.remove("including-switch-camera")
        switchCameraButton.classList.add("hidden")
    }
}

function getRegistrationNumberFromText(text) {
    text = removeWhiteSpaceFromText(text)
    // RegEx for getting registration numbers starting with either "RVG", "RVH" or "EU/" and ending with a number
    const rx = /(RVG|RVH|EU\/)\d+(\d+|\/|\=)+/
    const arr = rx.exec(text);
    return arr ? arr[0] : undefined;
}

function removeWhiteSpaceFromText(text) {
    return text && text.length ?
        text.trim().replace(/ /g, '').toUpperCase() :
        text
}

// Check if the user can use mediaDevices
if (!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {

    enableCameraButton.addEventListener("click", callback => {
        enableCamera(sourceId);
        showRelevantComponents();
    });

    switchCameraButton.addEventListener("click", callback => {
        disableCamera();
        setNextCamera().then(newSourceId => {
            enableCamera(newSourceId);
        })
    });

    disableCameraButton.addEventListener("click", callback => {
        showEnableCameraButton();
        hideCameraCanvas();
        hideRelevantComponents()

        setTimeout(function () {
            disableCamera();
        }, 1000);
    });

    cancelScanButton.addEventListener("click", callback => {
        stopWorker().then(() => {
            takeSnapshots()
        })
    });

    searchMedicineInput.addEventListener("input", callback => {
        const searchValue = searchMedicineInput.value

        const registrationNumber = getRegistrationNumberFromText(searchValue)

        // If the registration number exactly matches the search value, fetch it.
        // Otherwise look up the search value
        return (registrationNumber && registrationNumber.length > 0)
            ? fetchRegistrationNumber(registrationNumber)
            : lookUpMedicine(searchValue)
    });
} else {
    console.log("getUserMedia() is not supported by your browser")
}

function showHideCameraButton() {
    disableCameraButton.classList.remove("hidden")
    enableCameraButton.classList.add("hidden")
}

function showEnableCameraButton() {
    enableCameraButton.classList.remove("hidden")
    disableCameraButton.classList.add("hidden")
}

function setCameraDevices() {
    allCameraSources.length = 0

    return navigator.mediaDevices.enumerateDevices()
        .then(function (devices) {

            devices.forEach(function (device) {
                // returns all the user's video inputs
                if (device.kind === 'videoinput' &&
                    device.deviceId &&
                    device.deviceId.length) {
                    allCameraSources.push(device.deviceId)
                }
            });
            setAvailableCameras();
            return true
        })
}

function showRelevantComponents() {
    // cameraComponents.classList.remove('hidden')
    // cameraComponents.style.maxHeight = null
    cameraComponents.style.height = 'fit-content'

}

function hideRelevantComponents() {
    // cameraComponents.classList.add('hidden')
    cameraComponents.style.height = 0
    // cameraComponents.style.maxHeight = 0
}

async function getUserMediaDevices(deviceId) {
    if (!deviceId)
        await setCameraDevices();

    sourceId = deviceId ? deviceId : allCameraSources[0];

    setLogText(`Camera devices: ${allCameraSources ? allCameraSources.length : 'unknown'}
    Current selected camera: ${allCameraSources && sourceId ? (allCameraSources.indexOf(sourceId) + 1) : 'unknown'}
    
    Selected camera Id:
    ${sourceId}`
    )

    return {video: {mandatory: {sourceId: sourceId}}};
}

function setLogText(text) {
    statusText.innerText = text
}

async function setNextCamera() {
    if (allCameraSources.length > 1 && sourceId) {
        const index = allCameraSources.indexOf(sourceId);

        if (index >= 0 && index < allCameraSources.length - 1) {
            sourceId = allCameraSources[index + 1]
            return allCameraSources[index + 1]
        } else {
            sourceId = allCameraSources[0]
            return allCameraSources[0]
        }
    }

}

let mediaStream;

async function enableCamera(sourceId = undefined) {
    const userMediaDevices = await getUserMediaDevices(sourceId)

    navigator.mediaDevices.getUserMedia(userMediaDevices).then((stream) => {
            console.log("Camera permission was granted")

            mediaStream = stream

            // Show the camera content as soon as metadata is laoded
            videoCanvas.addEventListener("loadedmetadata", callback => {
                const videoWidth = videoCanvas.videoWidth
                const videoHeight = videoCanvas.videoHeight
                const canvasWidth = videoCanvas.offsetWidth

                // Ratio table overview for calculating correct height taking the aspect ratio into account:
                //
                //              | Height       | Width       |
                //  ------------|--------------|-------------|
                //  VideoCanvas | canvasHeight | canvasWidth |
                //  VideoStream | videoHeight  | videoWidth  |
                //  ------------|--------------|-------------|
                //
                // In dutch this is called a "kruistabel"

                const canvasHeight = (videoHeight * canvasWidth / videoWidth)

                showCameraCanvas(parseInt(canvasHeight))
                showHideCameraButton();
            });

            videoCanvas.srcObject = stream
            videoCanvas.play();

            console.log("Taking snapshots")
            takeSnapshots(stream)
        }
    ).catch(function (error) {
        console.log("Camera permission was rejected or is not available", error)
    }).finally(function () {
        isCameraEnabled = true
        setCameraDevices()
    })
}

function setLoadingProgress(scanProgress) {
    // Percentage is 0 when progress is done (scanProgress = 1). This is to hide the loading bar when done
    const percentage = (scanProgress !== 1) ? scanProgress * 100 : 0

    loadingBar.style.width = `${percentage}%`
    percentage === 0 ? loadingBar.style.maxWidth = 0 : loadingBar.style.maxWidth = null
    progressText.innerText = percentage ? `Progress (${Math.round(percentage)}%):` : 'Progress:'
}

function disableCamera() {
    mediaStream.getTracks().forEach(function (track) {
        console.log("disable stream")

        track.stop();
        videoCanvas.srcObject = undefined
        isCameraEnabled = false
    });
}

function takeSnapshots() {
    if (mediaStream && mediaStream.active) {

        new Promise(resolve => resolve(scanProgress))
            .then(scanProgress => {
                // Wait for the worker to finish current batch
                if (scanProgress !== 1) return;

                let scannedText

                return getBlobScreenshot()
                    .then(blob => {
                        const image = getImageFromBlob(blob)
                        return getTextFromImage(image)
                    })
                    .then(text => {
                        scannedText = text
                        return getRegistrationNumberFromText(text)
                    })
                    .then(registrationNumber => {
                        return (registrationNumber && registrationNumber.length > 0)
                            ? fetchRegistrationNumber(registrationNumber)
                            : undefined
                    })
            })
            .catch(error => {
                console.log("something went wrong", error)
            }).finally(() => {
            // interval in millisecconds per screencapture
            setTimeout(takeSnapshots, 2000);
        })
    } else {
        console.log("Interval removed")
        // clearInterval(interval);
    }
}

function getImageFromBlob(blob) {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;

    return image
}

/**
 * Takes a screenshot from the mediastream.
 * @returns {Blob} Blob from screenshot
 */
function getBlobScreenshot() {
    // Get a single frame from the mediastream
    const test = mediaStream.getVideoTracks()[0]

    // Make an imagecapture object in order to get the blob data
    const imageCapture = new ImageCapture(test);

    // Returns a promise that resolves with blob data from the captured image
    return imageCapture.takePhoto().then(blob => {
        if (!blob) throw "No blob file was created"

        const blobSizeMb = (Math.round((blob.size / 1000000) * 10) / 10)

        // return blob
        return blob
    })
}

function uploadScreenshot(blob) {
    if (!blob) throw "blob is undefined"

    socket.emit('upload', blob, (response) => {
        if (response) {
            console.log("response true!")
        }
    });
}

function fetchRegistrationNumber(registrationNumber) {
    if (!registrationNumber) throw "blob is undefined"

    return socket.emit('get-medicine', registrationNumber, (response) => {
        if (response) {
            console.log("response true!")
        }
        return true;
    });
}

function lookUpMedicine(text) {
    text = removeWhiteSpaceFromText(text)
    if (!text) {
        scanResultContainer.innerHTML = ``
        return;
    }

    return socket.emit('search-medicine', text, (response) => {
        if (response) {
            console.log("response true!")
        }
        return true;
    });
}

socket.on('search-result', function (result) {
    console.log("Associated medicine data", result);

    const medicineResultsHtml = getMedicineResultsHtml(result)

    // Insert medicine item into the DOM
    scanResultContainer.innerHTML = medicineResultsHtml

    // Show the medicine
    scanResultContainer.classList.remove("hidden")
});

function getMedicineResultsHtml(result) {
    let html = `<p id="results-amount-indicator">Showing <b>${result.length}</b> medicine</p>`

    for (let i = 0; i < result.length; i++) {
        // Prepare the data used
        const registrationNumber = result[i].registrationNumber
        const allNames = result[i].name.split(/\|/)
        const activeIngredients = result[i].activeIngredient.split(/\|/)

        // Create html template for the medicine
        html += `<div class="medicine-item">`

        if (registrationNumber) {
            html += `<div class="medicine-registration-number-container">
        <img alt="Registration number" src="/img/icons/assignment-24px.svg">
        <p class="medicine-registration-number">${registrationNumber}</p>
            </div>`
        }

        for (let i = 0; i < allNames.length; i++) {
            if (allNames[i] && allNames[i].length) {
                html += `<div class="medicine-name-container">
                <img alt="Medicine name" src="/img/icons/title-24px.svg">
                <p class="medicine-name">${allNames[i]}</p>
                </div>`
            }
        }

        for (let i = 0; i < activeIngredients.length; i++) {
            if (activeIngredients[i] && activeIngredients[i].length) {
                html += `<div class="medicine-active-ingredient-container">
                        <img alt="Active ingrediënt" src="/img/icons/scatter_plot-24px.svg">
                        <p class="medicine-active-ingredient">${activeIngredients[i]}</p>
                        </div>`
            }
        }

        html += `</div>`
    }

    return html;
}


function showCameraCanvas(canvasHeight) {
    videoCanvas.style.maxHeight = `${canvasHeight}px`
    videoCanvas.style.minHeight = `${canvasHeight}px`

    videoCanvas.classList.remove("hideCameraCanvas")
    videoCanvas.classList.add("showCameraCanvas")
}

function hideCameraCanvas() {
    videoCanvas.style.maxHeight = 0
    videoCanvas.style.minHeight = 0

    videoCanvas.classList.remove("showCameraCanvas")
    videoCanvas.classList.add("hideCameraCanvas")
}

// Modal stuff down here (https://www.w3schools.com/howto/tryit.asp?filename=tryhow_css_modal)

// Get the modal
const modal = document.getElementById("info-modal");

// Get the button that opens the modal
const btn = document.getElementById("camera-info");

// Get the <span> element that closes the modal
const span = document.getElementsByClassName("close")[0];

// When the user clicks the button, open the modal
btn.onclick = function () {
    modal.style.display = "block";
}

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
    modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}
