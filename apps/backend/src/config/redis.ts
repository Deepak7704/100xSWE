
import { connection } from '@openswe/shared/queues';

/**
 * Configure Redis memory limits and eviction policy
 * This sets up Layer 2 protection (LRU eviction) as a safety net
 * 
 * MUST be called on server startup before any Redis operations
 */
export async function configureRedis(): Promise<void> {
  try {
    // Set maximum memory limit to 512 MB
    await connection.config('SET', 'maxmemory', '512mb');
    
    // Set eviction policy to volatile-lru
    // This removes least recently used keys that have TTL set when memory limit is reached
    await connection.config('SET', 'maxmemory-policy', 'volatile-lru');
    
    console.log('Redis memory configuration applied successfully');
  } catch (error) {
    console.error('Failed to configure Redis:', error);
    throw error;
  }
}