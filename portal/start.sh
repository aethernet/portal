#!/bin/bash

OS_VERSION=$(echo "$BALENA_HOST_OS_VERSION" | cut -d " " -f 2)
echo "Device Type is $BALENA_DEVICE_TYPE"

# we can do stuff here if needed (like configure camera with v4l2-ctl)

# Wait for xserver to accept connections if we're a receiver
if [ "$SENDER_OR_RECEIVER" == "receiver" ]; then
  while [ `ls /tmp/.X11-unix/ | wc -l` == 0 ]; do echo "display not created yet"; sleep 0.5; done; echo "display created";
  DISPLAY=`ls /tmp/.X11-unix/ | sed s/X/:/`
  export DISPLAY
  echo "DISPLAY is set to $DISPLAY"
  while ! xset -q; do echo "display doesn't accept connection yet"; sleep 0.5; done; echo "display ready";
fi

npm start