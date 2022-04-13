const gstreamer = require("gstreamer-superficial")

const runningPipe = null

/** Receiver pipe */
const receiverPipe = ({ SENDER_IP }) => `
  srtsrc uri=srt://${SENDER_IP}:8888
  ! queue2
  ! tsdemux name=demux
  demux.
  ! queue
  ! h264parse
  ! video/x-h264 
  ! avdec_h264
  ! xvimagesink display=:2
  demux.
  ! queue
  ! avdec_aac
  ! audioconvert
  ! alsasink device=plughw:2,0
`

/** Sender pipe */
const senderPipe = ({}) => `
  compositor name=comp sink_0::xpos=0 sink_0::ypos=0 sink_0::width=1920 sink_0::height=1080 sink_1::xpos=1920 sink_1::ypos=0 sink_1::width=1920 sink_1::height=1080
  ! video/x-raw, width=3840, height=1080
  ! queue
  ! x264enc
    tune=zerolatency
    speed-preset=veryfast
    bitrate=6000
    byte-stream=true
    key-int-max=15
    intra-refresh=true
  ! video/x-h264,profile=baseline,framerate=30/1
  ! queue
  ! mpegtsmux name=mux
  ! srtsink uri=srt://:8888/ latency=300
  v4l2src device=/dev/video2 do-timestamp=true
  ! "image/jpeg,framerate=30/1,width=1920,height=1080"
  ! jpegdec
  ! queue
  ! comp.sink_1
  v4l2src device=/dev/video0 do-timestamp=true
  ! "image/jpeg,framerate=30/1,width=1920,height=1080"
  ! jpegdec
  ! queue
  ! comp.sink_0
  alsasrc device=plughw:3,0
  ! audio/x-raw,format=S32LE,rate=48000,channel=2
  ! audioconvert
  ! avenc_aac
  ! aacparse
  ! queue
  ! mux.
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
  DISPLAY: process.env.DISPLAY ?? 3,
  AUDIO_CHANNELS: process.env.AUDIO_CHANNELS ?? 2,
  CAM1_DEVICE: process.env.CAM1_DEVICE ?? "/dev/video0",
  CAM2_DEVICE: process.env.CAM2_DEVICE ?? "/dev/video2",
  AUDIO_DEVICE: process.env.AUDIO_DEVICE ?? "plughw:3,0",
  SENDER_IP: process.env.SENDER_IP ?? "192.168.2.38",
}

console.log("Will start as ", IS_SENDER)
console.log(JSON.stringify(params))

// run pipe
if (IS_SENDER) startPipeline(senderPipe(params))
else startPipeline(receiverPipe(params))
