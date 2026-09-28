// URL de la API. En producción cambia el valor por defecto por la URL de tu servidor (p. ej. https://mundo-misterioso-api.onrender.com).
// Para desarrollo local se puede sobrescribir desde la consola: localStorage.setItem('mm_api', 'http://localhost:3000')
export const API_URL = localStorage.getItem('mm_api') || (location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:3000' : 'https://CAMBIA-ESTA-URL.onrender.com');
