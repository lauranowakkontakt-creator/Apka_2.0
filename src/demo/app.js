// TRYB DEMO — atrapa `firebase/app`. Patrz src/demo/firestore.js.
export const initializeApp = (config) => ({ name: '[DEFAULT]', options: config || {} })
export const getApp = () => ({ name: '[DEFAULT]', options: {} })
export const getApps = () => []
