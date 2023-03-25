// DOM elements
const capture = document.getElementById("capture");
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const videos = document.querySelectorAll("video");

// Make socket connection (which will function as signaling channel)
var socket = io.connect('http://naitzirch.ddns.net', { secure: false, port: 80});

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


/* EVENT LISTENERS */


// {
//     resizeMode: "none",
//     frameRate: {ideal: 30, max: 60},
//     width: { ideal: 1920, max: 1920 },
//     height: { ideal: 1080, max: 1080 },
//     cursor: "always"
// }

// When the capture button is clicked
capture.addEventListener("click", async () => {

    const constraints = {
        video: {
            frameRate: {ideal: 30, max: 60},
            cursor: "always"
        },
        audio: {
            autoGainControl: false,
            echoCancellation: false,
            googAutoGainControl: false,
            noiseSuppresion: false
        }
    }
    
    // Create MediaStream
    let captureStream = await start(constraints);

    // Update frontend
    // localVideo.srcObject = captureStream;

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
