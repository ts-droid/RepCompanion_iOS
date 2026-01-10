import { 
  type User, 
  type UpsertUser,
  type UserProfile,
  type InsertUserProfile,
  type UpdateUserProfile,
  type Gym,
  type InsertGym,
  type UserEquipment,
  type InsertUserEquipment,
  type GymProgram,
  type InsertGymProgram,
  type WorkoutSession,
  type InsertWorkoutSession,
  type ExerciseLog,
  type InsertExerciseLog,
  type ProgramTemplate,
  type InsertProgramTemplate,
  type ProgramTemplateExercise,
  type InsertProgramTemplateExercise,
  type ExerciseStats,
  type InsertExerciseStats,
  type PromoContent,
  type InsertPromoContent,
  type PromoImpression,
  type InsertPromoImpression,
  type AffiliateClick,
  type InsertAffiliateClick,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type UpdateNotificationPreferences,
  type UserSubscription,
  type InsertUserSubscription,
  type TrainingTip,
  type InsertTrainingTip,
  type ProfileTrainingTip,
  users,
  userProfiles,
  gyms,
  userEquipment,
  gymPrograms,
  workoutSessions,
  exerciseLogs,
  programTemplates,
  programTemplateExercises,
  exerciseStats,
  promoContent,
  promoImpressions,
  affiliateClicks,
  notificationPreferences,
  userSubscriptions,
  trainingTips,
  profileTrainingTips,
  exercises,
  equipmentCatalog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, gte, sql, inArray, isNull, isNotNull } from "drizzle-orm";
import { matchExercise } from "./exercise-matcher";

