const videoCanvas = document.getElementById('user-camera');
const enableCameraButton = document.getElementById("enable-camera-button");
const disableCameraButton = document.getElementById("disable-camera-button");

// Initiate socket for user
let socket = io();

// All types of media devices the app needs permission of
const userMediaDevices = {video: true};

// Check if the user can use mediaDevices
if (!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {

    enableCameraButton.addEventListener("click", callback => {
        enableCamera();
    });

    disableCameraButton.addEventListener("click", callback => {
        showEnableCameraButton();
        hideCameraCanvas();

        setTimeout(function () {
            disableCamera();
        }, 1000);
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

function printCameraDevices() {
    navigator.mediaDevices.enumerateDevices()
        .then(function (devices) {
            devices.forEach(function (device) {
                // returns all the user's video inputs
                if (device.kind === 'videoinput' &&
                    device.deviceId &&
                    device.deviceId.length) {
                    // console.log("Camera permission was granted")
                    console.log("Device:", device.label)
                }
            });
        })
}

// Show the camera content as soon as metadata is laoded
videoCanvas.addEventListener("loadedmetadata", callback => {
    showCameraCanvas()
});

let mediaStream;

function enableCamera() {
    navigator.mediaDevices.getUserMedia(userMediaDevices).then((stream) => {
        mediaStream = stream
        console.log("Camera permission was granted")

        videoCanvas.srcObject = stream

        showHideCameraButton();
    }).catch(function (error) {
        console.log("Camera permission was rejected or is not available")
    })

    printCameraDevices()
}

function disableCamera() {
    mediaStream.getTracks().forEach(function (track) {
        console.log("disable stream")

        track.stop();
        videoCanvas.srcObject = undefined
    });
}

function showCameraCanvas() {
    videoCanvas.classList.remove("hideCameraCanvas")
    videoCanvas.classList.add("showCameraCanvas")
}

function hideCameraCanvas() {
    videoCanvas.classList.remove("showCameraCanvas")
    videoCanvas.classList.add("hideCameraCanvas")
}

