# Portal

Portal is a gate between two remote music clubs.

# Mission statement

Connect artists and audience in the internet age without loosing the social aspect of parties.

# Why

In an age where streaming concert is common and bands stops touring due to climate impact, there's spaces for a new club exprience.

We want to keep the physical experience of beeing together in a club, watching concert and dancing on djs.

We want to discover and connect with music coming from other part of the globe.

We want artists to play to a real physical audience while making new fans.

# What

Portal connects two spaces, two stages and two audiences, across the internet to make one big international party.

On each side we capturing a high quality multi-channel audio and video feed which is projected on the other side.

During the party, the sender and receiver alternates to follow the action (where the current band/dj is playing).

# How

A multi-camera / multi-video-projectors is setup at each locations.
A sound card is connected to mixer table on each side as capture of the mix and playback.
A mic is plugged to the soundcard to capture ambiance.
Another mic is plugged to the soundcard to provide a technical audio channel between technicians.

![Overview Diagram](https://github.com/aethernet/portal/blob/c982d3df1f7cc3cf27bc65a450b2c84ed65404b5/docs/assets/portal-arch.png "overview")

## Technical choices

### Constraints

We want the system to be : - HQ A/V - multi-channel - low latency streams - resilient - low-configuration

### SBC vs x86

Initial plan was to use a Jetson Nano, it didn't work (cf learning section), so we moved to an x86 platform (using a couple intel NUC).

As the CPU of the NUC is way more powerful, it's now possible to do both MJPEG decoding and h.264 encoding in software at 1080p30.

I supect that using cameras producing a h.264 stream instead of MJPEG we could use a Pi 4.

### Cameras

As I had two MJPEG 4K30 usb cameras available, I decided to use those but to capture at 1080p30.

For the second stage of prototyping I've add two H.264 cameras for the second device, so I've added a env var to set the type of camera we're dealing with and set gstreamer pipelines accordingly.
A better way would be to auto-detect the type of camera instead of relying on an ENV, this would be quite easy to do by parsing the output of `v4l2-ctl`.

Actually we should automate the entire camera discovery using `v4l2-ctl`, but that's for later.

Anyway, currently we can set those three ENV :

- `CAM1_DEVICE = /dev/videoX`
- `CAM2_DEVICE = /dev/videoY`
- `CAM_ENCODER = ["MJPEG"|"H264]`

`CAM_ENCODER` will select and inject the right decoder before doing to composition, another solution would be to provide the decoder part of the pipeline using `CAM_PIPE`.

`CAM_PIPE` format should be a subset of the pipelines which assume it receive the ouput of `v4l2src` and will ouput to the sink of a `compositor` as 1080p30.
i.e. for mjpeg :

```gstreamer
  ! image/jpeg,framerate=30/1,width=1920,height=1080
  ! jpegdec
```

In a subsequent version we're going to add parameter for framerate and dimensions.

### Projectors

For development purposes I used two hdmi monitors, one plugged using mini-hdmi output of the NUC, second using a mini-DP to HDMI adaptor.

Altought on a Raspberry Pi GStreamer is able to directly output video to the framebuffer, on x86 and on Jetson Nano, I had to spawn a xserver to properly display video. This is done using the [xserver block](https://github.com/balenablocks/xserver) from balena.

### Audio

High quality soundcard working on linux are not always easy to find.
So I decided to go with a Scarlett 4i4 3rd gen.

It has 4 line ouputs, 2 mic input (with preamp) and 2 line output. And is usb _class-compliant_ which means it works on linux without a dedicated driver.

Testing shows that I can easily capture all 4 audio channels to a file using alsarec (and replay them with alsaplay).

Although an [audio block](https://github.com/balenablocks/audio) exists, it's value in our case wasn't obvious as directly interacting with Alsa from GStreamer is simple and effective.

Depending on the system and the cameras we're using, there might be multiple audio devices available in `alsa` and we need to find our sound card.

We can use `aplay -l` or `arecord -l` to list the devices. For ease of use, we prefer to use the `plughw:` access instead of `hw:` which let alsa do some format transformation for us (like switching from fixed point to floating point if necessary).

We currently need to set the following ENV for audio :

- `AUDIO_DEVICE = plughw:X,Y`
- `AUDIO_CHANNELS = 2`

(X and Y are the ids of the soundcard and the ouput, ie: `plughw:0,0` or `plughw:2,0`)

As per our design, we should have 4 audio channels. But due to limitation of the hardware I had at hand (one 4x4 and one 2x2 sound card), I've not been able to test a proper 4 <-> 4 setup. Instead I've done a 2 <-> 2 which works fine.

Notes:

- `AUDIO_CHANNELS` is only needed for `sender`
- a current limitation is that you cannot send a 4 channel stream to a 2 channel receiver (didn't try other way, it might work).

### Streaming

There's plenty of streaming protocal on the market, my eye got caught by SRT, an open-source, royalty free, modern, professional streaming protocol made for low-latency and unreliable network (aka the internet).

> "Originally developed and pioneered by Haivision, SRT stands for Secure Reliable Transport. SRT is an open source video transport protocol and technology stack that optimizes video streaming performance across unpredictable networks. With secure streams and simplified firewall traversal, SRT delivers the best quality video over the worst networks." [https://www.haivision.com/products/srt-secure-reliable-transport/](https://www.haivision.com/products/srt-secure-reliable-transport/)

Bonus, it's Included in Gstreamer since 1.16, so no need to compile ourself.

### A/V processing

GStreamer will be our framework of choice to capture audio and video, transcode, package, stream, decode and display.

GStreamer is notoriously complex to use, with hard to read documentation and confusing error messages.

So to make it easier to setup and test, a new balena project called "gst-playground" will be developed. It will contains a fully functional installation of gstreamer with gstshark and some visualising tools to help debug.

### XServer

As we're on x86 we need an X-Server to display video.

Note that on a Raspberry Pi we can output to fb directly without the need of an x-server.

So we're using `balenablocks/xserver` to get the server.
We need to ensure it's running and ready to accept connections before starting our receiver service.

As there's a bug with makes the DISPLAY id unpredictable (it should be :0, but sometimes it's :1 or :2 or higher).

### Node JS

Although we're doing something simple and we could simply use `gst-launch` and some batch, it would lack flexibility.

`gst-launch` is an amazing tool to protype, not for production.

There's no complete gstreamer binding for nodejs yes, but there is one good npm packages : [gstreamer-superficial](https://www.npmjs.com/package/gstreamer-superficial).

Totally does the job.

So our main app will be a simple `nodejs` script, constructing gstreamer pipelines and providing some control over them.

### Balena

Initial work for this project is done during my Residency in the BalenaLab.

Balena mission is to help realize the power of physical computing by reducing the friction for iot fleet owners.

What does it means for this project?

- host is running balenaOS
- container engine is balenaEngine (basically docker optimized for iot)
- we'll use balenaCloud for provisionning, management and updates because is super convenient
- we're using (and creating) reusable `blocks` and will push the whole thing to balenaHub for other to benefit
- this whole thing is opensource
- and per balena's culture I'm working in the open

Note that even if I didn't worked a balena, I still would use that stack, it's just so efficient to do so, it's a no brainer.

### Networking

The two portal needs to find each other and make sure they can communicate.

To make thing easy, I'm going to use a `ZeroTier` to create a VPN on which the devices will see each other as if they were on the same physical network.

To do that I intent to use a fork of [balena-zerotier](https://github.com/synapzlu/balena-zerotier)

We'll use `mdns` to find peers on the network, setting up the name of the devices with [`mdns-advertise`](https://hub.balena.io/gh_nucleardreamer/mdns-advertise) block.
Setting the mdns address is done by setting environment : `MDNS_TLD: "ella.local"`, `MDNS_TLD: "glen.local"`

Per convention we name the portal after Philip K Dick's books characters.

### Monitoring

We'll drop the [`netdata`](https://hub.balena.io/gh_odyslam/netdatablock) `block` for off the shelf automatic monitoring.

## Putting everything together

We'll eventually have those services running on the device (each service is a container) :

- [x] `portal-receiver` (./portal)
- [x] `portal-sender` (./portal)
- [ ] `zerotier` (./zerotier)
- [x] `xserver` (balenablocks/xserver)
- [x] `mdns-advertise` (bh.cr/gh_nucleardreamer/mdns-advertise)
- [x] `netdata` (bh.cr/gh_odyslam/netdatablock)

## GStreamer

The big part of our work is actually GStreamer pipelines.

The pipelines will be dyanamically constructed based on the device environement, and some discovered parameters.

Those are example of what the final pipelines will looks like (with all values hardcoded), and were used for prototyping.

### Sender Pipeline

```gstreamer
gst-launch-1.0 -v \
compositor name=comp sink_0::xpos=0 sink_0::ypos=0 sink_0::width=1920 sink_0::height=1080 sink_1::xpos=1920 sink_1::ypos=0 sink_1::width=1920 sink_1::height=1080 \
! video/x-raw, width=3840, height=1080 \
! queue \
! x264enc \
  tune=zerolatency \
  speed-preset=veryfast \
  bitrate=6000 \
  byte-stream=true \
  key-int-max=15 \
  intra-refresh=true \
! video/x-h264,profile=baseline,framerate=30/1 \
! queue \
! mpegtsmux name=mux \
! srtsink uri=srt://:8888/ latency=300 \
v4l2src device=/dev/video2 do-timestamp=true \
! "image/jpeg,framerate=30/1,width=1920,height=1080" \
! jpegdec \
! queue \
! comp.sink_1 \
v4l2src device=/dev/video0 do-timestamp=true \
! "image/jpeg,framerate=30/1,width=1920,height=1080" \
! jpegdec \
! queue \
! comp.sink_0 \
alsasrc device=plughw:3,0 \
! audio/x-raw,format=S32LE,rate=48000,channel=4 \
! audioconvert \
! avenc_aac \
! aacparse \
! queue \
! mux.
```

TODO: insert here a graphical representation of the pipeline

### Receiver Pipeline

```gstreamer
gst-launch-1.0 -v \
srtsrc uri=srt://192.168.2.38:8888 \
! queue2 \
! tsdemux name=demux \
demux. \
! queue \
! h264parse \
! video/x-h264 ! avdec_h264 \
! xvimagesink display=:2 \
demux. \
! queue \
! avdec_aac \
! audioconvert \
! alsasink device=plughw:2,0
```

TODO: insert here a graphical representation of the pipeline

### TODO

- [ ] Camera Type autodection
- [ ] Camera quantity and layout auto-setup
- [ ] Size and Framerate parameters
- [ ] GUI
- [ ] Properly test a 4 audio channels setup
- [ ] Publish a proper `GStreamer-sandbox` & `GStreamer` blocks on balenahub

## Live build logs

https://docs.google.com/document/d/1YtqM9IKC1RARrwvitG2_fHyDRxGGfLRCbiqlT5SFSPg

## Lessons

### Jetson Nano

It sounded like the perfect board for the job with 2 videos ouputs, multiples usb inputs, hardware video encoder up to 4k30.

Unfortunately it's been quite hard to setup. And once it did, the hw jpeg decoder wasn't fast enough.

As our development cameras are MJPEG and the hardware decoder has not been able to decode the MJPEG at 1080p30 (max performance with hw decoder was 15fps, without hw decoder 5fps).

### MJPEG Camera

I had 2 decent 4k30 mjpeg usb cameras. So I tried to use those. It was a mistake.
Even at 1080p, decoding MJPEG at 30fps is a process intensive tasks for a SBC.
As explained in previous section, even with hardware acceleration, the Jetson nano was choking on it.

A better choice would have been to use cameras with an h.264 hardware encoder included.

## Known Bugs and Limitations

### No room to store incoming packet

`potal-receiver 07:06:37.140388/SRT:RcvQ:worker\*E:SRT.c: %231187076:No room to store incoming packet: offset=0 avail=0 ack.seq=1308217033 pkt.seq=1308217033 rcv-remain=8191``

Currently when the `receiver` connects to a running `sender` there's a high risk of a freezed image with this error flooding on `receiver` side.

Solution is to restart the `sender`.

It looks like some `buffer` is too small on `receiver` to accept the influx of data on initial connection if the `sender buffer` is already full.

One hypothesis would be to add `leaky=downstream` to the first `queue` on the receiver side. This might have unintended side effects, it needs to be carefully evaluated.
Effect would be to drop older data from the queue to make room for the new one; hypothesis is that the rest of the pipe is not ready yet to process the data that is already comming in and that we won't have this issue when everything is running.

### git submodules for `NetdataBlock` and `mdns-advertise`

Those `blocks` are not currently available on balenahub for `x86`. But nothing prevent them to be built for this platform, so until balenahub supports multiplatform or those blocks are uploaded for x86, we'll build them ourself.

Remedy would be to provide those blocks for x86 ourself, which we actually might do.

### audio device id

Over reboot the id of an alsa audio device is somehow unpredictable and depends on multiple factors, such as what are the other devices connected and the port they are connected to.

Remedy is to set `UDEV` rules to give predictable names to certain devices.
This requires some knowledge and predictability about either the device or the port it will be connected to.
