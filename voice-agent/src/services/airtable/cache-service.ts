/**
 * Airtable Cache Service
 * Redis-based caching for Airtable data to improve performance
 */

import { getRedisClient } from '../redis';
import { logger } from '../../lib/logger';
import type { Employee, Provider, JobTemplate, Patient } from './types';

/**
 * Cache key generators
 */
export const CacheKeys = {
  employee: {
    byPhone: (phone: string) => `airtable:employee:phone:${phone}`,
    byPin: (pin: number) => `airtable:employee:pin:${pin}`,
    byId: (id: string) => `airtable:employee:id:${id}`,
  },
  provider: {
    byId: (id: string) => `airtable:provider:id:${id}`,
  },
  jobTemplate: {
    byCode: (code: string) => `airtable:job:code:${code}`,
    byId: (id: string) => `airtable:job:id:${id}`,
  },
  patient: {
    byId: (id: string) => `airtable:patient:id:${id}`,
  },
} as const;

/**
 * Generic cache operations
 */
export class AirtableCacheService {
  private redis = getRedisClient();

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached === null || cached === undefined) return null;

      // Upstash Redis may return the value directly or as a string
      let parsed: T;
      if (typeof cached === 'string') {
        parsed = JSON.parse(cached) as T;
      } else {
        // If it's already parsed (Upstash does this automatically sometimes)
        parsed = cached as T;
      }
      
      logger.info('Cache hit', { 
        key, 
        type: 'airtable_cache_hit' 
      });
      
      return parsed;
    } catch (error) {
      logger.error('Cache get error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'airtable_cache_error' 
      });
      return null;
    }
  }

  /**
   * Set data in cache with TTL
   */
  async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      await this.redis.setex(key, ttlSeconds, serialized);
      
      logger.info('Cache set', { 
        key, 
        ttl: ttlSeconds,
        type: 'airtable_cache_set' 
      });
    } catch (error) {
      logger.error('Cache set error', { 
        key, 
        ttl: ttlSeconds,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'airtable_cache_error' 
      });
    }
  }

  /**
   * Delete data from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      
      logger.info('Cache delete', { 
        key,
        type: 'airtable_cache_delete' 
      });
    } catch (error) {
      logger.error('Cache delete error', { 
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'airtable_cache_error' 
      });
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { 
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'airtable_cache_error' 
      });
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];

    try {
      const values = await this.redis.mget(keys);
      return values.map((value, index) => {
        if (!value) return null;
        
        try {
          let parsed: T;
          if (typeof value === 'string') {
            parsed = JSON.parse(value) as T;
          } else {
            parsed = value as T;
          }
          logger.info('Cache multi-hit', { 
            key: keys[index], 
            type: 'airtable_cache_hit' 
          });
          return parsed;
        } catch (parseError) {
          logger.error('Cache parse error', { 
            key: keys[index],
            error: parseError instanceof Error ? parseError.message : 'Parse error',
            type: 'airtable_cache_error' 
          });
          return null;
        }
      });
    } catch (error) {
      logger.error('Cache mget error', { 
        keys,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'airtable_cache_error' 
      });
      return keys.map(() => null);
    }
  }

  /**
   * Clear all Airtable cache entries
   * Useful for cache invalidation during development
   */
  async clearAirtableCache(): Promise<void> {
    try {
      const pattern = 'airtable:*';
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info('Airtable cache cleared', { 
          keysCleared: keys.length,
          type: 'airtable_cache_clear' 
        });
      }
    } catch (error) {
      logger.error('Cache clear error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'airtable_cache_error' 
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    employeeKeys: number;
    providerKeys: number;
    jobTemplateKeys: number;
    patientKeys: number;
    totalKeys: number;
  }> {
    try {
      const [employeeKeys, providerKeys, jobTemplateKeys, patientKeys] = await Promise.all([
        this.redis.keys('airtable:employee:*'),
        this.redis.keys('airtable:provider:*'),
        this.redis.keys('airtable:job:*'),
        this.redis.keys('airtable:patient:*'),
      ]);

      return {
        employeeKeys: employeeKeys.length,
        providerKeys: providerKeys.length,
        jobTemplateKeys: jobTemplateKeys.length,
        patientKeys: patientKeys.length,
        totalKeys: employeeKeys.length + providerKeys.length + jobTemplateKeys.length + patientKeys.length,
      };
    } catch (error) {
      logger.error('Cache stats error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'airtable_cache_error' 
      });
      
      return {
        employeeKeys: 0,
        providerKeys: 0,
        jobTemplateKeys: 0,
        patientKeys: 0,
        totalKeys: 0,
      };
    }
  }
}

// Export singleton instance
export const airtableCacheService = new AirtableCacheService();

/**
 * Typed cache operations for specific data types
 */
export const EmployeeCache = {
  getByPhone: (phone: string) => airtableCacheService.get<Employee>(CacheKeys.employee.byPhone(phone)),
  getByPin: (pin: number) => airtableCacheService.get<Employee>(CacheKeys.employee.byPin(pin)),
  getById: (id: string) => airtableCacheService.get<Employee>(CacheKeys.employee.byId(id)),
  
  setByPhone: (phone: string, employee: Employee, ttl: number) => 
    airtableCacheService.set(CacheKeys.employee.byPhone(phone), employee, ttl),
  setByPin: (pin: number, employee: Employee, ttl: number) => 
    airtableCacheService.set(CacheKeys.employee.byPin(pin), employee, ttl),
  setById: (id: string, employee: Employee, ttl: number) => 
    airtableCacheService.set(CacheKeys.employee.byId(id), employee, ttl),
};

export const ProviderCache = {
  getById: (id: string) => airtableCacheService.get<Provider>(CacheKeys.provider.byId(id)),
  setById: (id: string, provider: Provider, ttl: number) => 
    airtableCacheService.set(CacheKeys.provider.byId(id), provider, ttl),
};

export const JobTemplateCache = {
  getByCode: (code: string) => airtableCacheService.get<JobTemplate>(CacheKeys.jobTemplate.byCode(code)),
  getById: (id: string) => airtableCacheService.get<JobTemplate>(CacheKeys.jobTemplate.byId(id)),
  
  setByCode: (code: string, jobTemplate: JobTemplate, ttl: number) => 
    airtableCacheService.set(CacheKeys.jobTemplate.byCode(code), jobTemplate, ttl),
  setById: (id: string, jobTemplate: JobTemplate, ttl: number) => 
    airtableCacheService.set(CacheKeys.jobTemplate.byId(id), jobTemplate, ttl),
};

export const PatientCache = {
  getById: (id: string) => airtableCacheService.get<Patient>(CacheKeys.patient.byId(id)),
  setById: (id: string, patient: Patient, ttl: number) => 
    airtableCacheService.set(CacheKeys.patient.byId(id), patient, ttl),
};
