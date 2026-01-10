import { matchEquipmentFromAI, type EquipmentType } from "@shared/equipment-mapping";

const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const ROBOFLOW_MODEL_ENDPOINT = "https://detect.roboflow.com/all-gym-equipment/2";

export interface RoboflowDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_confidence: number;
  detection_id: string;
}

export interface RoboflowResponse {
  time: number;
  image: {
    width: number;
    height: number;
  };
  predictions: RoboflowDetection[];
}

export interface EquipmentRecognitionResult {
  equipment: EquipmentType[];
  rawDetections: RoboflowDetection[];
  confidence: number;
}

export async function recognizeEquipmentFromImage(
  imageBase64: string
): Promise<EquipmentRecognitionResult> {
  if (!ROBOFLOW_API_KEY) {
    throw new Error("ROBOFLOW_API_KEY not configured");
  }

  try {
    const response = await fetch(
      `${ROBOFLOW_MODEL_ENDPOINT}?api_key=${ROBOFLOW_API_KEY}&confidence=40`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: imageBase64,
      }
    );

    if (!response.ok) {
      throw new Error(`Roboflow API error: ${response.status} ${response.statusText}`);
    }

    const data: RoboflowResponse = await response.json();

    const detectedEquipment = new Set<EquipmentType>();
    let totalConfidence = 0;
    
    for (const prediction of data.predictions) {
      const matched = matchEquipmentFromAI(prediction.class);
      matched.forEach(eq => detectedEquipment.add(eq));
      totalConfidence += prediction.confidence;
    }

    const avgConfidence = data.predictions.length > 0 
      ? totalConfidence / data.predictions.length 
      : 0;

    return {
      equipment: Array.from(detectedEquipment),
      rawDetections: data.predictions,
      confidence: avgConfidence,
    };
  } catch (error) {
    console.error("Error calling Roboflow API:", error);
    throw new Error("Failed to recognize equipment from image");
  }
}
