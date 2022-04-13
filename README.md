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

![Overview Diagram](portal-overview.png "overview")

## Technical choices
### Constraints
We want the system to be :
	- HQ A/V
	- multi-channel
	- low latency streams
	- resilient 
	- low-configuration

### SBC vs x86
Initial plan was to use a Jetson Nano, it didn't work (cf learning section), so we moved to an x86 platform (using a couple intel NUC).

As the CPU of the NUC is way more powerful, it's now possible to do both MJPEG decoding and h.264 encoding in software at 1080p30.

I supect that using cameras producing a h.264 stream instead of MJPEG we could use a Pi 4.

### Cameras
As I had two MJPEG 4K30 usb cameras available, I decided to use those but to capture at 1080p30.

### Projectors
For development purposes I used two hdmi monitor, one plugged using mini-hdmi output of the NUC, second using a mini-DP to HDMI adaptor.

Altought on a Raspberry Pi GStreamer is able to directly output video to the framebuffer, on x86 and on Jetson Nano, I had to spawn a xserver to properly display video. This is done using the [xserver block](https://github.com/balenablocks/xserver) from balena.

### Audio
High quality soundcard working on linux are not always easy to find.
So I decided to go with a Scarlett 4i4 3rd gen.

It has 4 line ouputs, 2 mic input (with preamp) and 2 line output. And is usb _class-compliant_ which means it works on linux without a dedicated driver.

Testing shows that I can easily capture all 4 audio channels to a file using alsarec (and replay them with alsaplay).

Although an [audio block](https://github.com/balenablocks/audio)  exists, it's value in our case wasn't obvious as directly interacting with Alsa from GStreamer is simple and effective.

### Streaming
There's plenty of streaming protocal on the market, my eye got caught by SRT, an open-source, royalty free, modern, professional streaming protocol made for low-latency and unreliable network (aka the internet).

> "Originally developed and pioneered by Haivision, SRT stands for Secure Reliable Transport. SRT is an open source video transport protocol and technology stack that optimizes video streaming performance across unpredictable networks. With secure streams and simplified firewall traversal, SRT delivers the best quality video over the worst networks." 	[https://www.haivision.com/products/srt-secure-reliable-transport/](https://www.haivision.com/products/srt-secure-reliable-transport/)

Bonus, it's Included in Gstreamer since 1.16, so no need to compile ourself.

### A/V processing
GStreamer will be out framework of choice to capture audio and video, transcode, package, stream, decode and display.

GStreamer is notoriously complex to use, with hard to read documentation and confusing error messages.

So to make it easier to setup and test, a new balena project called "gst-playground" will be developed. It will contains a fully functional installation of gstreamer with gstshark and some visualising tools to help debug.

### Live build logs

https://docs.google.com/document/d/1YtqM9IKC1RARrwvitG2_fHyDRxGGfLRCbiqlT5SFSPg
