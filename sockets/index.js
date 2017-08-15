exports.rtcNSFac = (io) => {

  const rtcNS = io.of('/rtc');
  rtcNS.on('connection', (socket) => {
    console.log(`someone connected to /rtc at ${new Date()}`);
  })
}