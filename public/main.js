// DOM elements
const capture = document.getElementById("capture");
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const videos = document.querySelectorAll("video");
const settings = document.getElementById("settings");

// Make socket connection (which will function as signaling channel)
var socket;
if (false) {
    socket = io.connect('http://localhost:3000');
}
else {
    socket = io.connect('http://naitzirch.ddns.net', { secure: false, port: 80});
}

// Array of users
let userArray = [];

// Update connectionArray every time a new user joins
socket.on('users-update', function(data) {
    userArray = data.userArray;
});

// Create RTCPeerConnection
const config = {
    iceServers: [{ urls: 'stun:stun1.l.google.com:19302' }],
};
const pc = new RTCPeerConnection(config);

// Handle incoming tracks
pc.ontrack = ({ track, streams }) => {
    console.log("ontrack");
    track.onunmute = () => {
        if (remoteVideo.srcObject) {
            return;
        }
        remoteVideo.srcObject = streams[0];
    };
};

// Making an offer
let makingOffer = false;

pc.onnegotiationneeded = async () => {
    console.log("onnegotiationneeded");
    try {
        makingOffer = true;
        await pc.setLocalDescription();
        socket.send({ description: pc.localDescription });
    } catch (err) {
        console.error(err);
    } finally {
        makingOffer = false;
    }
};

pc.onicecandidate = ({ candidate }) => socket.send({ candidate });


// Handling incoming messages on the signaling channel TODO: determine polite
let ignoreOffer = false;

socket.on('message', async ( { description, candidate } ) => {
    console.log(description);
    let polite = false;
    if (userArray[1] == socket.id) {
        polite = true;
    }
    try {
        if (description) {
            const offerCollision =
                description.type === "offer" &&
                (makingOffer || pc.signalingState !== "stable");

            ignoreOffer = !polite && offerCollision;
            if (ignoreOffer) {
                return;
            }

            await pc.setRemoteDescription(description);
            if (description.type === "offer") {
                await pc.setLocalDescription();
                socket.send({ description: pc.localDescription });
            }
        } else if (candidate) {
            try {
                await pc.addIceCandidate(candidate);
            } catch (err) {
                if (!ignoreOffer) {
                    throw err;
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
});




function openFullscreen(elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
    }
}

let audioTrack = null;
let videoTrack = null;

// Function for creating MediaStreams
async function start(constraints) {
    let MediaStream = null;
    try {
        MediaStream = await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (err) {
        console.error(`Error: ${err}`);
    }
    return MediaStream;
}

// Function for outputting video and audio settings
function getCurrentSettings(stream) {
    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();

    if (audioTracks.length > 0) {
        audioTrack = audioTracks[0];
    }
    if (videoTracks.length > 0) {
        videoTrack = videoTracks[0];
    }

    if (videoTrack) {
        videoSettingsText.innerText = JSON.stringify(videoTrack.getSettings(), null, 2);
    }

    if (audioTrack) {
        audioSettingsText.innerText = JSON.stringify(audioTrack.getSettings(), null, 2);
    }
}


/* EVENT LISTENERS */

// When the capture button is clicked
capture.addEventListener("click", async () => {
    
    const constraints = JSON.parse(settings.innerText);
    console.log(constraints);

    // Create MediaStream
    let captureStream = await start(constraints);

    // Update frontend
    // localVideo.srcObject = captureStream;
    getCurrentSettings(captureStream);

    // Connect to remote peer
    for (const track of captureStream.getTracks()) {
        pc.addTrack(track, captureStream);
    }

})

// Open video in fullscreen
videos.forEach((video) => {
    video.addEventListener("dblclick", () => {
        openFullscreen(video);
    })
}); 
