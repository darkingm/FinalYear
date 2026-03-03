/**
 * Get time-based greeting
 * @returns 'morning' | 'afternoon' | 'evening' | 'night'
 */
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 17) {
    return 'afternoon';
  } else if (hour >= 17 && hour < 21) {
    return 'evening';
  } else {
    return 'night';
  }
}

/**
 * Get greeting message based on current time
 * @param name - User's name (optional)
 * @param translate - Translation function
 * @returns Greeting string
 */
export function getTimeGreeting(name?: string): string {
  const timeOfDay = getTimeOfDay();
  const greetingKey = `greeting.${timeOfDay}`;
  
  // Will be translated by i18next in component
  return greetingKey;
}