export interface IStorage {
  // User operations (required by Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // User profile operations
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: string, data: UpdateUserProfile): Promise<UserProfile>;
  
  // Gym operations
  createGym(gym: InsertGym): Promise<Gym>;
  getGym(id: string): Promise<Gym | undefined>;
  getUserGyms(userId: string): Promise<Gym[]>;
  getSelectedGym(userId: string): Promise<Gym | undefined>;
  setSelectedGym(userId: string, gymId: string): Promise<void>;
  updateGym(id: string, userId: string, data: { name: string; location?: string }): Promise<Gym>;
  deleteGym(id: string, userId: string): Promise<void>;
  
  // Equipment operations
  getUserEquipment(userId: string): Promise<UserEquipment[]>;
  getGymEquipment(gymId: string): Promise<UserEquipment[]>;
  upsertEquipment(equipment: InsertUserEquipment): Promise<UserEquipment>;
  deleteEquipment(id: string): Promise<void>;
  
  // Gym program operations
  createGymProgram(program: InsertGymProgram): Promise<GymProgram>;
  getGymProgram(userId: string, gymId: string): Promise<GymProgram | undefined>;
  upsertGymProgram(program: InsertGymProgram): Promise<GymProgram>;
  clearUserGymPrograms(userId: string): Promise<void>;
  
  // Workout session operations
  createWorkoutSession(session: InsertWorkoutSession): Promise<WorkoutSession>;
  getWorkoutSession(id: string): Promise<WorkoutSession | undefined>;
  completeWorkoutSession(id: string, movergyScore?: number): Promise<void>;
  cancelWorkoutSession(id: string): Promise<void>;
  getUserWorkoutSessions(userId: string, limit?: number): Promise<WorkoutSession[]>;
  getActiveWorkoutSession(userId: string): Promise<WorkoutSession | undefined>;
  updateSessionSnapshot(id: string, snapshotData: { skippedExercises: number[] }): Promise<void>;
  
  // Exercise log operations
  getExerciseLog(id: string): Promise<ExerciseLog | undefined>;
  createExerciseLog(log: InsertExerciseLog): Promise<ExerciseLog>;
  updateExerciseLog(id: string, data: Partial<InsertExerciseLog>): Promise<void>;
  bulkUpdateExerciseLogs(sessionId: string, exerciseOrderIndex: number, data: { weight?: number; reps?: number }): Promise<void>;
  getSessionExerciseLogs(sessionId: string): Promise<ExerciseLog[]>;
  
  // Promo operations
  getPromo(id: string): Promise<PromoContent | undefined>;
  getActivePromosByPlacement(placement: string): Promise<PromoContent[]>;
  createPromo(promo: InsertPromoContent): Promise<PromoContent>;
  trackPromoImpression(impression: InsertPromoImpression): Promise<void>;
  getUserRecentImpressions(userId: string, promoId: string, hours: number): Promise<PromoImpression[]>;
  trackAffiliateClick(click: InsertAffiliateClick): Promise<void>;
  
  // Notification preferences operations
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  upsertNotificationPreferences(prefs: InsertNotificationPreferences): Promise<NotificationPreferences>;
  updateNotificationPreferences(userId: string, data: UpdateNotificationPreferences): Promise<void>;
  
  // Subscription operations
  getUserSubscription(userId: string): Promise<UserSubscription | undefined>;
  upsertUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription>;
  
  // Training tips operations
  createTrainingTip(tip: InsertTrainingTip): Promise<TrainingTip>;
  getTrainingTips(filters?: { category?: string; workoutType?: string; isActive?: boolean }): Promise<TrainingTip[]>;
  getTrainingTip(id: string): Promise<TrainingTip | undefined>;
  
  // Profile training tips operations
  getPersonalizedTips(userId: string, limit?: number): Promise<ProfileTrainingTip[]>;
  getProfileTipsByCategory(userId: string, category: string, limit?: number): Promise<ProfileTrainingTip[]>;
  
  // Exercise catalog operations
  getExerciseByName(name: string): Promise<{ id: string; name: string; nameEn: string | null; youtubeUrl: string | null; videoType: string | null } | undefined>;
  getExercisesByNames(names: string[]): Promise<{ id: string; name: string; nameEn: string | null; youtubeUrl: string | null; videoType: string | null }[]>;
  
  // Program template operations
  getUserProgramTemplates(userId: string): Promise<ProgramTemplate[]>;
  getProgramTemplate(id: string): Promise<ProgramTemplate | undefined>;
  getTemplateExercises(templateId: string): Promise<ProgramTemplateExercise[]>;
  updateTemplateExercises(templateId: string, exercises: Partial<ProgramTemplateExercise>[]): Promise<void>;
  updateProgramTemplate(id: string, data: { dayOfWeek?: number }): Promise<ProgramTemplate>;
  getNextTemplate(userId: string): Promise<{ template: ProgramTemplate; exercises: ProgramTemplateExercise[] } | null>;
  createProgramTemplatesFromAI(userId: string, aiProgramData: any): Promise<void>;
  createProgramTemplatesFromDeepSeek(userId: string, program: import("./ai-service").DeepSeekWorkoutProgram): Promise<void>;
  clearUserProgramTemplates(userId: string): Promise<void>;
  updateLastCompletedTemplate(userId: string, templateId: string): Promise<void>;
  getTemplatesWithMetadata(userId: string): Promise<Array<{ template: ProgramTemplate; exerciseCount: number; isNext: boolean }>>;
  incrementProgramGeneration(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ========== User operations ==========
  
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // ========== User profile operations ==========
  
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    
    // Auto-select newest gym if no gym is selected but user has gyms
    if (profile && !profile.selectedGymId) {
      const userGyms = await this.getUserGyms(userId);
      if (userGyms.length > 0) {
        // Select the most recently created gym
        const newestGym = userGyms[0]; // Already ordered by createdAt DESC
        try {
          await this.setSelectedGym(userId, newestGym.id);
          // Refresh profile to include the updated selectedGymId
          const [updatedProfile] = await db
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.userId, userId));
          return updatedProfile;
        } catch (error) {
          console.error("[STORAGE] Failed to auto-select gym:", error);
          // Return original profile even if auto-selection fails
          return profile;
        }
      }
    }
    
    return profile;
  }

  async upsertUserProfile(profileData: InsertUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values(profileData)
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          ...profileData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return profile;
  }

  async updateUserProfile(userId: string, data: UpdateUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .update(userProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId))
      .returning();
    
    if (!profile) {
      throw new Error("Profile not found");
    }
    
    return profile;
  }

  async incrementPassNumber(userId: string): Promise<UserProfile> {
    const profile = await this.getUserProfile(userId);
    const templates = await this.getUserProgramTemplates(userId);
    
    if (!profile) {
      throw new Error("Profile not found");
    }
    
    // If no templates exist (e.g., during regeneration), keep at 1
    if (templates.length === 0) {
      return this.updateUserProfile(userId, { currentPassNumber: 1 });
    }
    
    const currentPass = profile.currentPassNumber || 1;
    const totalPasses = templates.length;
    
    // Increment and wrap around (1→2→3→4→1)
    const nextPass = (currentPass % totalPasses) + 1;
    
    return this.updateUserProfile(userId, { currentPassNumber: nextPass });
  }

  // ========== Gym operations ==========
  
  async createGym(gymData: InsertGym): Promise<Gym> {
    const [gym] = await db
      .insert(gyms)
      .values(gymData)
      .returning();
    return gym;
  }

  async getGym(id: string): Promise<Gym | undefined> {
    const [gym] = await db
      .select()
      .from(gyms)
      .where(eq(gyms.id, id));
    return gym;
  }

  async getUserGyms(userId: string): Promise<Gym[]> {
    return await db
      .select()
      .from(gyms)
      .where(eq(gyms.userId, userId))
      .orderBy(desc(gyms.createdAt));
  }

  async getSelectedGym(userId: string): Promise<Gym | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    
    if (!profile?.selectedGymId) {
      return undefined;
    }
    
    return await this.getGym(profile.selectedGymId);
  }

  async setSelectedGym(userId: string, gymId: string): Promise<void> {
    const targetGym = await this.getGym(gymId);
    if (!targetGym || targetGym.userId !== userId) {
      throw new Error("Gym not found or access denied");
    }

    await db
      .update(userProfiles)
      .set({ selectedGymId: gymId, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));
  }

  async updateGym(id: string, userId: string, data: { name: string; location?: string }): Promise<Gym> {
    const gym = await this.getGym(id);
    if (!gym || gym.userId !== userId) {
      throw new Error("Gym not found or access denied");
    }

    const [updatedGym] = await db
      .update(gyms)
      .set({
        name: data.name,
        location: data.location,
      })
      .where(and(eq(gyms.id, id), eq(gyms.userId, userId)))
      .returning();
    
    return updatedGym;
  }

  async deleteGym(id: string, userId: string): Promise<void> {
    const gym = await this.getGym(id);
    if (!gym || gym.userId !== userId) {
      throw new Error("Gym not found or access denied");
    }
    await db.delete(gyms).where(and(eq(gyms.id, id), eq(gyms.userId, userId)));
  }

  // ========== Equipment operations ==========
  
  async getUserEquipment(userId: string): Promise<UserEquipment[]> {
    return await db
      .select()
      .from(userEquipment)
      .where(eq(userEquipment.userId, userId));
  }

  async getGymEquipment(gymId: string): Promise<UserEquipment[]> {
    return await db
      .select()
      .from(userEquipment)
      .where(eq(userEquipment.gymId, gymId));
  }

  async getEquipmentById(id: string): Promise<UserEquipment | undefined> {
    const [equipment] = await db
      .select()
      .from(userEquipment)
      .where(eq(userEquipment.id, id));
    return equipment;
  }

  async upsertEquipment(equipmentData: InsertUserEquipment): Promise<UserEquipment> {
    const [equipment] = await db
      .insert(userEquipment)
      .values(equipmentData)
      .onConflictDoUpdate({
        target: [userEquipment.gymId, userEquipment.equipmentName],
        set: { available: equipmentData.available ?? true },
      })
      .returning();
    return equipment;
  }

  async deleteEquipment(id: string): Promise<void> {
    await db.delete(userEquipment).where(eq(userEquipment.id, id));
  }

  // ========== Gym program operations ==========
  
  async createGymProgram(programData: InsertGymProgram): Promise<GymProgram> {
    const [program] = await db
      .insert(gymPrograms)
      .values(programData)
      .returning();
    return program;
  }

  async getGymProgram(userId: string, gymId: string): Promise<GymProgram | undefined> {
    const [program] = await db
      .select()
      .from(gymPrograms)
      .where(and(eq(gymPrograms.userId, userId), eq(gymPrograms.gymId, gymId)));
    return program;
  }

  async upsertGymProgram(programData: InsertGymProgram): Promise<GymProgram> {
    const [program] = await db
      .insert(gymPrograms)
      .values(programData)
      .onConflictDoUpdate({
        target: [gymPrograms.userId, gymPrograms.gymId],
        set: {
          programData: programData.programData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return program;
  }

  async clearUserGymPrograms(userId: string): Promise<void> {
    await db.delete(gymPrograms).where(eq(gymPrograms.userId, userId));
  }

  // ========== Workout session operations ==========
  
  async createWorkoutSession(sessionData: InsertWorkoutSession): Promise<WorkoutSession> {
    const [session] = await db
      .insert(workoutSessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async getWorkoutSession(id: string): Promise<WorkoutSession | undefined> {
    const [session] = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, id));
    return session;
  }

  async completeWorkoutSession(id: string, movergyScore?: number): Promise<void> {
    await db
      .update(workoutSessions)
      .set({ 
        status: 'completed',
        completedAt: new Date(),
        movergyScore,
      })
      .where(eq(workoutSessions.id, id));
  }

  async cancelWorkoutSession(id: string): Promise<void> {
    await db
      .update(workoutSessions)
      .set({ 
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(eq(workoutSessions.id, id));
  }

  async getUserWorkoutSessions(userId: string, limit: number = 50): Promise<WorkoutSession[]> {
    return await db
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, userId),
          isNotNull(workoutSessions.completedAt)
        )
      )
      .orderBy(desc(workoutSessions.startedAt))
      .limit(limit);
  }

  async getActiveWorkoutSession(userId: string): Promise<WorkoutSession | undefined> {
    const [session] = await db
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, userId),
          eq(workoutSessions.status, 'pending')
        )
      )
      .orderBy(desc(workoutSessions.startedAt))
      .limit(1);
    return session;
  }

  async updateSessionSnapshot(id: string, snapshotData: { skippedExercises: number[] }): Promise<void> {
    console.log("updateSessionSnapshot called with:", { id, snapshotData });
    const result = await db
      .update(workoutSessions)
      .set({ snapshotData })
      .where(eq(workoutSessions.id, id))
      .returning();
    console.log("updateSessionSnapshot result:", result);
  }

  // ========== Exercise log operations ==========
  
  async getExerciseLog(id: string): Promise<ExerciseLog | undefined> {
    const [log] = await db
      .select()
      .from(exerciseLogs)
      .where(eq(exerciseLogs.id, id));
    return log;
  }
  
  async createExerciseLog(logData: InsertExerciseLog): Promise<ExerciseLog> {
    const [log] = await db
      .insert(exerciseLogs)
      .values(logData)
      .returning();
    return log;
  }

  async updateExerciseLog(id: string, data: Partial<InsertExerciseLog>): Promise<void> {
    await db
      .update(exerciseLogs)
      .set(data)
      .where(eq(exerciseLogs.id, id));
  }

  async bulkUpdateExerciseLogs(sessionId: string, exerciseOrderIndex: number, data: { weight?: number; reps?: number }): Promise<void> {
    // Fetch session and template data first
    const session = await this.getWorkoutSession(sessionId);
    
    // Update exercise logs
    await db
      .update(exerciseLogs)
      .set(data)
      .where(
        and(
          eq(exerciseLogs.workoutSessionId, sessionId),
          eq(exerciseLogs.exerciseOrderIndex, exerciseOrderIndex),
          eq(exerciseLogs.completed, false)
        )
      );

    // Also update the template exercise if the session has a templateId
    if (session?.templateId) {
      const templateExercises = await this.getTemplateExercises(session.templateId);
      const templateExercise = templateExercises.find(ex => ex.orderIndex === exerciseOrderIndex);
      
      if (templateExercise) {
        const updateData: any = {};
        if (data.weight !== undefined) updateData.targetWeight = data.weight;
        if (data.reps !== undefined) updateData.targetReps = String(data.reps);
        
        // Update template exercise to sync with bulk update
        await db
          .update(programTemplateExercises)
          .set(updateData)
          .where(eq(programTemplateExercises.id, templateExercise.id));
      }
    }
  }

  async getSessionExerciseLogs(sessionId: string): Promise<ExerciseLog[]> {
    return await db
      .select()
      .from(exerciseLogs)
      .where(eq(exerciseLogs.workoutSessionId, sessionId))
      .orderBy(exerciseLogs.exerciseKey, exerciseLogs.setNumber);
  }

  // ========== Promo operations ==========
  
  async getPromo(id: string): Promise<PromoContent | undefined> {
    const [promo] = await db
      .select()
      .from(promoContent)
      .where(eq(promoContent.id, id));
    return promo;
  }

  async getActivePromosByPlacement(placement: string): Promise<PromoContent[]> {
    return await db
      .select()
      .from(promoContent)
      .where(and(
        eq(promoContent.placement, placement),
        eq(promoContent.isActive, true)
      ));
  }

  async createPromo(promoData: InsertPromoContent): Promise<PromoContent> {
    const [promo] = await db
      .insert(promoContent)
      .values(promoData)
      .returning();
    return promo;
  }

  async trackPromoImpression(impressionData: InsertPromoImpression): Promise<void> {
    await db.insert(promoImpressions).values(impressionData);
  }

  async getUserRecentImpressions(userId: string, promoId: string, hours: number): Promise<PromoImpression[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);
    
    return await db
      .select()
      .from(promoImpressions)
      .where(and(
        eq(promoImpressions.userId, userId),
        eq(promoImpressions.promoId, promoId),
        gte(promoImpressions.createdAt, cutoffTime)
      ));
  }

  async trackAffiliateClick(clickData: InsertAffiliateClick): Promise<void> {
    await db.insert(affiliateClicks).values(clickData);
  }

  // ========== Notification preferences operations ==========
  
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return prefs;
  }

  async upsertNotificationPreferences(prefsData: InsertNotificationPreferences): Promise<NotificationPreferences> {
    const [prefs] = await db
      .insert(notificationPreferences)
      .values(prefsData)
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          ...prefsData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return prefs;
  }

  async updateNotificationPreferences(userId: string, data: UpdateNotificationPreferences): Promise<void> {
    await db
      .update(notificationPreferences)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userId, userId));
  }

  // ========== Subscription operations ==========
  
  async getUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId));
    return subscription;
  }

  async upsertUserSubscription(subscriptionData: InsertUserSubscription): Promise<UserSubscription> {
    const [subscription] = await db
      .insert(userSubscriptions)
      .values(subscriptionData)
      .onConflictDoUpdate({
        target: userSubscriptions.userId,
        set: {
          ...subscriptionData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return subscription;
  }

  // ========== Training tips operations ==========
  
  async createTrainingTip(tipData: InsertTrainingTip): Promise<TrainingTip> {
    const [tip] = await db
      .insert(trainingTips)
      .values(tipData)
      .returning();
    return tip;
  }

  async getTrainingTips(filters?: { category?: string; workoutType?: string; isActive?: boolean }): Promise<TrainingTip[]> {
    let query = db.select().from(trainingTips);
    
    const conditions = [];
    
    if (filters?.category) {
      conditions.push(eq(trainingTips.category, filters.category));
    }
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(trainingTips.isActive, filters.isActive));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    let tips = await query.orderBy(desc(trainingTips.priority));
    
    if (filters?.workoutType) {
      const workoutType = filters.workoutType;
      tips = tips.filter(tip => 
        tip.workoutTypes.length === 0 || 
        tip.workoutTypes.includes(workoutType)
      );
    }
    
    return tips;
  }

  async getTrainingTip(id: string): Promise<TrainingTip | undefined> {
    const [tip] = await db
      .select()
      .from(trainingTips)
      .where(eq(trainingTips.id, id));
    return tip;
  }

  // ========== Profile training tips operations ==========
  
  async getPersonalizedTips(userId: string, limit: number = 1): Promise<ProfileTrainingTip[]> {
    // Get user profile
    const profile = await this.getUserProfile(userId);
    if (!profile) {
      console.warn(`No profile found for user ${userId} - returning empty tips array`);
      return [];
    }

    // Map user age to age group
    const getAgeGroup = (age: number | null): string => {
      if (!age) return "30–39"; // Default to 30-39 if no age (most common adult range)
      if (age >= 13 && age <= 17) return "13–17";
      if (age >= 18 && age <= 29) return "18–29";
      if (age >= 30 && age <= 39) return "30–39";
      if (age >= 40 && age <= 59) return "40–59";
      return "60+";
    };

    // Map user sex to gender - returns specific gender or null for neutral matching
    const getUserGender = (sex: string | null): string | null => {
      if (!sex) return null; // No specific gender - will match "både" only
      const normalized = sex.toLowerCase();
      if (normalized === "man" || normalized === "male" || normalized === "m") return "man";
      if (normalized === "kvinna" || normalized === "female" || normalized === "woman" || normalized === "f") return "kvinna";
      return null; // Unknown gender - will match "både" only
    };

    const ageGroup = getAgeGroup(profile.age);
    const userGender = getUserGender(profile.sex);
    const trainingLevel = profile.trainingLevel || "van"; // Default to "van" (intermediate)
    const sport = profile.specificSport?.trim() || null;

    // Build base query conditions (no age/training level - flexible matching)
    const baseConditions: any[] = [];

    // Gender: case-insensitive matching. If user has specific gender, match that OR "både". If no gender, match all genders
    if (userGender) {
      const genderCondition = or(
        sql`LOWER(${profileTrainingTips.gender}) = LOWER(${userGender})`,
        sql`LOWER(${profileTrainingTips.gender}) = 'både'`
      );
      if (genderCondition) baseConditions.push(genderCondition);
    }

    // Sport filter: if user has sport, match that OR general. If no sport, match all sports
    if (sport) {
      const sportCondition = or(
        sql`LOWER(${profileTrainingTips.sport}) = LOWER(${sport})`,
        isNull(profileTrainingTips.sport)
      );
      if (sportCondition) baseConditions.push(sportCondition);
    }

    // Try exact match first (age group + training level)
    let allTips = await db
      .select()
      .from(profileTrainingTips)
      .where(and(
        ...baseConditions,
        eq(profileTrainingTips.ageGroup, ageGroup),
        eq(profileTrainingTips.trainingLevel, trainingLevel)
      ));

    // Fallback 1: Match only training level (ignore age group)
    if (allTips.length === 0) {
      allTips = await db
        .select()
        .from(profileTrainingTips)
        .where(and(
          ...baseConditions,
          eq(profileTrainingTips.trainingLevel, trainingLevel)
        ));
    }

    // Fallback 2: Match only age group (ignore training level)
    if (allTips.length === 0) {
      allTips = await db
        .select()
        .from(profileTrainingTips)
        .where(and(
          ...baseConditions,
          eq(profileTrainingTips.ageGroup, ageGroup)
        ));
    }

    // Fallback 3: Just base conditions (no age/training filter)
    if (allTips.length === 0 && baseConditions.length > 0) {
      allTips = await db
        .select()
        .from(profileTrainingTips)
        .where(and(...baseConditions));
    }

    // Fallback 4: Any tips if nothing else matches
    if (allTips.length === 0) {
      allTips = await db
        .select()
        .from(profileTrainingTips)
        .limit(limit * 3); // Fetch more to allow randomization
    }

    // Randomize order and apply limit (default 1 for single tip)
    const shuffled = allTips.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }

  async getProfileTipsByCategory(userId: string, category: string, limit: number = 10): Promise<ProfileTrainingTip[]> {
    // Get user profile
    const profile = await this.getUserProfile(userId);
    if (!profile) {
      console.warn(`No profile found for user ${userId} - returning empty tips array`);
      return [];
    }

    // Map user age to age group
    const getAgeGroup = (age: number | null): string => {
      if (!age) return "30–39"; // Default to 30-39 if no age (most common adult range)
      if (age >= 13 && age <= 17) return "13–17";
      if (age >= 18 && age <= 29) return "18–29";
      if (age >= 30 && age <= 39) return "30–39";
      if (age >= 40 && age <= 59) return "40–59";
      return "60+";
    };

    const getUserGender = (sex: string | null): string | null => {
      if (!sex) return null;
      const normalized = sex.toLowerCase();
      if (normalized === "man" || normalized === "male" || normalized === "m") return "man";
      if (normalized === "kvinna" || normalized === "female" || normalized === "woman" || normalized === "f") return "kvinna";
      return null;
    };

    const ageGroup = getAgeGroup(profile.age);
    const userGender = getUserGender(profile.sex);
    const trainingLevel = profile.trainingLevel || "van"; // Default to "van" (intermediate) if not specified
    const sport = profile.specificSport?.trim() || null;

    // Build query with category filter - use flexible matching
    // First try exact match, then fall back to broader matches
    const baseConditions = [
      eq(profileTrainingTips.category, category),
    ];

    // Gender: case-insensitive matching. If user has specific gender, match that OR "både". If no gender, match all genders
    if (userGender) {
      const genderCondition = or(
        sql`LOWER(${profileTrainingTips.gender}) = LOWER(${userGender})`,
        sql`LOWER(${profileTrainingTips.gender}) = 'både'`
      );
      if (genderCondition) baseConditions.push(genderCondition);
    }

    // Sport filter: if user has sport, match that OR general. If no sport, match all sports
    if (sport) {
      const sportCondition = or(
        sql`LOWER(${profileTrainingTips.sport}) = LOWER(${sport})`,
        isNull(profileTrainingTips.sport)
      );
      if (sportCondition) baseConditions.push(sportCondition);
    }

    // Try exact match first (age group + training level)
    let allTips = await db
      .select()
      .from(profileTrainingTips)
      .where(and(
        ...baseConditions,
        eq(profileTrainingTips.ageGroup, ageGroup),
        eq(profileTrainingTips.trainingLevel, trainingLevel)
      ));

    // Fallback 1: Match only training level (ignore age group)
    if (allTips.length === 0) {
      allTips = await db
        .select()
        .from(profileTrainingTips)
        .where(and(
          ...baseConditions,
          eq(profileTrainingTips.trainingLevel, trainingLevel)
        ));
    }

    // Fallback 2: Match only age group (ignore training level)
    if (allTips.length === 0) {
      allTips = await db
        .select()
        .from(profileTrainingTips)
        .where(and(
          ...baseConditions,
          eq(profileTrainingTips.ageGroup, ageGroup)
        ));
    }

    // Fallback 3: Just match category (no age/training filter)
    if (allTips.length === 0) {
      allTips = await db
        .select()
        .from(profileTrainingTips)
        .where(and(...baseConditions));
    }

    // Randomize order and apply limit
    const shuffled = allTips.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }

  // ========== Exercise catalog operations ==========
  
  async getExerciseByName(name: string): Promise<{ id: string; name: string; nameEn: string | null; youtubeUrl: string | null; videoType: string | null } | undefined> {
    const { exercises } = await import("@shared/schema");
    const [exercise] = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        nameEn: exercises.nameEn,
        youtubeUrl: exercises.youtubeUrl,
        videoType: exercises.videoType,
      })
      .from(exercises)
      .where(or(eq(exercises.name, name), eq(exercises.nameEn, name)))
      .limit(1);
    return exercise;
  }

  async getExercisesByNames(names: string[]): Promise<{ id: string; name: string; nameEn: string | null; youtubeUrl: string | null; videoType: string | null }[]> {
    if (names.length === 0) {
      return [];
    }
    
    const { exercises } = await import("@shared/schema");
    return await db
      .select({
        id: exercises.id,
        name: exercises.name,
        nameEn: exercises.nameEn,
        youtubeUrl: exercises.youtubeUrl,
        videoType: exercises.videoType,
      })
      .from(exercises)
      .where(or(inArray(exercises.name, names), inArray(exercises.nameEn, names)));
  }

  // ========== Program template operations ==========
  
  async getUserProgramTemplates(userId: string): Promise<ProgramTemplate[]> {
    return await db
      .select()
      .from(programTemplates)
      .where(eq(programTemplates.userId, userId))
      .orderBy(programTemplates.createdAt);
  }

  async getProgramTemplate(id: string): Promise<ProgramTemplate | undefined> {
    const [template] = await db
      .select()
      .from(programTemplates)
      .where(eq(programTemplates.id, id));
    return template;
  }

  async getTemplateExercises(templateId: string): Promise<ProgramTemplateExercise[]> {
    return await db
      .select()
      .from(programTemplateExercises)
      .where(eq(programTemplateExercises.templateId, templateId))
      .orderBy(programTemplateExercises.orderIndex);
  }

  async updateTemplateExercises(templateId: string, exercises: Partial<ProgramTemplateExercise>[]): Promise<void> {
    // Fetch all existing exercises for this template to verify ownership
    const existingExercises = await db
      .select()
      .from(programTemplateExercises)
      .where(eq(programTemplateExercises.templateId, templateId));
    
    const existingIds = new Set(existingExercises.map(ex => ex.id));
    
    for (const exercise of exercises) {
      if (!exercise.id) continue;
      
      // Verify this exercise belongs to this template
      if (!existingIds.has(exercise.id)) {
        throw new Error(`Exercise ${exercise.id} does not belong to template ${templateId}`);
      }
      
      const updateData: any = {};
      if (exercise.orderIndex !== undefined) updateData.orderIndex = exercise.orderIndex;
      if (exercise.targetSets !== undefined) updateData.targetSets = exercise.targetSets;
      if (exercise.targetReps !== undefined) updateData.targetReps = exercise.targetReps;
      if (exercise.targetWeight !== undefined) updateData.targetWeight = exercise.targetWeight;
      
      await db
        .update(programTemplateExercises)
        .set(updateData)
        .where(
          and(
            eq(programTemplateExercises.id, exercise.id),
            eq(programTemplateExercises.templateId, templateId)
          )
        );
    }
  }

  async updateProgramTemplate(id: string, data: { dayOfWeek?: number }): Promise<ProgramTemplate> {
    const [template] = await db
      .update(programTemplates)
      .set(data)
      .where(eq(programTemplates.id, id))
      .returning();
    return template;
  }

  async getNextTemplate(userId: string): Promise<{ template: ProgramTemplate; exercises: ProgramTemplateExercise[] } | null> {
    const profile = await this.getUserProfile(userId);
    const templates = await this.getUserProgramTemplates(userId);
    
    // Early return if no templates to avoid modulo by zero
    if (templates.length === 0) {
      return null;
    }
    
    // Use currentPassNumber to determine which template to show (1-based index)
    const currentPassNumber = profile?.currentPassNumber || 1;
    const templateIndex = currentPassNumber - 1;
    
    // Wrap around if pass number exceeds template count
    const safeIndex = templateIndex % templates.length;
    const nextTemplate = templates[safeIndex];
    
    const exercises = await this.getTemplateExercises(nextTemplate.id);
    
    return {
      template: nextTemplate,
      exercises,
    };
  }

  async createProgramTemplatesFromAI(userId: string, aiProgramData: any): Promise<void> {
    const { getReferenceWeight } = await import("./lib/referenceWeights");
    
    console.log("[STORAGE] createProgramTemplatesFromAI called for userId:", userId);
    console.log("[STORAGE] aiProgramData:", JSON.stringify(aiProgramData).substring(0, 300));
    
    const phases = aiProgramData.phases || [];
    console.log("[STORAGE] Number of phases:", phases.length);
    
    const allSessions: any[] = [];
    
    phases.forEach((phase: any, phaseIdx: number) => {
      console.log(`[STORAGE] Phase ${phaseIdx}:`, phase.phaseName, "Sessions:", phase.sessions?.length || 0);
      if (phase.sessions && Array.isArray(phase.sessions)) {
        allSessions.push(...phase.sessions);
      }
    });
    
    console.log("[STORAGE] Total sessions to create:", allSessions.length);
    
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    
    for (let i = 0; i < allSessions.length; i++) {
      const session = allSessions[i];
      const templateName = `Pass ${letters[i] || i + 1}`;
      
      console.log(`[STORAGE] Creating template ${i + 1}/${allSessions.length}: ${templateName}`);
      
      const [template] = await db
        .insert(programTemplates)
        .values({
          userId,
          templateName,
          dayOfWeek: null,
        })
        .returning();
      
      const exercises = session.exercises || [];
      console.log(`[STORAGE] Template ${templateName} has ${exercises.length} exercises`);
      
      if (exercises.length === 0) {
        console.warn(`[STORAGE] WARNING: Template ${templateName} has no exercises!`);
      }
      
      for (let j = 0; j < exercises.length; j++) {
        const exercise = exercises[j];
        const exerciseName = exercise.exerciseTitle || exercise.exerciseName || exercise.name || 'Unknown';
        const exerciseKey = exercise.exerciseKey || `ex_${i}_${j}`;
        const referenceWeight = getReferenceWeight(exerciseName);
        
        console.log(`[STORAGE] Adding exercise ${j + 1}: ${exerciseName}`);
        
        await db.insert(programTemplateExercises).values({
          templateId: template.id,
          exerciseKey: exerciseKey,
          exerciseName: exerciseName,
          orderIndex: j,
          targetSets: parseInt(exercise.sets) || 3,
          targetReps: exercise.reps || '8-12',
          targetWeight: referenceWeight,
          requiredEquipment: exercise.equipment || [],
          muscles: exercise.muscleGroups || exercise.muscles || [],
          notes: exercise.notes || null,
        });
      }
    }
    
    console.log("[STORAGE] Template creation complete");
  }

  async createProgramTemplatesFromDeepSeek(userId: string, program: import("./ai-service").DeepSeekWorkoutProgram): Promise<void> {
    console.log("[STORAGE] createProgramTemplatesFromDeepSeek called for userId:", userId);
    
    // Set isGeneratingProgram = true at the start
    await db.update(userProfiles).set({ isGeneratingProgram: true }).where(eq(userProfiles.userId, userId));
    
    try {
      console.log("[STORAGE] Program overview:", program.program_overview.week_focus_summary);
      
      const weeklySessions = program.weekly_sessions || [];
      console.log("[STORAGE] Number of weekly sessions:", weeklySessions.length);
      
      // Import weight utilities
      const { getReferenceWeight } = await import("./lib/referenceWeights");
      
      if (weeklySessions.length === 0) {
        throw new Error("No weekly sessions found in generated program");
      }
      
      // Clear existing templates for atomic update
      await this.clearUserProgramTemplates(userId);

      // = ... availableEquipment setup ...
    
    // ============================================================
    // EQUIPMENT VALIDATION SETUP
    // Fetch user's available equipment upfront for post-validation
    // ============================================================
    
    // Get user's selected gym
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    
    const selectedGymId = profile?.selectedGymId || null;
    
    // Fetch equipment for the selected gym (or all user equipment if no gym selected)
    let userEquipmentQuery;
    if (selectedGymId) {
      userEquipmentQuery = db
        .select()
        .from(userEquipment)
        .where(and(eq(userEquipment.userId, userId), eq(userEquipment.gymId, selectedGymId)));
      console.log(`[EQUIPMENT VALIDATION] Using equipment from gym: ${selectedGymId}`);
    } else {
      userEquipmentQuery = db
        .select()
        .from(userEquipment)
        .where(eq(userEquipment.userId, userId));
      console.log("[EQUIPMENT VALIDATION] No gym selected - using all user equipment");
    }
    
    const userEquipmentList = await userEquipmentQuery;
    
    // iOS app may send equipment IDs instead of names - resolve UUIDs to names from catalog
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    
    // Get all equipment IDs that look like UUIDs
    const uuidEquipment = userEquipmentList.filter(eq => isUUID(eq.equipmentName));
    const normalEquipment = userEquipmentList.filter(eq => !isUUID(eq.equipmentName));
    
    // Lookup names from equipment catalog for UUIDs
    let resolvedEquipmentNames: string[] = normalEquipment.map(eq => eq.equipmentName.toLowerCase().trim());
    
    if (uuidEquipment.length > 0) {
      const uuids = uuidEquipment.map(eq => eq.equipmentName);
      const catalogItems = await db
        .select({ id: equipmentCatalog.id, name: equipmentCatalog.name })
        .from(equipmentCatalog)
        .where(sql`${equipmentCatalog.id} = ANY(ARRAY[${sql.join(uuids.map(u => sql`${u}`), sql`, `)}]::varchar[])`);
      
      const catalogNames = catalogItems.map(item => item.name.toLowerCase().trim());
      resolvedEquipmentNames = [...resolvedEquipmentNames, ...catalogNames];
      console.log(`[EQUIPMENT VALIDATION] Resolved ${uuidEquipment.length} UUIDs to names:`, catalogNames);
    }
    
    const availableEquipment = resolvedEquipmentNames;
    console.log(`[EQUIPMENT VALIDATION] User has ${availableEquipment.length} pieces of equipment:`, availableEquipment);
    
    // Helper function to normalize equipment names for comparison
    const normalizeEquipment = (name: string) => name.toLowerCase().trim();
    
    // Helper function to check if exercise's required equipment is available
    const isEquipmentAvailable = (requiredEquipment: string[]): { available: boolean; missingEquipment: string[] } => {
      if (!requiredEquipment || requiredEquipment.length === 0) {
        // Bodyweight exercise - always available
        return { available: true, missingEquipment: [] };
      }
      
      const missing: string[] = [];
      for (const required of requiredEquipment) {
        const normalizedRequired = normalizeEquipment(required);
        
        // Skip "unknown", "bodyweight", "none" equipment
        if (normalizedRequired === 'unknown' || normalizedRequired === 'bodyweight' || normalizedRequired === 'none') continue;
        
        // Check if any available equipment matches
        const found = availableEquipment.some(avail => {
          // Exact match
          if (avail === normalizedRequired) return true;
          // Partial match (e.g., "olympic barbell" contains "barbell")
          if (avail.includes(normalizedRequired) || normalizedRequired.includes(avail)) return true;
          // Common synonyms
          if ((avail.includes('dumbbell') && normalizedRequired.includes('hantel')) ||
              (avail.includes('hantel') && normalizedRequired.includes('dumbbell'))) return true;
          if ((avail.includes('barbell') && normalizedRequired.includes('skivstång')) ||
              (avail.includes('skivstång') && normalizedRequired.includes('barbell'))) return true;
          return false;
        });
        
        if (!found) {
          missing.push(required);
        }
      }
      
      return { available: missing.length === 0, missingEquipment: missing };
    };
    
    // ============================================================
    // END EQUIPMENT VALIDATION SETUP
    // ============================================================
    
    // Weekday mapping: Swedish weekday → integer (1=Monday, 7=Sunday)
    const weekdayToNumber: Record<string, number> = {
      'måndag': 1, 'monday': 1,
      'tisdag': 2, 'tuesday': 2,
      'onsdag': 3, 'wednesday': 3,
      'torsdag': 4, 'thursday': 4,
      'fredag': 5, 'friday': 5,
      'lördag': 6, 'saturday': 6,
      'söndag': 7, 'sunday': 7,
    };
    
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    
    for (let i = 0; i < weeklySessions.length; i++) {
      const session = weeklySessions[i];
      
      // Map AI's weekday to dayOfWeek integer
      const weekdayStr = session.weekday?.toLowerCase() || '';
      let dayOfWeek = weekdayToNumber[weekdayStr] || null;
      
      // Fallback: If AI didn't provide weekday, assign default based on session count
      if (dayOfWeek === null) {
        const totalSessions = weeklySessions.length;
        // Default day patterns based on number of sessions per week
        const defaultDayPatterns: { [key: number]: number[] } = {
          1: [1],                      // Mon
          2: [1, 4],                   // Mon, Thu
          3: [1, 3, 5],                // Mon, Wed, Fri
          4: [1, 2, 4, 6],             // Mon, Tue, Thu, Sat
          5: [1, 2, 3, 4, 5],          // Mon-Fri
          6: [1, 2, 3, 4, 5, 6],       // Mon-Sat
          7: [1, 2, 3, 4, 5, 6, 7],    // Every day
        };
        const pattern = defaultDayPatterns[totalSessions] || defaultDayPatterns[Math.min(totalSessions, 7)];
        dayOfWeek = pattern[i] || (i % 7) + 1;
        console.log(`[STORAGE] No weekday from AI, using default day pattern: session ${i + 1}/${totalSessions} → dayOfWeek=${dayOfWeek}`);
      }
      
      // Generate muscle_focus - this will also be used as templateName
      // Priority: muscle_focus > session_name > generated from exercises > fallback "Pass A/B/C"
      let muscleFocus = session.muscle_focus || session.session_name || null;
      if (!muscleFocus && session.main_work && session.main_work.length > 0) {
        const muscles = new Set<string>();
        session.main_work.forEach((ex: any) => {
          if (ex.target_muscles && Array.isArray(ex.target_muscles)) {
            ex.target_muscles.forEach((m: string) => muscles.add(m));
          }
        });
        if (muscles.size > 0) {
          const muscleArray = Array.from(muscles);
          // Generate descriptive focus based on muscle groups
          if (muscleArray.length === 1) {
            muscleFocus = muscleArray[0];
          } else if (muscleArray.some(m => m.toLowerCase().includes('chest') || m.toLowerCase().includes('bröst'))) {
            muscleFocus = "Upper Body - Push";
          } else if (muscleArray.some(m => m.toLowerCase().includes('back') || m.toLowerCase().includes('rygg'))) {
            muscleFocus = "Upper Body - Pull";
          } else if (muscleArray.some(m => m.toLowerCase().includes('leg') || m.toLowerCase().includes('ben'))) {
            muscleFocus = "Legs";
          } else {
            muscleFocus = muscleArray.slice(0, 2).join(" - ");
          }
          console.log(`[STORAGE] Generated muscle_focus from exercises: "${muscleFocus}"`);
        }
      }
      
      // Use muscleFocus as the template name, with fallback to "Pass A/B/C"
      const fallbackName = `Pass ${letters[i] || i + 1}`;
      const templateName = muscleFocus || fallbackName;
      
      console.log(`[STORAGE] Creating template ${i + 1}/${weeklySessions.length}: "${templateName}" (day=${dayOfWeek}, ${session.estimated_duration_minutes}min)`);
      
      const [template] = await db
        .insert(programTemplates)
        .values({
          userId,
          templateName,
          muscleFocus: muscleFocus,
          dayOfWeek: dayOfWeek,
          estimatedDurationMinutes: session.estimated_duration_minutes,
        })
        .returning();
      
      // Support both field names: main_work (legacy) and main_workout (V3)
      const mainWorkExercises = session.main_work || session.main_workout || [];
      console.log(`[STORAGE] Template ${templateName} has ${mainWorkExercises.length} main exercises`);
      
      if (mainWorkExercises.length === 0) {
        console.warn(`[STORAGE] WARNING: Template ${templateName} has no main exercises!`);
      }
      
      for (let j = 0; j < mainWorkExercises.length; j++) {
        const exercise = mainWorkExercises[j];
        const aiGeneratedName = exercise.exercise_name || 'Unknown';
        
        const matchResult = await matchExercise(aiGeneratedName);
        
        // CRITICAL: Only accept matched exercises with English names
        // Do NOT fall back to aiGeneratedName if match fails
        if (!matchResult.matched || !matchResult.exerciseName) {
          console.error(`[VALIDATION ERROR] ❌ Exercise "${aiGeneratedName}" not matched to catalog - SKIPPING`);
          console.warn(`[VALIDATION] Skipping unmatched exercise to enforce English-only policy`);
          continue; // Skip this exercise
        }
        
        const finalExerciseName = matchResult.exerciseName;
        
        const exerciseKey = finalExerciseName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        
        // POST-VALIDATION: Fix AI errors where time-based values are used for reps-based exercises
        let validatedReps = exercise.reps || '8-12';
        const repsValue = validatedReps.toLowerCase();
        const isTimeValue = repsValue.includes('sec') || repsValue.includes('sekund');
        
        // Known reps-based exercises that should NEVER have time values
        const repsBasedKeywords = [
          'press', 'push', 'pull', 'row', 'curl', 'extension', 'raise', 'fly', 'flye',
          'squat', 'lunge', 'deadlift', 'rdl', 'pulldown', 'pullup', 'pull-up',
          'dip', 'shrug', 'raise', 'lateral', 'front', 'rear', 'skull', 'tricep',
          'bicep', 'hammer', 'preacher', 'leg press', 'calf', 'crunch'
        ];
        
        const exerciseNameLower = finalExerciseName.toLowerCase();
        const isRepsBasedExercise = repsBasedKeywords.some(keyword => exerciseNameLower.includes(keyword));
        
        if (isTimeValue && isRepsBasedExercise) {
          console.warn(`[STORAGE] AI ERROR DETECTED: "${finalExerciseName}" has time value "${validatedReps}" - correcting to "8-12"`);
          validatedReps = '8-12';
        }
        
        // CRITICAL VALIDATION: Enforce English-only exercise names
        // Check if the matched name is English (canonical names are in English)
        // If the AI name was Swedish, it should have been matched to an English canonical name
        const hasSwedishCharsInMatched = /[åäöÅÄÖ]/.test(finalExerciseName);
        
        if (hasSwedishCharsInMatched) {
          console.error(`[VALIDATION ERROR] ❌ Swedish exercise name detected in matched catalog: "${finalExerciseName}" - SKIPPING`);
          continue; // Skip this exercise - don't insert it
        }
        
        console.log(`[VALIDATION] ✅ English exercise name confirmed: "${finalExerciseName}"`);
        
        // ============================================================
        // POST-VALIDATION: Check if exercise's required equipment is available
        // PRIORITIZE catalog exercise equipment over AI-provided equipment
        // ============================================================
        let requiredEquipment = exercise.required_equipment || [];
        
        // If AI didn't provide equipment OR provided 'unknown', look up from catalog using matched exercise ID
        if ((requiredEquipment.length === 0 || (requiredEquipment.length === 1 && requiredEquipment[0].toLowerCase() === 'unknown')) && matchResult.id) {
          const catalogExercise = await db
            .select({ requiredEquipment: exercises.requiredEquipment })
            .from(exercises)
            .where(eq(exercises.id, matchResult.id))
            .limit(1);
          
          if (catalogExercise.length > 0 && catalogExercise[0].requiredEquipment) {
            requiredEquipment = catalogExercise[0].requiredEquipment;
            console.log(`[EQUIPMENT VALIDATION] 📋 Using catalog equipment for "${finalExerciseName}": ${requiredEquipment.join(', ')}`);
          }
        }
        
        const equipmentCheck = isEquipmentAvailable(requiredEquipment);
        
        let exerciseToInsert = {
          name: finalExerciseName,
          key: exerciseKey,
          sets: exercise.sets || 3,
          reps: validatedReps,
          weight: (() => {
            // Already has weight from AI
            if (exercise.suggested_weight_kg && exercise.suggested_weight_kg > 0) {
              return Math.round(exercise.suggested_weight_kg);
            }
            
            const normalizedName = finalExerciseName.toLowerCase();
            
            // 1. Bodyweight check (don't treat "unknown" as bodyweight)
            const isBodyweight = requiredEquipment.some(eq => 
              eq.toLowerCase().includes('bodyweight') || 
              eq.toLowerCase().includes('kroppsvikt') ||
              eq.toLowerCase() === 'none'
            );
            if (isBodyweight) return 0;
            
            // 2. 1RM based calculation for compounds
            if (normalizedName.includes('bench press') || normalizedName.includes('bänkpress')) {
              if (profile?.oneRmBench) return Math.round(profile.oneRmBench * 0.65); // Starting safe at 65%
            }
            if (normalizedName.includes('squat') || (normalizedName.includes('knäböj') && !normalizedName.includes('utfall'))) {
              if (profile?.oneRmSquat) return Math.round(profile.oneRmSquat * 0.6);
            }
            if (normalizedName.includes('deadlift') || normalizedName.includes('marklyft')) {
              if (profile?.oneRmDeadlift) return Math.round(profile.oneRmDeadlift * 0.6);
            }
            if (normalizedName.includes('overhead press') || normalizedName.includes('axelpress') || normalizedName.includes('ohp')) {
              if (profile?.oneRmOhp) return Math.round(profile.oneRmOhp * 0.6);
            }
            if (normalizedName.includes('lat pull') || normalizedName.includes('latsdrag')) {
              if (profile?.oneRmLatpull) return Math.round(profile.oneRmLatpull * 0.65);
            }
            
            // 3. Reference weight fallback
            const ref = getReferenceWeight(finalExerciseName);
            return ref > 0 ? ref : null;
          })(),
          equipment: requiredEquipment,
          muscles: exercise.target_muscles || [],
        };
        
        if (!equipmentCheck.available) {
          console.warn(`[EQUIPMENT VALIDATION] ⚠️ Exercise "${finalExerciseName}" requires equipment user doesn't have: ${equipmentCheck.missingEquipment.join(', ')}`);
          console.warn(`[EQUIPMENT VALIDATION] Required: ${requiredEquipment.join(', ')}`);
          console.warn(`[EQUIPMENT VALIDATION] User has: ${availableEquipment.join(', ')}`);
          
          // Request AI replacement for same muscle group
          console.log(`[EQUIPMENT VALIDATION] 🔄 Requesting AI replacement for "${finalExerciseName}"...`);
          
          try {
            const { requestExerciseReplacement } = await import("./exercise-replacer");
            const replacement = await requestExerciseReplacement({
              originalExercise: finalExerciseName,
              targetMuscles: exercise.target_muscles || [],
              availableEquipment: availableEquipment,
              sets: exercise.sets || 3,
              reps: validatedReps,
              userLevel: profile?.trainingLevel || 'intermediate',
            });
            
            if (replacement && replacement.name) {
              console.log(`[EQUIPMENT VALIDATION] ✅ Got replacement: "${replacement.name}" (Reason: ${replacement.reason})`);
              
              // Use the replacement exercise instead
              const replacementKey = replacement.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
              exerciseToInsert = {
                name: replacement.name,
                key: replacementKey,
                sets: replacement.sets || exercise.sets || 3,
                reps: replacement.reps || validatedReps,
                weight: (() => {
                   const normalizedName = (replacement.name || "").toLowerCase();
                   
                   // 1. Bodyweight check
                   const isBodyweight = requiredEquipment.some(eq => 
                     eq.toLowerCase().includes('bodyweight') || 
                     eq.toLowerCase().includes('kroppsvikt') ||
                     eq.toLowerCase() === 'none'
                   );
                   if (isBodyweight) return 0;
                   
                   // 2. 1RM based calculation for compounds
                   if (normalizedName.includes('bench press') || normalizedName.includes('bänkpress')) {
                     if (profile?.oneRmBench) return Math.round(profile.oneRmBench * 0.65);
                   }
                   if (normalizedName.includes('squat') || (normalizedName.includes('knäböj') && !normalizedName.includes('utfall'))) {
                     if (profile?.oneRmSquat) return Math.round(profile.oneRmSquat * 0.6);
                   }
                   if (normalizedName.includes('deadlift') || normalizedName.includes('marklyft')) {
                     if (profile?.oneRmDeadlift) return Math.round(profile.oneRmDeadlift * 0.6);
                   }
                   if (normalizedName.includes('overhead press') || normalizedName.includes('axelpress') || normalizedName.includes('ohp')) {
                     if (profile?.oneRmOhp) return Math.round(profile.oneRmOhp * 0.6);
                   }
                   if (normalizedName.includes('lat pull') || normalizedName.includes('latsdrag')) {
                     if (profile?.oneRmLatpull) return Math.round(profile.oneRmLatpull * 0.65);
                   }
                   
                   // 3. Reference weight fallback
                   const ref = getReferenceWeight(replacement.name || "");
                   return ref > 0 ? ref : null;
                })(),
                equipment: [], // Replacement is guaranteed to work with available equipment
                muscles: exercise.target_muscles || [],
              };
            } else {
              // No replacement found - log to unmapped_exercises and skip
              console.warn(`[EQUIPMENT VALIDATION] ❌ No replacement found - logging and skipping "${finalExerciseName}"`);
              
              // Log to unmapped_exercises for admin review
              const { logUnmappedExercise } = await import("./exercise-matcher");
              await logUnmappedExercise(aiGeneratedName);
              
              continue; // Skip this exercise
            }
          } catch (replacementError) {
            console.error(`[EQUIPMENT VALIDATION] ❌ Replacement request failed:`, replacementError);
            
            // Log to unmapped_exercises for admin review
            try {
              const { logUnmappedExercise } = await import("./exercise-matcher");
              await logUnmappedExercise(aiGeneratedName);
            } catch (logError) {
              console.error(`[EQUIPMENT VALIDATION] Failed to log unmapped exercise:`, logError);
            }
            
            continue; // Skip this exercise
          }
        } else {
          console.log(`[EQUIPMENT VALIDATION] ✅ Equipment check passed for "${finalExerciseName}"`);
        }
        // ============================================================
        // END EQUIPMENT VALIDATION
        // ============================================================
        
        console.log(`[STORAGE] Adding exercise ${j + 1}: AI="${aiGeneratedName}" → Matched="${exerciseToInsert.name}" (${matchResult.confidence}), Reps="${exerciseToInsert.reps}"`);
        
        await db.insert(programTemplateExercises).values({
          templateId: template.id,
          exerciseKey: exerciseToInsert.key,
          exerciseName: exerciseToInsert.name,
          orderIndex: j,
          targetSets: exerciseToInsert.sets,
          targetReps: exerciseToInsert.reps,
          targetWeight: exerciseToInsert.weight,
          requiredEquipment: exerciseToInsert.equipment,
          muscles: exerciseToInsert.muscles,
          notes: [
            exercise.technique_cues?.join('. '),
            exercise.suggested_weight_notes,
            `Tempo: ${exercise.tempo}`,
            `Vila: ${exercise.rest_seconds}s`
          ].filter(Boolean).join('\n'),
        });
      }
    }
    
    // ============================================================
    // PATTERN CACHING - Save AI response for future local generation
    // ============================================================
    try {
      const { savePattern } = await import("./pattern-collector");
      
      // Get user's training preferences for pattern matching
      const trainingGoal = profile?.motivationType || profile?.trainingGoals || 'general';
      const trainingLevel = profile?.trainingLevel || 'intermediate';
      const daysPerWeek = profile?.sessionsPerWeek || weeklySessions.length;
      const sessionDuration = profile?.sessionDuration || 60;
      
      // Format AI response for pattern storage
      const aiResponseForPattern = {
        training_split: program.program_overview?.training_split || 'custom',
        weekly_structure: program.program_overview?.week_focus_summary || null,
        sessions: weeklySessions.map(session => ({
          session_name: session.session_name,
          target_muscle_focus: session.muscle_focus || '',
          exercises: (session.main_work || []).map((ex: any) => ({
            exercise_name: ex.exercise_name,
            target_muscles: ex.target_muscles || [],
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.rest_seconds,
            equipment_required: ex.equipment_required || [],
          })),
        })),
      };
      
      await savePattern(
        aiResponseForPattern,
        {
          trainingGoal,
          trainingLevel,
          daysPerWeek,
          sessionDuration,
          goalStrength: profile?.goalStrength ?? 50,
          goalVolume: profile?.goalVolume ?? 50,
          goalEndurance: profile?.goalEndurance ?? 50,
          goalCardio: profile?.goalCardio ?? 50,
          equipment: availableEquipment,
        },
        {
          aiProvider: 'gemini', // or detect from environment
          aiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        }
      );
      
      console.log("[STORAGE] ✅ Pattern cached for future local generation");
    } catch (patternError) {
      // Don't fail program creation if pattern caching fails
      console.warn("[STORAGE] ⚠️ Failed to cache pattern (non-critical):", patternError);
    }
    
      console.log("[STORAGE] DeepSeek template creation complete");
    } catch (error) {
       console.error("[STORAGE] ❌ Error in createProgramTemplatesFromDeepSeek:", error);
       throw error;
    } finally {
       // Always reset generation flag
       await db.update(userProfiles).set({ isGeneratingProgram: false }).where(eq(userProfiles.userId, userId));
       console.log("[STORAGE] 🏁 Generation flag reset to false for userId:", userId);
    }
  }

  async clearUserProgramTemplates(userId: string): Promise<void> {
    console.log("[STORAGE] Clearing all program templates for userId:", userId);
    
    const templates = await db
      .select({ id: programTemplates.id })
      .from(programTemplates)
      .where(eq(programTemplates.userId, userId));
    
    for (const template of templates) {
      await db
        .delete(programTemplateExercises)
        .where(eq(programTemplateExercises.templateId, template.id));
    }
    
    await db
      .delete(programTemplates)
      .where(eq(programTemplates.userId, userId));
    
    console.log("[STORAGE] Cleared", templates.length, "program templates");
  }

  async updateLastCompletedTemplate(userId: string, templateId: string): Promise<void> {
    await db
      .update(userProfiles)
      .set({ 
        lastCompletedTemplateId: templateId,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId));
  }

  async getTemplatesWithMetadata(userId: string): Promise<Array<{ template: ProgramTemplate & { exercises: any[] }; exerciseCount: number; isNext: boolean }>> {
    const profile = await this.getUserProfile(userId);
    const templates = await this.getUserProgramTemplates(userId);
    
    // Early return if no templates to avoid modulo by zero
    if (templates.length === 0) {
      return [];
    }
    
    // Use currentPassNumber to determine next template (1-based index)
    const currentPassNumber = profile?.currentPassNumber || 1;
    const nextTemplateIndex = currentPassNumber - 1;
    const safeIndex = nextTemplateIndex % templates.length;
    const nextTemplateId = templates[safeIndex]?.id;
    
    const result = await Promise.all(
      templates.map(async (template) => {
        const exercises = await this.getTemplateExercises(template.id);
        return {
          template: {
            ...template,
            exercises: exercises, // Include exercises array for iOS compatibility
          },
          exerciseCount: exercises.length,
          isNext: template.id === nextTemplateId,
        };
      })
    );
    
    return result;
  }

  async incrementProgramGeneration(userId: string): Promise<void> {
    const profile = await this.getUserProfile(userId);
    if (!profile) {
      throw new Error("User profile not found - cannot increment generation counter");
    }

    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const needsReset = !profile.weekStartDate || profile.weekStartDate < weekStart;

    let result;
    if (needsReset) {
      // New week - reset counter to 1
      result = await db
        .update(userProfiles)
        .set({
          programGenerationsThisWeek: 1,
          weekStartDate: weekStart,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId))
        .returning();
    } else {
      // Increment counter
      result = await db
        .update(userProfiles)
        .set({
          programGenerationsThisWeek: (profile.programGenerationsThisWeek || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId))
        .returning();
    }

    if (result.length === 0) {
      throw new Error("Failed to increment program generation counter - no rows updated");
    }
    
    console.log(`[STORAGE] Program generation counter updated to ${result[0].programGenerationsThisWeek}/5 for user ${userId}`);
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

export const storage = new DatabaseStorage();
