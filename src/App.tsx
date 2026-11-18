import React, { useEffect, useRef, useState } from "react";
import {
    PoseLandmarker,
    FilesetResolver,
    DrawingUtils,
} from "@mediapipe/tasks-vision";
import cardData from "./assets/data/message-card.json";
import MessageCard from "./assets/components/MessageCard";
import { detectPostureStatus } from "./assets/misc/utils.ts";
import "./assets/scss/app.scss";

export default function App() {
    interface StreamUrl {
        host: string;
        path: string;
    }

    const [poseLandmarkerResult, setPoseLandmarkerResult] =
        useState<PoseLandmarker | null>(null);

    const [postureIndex, setPostureIndex] = useState<number>(4);

    const [streamUrl, setStreamUrl] = useState<StreamUrl>({
        host: "esp32cam.local:81", // Alamat mDNS dan port dari ESP32
        path: "stream", // Endpoint video bawaan CameraWebServer
    });

    const canvas = useRef<HTMLCanvasElement>(null);
    const img = useRef<HTMLImageElement>(null);

    useEffect(() => {
        let landmarker: PoseLandmarker | null = null;

        async function apiCall() {
            try {
                const vision = await FilesetResolver.forVisionTasks("/wasm");
                landmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "../model/pose_landmarker_full.task",
                    },
                    runningMode: "IMAGE",
                });
                setPoseLandmarkerResult(landmarker);
            } catch (err) {
                console.error("Gagal menginisialisasi MediaPipe:", err);
            }
        }

        apiCall();

        return () => {
            landmarker?.close();
        };
    }, []);

    useEffect(() => {
        let animationFrameId: number;

        function renderLoop() {
            if (
                img.current &&
                canvas.current &&
                poseLandmarkerResult &&
                img.current.complete &&
                img.current.naturalWidth > 0 &&
                img.current.naturalHeight > 0
            ) {
                if (
                    canvas.current.width !== img.current.clientWidth ||
                    canvas.current.height !== img.current.clientHeight
                ) {
                    canvas.current.width = img.current.clientWidth;
                    canvas.current.height = img.current.clientHeight;
                }

                try {
                    const result = poseLandmarkerResult.detect(img.current);

                    if (result.landmarks && result.landmarks.length > 0) {
                        setPostureIndex(
                            detectPostureStatus(result.landmarks[0]),
                        );
                    } else if (
                        result.landmarks &&
                        result.landmarks.length === 0
                    ) {
                        setPostureIndex(3);
                    }

                    const ctx = canvas.current.getContext("2d");
                    if (ctx) {
                        ctx.clearRect(
                            0,
                            0,
                            canvas.current.width,
                            canvas.current.height,
                        );
                        const drawingUtils = new DrawingUtils(ctx);

                        if (result.landmarks) {
                            for (const landmark of result.landmarks) {
                                drawingUtils.drawConnectors(
                                    landmark,
                                    PoseLandmarker.POSE_CONNECTIONS,
                                    {
                                        color: "#00FF00",
                                        lineWidth: 2,
                                    },
                                );
                                drawingUtils.drawLandmarks(landmark, {
                                    color: "#FF0000",
                                    lineWidth: 2,
                                    radius: 3,
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.warn(err);
                }
            }

            animationFrameId = requestAnimationFrame(renderLoop);
        }

        if (poseLandmarkerResult) {
            renderLoop();
        }

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [poseLandmarkerResult, streamUrl?.host]);

    function handleChange<T extends HTMLSelectElement | HTMLInputElement>(
        e: React.ChangeEvent<T>,
    ) {
        const { name, value } = e.target;

        setStreamUrl((prevState) => {
            return { ...prevState, [name]: value } as StreamUrl;
        });
    }

    const isConnected = postureIndex !== 4;
    const activeCard = cardData[postureIndex];

    return (
        <main className="app-container">
            <header className="app-header">
                <div className="brand">
                    <span className="brand-dot" />
                    <h2>Posture Guard Monitor</h2>
                </div>
                <div
                    className={`connection-pill ${isConnected ? "is-connected" : ""}`}
                >
                    <span className="indicator" />
                    {isConnected ? "Kamera Terhubung" : "Menunggu Stream"}
                </div>
            </header>

            <div className="dashboard-grid">
                <section
                    className="img-section"
                    style={{
                        borderColor: isConnected
                            ? activeCard.backgroundColor
                            : undefined,
                    }}
                >
                    <img
                        ref={img}
                        src={`http://${streamUrl.host}/${streamUrl.path}`}
                        crossOrigin="anonymous"
                        alt="ESP32-CAM Live Stream"
                        onError={() => {
                            setPostureIndex(4);
                        }}
                    />
                    <canvas ref={canvas} id="myCanvas"></canvas>

                    {!isConnected && (
                        <div className="camera-placeholder">
                            <div className="placeholder-icon">
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                                    <circle cx="12" cy="13" r="3" />
                                </svg>
                            </div>
                            <strong>Kamera Belum Terhubung</strong>
                            <span>
                                Pastikan ESP32-CAM aktif dan alamat IP di panel
                                konfigurasi sudah sesuai.
                            </span>
                        </div>
                    )}
                </section>

                <div className="side-panel">
                    <section className="input-field-section">
                        <div className="section-label">
                            <h1>Konfigurasi Stream ESP32</h1>
                            <span>Endpoint</span>
                        </div>
                        <div className="url-bar">
                            <p>http://</p>
                            <input
                                type="text"
                                name="host"
                                placeholder="esp32cam.local:81"
                                value={streamUrl?.host}
                                onChange={handleChange<HTMLInputElement>}
                            />
                            <p>/</p>
                            <select
                                name="path"
                                onChange={handleChange<HTMLSelectElement>}
                                value={streamUrl.path}
                            >
                                <option value="video">video</option>
                                <option value="stream">stream</option>
                            </select>
                        </div>
                    </section>

                    <MessageCard
                        header={activeCard.header}
                        body={activeCard.body}
                        img={activeCard.img}
                        backgroundColor={activeCard.backgroundColor}
                        textColor={activeCard.textColor}
                    />
                </div>
            </div>
        </main>
    );
}
