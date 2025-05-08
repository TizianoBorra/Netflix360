// server.js
const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD']
}));

// Configuración avanzada de logs
const logStream = fs.createWriteStream('server.log', { flags: 'a' });
const log = (message, level = 'INFO') => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;
  logStream.write(logMessage);
  console.log(logMessage.trim());
};

// Middleware de logging para todas las solicitudes
app.use((req, res, next) => {
  log(`Incoming request: ${req.method} ${req.url} from ${req.ip}`);
  next();
});

log('Servidor iniciado', 'INFO');

const VIDEO_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  log(`Directorio de videos creado: ${VIDEO_DIR}`, 'INFO');
}

// Función modificada para encontrar el archivo de video real
const findVideoFile = (youtubeId) => {
  const files = fs.readdirSync(VIDEO_DIR);
  // Buscar cualquier archivo que comience con el ID del video y termine en .mp4
  const videoFile = files.find(file => file.startsWith(youtubeId) && file.endsWith('.mp4'));
  return videoFile ? path.join(VIDEO_DIR, videoFile) : null;
};

app.get('/videos', (req, res) => {
  log('Procesando solicitud de lista de videos', 'DEBUG');
  try {
    const data = fs.readFileSync('videos.json', 'utf-8');
    const videos = JSON.parse(data);
    log(`Enviando lista con ${videos.length} videos`, 'INFO');
    res.json(videos);
  } catch (err) {
    log(`Error al leer videos.json: ${err.message}`, 'ERROR');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/stream/:youtubeId', async (req, res) => {
  const { youtubeId } = req.params;
  const cleanYoutubeId = youtubeId.replace(/[^\w-]/g, ''); // Limpiar ID
  log(`Iniciando stream para video ID: ${cleanYoutubeId}`, 'INFO');

  // Nombre del archivo base para la descarga
  const baseFilePath = path.join(VIDEO_DIR, cleanYoutubeId);
  log(`Ruta base del archivo: ${baseFilePath}`, 'DEBUG');

  // Headers CORS
  res.header({
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cache-Control': 'no-cache'
  });

  try {
    // Buscar si ya existe un archivo con este ID de YouTube
    const existingFilePath = findVideoFile(cleanYoutubeId);
    
    if (existingFilePath) {
      const stat = fs.statSync(existingFilePath);
      if (stat.size > 0) {
        log(`Video encontrado en caché: ${existingFilePath} (tamaño: ${stat.size} bytes)`, 'INFO');
        return streamVideo(existingFilePath, req, res);
      }
      log(`Archivo encontrado pero tamaño cero, eliminando...`, 'WARN');
      fs.unlinkSync(existingFilePath);
    }

    log(`Iniciando descarga del video...`, 'INFO');
    await downloadVideo(cleanYoutubeId, baseFilePath);
    
    // Después de descargar, necesitamos encontrar el archivo real
    const downloadedFilePath = findVideoFile(cleanYoutubeId);
    if (!downloadedFilePath) {
      throw new Error('No se pudo encontrar el archivo descargado');
    }
    
    log(`Descarga completada en: ${downloadedFilePath}, iniciando stream...`, 'INFO');
    streamVideo(downloadedFilePath, req, res);
  } catch (error) {
    log(`Error en el endpoint de stream: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Error al procesar el video' });
  }
});

async function downloadVideo(youtubeId, baseFilePath) {
  return new Promise((resolve, reject) => {
    // Nota: Ahora usamos baseFilePath que es la carpeta + ID de YouTube
    // yt-dlp agregará automáticamente el sufijo de formato
    const cmd = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]" --merge-output-format mp4 -o "${baseFilePath}.%(format_id)s.mp4" "https://www.youtube.com/watch?v=${youtubeId}"`;
    log(`Ejecutando comando: ${cmd}`, 'DEBUG');

    const process = exec(cmd, { timeout: 300000 }); // 5 minutos de timeout

    process.stdout.on('data', (data) => log(`yt-dlp stdout: ${data}`, 'DEBUG'));
    process.stderr.on('data', (data) => log(`yt-dlp stderr: ${data}`, 'WARN'));

    process.on('close', (code) => {
      if (code === 0) {
        log(`Descarga completada exitosamente`, 'INFO');
        // Buscar el archivo descargado
        const downloadedFile = findVideoFile(youtubeId);
        if (downloadedFile) {
          log(`Archivo descargado: ${downloadedFile}`, 'INFO');
          
          // Programar eliminación después de 5 minutos
          setTimeout(() => {
            try {
              if (fs.existsSync(downloadedFile)) {
                fs.unlinkSync(downloadedFile);
                log(`Video eliminado de caché: ${downloadedFile}`, 'INFO');
              }
            } catch (err) {
              log(`Error al eliminar video: ${err.message}`, 'ERROR');
            }
          }, 300000);
          
          resolve();
        } else {
          const error = new Error(`No se encontró el archivo descargado para ${youtubeId}`);
          log(error.message, 'ERROR');
          reject(error);
        }
      } else {
        const error = new Error(`yt-dlp falló con código ${code}`);
        log(error.message, 'ERROR');
        reject(error);
      }
    });

    process.on('error', (err) => {
      log(`Error en el proceso de descarga: ${err.message}`, 'ERROR');
      reject(err);
    });
  });
}

function streamVideo(filePath, req, res) {
  try {
    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      log(`Streaming parcial: bytes ${start}-${end}/${stat.size}`, 'DEBUG');

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      log(`Streaming completo (tamaño: ${stat.size} bytes)`, 'DEBUG');
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    log(`Error durante el streaming: ${err.message}`, 'ERROR');
    throw err;
  }
}

// Manejo de errores global
process.on('uncaughtException', (err) => {
  log(`ERROR no capturado: ${err.stack}`, 'CRITICAL');
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Promesa rechazada no manejada: ${reason}`, 'ERROR');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  log(`Servidor backend escuchando en http://localhost:${PORT}`, 'INFO');
});