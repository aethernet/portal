const gstreamer = require("gstreamer-superficial")

let runningPipe = null

/** Receiver pipe */
const receiverPipe = ({ SENDER_IP, DISPLAY, AUDIO_DEVICE }) => `
  srtsrc uri=srt://${SENDER_IP}:8888
  ! queue2
  ! tsdemux name=demux
  demux.
  ! queue
  ! h264parse
  ! video/x-h264 
  ! avdec_h264
  ! xvimagesink display=${DISPLAY}
  demux.
  ! queue
  ! avdec_aac
  ! audioconvert
  ! alsasink device=${AUDIO_DEVICE}
`

/** Sender pipe */
const senderPipe = ({ CAM1_DEVICE, CAM2_DEVICE, AUDIO_CHANNELS, AUDIO_DEVICE, CAM_PIPE }) => `
  compositor name=comp sink_0::xpos=0 sink_0::ypos=0 sink_0::width=1920 sink_0::height=1080 sink_1::xpos=1920 sink_1::ypos=0 sink_1::width=1920 sink_1::height=1080
  ! video/x-raw, width=3840, height=1080
  ! queue
  ! x264enc tune=zerolatency speed-preset=veryfast bitrate=6000 byte-stream=true key-int-max=15 intra-refresh=true
  ! video/x-h264,profile=baseline,framerate=30/1
  ! queue
  ! mpegtsmux name=mux
  ! srtsink uri=srt://:8888/
  v4l2src device=${CAM2_DEVICE} do-timestamp=true
  ${CAM_PIPE}
  ! queue
  ! comp.sink_1
  v4l2src device=${CAM1_DEVICE} do-timestamp=true
  ${CAM_PIPE}
  ! queue
  ! comp.sink_0
  alsasrc device=${AUDIO_DEVICE}
  ! audio/x-raw,format=S32LE,rate=48000,channel=${AUDIO_CHANNELS}
  ! audioconvert
  ! avenc_aac
  ! aacparse
  ! queue
  ! mux.
`

const cameraPipeMJPEG = () => `
  ! image/jpeg,framerate=30/1,width=1920,height=1080
  ! jpegdec
`

const cameraPipeH264 = () => `
  ! video/x-h264, framerate=30/1, width=1920, height=1080 
  ! h264parse
  ! avdec_h264
`

/** RUN PIPELINE */
const startPipeline = (pipe) => {
  try {
    if (!pipe) throw Error(`Can't start pipe: no pipe provided`)
    console.log("START pipe : ", pipe)
    runningPipe = new gstreamer.Pipeline(pipe)
    runningPipe.play()
    return true
  } catch (err) {
    console.error(err)
    return false
  }
}

/** STOP PIPELINE
 * No use for now
 */
const stopPipeline = () => {
  console.log("STOP pipe")
  runningPipe.stop()
  return true
}

/** GET STATUS
 * No use for now
 */
const getStatus = () => {
  const position = runningPipe ? runningPipe.queryPosition() : null
  return position
}

/** Start */

// get variables from evironement with sensible default
if (!["receiver", "sender"].includes(process.env.SENDER_OR_RECEIVER))
  throw Error("This service doesn't know if it's a sender or receiver, please set SENDER_OR_RECEIVER env var to either 'receiver' or 'sender'")

const IS_SENDER = process.env.SENDER_OR_RECEIVER === "sender"

const params = {
  DISPLAY: process.env.DISPLAY, // only usefull for receiver, this is set by the start script, and shoulnd't be overriden
  CAM1_DEVICE: process.env.CAM1_DEVICE ?? "/dev/video0", // only usefull for sender
  CAM2_DEVICE: process.env.CAM2_DEVICE ?? "/dev/video2", // only usefull for sender
  CAM_ENCODER: process.env.CAM_ENCODER ?? "MJPEG", // only usefull for sender
  CAM_PIPE: process.env.CAM_PIPE ?? undefined, // default undefined, only usefull for sender, only usefull if no CAM_ENCODER is set
  AUDIO_DEVICE: process.env.AUDIO_DEVICE ?? "plughw:3,0", // both receiver and sender (might be different)
  AUDIO_CHANNELS: process.env.AUDIO_CHANNELS ?? 2, // only usefull for sender
  SENDER_IP: process.env.SENDER_IP ?? "192.168.2.38", // only usefull for receiver
}

console.log("Will start as ", IS_SENDER ? "sender" : "receiver")
console.log(JSON.stringify(params))

// Set encoder
if (["H264", "MJPEG"].includes(params.CAM_ENCODER)) params.CAM_PIPE = params.CAM_ENCODER === "H264" ? cameraPipeH264() : cameraPipeMJPEG()

if (IS_SENDER && (!params.CAM_PIPE || params.CAM_PIPE === "")) throw Error("We need a CAM encoder")

// run pipe
if (IS_SENDER) startPipeline(senderPipe({ ...params }))
else startPipeline(receiverPipe({ ...params }))

// idle (https://stackoverflow.com/a/66770224/4530457)
var running = true

function killProcess() {
  running = false
}

process.on("SIGTERM", killProcess)
process.on("SIGINT", killProcess)
process.on("uncaughtException", function (e) {
  console.log("[uncaughtException] app will be terminated: ", e.stack)
  killProcess()
})

function run() {
  setTimeout(function () {
    if (running) run()
  }, 10000)
}

run()
