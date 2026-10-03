import axios from "axios";

const client = axios.create({ baseURL: "/facialy/api/" });

// El access token vive solo en memoria (no en localStorage): un XSS no puede robarlo
// para usarlo después. El refresh token va en una cookie httpOnly que JS no puede leer.
let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token;
};

client.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Renovación transparente: ante un 401 se pide un access nuevo (una sola petición en vuelo)
// y se reintenta la original.
let refreshing = null;
export function refreshAccess() {
  refreshing ??= axios
    .post("/facialy/api/auth/refresh/")
    .then(({ data }) => {
      setAccessToken(data.access);
      return data;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const url = config?.url ?? "";
    const isAuthCall = url.includes("auth/");
    if (response?.status === 401 && !isAuthCall && !config._retried && accessToken) {
      config._retried = true;
      try {
        await refreshAccess();
        config.headers.Authorization = `Bearer ${accessToken}`;
        return client(config);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new Event("facialy:unauthorized"));
      }
    }
    return Promise.reject(error);
  },
);

/** Extrae un mensaje legible de un error de axios/DRF. */
export function errorMessage(error, fallback = "Algo ha salido mal. Inténtalo de nuevo.") {
  const data = error?.response?.data;
  if (!data) return error?.code === "ERR_NETWORK" ? "Sin conexión con el servidor." : fallback;
  if (typeof data === "string") return fallback;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  const first = Object.entries(data)[0];
  if (first) {
    const [field, msgs] = first;
    return `${field === "non_field_errors" ? "" : field + ": "}${[].concat(msgs)[0]}`;
  }
  return fallback;
}

export default client;
