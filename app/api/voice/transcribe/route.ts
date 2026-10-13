import { NextRequest } from "next/server";
import { ai, CHAT_MODEL, isLocalModel } from "@/lib/gemini";
import { apiResponse, apiError, handleCorsPreflight } from "@/lib/cors";
import { verifyApiKeyRequest } from "@/lib/api-keys";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyApiKeyRequest(req);
    if (!auth.authorized) {
      return apiError(auth.reason || "Unauthorized", 401);
    }

    if (isLocalModel() || !process.env.GEMINI_API_KEY) {
      return apiResponse({
        success: true,
        transcript: "",
        info: "Local mode active: Browser Web Speech Recognition provides real-time transcription.",
      });
    }

    let base64Audio = "";
    let mimeType = "audio/webm";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as Blob | null;
      if (!file) {
        return apiError("No audio file provided", 400);
      }
      mimeType = file.type || "audio/webm";
      const buffer = Buffer.from(await file.arrayBuffer());
      base64Audio = buffer.toString("base64");
    } else {
      const json = await req.json();
      base64Audio = json.audioBase64 || "";
      mimeType = json.mimeType || "audio/webm";
    }

    if (!base64Audio) {
      return apiError("Missing audio data", 400);
    }

    // Clean mimeType for Gemini (e.g., "audio/webm;codecs=opus" -> "audio/webm")
    const cleanMime = mimeType.split(";")[0].trim();

    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: [
        {
          inlineData: {
            mimeType: cleanMime,
            data: base64Audio,
          },
        },
        {
          text: `You are an expert speech-to-text transcriber for a Chartered Accountant audit consultation system.
Listen to this audio recording of a user speaking.
Transcribe the user's spoken words into natural, accurate English text.
Pay close attention to financial terms (profit, loss, revenue, income, financial year, FY, 10-year records, Apex Enterprises), dates, times, and meeting requests (Google Meet, schedule consultation).
If the audio is silent or only contains background static/breathing, output exactly: NO_SPEECH.
Otherwise, output ONLY the exact transcribed words with no quotation marks, no preamble, and no extra commentary.`,
        },
      ],
    });

    let transcript = (response.text || "").trim();

    // Clean up quotes or NO_SPEECH
    if (
      transcript.toUpperCase().includes("NO_SPEECH") ||
      transcript.toLowerCase().includes("please provide the audio") ||
      transcript.toLowerCase().includes("no audio provided") ||
      transcript.toLowerCase().includes("cannot hear") ||
      transcript.toLowerCase().includes("audio recording you would like") ||
      transcript === '""'
    ) {
      transcript = "";
    } else {
      transcript = transcript.replace(/^["']|["']$/g, "").trim();
    }

    return apiResponse({
      success: true,
      transcript,
    });
  } catch (err: any) {
    console.error("[api/voice/transcribe] Error:", err?.message || err);
    return apiError(err?.message || "Failed to transcribe audio", 500, {
      transcript: "",
    });
  }
}
