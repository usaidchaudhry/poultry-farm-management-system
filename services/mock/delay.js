// Simulates network time so loading states are visible while using mock services.
export const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));
