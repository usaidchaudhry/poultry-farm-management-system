import { useEffect } from 'react';
import { config } from '../utils/config.js';

// Sets the browser tab title: "Flocks | Poultry Management System"
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ${config.appName}` : config.appName;
  }, [title]);
}
