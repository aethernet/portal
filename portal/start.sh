#!/bin/bash

OS_VERSION=$(echo "$BALENA_HOST_OS_VERSION" | cut -d " " -f 2)
echo "Device Type is $BALENA_DEVICE_TYPE"

# we can do stuff here if needed (like configure camera with v4l2-ctl)

npm start