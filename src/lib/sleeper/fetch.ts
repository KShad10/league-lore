/**
 * Fetch data from Sleeper API with error handling
 */
export async function fetchFromSleeper<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store' // Disable caching for now
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // League/user not found
      }
      throw new Error(`Sleeper API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    throw error;
  }
}

/**
 * Fetch with retry logic for transient failures
 */
export async function fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T | null> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFromSleeper<T>(url);
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  
  throw lastError;
}
