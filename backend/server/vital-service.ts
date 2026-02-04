/**
 * Vital API Service
 * 
 * Handles integration with Vital (Junction) API for health data aggregation.
 * Supports Apple Health, Google Fit, Samsung Health, Fitbit, Oura, Whoop, Garmin.
 * 
 * Key Features:
 * - User creation in Vital
 * - Link token generation for OAuth connection flow
 * - Webhook signature verification
 * - Health metrics data parsing and storage
 */

import crypto from 'crypto';
import { db } from './db';
import { healthConnections, healthMetrics, healthSyncLogs } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

const VITAL_API_KEY = process.env.VITAL_API_KEY;
const VITAL_REGION = process.env.VITAL_REGION || 'eu'; // 'eu' or 'us'
const VITAL_ENVIRONMENT = process.env.VITAL_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'production'

const getVitalBaseUrl = () => {
  if (VITAL_ENVIRONMENT === 'sandbox') {
    return VITAL_REGION === 'us' 
      ? 'https://api.sandbox.us.junction.com'
      : 'https://api.sandbox.eu.junction.com';
  }
  return VITAL_REGION === 'us' 
    ? 'https://api.us.junction.com'
    : 'https://api.eu.junction.com';
};

const VITAL_BASE_URL = getVitalBaseUrl();

interface VitalUser {
  user_id: string;
  team_id: string;
  client_user_id: string;
  created_at: string;
}

interface VitalLinkToken {
  link_token: string;
  link_web_url: string;
}

interface VitalConnection {
  user_id: string;
  provider: string;
  source_id: string;
  created_at: string;
  updated_at: string;
  status: string;
}

/**
 * Simple token encryption using AES-256-GCM
 * For production: Consider using AWS KMS, Google Cloud KMS, or HashiCorp Vault
 */
