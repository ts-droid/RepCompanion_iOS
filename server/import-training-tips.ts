/**
 * Import script for loading training tips from JSON file into database
 * Usage: tsx server/import-training-tips.ts <path-to-json-file>
 */

import { db } from "./db";
import { profileTrainingTips } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

interface TipItem {
  id: string;
  tips: string;
  kön: "både" | "man" | "kvinna";
  träningsvana: string;
  ord_antal: number;
}

interface CategoryTips {
  [category: string]: TipItem[];
}

interface SportTips {
  [sport: string]: CategoryTips;
}

interface AgeGroupData {
  [ageGroup: string]: SportTips;
}

// Map Swedish training levels to schema enum
function mapTrainingLevel(level: string): "helt nybörjare" | "nybörjare" | "medel" | "van" | "avancerad" | "elit" {
  const levelMap: Record<string, "helt nybörjare" | "nybörjare" | "medel" | "van" | "avancerad" | "elit"> = {
    "helt nybörjare": "helt nybörjare",
    "nybörjare": "nybörjare",
    "medel": "medel",
    "van": "van",
    "avancerad": "avancerad",
    "elit": "elit"
  };
  
  const normalized = level.toLowerCase().trim();
  if (normalized in levelMap) {
    return levelMap[normalized];
  }
  
  console.warn(`Unknown training level: "${level}", defaulting to "nybörjare"`);
  return "nybörjare";
}

// Map age group to schema enum
function mapAgeGroup(ageGroup: string): "13–17" | "18–29" | "30–39" | "40–59" | "60+" {
  const ageMap: Record<string, "13–17" | "18–29" | "30–39" | "40–59" | "60+"> = {
    "13–17": "13–17",
    "18–29": "18–29",
    "30–39": "30–39",
    "40–59": "40–59",
    "60+": "60+"
  };
  
  const normalized = ageGroup.trim();
  if (normalized in ageMap) {
    return ageMap[normalized];
  }
  
  console.warn(`Unknown age group: "${ageGroup}", defaulting to "18–29"`);
  return "18–29";
}

// Map gender to schema enum
function mapGender(gender: string): "både" | "man" | "kvinna" {
  const genderMap: Record<string, "både" | "man" | "kvinna"> = {
    "både": "både",
    "man": "man",
    "kvinna": "kvinna"
  };
  
  const normalized = gender.toLowerCase().trim();
  if (normalized in genderMap) {
    return genderMap[normalized];
  }
  
  console.warn(`Unknown gender: "${gender}", defaulting to "både"`);
  return "både";
}

async function importTrainingTips(jsonFilePath: string) {
  console.log(`📖 Reading JSON file: ${jsonFilePath}`);
  
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`❌ File not found: ${jsonFilePath}`);
    process.exit(1);
  }
  
  const jsonData: AgeGroupData = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));
  
  const tipsToInsert: Array<{
    id: string;
    tipText: string;
    ageGroup: "13–17" | "18–29" | "30–39" | "40–59" | "60+";
    sport: string | null;
    category: string;
    gender: "både" | "man" | "kvinna";
    trainingLevel: "helt nybörjare" | "nybörjare" | "medel" | "van" | "avancerad" | "elit";
    wordCount: number | null;
  }> = [];
  
  let totalProcessed = 0;
  let skippedDuplicates = 0;
  
  // Process all age groups
  for (const [ageGroup, sportData] of Object.entries(jsonData)) {
    console.log(`\n📅 Processing age group: ${ageGroup}`);
    
    // Process all sports within this age group
    for (const [sport, categoryData] of Object.entries(sportData)) {
      console.log(`  🏃 Sport: ${sport}`);
      
      // Process all categories within this sport
      for (const [category, tips] of Object.entries(categoryData)) {
        if (!Array.isArray(tips)) {
          console.warn(`  ⚠️  Skipping non-array category: ${category}`);
          continue;
        }
        
        console.log(`    📚 Category: ${category} (${tips.length} tips)`);
        
        // Process each tip
        for (const tip of tips) {
          if (!tip.id || !tip.tips) {
            console.warn(`    ⚠️  Skipping invalid tip (missing id or text)`);
            continue;
          }
          
          tipsToInsert.push({
            id: tip.id,
            tipText: tip.tips,
            ageGroup: mapAgeGroup(ageGroup),
            sport: sport.toLowerCase() === "allmän" ? null : sport,
            category: category,
            gender: mapGender(tip.kön),
            trainingLevel: mapTrainingLevel(tip.träningsvana),
            wordCount: tip.ord_antal || null,
          });
          
          totalProcessed++;
        }
      }
    }
  }
  
  console.log(`\n✅ Processed ${totalProcessed} tips from JSON`);
  console.log(`💾 Inserting tips into database...`);
  
  // Clear existing data
  console.log(`🗑️  Clearing existing tips...`);
  await db.delete(profileTrainingTips);
  
  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < tipsToInsert.length; i += batchSize) {
    const batch = tipsToInsert.slice(i, i + batchSize);
    await db.insert(profileTrainingTips).values(batch);
    console.log(`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tipsToInsert.length / batchSize)}`);
  }
  
  console.log(`\n🎉 Successfully imported ${tipsToInsert.length} training tips!`);
  
  // Show statistics
  const stats = {
    ageGroups: new Set(tipsToInsert.map(t => t.ageGroup)).size,
    sports: new Set(tipsToInsert.map(t => t.sport).filter(Boolean)).size,
    categories: new Set(tipsToInsert.map(t => t.category)).size,
    levels: new Set(tipsToInsert.map(t => t.trainingLevel)).size,
  };
  
  console.log(`\n📊 Statistics:`);
  console.log(`   Age groups: ${stats.ageGroups}`);
  console.log(`   Sports: ${stats.sports}`);
  console.log(`   Categories: ${stats.categories}`);
  console.log(`   Training levels: ${stats.levels}`);
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("❌ Usage: tsx server/import-training-tips.ts <path-to-json-file>");
  console.error("   Example: tsx server/import-training-tips.ts attached_assets/tips.json");
  process.exit(1);
}

const jsonFilePath = path.resolve(args[0]);
importTrainingTips(jsonFilePath)
  .then(() => {
    console.log("\n✅ Import completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  });
