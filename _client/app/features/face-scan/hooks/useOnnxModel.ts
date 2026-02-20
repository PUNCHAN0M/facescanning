import * as ort from 'onnxruntime-web';
import { useEffect, useState } from 'react';

ort.env.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/';

export function useOnnxModel(modelPath: string) {
  const [session, setSession] = useState<ort.InferenceSession | null>(null);
  const [status, setStatus] = useState<string>('Loading model...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
      try {
        setStatus('Loading model...');
        const inferenceSession = await ort.InferenceSession.create(modelPath);

        if (!cancelled) {
          setSession(inferenceSession);
          setStatus('Model loaded. Ready.');
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to load model';
          setStatus('Failed to load model');
          setError(errorMessage);
        }
      }
    }

    loadModel();

    return () => {
      cancelled = true;
    };
  }, [modelPath]);

  return { session, status, error };
}
