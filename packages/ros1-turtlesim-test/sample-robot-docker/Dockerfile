FROM ros:noetic-robot-focal

RUN apt-get update && apt-get install -y \
  ros-noetic-ros-tutorials \
  ros-noetic-rosbridge-suite \
  xvfb \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -ms /bin/bash rosuser

USER rosuser
ENV HOME=/home/rosuser
WORKDIR /home/rosuser

COPY entrypoint.sh /home/rosuser/entrypoint.sh
COPY rosbridge_websocket.launch /home/rosuser/rosbridge_websocket.launch

ENTRYPOINT [ "/bin/bash", "/home/rosuser/entrypoint.sh" ]
