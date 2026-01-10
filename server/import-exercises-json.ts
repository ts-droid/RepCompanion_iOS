import { db } from "./db";
import { exercises } from "@shared/schema";
import { eq, or } from "drizzle-orm";

interface ExerciseJSON {
  "Exercise ID": number;
  "Name": string;
  "Equipment": string;
  "Muscle group(s)": string[];
  "Categories": string[];
  "Gender specialization": string;
  "requires_1RM": boolean;
  "good_for_beginners": boolean;
  "core_engagement": boolean;
  "AI-search terms": string[];
}

const exerciseData: ExerciseJSON[] = [
  {"Exercise ID":1,"Name":"Bänkpress","Equipment":"Skivstång","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":true,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Bänkpress","Bench Press","Bröstpress"]},
  {"Exercise ID":2,"Name":"Bänkpress med hantlar","Equipment":"Hantlar","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Hantel bänkpress","Dumbbell Bench Press","Bröstpress hantlar"]},
  {"Exercise ID":3,"Name":"Sned bänkpress","Equipment":"Skivstång","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Sned bänkpress","Incline Bench Press"]},
  {"Exercise ID":4,"Name":"Sned bänkpress med hantlar","Equipment":"Hantlar","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Sned hantel bänkpress","Incline Dumbbell Bench Press"]},
  {"Exercise ID":5,"Name":"Nedåtlutande bänkpress","Equipment":"Skivstång","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Negativ bänkpress","Decline Bench Press"]},
  {"Exercise ID":6,"Name":"Flyes med hantlar","Equipment":"Hantlar","Muscle group(s)":["Bröst"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Bröstflyes","Chest Fly","Flyes på bänk"]},
  {"Exercise ID":7,"Name":"Bröstflyes i maskin","Equipment":"Maskin","Muscle group(s)":["Bröst"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Pec deck","Flyes maskin","Pec deck fly"]},
  {"Exercise ID":8,"Name":"Armhävningar","Equipment":"Kroppsvikt","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["styrketräning","viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Armhävning","Push-up","Armhävningar på tår"]},
  {"Exercise ID":9,"Name":"Armhävningar på knä","Equipment":"Kroppsvikt","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Armhävning knä","Knäpush-up"]},
  {"Exercise ID":10,"Name":"Armhävningar mot vägg","Equipment":"Kroppsvikt","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Vägg armhävning","Wall Push-up"]},
  {"Exercise ID":11,"Name":"Dips","Equipment":"Kroppsvikt","Muscle group(s)":["Bröst","Triceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Dips i ställning","Bröstdips"]},
  {"Exercise ID":12,"Name":"Dips på bänk","Equipment":"Kroppsvikt","Muscle group(s)":["Triceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Bänkdips","Tricepsdips"]},
  {"Exercise ID":13,"Name":"Bröstpress i maskin","Equipment":"Maskin","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Chest press maskin","Bröstpress maskin"]},
  {"Exercise ID":14,"Name":"Kabelcross överkropp","Equipment":"Kabel","Muscle group(s)":["Bröst"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Kabel flyes","Cable crossover"]},
  {"Exercise ID":15,"Name":"Marklyft","Equipment":"Skivstång","Muscle group(s)":["Rygg","Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":true,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Marklyft","Deadlift"]},
  {"Exercise ID":16,"Name":"Sumomarklyft","Equipment":"Skivstång","Muscle group(s)":["Rygg","Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":true,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Sumo marklyft","Sumo Deadlift"]},
  {"Exercise ID":17,"Name":"Raka marklyft","Equipment":"Skivstång","Muscle group(s)":["Rygg","Rumpa","Ben"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Strait leg deadlift","Raka marklyft","Romanian Deadlift"]},
  {"Exercise ID":18,"Name":"Skivstångsrodd","Equipment":"Skivstång","Muscle group(s)":["Rygg","Biceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Skivstångsrodd","Bent Over Row"]},
  {"Exercise ID":19,"Name":"Hantelrodd","Equipment":"Hantlar","Muscle group(s)":["Rygg","Biceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Enarmsrodd","Dumbbell Row"]},
  {"Exercise ID":20,"Name":"Sittande kabelrodd","Equipment":"Kabel","Muscle group(s)":["Rygg","Biceps"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Sittande rodd","Cable Row"]},
  {"Exercise ID":21,"Name":"Latsdrag","Equipment":"Maskin","Muscle group(s)":["Rygg","Biceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Latsdrag","Lat Pull-Down"]},
  {"Exercise ID":22,"Name":"Chins","Equipment":"Kroppsvikt","Muscle group(s)":["Rygg","Biceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Pull-up","Chin-up","Chins"]},
  {"Exercise ID":23,"Name":"Pull-ups","Equipment":"Kroppsvikt","Muscle group(s)":["Rygg","Biceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Chins","Pullups","Pull-up"]},
  {"Exercise ID":24,"Name":"Chin-ups","Equipment":"Kroppsvikt","Muscle group(s)":["Rygg","Biceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Chins underhand","Chin-up","Pull-up underhand"]},
  {"Exercise ID":25,"Name":"T-bar rodd","Equipment":"Skivstång","Muscle group(s)":["Rygg","Biceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["T-rodd","T-bar row"]},
  {"Exercise ID":26,"Name":"Ryggresning","Equipment":"Kroppsvikt","Muscle group(s)":["Rygg"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Rygglyft","Back Extension"]},
  {"Exercise ID":27,"Name":"Ryggresning i maskin","Equipment":"Maskin","Muscle group(s)":["Rygg"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Hyperextension","Back Extension machine"]},
  {"Exercise ID":28,"Name":"Shrugs med hantlar","Equipment":"Hantlar","Muscle group(s)":["Rygg"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Skulderdrag hantlar","Dumbbell Shrug"]},
  {"Exercise ID":29,"Name":"Shrugs med skivstång","Equipment":"Skivstång","Muscle group(s)":["Rygg"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Skulderdrag skivstång","Barbell Shrug"]},
  {"Exercise ID":30,"Name":"Good morning","Equipment":"Skivstång","Muscle group(s)":["Rygg","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Good morning","Goodmorning övning"]},
  {"Exercise ID":31,"Name":"Face pull","Equipment":"Kabel","Muscle group(s)":["Axlar","Rygg"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Facepull","Ansiktsdrag"]},
  {"Exercise ID":32,"Name":"Knäböj med skivstång","Equipment":"Skivstång","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":true,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Knäböj","Squat"]},
  {"Exercise ID":33,"Name":"Frontböj med skivstång","Equipment":"Skivstång","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":true,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Frontböj","Front Squat"]},
  {"Exercise ID":34,"Name":"Knäböj i Smithmaskin","Equipment":"Maskin","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Smith squat","Smithmaskin knäböj"]},
  {"Exercise ID":35,"Name":"Goblet squat","Equipment":"Hantel","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Bägarböj","Goblet squat"]},
  {"Exercise ID":36,"Name":"Upphopp","Equipment":"Kroppsvikt","Muscle group(s)":["Ben"],"Categories":["styrketräning","viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Jump squat","Upphopp","Squat jump"]},
  {"Exercise ID":37,"Name":"Boxhopp","Equipment":"Kroppsvikt","Muscle group(s)":["Ben"],"Categories":["viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Box jump","Boxhopp"]},
  {"Exercise ID":38,"Name":"Bulgarisk split squat","Equipment":"Hantlar","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Bulgariska utfall","Bulgarian Split Squat"]},
  {"Exercise ID":39,"Name":"Utfall med skivstång","Equipment":"Skivstång","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Utfallssteg skivstång","Lunge barbell"]},
  {"Exercise ID":40,"Name":"Utfallssteg med hantlar","Equipment":"Hantlar","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Utfall hantlar","Lunge dumbbells"]},
  {"Exercise ID":41,"Name":"Sidoutfall","Equipment":"Kroppsvikt","Muscle group(s)":["Ben","Rumpa"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Sidoutfall","Side Lunge"]},
  {"Exercise ID":42,"Name":"Benpress i maskin","Equipment":"Maskin","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Benpress","Leg Press"]},
  {"Exercise ID":43,"Name":"Benspark i maskin","Equipment":"Maskin","Muscle group(s)":["Ben"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Benspark","Leg Extension"]},
  {"Exercise ID":44,"Name":"Lårcurl i maskin","Equipment":"Maskin","Muscle group(s)":["Ben"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Lårcurl","Leg Curl"]},
  {"Exercise ID":45,"Name":"Hacklift","Equipment":"Maskin","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Hack squat","Hacklift"]},
  {"Exercise ID":46,"Name":"Trapbar marklyft","Equipment":"Skivstång","Muscle group(s)":["Ben","Rygg"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":true,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Trapbar deadlift","Trap bar marklyft"]},
  {"Exercise ID":47,"Name":"Vadpress stående","Equipment":"Skivstång","Muscle group(s)":["Ben"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Stående vadpress","Standing Calf Raise"]},
  {"Exercise ID":48,"Name":"Vadpress i maskin","Equipment":"Maskin","Muscle group(s)":["Ben"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Sittande vadpress","Seated Calf Raise"]},
  {"Exercise ID":49,"Name":"Enbens knäböj (Pistol)","Equipment":"Kroppsvikt","Muscle group(s)":["Ben"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Pistolsquat","Pistol squat","Enbens knäböj"]},
  {"Exercise ID":50,"Name":"Step-up på låda","Equipment":"Hantlar","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning","viktminskning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Step up","Step-up","Kliva upp"]},
  {"Exercise ID":51,"Name":"Good girl maskin (adduktor)","Equipment":"Maskin","Muscle group(s)":["Ben"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Adduktormaskin","Inner thigh machine"]},
  {"Exercise ID":52,"Name":"Bad girl maskin (abduktor)","Equipment":"Maskin","Muscle group(s)":["Ben"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Abduktormaskin","Outer thigh machine"]},
  {"Exercise ID":53,"Name":"Hip thrust","Equipment":"Skivstång","Muscle group(s)":["Rumpa","Ben"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Hip thrust","Höftlyft med skivstång"]},
  {"Exercise ID":54,"Name":"Glute bridge","Equipment":"Kroppsvikt","Muscle group(s)":["Rumpa","Ben"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Höftlyft","Glute bridge"]},
  {"Exercise ID":55,"Name":"Kickback i kabel","Equipment":"Kabel","Muscle group(s)":["Rumpa"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Glute kickback","Kickback kabel"]},
  {"Exercise ID":56,"Name":"Musslan","Equipment":"Kroppsvikt","Muscle group(s)":["Rumpa"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Clamshell","Muscle clam"]},
  {"Exercise ID":57,"Name":"Sidogång med gummiband","Equipment":"Band","Muscle group(s)":["Rumpa"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Monster walk","Sidogång gummiband"]},
  {"Exercise ID":58,"Name":"Militärpress","Equipment":"Skivstång","Muscle group(s)":["Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":true,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Militärpress","Overhead Press","Skulderpress"]},
  {"Exercise ID":59,"Name":"Axelpress med hantlar","Equipment":"Hantlar","Muscle group(s)":["Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Axelpress hantlar","Shoulder Press dumbbell"]},
  {"Exercise ID":60,"Name":"Axelpress i maskin","Equipment":"Maskin","Muscle group(s)":["Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Axelpress maskin","Shoulder Press machine"]},
  {"Exercise ID":61,"Name":"Arnoldpress","Equipment":"Hantlar","Muscle group(s)":["Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Arnold press","Arnold axelpress"]},
  {"Exercise ID":62,"Name":"Hantellyft åt sidan","Equipment":"Hantlar","Muscle group(s)":["Axlar"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Sidolyft hantlar","Lateral Raise"]},
  {"Exercise ID":63,"Name":"Hantellyft framåt","Equipment":"Hantlar","Muscle group(s)":["Axlar"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Front raise","Framåtlyft"]},
  {"Exercise ID":64,"Name":"Omvända flyes med hantlar","Equipment":"Hantlar","Muscle group(s)":["Axlar","Rygg"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Omvända flyes","Reverse Flyes"]},
  {"Exercise ID":65,"Name":"Omvända flyes i maskin","Equipment":"Maskin","Muscle group(s)":["Axlar","Rygg"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Omvända flyes maskin","Reverse Pec Deck"]},
  {"Exercise ID":66,"Name":"Drag till hakan med skivstång","Equipment":"Skivstång","Muscle group(s)":["Axlar","Rygg"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Upright row","Skivstångsrodd upprätt"]},
  {"Exercise ID":67,"Name":"Face pull med band","Equipment":"Band","Muscle group(s)":["Axlar","Rygg"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Ansiktsdrag gummiband","Face pull band"]},
  {"Exercise ID":68,"Name":"Utåtrotation axel med band","Equipment":"Band","Muscle group(s)":["Axlar"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Extern rotation band","Utåtrotation axel"]},
  {"Exercise ID":69,"Name":"Inåtrotation axel med band","Equipment":"Band","Muscle group(s)":["Axlar"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Intern rotation band","Inåtrotation axel"]},
  {"Exercise ID":70,"Name":"Bicepscurl med hantlar","Equipment":"Hantlar","Muscle group(s)":["Biceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Bicepscurl","Dumbbell Biceps Curl"]},
  {"Exercise ID":71,"Name":"Bicepscurl med skivstång","Equipment":"Skivstång","Muscle group(s)":["Biceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Bicepscurl skivstång","Barbell Curl"]},
  {"Exercise ID":72,"Name":"Bicepscurl med kabel","Equipment":"Kabel","Muscle group(s)":["Biceps"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Bicepscurl kabel","Cable Curl"]},
  {"Exercise ID":73,"Name":"Hammercurl","Equipment":"Hantlar","Muscle group(s)":["Biceps","Underarmar"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Hammercurl","Hammer Curl"]},
  {"Exercise ID":74,"Name":"Koncentrationscurl","Equipment":"Hantel","Muscle group(s)":["Biceps"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Koncentrationscurl","Concentration Curl"]},
  {"Exercise ID":75,"Name":"Scottcurl","Equipment":"Maskin","Muscle group(s)":["Biceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Scottcurl","Preacher Curl"]},
  {"Exercise ID":76,"Name":"Triceps pushdown med stång","Equipment":"Kabel","Muscle group(s)":["Triceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Triceps press","Triceps pushdown"]},
  {"Exercise ID":77,"Name":"Triceps pushdown med rep","Equipment":"Kabel","Muscle group(s)":["Triceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Triceps rep pushdown","Cable pushdown rope"]},
  {"Exercise ID":78,"Name":"Liggande tricepspress","Equipment":"Skivstång","Muscle group(s)":["Triceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Skull crusher","French press"]},
  {"Exercise ID":79,"Name":"Tricepspress över huvud med hantel","Equipment":"Hantel","Muscle group(s)":["Triceps"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Triceps overhead","Overhead triceps extension"]},
  {"Exercise ID":80,"Name":"Tricepskickback","Equipment":"Hantel","Muscle group(s)":["Triceps"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Triceps kickback"]},
  {"Exercise ID":81,"Name":"Smalt grepp bänkpress","Equipment":"Skivstång","Muscle group(s)":["Triceps","Bröst"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Close Grip Bench","Smalt grepp bänkpress"]},
  {"Exercise ID":82,"Name":"Handledscurl","Equipment":"Hantel","Muscle group(s)":["Underarmar"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Handledscurl","Wrist Curl"]},
  {"Exercise ID":83,"Name":"Omvänd handledscurl","Equipment":"Skivstång","Muscle group(s)":["Underarmar"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Reverse wrist curl","Omvänd handledscurl"]},
  {"Exercise ID":84,"Name":"Farmers walk","Equipment":"Hantlar","Muscle group(s)":["Hela kroppen"],"Categories":["styrketräning","viktminskning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Farmargång","Farmer's walk","Bondgång"]},
  {"Exercise ID":85,"Name":"Plankan","Equipment":"Kroppsvikt","Muscle group(s)":["Mage","Rygg"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Planka","Plank"]},
  {"Exercise ID":86,"Name":"Sidoplanka","Equipment":"Kroppsvikt","Muscle group(s)":["Mage","Rygg"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Sidoplanka","Side Plank"]},
  {"Exercise ID":87,"Name":"Crunches","Equipment":"Kroppsvikt","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Crunch","Situps","Magcrunches"]},
  {"Exercise ID":88,"Name":"Situps","Equipment":"Kroppsvikt","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Sit-up","Situps"]},
  {"Exercise ID":89,"Name":"Bencykling","Equipment":"Kroppsvikt","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Cykelcrunch","Bicycle crunch"]},
  {"Exercise ID":90,"Name":"Benlyft liggande","Equipment":"Kroppsvikt","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Liggande benlyft","Leg Raise"]},
  {"Exercise ID":91,"Name":"Hängande benlyft","Equipment":"Kroppsvikt","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Hängande benlyft","Hanging Leg Raise"]},
  {"Exercise ID":92,"Name":"Benlyft i dipsställning","Equipment":"Kroppsvikt","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Benkörning","Leg raise dip bar"]},
  {"Exercise ID":93,"Name":"Knäuppdrag i häng","Equipment":"Kroppsvikt","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Hängande knälyft","Hanging Knee Raise"]},
  {"Exercise ID":94,"Name":"Russian twist","Equipment":"Medicinboll","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Russian twist"]},
  {"Exercise ID":95,"Name":"Sidoböj med hantel","Equipment":"Hantel","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Sidoböj","Dumbbell Side Bend"]},
  {"Exercise ID":96,"Name":"Rygglyft på golv","Equipment":"Kroppsvikt","Muscle group(s)":["Rygg"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Superman","Rygglyft"]},
  {"Exercise ID":97,"Name":"Bird-dog","Equipment":"Kroppsvikt","Muscle group(s)":["Rygg","Mage"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Fyrfota sträck","Bird dog"]},
  {"Exercise ID":98,"Name":"Maghjul rollout","Equipment":"Hjul","Muscle group(s)":["Mage","Rygg"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Maghjul","Ab wheel rollout"]},
  {"Exercise ID":99,"Name":"Trunk rotation i kabel","Equipment":"Kabel","Muscle group(s)":["Mage"],"Categories":["styrketräning","rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Kabelrotation","Woodchopper"]},
  {"Exercise ID":100,"Name":"Höftlyft (ytterligare)","Equipment":"Kroppsvikt","Muscle group(s)":["Mage","Rygg"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Brygga","Glute bridge","Höftlyft mage"]},
  {"Exercise ID":101,"Name":"Burpee","Equipment":"Kroppsvikt","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning","styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Burpee","Utfallshopp med armhävning"]},
  {"Exercise ID":102,"Name":"Jumping jacks","Equipment":"Kroppsvikt","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Jumping jack","X-hopp"]},
  {"Exercise ID":103,"Name":"Höga knä","Equipment":"Kroppsvikt","Muscle group(s)":["Ben"],"Categories":["viktminskning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Höga knä","High Knees"]},
  {"Exercise ID":104,"Name":"Mountain climbers","Equipment":"Kroppsvikt","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Bergsklättraren","Mountain climber"]},
  {"Exercise ID":105,"Name":"Skaters","Equipment":"Kroppsvikt","Muscle group(s)":["Ben"],"Categories":["viktminskning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Skridskohopp","Skater jumps"]},
  {"Exercise ID":106,"Name":"Hopprep","Equipment":"Kroppsvikt","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Hopprep","Jump rope"]},
  {"Exercise ID":107,"Name":"Kettlebellsving","Equipment":"Kettlebell","Muscle group(s)":["Hela kroppen"],"Categories":["styrketräning","viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Kettlebell swing","Sving"]},
  {"Exercise ID":108,"Name":"Thruster","Equipment":"Skivstång","Muscle group(s)":["Hela kroppen"],"Categories":["styrketräning","viktminskning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Thruster","Knäböj axelpress"]},
  {"Exercise ID":109,"Name":"Frivändning","Equipment":"Skivstång","Muscle group(s)":["Hela kroppen"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":true,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Olympisk stöt","Clean"]},
  {"Exercise ID":110,"Name":"Ryck","Equipment":"Skivstång","Muscle group(s)":["Hela kroppen"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":true,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Snatch","Ryck"]},
  {"Exercise ID":111,"Name":"Stöt","Equipment":"Skivstång","Muscle group(s)":["Hela kroppen"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":true,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Clean and Jerk","Stöt"]},
  {"Exercise ID":112,"Name":"Battleropes","Equipment":"Rep","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Battlerope","Battle ropes"]},
  {"Exercise ID":113,"Name":"Armhävningar med fötter på bänk","Equipment":"Kroppsvikt","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Decline push-up","Armhävning fötter högt"]},
  {"Exercise ID":114,"Name":"Armhävning med klapp","Equipment":"Kroppsvikt","Muscle group(s)":["Bröst","Axlar"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Klapp armhävning","Clap push-up"]},
  {"Exercise ID":115,"Name":"Flyes i kabel","Equipment":"Kabel","Muscle group(s)":["Bröst"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Cable fly","Kabel flyes"]},
  {"Exercise ID":116,"Name":"Stående latsdrag med raka armar","Equipment":"Kabel","Muscle group(s)":["Rygg"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Straight arm pulldown","Stående latsdrag"]},
  {"Exercise ID":117,"Name":"Pullover med hantel","Equipment":"Hantel","Muscle group(s)":["Rygg","Bröst"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Pullover","Pullover hantel"]},
  {"Exercise ID":118,"Name":"Omvänd rodd","Equipment":"Kroppsvikt","Muscle group(s)":["Rygg","Biceps"],"Categories":["rehabilitering"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Inverted row","Kroppsviktsrodd"]},
  {"Exercise ID":119,"Name":"Knäböj utan vikt","Equipment":"Kroppsvikt","Muscle group(s)":["Ben","Rumpa"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Benböj","Bodyweight squat"]},
  {"Exercise ID":120,"Name":"Sissy squat","Equipment":"Kroppsvikt","Muscle group(s)":["Ben"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Sissy squat"]},
  {"Exercise ID":121,"Name":"Nordic hamstring curl","Equipment":"Kroppsvikt","Muscle group(s)":["Ben"],"Categories":["rehabilitering"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Nordic curl","Nordic hamstrings"]},
  {"Exercise ID":122,"Name":"Väggsitt","Equipment":"Kroppsvikt","Muscle group(s)":["Ben"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Wall sit","Väggsitt"]},
  {"Exercise ID":123,"Name":"Ufall bakåt","Equipment":"Kroppsvikt","Muscle group(s)":["Ben","Rumpa"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Bakåt utfall","Reverse lunge"]},
  {"Exercise ID":124,"Name":"Donkey kick","Equipment":"Kroppsvikt","Muscle group(s)":["Rumpa"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Donkey kick","Ben spark bakåt"]},
  {"Exercise ID":125,"Name":"Fire hydrant","Equipment":"Kroppsvikt","Muscle group(s)":["Rumpa"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Fire hydrant","Hundkiss"]},
  {"Exercise ID":126,"Name":"Push press","Equipment":"Skivstång","Muscle group(s)":["Axlar","Ben"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Push press","Pushpress"]},
  {"Exercise ID":127,"Name":"Handstående armhävning","Equipment":"Kroppsvikt","Muscle group(s)":["Axlar","Bröst"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Handstand push-up","Handstående armhävning"]},
  {"Exercise ID":128,"Name":"Omvänt bicepscurl","Equipment":"Skivstång","Muscle group(s)":["Biceps","Underarmar"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Omvänd curl","Reverse Curl"]},
  {"Exercise ID":129,"Name":"Liggande tricepspress med hantlar","Equipment":"Hantlar","Muscle group(s)":["Triceps"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Skull crushers hantlar","Liggande triceps"]},
  {"Exercise ID":130,"Name":"Tricepspress i maskin","Equipment":"Maskin","Muscle group(s)":["Triceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Tricepsmaskin","Tricep machine"]},
  {"Exercise ID":131,"Name":"V-ups","Equipment":"Kroppsvikt","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["V-situps","V-ups"]},
  {"Exercise ID":132,"Name":"Dead bug","Equipment":"Kroppsvikt","Muscle group(s)":["Mage"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Dead bug","Död insekt"]},
  {"Exercise ID":133,"Name":"Vindrutetorkare","Equipment":"Kroppsvikt","Muscle group(s)":["Mage","Rygg"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Windshield wipers","Vindrutetorkare"]},
  {"Exercise ID":134,"Name":"Sneda situps","Equipment":"Kroppsvikt","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Sned situp","Oblique crunch"]},
  {"Exercise ID":135,"Name":"Hängande vindrutetorkare","Equipment":"Kroppsvikt","Muscle group(s)":["Mage","Rygg"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Hängande vindrutetorkare","Hanging windshield wiper"]},
  {"Exercise ID":136,"Name":"Björnkravl","Equipment":"Kroppsvikt","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Bear crawl","Björn gång"]},
  {"Exercise ID":137,"Name":"Turkish get-up","Equipment":"Kettlebell","Muscle group(s)":["Hela kroppen"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Turkish getup","Get-up"]},
  {"Exercise ID":138,"Name":"Slädpress","Equipment":"Släde","Muscle group(s)":["Ben","Hela kroppen"],"Categories":["viktminskning","styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Prowler push","Sled push"]},
  {"Exercise ID":139,"Name":"Wall ball","Equipment":"Medicinboll","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Wall ball","Medicinboll kast"]},
  {"Exercise ID":140,"Name":"Drag släde baklänges","Equipment":"Släde","Muscle group(s)":["Ben"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Sled drag back","Baklänges släddrag"]},
  {"Exercise ID":141,"Name":"Reverensutfall","Equipment":"Kroppsvikt","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Curtsy lunge","Reverens utfall"]},
  {"Exercise ID":142,"Name":"Crunch på boll","Equipment":"Boll","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Bollcrunch","Crunch pilatesboll"]},
  {"Exercise ID":143,"Name":"Planka på boll","Equipment":"Boll","Muscle group(s)":["Mage","Rygg"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Planka boll","Swiss ball plank"]},
  {"Exercise ID":144,"Name":"Hamstringcurl på boll","Equipment":"Boll","Muscle group(s)":["Ben","Rumpa"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Leg curl boll","Hamstringcurl boll"]},
  {"Exercise ID":145,"Name":"Pike på boll","Equipment":"Boll","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Boll pike","Jackknife boll"]},
  {"Exercise ID":146,"Name":"Armhävningar mot bänk","Equipment":"Kroppsvikt","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Incline push-up","Armhävning bänk"]},
  {"Exercise ID":147,"Name":"Enbens hip thrust","Equipment":"Kroppsvikt","Muscle group(s)":["Rumpa","Ben"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Enbens höftlyft","Single leg hip thrust"]},
  {"Exercise ID":148,"Name":"Zercher squat","Equipment":"Skivstång","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Zercher knäböj","Zercher squat"]},
  {"Exercise ID":149,"Name":"Magcrunch i maskin","Equipment":"Maskin","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Magmaskin","Ab crunch machine"]},
  {"Exercise ID":150,"Name":"Rotationsmaskin för mage","Equipment":"Maskin","Muscle group(s)":["Mage"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Rotationsmaskin","Torso rotation machine"]},
  {"Exercise ID":151,"Name":"Kettlebell clean and press","Equipment":"Kettlebell","Muscle group(s)":["Hela kroppen"],"Categories":["styrketräning","viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["KB clean press","Kettlebell frivändning och press"]},
  {"Exercise ID":152,"Name":"Kettlebell snatch","Equipment":"Kettlebell","Muscle group(s)":["Hela kroppen"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["KB snatch","Kettlebell ryck"]},
  {"Exercise ID":153,"Name":"Sumo knäböj med skivstång","Equipment":"Skivstång","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Sumo squat skivstång","Sumo squat barbell"]},
  {"Exercise ID":154,"Name":"Golvbänkpress","Equipment":"Skivstång","Muscle group(s)":["Bröst","Triceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Floor press","Golvbänk"]},
  {"Exercise ID":155,"Name":"Diamant-armhävningar","Equipment":"Kroppsvikt","Muscle group(s)":["Triceps","Bröst"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Diamond push-up","Diamant armhävning"]},
  {"Exercise ID":156,"Name":"Kettlebell windmill","Equipment":"Kettlebell","Muscle group(s)":["Mage","Axlar"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Windmill kettlebell","Kettlebell väderkvarn"]},
  {"Exercise ID":157,"Name":"Musslan med gummiband","Equipment":"Band","Muscle group(s)":["Rumpa"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Band clamshell","Mussla gummiband"]},
  {"Exercise ID":158,"Name":"Enarms armhävning","Equipment":"Kroppsvikt","Muscle group(s)":["Bröst","Axlar","Triceps"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["One-arm push-up","Enarms armhävning"]},
  {"Exercise ID":159,"Name":"Bicepscurl med gummiband","Equipment":"Band","Muscle group(s)":["Biceps"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Biceps curl band","Gummiband bicepscurl"]},
  {"Exercise ID":160,"Name":"Tricepspress med gummiband","Equipment":"Band","Muscle group(s)":["Triceps"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Triceps band press","Gummiband triceps"]},
  {"Exercise ID":161,"Name":"Rodd i TRX","Equipment":"TRX","Muscle group(s)":["Rygg","Biceps"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["TRX rodd","Ringrodd","Inverterad rodd"]},
  {"Exercise ID":162,"Name":"Armhävningar i TRX","Equipment":"TRX","Muscle group(s)":["Bröst","Axlar","Core"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["TRX armhävning","Push-up TRX"]},
  {"Exercise ID":163,"Name":"Knäböj över huvudet","Equipment":"Skivstång","Muscle group(s)":["Ben","Axlar"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Overhead squat","Knäböj overhead"]},
  {"Exercise ID":164,"Name":"Sumo squat med kettlebell","Equipment":"Kettlebell","Muscle group(s)":["Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Sumo squat","Sumo knäböj"]},
  {"Exercise ID":165,"Name":"Enbent vadpress","Equipment":"Kroppsvikt","Muscle group(s)":["Ben"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Enbens vadpress","Single leg calf raise"]},
  {"Exercise ID":166,"Name":"Enarms farmers walk","Equipment":"Hantel","Muscle group(s)":["Hela kroppen"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Suitcase carry","Enarms bondgång"]},
  {"Exercise ID":167,"Name":"Medicinbollsslam","Equipment":"Medicinboll","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Ball slam","Medicinboll slam"]},
  {"Exercise ID":168,"Name":"Skuggboxning","Equipment":"Kroppsvikt","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Shadow boxing","Skuggboxning"]},
  {"Exercise ID":169,"Name":"Hälsparkslöpning","Equipment":"Kroppsvikt","Muscle group(s)":["Ben"],"Categories":["viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Butt kicks","Hälspark löpning"]},
  {"Exercise ID":170,"Name":"Knähopp","Equipment":"Kroppsvikt","Muscle group(s)":["Ben"],"Categories":["viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Tuck jump","Knähopp"]},
  {"Exercise ID":171,"Name":"Boxslag på säck","Equipment":"Boxsäck","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Boxning säck","Punching bag"]},
  {"Exercise ID":172,"Name":"Gummibandsdrag isär","Equipment":"Band","Muscle group(s)":["Axlar"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Pull-apart band","Gummiband dragisär"]},
  {"Exercise ID":173,"Name":"Sidliggande benlyft","Equipment":"Kroppsvikt","Muscle group(s)":["Ben","Rumpa"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Sidolyft ben","Side leg raise"]},
  {"Exercise ID":174,"Name":"Benlyft åt sidan i kabel","Equipment":"Kabel","Muscle group(s)":["Rumpa"],"Categories":["rehabilitering"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Hip abduction cable","Benlyft kabel"]},
  {"Exercise ID":175,"Name":"Pallof press","Equipment":"Kabel","Muscle group(s)":["Mage"],"Categories":["rehabilitering"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":false,"AI-search terms":["Anti-rotation press","Pallofpress"]},
  {"Exercise ID":176,"Name":"Man maker","Equipment":"Hantlar","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning","styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Man maker","Manmaker"]},
  {"Exercise ID":177,"Name":"Krabbgång","Equipment":"Kroppsvikt","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Crab walk","Krabbgång"]},
  {"Exercise ID":178,"Name":"Muscle-up","Equipment":"Kroppsvikt","Muscle group(s)":["Rygg","Bröst","Armar"],"Categories":["styrketräning"],"Gender specialization":"male","requires_1RM":false,"good_for_beginners":false,"core_engagement":true,"AI-search terms":["Muscleup","Muscle-up"]},
  {"Exercise ID":179,"Name":"Marklyft med hantlar","Equipment":"Hantlar","Muscle group(s)":["Rygg","Ben","Rumpa"],"Categories":["styrketräning"],"Gender specialization":"female","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Dumbbell deadlift","Marklyft hantlar"]},
  {"Exercise ID":180,"Name":"Box squat","Equipment":"Skivstång","Muscle group(s)":["Ben","Rumpa"],"Categories":["rehabilitering","styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Lådböj","Box squat"]},
  {"Exercise ID":181,"Name":"Inchworm","Equipment":"Kroppsvikt","Muscle group(s)":["Hela kroppen"],"Categories":["viktminskning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":true,"core_engagement":true,"AI-search terms":["Inchworm","Promenad på händer"]},
  {"Exercise ID":182,"Name":"Hollow hold","Equipment":"Kroppsvikt","Muscle group(s)":["Mage"],"Categories":["styrketräning"],"Gender specialization":"both","requires_1RM":false,"good_for_beginners":false,"core_engagement":false,"AI-search terms":["Hollow hold","Bålhållning"]}
];

function mapEquipmentToArray(equipment: string): string[] {
  const equipmentMap: Record<string, string[]> = {
    "Skivstång": ["barbell"],
    "Hantlar": ["dumbbells"],
    "Hantel": ["dumbbell"],
    "Kroppsvikt": ["bodyweight"],
    "Maskin": ["machine"],
    "Kabel": ["cable"],
    "Kettlebell": ["kettlebell"],
    "Band": ["resistance_band"],
    "TRX": ["trx", "suspension"],
    "Medicinboll": ["medicine_ball"],
    "Boll": ["exercise_ball", "swiss_ball"],
    "Rep": ["battle_ropes"],
    "Boxsäck": ["punching_bag"],
    "Släde": ["sled"],
    "Hjul": ["ab_wheel"]
  };
  return equipmentMap[equipment] || [equipment.toLowerCase()];
}

function getDifficultyFromFlags(goodForBeginners: boolean, requiresRM: boolean): string {
  if (requiresRM) return "advanced";
  if (goodForBeginners) return "beginner";
  return "intermediate";
}

function isCompoundExercise(muscles: string[]): boolean {
  return muscles.length >= 2;
}

function getCategory(categories: string[]): string {
  if (categories.includes("styrketräning")) return "strength";
  if (categories.includes("rehabilitering")) return "rehabilitation";
  if (categories.includes("viktminskning")) return "cardio";
  return "strength";
}

async function importExercises() {
  console.log("Starting exercise import...");
  console.log(`Total exercises to process: ${exerciseData.length}`);
  
  let updated = 0;
  let inserted = 0;
  let errors = 0;
  let skipped = 0;
  
  for (const ex of exerciseData) {
    try {
      const existingByName = await db
        .select()
        .from(exercises)
        .where(eq(exercises.name, ex.Name))
        .limit(1);
      
      let existingBySearchTerm: typeof existingByName = [];
      if (existingByName.length === 0 && ex["AI-search terms"].length > 0) {
        for (const term of ex["AI-search terms"]) {
          const found = await db
            .select()
            .from(exercises)
            .where(or(eq(exercises.name, term), eq(exercises.nameEn, term)))
            .limit(1);
          if (found.length > 0) {
            existingBySearchTerm = found;
            break;
          }
        }
      }
      
      const existing = existingByName.length > 0 ? existingByName[0] : 
                       existingBySearchTerm.length > 0 ? existingBySearchTerm[0] : null;
      
      const englishName = ex["AI-search terms"].find(term => 
        /^[A-Za-z\s\-']+$/.test(term) && term !== ex.Name
      ) || null;
      
      if (existing) {
        await db
          .update(exercises)
          .set({
            exerciseId: ex["Exercise ID"],
            nameEn: existing.nameEn || englishName,
            requiredEquipment: mapEquipmentToArray(ex.Equipment),
            primaryMuscles: ex["Muscle group(s)"],
            requires1RM: ex.requires_1RM,
            goodForBeginners: ex.good_for_beginners,
            coreEngagement: ex.core_engagement,
            genderSpecialization: ex["Gender specialization"],
            categories: ex.Categories,
            aiSearchTerms: ex["AI-search terms"],
            difficulty: getDifficultyFromFlags(ex.good_for_beginners, ex.requires_1RM),
            isCompound: isCompoundExercise(ex["Muscle group(s)"]),
          })
          .where(eq(exercises.id, existing.id));
        updated++;
        console.log(`Updated: ${ex.Name} (matched: ${existing.name})`);
      } else {
        await db.insert(exercises).values({
          exerciseId: ex["Exercise ID"],
          name: ex.Name,
          nameEn: englishName,
          category: getCategory(ex.Categories),
          difficulty: getDifficultyFromFlags(ex.good_for_beginners, ex.requires_1RM),
          primaryMuscles: ex["Muscle group(s)"],
          secondaryMuscles: [],
          requiredEquipment: mapEquipmentToArray(ex.Equipment),
          isCompound: isCompoundExercise(ex["Muscle group(s)"]),
          requires1RM: ex.requires_1RM,
          goodForBeginners: ex.good_for_beginners,
          coreEngagement: ex.core_engagement,
          genderSpecialization: ex["Gender specialization"],
          categories: ex.Categories,
          aiSearchTerms: ex["AI-search terms"],
        });
        inserted++;
        console.log(`Inserted: ${ex.Name}`);
      }
    } catch (error: any) {
      if (error.message?.includes("duplicate key")) {
        skipped++;
        console.log(`Skipped duplicate: ${ex.Name}`);
      } else {
        errors++;
        console.error(`Error processing ${ex.Name}:`, error.message);
      }
    }
  }
  
  console.log("\n=== Import Summary ===");
  console.log(`Updated: ${updated}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total processed: ${updated + inserted + skipped + errors}`);
  
  const totalCount = await db.select().from(exercises);
  console.log(`Total exercises in database: ${totalCount.length}`);
  
  const withVideos = totalCount.filter(e => e.youtubeUrl);
  console.log(`Exercises with video links: ${withVideos.length}`);
}

importExercises()
  .then(() => {
    console.log("Import completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Import failed:", error);
    process.exit(1);
  });
