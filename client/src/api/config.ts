import { Platform } from 'react-native';

const getBaseUrl = () => {
  return 'http://72.56.97.209:4000';
};

export const API_BASE_URL = getBaseUrl();
export const API_URL = `${API_BASE_URL}/api`;
