/**
 * YouTube Data API v3 Service
 * Fetches videos from @DeltaBolic channel for exercise library
 */

interface YouTubeVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  url: string;
  isShort: boolean;
}

interface ChannelResponse {
  items: Array<{
    id: string;
    contentDetails: {
      relatedPlaylists: {
        uploads: string;
      };
    };
  }>;
}

interface PlaylistItemsResponse {
  items: Array<{
    contentDetails: {
      videoId: string;
    };
    snippet: {
      title: string;
      publishedAt: string;
    };
  }>;
  nextPageToken?: string;
}

export class YouTubeService {
  private apiKey: string;
  private baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('YouTube API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Get channel ID from handle (e.g., @DeltaBolic)
   */
  async getChannelId(handle: string): Promise<string> {
    // Remove @ if present
    const cleanHandle = handle.replace('@', '');

    const url = new URL(`${this.baseUrl}/channels`);
    url.searchParams.append('part', 'contentDetails');
    url.searchParams.append('forHandle', cleanHandle);
    url.searchParams.append('key', this.apiKey);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }

    const data: ChannelResponse = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error(`Channel not found: ${handle}`);
    }

    return data.items[0].id;
  }

  /**
   * Get uploads playlist ID from channel ID
   */
  async getUploadsPlaylistId(channelId: string): Promise<string> {
    const url = new URL(`${this.baseUrl}/channels`);
    url.searchParams.append('part', 'contentDetails');
    url.searchParams.append('id', channelId);
    url.searchParams.append('key', this.apiKey);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }

    const data: ChannelResponse = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    return data.items[0].contentDetails.relatedPlaylists.uploads;
  }

  /**
   * Get all videos from a playlist (with pagination)
   */
  async getPlaylistVideos(playlistId: string): Promise<YouTubeVideo[]> {
    const videos: YouTubeVideo[] = [];
    let nextPageToken: string | undefined;

    do {
      const url = new URL(`${this.baseUrl}/playlistItems`);
      url.searchParams.append('part', 'snippet,contentDetails');
      url.searchParams.append('playlistId', playlistId);
      url.searchParams.append('maxResults', '50');
      url.searchParams.append('key', this.apiKey);
      
      if (nextPageToken) {
        url.searchParams.append('pageToken', nextPageToken);
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
      }

      const data: PlaylistItemsResponse = await response.json();

      for (const item of data.items) {
        const videoId = item.contentDetails.videoId;
        const title = item.snippet.title;
        const publishedAt = item.snippet.publishedAt;

        videos.push({
          videoId,
          title,
          publishedAt,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          isShort: false, // Will be determined later by checking video duration
        });
      }

      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return videos;
  }

  /**
   * Check which videos are shorts (duration < 60 seconds)
   * Batch check using videos.list endpoint
   */
  async enrichWithShortStatus(videos: YouTubeVideo[]): Promise<YouTubeVideo[]> {
    // Process in batches of 50 (API limit)
    const batchSize = 50;
    const enriched: YouTubeVideo[] = [];

    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);
      const videoIds = batch.map(v => v.videoId).join(',');

      const url = new URL(`${this.baseUrl}/videos`);
      url.searchParams.append('part', 'contentDetails');
      url.searchParams.append('id', videoIds);
      url.searchParams.append('key', this.apiKey);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.error(`YouTube API error: ${response.status} ${response.statusText}`);
        // Fallback: assume all are regular videos
        enriched.push(...batch);
        continue;
      }

      const data = await response.json();

      for (const item of data.items) {
        const video = batch.find(v => v.videoId === item.id);
        if (video) {
          // Parse ISO 8601 duration (e.g., "PT15S" = 15 seconds, "PT1M30S" = 90 seconds)
          const duration = item.contentDetails.duration;
          const seconds = this.parseDuration(duration);
          
          enriched.push({
            ...video,
            isShort: seconds < 60,
          });
        }
      }
    }

    return enriched;
  }

  /**
   * Parse ISO 8601 duration to seconds
   * Example: PT1M30S = 90 seconds, PT15S = 15 seconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Get all videos from @DeltaBolic channel
   */
  async getDeltaBolicVideos(): Promise<YouTubeVideo[]> {
    console.log('Fetching @DeltaBolic videos...');
    
    // Step 1: Get channel ID
    const channelId = await this.getChannelId('DeltaBolic');
    console.log(`Channel ID: ${channelId}`);

    // Step 2: Get uploads playlist
    const uploadsPlaylistId = await this.getUploadsPlaylistId(channelId);
    console.log(`Uploads playlist: ${uploadsPlaylistId}`);

    // Step 3: Get all videos
    const videos = await this.getPlaylistVideos(uploadsPlaylistId);
    console.log(`Found ${videos.length} videos`);

    // Step 4: Determine which are shorts
    const enrichedVideos = await this.enrichWithShortStatus(videos);
    const shorts = enrichedVideos.filter(v => v.isShort);
    const regularVideos = enrichedVideos.filter(v => !v.isShort);
    
    console.log(`Shorts: ${shorts.length}, Regular videos: ${regularVideos.length}`);

    return enrichedVideos;
  }
}

// Export singleton instance
export const youtubeService = new YouTubeService(process.env.YOUTUBE_API_KEY || '');
