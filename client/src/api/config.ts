import { Platform } from 'react-native';

const getBaseUrl = () => {
  // On real Android device — use remote server
  if (Platform.OS === 'android') return 'http://72.56.97.209:4000';
  // Web and desktop use localhost
  return 'http://localhost:4000';
};

export const API_BASE_URL = getBaseUrl();
export const API_URL = `${API_BASE_URL}/api`;
