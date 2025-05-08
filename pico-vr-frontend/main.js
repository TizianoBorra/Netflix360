const menu = document.getElementById('menu');
const videoEl = document.getElementById('video360');
const videosphere = document.getElementById('videosphere');
const loadingIndicator = document.getElementById('loading');

console.log('Iniciando aplicación...');

// Mostrar errores en la interfaz
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.color = 'red';
  errorDiv.style.margin = '10px';
  errorDiv.textContent = message;
  menu.appendChild(errorDiv);
  console.error(message);
}

// Configurar la esfera de video correctamente
AFRAME.registerComponent('video-setup', {
  init: function () {
    this.el.setAttribute('geometry', {
      primitive: 'sphere',
      radius: 100,
      segmentsWidth: 64,
      segmentsHeight: 64
    });

    // Material con configuraciones importantes para video 360
    this.el.setAttribute('material', {
      shader: 'flat',
      src: '#video360',
      side: 'back', // Mostrar desde el interior de la esfera
      npot: true    // Importante para texturas de video
    });

    // Invertar la esfera para que el video se vea correctamente
    this.el.setAttribute('scale', '-1 1 1');

    console.log('Video sphere configurada correctamente');
  }
});

fetch('http://192.168.0.35:4000/videos')
  .then(res => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  })
  .then(videos => {
    console.log('Videos recibidos:', videos);
    videos.forEach(video => {
      const btn = document.createElement('button');
      btn.textContent = video.label;
      btn.onclick = async () => {
        try {
          console.log(`Seleccionado video: ${video.label} (ID: ${video.youtubeId})`);
          loadingIndicator.style.display = 'block';

          // Reiniciar el video
          videoEl.pause();
          videoEl.removeAttribute('src');
          videoEl.load(); // Limpiar el buffer

          // Configurar nueva fuente
          videoEl.crossOrigin = "anonymous";
          videoEl.playsInline = true;
          videoEl.loop = true; // Agregar loop
          videoEl.muted = false; // Quitar mute para audio
          videoEl.src = `http://192.168.0.35:4000/stream/${video.youtubeId}`;

          console.log('Esperando a que el video esté listo...');

          await new Promise((resolve, reject) => {
            videoEl.onloadeddata = () => {
              console.log('Video datos cargados');
              resolve();
            };
            videoEl.onerror = (e) => {
              console.error('Error en elemento video:', e);
              reject(new Error('Error al cargar el video'));
            };
            setTimeout(() => reject(new Error('Tiempo de espera agotado para la carga del video')), 30000);
          });

          console.log('Video cargado, actualizando textura...');

          // Forzar actualización de la textura
          const material = videosphere.getAttribute('material');
          videosphere.setAttribute('material', 'src', '');
          setTimeout(() => {
            videosphere.setAttribute('material', 'src', '#video360');
            // Asegurarse de que el material se actualiza
            if (videosphere.components.material) {
              videosphere.components.material.material.map.needsUpdate = true;
              videosphere.components.material.material.needsUpdate = true;
            }
          }, 100);

          console.log('Intentando reproducir...');
          try {
            await videoEl.play();
            console.log('Reproducción iniciada automáticamente');
          } catch (playErr) {
            console.warn('Reproducción automática bloqueada:', playErr);
            showError('Haz clic en la pantalla para reproducir');

            // Agregar un botón de reproducción explícito
            const playBtn = document.createElement('button');
            playBtn.textContent = "▶️ Reproducir";
            playBtn.style.background = "#f44336";
            playBtn.onclick = () => {
              videoEl.play().catch(err => {
                console.error('Error incluso con interacción del usuario:', err);
              });
            };
            menu.appendChild(playBtn);
          }

        } catch (err) {
          showError(`Error: ${err.message}`);
          console.error('Error al cargar el video:', err);
        } finally {
          loadingIndicator.style.display = 'none';
        }
      };
      menu.appendChild(btn);
    });
  })
  .catch(err => {
    showError('Error al cargar la lista de videos');
    console.error('Error en la solicitud de videos:', err);
  });

// Permitir reproducción manual al hacer clic
document.addEventListener('click', () => {
  if (videoEl && videoEl.paused) {
    videoEl.play().then(() => {
      console.log('Video reproducido por clic del usuario');
    }).catch(err => {
      console.warn('Error al reproducir manualmente:', err);
    });
  }
});

// Detectar errores en el video
videoEl.addEventListener('error', (e) => {
  console.error('Error en el elemento video:', e);
  showError(`Error de video: ${videoEl.error ? videoEl.error.message : 'Desconocido'}`);
});

// Monitorear el estado del video
videoEl.addEventListener('playing', () => {
  console.log('Video está reproduciendo');
});

videoEl.addEventListener('pause', () => {
  console.log('Video en pausa');
});

videoEl.addEventListener('stalled', () => {
  console.log('Video estancado');
});

// Agregar debugging
window.debug = {
  video: videoEl,
  sphere: videosphere,
  play: () => videoEl.play(),
  updateTexture: () => {
    if (videosphere.components.material) {
      videosphere.components.material.material.map.needsUpdate = true;
      videosphere.components.material.material.needsUpdate = true;
    }
  }
};