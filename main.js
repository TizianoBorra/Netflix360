function setVideo(src) {
    const video = document.getElementById('video360');
    video.setAttribute('src', src);
    video.play();
  }

  // Cargar un video por defecto al iniciar
  window.onload = () => setVideo('videos/video1.mp4');