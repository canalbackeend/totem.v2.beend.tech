const API_URL = ''; // Same origin

let authToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

async function getAuthHeader() {
  const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('access_token') : null);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
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
    const response = await fetch(url, {
      headers: await getAuthHeader()
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async post(endpoint: string, data: any) {
    const response = await fetch(`${API_URL}/api${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeader()
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async patch(endpoint: string, data: any) {
    const response = await fetch(`${API_URL}/api${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...await getAuthHeader()
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  async delete(endpoint: string) {
    const response = await fetch(`${API_URL}/api${endpoint}`, {
      method: 'DELETE',
      headers: await getAuthHeader()
    });
    if (!response.ok) throw new Error(await response.text());
    return response.status === 204 ? null : response.json();
  }
};