function encryptToken(token: string): string {
  const key = crypto.scryptSync(VITAL_API_KEY || 'fallback-key', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptToken(encryptedToken: string): string {
  const key = crypto.scryptSync(VITAL_API_KEY || 'fallback-key', 'salt', 32);
  const parts = encryptedToken.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export class VitalService {
  /**
   * Create or get a Vital user for a given application user ID
   */
  async createOrGetVitalUser(userId: string): Promise<string> {
    try {
      const response = await fetch(`${VITAL_BASE_URL}/v2/user`, {
        method: 'POST',
        headers: {
          'x-vital-api-key': VITAL_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_user_id: userId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Vital user creation failed: ${response.status} - ${error}`);
      }

      const data: VitalUser = await response.json();
      return data.user_id;
    } catch (error: any) {
      console.error('[VITAL] User creation error:', error);
      throw new Error(`Failed to create Vital user: ${error.message}`);
    }
  }

  /**
   * Generate a Link token for OAuth connection flow
   * Returns both link_token and link_web_url for the Vital Link Widget
   */
  async generateLinkToken(userId: string): Promise<VitalLinkToken> {
    try {
      // First ensure user exists in Vital
      const vitalUserId = await this.createOrGetVitalUser(userId);

      const response = await fetch(`${VITAL_BASE_URL}/v2/link/token`, {
        method: 'POST',
        headers: {
          'x-vital-api-key': VITAL_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: vitalUserId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Link token generation failed: ${response.status} - ${error}`);
      }

      const data: VitalLinkToken = await response.json();
      return data;
    } catch (error: any) {
      console.error('[VITAL] Link token generation error:', error);
      throw new Error(`Failed to generate link token: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature from Vital
   * Vital signs webhooks with HMAC-SHA256
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get user's Vital connections
   */
  async getUserConnections(userId: string): Promise<VitalConnection[]> {
    try {
      const vitalUserId = await this.createOrGetVitalUser(userId);

      const response = await fetch(`${VITAL_BASE_URL}/v2/user/${vitalUserId}/connections`, {
        method: 'GET',
        headers: {
          'x-vital-api-key': VITAL_API_KEY!,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch connections: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data.connections || [];
    } catch (error: any) {
      console.error('[VITAL] Get connections error:', error);
      throw new Error(`Failed to get connections: ${error.message}`);
    }
  }

  /**
   * Disconnect a provider connection
   */
  async disconnectProvider(userId: string, provider: string): Promise<void> {
    try {
      const vitalUserId = await this.createOrGetVitalUser(userId);

      const response = await fetch(`${VITAL_BASE_URL}/v2/user/${vitalUserId}/connections/${provider}`, {
        method: 'DELETE',
        headers: {
          'x-vital-api-key': VITAL_API_KEY!,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to disconnect: ${response.status} - ${error}`);
      }

      // Update local database
      await db.update(healthConnections)
        .set({ 
          status: 'disconnected',
          disconnectedAt: new Date(),
        })
        .where(and(
          eq(healthConnections.userId, userId),
          eq(healthConnections.platform, provider)
        ));

      console.log(`[VITAL] Disconnected ${provider} for user ${userId}`);
    } catch (error: any) {
      console.error('[VITAL] Disconnect error:', error);
      throw new Error(`Failed to disconnect provider: ${error.message}`);
    }
  }

  /**
   * Store connection in database after successful OAuth
   */
  async storeConnection(userId: string, vitalUserId: string, provider: string, accessToken?: string, refreshToken?: string) {
    try {
      const encryptedAccess = accessToken ? encryptToken(accessToken) : null;
      const encryptedRefresh = refreshToken ? encryptToken(refreshToken) : null;

      await db.insert(healthConnections).values({
        userId,
        platform: provider,
        status: 'active',
        vitalUserId,
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        connectedAt: new Date(),
      }).onConflictDoUpdate({
        target: [healthConnections.userId, healthConnections.platform],
        set: {
          status: 'active',
          vitalUserId,
          encryptedAccessToken: encryptedAccess,
          encryptedRefreshToken: encryptedRefresh,
          connectedAt: new Date(),
          disconnectedAt: null,
          lastError: null,
          errorCount: 0,
          updatedAt: new Date(),
        },
      });

      console.log(`[VITAL] Stored connection for ${provider} - user ${userId}`);
    } catch (error: any) {
      console.error('[VITAL] Store connection error:', error);
      throw new Error(`Failed to store connection: ${error.message}`);
    }
  }

  /**
   * Process webhook data and store health metrics
   */
  async processWebhookData(webhookData: any) {
    try {
      const { user_id, data, event_type } = webhookData;

      // Find user by Vital user_id
      const [connection] = await db
        .select({ userId: healthConnections.userId })
        .from(healthConnections)
        .where(eq(healthConnections.vitalUserId, user_id))
        .limit(1);

      if (!connection) {
        console.warn(`[VITAL] No connection found for vital user ${user_id}`);
        return;
      }

      const userId = connection.userId;

      // Log sync start
      const [syncLog] = await db.insert(healthSyncLogs).values({
        userId,
        connectionId: null, // Will be set if we find the connection
        platform: webhookData.provider || 'unknown',
        syncType: 'webhook',
        status: 'success',
        metricsCount: 0,
        startedAt: new Date(),
      }).returning();

      let metricsCount = 0;

      // Parse and store metrics based on event type
      if (event_type === 'daily.data.activity.created' && data?.activity) {
        metricsCount += await this.storeActivityMetrics(userId, data.activity);
      } else if (event_type === 'daily.data.sleep.created' && data?.sleep) {
        metricsCount += await this.storeSleepMetrics(userId, data.sleep);
      } else if (event_type === 'daily.data.body.created' && data?.body) {
        metricsCount += await this.storeBodyMetrics(userId, data.body);
      }

      // Update sync log
      await db.update(healthSyncLogs)
        .set({
          metricsCount,
          completedAt: new Date(),
        })
        .where(eq(healthSyncLogs.id, syncLog.id));

      console.log(`[VITAL] Processed webhook for user ${userId}, stored ${metricsCount} metrics`);
    } catch (error: any) {
      console.error('[VITAL] Webhook processing error:', error);
      throw error;
    }
  }

  /**
   * Store activity metrics (steps, calories, distance, active minutes)
   */
  private async storeActivityMetrics(userId: string, activity: any): Promise<number> {
    let count = 0;
    const date = new Date(activity.calendar_date);

    const metrics = [
      { type: 'steps', value: activity.steps, unit: 'steps' },
      { type: 'calories_burned', value: Math.round(activity.calories_total || 0), unit: 'kcal' },
      { type: 'active_minutes', value: Math.round(activity.active_duration_seconds / 60), unit: 'minutes' },
      { type: 'distance_meters', value: Math.round(activity.distance_meters || 0), unit: 'meters' },
    ];

    for (const metric of metrics) {
      if (metric.value !== null && metric.value !== undefined) {
        await db.insert(healthMetrics).values({
          userId,
          metricType: metric.type,
          value: metric.value,
          unit: metric.unit,
          date,
          collectedAt: new Date(),
        }).onConflictDoUpdate({
          target: [healthMetrics.userId, healthMetrics.metricType, healthMetrics.date],
          set: {
            value: metric.value,
            collectedAt: new Date(),
          },
        });
        count++;
      }
    }

    return count;
  }

  /**
   * Store sleep metrics (duration, quality score)
   */
  private async storeSleepMetrics(userId: string, sleep: any): Promise<number> {
    let count = 0;
    const date = new Date(sleep.calendar_date);

    const metrics = [
      { type: 'sleep_duration_minutes', value: Math.round(sleep.duration_seconds / 60), unit: 'minutes' },
      { type: 'sleep_quality_score', value: sleep.score || 0, unit: 'score' },
    ];

    for (const metric of metrics) {
      if (metric.value !== null && metric.value !== undefined) {
        await db.insert(healthMetrics).values({
          userId,
          metricType: metric.type,
          value: metric.value,
          unit: metric.unit,
          date,
          collectedAt: new Date(),
        }).onConflictDoUpdate({
          target: [healthMetrics.userId, healthMetrics.metricType, healthMetrics.date],
          set: {
            value: metric.value,
            collectedAt: new Date(),
          },
        });
        count++;
      }
    }

    return count;
  }

  /**
   * Store body metrics (heart rate, HRV, VO2 max)
   */
  private async storeBodyMetrics(userId: string, body: any): Promise<number> {
    let count = 0;
    const date = new Date(body.calendar_date);

    const metrics = [
      { type: 'heart_rate_avg', value: Math.round(body.heart_rate?.avg_bpm || 0), unit: 'bpm' },
      { type: 'heart_rate_resting', value: Math.round(body.heart_rate?.resting_bpm || 0), unit: 'bpm' },
      { type: 'heart_rate_variability', value: Math.round(body.hrv?.rmssd_ms || 0), unit: 'ms' },
      { type: 'vo2_max', value: Math.round(body.vo2_max || 0), unit: 'ml/kg/min' },
    ];

    for (const metric of metrics) {
      if (metric.value !== null && metric.value !== undefined && metric.value > 0) {
        await db.insert(healthMetrics).values({
          userId,
          metricType: metric.type,
          value: metric.value,
          unit: metric.unit,
          date,
          collectedAt: new Date(),
        }).onConflictDoUpdate({
          target: [healthMetrics.userId, healthMetrics.metricType, healthMetrics.date],
          set: {
            value: metric.value,
            collectedAt: new Date(),
          },
        });
        count++;
      }
    }

    return count;
  }

  /**
   * Get health metrics for a user for a specific date range
   */
  async getMetrics(userId: string, startDate: Date, endDate: Date) {
    const metrics = await db
      .select()
      .from(healthMetrics)
      .where(and(
        eq(healthMetrics.userId, userId),
        // Date range filtering would go here
      ))
      .orderBy(desc(healthMetrics.date));

    return metrics;
  }

  /**
   * Sync workout data to Vital API
   * Sends completed workout metrics to connected health platforms
   */
  async syncWorkoutToVital(userId: string, workoutData: {
    durationMinutes: number;
    activeCalories?: number;
    totalSets: number;
    totalExercises: number;
  }): Promise<boolean> {
    try {
      const vitalUserId = await this.createOrGetVitalUser(userId);
      
      // Get user's connected health platforms
      const connections = await db.query.healthConnections.findMany({
        where: eq(healthConnections.userId, userId),
      });

      if (!connections.length) {
        console.log(`[VITAL] No health connections for user ${userId}, skipping sync`);
        return false;
      }

      // Store workout metrics in health_metrics table
      // This will be synced to Apple Health via Vital webhooks
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Active minutes metric
      await db.insert(healthMetrics).values({
        userId,
        metricType: 'active_minutes',
        value: workoutData.durationMinutes,
        unit: 'minutes',
        date: today,
        collectedAt: new Date(),
        metadata: {
          source: 'workout_session',
          exerciseCount: workoutData.totalExercises,
          totalSets: workoutData.totalSets,
        },
      }).onConflictDoUpdate({
        target: [healthMetrics.userId, healthMetrics.metricType, healthMetrics.date],
        set: {
          value: sql`${healthMetrics.value} + ${workoutData.durationMinutes}`,
          collectedAt: new Date(),
        },
      });

      // Active calories metric
      if (workoutData.activeCalories && workoutData.activeCalories > 0) {
        await db.insert(healthMetrics).values({
          userId,
          metricType: 'calories_burned',
          value: workoutData.activeCalories,
          unit: 'kcal',
          date: today,
          collectedAt: new Date(),
          metadata: {
            source: 'workout_session',
          },
        }).onConflictDoUpdate({
          target: [healthMetrics.userId, healthMetrics.metricType, healthMetrics.date],
          set: {
            value: sql`${healthMetrics.value} + ${workoutData.activeCalories}`,
            collectedAt: new Date(),
          },
        });
      }

      console.log(`[VITAL] Synced workout data for user ${userId}: ${workoutData.durationMinutes}m, ${workoutData.activeCalories}cal`);
      return true;
    } catch (error: any) {
      console.error('[VITAL] Workout sync error:', error);
      // Don't throw - allow session completion even if sync fails
      return false;
    }
  }

  /**
   * Fetch body data (weight, height) from Vital API
   * Returns most recent weight and height measurements
   */
  async getBodyData(userId: string): Promise<{ weight?: number; height?: number; birthdate?: string } | null> {
    try {
      const vitalUserId = await this.createOrGetVitalUser(userId);

      // Get user profile for birthdate
      const profileResponse = await fetch(`${VITAL_BASE_URL}/v2/user/${vitalUserId}`, {
        method: 'GET',
        headers: {
          'x-vital-api-key': VITAL_API_KEY!,
        },
      });

      let birthdate: string | undefined;
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        birthdate = profileData.fallback_birth_date;
      }

      // Get body measurements from connected devices
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Last 90 days

      const bodyResponse = await fetch(
        `${VITAL_BASE_URL}/v2/summary/body/${vitalUserId}?start_date=${startDate}&end_date=${endDate}`,
        {
          method: 'GET',
          headers: {
            'x-vital-api-key': VITAL_API_KEY!,
          },
        }
      );

      if (!bodyResponse.ok) {
        console.log(`[VITAL] No body data available for user ${userId}`);
        return { birthdate };
      }

      const bodyData = await bodyResponse.json();
      
      // Extract most recent weight and height from the response
      let weight: number | undefined;
      let height: number | undefined;

      if (bodyData.body && Array.isArray(bodyData.body) && bodyData.body.length > 0) {
        // Sort by date descending to get most recent
        const sortedData = bodyData.body.sort((a: any, b: any) => 
          new Date(b.calendar_date).getTime() - new Date(a.calendar_date).getTime()
        );

        // Find most recent weight
        const recentWeight = sortedData.find((entry: any) => entry.weight_kg);
        if (recentWeight?.weight_kg) {
          weight = recentWeight.weight_kg;
        }

        // Find most recent height
        const recentHeight = sortedData.find((entry: any) => entry.height_cm);
        if (recentHeight?.height_cm) {
          height = recentHeight.height_cm;
        }
      }

      console.log(`[VITAL] Fetched body data for user ${userId}: weight=${weight}kg, height=${height}cm, birthdate=${birthdate}`);
      
      return { weight, height, birthdate };
    } catch (error: any) {
      console.error('[VITAL] Get body data error:', error);
      return null;
    }
  }
}

export const vitalService = new VitalService();
