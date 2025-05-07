// Pico360Gallery.jsx
import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { XR, useXR } from '@react-three/xr'
import * as THREE from 'three';
import YouTube from 'react-youtube';
import './Pico360Gallery.css';

function VideoSphere({ src }) {
    const meshRef = useRef();
    const [video] = useState(() => Object.assign(document.createElement('video'), {
        crossOrigin: 'anonymous',
        loop: true,
        muted: true,
        playsInline: true,
    }));
    const [texture, setTexture] = useState(null);

    useEffect(() => {
        if (!src.endsWith('.mp4')) return;

        video.src = src;
        video.play().catch(console.warn);
        const videoTexture = new THREE.VideoTexture(video);
        setTexture(videoTexture);
    }, [src]);

    useFrame(() => {
        if (texture) texture.needsUpdate = true;
    });

    return texture ? (
        <mesh ref={meshRef} scale={100}>
            <sphereGeometry args={[1, 64, 64]} />
            <meshBasicMaterial side={THREE.BackSide} map={texture} />
        </mesh>
    ) : null;
}

function VREnterButton() {
    const { isPresenting, enterXR } = useXR()

    return (
        <button
            className="vr-button"
            onClick={() => enterXR('immersive-vr', 'local-floor')}
            disabled={!isPresenting}
        >
            {isPresenting ? "INICIAR VR" : "VR NO DISPONIBLE"}
        </button>
    )
}

const videoList = [
    {
        "id": "1",
        "label": "SLIDE in 360° | VR / 4K",
        "type": "youtube",
        "url": "https://www.youtube.com/watch?v=nV_hd6bLXmw",
        "thumbnail": "https://img.youtube.com/vi/nV_hd6bLXmw/0.jpg"
    },
    {
        "id": "2",
        "label": "360° FEAR OF HEIGHTS EXTREME | FALLING VR",
        "type": "youtube",
        "url": "https://www.youtube.com/watch?v=tS9854NKZ4I",
        "thumbnail": "https://img.youtube.com/vi/tS9854NKZ4I/0.jpg"
    },
    {
        "id": "3",
        "label": "VR Virtual Reality 360°: Monsters from the Deep",
        "type": "youtube",
        "url": "https://www.youtube.com/watch?v=eXsNX_2AzM8",
        "thumbnail": "https://img.youtube.com/vi/eXsNX_2AzM8/0.jpg"
    },
    {
        "id": "4",
        "label": "360° VR TITANIC SINKING - Virtual Reality Experience",
        "type": "youtube",
        "url": "https://www.youtube.com/watch?v=Z4QV22VGfGs",
        "thumbnail": "https://img.youtube.com/vi/Z4QV22VGfGs/0.jpg"
    }
];

export default function Pico360Gallery() {
    const [selected, setSelected] = useState(null);
    const handleSelect = (video) => setSelected(video);

    return (
        <div className="gallery-container">
            {!selected ? (
                <div className="video-grid">
                    {videoList.map(video => (
                        <div key={video.id} className="video-card" onClick={() => handleSelect(video)}>
                            <img src={video.thumbnail} alt={video.label} className="video-thumbnail" />
                            <h4 className="video-label">{video.label}</h4>
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    
                    <button className="back-button" onClick={() => setSelected(null)}>
                        ← Volver
                    </button>

                    {selected.type === 'mp4' && (
                        <Canvas className="canvas">
                            <XR>
                                <VideoSphere src={selected.url} />
                                <VREnterButton /> {/* Botón para activar VR */}
                            </XR>
                        </Canvas>
                    )}

                    {selected.type === 'youtube' && (
                        <div className="youtube-wrapper">
                            <YouTube
                                videoId={selected.url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([\w-]+)/)[1]}
                                opts={{ playerVars: { autoplay: 1, controls: 1, vr: 1 } }}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
