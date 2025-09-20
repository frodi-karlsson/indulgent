import { ApiService, type Endpoint } from 'indulgent/api';

type WeatherEndpoint = Endpoint<{
  method: 'GET';
  path: '/weather';
  query: {
    city: string;
  };
  response: {
    temperature: number;
    description: string;
  };
}>;

type AliveEndpoint = Endpoint<{
  method: 'GET';
  path: '/alive';
  response: {
    status: 'ok';
  };
}>;

class WeatherApi extends ApiService<WeatherEndpoint | AliveEndpoint> {}

const baseUrl = 'https://api.example.com';
const weatherApi = new WeatherApi({
  fetcher: {
    fetch: async (url, method, _body, options) => {
      const response = await fetch(`${baseUrl}${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });
      return response.json();
    },
  },
});

const londonWeather = await weatherApi.get('/weather', {
  query: { city: 'London' },
});
console.log(
  `London Weather: ${londonWeather.temperature}°C, ${londonWeather.description}`,
);

const { status } = await weatherApi.get('/alive');
console.log(`API Status: ${status}`);
