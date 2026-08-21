const API_URL = ''; // Same origin

let authToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

// Handler registrado pelo AuthContext: disparado quando qualquer chamada com
// token anexado recebe 401 (sessão expirada). Permite limpar o estado de sessão
// e deixar o ProtectedRoute redirecionar para /login (sem sessão "fantasma").
let unauthorizedHandler: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

function getAuthToken(): string | null {
  return authToken || (typeof window !== 'undefined' ? localStorage.getItem('access_token') : null);
}

async function getAuthHeader() {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {} as Record<string, string>;
}

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }
};

// Trata 401 de uma requisição que usava token: limpa o token e notifica o
// handler de sessão. Endpoints públicos (sem token) não disparam isto.
function handleUnauthorized(response: Response, hadToken: boolean) {
  if (response.status === 401 && hadToken) {
    setAuthToken(null);
    unauthorizedHandler?.();
  }
}

async function handleResponse(response: Response, hadToken: boolean) {
  if (!response.ok) {
    handleUnauthorized(response, hadToken);
    throw new Error(await response.text());
  }
  return response.status === 204 ? null : response.json();
}

export const api = {
  async get(endpoint: string, params?: Record<string, string>) {
    let url = `${API_URL}/api${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    const headers = await getAuthHeader();
    const hadToken = !!getAuthToken();
    const response = await fetch(url, { headers });
    return handleResponse(response, hadToken);
  },
  async post(endpoint: string, data: any) {
    const headers = {
      'Content-Type': 'application/json',
      ...await getAuthHeader()
    };
    const hadToken = !!getAuthToken();
    const response = await fetch(`${API_URL}/api${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return handleResponse(response, hadToken);
  },
  async patch(endpoint: string, data: any) {
    const headers = {
      'Content-Type': 'application/json',
      ...await getAuthHeader()
    };
    const hadToken = !!getAuthToken();
    const response = await fetch(`${API_URL}/api${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data)
    });
    return handleResponse(response, hadToken);
  },
  async delete(endpoint: string) {
    const headers = await getAuthHeader();
    const hadToken = !!getAuthToken();
    const response = await fetch(`${API_URL}/api${endpoint}`, {
      method: 'DELETE',
      headers
    });
    return handleResponse(response, hadToken);
  }
};
