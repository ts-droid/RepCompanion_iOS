import { db } from "./db";
import { exercises } from "@shared/schema";
import * as fs from "fs";

async function exportToCSV() {
  const allExercises = await db.select().from(exercises).orderBy(exercises.name);
  
  const headers = [
    "exercise_id",
    "name",
    "name_en",
    "category",
    "difficulty",
    "primary_muscles",
    "secondary_muscles",
    "required_equipment",
    "movement_pattern",
    "is_compound",
    "youtube_url",
    "video_type",
    "requires_1rm",
    "good_for_beginners",
    "core_engagement",
    "gender_specialization",
    "categories",
    "ai_search_terms",
    "training_level_priority",
    "equipment_mapping_tags",
    "instructions",
    "description"
  ];
  
  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = Array.isArray(val) ? val.join("; ") : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  
  const rows = allExercises.map(ex => [
    ex.exerciseId || "",
    ex.name,
    ex.nameEn || "",
    ex.category,
    ex.difficulty,
    (ex.primaryMuscles || []).join("; "),
    (ex.secondaryMuscles || []).join("; "),
    (ex.requiredEquipment || []).join("; "),
    ex.movementPattern || "",
    ex.isCompound ? "true" : "false",
    ex.youtubeUrl || "",
    ex.videoType || "",
    ex.requires1RM ? "true" : "false",
    ex.goodForBeginners ? "true" : "false",
    ex.coreEngagement ? "true" : "false",
    ex.genderSpecialization || "",
    (ex.categories || []).join("; "),
    (ex.aiSearchTerms || []).join("; "),
    (ex.trainingLevelPriority || []).join("; "),
    (ex.equipmentMappingTags || []).join("; "),
    ex.instructions || "",
    ex.description || ""
  ].map(escapeCSV).join(","));
  
  const csv = [headers.join(","), ...rows].join("\n");
  fs.writeFileSync("exercises_export.csv", csv, "utf-8");
  console.log("Exported " + allExercises.length + " exercises to exercises_export.csv");
  
  const withVideos = allExercises.filter(e => e.youtubeUrl).length;
  const withTrainingLevel = allExercises.filter(e => e.trainingLevelPriority && e.trainingLevelPriority.length > 0).length;
  const withEquipmentTags = allExercises.filter(e => e.equipmentMappingTags && e.equipmentMappingTags.length > 0).length;
  
  console.log(`  - With video links: ${withVideos}`);
  console.log(`  - With training_level_priority: ${withTrainingLevel}`);
  console.log(`  - With equipment_mapping_tags: ${withEquipmentTags}`);
}

exportToCSV().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
