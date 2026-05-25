"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface Props {
  sendFrame: (base64: string) => void;
  sendContext: (text: string) => void;
}

// Distance threshold for facial recognition
const THRESHOLD = 0.5;
// How often we run detection and send frames to Gemini
const INTERVAL_MS = 1000;

export function WebcamRuntime({ sendFrame, sendContext }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const demoId = useSession((s) => s.demoId);
  const audienceFaces = useSession((s) => s.audienceFaces);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [dbEmbeddings, setDbEmbeddings] = useState<
    { name: string; embedding: Float32Array }[]
  >([]);
  
  // Keep track of who we've recently informed Gemini about to avoid spamming
  const lastSentContextRef = useRef<Set<string>>(new Set());

  // 1. Load models
  useEffect(() => {
    let mounted = true;
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);
        if (mounted) setModelsLoaded(true);
      } catch (e) {
        console.error("Failed to load face-api models", e);
      }
    };
    loadModels();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Fetch existing embeddings from Supabase
  useEffect(() => {
    if (!demoId) return;
    let mounted = true;
    const fetchEmbeddings = async () => {
      const { data, error } = await supabase
        .from("audience_faces")
        .select("name, embedding")
        .eq("demo_id", demoId);

      if (error) {
        console.error("Failed to fetch audience faces:", error);
        return;
      }

      if (mounted && data) {
        const parsed = data.map((d: any) => {
          let arr: number[] = [];
          if (typeof d.embedding === "string") {
            try {
              arr = JSON.parse(d.embedding);
            } catch {
              /* ignore */
            }
          } else if (Array.isArray(d.embedding)) {
            arr = d.embedding;
          }
          return {
            name: d.name,
            embedding: new Float32Array(arr),
          };
        });
        setDbEmbeddings(parsed);
      }
    };
    fetchEmbeddings();
    return () => {
      mounted = false;
    };
  }, [demoId]);

  // 3. Start Camera
  useEffect(() => {
    if (!modelsLoaded) return;
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to start camera", err);
      }
    };
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [modelsLoaded]);

  // Save new face when requested by orchestrator
  const saveFaceToDb = useCallback(
    async (name: string, embeddingArr: Float32Array) => {
      if (!demoId) return;
      const embeddingStr = `[${Array.from(embeddingArr).join(",")}]`;
      const { error } = await supabase.from("audience_faces").insert({
        demo_id: demoId,
        name,
        embedding: embeddingStr,
      });
      if (error) console.error("Error saving face to DB:", error);
    },
    [demoId]
  );

  // 4. Face Recognition Loop
  useEffect(() => {
    if (!modelsLoaded || !videoRef.current || !canvasRef.current) return;

    let timer: number;
    let knownTempIds = new Map<string, Float32Array>(); // tempId -> descriptor
    let tempIdCounter = 1;

    const processFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== 4) {
        timer = window.setTimeout(processFrame, INTERVAL_MS);
        return;
      }

      // Draw video to canvas for Base64 capture
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Downscale image to save bandwidth for Gemini
        const downscaleCanvas = document.createElement("canvas");
        const MAX_DIM = 640;
        let scale = 1;
        if (canvas.width > MAX_DIM || canvas.height > MAX_DIM) {
          scale = Math.min(MAX_DIM / canvas.width, MAX_DIM / canvas.height);
        }
        downscaleCanvas.width = canvas.width * scale;
        downscaleCanvas.height = canvas.height * scale;
        const dCtx = downscaleCanvas.getContext("2d");
        if (dCtx) {
          dCtx.drawImage(canvas, 0, 0, downscaleCanvas.width, downscaleCanvas.height);
          const b64 = downscaleCanvas.toDataURL("image/jpeg", 0.6).split(",")[1];
          sendFrame(b64);
        }
      }

      // Detect faces
      const detections = await faceapi
        .detectAllFaces(video)
        .withFaceLandmarks()
        .withFaceDescriptors();

      const recognizedNames = new Set<string>();
      
      // Match against DB + Session
      const activeFacesContext: string[] = [];
      const sessionStore = useSession.getState();

      for (const det of detections) {
        const desc = det.descriptor;
        let bestMatchName = "";
        let bestMatchDist = THRESHOLD;

        // Check DB
        for (const dbFace of dbEmbeddings) {
          const dist = faceapi.euclideanDistance(desc, dbFace.embedding);
          if (dist < bestMatchDist) {
            bestMatchDist = dist;
            bestMatchName = dbFace.name;
          }
        }

        // Check Session state (newly registered this session)
        if (!bestMatchName) {
          for (const [tId, tDesc] of knownTempIds.entries()) {
            const dist = faceapi.euclideanDistance(desc, tDesc);
            if (dist < bestMatchDist) {
              bestMatchDist = dist;
              // Check if they registered a name for this tempId
              const registeredName = sessionStore.audienceFaces[tId];
              if (registeredName) {
                bestMatchName = registeredName;
                // Lazily save to DB if we just matched it
                saveFaceToDb(registeredName, desc);
                // Remove from session local if we wanted to, but fine to keep
              } else {
                bestMatchName = `Unknown Person (ID: ${tId})`;
              }
            }
          }
        }

        if (bestMatchName) {
          activeFacesContext.push(bestMatchName);
          recognizedNames.add(bestMatchName);
        } else {
          // New unknown face
          const newId = `T${tempIdCounter++}`;
          knownTempIds.set(newId, desc);
          activeFacesContext.push(`Unknown Person (ID: ${newId})`);
        }
      }

      // Inject context if the set of faces has changed
      const contextStr = activeFacesContext.sort().join(", ");
      const previousContextStr = Array.from(lastSentContextRef.current).sort().join(", ");

      if (contextStr && contextStr !== previousContextStr) {
        sendContext(
          `[SYSTEM: I can currently see the following people in the camera: ${contextStr}]`
        );
        lastSentContextRef.current = new Set(activeFacesContext);
      } else if (!contextStr && previousContextStr) {
        sendContext(`[SYSTEM: I can no longer see anyone in the camera.]`);
        lastSentContextRef.current = new Set();
      }

      timer = window.setTimeout(processFrame, INTERVAL_MS);
    };

    timer = window.setTimeout(processFrame, INTERVAL_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [modelsLoaded, dbEmbeddings, sendFrame, sendContext, saveFaceToDb]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
      {!modelsLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-white">
          Loading AI Face Models...
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded text-sm z-20">
        Greeting Phase
      </div>
      <div className="absolute bottom-4 right-4 z-20">
        <Button 
          variant="secondary" 
          onClick={() => useSession.getState().setPresentationPhase("presentation")}
        >
          Skip to PDF
        </Button>
      </div>
    </div>
  );
}
