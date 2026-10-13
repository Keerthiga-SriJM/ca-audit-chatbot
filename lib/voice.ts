/**
 * Voice Assistant Utilities for CA Audit Chatbot
 * Supports Web Speech Recognition (Speech-to-Text), Gemini Multimodal Audio Transcription,
 * Real-time microphone audio volume metering, and Speech Synthesis (Text-to-Speech)
 * Tailored for Indian Chartered Accountant Persona (CA Keerthiga Sri J.M.)
 */

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
  );
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/**
 * Prepares raw markdown and chatbot responses for clear, fluent voice synthesis.
 * Strips URLs, markdown syntax, unreadable characters, and formats numbers/currency naturally.
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // Replace markdown links [label](url) with just the label
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove raw URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, "link");

  // Remove markdown headers (###), bold/italic (***, **, *)
  cleaned = cleaned.replace(/#{1,6}\s*/g, "");
  cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  cleaned = cleaned.replace(/_{1,3}([^_]+)_{1,3}/g, "$1");
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

  // Remove markdown blockquotes and table dividers
  cleaned = cleaned.replace(/^>\s*/gm, "");
  cleaned = cleaned.replace(/\|[-:\s|]+\|/g, "");
  cleaned = cleaned.replace(/\|/g, ", ");

  // Convert common financial abbreviations
  cleaned = cleaned.replace(/\bFY\s*(\d{2,4})\b/gi, "Financial Year $1");
  cleaned = cleaned.replace(/₹\s*([0-9.,]+)/g, "$1 Rupees");
  cleaned = cleaned.replace(/\bCr\b/gi, "Crores");
  cleaned = cleaned.replace(/\bLakhs?\b/gi, "Lakhs");

  // Replace unpronounceable emojis or symbols with natural phrasing
  cleaned = cleaned.replace(/[📅🗓️]/g, "Calendar: ");
  cleaned = cleaned.replace(/[✉️📧]/g, "Email: ");
  cleaned = cleaned.replace(/[📹🎥]/g, "Video call: ");
  cleaned = cleaned.replace(/[⏳⏰⏱️]/g, "Time: ");
  cleaned = cleaned.replace(/[🛑🔒]/g, "Notice: ");
  cleaned = cleaned.replace(/[✓✔]/g, "confirmed");

  // Remove remaining rare emoji characters
  cleaned = cleaned.replace(
    /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
    ""
  );

  // Collapse multiple whitespaces and trim
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * Finds the best available voice in the browser, preferring Indian English (en-IN)
 * to match CA Keerthiga Sri J.M.'s persona.
 */
export function getPreferredAuditorVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Try Indian English female/natural voice
  const indianVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().includes("en-in") ||
      v.name.toLowerCase().includes("india") ||
      v.name.toLowerCase().includes("neerja") ||
      v.name.toLowerCase().includes("heera")
  );
  if (indianVoices.length > 0) {
    const femaleIn = indianVoices.find(
      (v) =>
        v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("neerja") ||
        v.name.toLowerCase().includes("heera") ||
        v.name.toLowerCase().includes("natural")
    );
    return femaleIn || indianVoices[0];
  }

  // 2. Try British / Australian / English natural female voice
  const englishFemaleVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith("en") &&
      (v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("natural") ||
        v.name.toLowerCase().includes("samantha") ||
        v.name.toLowerCase().includes("victoria") ||
        v.name.toLowerCase().includes("zira") ||
        v.name.toLowerCase().includes("serena"))
  );
  if (englishFemaleVoices.length > 0) {
    return englishFemaleVoices[0];
  }

  // 3. Any English voice
  const anyEnglish = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (anyEnglish.length > 0) return anyEnglish[0];

  // 4. Default voice
  return voices[0] || null;
}

export type ActiveAudioRecorder = {
  stop: () => Promise<{ blob: Blob; mimeType: string }>;
  cancel: () => void;
};

/**
 * Captures microphone audio using standard MediaRecorder with live audio volume meter.
 * Guarantees recording across Chrome, Edge, Safari, Firefox.
 */
export async function startAudioRecording(
  onVolume?: (vol: number) => void
): Promise<ActiveAudioRecorder> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not supported by your browser");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  // Real-time audio volume analyzer
  let audioContext: AudioContext | null = null;
  let animId: number | null = null;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        onVolume?.(normalized);
        animId = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    }
  } catch (err) {
    console.warn("Could not start audio level analyzer:", err);
  }

  // Pick best supported MIME type
  let mimeType = "audio/webm";
  if (typeof MediaRecorder !== "undefined") {
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      mimeType = "audio/webm;codecs=opus";
    } else if (MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
      mimeType = "audio/mp4";
    } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
      mimeType = "audio/ogg";
    }
  }

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  recorder.start(150); // Slice chunks every 150ms

  const cleanup = () => {
    if (animId) cancelAnimationFrame(animId);
    if (audioContext && audioContext.state !== "closed") {
      try {
        audioContext.close();
      } catch {}
    }
    stream.getTracks().forEach((track) => track.stop());
  };

  return {
    stop: () =>
      new Promise<{ blob: Blob; mimeType: string }>((resolve) => {
        recorder.onstop = () => {
          cleanup();
          const finalMime = recorder.mimeType || mimeType || "audio/webm";
          const blob = new Blob(chunks, { type: finalMime });
          resolve({ blob, mimeType: finalMime });
        };
        try {
          if (recorder.state !== "inactive") recorder.stop();
        } catch {
          cleanup();
          resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType });
        }
      }),
    cancel: () => {
      cleanup();
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {}
    },
  };
}

/**
 * Transcribes recorded microphone audio via the server Gemini Multimodal Audio API
 */
export async function transcribeAudioWithGemini(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, "voice_input.webm");

  const res = await fetch("/api/voice/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Transcription failed (${res.status})`);
  }

  const data = await res.json();
  return (data.transcript || "").trim();
}
